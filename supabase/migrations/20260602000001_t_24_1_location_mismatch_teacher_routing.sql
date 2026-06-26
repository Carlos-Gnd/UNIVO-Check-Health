-- T-24.1: enrutar LOCATION_MISMATCH al docente del grupo del estudiante.
-- Mantiene la alerta operativa para coordinacion/admin y agrega el docente
-- asignado en teacher_groups para la sede y fecha de la asistencia.

CREATE OR REPLACE FUNCTION public.fn_queue_location_mismatch_notifications()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_payload jsonb;
  v_teacher_ids uuid[];
BEGIN
  IF COALESCE(NEW.location_mismatch, false) IS FALSE THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.location_mismatch, false) IS TRUE THEN
    RETURN NEW;
  END IF;

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
      AND (tg.campus_id = NEW.campus_id OR tg.campus_id IS NULL)
      AND (tg.start_date IS NULL OR tg.start_date <= COALESCE(NEW.date, CURRENT_DATE))
      AND (tg.end_date IS NULL OR tg.end_date >= COALESCE(NEW.date, CURRENT_DATE))
    ORDER BY tg.teacher_id, tg.start_date DESC NULLS LAST, tg.created_at DESC
  ) tg;

  v_payload := jsonb_build_object(
    'attendance_id', NEW.id,
    'student_id', NEW.student_id,
    'campus_id', NEW.campus_id,
    'check_in_location', NEW.check_in_location,
    'check_out_location', NEW.check_out_location,
    'teacher_ids', v_teacher_ids,
    'message', 'Check-out registrado desde una ubicacion distinta al check-in'
  );

  INSERT INTO public.notification_outbox (channel, type, target_user_id, attendance_id, payload)
  SELECT channels.channel,
         'LOCATION_MISMATCH',
         recipients.user_id,
         NEW.id,
         v_payload || jsonb_build_object(
           'recipient_email', recipients.email,
           'recipient_role', recipients.recipient_role
         )
  FROM (
    SELECT u.id AS user_id, u.email, 'teacher' AS recipient_role
    FROM public.users u
    WHERE u.id = ANY(v_teacher_ids)

    UNION

    SELECT u.id AS user_id, u.email, 'coordination' AS recipient_role
    FROM public.users u
    WHERE UPPER(u.role) IN ('COORDINADOR', 'COORDINATOR', 'ADMIN')
      AND NOT (u.id = ANY(v_teacher_ids))
  ) recipients
  CROSS JOIN (VALUES ('push'), ('email')) AS channels(channel);

  INSERT INTO public.audit_log (action, actor_user_id, target_user_id, details)
  VALUES (
    'LOCATION_MISMATCH_NOTIFICATIONS_QUEUED',
    NEW.student_id,
    NEW.student_id,
    v_payload || jsonb_build_object(
      'channels', jsonb_build_array('push', 'email'),
      'routed_to_teacher', COALESCE(array_length(v_teacher_ids, 1), 0) > 0
    )
  );

  RETURN NEW;
END;
$$;
