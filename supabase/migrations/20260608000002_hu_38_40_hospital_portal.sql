-- HU-38 / HU-40 - Portal del Representante Hospitalario.
-- Nuevo rol REPRESENTATIVE con login propio, ligado a UNA sede (users.campus_id).
-- HU-38: ve en tiempo real los estudiantes activos de su sede.
-- HU-40: reporta conducta inadecuada de un estudiante -> notifica a coordinador y docente.
-- Acceso server-side por RPC (SECURITY DEFINER) para no abrir RLS de attendances/users
-- al rol; el representante solo toca su propia sede.

-- Sede que representa el usuario (solo aplica al rol REPRESENTATIVE).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS campus_id uuid REFERENCES public.campuses(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- HU-38: estudiantes activos (check-in abierto) de la sede del representante.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_campus_active_students()
RETURNS TABLE(
  attendance_id uuid,
  student_id    uuid,
  student_name  text,
  student_code  text,
  career        text,
  site_name     text,
  check_in      timestamptz,
  hours_today   numeric,
  last_location jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role   text := upper(coalesce(public.get_current_user_role(), ''));
  v_campus uuid;
BEGIN
  IF v_role <> 'REPRESENTATIVE' THEN
    RAISE EXCEPTION 'Solo el representante hospitalario puede consultar esta vista.';
  END IF;

  SELECT u.campus_id INTO v_campus FROM public.users u WHERE u.id = auth.uid();
  IF v_campus IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.student_id,
    coalesce(s.full_name, 'Desconocido'),
    coalesce(s.student_code, ''),
    coalesce(s.career, 'Sin carrera'),
    coalesce(c.location_label, c.name, 'Sede no registrada'),
    a.check_in,
    round(extract(epoch FROM (now() - a.check_in)) / 3600.0, 2)::numeric,
    coalesce(a.check_out_location, a.check_in_location)
  FROM public.attendances a
  JOIN public.users s   ON s.id = a.student_id
  LEFT JOIN public.campuses c ON c.id = a.campus_id
  WHERE a.check_out IS NULL
    AND a.campus_id = v_campus
  ORDER BY a.check_in DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_campus_active_students() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- HU-40: el representante reporta conducta inadecuada de un estudiante activo.
-- Queda en audit_log y notifica a coordinador y docente del alumno.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.report_student_conduct(
  p_attendance_id uuid,
  p_motivo        text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     text := upper(coalesce(public.get_current_user_role(), ''));
  v_actor    uuid := auth.uid();
  v_campus   uuid;
  v_motivo   text := nullif(trim(coalesce(p_motivo, '')), '');
  v_att      record;
  v_group    record;
  v_payload  jsonb;
  v_rep_name text;
BEGIN
  IF v_role <> 'REPRESENTATIVE' THEN
    RAISE EXCEPTION 'Solo el representante hospitalario puede reportar conducta.';
  END IF;
  IF v_motivo IS NULL THEN
    RAISE EXCEPTION 'El motivo del reporte es obligatorio.';
  END IF;

  SELECT u.campus_id, u.full_name INTO v_campus, v_rep_name
  FROM public.users u WHERE u.id = v_actor;

  SELECT a.id, a.student_id, a.campus_id, a.date, s.full_name AS student_name,
         s.student_code, c.name AS campus_name
  INTO v_att
  FROM public.attendances a
  JOIN public.users s ON s.id = a.student_id
  LEFT JOIN public.campuses c ON c.id = a.campus_id
  WHERE a.id = p_attendance_id;

  IF v_att.id IS NULL THEN
    RAISE EXCEPTION 'Asistencia no encontrada.';
  END IF;
  IF v_campus IS NULL OR v_att.campus_id <> v_campus THEN
    RAISE EXCEPTION 'Solo puedes reportar estudiantes de tu sede.';
  END IF;

  -- Docente y coordinador del alumno (asignación que coincide con la sede).
  SELECT tg.teacher_id, tg.coordinator_id
  INTO v_group
  FROM public.teacher_groups tg
  WHERE tg.student_id = v_att.student_id
    AND tg.campus_id = v_att.campus_id
  ORDER BY tg.period DESC
  LIMIT 1;

  INSERT INTO public.audit_log (action, actor_user_id, target_user_id, details)
  VALUES (
    'CONDUCT_REPORT',
    v_actor,
    v_att.student_id,
    jsonb_build_object(
      'attendance_id', p_attendance_id,
      'campus_id', v_att.campus_id,
      'campus_name', coalesce(v_att.campus_name, 'Sede'),
      'motivo', v_motivo,
      'representative_name', coalesce(v_rep_name, 'Representante'),
      'source', 'report_student_conduct'
    )
  );

  v_payload := jsonb_build_object(
    'student_id', v_att.student_id,
    'student_name', coalesce(v_att.student_name, 'Estudiante'),
    'student_code', coalesce(v_att.student_code, ''),
    'campus_name', coalesce(v_att.campus_name, 'Sede'),
    'representative_name', coalesce(v_rep_name, 'Representante'),
    'motivo', v_motivo,
    'attendance_date', coalesce(v_att.date::text, '')
  );

  -- Encola push + email para coordinador y docente (los que existan).
  INSERT INTO public.notification_outbox (channel, type, target_user_id, attendance_id, payload)
  SELECT channels.channel, 'CONDUCT_REPORT', recipients.uid, p_attendance_id,
         v_payload || jsonb_build_object('recipient_email', (SELECT email FROM public.users WHERE id = recipients.uid))
  FROM (VALUES ('push'), ('email')) AS channels(channel)
  CROSS JOIN (
    SELECT v_group.teacher_id AS uid WHERE v_group.teacher_id IS NOT NULL
    UNION
    SELECT v_group.coordinator_id WHERE v_group.coordinator_id IS NOT NULL
  ) AS recipients
  WHERE recipients.uid IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_student_conduct(uuid, text) TO authenticated;

-- Historial de reportes de conducta presentados por el representante autenticado.
CREATE OR REPLACE FUNCTION public.get_my_conduct_reports()
RETURNS TABLE(
  id          uuid,
  student_name text,
  motivo      text,
  campus_name text,
  created_at  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := upper(coalesce(public.get_current_user_role(), ''));
BEGIN
  IF v_role <> 'REPRESENTATIVE' THEN
    RAISE EXCEPTION 'Solo el representante hospitalario puede consultar sus reportes.';
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    coalesce(s.full_name, 'Estudiante'),
    coalesce(al.details->>'motivo', ''),
    coalesce(al.details->>'campus_name', 'Sede'),
    al.created_at
  FROM public.audit_log al
  LEFT JOIN public.users s ON s.id = al.target_user_id
  WHERE al.action = 'CONDUCT_REPORT'
    AND al.actor_user_id = auth.uid()
  ORDER BY al.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_conduct_reports() TO authenticated;
