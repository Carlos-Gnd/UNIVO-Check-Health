-- Fix: cuentas de decano con rol 'ADMINISTRADOR' (o 'DECANO') no podían ver
-- alumnos/sedes. mapAppRole en el frontend ya las trata como Decano, pero las
-- policies RLS solo aceptaban 'ADMIN' en sus listas IN (...), así que el decano
-- no podía leer users/attendances. En vez de tocar decenas de policies, se
-- normaliza el rol en get_current_user_role(): ADMINISTRADOR/DECANO -> ADMIN.
-- Así todas las policies que comparan contra 'ADMIN' funcionan sin cambios.

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE upper(coalesce(role, ''))
    WHEN 'ADMINISTRADOR' THEN 'ADMIN'
    WHEN 'DECANO'        THEN 'ADMIN'
    ELSE upper(role)
  END
  FROM public.users WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;
