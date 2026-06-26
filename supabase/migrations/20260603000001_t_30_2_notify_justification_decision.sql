-- T-30.2: notificar al estudiante cuando su justificacion es aprobada o rechazada.
-- Encola push + email en notification_outbox; el envio real lo procesa notify-dispatcher.

CREATE OR REPLACE FUNCTION public.fn_notify_justification_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student record;
  v_attendance record;
  v_payload jsonb;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('APROBADO', 'RECHAZADO') THEN
    RETURN NEW;
  END IF;

  SELECT id, email, full_name, student_code
  INTO v_student
  FROM public.users
  WHERE id = NEW.student_id;

  IF v_student.id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT a.id, a.date, c.name AS campus_name
  INTO v_attendance
  FROM public.attendances a
  LEFT JOIN public.campuses c ON c.id = a.campus_id
  WHERE a.id = NEW.attendance_id;

  v_payload := jsonb_build_object(
    'justification_id', NEW.id,
    'attendance_id', NEW.attendance_id,
    'student_id', NEW.student_id,
    'student_name', COALESCE(v_student.full_name, 'Estudiante'),
    'student_code', COALESCE(v_student.student_code, ''),
    'status', NEW.status,
    'reviewer_notes', COALESCE(NEW.notas_revisor, ''),
    'attendance_date', COALESCE(v_attendance.date::text, ''),
    'campus_name', COALESCE(v_attendance.campus_name, 'Sede desconocida'),
    'recipient_email', v_student.email
  );

  INSERT INTO public.notification_outbox (channel, type, target_user_id, attendance_id, payload)
  SELECT channels.channel,
         'JUSTIFICATION_DECISION',
         NEW.student_id,
         NEW.attendance_id,
         v_payload
  FROM (VALUES ('push'), ('email')) AS channels(channel);

  INSERT INTO public.audit_log (action, actor_user_id, target_user_id, details)
  VALUES (
    'JUSTIFICATION_DECISION_NOTIFIED',
    COALESCE(NEW.revisado_por, NEW.student_id),
    NEW.student_id,
    v_payload || jsonb_build_object('channels', jsonb_build_array('push', 'email'))
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_justification_decision ON public.justifications;
CREATE TRIGGER trg_notify_justification_decision
  AFTER UPDATE ON public.justifications
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_justification_decision();
