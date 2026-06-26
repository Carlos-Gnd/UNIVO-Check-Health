-- T-32.2: notificar a estudiante y docente cuando una justificacion es escalada.
-- El escalamiento se produce cuando escalated cambia de false a true.

CREATE OR REPLACE FUNCTION public.fn_notify_justification_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student record;
  v_attendance record;
  v_teacher_ids uuid[];
  v_payload jsonb;
BEGIN
  IF COALESCE(NEW.escalated, false) IS FALSE OR COALESCE(OLD.escalated, false) IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT id, email, full_name, student_code
  INTO v_student
  FROM public.users
  WHERE id = NEW.student_id;

  IF v_student.id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT a.id, a.date, a.campus_id, c.name AS campus_name
  INTO v_attendance
  FROM public.attendances a
  LEFT JOIN public.campuses c ON c.id = a.campus_id
  WHERE a.id = NEW.attendance_id;

  SELECT COALESCE(array_agg(tg.teacher_id), ARRAY[]::uuid[])
  INTO v_teacher_ids
  FROM (
    SELECT DISTINCT ON (tg.teacher_id)
      tg.teacher_id,
      tg.start_date,
      tg.end_date,
      tg.created_at
    FROM public.teacher_groups tg
    WHERE tg.student_id = NEW.student_id
      AND tg.teacher_id IS NOT NULL
      AND (tg.campus_id = v_attendance.campus_id OR tg.campus_id IS NULL)
      AND (tg.start_date IS NULL OR tg.start_date <= COALESCE(v_attendance.date, CURRENT_DATE))
      AND (tg.end_date IS NULL OR tg.end_date >= COALESCE(v_attendance.date, CURRENT_DATE))
    ORDER BY tg.teacher_id, tg.start_date DESC NULLS LAST, tg.created_at DESC
  ) tg;

  v_payload := jsonb_build_object(
    'justification_id', NEW.id,
    'attendance_id', NEW.attendance_id,
    'student_id', NEW.student_id,
    'student_name', COALESCE(v_student.full_name, 'Estudiante'),
    'student_code', COALESCE(v_student.student_code, ''),
    'attendance_date', COALESCE(v_attendance.date::text, ''),
    'campus_name', COALESCE(v_attendance.campus_name, 'Sede desconocida'),
    'escalation_note', COALESCE(NEW.notas_revisor, 'Escalada para segunda revision.'),
    'teacher_ids', v_teacher_ids
  );

  INSERT INTO public.notification_outbox (channel, type, target_user_id, attendance_id, payload)
  SELECT channels.channel,
         'JUSTIFICATION_ESCALATED',
         recipients.user_id,
         NEW.attendance_id,
         v_payload || jsonb_build_object(
           'recipient_email', recipients.email,
           'recipient_role', recipients.recipient_role
         )
  FROM (
    SELECT v_student.id AS user_id, v_student.email, 'student' AS recipient_role

    UNION

    SELECT u.id AS user_id, u.email, 'teacher' AS recipient_role
    FROM public.users u
    WHERE u.id = ANY(v_teacher_ids)
      AND u.id <> v_student.id
  ) recipients
  CROSS JOIN (VALUES ('push'), ('email')) AS channels(channel);

  INSERT INTO public.audit_log (action, actor_user_id, target_user_id, details)
  VALUES (
    'JUSTIFICATION_ESCALATION_NOTIFICATIONS_QUEUED',
    COALESCE(NEW.escalated_by, NEW.revisado_por, NEW.student_id),
    NEW.student_id,
    v_payload || jsonb_build_object(
      'channels', jsonb_build_array('push', 'email'),
      'notified_student', true,
      'notified_teacher', COALESCE(array_length(v_teacher_ids, 1), 0) > 0
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_justification_escalation ON public.justifications;
CREATE TRIGGER trg_notify_justification_escalation
  AFTER UPDATE ON public.justifications
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_justification_escalation();
