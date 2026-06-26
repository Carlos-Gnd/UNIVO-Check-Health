-- Cierre de HU-51: el flujo de recuperación necesita mostrarle al usuario SU
-- pregunta de seguridad antes de que la responda. Como el solicitante no está
-- autenticado, se expone un RPC SECURITY DEFINER de solo lectura que devuelve
-- únicamente el texto de la pregunta (que no es secreto), nunca el hash.
-- Devuelve NULL si el correo no existe o no tiene pregunta configurada
-- (la UI muestra un mensaje genérico y no revela qué caso es).

CREATE OR REPLACE FUNCTION public.get_security_question(p_email text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT security_question
  FROM public.users
  WHERE lower(email) = lower(trim(p_email))
    AND security_question IS NOT NULL
    AND security_answer_hash IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_security_question(text) TO anon, authenticated;
