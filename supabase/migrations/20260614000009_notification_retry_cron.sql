-- Recomendación de auditoría: robustez de notificaciones.
-- El trigger de despacho (fn_dispatch_outbox_item) atrapa errores y deja los items en
-- 'pending' SIN reintento → si el primer POST falla (red, gateway, deploy), ese correo/push
-- se pierde para siempre. Aquí:
--   1) fn_retry_pending_outbox: re-despacha los 'pending' con > 5 min de antigüedad.
--   2) pg_cron cada 15 min lo ejecuta.
--   3) limpieza diaria de net._http_response (crece sin límite).
-- notify-dispatcher marca 'sent'/'failed' atómicamente, así que reintentar 'pending' es
-- idempotente (no reenvía los ya enviados).

CREATE OR REPLACE FUNCTION public.fn_retry_pending_outbox()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url    text;
  v_secret text;
  v_anon   text;
  r        record;
BEGIN
  SELECT value INTO v_url    FROM public.system_config WHERE key = 'supabase_project_url';
  SELECT value INTO v_secret FROM public.system_config WHERE key = 'dispatch_webhook_secret';
  SELECT value INTO v_anon   FROM public.system_config WHERE key = 'supabase_anon_key';
  IF v_url IS NULL OR v_secret IS NULL OR v_anon IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT id FROM public.notification_outbox
    WHERE status = 'pending'
      AND created_at < now() - interval '5 minutes'
    ORDER BY created_at
    LIMIT 100
  LOOP
    PERFORM net.http_post(
      url     := v_url || '/functions/v1/notify-dispatcher',
      body    := jsonb_build_object('outbox_id', r.id),
      headers := jsonb_build_object(
        'Authorization',     'Bearer ' || v_anon,
        'x-dispatch-secret', v_secret,
        'Content-Type',      'application/json'
      )
    );
  END LOOP;
END;
$$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron no habilitado; habilitarlo en el dashboard y reejecutar este bloque.';
    RETURN;
  END IF;

  -- Reintento de notificaciones pendientes cada 15 min.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'checkhealth_retry_pending_outbox') THEN
    PERFORM cron.unschedule('checkhealth_retry_pending_outbox');
  END IF;
  PERFORM cron.schedule(
    'checkhealth_retry_pending_outbox',
    '*/15 * * * *',
    $$SELECT public.fn_retry_pending_outbox();$$
  );

  -- Limpieza diaria (3:17 AM) de respuestas HTTP de pg_net (la tabla crece sin tope).
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'checkhealth_cleanup_http_responses') THEN
    PERFORM cron.unschedule('checkhealth_cleanup_http_responses');
  END IF;
  PERFORM cron.schedule(
    'checkhealth_cleanup_http_responses',
    '17 3 * * *',
    $$DELETE FROM net._http_response WHERE created < now() - interval '7 days';$$
  );
END
$do$;
