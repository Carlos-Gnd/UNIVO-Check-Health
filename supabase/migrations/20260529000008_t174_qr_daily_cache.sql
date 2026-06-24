-- T-17.4: notificar coordinador/docente al recibir nueva justificación
-- QR diario: tabla de caché + pg_cron para pre-generar a medianoche El Salvador

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. T-17.4: trigger en justifications INSERT
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_justification_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER   -- corre con privilegios del owner para leer users/attendances sin RLS
SET search_path = public
AS $$
DECLARE
  v_student_name text;
  v_student_code text;
  v_att_date     text;
  v_campus_name  text;
BEGIN
  SELECT full_name, student_code
    INTO v_student_name, v_student_code
    FROM public.users WHERE id = NEW.student_id;

  SELECT a.date::text, c.name
    INTO v_att_date, v_campus_name
    FROM public.attendances a
    LEFT JOIN public.campuses c ON c.id = a.campus_id
    WHERE a.id = NEW.attendance_id;

  INSERT INTO public.notification_outbox (channel, type, target_user_id, attendance_id, payload)
  SELECT
    channels.channel,
    'JUSTIFICATION_RECEIVED',
    u.id,
    NEW.attendance_id,
    jsonb_build_object(
      'student_name',  COALESCE(v_student_name, 'Estudiante'),
      'student_code',  COALESCE(v_student_code, ''),
      'attendance_date', COALESCE(v_att_date, ''),
      'campus_name',   COALESCE(v_campus_name, 'Sede'),
      'reason',        NEW.motivo,
      'recipient_email', u.email
    )
  FROM  public.users u
  CROSS JOIN (VALUES ('push'), ('email')) AS channels(channel)
  WHERE upper(u.role) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_justification_received ON public.justifications;
CREATE TRIGGER trg_notify_justification_received
  AFTER INSERT ON public.justifications
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_justification_received();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Tabla de caché QR diario por sede
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campus_daily_qr (
  campus_id  uuid NOT NULL REFERENCES public.campuses(id) ON DELETE CASCADE,
  qr_date    date NOT NULL,
  token      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campus_id, qr_date)
);

ALTER TABLE public.campus_daily_qr ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campus_qr_read_coordinators" ON public.campus_daily_qr;
CREATE POLICY "campus_qr_read_coordinators" ON public.campus_daily_qr
  FOR SELECT TO authenticated
  USING (upper(public.get_current_user_role()) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR'));

DROP POLICY IF EXISTS "service_role_campus_qr" ON public.campus_daily_qr;
CREATE POLICY "service_role_campus_qr" ON public.campus_daily_qr
  FOR ALL USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. pg_cron: pre-generar QRs a las 00:00 hora El Salvador (06:00 UTC)
-- REQUISITO: habilitar pg_cron en Supabase Dashboard → Database → Extensions
-- Si pg_cron no está activo, este bloque se omite silenciosamente.
-- ─────────────────────────────────────────────────────────────────────────────
DO $outer$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron no está habilitado. Actívalo en Database → Extensions del dashboard de Supabase y vuelve a ejecutar este bloque.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'checkhealth_generate_daily_qrs') THEN
    PERFORM cron.unschedule('checkhealth_generate_daily_qrs');
  END IF;

  PERFORM cron.schedule(
    'checkhealth_generate_daily_qrs',
    '0 6 * * *',
    $$SELECT net.http_post(
      url     := (SELECT value FROM public.system_config WHERE key = 'supabase_project_url') || '/functions/v1/generate-daily-qrs',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (SELECT value FROM public.system_config WHERE key = 'dispatch_webhook_secret'),
        'Content-Type', 'application/json'
      ),
      body    := '{}'::jsonb
    )$$
  );

  RAISE NOTICE 'pg_cron job checkhealth_generate_daily_qrs programado correctamente.';
END;
$outer$;
