-- T-34.1 (HU-34) — Cierre automático del ciclo + horas auditadas por materia
-- Al vencer el período de una asignación (teacher_groups.end_date), el ciclo se
-- cierra: se calculan las horas AUDITADAS (asistencias completadas y NO observadas,
-- dentro de la rotación y en la sede) y se marca COMPLETED/INCOMPLETE contra
-- subjects.required_hours. Corre a diario por pg_cron. Idempotente: solo cierra
-- asignaciones aún abiertas (closed_at IS NULL).

ALTER TABLE public.teacher_groups
  ADD COLUMN IF NOT EXISTS closed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS audited_hours  numeric(6,2),
  ADD COLUMN IF NOT EXISTS closure_status text;

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
    SELECT id, student_id, campus_id, subject_id, start_date, end_date
    FROM public.teacher_groups
    WHERE end_date IS NOT NULL
      AND end_date < v_today
      AND closed_at IS NULL
  LOOP
    -- Horas auditadas: asistencias con check-out, dentro de la rotación y en la
    -- sede, excluyendo las marcadas OBSERVADO (fraude/anomalía sin resolver).
    SELECT COALESCE(SUM(a.worked_hours), 0) INTO v_hours
    FROM public.attendances a
    WHERE a.student_id = v_row.student_id
      AND a.campus_id  = v_row.campus_id
      AND a.check_out IS NOT NULL
      AND upper(COALESCE(a.review_status, '')) <> 'OBSERVADO'
      AND (v_row.start_date IS NULL OR a.check_in::date >= v_row.start_date)
      AND a.check_in::date <= v_row.end_date;

    SELECT COALESCE(required_hours, 240) INTO v_required
    FROM public.subjects WHERE id = v_row.subject_id;
    v_required := COALESCE(v_required, 240);

    v_status := CASE WHEN v_hours >= v_required THEN 'COMPLETED' ELSE 'INCOMPLETE' END;

    UPDATE public.teacher_groups
       SET closed_at = now(), audited_hours = v_hours, closure_status = v_status
     WHERE id = v_row.id;

    -- Evento de cierre (inmutable). Actor = el propio alumno, como en los demás
    -- eventos de sistema (audit_log.actor_user_id es NOT NULL).
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

-- Solo el cron (postgres) y las Edge Functions (service_role) pueden invocarlo;
-- un alumno autenticado no debe poder disparar el cierre.
REVOKE ALL ON FUNCTION public.close_due_cycles() FROM public;
GRANT EXECUTE ON FUNCTION public.close_due_cycles() TO service_role;

-- pg_cron diario a las 07:00 UTC (= 01:00 hora de El Salvador). Persistente en
-- migración (no activado a mano). Reejecutar este bloque si pg_cron se habilita después.
DO $outer$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron no habilitado; activarlo y reejecutar este bloque.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'checkhealth_close_due_cycles') THEN
    PERFORM cron.unschedule('checkhealth_close_due_cycles');
  END IF;

  PERFORM cron.schedule(
    'checkhealth_close_due_cycles',
    '0 7 * * *',
    $$SELECT public.close_due_cycles();$$
  );
END;
$outer$;
