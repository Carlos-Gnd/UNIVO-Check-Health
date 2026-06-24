-- R-07 - Gestion de sesiones/dispositivos activos en autoservicio.

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id text NOT NULL UNIQUE,
  device_label text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active
  ON public.user_sessions(user_id, revoked_at, last_seen_at DESC);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_sessions_read_own" ON public.user_sessions;
CREATE POLICY "user_sessions_read_own" ON public.user_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_sessions_service_role_all" ON public.user_sessions;
CREATE POLICY "user_sessions_service_role_all" ON public.user_sessions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

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

  UPDATE public.user_sessions
  SET last_seen_at = now()
  WHERE user_id = auth.uid()
    AND session_id = p_session_id
    AND revoked_at IS NULL;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_active_sessions()
RETURNS TABLE (
  session_id text,
  device_label text,
  user_agent text,
  created_at timestamptz,
  last_seen_at timestamptz,
  is_current boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.session_id,
    s.device_label,
    s.user_agent,
    s.created_at,
    s.last_seen_at,
    s.session_id = u.active_session_id AS is_current
  FROM public.user_sessions s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.user_id = auth.uid()
    AND s.revoked_at IS NULL
  ORDER BY s.last_seen_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.revoke_my_session(p_session_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesion requerida.';
  END IF;

  UPDATE public.user_sessions
  SET revoked_at = now(),
      revoked_by = auth.uid()
  WHERE user_id = auth.uid()
    AND session_id = p_session_id
    AND revoked_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_my_other_sessions(p_current_session_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesion requerida.';
  END IF;

  UPDATE public.user_sessions
  SET revoked_at = now(),
      revoked_by = auth.uid()
  WHERE user_id = auth.uid()
    AND session_id <> p_current_session_id
    AND revoked_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_active_session(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_active_session(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_active_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_my_session(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_my_other_sessions(text) TO authenticated;
