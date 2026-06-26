-- A-01: Reemplazar auth.role() = 'service_role' (deprecated en Supabase) por
-- TO service_role USING (true) en todas las políticas RLS del sistema.
-- auth.role() es deprecated porque no distingue correctamente a usuarios anónimos
-- cuando el modo anonymous sign-in está habilitado.
-- El patrón correcto es especificar el rol en la cláusula TO de la política.

-- ── public.users ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_users" ON public.users;
CREATE POLICY "service_role_users" ON public.users
  FOR ALL TO service_role USING (true);

-- ── public.campuses ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_campuses" ON public.campuses;
CREATE POLICY "service_role_campuses" ON public.campuses
  FOR ALL TO service_role USING (true);

-- ── public.attendances ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_attendances" ON public.attendances;
CREATE POLICY "service_role_attendances" ON public.attendances
  FOR ALL TO service_role USING (true);

-- ── public.audit_log ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_audit_log" ON public.audit_log;
CREATE POLICY "service_role_audit_log" ON public.audit_log
  FOR ALL TO service_role USING (true);

-- ── public.system_config ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_system_config" ON public.system_config;
CREATE POLICY "service_role_system_config" ON public.system_config
  FOR ALL TO service_role USING (true);

-- ── public.notification_outbox ────────────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_outbox" ON public.notification_outbox;
CREATE POLICY "service_role_outbox" ON public.notification_outbox
  FOR ALL TO service_role USING (true);

-- ── public.campus_daily_qr (tabla de QR diario, obsoleta pero aún existente) ─
DROP POLICY IF EXISTS "service_role_campus_qr" ON public.campus_daily_qr;
CREATE POLICY "service_role_campus_qr" ON public.campus_daily_qr
  FOR ALL TO service_role USING (true);

-- ── public.teacher_groups ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_teacher_groups" ON public.teacher_groups;
CREATE POLICY "service_role_teacher_groups" ON public.teacher_groups
  FOR ALL TO service_role USING (true);

-- ── public.weekly_evaluations ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_evals" ON public.weekly_evaluations;
CREATE POLICY "service_role_evals" ON public.weekly_evaluations
  FOR ALL TO service_role USING (true);

-- ── public.student_schedules ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_student_schedules" ON public.student_schedules;
CREATE POLICY "service_role_student_schedules" ON public.student_schedules
  FOR ALL TO service_role USING (true);

-- ── public.campus_qr (QR estático) ───────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_campus_qr_static" ON public.campus_qr;
CREATE POLICY "service_role_campus_qr_static" ON public.campus_qr
  FOR ALL TO service_role USING (true);

-- ── public.recovery_otps ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_recovery_otps" ON public.recovery_otps;
CREATE POLICY "service_role_recovery_otps" ON public.recovery_otps
  FOR ALL TO service_role USING (true);

-- ── public.subjects (dos políticas con el mismo propósito, consolidar en una) ─
DROP POLICY IF EXISTS "service_role_subjects"     ON public.subjects;
DROP POLICY IF EXISTS "subjects_service_role_all" ON public.subjects;
CREATE POLICY "service_role_subjects" ON public.subjects
  FOR ALL TO service_role USING (true);

-- ── public.subject_prerequisites ─────────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_prereqs" ON public.subject_prerequisites;
CREATE POLICY "service_role_prereqs" ON public.subject_prerequisites
  FOR ALL TO service_role USING (true);

-- ── public.rate_limits ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_rate_limits" ON public.rate_limits;
CREATE POLICY "service_role_rate_limits" ON public.rate_limits
  FOR ALL TO service_role USING (true);

-- ── public.user_sessions ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_sessions_service_role_all" ON public.user_sessions;
CREATE POLICY "user_sessions_service_role_all" ON public.user_sessions
  FOR ALL TO service_role USING (true);

-- ── public.assignment_gate_overrides ─────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_overrides" ON public.assignment_gate_overrides;
CREATE POLICY "service_role_overrides" ON public.assignment_gate_overrides
  FOR ALL TO service_role USING (true);

-- ── public.holidays ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_holidays" ON public.holidays;
CREATE POLICY "service_role_holidays" ON public.holidays
  FOR ALL TO service_role USING (true);

-- ── public.careers ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_careers" ON public.careers;
CREATE POLICY "service_role_careers" ON public.careers
  FOR ALL TO service_role USING (true);

-- ── public.justifications ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_all" ON public.justifications;
CREATE POLICY "service_role_all" ON public.justifications
  FOR ALL TO service_role USING (true);

-- ── public.push_tokens ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_read_tokens" ON public.push_tokens;
CREATE POLICY "service_role_read_tokens" ON public.push_tokens
  FOR ALL TO service_role USING (true);
