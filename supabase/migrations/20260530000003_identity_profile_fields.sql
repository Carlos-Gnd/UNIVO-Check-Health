-- T-51.1 + T-52.1 + T-53.1: campos de identidad y perfil en users.
-- T-51.1: pregunta de seguridad + hash de respuesta (verificación de identidad).
-- T-52.1: correo de respaldo (solo notificaciones).
-- T-53.1: campos de perfil (teléfono, preferencias de notificación). photo_url ya existe.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS backup_email          text,
  ADD COLUMN IF NOT EXISTS phone                 text,
  ADD COLUMN IF NOT EXISTS security_question      text,
  ADD COLUMN IF NOT EXISTS security_answer_hash   text,
  ADD COLUMN IF NOT EXISTS notif_push            boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_email           boolean NOT NULL DEFAULT true;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: el usuario configura su pregunta de seguridad (la respuesta se hashea
-- con bcrypt server-side; nunca se almacena en claro).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_security_question(p_question text, p_answer text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF length(trim(p_answer)) < 2 THEN
    RAISE EXCEPTION 'Respuesta demasiado corta';
  END IF;

  UPDATE public.users
  SET security_question    = p_question,
      security_answer_hash = extensions.crypt(lower(trim(p_answer)), extensions.gen_salt('bf'))
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_security_question(text, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: verificar la respuesta de seguridad por email (usado en recuperación,
-- T-51.2/T-51.3). SECURITY DEFINER porque el solicitante no está autenticado.
-- Devuelve true/false sin exponer el hash.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.verify_security_answer(p_email text, p_answer text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
BEGIN
  SELECT security_answer_hash INTO v_hash
  FROM public.users
  WHERE lower(email) = lower(trim(p_email));

  IF v_hash IS NULL THEN
    RETURN false;
  END IF;

  RETURN v_hash = extensions.crypt(lower(trim(p_answer)), v_hash);
END;
$$;

-- Solo el rol anónimo/servicio la invoca durante recuperación; se expone vía Edge Function.
GRANT EXECUTE ON FUNCTION public.verify_security_answer(text, text) TO anon, authenticated;
