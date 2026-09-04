-- Encontrado al preparar el diálogo de "ya tenés una sesión activa" en el login:
-- la sesión única en realidad no estaba cerrando nada. set_active_session()
-- (20260607000007_r_07_active_sessions_self_service.sql) actualiza
-- users.active_session_id al hacer login en un dispositivo nuevo, pero nunca
-- revoca la fila de la sesión VIEJA en user_sessions. Y touch_active_session()
-- solo mira revoked_at de la propia fila — nunca compara contra
-- users.active_session_id. Resultado: el sondeo de 45s en el dispositivo viejo
-- seguía devolviendo "todo bien" para siempre.
--
-- Fix con dos capas (no solo una, por si alguna falla):
-- 1) set_active_session ahora revoca todas las demás sesiones no revocadas del
--    usuario al reclamar la nueva — así queda una sola sesión "viva" de verdad.
-- 2) touch_active_session además compara contra users.active_session_id, para
--    no depender solo de que el paso 1 se haya ejecutado correctamente.

CREATE OR REPLACE FUNCTION public.set_active_session(
  p_session_id text,
  p_device_label text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesion requerida.';
  END IF;

  INSERT INTO public.user_sessions(user_id, session_id, device_label, user_agent)
  VALUES (auth.uid(), p_session_id, nullif(trim(coalesce(p_device_label, '')), ''), nullif(trim(coalesce(p_user_agent, '')), ''))
  ON CONFLICT (session_id) DO UPDATE
  SET last_seen_at = now(),
      device_label = COALESCE(EXCLUDED.device_label, public.user_sessions.device_label),
      user_agent = COALESCE(EXCLUDED.user_agent, public.user_sessions.user_agent),
      revoked_at = NULL,
      revoked_by = NULL;

  -- Sesión única de verdad: cualquier otra sesión del mismo usuario queda revocada.
  UPDATE public.user_sessions
  SET revoked_at = now(),
      revoked_by = auth.uid()
  WHERE user_id = auth.uid()
    AND session_id <> p_session_id
    AND revoked_at IS NULL;

  UPDATE public.users
  SET active_session_id = p_session_id
  WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_active_session(p_session_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_revoked timestamptz;
  v_active_session_id text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT revoked_at INTO v_revoked
  FROM public.user_sessions
  WHERE user_id = auth.uid()
    AND session_id = p_session_id;

  IF v_revoked IS NOT NULL THEN
    RETURN false;
  END IF;

  -- Defensa en profundidad: además de revoked_at, confirma que esta sigue
  -- siendo la sesión activa según users.active_session_id.
  SELECT active_session_id INTO v_active_session_id
  FROM public.users
  WHERE id = auth.uid();

  IF v_active_session_id IS DISTINCT FROM p_session_id THEN
    RETURN false;
  END IF;

  UPDATE public.user_sessions
  SET last_seen_at = now()
  WHERE user_id = auth.uid()
    AND session_id = p_session_id
    AND revoked_at IS NULL;

  RETURN FOUND;
END;
$$;
