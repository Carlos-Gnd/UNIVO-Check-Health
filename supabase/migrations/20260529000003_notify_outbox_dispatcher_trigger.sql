-- Fase 2: trigger pg_net en notification_outbox → llama Edge Function notify-dispatcher
-- Requiere: pg_net disponible en Supabase Cloud (está habilitado por defecto)
-- El valor de dispatch_webhook_secret en system_config debe coincidir con:
--   supabase secrets set DISPATCH_WEBHOOK_SECRET=<valor>
--   supabase secrets set FCM_SERVER_KEY=<firebase-legacy-server-key>
--   supabase secrets set RESEND_API_KEY=<resend-api-key>

-- Crear notification_outbox si no existe (idempotente: puede no haberse ejecutado antes)
CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id             bigserial   PRIMARY KEY,
  channel        text        NOT NULL CHECK (channel IN ('push', 'email')),
  type           text        NOT NULL,
  target_user_id uuid        NOT NULL,
  attendance_id  uuid        NOT NULL REFERENCES public.attendances(id) ON DELETE CASCADE,
  status         text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  payload        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  sent_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending
  ON public.notification_outbox (channel, status, created_at)
  WHERE status = 'pending';

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

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

  PERFORM extensions.http_post(
    url     := v_project_url || '/functions/v1/notify-dispatcher',
    body    := jsonb_build_object('outbox_id', NEW.id),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type',  'application/json'
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- No bloquear la transacción si la llamada falla; el item queda en 'pending' para reintento
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_outbox_item ON public.notification_outbox;
CREATE TRIGGER trg_dispatch_outbox_item
  AFTER INSERT ON public.notification_outbox
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.fn_dispatch_outbox_item();
