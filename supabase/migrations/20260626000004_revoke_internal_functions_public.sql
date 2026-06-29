-- A-07: Postgres concede EXECUTE a PUBLIC por defecto en cada función nueva.
-- Esto permite que anon y authenticated llamen directamente a funciones internas
-- (trigger handlers, cron jobs, utilitarios) vía PostgREST RPC.
--
-- Usamos pg_proc para iterar solo funciones que existen en esta DB, evitando
-- errores en entornos donde algunas funciones aún no están creadas.

DO $$
DECLARE
  r record;
BEGIN

  -- ── Funciones INTERNAS (triggers, cron, utils) → solo REVOKE ───────────────
  -- Nunca deben ser llamadas directamente por clientes.
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    AND p.proname IN (
      'fn_dispatch_outbox_item',
      'fn_notify_justification_received',
      'fn_notify_justification_decision',
      'fn_notify_justification_escalation',
      'fn_compliance_alert',
      'fn_check_location_mismatch',
      'fn_queue_location_mismatch_notifications',
      'fn_queue_security_notification',
      'fn_log_justification_decision',
      'audit_delegated_client_change',
      'validate_checkout_parity',
      'enforce_assignment_gate',
      'enforce_campus_capacity',
      'fn_set_actualizado_en',
      'fn_retry_pending_outbox',
      'fn_run_open_attendance_omission_job',
      'fn_enqueue_checkout_reminders',
      'fn_log_omission_alert',
      'fn_detect_open_attendances',
      'close_due_cycles',
      'fn_queue_coordinator_notification',
      'fn_check_compliance_and_notify',
      'fn_generate_checkout_omission_alert'
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.%I(%s) FROM public',
      r.proname, r.args
    );
  END LOOP;

  -- ── RPCs de USUARIO → REVOKE de public + GRANT a authenticated ──────────────
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    AND p.proname IN (
      'validate_checkin_area',
      'validate_location_coherence',
      'detect_device_fingerprint_conflict',
      'get_campus_subjects',
      'get_current_user_role',
      'get_campus_active_students',
      'set_security_question',
      'accept_legal_terms',
      'complete_password_change',
      'escalate_justification',
      'decide_assignment_goal',
      'grant_assignment_override',
      'validate_assignment_gate',
      'confirm_hospital_presence_tech_failure',
      'report_student_conduct',
      'get_my_conduct_reports',
      'rate_limit_hit',
      'list_my_active_sessions',
      'revoke_my_session',
      'revoke_my_other_sessions',
      'set_active_session',
      'touch_active_session'
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.%I(%s) FROM public',
      r.proname, r.args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',
      r.proname, r.args
    );
  END LOOP;

  -- ── RPCs pre-login → accesibles también por anon ────────────────────────────
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    AND p.proname IN (
      'get_security_question',
      'verify_security_answer',
      'email_for_login'
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.%I(%s) FROM public',
      r.proname, r.args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, anon',
      r.proname, r.args
    );
  END LOOP;

END;
$$;
