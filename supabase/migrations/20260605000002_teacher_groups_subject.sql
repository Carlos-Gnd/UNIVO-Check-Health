-- S4-02.2 — teacher_groups gana subject_id (multi-sede / multi-materia)
-- Un alumno puede tener N asignaciones simultáneas: distintas materias y/o
-- distintas sedes en el mismo período. El UNIQUE viejo (teacher_id, student_id,
-- period) lo impedía (un alumno no podía tener dos materias con el mismo docente).
--
-- NOTA: el swap del UNIQUE y el NOT NULL se hacen en la migración de backfill
-- (20260605000003) DESPUÉS de poblar subject_id, para no romper filas existentes.
-- subject_id queda NULLABLE de momento: los flujos de inserción (validate-qr-checkin,
-- DeanAssignmentsPage) aún no envían materia hasta S4-02.3 / S4-02.4.

ALTER TABLE public.teacher_groups
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_groups_subject
  ON public.teacher_groups (subject_id, period);

-- Índice de apoyo para resolver la asignación por (alumno, sede) en el check-in (S4-02.3).
CREATE INDEX IF NOT EXISTS idx_teacher_groups_student_campus
  ON public.teacher_groups (student_id, campus_id, period);
