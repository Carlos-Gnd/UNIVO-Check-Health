// T-50.1: envía por email las credenciales de un usuario recién creado (Resend).
// Solo ADMIN. Lo invoca UserManagement tras crear el usuario (T-50.2, integración de René).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const FROM_EMAIL = 'UNIVO Check-Health <noreply@univo.edu.sv>';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'No autorizado' }, 401);

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Sesión inválida' }, 401);

  const { data: profile } = await userClient.from('users').select('role').eq('id', user.id).single();
  if ((profile?.role ?? '').toUpperCase() !== 'ADMIN') {
    return json({ error: 'Solo un administrador puede enviar credenciales.' }, 403);
  }

  const { email, password, full_name } = await req.json().catch(() => ({})) as
    { email?: string; password?: string; full_name?: string };
  if (!email || !password) return json({ error: 'email y password requeridos' }, 400);

  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return json({ error: 'RESEND_API_KEY no configurado' }, 500);

  const html = `
    <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
      body{font-family:-apple-system,sans-serif;background:#f5f5f5;margin:0;padding:24px}
      .card{background:#fff;border-radius:12px;padding:32px;max-width:540px;margin:0 auto}
      h2{color:#1e3a5f;margin-top:0}.cred{background:#f0f6ff;border:1px solid #cfe0fb;border-radius:8px;padding:16px;margin:16px 0}
      .cred code{font-size:15px;color:#1e3a5f;font-weight:700}.foot{font-size:12px;color:#9ca3af;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:16px}
    </style></head><body><div class="card">
      <h2>Bienvenido/a a UNIVO Check-Health</h2>
      <p>Hola ${full_name ?? ''}, se ha creado tu cuenta institucional. Estas son tus credenciales de acceso:</p>
      <div class="cred">
        <p>Correo: <code>${email}</code></p>
        <p>Contraseña temporal: <code>${password}</code></p>
      </div>
      <p>Ingresa al sistema y, por seguridad, cambia tu contraseña desde tu perfil.</p>
      <div class="foot">UNIVO Check-Health — Sistema de Registro y Control de Asistencias</div>
    </div></body></html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [email], subject: 'Tus credenciales de acceso — UNIVO Check-Health', html }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return json({ error: 'No se pudo enviar el correo', detail }, 502);
  }
  return json({ ok: true });
});
