-- Fase 4 complemento: RLS en notification_outbox.
-- Esta tabla solo debe ser accesible por service_role (triggers y Edge Functions).
-- Usuarios normales nunca deben leer ni escribir directamente.

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_outbox" ON public.notification_outbox;
CREATE POLICY "service_role_outbox" ON public.notification_outbox
  FOR ALL USING (auth.role() = 'service_role');
