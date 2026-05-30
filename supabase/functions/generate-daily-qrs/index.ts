import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as jose from 'https://esm.sh/jose@5';
import { corsHeaders } from '../_shared/cors.ts';
import { deriveShortCode } from '../_shared/qr_utils.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization') ?? '';
  const webhookSecret = Deno.env.get('DISPATCH_WEBHOOK_SECRET');
  if (!webhookSecret || authHeader !== `Bearer ${webhookSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const qrSecret = Deno.env.get('QR_JWT_SECRET');
  if (!qrSecret) {
    return new Response(JSON.stringify({ error: 'QR_JWT_SECRET no configurado' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const nowSV = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/El_Salvador' }));
  const today = nowSV.toISOString().slice(0, 10);
  const expiry = new Date(`${today}T23:59:59-06:00`);
  const secretKey = new TextEncoder().encode(qrSecret);

  const { data: campuses, error } = await admin
    .from('campuses').select('id').eq('is_active', true);

  if (error || !campuses) {
    return new Response(JSON.stringify({ error: 'Error al obtener sedes' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let generated = 0;
  for (const campus of campuses) {
    const token = await new jose.SignJWT({ campus_id: campus.id, date: today })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(expiry)
      .sign(secretKey);
    const shortCode = await deriveShortCode(campus.id, today, qrSecret);

    await admin.from('campus_daily_qr').upsert(
      { campus_id: campus.id, qr_date: today, token, short_code: shortCode, created_at: new Date().toISOString() },
      { onConflict: 'campus_id,qr_date' },
    );
    generated++;
  }

  return new Response(
    JSON.stringify({ ok: true, date: today, generated }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
