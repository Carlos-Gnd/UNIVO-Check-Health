-- Fix crítico: la política coordinators_read_all_users consultaba public.users
-- desde dentro de un policy de public.users → recursión infinita → dashboard vacío.
-- Solución: función SECURITY DEFINER que lee el rol sin activar RLS.
-- También agrega is_active a users y campuses para el toggle de activación.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Función SECURITY DEFINER para leer el rol del usuario actual sin recursión
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Reemplazar la política recursiva en users con la función segura
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "coordinators_read_all_users" ON public.users;
CREATE POLICY "coordinators_read_all_users" ON public.users
  FOR SELECT TO authenticated
  USING (
    upper(public.get_current_user_role()) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. is_active en users (activo por defecto)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- El coordinador/admin puede actualizar is_active de cualquier usuario
DROP POLICY IF EXISTS "coordinators_update_users"  ON public.users;
CREATE POLICY "coordinators_update_users" ON public.users
  FOR UPDATE TO authenticated
  USING (upper(public.get_current_user_role()) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR'))
  WITH CHECK (upper(public.get_current_user_role()) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. is_active en campuses (activo por defecto)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.campuses
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
