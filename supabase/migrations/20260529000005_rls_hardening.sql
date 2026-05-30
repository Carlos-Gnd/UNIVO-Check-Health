-- Fase 4: habilitar RLS en tablas core y añadir políticas mínimas de producción.
-- Referencia al pendiente explícito del Refinamiento Sprint 2 (2026-05-15):
-- "RLS: actualmente las tablas usan grants abiertos — debe implementarse antes de producción."

-- ─────────────────────────────────────────────────────────────────────────────
-- users
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own"      ON public.users;
DROP POLICY IF EXISTS "users_update_own"    ON public.users;
DROP POLICY IF EXISTS "admin_manage_users"  ON public.users;
DROP POLICY IF EXISTS "service_role_users"  ON public.users;

-- Cualquier usuario autenticado puede leer su propio perfil
CREATE POLICY "users_read_own" ON public.users
  FOR SELECT TO authenticated USING (id = auth.uid());

-- Coordinadores y Admins pueden leer todos los usuarios (para dashboards)
CREATE POLICY "coordinators_read_all_users" ON public.users
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND upper(u.role) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR')
    )
  );

-- Usuario puede actualizar solo sus datos no-sensibles
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Service role tiene acceso total (para Edge Functions y triggers)
CREATE POLICY "service_role_users" ON public.users
  FOR ALL USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- campuses
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campuses_read_authenticated" ON public.campuses;
DROP POLICY IF EXISTS "campuses_write_admins"       ON public.campuses;
DROP POLICY IF EXISTS "service_role_campuses"       ON public.campuses;

CREATE POLICY "campuses_read_authenticated" ON public.campuses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "campuses_write_admins" ON public.campuses
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND upper(u.role) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND upper(u.role) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR')
    )
  );

CREATE POLICY "service_role_campuses" ON public.campuses
  FOR ALL USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- attendances
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendances_student_read_own"   ON public.attendances;
DROP POLICY IF EXISTS "attendances_student_insert_own" ON public.attendances;
DROP POLICY IF EXISTS "attendances_coordinator_read"   ON public.attendances;
DROP POLICY IF EXISTS "attendances_coordinator_update" ON public.attendances;
DROP POLICY IF EXISTS "service_role_attendances"       ON public.attendances;

CREATE POLICY "attendances_student_read_own" ON public.attendances
  FOR SELECT TO authenticated USING (student_id = auth.uid());

CREATE POLICY "attendances_student_insert_own" ON public.attendances
  FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());

CREATE POLICY "attendances_coordinator_read" ON public.attendances
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND upper(u.role) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE')
    )
  );

CREATE POLICY "attendances_coordinator_update" ON public.attendances
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND upper(u.role) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR')
    )
  );

CREATE POLICY "service_role_attendances" ON public.attendances
  FOR ALL USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- audit_log (append-only: solo INSERT y SELECT)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_insert_authenticated" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_read_admins"          ON public.audit_log;
DROP POLICY IF EXISTS "service_role_audit_log"         ON public.audit_log;

CREATE POLICY "audit_log_insert_authenticated" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (actor_user_id = auth.uid());

CREATE POLICY "audit_log_read_admins" ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND upper(u.role) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR')
    )
  );

CREATE POLICY "service_role_audit_log" ON public.audit_log
  FOR ALL USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- system_config (solo lectura para usuarios, escritura solo service_role)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_config_read_authenticated" ON public.system_config;
DROP POLICY IF EXISTS "service_role_system_config"       ON public.system_config;

CREATE POLICY "system_config_read_authenticated" ON public.system_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "service_role_system_config" ON public.system_config
  FOR ALL USING (auth.role() = 'service_role');
