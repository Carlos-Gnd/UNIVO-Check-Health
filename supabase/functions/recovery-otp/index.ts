import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { sendMail, wrapHtml, type MailResult } from '../_shared/mailer.ts';

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 3;
const MAX_REQUESTS_PER_WINDOW = 3;

type RequestBody =
  | { action?: 'request'; email?: string; answer?: string }
  | { action?: 'verify'; email?: string; code?: string };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeEmail(email: string | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

function makeOtp(): string {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
}

function makeSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(input: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sendOtpEmail(to: string, code: string): Promise<MailResult> {
  const html = wrapHtml(`
    <h2>Codigo de recuperacion</h2>
    <p>Usa este codigo para continuar con la recuperacion de acceso. Expira en ${OTP_TTL_MINUTES} minutos.</p>
    <p class="code">${code}</p>
    <p>Si no solicitaste este codigo, puedes ignorar este correo.</p>`);

  return await sendMail({ to, subject: 'Codigo de recuperacion - UNIVO Check-Health', html });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Metodo no permitido' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const body = await req.json().catch(() => ({})) as RequestBody;
  const email = normalizeEmail(body.email);
  if (!email.endsWith('@univo.edu.sv')) return json({ error: 'Correo institucional invalido.' }, 400);

  if (body.action === 'request') {
    const answer = (body.answer ?? '').trim();
    if (answer.length < 2) return json({ error: 'Respuesta de seguridad requerida.' }, 400);

    const { data: okAnswer, error: answerError } = await admin.rpc('verify_security_answer', {
      p_email: email,
      p_answer: answer,
    });
    if (answerError || okAnswer !== true) return json({ error: 'No se pudo verificar la identidad.' }, 400);

    const { data: user, error: userError } = await admin
      .from('users')
      .select('id, backup_email')
      .eq('email', email)
      .single();
    if (userError || !user?.backup_email) return json({ error: 'No hay correo de respaldo configurado.' }, 400);

    const since = new Date(Date.now() - OTP_TTL_MINUTES * 60_000).toISOString();
    const { count } = await admin
      .from('recovery_otps')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .gte('created_at', since);
    if ((count ?? 0) >= MAX_REQUESTS_PER_WINDOW) {
      return json({ error: 'Demasiados codigos solicitados. Intenta de nuevo en 10 minutos.' }, 429);
    }

    const code = makeOtp();
    const salt = makeSalt();
    const otpHash = await sha256(`${code}:${salt}`);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();

    await admin
      .from('recovery_otps')
      .update({ consumed_at: new Date().toISOString() })
      .eq('email', email)
      .is('consumed_at', null);

    const { data: inserted, error: insertError } = await admin.from('recovery_otps').insert({
      user_id: user.id,
      email,
      backup_email: user.backup_email,
      otp_hash: otpHash,
      otp_salt: salt,
      expires_at: expiresAt,
    }).select('id').single();
    if (insertError || !inserted) return json({ error: 'No se pudo generar el codigo.' }, 400);

    // Si el correo no se envía, invalidamos el OTP recién creado y reportamos el
    // fallo de forma explícita (antes se respondía "enviado" aunque fallara).
    const mail = await sendOtpEmail(user.backup_email, code);
    if (!mail.ok) {
      await admin.from('recovery_otps').update({ consumed_at: new Date().toISOString() }).eq('id', inserted.id);
      const status = mail.error === 'missing_gmail_credentials' ? 500 : 502;
      return json({ error: 'No se pudo enviar el codigo al correo de respaldo. Intenta mas tarde.', detail: mail.error }, status);
    }
    return json({ ok: true, message: 'Codigo enviado al correo de respaldo.' });
  }

  if (body.action === 'verify') {
    const code = (body.code ?? '').trim();
    if (!/^\d{6}$/.test(code)) return json({ error: 'Codigo invalido.' }, 400);

    const { data: otp, error } = await admin
      .from('recovery_otps')
      .select('id, otp_hash, otp_salt, attempts, expires_at')
      .eq('email', email)
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !otp) return json({ error: 'No hay codigo activo.' }, 400);
    if (new Date(otp.expires_at).getTime() < Date.now()) {
      await admin.from('recovery_otps').update({ consumed_at: new Date().toISOString() }).eq('id', otp.id);
      return json({ error: 'El codigo expiro. Solicita uno nuevo.' }, 400);
    }
    if (otp.attempts >= MAX_ATTEMPTS) return json({ error: 'Maximo de intentos alcanzado.' }, 429);

    const candidateHash = await sha256(`${code}:${otp.otp_salt}`);
    if (candidateHash !== otp.otp_hash) {
      const nextAttempts = Math.min(MAX_ATTEMPTS, otp.attempts + 1);
      await admin.from('recovery_otps').update({ attempts: nextAttempts }).eq('id', otp.id);
      return json({ error: `Codigo incorrecto. Intentos restantes: ${MAX_ATTEMPTS - nextAttempts}.` }, 400);
    }

    await admin.from('recovery_otps').update({ consumed_at: new Date().toISOString() }).eq('id', otp.id);
    return json({ ok: true, message: 'Codigo verificado correctamente.' });
  }

  return json({ error: 'Accion no soportada.' }, 400);
});
