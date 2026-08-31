-- CRÍTICO — encontrado al generalizar el arnés de RLS (C1-03), verificado
-- empíricamente contra el stack local: la política "system_config_read_authenticated"
-- (20260529000005_rls_hardening.sql) daba SELECT sin restricción
-- (USING (true)) a CUALQUIER usuario autenticado sobre TODA la tabla —
-- incluida la fila dispatch_webhook_secret. Cualquier alumno logueado podía
-- leer el secreto real con un simple `select * from system_config`, sin
-- necesitar ningún permiso especial. Esto vacía de sentido cualquier
-- rotación del secreto: aunque se rote, sigue siendo público para todos los
-- usuarios autenticados.
--
-- Confirmado por grep en src/ que el frontend solo necesita 3 claves,
-- todas operativas y sin nada sensible: risk_threshold_pct,
-- compliance_alert_threshold_pct, required_practice_hours
-- (src/modules/dean/services/dean.service.ts). El resto (dispatch_webhook_secret,
-- supabase_project_url, supabase_anon_key, textos de email/cron) no lo lee
-- ningún componente — vive ahí solo para que lo usen los triggers/Edge
-- Functions vía service_role.
--
-- Fix: allowlist explícita en vez de la denylist implícita anterior — así
-- cualquier clave nueva que se agregue a futuro (otro secreto, otra config
-- interna) queda privada por defecto salvo que alguien decida a propósito
-- exponerla acá.

DROP POLICY IF EXISTS "system_config_read_authenticated" ON public.system_config;

CREATE POLICY "system_config_read_authenticated" ON public.system_config
  FOR SELECT TO authenticated
  USING (
    key IN ('risk_threshold_pct', 'compliance_alert_threshold_pct', 'required_practice_hours')
  );
