-- Fix: permitir que cuentas de decano guardadas como ADMINISTRADOR/DECANO
-- resuelvan solicitudes de acceso, y mantener a docentes habilitados para
-- resolver solicitudes de alumnos. Usa get_current_user_role(), que normaliza
-- sinonimos de ADMIN a ADMIN.

DROP POLICY IF EXISTS "staff_read_access_requests" ON public.access_requests;
CREATE POLICY "staff_read_access_requests" ON public.access_requests
  FOR SELECT TO authenticated
  USING (
    upper(public.get_current_user_role()) IN (
      'ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE'
    )
  );

DROP POLICY IF EXISTS "staff_update_access_requests" ON public.access_requests;
CREATE POLICY "staff_update_access_requests" ON public.access_requests
  FOR UPDATE TO authenticated
  USING (
    upper(public.get_current_user_role()) IN (
      'ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE'
    )
  )
  WITH CHECK (
    upper(public.get_current_user_role()) IN (
      'ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE'
    )
  );
