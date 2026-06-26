-- C-04: fn_dispatch_outbox_item() es SECURITY DEFINER sin SET search_path.
-- Sin search_path fijo, un objeto malicioso en otro schema con el mismo nombre
-- de función o tabla puede ser invocado con privilegios del owner (superusuario).
-- Esta migración recrea la función (versión más reciente: 20260613000003) añadiendo
-- SET search_path = public, net para fijar el contexto de búsqueda de nombres.

CREATE OR REPLACE FUNCTION public.fn_dispatch_outbox_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  v_project_url text;
  v_secret      text;
  v_anon        text;
BEGIN
  SELECT value INTO v_project_url FROM public.system_config WHERE key = 'supabase_project_url';
  SELECT value INTO v_secret      FROM public.system_config WHERE key = 'dispatch_webhook_secret';
  SELECT value INTO v_anon        FROM public.system_config WHERE key = 'supabase_anon_key';

  IF v_project_url IS NULL OR v_secret IS NULL OR v_anon IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_project_url || '/functions/v1/notify-dispatcher',
    body    := jsonb_build_object('outbox_id', NEW.id),
    headers := jsonb_build_object(
      'Authorization',     'Bearer ' || v_anon,
      'x-dispatch-secret', v_secret,
      'Content-Type',      'application/json'
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- No bloquear la transacción si la llamada falla; el item queda en 'pending' para reintento.
  RETURN NEW;
END;
$$;
