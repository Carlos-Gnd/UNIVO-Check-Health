-- T-20.1: pg_cron cada 30 min para detectar attendances sin check_out.
-- Cron documentado: */30 * * * *
-- N configurable en public.system_config con key checkout_omission_max_hours.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

INSERT INTO public.system_config(key, value)
VALUES
  ('checkout_omission_max_hours', '12'),
  ('checkout_omission_cron_expression', '*/30 * * * *')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fn_log_omission_alert(p_attendance_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_att record;
BEGIN
  SELECT * INTO v_att
  FROM public.attendances
  WHERE id = p_attendance_id;

  IF v_att IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.audit_log
    WHERE action = 'omission_alert'
      AND details->>'attendance_id' = p_attendance_id::text
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.audit_log(action, actor_user_id, target_user_id, details)
  VALUES (
    'omission_alert',
    v_att.student_id,
    v_att.student_id,
    jsonb_build_object(
      'attendance_id', p_attendance_id,
      'campus_id', v_att.campus_id,
      'check_in', v_att.check_in,
      'hours_open', ROUND(EXTRACT(EPOCH FROM (now() - v_att.check_in)) / 3600.0, 1)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_run_open_attendance_omission_job()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_max_hours numeric := 12;
  v_row record;
  v_logged integer := 0;
BEGIN
  SELECT COALESCE(value::numeric, 12)
  INTO v_max_hours
  FROM public.system_config
  WHERE key = 'checkout_omission_max_hours';

  v_max_hours := COALESCE(v_max_hours, 12);

  FOR v_row IN
    SELECT *
    FROM public.fn_detect_open_attendances(v_max_hours)
  LOOP
    PERFORM public.fn_log_omission_alert(v_row.attendance_id);
    v_logged := v_logged + 1;
  END LOOP;

  RETURN v_logged;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'checkhealth_detect_open_attendances_30m'
  ) THEN
    PERFORM cron.unschedule('checkhealth_detect_open_attendances_30m');
  END IF;

  PERFORM cron.schedule(
    'checkhealth_detect_open_attendances_30m',
    '*/30 * * * *',
    'SELECT public.fn_run_open_attendance_omission_job();'
  );
END;
$$;
