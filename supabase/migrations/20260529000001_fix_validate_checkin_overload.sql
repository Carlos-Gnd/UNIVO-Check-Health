-- Fase 0: eliminar overloads ambiguos de validate_checkin_area (3 args).
-- La versión de 4 args con DEFAULT now() ya cubre todas las llamadas con 3 args.
-- Sin este DROP, PostgreSQL lanza PGRST203 (ambiguous function) al llamar sin p_timestamp.

DROP FUNCTION IF EXISTS public.validate_checkin_area(uuid, numeric, numeric);
DROP FUNCTION IF EXISTS app.validate_checkin_area(uuid, numeric, numeric);
