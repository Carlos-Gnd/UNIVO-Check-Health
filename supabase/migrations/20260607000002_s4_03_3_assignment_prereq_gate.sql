-- S4-03.3 - Gate de asignacion por nivel academico y prerrequisitos.
-- Bloquea en UI (via RPC) y en BD (trigger) si el alumno no cumple.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS academic_level smallint;

CREATE OR REPLACE FUNCTION public.validate_assignment_gate(
  p_student_id uuid,
  p_subject_id uuid
)
RETURNS TABLE(ok boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_level smallint;
  v_subject public.subjects;
  v_missing text;
BEGIN
  IF p_student_id IS NULL THEN
    RETURN QUERY SELECT false, 'Selecciona un alumno.';
    RETURN;
  END IF;

  IF p_subject_id IS NULL THEN
    RETURN QUERY SELECT false, 'Selecciona una materia.';
    RETURN;
  END IF;

  SELECT COALESCE(academic_level, 0)
    INTO v_student_level
  FROM public.users
  WHERE id = p_student_id;

  IF v_student_level IS NULL THEN
    RETURN QUERY SELECT false, 'El alumno no existe.';
    RETURN;
  END IF;

  SELECT *
    INTO v_subject
  FROM public.subjects
  WHERE id = p_subject_id
    AND is_active = true;

  IF v_subject.id IS NULL THEN
    RETURN QUERY SELECT false, 'La materia seleccionada no existe o esta inactiva.';
    RETURN;
  END IF;

  IF v_subject.min_academic_level IS NOT NULL
     AND v_student_level < v_subject.min_academic_level THEN
    RETURN QUERY SELECT false, format(
      'Nivel academico insuficiente para %s. Requerido: %s; alumno: %s.',
      v_subject.name,
      v_subject.min_academic_level,
      v_student_level
    );
    RETURN;
  END IF;

  SELECT string_agg(req.name, ', ' ORDER BY req.name)
    INTO v_missing
  FROM public.subject_prerequisites sp
  JOIN public.subjects req ON req.id = sp.requires_subject_id
  WHERE sp.subject_id = p_subject_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.teacher_groups tg
      WHERE tg.student_id = p_student_id
        AND tg.subject_id = sp.requires_subject_id
        AND upper(COALESCE(tg.closure_status, '')) = 'COMPLETED'
    );

  IF v_missing IS NOT NULL THEN
    RETURN QUERY SELECT false, 'Prerrequisitos pendientes: ' || v_missing || '.';
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 'Asignacion permitida.';
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_assignment_gate(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_assignment_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gate record;
BEGIN
  -- Service role se usa para seeds/backfills y no representa una accion manual.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.student_id IS NOT DISTINCT FROM OLD.student_id
     AND NEW.subject_id IS NOT DISTINCT FROM OLD.subject_id THEN
    RETURN NEW;
  END IF;

  SELECT *
    INTO v_gate
  FROM public.validate_assignment_gate(NEW.student_id, NEW.subject_id)
  LIMIT 1;

  IF NOT COALESCE(v_gate.ok, false) THEN
    RAISE EXCEPTION '%', COALESCE(v_gate.message, 'El alumno no cumple los requisitos de la materia.');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_assignment_gate ON public.teacher_groups;
CREATE TRIGGER trg_enforce_assignment_gate
BEFORE INSERT OR UPDATE OF student_id, subject_id ON public.teacher_groups
FOR EACH ROW
EXECUTE FUNCTION public.enforce_assignment_gate();
