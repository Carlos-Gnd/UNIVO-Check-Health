-- El edge function notify-dispatcher ahora marca los push fallidos como 'failed'
-- (en vez de dejarlos como 'sent'). El cron de retry solo procesaba 'pending',
-- así que los 'failed' quedaban sin reintento. Esta migración extiende el cron
-- para que también reintente los items 'failed' con >5 min de antigüedad.

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

  -- Reintentar tanto 'pending' (nunca procesados) como 'failed' (procesados pero con error).
  -- El dispatcher marca 'sent' atómicamente antes de enviar, así que reintentar
  -- 'pending'/'failed' es idempotente: si ya está 'sent' no se vuelve a procesar.
  FOR r IN
    SELECT id FROM public.notification_outbox
    WHERE status IN ('pending', 'failed')
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
