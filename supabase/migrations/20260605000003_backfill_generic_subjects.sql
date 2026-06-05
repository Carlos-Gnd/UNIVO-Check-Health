-- S4-02.5 — Backfill: materia genérica por carrera + swap del UNIQUE
-- Crea una materia "Práctica clínica" por cada carrera presente en las
-- asignaciones existentes y cuelga de ella las asignaciones del Sprint 3 que aún
-- no tienen materia, para no romper datos. Luego intercambia el UNIQUE.

-- 1. Una materia genérica por carrera referenciada en teacher_groups (vía el alumno).
INSERT INTO public.subjects (code, name, career, required_hours)
SELECT DISTINCT
  'GEN-' || upper(substr(md5(coalesce(u.career, 'GENERAL')), 1, 6)) AS code,
  'Práctica clínica — ' || coalesce(u.career, 'General')            AS name,
  u.career,
  240
FROM public.teacher_groups tg
JOIN public.users u ON u.id = tg.student_id
ON CONFLICT (code) DO NOTHING;

-- 2. Asigna subject_id a las asignaciones que aún no lo tienen, emparejando por carrera.
UPDATE public.teacher_groups tg
SET subject_id = s.id
FROM public.users u
JOIN public.subjects s
  ON s.code = 'GEN-' || upper(substr(md5(coalesce(u.career, 'GENERAL')), 1, 6))
WHERE tg.student_id = u.id
  AND tg.subject_id IS NULL;

-- 3. Swap del UNIQUE: de (teacher_id, student_id, period) a
--    (student_id, subject_id, campus_id, period) → habilita multi-materia/multi-sede.
ALTER TABLE public.teacher_groups DROP CONSTRAINT IF EXISTS teacher_groups_unique;
ALTER TABLE public.teacher_groups
  ADD CONSTRAINT teacher_groups_unique UNIQUE (student_id, subject_id, campus_id, period);

-- subject_id se deja NULLABLE a propósito (ver 20260605000002). Cuando S4-02.3 y
-- S4-02.4 envíen siempre la materia, Carlos puede endurecer con:
--   ALTER TABLE public.teacher_groups ALTER COLUMN subject_id SET NOT NULL;
