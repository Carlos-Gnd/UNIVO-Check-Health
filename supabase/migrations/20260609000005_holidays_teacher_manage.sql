-- B25: el docente también puede gestionar los días no hábiles de sus prácticas
-- (antes solo ADMIN/COORDINATOR). Reescribe la policy de gestión para incluir
-- TEACHER/DOCENTE manteniendo la lectura abierta a cualquier autenticado.

DROP POLICY IF EXISTS "coordinators_manage_holidays" ON public.holidays;
CREATE POLICY "coordinators_manage_holidays" ON public.holidays
  FOR ALL TO authenticated
  USING (upper(public.get_current_user_role()) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE'))
  WITH CHECK (upper(public.get_current_user_role()) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE'));
