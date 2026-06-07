// T-27.2: firma digital del reporte consolidado del docente.
// Recibe el hash SHA-256 del PDF (calculado en el cliente, T-27.1 de René),
// genera un sello firmado (HMAC-SHA256 con secreto server-side) y lo registra
// de forma inmutable en audit_log. Solo DOCENTE/ADMIN/COORDINATOR.
// Nota: firma X.509 real queda para Sprint 4 (Tier 2 del roadmap).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  SYSTEM_REPORT_SIGNER_ID,
  SYSTEM_REPORT_SIGNER_NAME,
  buildReportSignaturePayload,
  hmacSeal,
} from '../_shared/reportSeal.ts';

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

  const { data: profile } = await userClient.from('users').select('role, full_name').eq('id', user.id).single();
  const role = (profile?.role ?? '').toUpperCase();
  if (!['ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE'].includes(role)) {
    return json({ error: 'No autorizado para firmar reportes.' }, 403);
  }

  const { report_hash, period, group_label } = await req.json().catch(() => ({})) as
    { report_hash?: string; period?: string; group_label?: string };
  if (!report_hash) return json({ error: 'report_hash requerido' }, 400);

  const secret = Deno.env.get('QR_JWT_SECRET'); // reutiliza el secreto server-side
  if (!secret) return json({ error: 'Servidor mal configurado' }, 500);

  const signedAt = new Date().toISOString();
  const teacherPayload = buildReportSignaturePayload({
    reportHash: report_hash,
    role: 'teacher',
    signerId: user.id,
    signedAt,
  });
  const systemPayload = buildReportSignaturePayload({
    reportHash: report_hash,
    role: 'system',
    signerId: SYSTEM_REPORT_SIGNER_ID,
    signedAt,
  });
  const teacherSeal = await hmacSeal(teacherPayload, secret);
  const systemSeal = await hmacSeal(systemPayload, secret);
  const signedBy = profile?.full_name ?? user.email;

  // Registro inmutable en audit_log (con service_role para garantizar el insert)
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  await admin.from('audit_log').insert({
    action: 'REPORT_SIGNED',
    actor_user_id: user.id,
    details: {
      report_hash, period: period ?? null, group_label: group_label ?? null,
      signed_by: signedBy,
      signed_at: signedAt,
      seal: teacherSeal,
      teacher_seal: teacherSeal,
      system_seal: systemSeal,
      signatures: {
        teacher: {
          role: 'teacher',
          signer_id: user.id,
          signed_by: signedBy,
          signed_at: signedAt,
          seal: teacherSeal,
        },
        system: {
          role: 'system',
          signer_id: SYSTEM_REPORT_SIGNER_ID,
          signed_by: SYSTEM_REPORT_SIGNER_NAME,
          signed_at: signedAt,
          seal: systemSeal,
        },
      },
    },
  });

  return json({
    ok: true,
    seal: teacherSeal,
    teacher_seal: teacherSeal,
    system_seal: systemSeal,
    signed_at: signedAt,
    signed_by: signedBy,
    system_signed_by: SYSTEM_REPORT_SIGNER_NAME,
  });
});
