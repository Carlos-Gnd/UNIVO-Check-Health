-- Bug #1 ("Error al validar ubicacion" en el check-in): elimina el overload
-- ambiguo de validate_checkin_area.
--
-- Historia: 20260521000002 creó la versión de 4 args (con p_timestamp DEFAULT now()).
-- 20260529000001 dropeó la de 3 args para dejar SOLO la de 4. Pero después
-- 20260609000001 volvió a crear la de 3 args (geocerca-only, la ventana horaria
-- pasó a validarse por alumno en la Edge Function) SIN eliminar la de 4 args.
-- Resultado: coexisten ambas → PostgREST lanza PGRST203 (ambiguous function) al
-- invocar `validate_checkin_area` con 3 args nombrados desde validate-qr-checkin,
-- y la Edge Function devuelve "Error al validar ubicacion." → ningún alumno puede
-- marcar entrada aunque esté dentro del área.
--
-- Fix: dejar SOLO la versión de 3 args (geofence). La ventana horaria se valida
-- por alumno (student_schedules) en la Edge Function, que es la fuente de verdad.

DROP FUNCTION IF EXISTS public.validate_checkin_area(uuid, numeric, numeric, timestamptz);

-- Mismo arreglo para el schema local app.* (solo si existe; en la nube no existe).
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'app') THEN
    EXECUTE 'DROP FUNCTION IF EXISTS app.validate_checkin_area(uuid, numeric, numeric, timestamptz)';
  END IF;
END
$do$;
