-- T-55.1: recordatorio de check-out al estudiante (la notificación #1 de la encuesta, 72.4%).
-- Encola un recordatorio para cada asistencia abierta que supere N horas, una sola vez.
-- pg_cron cada 30 min. Distinto de HU-20 (que alerta al COORDINADOR por omisión prolongada).

INSERT INTO public.system_config(key, value) VALUES
  ('checkout_reminder_after_hours', '6')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fn_enqueue_checkout_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_after_hours numeric;
  v_row record;
  v_count integer := 0;
BEGIN
  SELECT COALESCE(value::numeric, 6) INTO v_after_hours
  FROM public.system_config WHERE key = 'checkout_reminder_after_hours';
  v_after_hours := COALESCE(v_after_hours, 6);

  FOR v_row IN
    SELECT a.id AS attendance_id, a.student_id, u.email,
           ROUND(EXTRACT(EPOCH FROM (now() - a.check_in)) / 3600.0, 1) AS hours_open
    FROM public.attendances a
    JOIN public.users u ON u.id = a.student_id
    WHERE a.check_out IS NULL
      AND EXTRACT(EPOCH FROM (now() - a.check_in)) / 3600.0 >= v_after_hours
      -- evitar duplicados: que no se haya encolado ya un recordatorio para esta asistencia
      AND NOT EXISTS (
        SELECT 1 FROM public.notification_outbox n
        WHERE n.type = 'CHECKOUT_REMINDER' AND n.attendance_id = a.id
      )
  LOOP
    INSERT INTO public.notification_outbox (channel, type, target_user_id, attendance_id, payload)
    SELECT channels.channel, 'CHECKOUT_REMINDER', v_row.student_id, v_row.attendance_id,
           jsonb_build_object('hours_open', v_row.hours_open, 'recipient_email', v_row.email)
    FROM (VALUES ('push'), ('email')) AS channels(channel);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- pg_cron cada 30 min (si pg_cron está habilitado)
DO $outer$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron no habilitado; activarlo y reejecutar este bloque.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'checkhealth_checkout_reminders') THEN
    PERFORM cron.unschedule('checkhealth_checkout_reminders');
  END IF;

  PERFORM cron.schedule(
    'checkhealth_checkout_reminders',
    '*/30 * * * *',
    $$SELECT public.fn_enqueue_checkout_reminders();$$
  );
END;
$outer$;
