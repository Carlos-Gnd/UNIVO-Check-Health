-- T-00.2: tabla teacher_groups (asignación docente ↔ estudiante ↔ sede/período)
-- Modela la relación "grupo del docente". Un docente supervisa N estudiantes por período.

CREATE TABLE IF NOT EXISTS public.teacher_groups (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_id uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  campus_id  uuid        REFERENCES public.campuses(id) ON DELETE SET NULL,
  period     text        NOT NULL DEFAULT '2026-1',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_groups_unique UNIQUE (teacher_id, student_id, period)
);

CREATE INDEX IF NOT EXISTS idx_teacher_groups_teacher ON public.teacher_groups (teacher_id, period);
CREATE INDEX IF NOT EXISTS idx_teacher_groups_student ON public.teacher_groups (student_id);

ALTER TABLE public.teacher_groups ENABLE ROW LEVEL SECURITY;

-- El docente ve solo su propio grupo
DROP POLICY IF EXISTS "teacher_reads_own_group" ON public.teacher_groups;
CREATE POLICY "teacher_reads_own_group" ON public.teacher_groups
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

-- El estudiante puede ver a qué docente está asignado
DROP POLICY IF EXISTS "student_reads_own_assignment" ON public.teacher_groups;
CREATE POLICY "student_reads_own_assignment" ON public.teacher_groups
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

-- Coordinadores/Admin gestionan todas las asignaciones (T-00.3 lo usa)
DROP POLICY IF EXISTS "coordinators_manage_groups" ON public.teacher_groups;
CREATE POLICY "coordinators_manage_groups" ON public.teacher_groups
  FOR ALL TO authenticated
  USING (upper(public.get_current_user_role()) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR'))
  WITH CHECK (upper(public.get_current_user_role()) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR'));

DROP POLICY IF EXISTS "service_role_teacher_groups" ON public.teacher_groups;
CREATE POLICY "service_role_teacher_groups" ON public.teacher_groups
  FOR ALL USING (auth.role() = 'service_role');
