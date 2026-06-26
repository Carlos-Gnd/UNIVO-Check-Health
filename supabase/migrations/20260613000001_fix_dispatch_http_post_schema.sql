-- Fix #5/#11/#12: el trigger despachador llamaba a `extensions.http_post(...)`,
-- que NO existe en esta instancia de pg_net (la función vive en el esquema `net`).
-- Como `fn_dispatch_outbox_item` atrapa cualquier excepción y hace RETURN NEW, el
-- fallo era SILENCIOSO: los items quedaban 'pending' y nunca se enviaba push/email.
-- Aquí se recrea la función usando `net.http_post`.
--
-- Si la consulta de diagnóstico mostrara la función en otro esquema/firma, ajustar
-- la llamada de abajo en consecuencia.

CREATE OR REPLACE FUNCTION public.fn_dispatch_outbox_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_project_url text;
  v_secret      text;
BEGIN
  SELECT value INTO v_project_url FROM public.system_config WHERE key = 'supabase_project_url';
  SELECT value INTO v_secret      FROM public.system_config WHERE key = 'dispatch_webhook_secret';

  IF v_project_url IS NULL OR v_secret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_project_url || '/functions/v1/notify-dispatcher',
    body    := jsonb_build_object('outbox_id', NEW.id),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type',  'application/json'
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- No bloquear la transacción si la llamada falla; el item queda en 'pending' para reintento.
  RETURN NEW;
END;
$$;

-- El trigger ya existe (creado en 20260529000003); CREATE OR REPLACE de la función basta.
