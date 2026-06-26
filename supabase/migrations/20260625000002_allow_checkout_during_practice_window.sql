-- Fix: la salida no debe depender de la ventana general de check-in de la sede.
-- Se valida GPS contra la sede y que la hora de salida caiga dentro del horario
-- de practica del alumno (ej. 07:00-15:00 permite salir a las 13:00).

CREATE OR REPLACE FUNCTION public.validate_checkout_parity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lat numeric;
  v_lng numeric;
  v_campus public.campuses;
  v_distance numeric;
  v_assignment public.teacher_groups;
  v_slot record;
  v_weekday integer;
  v_checkout_time time := (COALESCE(NEW.check_out, now()) AT TIME ZONE 'America/El_Salvador')::time;
BEGIN
  IF NEW.check_out IS NULL OR OLD.check_out IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.campus_id IS DISTINCT FROM OLD.campus_id THEN
    RAISE EXCEPTION 'La sede del check-out no puede cambiar.';
  END IF;

  IF NEW.check_out_location IS NULL THEN
    RAISE EXCEPTION 'Se requiere ubicacion GPS para registrar la salida.';
  END IF;

  v_lat := nullif(NEW.check_out_location->>'latitude', '')::numeric;
  v_lng := nullif(NEW.check_out_location->>'longitude', '')::numeric;

  SELECT * INTO v_campus
  FROM public.campuses
  WHERE id = NEW.campus_id;

  IF v_campus.id IS NULL THEN
    RAISE EXCEPTION 'Sede no encontrada para registrar la salida.';
  END IF;

  v_distance := public.haversine_meters(v_lat, v_lng, v_campus.latitude, v_campus.longitude);
  IF v_distance > v_campus.radius_meters THEN
    RAISE EXCEPTION 'Fuera del area por % metros.', round(v_distance - v_campus.radius_meters);
  END IF;

  IF NEW.assignment_id IS NOT NULL THEN
    SELECT * INTO v_assignment
    FROM public.teacher_groups
    WHERE id = NEW.assignment_id
      AND student_id = NEW.student_id
      AND campus_id = NEW.campus_id;
  ELSE
    SELECT * INTO v_assignment
    FROM public.teacher_groups
    WHERE student_id = NEW.student_id
      AND campus_id = NEW.campus_id
      AND (start_date IS NULL OR NEW.date >= start_date)
      AND (end_date IS NULL OR NEW.date <= end_date)
    ORDER BY start_date DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_assignment.id IS NULL THEN
    RAISE EXCEPTION 'No hay asignacion vigente para registrar la salida en esta sede.';
  END IF;

  v_weekday := EXTRACT(ISODOW FROM COALESCE(NEW.date, (NEW.check_out AT TIME ZONE 'America/El_Salvador')::date));
  SELECT * INTO v_slot
  FROM public.student_schedules
  WHERE assignment_id = v_assignment.id
    AND weekday = v_weekday
    AND is_active = true
  ORDER BY check_in_from NULLS LAST
  LIMIT 1;

  IF v_slot.assignment_id IS NULL THEN
    RAISE EXCEPTION 'No tienes practica programada hoy en esta sede.';
  END IF;

  IF v_slot.check_in_from IS NOT NULL AND v_slot.check_in_to IS NOT NULL THEN
    IF v_slot.check_in_from <= v_slot.check_in_to THEN
      IF v_checkout_time < v_slot.check_in_from OR v_checkout_time > v_slot.check_in_to THEN
        RAISE EXCEPTION 'Fuera de tu horario de salida (%-%).', v_slot.check_in_from, v_slot.check_in_to;
      END IF;
    ELSIF v_checkout_time < v_slot.check_in_from AND v_checkout_time > v_slot.check_in_to THEN
      RAISE EXCEPTION 'Fuera de tu horario de salida (%-%).', v_slot.check_in_from, v_slot.check_in_to;
    END IF;
  END IF;

  NEW.assignment_id := COALESCE(NEW.assignment_id, v_assignment.id);
  NEW.subject_id := COALESCE(NEW.subject_id, v_assignment.subject_id);

  RETURN NEW;
END;
$$;
