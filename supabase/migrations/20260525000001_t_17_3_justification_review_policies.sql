-- T-17.3: permisos para que docente/coordinador revise justificaciones pendientes.

DROP POLICY IF EXISTS "reviewers_select_justifications" ON public.justifications;
CREATE POLICY "reviewers_select_justifications"
ON public.justifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND upper(u.role) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE')
  )
);

DROP POLICY IF EXISTS "reviewers_update_justifications" ON public.justifications;
CREATE POLICY "reviewers_update_justifications"
ON public.justifications
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND upper(u.role) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE')
  )
)
WITH CHECK (
  status IN ('PENDIENTE', 'APROBADO', 'RECHAZADO')
  AND EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND upper(u.role) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE')
  )
);
