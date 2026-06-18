-- Fix P2-1: fn_notify_justification_received encolaba push+email para TODO el staff
-- (ADMIN/COORDINATOR/TEACHER/DOCENTE), sin importar relación con el alumno → inbox
-- inundado + fuga de privacidad (un docente veía justificaciones de alumnos ajenos).
--
-- Se enruta al docente y coordinador ASIGNADOS al alumno (vía teacher_groups, filtrando
-- por la sede de la asistencia/ausencia cuando se conoce), como ya hace report_student_conduct.
-- Fallback: si el alumno no tiene asignación con docente/coordinador, se avisa a los ADMIN
-- para que la justificación nunca quede sin revisor.

CREATE OR REPLACE FUNCTION public.fn_notify_justification_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_name text;
  v_student_code text;
  v_att_date     text;
  v_campus_name  text;
  v_campus_id    uuid;
  v_payload      jsonb;
  v_count        integer;
BEGIN
  SELECT full_name, student_code INTO v_student_name, v_student_code
  FROM public.users WHERE id = NEW.student_id;

  -- Fecha y sede: desde la asistencia si existe; si es ausencia, desde absence_*.
  IF NEW.attendance_id IS NOT NULL THEN
    SELECT a.date::text, c.name, a.campus_id
      INTO v_att_date, v_campus_name, v_campus_id
    FROM public.attendances a
    LEFT JOIN public.campuses c ON c.id = a.campus_id
    WHERE a.id = NEW.attendance_id;
  ELSE
    v_att_date  := NEW.absence_date::text;
    v_campus_id := NEW.absence_campus_id;
    SELECT name INTO v_campus_name FROM public.campuses WHERE id = NEW.absence_campus_id;
  END IF;

  v_payload := jsonb_build_object(
    'student_name',    COALESCE(v_student_name, 'Estudiante'),
    'student_code',    COALESCE(v_student_code, ''),
    'attendance_date', COALESCE(v_att_date, ''),
    'campus_name',     COALESCE(v_campus_name, 'Sede'),
    'reason',          NEW.motivo
  );

  -- Docente + coordinador asignados al alumno (en esa sede si se conoce).
  WITH recipients AS (
    SELECT DISTINCT uid FROM (
      SELECT tg.teacher_id      AS uid FROM public.teacher_groups tg
        WHERE tg.student_id = NEW.student_id
          AND (v_campus_id IS NULL OR tg.campus_id = v_campus_id)
      UNION
      SELECT tg.coordinator_id        FROM public.teacher_groups tg
        WHERE tg.student_id = NEW.student_id
          AND (v_campus_id IS NULL OR tg.campus_id = v_campus_id)
    ) ids
    WHERE uid IS NOT NULL
  )
  INSERT INTO public.notification_outbox (channel, type, target_user_id, attendance_id, payload)
  SELECT ch.channel, 'JUSTIFICATION_RECEIVED', r.uid, NEW.attendance_id,
         v_payload || jsonb_build_object('recipient_email', (SELECT email FROM public.users WHERE id = r.uid))
  FROM recipients r
  CROSS JOIN (VALUES ('push'), ('email')) AS ch(channel);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Fallback a ADMIN si el alumno no tenía docente/coordinador asignado (0 destinatarios).
  IF v_count = 0 THEN
    INSERT INTO public.notification_outbox (channel, type, target_user_id, attendance_id, payload)
    SELECT ch.channel, 'JUSTIFICATION_RECEIVED', u.id, NEW.attendance_id,
           v_payload || jsonb_build_object('recipient_email', u.email)
    FROM public.users u
    CROSS JOIN (VALUES ('push'), ('email')) AS ch(channel)
    WHERE upper(u.role) = 'ADMIN';
  END IF;

  RETURN NEW;
END;
$$;
