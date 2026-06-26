-- Fix: el frontend normaliza ADMINISTRADOR/DECANO como Decano, pero las
-- policies de justifications todavia comparaban el texto crudo de users.role
-- (que no incluia ADMINISTRADOR/DECANO). Usar get_current_user_role() resuelve
-- ese caso porque normaliza ADMINISTRADOR/DECANO -> ADMIN. Esa funcion NO
-- normaliza COORDINADOR/DOCENTE (solo ADMIN), asi que se mantienen ambas
-- variantes para no romper a coordinadores/docentes, igual que el resto de
-- policies del proyecto (teacher_groups, subjects, careers, holidays, etc).

DROP POLICY IF EXISTS "reviewers_select_justifications" ON public.justifications;
CREATE POLICY "reviewers_select_justifications"
ON public.justifications
FOR SELECT
USING (
  public.get_current_user_role() IN ('ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE')
);

DROP POLICY IF EXISTS "reviewers_update_justifications" ON public.justifications;
CREATE POLICY "reviewers_update_justifications"
ON public.justifications
FOR UPDATE
USING (
  public.get_current_user_role() IN ('ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE')
)
WITH CHECK (
  status IN ('PENDIENTE', 'APROBADO', 'RECHAZADO')
  AND public.get_current_user_role() IN ('ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE')
);
