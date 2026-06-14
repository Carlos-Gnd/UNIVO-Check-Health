-- #7 — Portal del Representante: materias / prácticas programadas en su sede.
-- Complementa get_campus_active_students (estudiantes en vivo) con la vista
-- "qué se imparte en mi sede": materias, docente, nº de alumnos y días de horario.
-- Server-side (SECURITY DEFINER) y restringido a la sede del representante, igual
-- que el resto del portal (no se abre RLS de teacher_groups/subjects al rol).

CREATE OR REPLACE FUNCTION public.get_campus_subjects()
RETURNS TABLE(
  subject_id    uuid,
  subject_code  text,
  subject_name  text,
  career        text,
  teacher_name  text,
  student_count bigint,
  schedule_days text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role   text := upper(coalesce(public.get_current_user_role(), ''));
  v_campus uuid;
BEGIN
  IF v_role <> 'REPRESENTATIVE' THEN
    RAISE EXCEPTION 'Solo el representante hospitalario puede consultar esta vista.';
  END IF;

  SELECT u.campus_id INTO v_campus FROM public.users u WHERE u.id = auth.uid();
  IF v_campus IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    sub.id,
    coalesce(sub.code, ''),
    coalesce(sub.name, 'Práctica general'),
    sub.career,
    coalesce(t.full_name, 'Sin docente asignado'),
    count(DISTINCT tg.student_id),
    (
      SELECT string_agg(d.label, ', ' ORDER BY d.wd)
      FROM (
        SELECT DISTINCT ss.weekday AS wd,
          CASE ss.weekday
            WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar' WHEN 3 THEN 'Mié'
            WHEN 4 THEN 'Jue' WHEN 5 THEN 'Vie' WHEN 6 THEN 'Sáb'
            WHEN 7 THEN 'Dom'
          END AS label
        FROM public.student_schedules ss
        JOIN public.teacher_groups tg2 ON tg2.id = ss.assignment_id
        WHERE tg2.campus_id = v_campus
          AND tg2.subject_id IS NOT DISTINCT FROM sub.id
          AND tg2.teacher_id = tg.teacher_id
          AND ss.is_active
      ) d
    )
  FROM public.teacher_groups tg
  LEFT JOIN public.subjects sub ON sub.id = tg.subject_id
  LEFT JOIN public.users t      ON t.id = tg.teacher_id
  WHERE tg.campus_id = v_campus
  GROUP BY sub.id, sub.code, sub.name, sub.career, tg.teacher_id, t.full_name
  ORDER BY coalesce(sub.name, 'Práctica general');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_campus_subjects() TO authenticated;
