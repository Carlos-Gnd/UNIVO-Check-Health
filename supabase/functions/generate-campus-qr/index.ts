import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as jose from 'https://esm.sh/jose@5';
import QRCode from 'npm:qrcode';
import { corsHeaders } from '../_shared/cors.ts';
import { deriveShortCode } from '../_shared/qr_utils.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Auth: coordinador autenticado O llamada interna con dispatch_webhook_secret
  const webhookSecret = Deno.env.get('DISPATCH_WEBHOOK_SECRET');
  const isInternalCall = webhookSecret && authHeader === `Bearer ${webhookSecret}`;

  if (!isInternalCall) {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    const role = (userData?.role ?? '').toUpperCase();
    if (!['ADMIN', 'COORDINATOR'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Solo coordinadores pueden generar QR.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const body = await req.json().catch(() => ({})) as { campus_id?: string };
  if (!body.campus_id) {
    return new Response(JSON.stringify({ error: 'campus_id requerido' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const qrSecret = Deno.env.get('QR_JWT_SECRET');
  if (!qrSecret) {
    return new Response(JSON.stringify({ error: 'QR_JWT_SECRET no configurado' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const nowSV = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/El_Salvador' }));
  const today = nowSV.toISOString().slice(0, 10);
  const expiry = new Date(`${today}T23:59:59-06:00`);

  // Servir desde caché si el token del día ya existe
  const { data: cached } = await admin
    .from('campus_daily_qr')
    .select('token, short_code')
    .eq('campus_id', body.campus_id)
    .eq('qr_date', today)
    .single();

  let token: string;
  let shortCode: string;

  if (cached?.token) {
    token = cached.token as string;
    shortCode = (cached.short_code as string) ?? await deriveShortCode(body.campus_id, today, qrSecret);
  } else {
    const secretKey = new TextEncoder().encode(qrSecret);
    token = await new jose.SignJWT({ campus_id: body.campus_id, date: today })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(expiry)
      .sign(secretKey);
    shortCode = await deriveShortCode(body.campus_id, today, qrSecret);

    await admin.from('campus_daily_qr').upsert(
      { campus_id: body.campus_id, qr_date: today, token, short_code: shortCode, created_at: new Date().toISOString() },
      { onConflict: 'campus_id,qr_date' },
    );
  }

  const qrDataUrl: string = await QRCode.toDataURL(token, { width: 280, margin: 2, errorCorrectionLevel: 'M' });

  return new Response(
    JSON.stringify({ token, short_code: shortCode, qr_data_url: qrDataUrl, date: today }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
