-- S4-02.3 - QR/check-in con alumno en varias sedes o materias.
-- Idempotente para convivir con las migraciones de modelo academico de Carlos.

CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  career text,
  required_hours integer NOT NULL DEFAULT 240,
  min_academic_level integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_groups
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;

ALTER TABLE public.attendances
  ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.teacher_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_groups_student_campus_subject
  ON public.teacher_groups(student_id, campus_id, subject_id, period);

CREATE INDEX IF NOT EXISTS idx_attendances_assignment
  ON public.attendances(assignment_id);

CREATE INDEX IF NOT EXISTS idx_attendances_subject
  ON public.attendances(subject_id);

INSERT INTO public.subjects (code, name, career, required_hours, min_academic_level)
SELECT DISTINCT
  upper(regexp_replace(coalesce(u.career, 'GENERAL'), '[^A-Za-z0-9]+', '_', 'g')) || '_PRACTICA',
  'Practica clinica - ' || coalesce(u.career, 'General'),
  u.career,
  240,
  1
FROM public.users u
WHERE upper(coalesce(u.role, '')) IN ('STUDENT', 'ESTUDIANTE', 'ALUMNO')
ON CONFLICT (code) DO NOTHING;

UPDATE public.teacher_groups tg
SET subject_id = s.id
FROM public.users u
JOIN public.subjects s
  ON coalesce(s.career, '') = coalesce(u.career, '')
WHERE tg.student_id = u.id
  AND tg.subject_id IS NULL;

UPDATE public.attendances a
SET assignment_id = tg.id,
    subject_id = tg.subject_id
FROM public.teacher_groups tg
WHERE a.assignment_id IS NULL
  AND a.student_id = tg.student_id
  AND a.campus_id = tg.campus_id
  AND (tg.start_date IS NULL OR a.date >= tg.start_date)
  AND (tg.end_date IS NULL OR a.date <= tg.end_date);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subjects_read_authenticated" ON public.subjects;
CREATE POLICY "subjects_read_authenticated" ON public.subjects
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "subjects_service_role_all" ON public.subjects;
CREATE POLICY "subjects_service_role_all" ON public.subjects
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
