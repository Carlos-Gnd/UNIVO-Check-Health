-- Fase 2 (apoyo) — El docente debe poder leer los datos básicos de los alumnos
-- de su grupo para que el calendario de rotaciones muestre sus nombres.
-- Hoy el RLS de users solo deja leer el propio perfil (o todos si ADMIN/COORDINATOR),
-- así que un DOCENTE no veía a sus alumnos.
--
-- No hay recursión: teacher_groups.teacher_id se compara con auth.uid() directo;
-- las políticas de teacher_groups que usan get_current_user_role() son
-- SECURITY DEFINER y no reentran a users por RLS.

DROP POLICY IF EXISTS "teacher_reads_group_members" ON public.users;
CREATE POLICY "teacher_reads_group_members" ON public.users
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_groups tg
      WHERE tg.teacher_id = auth.uid()
        AND tg.student_id = users.id
    )
  );
