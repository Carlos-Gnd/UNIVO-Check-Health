-- R-01 - Check-out con paridad de validaciones.
-- La salida debe pasar geofence y ventana horaria igual que la entrada, incluso
-- si alguien intenta actualizar attendances directo desde el cliente.

ALTER TABLE public.attendances
  ADD COLUMN IF NOT EXISTS check_out_device_fingerprint text;

CREATE OR REPLACE FUNCTION public.validate_checkout_parity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lat numeric;
  v_lng numeric;
  v_validation record;
  v_assignment public.teacher_groups;
  v_slot record;
  v_weekday integer;
  v_now time := (now() AT TIME ZONE 'America/El_Salvador')::time;
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

  SELECT * INTO v_validation
  FROM public.validate_checkin_area(NEW.campus_id, v_lat, v_lng)
  LIMIT 1;

  IF COALESCE(v_validation.is_allowed, false) IS NOT TRUE THEN
    RAISE EXCEPTION '%', COALESCE(v_validation.message, 'Ubicacion fuera del area permitida.');
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

  v_weekday := EXTRACT(ISODOW FROM (now() AT TIME ZONE 'America/El_Salvador'));
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

  IF v_slot.check_in_from IS NOT NULL AND v_now < v_slot.check_in_from THEN
    RAISE EXCEPTION 'Fuera de tu horario de salida (%-%).', v_slot.check_in_from, v_slot.check_in_to;
  END IF;

  IF v_slot.check_in_to IS NOT NULL AND v_now > v_slot.check_in_to THEN
    RAISE EXCEPTION 'Fuera de tu horario de salida (%-%).', v_slot.check_in_from, v_slot.check_in_to;
  END IF;

  NEW.assignment_id := COALESCE(NEW.assignment_id, v_assignment.id);
  NEW.subject_id := COALESCE(NEW.subject_id, v_assignment.subject_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_checkout_parity ON public.attendances;
CREATE TRIGGER trg_validate_checkout_parity
BEFORE UPDATE OF check_out ON public.attendances
FOR EACH ROW
EXECUTE FUNCTION public.validate_checkout_parity();
