-- Fase 2: tabla push_tokens + routing de notificaciones push/email
-- Cubre T-16.1 (FCM), T-16.2 (Resend), T-12.2, T-09.3, T-10.3, T-20.2 push

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tabla push_tokens (un token FCM por usuario, último dispositivo activo)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token      text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_tokens_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON public.push_tokens (user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_upsert_own_token" ON public.push_tokens;
CREATE POLICY "user_upsert_own_token" ON public.push_tokens
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "service_role_read_tokens" ON public.push_tokens;
CREATE POLICY "service_role_read_tokens" ON public.push_tokens
  FOR SELECT USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. system_config: URL del proyecto y secreto del dispatcher
-- El equipo debe actualizar supabase_project_url con la URL real del proyecto
-- y registrar el mismo valor de dispatch_webhook_secret como Supabase Secret:
--   supabase secrets set DISPATCH_WEBHOOK_SECRET=<valor>
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.system_config(key, value) VALUES
  ('supabase_project_url',     'https://hhddnhofyilsdaltzpeh.supabase.co'),
  ('dispatch_webhook_secret',  'change-this-before-deploy')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Helper: encolar notificación en notification_outbox para todos los
--    coordinadores/admins (para eventos de seguridad/operación)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_queue_coordinator_notification(
  p_type        text,
  p_attendance_id uuid,
  p_payload     jsonb
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.notification_outbox (channel, type, target_user_id, attendance_id, payload)
  SELECT channels.channel, p_type, u.id, p_attendance_id,
         p_payload || jsonb_build_object('recipient_email', u.email)
  FROM   public.users u
  CROSS JOIN (VALUES ('push'), ('email')) AS channels(channel)
  WHERE  upper(u.role) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR');
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Ampliar fn_compliance_alert: también encola en notification_outbox
--    para que el alumno reciba push + email
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_compliance_alert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_threshold numeric;
  v_goal      numeric;
  v_total_h   numeric;
  v_pct       numeric;
BEGIN
  SELECT COALESCE(value::numeric, 60)  INTO v_threshold FROM public.system_config WHERE key = 'compliance_alert_threshold_pct';
  SELECT COALESCE(value::numeric, 240) INTO v_goal      FROM public.system_config WHERE key = 'required_practice_hours';
  v_threshold := COALESCE(v_threshold, 60);
  v_goal      := COALESCE(v_goal, 240);

  SELECT COALESCE(SUM(worked_hours), 0) INTO v_total_h
  FROM public.attendances WHERE student_id = NEW.student_id AND check_out IS NOT NULL;

  v_pct := ROUND((v_total_h / NULLIF(v_goal, 0)) * 100, 1);

  IF v_pct < v_threshold THEN
    INSERT INTO public.audit_log(action, actor_user_id, target_user_id, details)
    VALUES ('compliance_alert', NEW.student_id, NEW.student_id,
      jsonb_build_object(
        'compliance_pct', v_pct, 'threshold', v_threshold,
        'total_hours', v_total_h, 'goal_hours', v_goal,
        'attendance_id', NEW.id
      )
    );
    -- Notificar al propio alumno
    INSERT INTO public.notification_outbox (channel, type, target_user_id, attendance_id, payload)
    SELECT channels.channel, 'COMPLIANCE_ALERT', NEW.student_id, NEW.id,
           jsonb_build_object(
             'compliance_pct', v_pct, 'threshold', v_threshold,
             'recipient_email', u.email
           )
    FROM   public.users u
    CROSS JOIN (VALUES ('push'), ('email')) AS channels(channel)
    WHERE  u.id = NEW.student_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Ampliar fn_log_omission_alert: también encola para coordinadores
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_log_omission_alert(p_attendance_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_att record;
BEGIN
  SELECT * INTO v_att FROM public.attendances WHERE id = p_attendance_id;
  IF v_att IS NULL THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM public.audit_log
    WHERE  action = 'omission_alert'
    AND    details->>'attendance_id' = p_attendance_id::text
  ) THEN RETURN; END IF;

  INSERT INTO public.audit_log(action, actor_user_id, target_user_id, details)
  VALUES (
    'omission_alert', v_att.student_id, v_att.student_id,
    jsonb_build_object(
      'attendance_id', p_attendance_id,
      'campus_id',     v_att.campus_id,
      'check_in',      v_att.check_in,
      'hours_open',    ROUND(EXTRACT(EPOCH FROM (now() - v_att.check_in)) / 3600.0, 1)
    )
  );

  PERFORM public.fn_queue_coordinator_notification(
    'OMISSION_ALERT', p_attendance_id,
    jsonb_build_object(
      'attendance_id', p_attendance_id,
      'campus_id',     v_att.campus_id,
      'hours_open',    ROUND(EXTRACT(EPOCH FROM (now() - v_att.check_in)) / 3600.0, 1)
    )
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Trigger en audit_log para FAKE_GPS_DETECTED y SHARED_DEVICE_ACTIVE_CONFLICT
--    → encola notificación push + email para coordinadores
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_queue_security_notification()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_attendance_id uuid;
BEGIN
  IF NEW.action NOT IN ('FAKE_GPS_DETECTED', 'SHARED_DEVICE_ACTIVE_CONFLICT') THEN
    RETURN NEW;
  END IF;

  v_attendance_id := COALESCE(
    (NEW.details->>'attendance_id')::uuid,
    (NEW.details->>'active_attendance_id')::uuid
  );

  IF v_attendance_id IS NULL THEN RETURN NEW; END IF;

  PERFORM public.fn_queue_coordinator_notification(
    NEW.action, v_attendance_id, NEW.details
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_security_notification ON public.audit_log;
CREATE TRIGGER trg_security_notification
  AFTER INSERT ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.fn_queue_security_notification();
