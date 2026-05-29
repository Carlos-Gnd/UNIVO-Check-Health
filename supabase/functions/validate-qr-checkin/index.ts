// T-08.3: Verifica JWT firmado del QR + geofence + ventana horaria + anti-fraude y registra check-in.
// El INSERT usa service_role para bypass de RLS; la identidad del alumno viene del auth token.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as jose from 'https://esm.sh/jose@5';
import { corsHeaders } from '../_shared/cors.ts';

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Sesión no encontrada. Vuelve a iniciar sesión.' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Cliente con auth del alumno (para identificarlo y para llamadas RPC que respetan RLS)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  // Cliente service_role para writes (INSERT attendances, audit_log)
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Sesión no encontrada. Vuelve a iniciar sesión.' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const body = await req.json().catch(() => ({})) as RequestBody;
  const { qr_token, short_code, campus_id: bodyCAmpusId, lat, lng, accuracy, device_fingerprint, device_info } = body;

  if (lat == null || lng == null) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Faltan parámetros requeridos (lat, lng).' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
  if (!qr_token && (!short_code || !bodyCAmpusId)) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Proporciona qr_token o (short_code + campus_id).' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const qrSecret = Deno.env.get('QR_JWT_SECRET');
  if (!qrSecret) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Servidor mal configurado.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const nowSV = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/El_Salvador' }));
  const todaySV = nowSV.toISOString().slice(0, 10);

  let qrPayload: { campus_id: string; date: string };

  if (short_code && bodyCAmpusId) {
    // ── Ruta alternativa: validar código corto (fallback sin cámara) ──────────
    const { data: cached } = await admin
      .from('campus_daily_qr')
      .select('token, short_code')
      .eq('campus_id', bodyCAmpusId)
      .eq('qr_date', todaySV)
      .eq('short_code', short_code.toUpperCase())
      .single();

    if (!cached?.token) {
      return new Response(
        JSON.stringify({ ok: false, message: 'Código incorrecto o expirado. Solicita uno nuevo al encargado.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    // Extraer el payload del token cacheado (ya fue verificado al crearlo)
    const secretKey = new TextEncoder().encode(qrSecret);
    try {
      const { payload } = await jose.jwtVerify(cached.token as string, secretKey, { algorithms: ['HS256'] });
      qrPayload = payload as { campus_id: string; date: string };
    } catch {
      return new Response(
        JSON.stringify({ ok: false, message: 'Código expirado. Solicita uno nuevo al encargado.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  } else {
    // ── Ruta principal: verificar JWT del QR escaneado ────────────────────────
    try {
      const secretKey = new TextEncoder().encode(qrSecret);
      const { payload } = await jose.jwtVerify(qr_token!, secretKey, { algorithms: ['HS256'] });
      qrPayload = payload as { campus_id: string; date: string };
    } catch {
      return new Response(
        JSON.stringify({ ok: false, message: 'QR inválido o expirado.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (qrPayload.date !== todaySV) {
      return new Response(
        JSON.stringify({ ok: false, message: `QR corresponde a ${qrPayload.date}, no a hoy.` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  }

  // 3. Validar geofence + ventana horaria
  const { data: validationData, error: validationError } = await supabase.rpc('validate_checkin_area', {
    p_campus_id: qrPayload.campus_id,
    p_current_lat: lat,
    p_current_lng: lng,
  });

  if (validationError) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Error al validar ubicación.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
  if (!validationData?.[0]?.is_allowed) {
    return new Response(
      JSON.stringify({ ok: false, message: validationData?.[0]?.message ?? 'Ubicación fuera del área permitida.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // 4. Sin entrada activa
  const { data: activeRecords } = await admin
    .from('attendances')
    .select('id')
    .eq('student_id', user.id)
    .is('check_out', null);

  if (activeRecords && activeRecords.length > 0) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Ya tienes una entrada activa.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // 5. Conflicto de dispositivo compartido (T-10.1 / T-10.2)
  if (device_fingerprint) {
    const { data: conflict } = await admin.rpc('detect_device_fingerprint_conflict', {
      p_device_fingerprint: device_fingerprint,
      p_campus_id: qrPayload.campus_id,
      p_student_id: user.id,
    });

    if (conflict?.[0]) {
      await admin.from('audit_log').insert({
        action: 'SHARED_DEVICE_ACTIVE_CONFLICT',
        actor_user_id: user.id,
        target_user_id: conflict[0].student_id,
        details: {
          attempted_campus_id: qrPayload.campus_id,
          active_campus_id: conflict[0].campus_id,
          active_attendance_id: conflict[0].attendance_id,
          device_fingerprint,
        },
      });
      return new Response(
        JSON.stringify({ ok: false, message: 'Dispositivo ya activo en otra sede. El intento fue enviado a auditoría.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
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
      details: { campus_id: qrPayload.campus_id, confidence, lat, lng },
    });
  }

  // 7. Registrar check-in con hora del servidor (now() en PostgreSQL)
  const { data: attendance, error: insertError } = await admin
    .from('attendances')
    .insert({
      student_id: user.id,
      campus_id: qrPayload.campus_id,
      check_in_location: { latitude: lat, longitude: lng, accuracyMeters: accuracy ?? null },
      device_fingerprint: device_fingerprint ?? null,
      device_info: device_info ?? null,
      review_status: fakeGpsReason ? 'OBSERVADO' : 'PENDIENTE',
      suspicious_reason: fakeGpsReason ?? null,
      status: 'present',
    })
    .select('id')
    .single();

  if (insertError || !attendance) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Error al registrar la asistencia.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      message: 'Entrada registrada con hora oficial del servidor.',
      attendanceId: (attendance as Record<string, unknown>).id,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
