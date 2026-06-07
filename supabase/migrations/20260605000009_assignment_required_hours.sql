-- Horas de práctica editables por asignación
-- No todos los alumnos cumplen las mismas horas por ciclo. El docente/coordinador
-- que asigna puede fijar las horas de ESA asignación (teacher_groups.required_hours).
-- NULL = usar las de la materia (subjects.required_hours), y si tampoco, 240.

ALTER TABLE public.teacher_groups
  ADD COLUMN IF NOT EXISTS required_hours numeric(6,2);

ALTER TABLE public.teacher_groups
  DROP CONSTRAINT IF EXISTS teacher_groups_required_hours_check;
ALTER TABLE public.teacher_groups
  ADD CONSTRAINT teacher_groups_required_hours_check
  CHECK (required_hours IS NULL OR required_hours > 0);

-- Redefinición de close_due_cycles (T-34.1) con la nueva precedencia de horas:
--   asignación (teacher_groups.required_hours) → materia (subjects.required_hours) → 240.
CREATE OR REPLACE FUNCTION public.close_due_cycles()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today    date := (now() AT TIME ZONE 'America/El_Salvador')::date;
  v_row      record;
  v_hours    numeric;
  v_required numeric;
  v_status   text;
  v_count    integer := 0;
BEGIN
  FOR v_row IN
    SELECT id, student_id, campus_id, subject_id, start_date, end_date, required_hours
    FROM public.teacher_groups
    WHERE end_date IS NOT NULL
      AND end_date < v_today
      AND closed_at IS NULL
  LOOP
    SELECT COALESCE(SUM(a.worked_hours), 0) INTO v_hours
    FROM public.attendances a
    WHERE a.student_id = v_row.student_id
      AND a.campus_id  = v_row.campus_id
      AND a.check_out IS NOT NULL
      AND upper(COALESCE(a.review_status, '')) <> 'OBSERVADO'
      AND (v_row.start_date IS NULL OR a.check_in::date >= v_row.start_date)
      AND a.check_in::date <= v_row.end_date;

    -- Precedencia: horas de la asignación → de la materia → 240.
    IF v_row.required_hours IS NOT NULL THEN
      v_required := v_row.required_hours;
    ELSE
      SELECT COALESCE(required_hours, 240) INTO v_required
      FROM public.subjects WHERE id = v_row.subject_id;
      v_required := COALESCE(v_required, 240);
    END IF;

    v_status := CASE WHEN v_hours >= v_required THEN 'COMPLETED' ELSE 'INCOMPLETE' END;

    UPDATE public.teacher_groups
       SET closed_at = now(), audited_hours = v_hours, closure_status = v_status
     WHERE id = v_row.id;

    INSERT INTO public.audit_log (action, actor_user_id, target_user_id, details)
    VALUES ('CYCLE_CLOSED', v_row.student_id, v_row.student_id,
            jsonb_build_object(
              'assignment_id',  v_row.id,
              'subject_id',     v_row.subject_id,
              'campus_id',      v_row.campus_id,
              'audited_hours',  v_hours,
              'required_hours', v_required,
              'status',         v_status,
              'period_end',     v_row.end_date));

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
