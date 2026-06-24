-- Fase 3d — Sesión única por usuario a nivel de app (el toggle nativo de Supabase
-- requiere plan Pro). Cada login guarda un session_id; si alguien inicia sesión en
-- otro equipo, el id cambia y los demás clientes detectan el desajuste y se cierran.
-- No ata al alumno a un dispositivo: simplemente gana el último inicio de sesión.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS active_session_id text;

-- El cliente llama a esta RPC tras iniciar sesión. SECURITY DEFINER para no depender
-- de permisos de UPDATE sobre la tabla (y que el alumno no toque otras columnas).
CREATE OR REPLACE FUNCTION public.set_active_session(p_session_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.users SET active_session_id = p_session_id WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.set_active_session(text) TO authenticated;
