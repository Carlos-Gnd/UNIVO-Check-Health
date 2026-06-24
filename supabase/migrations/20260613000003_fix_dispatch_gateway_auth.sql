-- Fix #5/#11/#12 (capa de gateway): el gateway de Edge Functions de Supabase valida
-- un JWT en el header Authorization ANTES de ejecutar la función. El trigger mandaba
-- Authorization: Bearer <dispatch_webhook_secret> (un string aleatorio, no un JWT),
-- así que el gateway respondía 401 UNAUTHORIZED_INVALID_JWT_FORMAT y notify-dispatcher
-- nunca corría (items quedaban 'pending').
--
-- Solución: Authorization lleva la anon key (JWT válido → pasa el gateway) y el
-- secreto compartido viaja en una cabecera propia `x-dispatch-secret`, que la
-- función valida. La anon key es pública (no es secreto), por eso vive en system_config.

INSERT INTO public.system_config(key, value) VALUES
  ('supabase_anon_key', 'change-this-to-the-project-anon-key')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fn_dispatch_outbox_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
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
      'Authorization',     'Bearer ' || v_anon,    -- JWT válido para pasar el gateway
      'x-dispatch-secret', v_secret,               -- secreto compartido que valida la función
      'Content-Type',      'application/json'
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- No bloquear la transacción si la llamada falla; el item queda en 'pending' para reintento.
  RETURN NEW;
END;
$$;
