-- T-39.1 - Confirmacion de presencia por representante ante falla tecnica.
-- Crea un registro de asistencia con hora oficial del servidor y deja evidencia
-- inmutable en audit_log.

CREATE OR REPLACE FUNCTION public.confirm_hospital_presence_tech_failure(
  p_student_id uuid,
  p_campus_id uuid,
  p_representative_name text,
  p_representative_role text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_confirmed_at timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text := upper(public.get_current_user_role());
  v_attendance_id uuid;
  v_student public.users;
  v_campus public.campuses;
  v_rep_name text := nullif(trim(p_representative_name), '');
  v_rep_role text := nullif(trim(coalesce(p_representative_role, '')), '');
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sesion requerida.';
  END IF;

  IF v_actor_role NOT IN ('ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE') THEN
    RAISE EXCEPTION 'No autorizado para confirmar presencia por falla tecnica.';
  END IF;

  IF v_rep_name IS NULL OR length(v_rep_name) < 3 THEN
    RAISE EXCEPTION 'Nombre del representante requerido.';
  END IF;

  SELECT * INTO v_student FROM public.users WHERE id = p_student_id AND upper(role) = 'STUDENT';
  IF v_student.id IS NULL THEN
    RAISE EXCEPTION 'Estudiante no encontrado.';
  END IF;

  SELECT * INTO v_campus FROM public.campuses WHERE id = p_campus_id;
  IF v_campus.id IS NULL THEN
    RAISE EXCEPTION 'Sede no encontrada.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.attendances
    WHERE student_id = p_student_id
      AND check_out IS NULL
  ) THEN
    RAISE EXCEPTION 'El estudiante ya tiene una asistencia activa.';
  END IF;

  INSERT INTO public.attendances (
    student_id,
    campus_id,
    check_in,
    date,
    status,
    notes,
    review_status,
    suspicious_reason
  )
  VALUES (
    p_student_id,
    p_campus_id,
    coalesce(p_confirmed_at, now()),
    coalesce(p_confirmed_at, now())::date,
    'present',
    concat_ws(
      ' ',
      'Confirmacion manual por falla tecnica.',
      'Representante:', v_rep_name || '.',
      CASE WHEN v_reason IS NOT NULL THEN 'Motivo: ' || v_reason ELSE NULL END
    ),
    'CONFIRMADO_REPRESENTANTE',
    'Presencia confirmada por representante de sede ante falla tecnica.'
  )
  RETURNING id INTO v_attendance_id;

  INSERT INTO public.audit_log(action, actor_user_id, target_user_id, details)
  VALUES (
    'HOSPITAL_TECH_FAILURE_PRESENCE_CONFIRMED',
    v_actor,
    p_student_id,
    jsonb_build_object(
      'attendance_id', v_attendance_id,
      'campus_id', p_campus_id,
      'campus_name', v_campus.name,
      'student_code', v_student.student_code,
      'student_name', v_student.full_name,
      'representative_name', v_rep_name,
      'representative_role', v_rep_role,
      'reason', v_reason,
      'confirmed_at', coalesce(p_confirmed_at, now()),
      'actor_role', v_actor_role,
      'source', 'confirm_hospital_presence_tech_failure'
    )
  );

  RETURN v_attendance_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_hospital_presence_tech_failure(uuid, uuid, text, text, text, timestamptz) TO authenticated;
