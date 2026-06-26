-- Consentimiento legal — Política de Privacidad, Cookies y Términos y Condiciones
-- El usuario debe aceptar al ingresar. Se versiona: si los términos cambian
-- (LEGAL_VERSION en el front), accepted_legal_version deja de coincidir y se
-- vuelve a pedir la aceptación. Necesario por el tratamiento de datos sensibles
-- (ubicación GPS, IP, huella de dispositivo) → consentimiento informado.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS accepted_legal_at      timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_legal_version text;

-- Registra la aceptación del usuario autenticado para la versión vigente.
CREATE OR REPLACE FUNCTION public.accept_legal_terms(p_version text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.users
     SET accepted_legal_at = now(),
         accepted_legal_version = p_version
   WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.accept_legal_terms(text) FROM public;
GRANT EXECUTE ON FUNCTION public.accept_legal_terms(text) TO authenticated;
