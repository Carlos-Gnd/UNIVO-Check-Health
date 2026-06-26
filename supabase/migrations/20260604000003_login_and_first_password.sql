-- Login por carné robusto + contraseña temporal de un solo uso.
-- 1) email_for_login: resuelve un identificador (carné/código O correo) al correo
--    real con el que autenticar en Supabase Auth. SECURITY DEFINER porque el
--    solicitante no está autenticado. Devuelve NULL si no existe.
-- 2) must_change_password: marca la contraseña genérica como de un solo uso; al
--    primer ingreso la app obliga a cambiarla.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Resolución de identificador → email
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.email_for_login(p_identifier text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email
  FROM public.users
  WHERE lower(email) = lower(trim(p_identifier))
     OR upper(student_code) = upper(trim(p_identifier))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.email_for_login(text) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Flag de cambio obligatorio de contraseña
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- El usuario autenticado limpia su propio flag tras cambiar la contraseña.
CREATE OR REPLACE FUNCTION public.complete_password_change()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  UPDATE public.users SET must_change_password = false WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_password_change() TO authenticated;
