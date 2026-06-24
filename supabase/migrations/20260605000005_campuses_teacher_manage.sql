-- S4-04.3 — El docente puede crear (y gestionar) sedes
-- Amplía la política de escritura de campuses para incluir DOCENTE/TEACHER, además
-- de ADMIN/COORDINATOR. Las sedes nacen ACTIVAS (campuses.is_active DEFAULT true),
-- sin flujo de aprobación: decisión del PO. La trazabilidad la cubre audit_log (S4-04.4).
-- Mantiene el patrón EXISTS sobre users de 20260529000005 (sin recursión: campuses≠users).

DROP POLICY IF EXISTS "campuses_write_admins" ON public.campuses;

CREATE POLICY "campuses_write_admins" ON public.campuses
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND upper(u.role) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND upper(u.role) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE')
    )
  );
