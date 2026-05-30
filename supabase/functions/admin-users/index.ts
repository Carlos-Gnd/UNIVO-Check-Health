// B-01: Operaciones administrativas de usuarios, server-side.
// Reemplaza el uso de service_role en el frontend (que se empaquetaba en el bundle).
// Solo accesible para usuarios con rol ADMIN. La service key vive aquí, nunca en el cliente.
// Supabase inyecta SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY automáticamente.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type Action = 'create' | 'update' | 'delete' | 'reset-password';

type Body = {
  action?: Action;
  // create
  email?: string;
  password?: string;
  student_code?: string;
  full_name?: string;
  role?: string;
  career?: string | null;
  // update / delete / reset
  id?: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'No autorizado' }, 401);

  // Cliente con el JWT del solicitante: identifica al usuario y respeta RLS
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: 'Sesión inválida' }, 401);

  // Verificar que el solicitante es ADMIN (lee su propia fila vía RLS)
  const { data: profile } = await userClient.from('users').select('role').eq('id', user.id).single();
  if ((profile?.role ?? '').toUpperCase() !== 'ADMIN') {
    return json({ error: 'Solo un administrador puede gestionar usuarios.' }, 403);
  }

  // Cliente con service_role para las operaciones privilegiadas (server-side)
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const body = await req.json().catch(() => ({})) as Body;

  switch (body.action) {
    case 'create': {
      if (!body.email || !body.password || !body.student_code) {
        return json({ error: 'Faltan datos requeridos.' }, 400);
      }

      const code = body.student_code.trim().toUpperCase();
      const email = body.email.trim().toLowerCase();
      const role = (body.role ?? 'STUDENT').toUpperCase();

      // Validaciones server-side (defensa en profundidad; el front también valida).
      const ALLOWED_ROLES = ['STUDENT', 'DOCENTE', 'COORDINATOR', 'ADMIN'];
      if (!ALLOWED_ROLES.includes(role)) {
        return json({ error: 'Rol no válido.' }, 400);
      }
      // student_code es varchar(9): un código más largo reventaría en BD.
      if (role === 'STUDENT' ? !/^U\d{8}$/.test(code) : !/^[A-Z0-9]{4,9}$/.test(code)) {
        return json({ error: role === 'STUDENT'
          ? 'Carné de estudiante inválido (debe ser U + 8 dígitos).'
          : 'Código inválido: 4 a 9 caracteres alfanuméricos.' }, 400);
      }
      if ((body.password ?? '').length < 8) {
        return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);
      }

      // Pre-chequeo de duplicados → mensaje claro y sin dejar usuario huérfano en Auth.
      const { data: dupes } = await admin
        .from('users')
        .select('student_code, email')
        .or(`student_code.eq.${code},email.eq.${email}`);
      if (dupes && dupes.length > 0) {
        const byCode = dupes.some((d) => (d.student_code ?? '').toUpperCase() === code);
        return json({ error: byCode
          ? `Ya existe un usuario con el carné/código ${code}.`
          : `Ya existe un usuario con el correo ${email}.` }, 409);
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: body.password,
        email_confirm: true,
      });
      if (createErr || !created.user) {
        const msg = (createErr?.message ?? '').toLowerCase().includes('already')
          ? `Ya existe un usuario con el correo ${email}.`
          : `Error al crear usuario: ${createErr?.message ?? 'desconocido'}`;
        return json({ error: msg }, createErr?.message?.toLowerCase().includes('already') ? 409 : 400);
      }

      const { error: profileErr } = await admin.from('users').insert({
        id:           created.user.id,
        student_code: code,
        full_name:    (body.full_name ?? '').trim(),
        email,
        role,
        career:       role === 'STUDENT' ? (body.career ?? null) : null,
      });
      if (profileErr) {
        // Rollback del usuario Auth para no dejar huérfanos
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: `Error al crear perfil: ${profileErr.message}` }, 400);
      }
      return json({ ok: true, id: created.user.id });
    }

    case 'update': {
      if (!body.id) return json({ error: 'id requerido' }, 400);
      const { error } = await admin.from('users').update({
        full_name: body.full_name ?? '',
        role:      body.role ?? 'STUDENT',
        career:    body.role === 'STUDENT' ? (body.career ?? null) : null,
      }).eq('id', body.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    case 'delete': {
      if (!body.id) return json({ error: 'id requerido' }, 400);
      const { error: authErr } = await admin.auth.admin.deleteUser(body.id);
      if (authErr) return json({ error: `Error al eliminar en Auth: ${authErr.message}` }, 400);
      await admin.from('users').delete().eq('id', body.id);
      return json({ ok: true });
    }

    case 'reset-password': {
      if (!body.email) return json({ error: 'email requerido' }, 400);
      const { data, error } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email: body.email,
      });
      if (error || !data?.properties?.action_link) {
        return json({ error: 'No se pudo generar el link de restablecimiento.' }, 400);
      }
      return json({ ok: true, action_link: data.properties.action_link });
    }

    default:
      return json({ error: 'Acción no soportada.' }, 400);
  }
});
