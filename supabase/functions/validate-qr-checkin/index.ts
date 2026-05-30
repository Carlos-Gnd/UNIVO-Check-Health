// Verifica el QR estático de la sede + precisión GPS + geofence + ventana horaria
// del alumno (student_schedules) + anti-fraude, captura la IP y registra el check-in.
// El INSERT usa service_role para bypass de RLS; la identidad del alumno viene del auth token.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as jose from 'https://esm.sh/jose@5';
import { corsHeaders } from '../_shared/cors.ts';

// Precisión GPS máxima aceptada (metros). Lecturas peores suelen ser por wifi/IP,
// no por GPS real → se rechazan. Ajustable según experiencia de campo.
const ACCURACY_MAX_METERS = 100;

type RequestBody = {
  qr_token?: string;      // JWT del QR escaneado con cámara
  short_code?: string;    // Código corto de 6 chars (fallback sin cámara)
  campus_id?: string;     // Requerido cuando se usa short_code
  lat?: number;
  lng?: number;
  accuracy?: number;
  device_fingerprint?: string;
  device_info?: Record<string, unknown>;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  const fail = (message: string, status = 200) => json({ ok: false, message }, status);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return fail('Sesión no encontrada. Vuelve a iniciar sesión.', 401);

  // Cliente con auth del alumno (para identificarlo y RPC que respetan RLS)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  // Cliente service_role para writes (INSERT attendances, audit_log)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('Sesión no encontrada. Vuelve a iniciar sesión.', 401);

  const body = await req.json().catch(() => ({})) as RequestBody;
  const { qr_token, short_code, campus_id: bodyCampusId, lat, lng, accuracy, device_fingerprint, device_info } = body;

  if (lat == null || lng == null) return fail('Faltan parámetros requeridos (lat, lng).');
  if (!qr_token && (!short_code || !bodyCampusId)) {
    return fail('Proporciona qr_token o (short_code + campus_id).');
  }

  // 3b. Precisión GPS: rechazar lecturas demasiado imprecisas.
  if (accuracy != null && accuracy > ACCURACY_MAX_METERS) {
    return fail(`Señal GPS imprecisa (±${Math.round(accuracy)} m). Sal al exterior o activa la ubicación de alta precisión e inténtalo de nuevo.`);
  }

  const qrSecret = Deno.env.get('QR_JWT_SECRET');
  if (!qrSecret) return fail('Servidor mal configurado.', 500);
  const secretKey = new TextEncoder().encode(qrSecret);

  // ── Resolver la sede desde el QR estático (sin fecha) ──────────────────────
  let campusId: string;

  if (short_code && bodyCampusId) {
    // Código corto manual (sin cámara): se busca el QR estático de la sede.
    const { data: cached } = await admin
      .from('campus_qr')
      .select('token')
      .eq('campus_id', bodyCampusId)
      .eq('short_code', short_code.toUpperCase())
      .single();
    if (!cached?.token) {
      return fail('Código incorrecto. Verifica las 6 letras o pídelo al encargado.');
    }
    try {
      const { payload } = await jose.jwtVerify(cached.token as string, secretKey, { algorithms: ['HS256'] });
      campusId = (payload as { campus_id: string }).campus_id;
    } catch {
      return fail('Código inválido. Pídele al encargado que regenere el QR.');
    }
  } else {
    // QR escaneado con cámara: verificar la firma (ya no caduca por fecha).
    try {
      const { payload } = await jose.jwtVerify(qr_token!, secretKey, { algorithms: ['HS256'] });
      campusId = (payload as { campus_id: string }).campus_id;
    } catch {
      return fail('QR inválido. Pídele al encargado que regenere el QR de la sede.');
    }
  }

  // 3. Geofence (la RPC valida distancia y la ventana general de la sede)
  const { data: validationData, error: validationError } = await supabase.rpc('validate_checkin_area', {
    p_campus_id: campusId,
    p_current_lat: lat,
    p_current_lng: lng,
  });
  if (validationError) return fail('Error al validar ubicación.');
  if (!validationData?.[0]?.is_allowed) {
    return fail(validationData?.[0]?.message ?? 'Ubicación fuera del área permitida.');
  }

  // 3e. Ventana horaria POR ALUMNO según su horario del día (student_schedules).
  // Solo aplica si el alumno tiene asignación en esta sede; si no, no se bloquea.
  const isoDow = nowIsoWeekday();
  const { data: assigns } = await admin
    .from('teacher_groups')
    .select('id')
    .eq('student_id', user.id)
    .eq('campus_id', campusId);

  if (assigns && assigns.length > 0) {
    const ids = (assigns as { id: string }[]).map((a) => a.id);
    const { data: slots } = await admin
      .from('student_schedules')
      .select('check_in_from, check_in_to')
      .in('assignment_id', ids)
      .eq('weekday', isoDow)
      .eq('is_active', true);

    if (!slots || slots.length === 0) {
      return fail('No tienes práctica programada hoy en esta sede.');
    }
    const cur = nowHourMinuteSV();
    const inWindow = (slots as { check_in_from: string | null; check_in_to: string | null }[]).some((s) => {
      const from = (s.check_in_from ?? '').slice(0, 5);
      const to = (s.check_in_to ?? '').slice(0, 5);
      return cur >= from && cur <= to;
    });
    if (!inWindow) {
      const s0 = slots[0] as { check_in_from: string | null; check_in_to: string | null };
      return fail(`Fuera de tu horario de hoy (${(s0.check_in_from ?? '').slice(0, 5)}–${(s0.check_in_to ?? '').slice(0, 5)}).`);
    }
  }

  // 4. Sin entrada activa
  const { data: activeRecords } = await admin
    .from('attendances')
    .select('id')
    .eq('student_id', user.id)
    .is('check_out', null);
  if (activeRecords && activeRecords.length > 0) {
    return fail('Ya tienes una entrada activa.');
  }

  // 5. Conflicto de dispositivo compartido (T-10.1 / T-10.2)
  if (device_fingerprint) {
    const { data: conflict } = await admin.rpc('detect_device_fingerprint_conflict', {
      p_device_fingerprint: device_fingerprint,
      p_campus_id: campusId,
      p_student_id: user.id,
    });
    if (conflict?.[0]) {
      await admin.from('audit_log').insert({
        action: 'SHARED_DEVICE_ACTIVE_CONFLICT',
        actor_user_id: user.id,
        target_user_id: conflict[0].student_id,
        details: {
          attempted_campus_id: campusId,
          active_campus_id: conflict[0].campus_id,
          active_attendance_id: conflict[0].attendance_id,
          device_fingerprint,
        },
      });
      return fail('Dispositivo ya activo en otra sede. El intento fue enviado a auditoría.');
    }
  }

  // 6. GPS falso: el análisis viene del cliente (analyzeFakeGpsPattern corrió en el dispositivo)
  const isFakeGps = device_info?.isFakeGps === true;
  const confidence = (device_info?.fakeGpsConfidence as number) ?? 0;
  const reasons = ((device_info?.fakeGpsAnalysis as Record<string, unknown>)?.reasons as string[]) ?? [];
  const fakeGpsReason = isFakeGps
    ? `Posible GPS falso detectado (${Math.round(confidence * 100)}%): ${reasons.join(' ')}`
    : undefined;

  if (isFakeGps) {
    await admin.from('audit_log').insert({
      action: 'FAKE_GPS_DETECTED',
      actor_user_id: user.id,
      details: { campus_id: campusId, confidence, lat, lng },
    });
  }

  // 3c. IP del dispositivo (señal forense, no bloqueo duro) enriquecida con IP Guide.
  const { ip: clientIp, info: ipInfo } = await resolveClientIp(req);

  // 7. Registrar check-in con hora del servidor (now() en PostgreSQL)
  const { data: attendance, error: insertError } = await admin
    .from('attendances')
    .insert({
      student_id: user.id,
      campus_id: campusId,
      check_in_location: { latitude: lat, longitude: lng, accuracyMeters: accuracy ?? null },
      check_in_ip: clientIp,
      check_in_ip_info: ipInfo,
      device_fingerprint: device_fingerprint ?? null,
      device_info: device_info ?? null,
      review_status: fakeGpsReason ? 'OBSERVADO' : 'PENDIENTE',
      suspicious_reason: fakeGpsReason ?? null,
      status: 'present',
    })
    .select('id')
    .single();

  if (insertError || !attendance) return fail('Error al registrar la asistencia.');

  return json({
    ok: true,
    message: 'Entrada registrada con hora oficial del servidor.',
    attendanceId: (attendance as Record<string, unknown>).id,
  });
});

// Hora actual en El Salvador como 'HH:MM' (para comparar contra el horario del alumno).
function nowHourMinuteSV(): string {
  const sv = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/El_Salvador' }));
  return `${String(sv.getHours()).padStart(2, '0')}:${String(sv.getMinutes()).padStart(2, '0')}`;
}

// Día de la semana ISO (1=lunes … 7=domingo) en hora El Salvador.
function nowIsoWeekday(): number {
  const sv = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/El_Salvador' }));
  return ((sv.getDay() + 6) % 7) + 1;
}

// IP del cliente (primer salto de x-forwarded-for) + datos vía IP Guide (gratis, sin key).
async function resolveClientIp(req: Request): Promise<{ ip: string | null; info: unknown }> {
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  const ip = fwd.split(',')[0].trim() || null;
  if (!ip) return { ip: null, info: null };
  try {
    const res = await fetch(`https://ip.guide/${ip}`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) return { ip, info: await res.json() };
  } catch { /* best effort: la IP se guarda igual aunque IP Guide falle */ }
  return { ip, info: null };
}
