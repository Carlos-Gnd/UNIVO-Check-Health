-- T-30.1: loguear cada decisión de justificación en audit_log (inmutable).
-- T-32.1: flujo de escalamiento (coordinador re-revisa una justificación rechazada).

-- ─────────────────────────────────────────────────────────────────────────────
-- T-32.1: columnas de escalamiento
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.justifications
  ADD COLUMN IF NOT EXISTS escalated     boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalated_at  timestamptz,
  ADD COLUMN IF NOT EXISTS escalated_by  uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- T-30.1: trigger que registra cada cambio de estado en audit_log
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_log_justification_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo cuando el estado cambia (aprobado/rechazado) o se escala
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.escalated IS DISTINCT FROM OLD.escalated THEN
    INSERT INTO public.audit_log (action, actor_user_id, target_user_id, details)
    VALUES (
      CASE WHEN NEW.escalated AND NOT OLD.escalated THEN 'JUSTIFICATION_ESCALATED'
           ELSE 'JUSTIFICATION_REVIEWED' END,
      COALESCE(NEW.revisado_por, NEW.escalated_by, NEW.student_id),
      NEW.student_id,
      jsonb_build_object(
        'justification_id', NEW.id,
        'attendance_id',    NEW.attendance_id,
        'status_anterior',  OLD.status,
        'status_nuevo',     NEW.status,
        'escalated',        NEW.escalated,
        'notas_revisor',    NEW.notas_revisor
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_justification_decision ON public.justifications;
CREATE TRIGGER trg_log_justification_decision
  AFTER UPDATE ON public.justifications
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_justification_decision();

-- ─────────────────────────────────────────────────────────────────────────────
-- T-32.1: RPC de escalamiento. Solo coordinador/admin. Reabre una justificación
-- RECHAZADA: la marca escalada y la regresa a PENDIENTE para segunda revisión.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.escalate_justification(p_id uuid, p_nota text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_status text;
BEGIN
  v_role := upper(public.get_current_user_role());
  IF v_role NOT IN ('ADMIN', 'COORDINATOR', 'COORDINADOR') THEN
    RAISE EXCEPTION 'Solo un coordinador puede escalar una justificación';
  END IF;

  SELECT status INTO v_status FROM public.justifications WHERE id = p_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Justificación no encontrada';
  END IF;
  IF v_status <> 'RECHAZADO' THEN
    RAISE EXCEPTION 'Solo se pueden escalar justificaciones rechazadas';
  END IF;

  UPDATE public.justifications
  SET escalated     = true,
      escalated_at  = now(),
      escalated_by  = auth.uid(),
      status        = 'PENDIENTE',
      notas_revisor = COALESCE(p_nota, 'Escalada para segunda revisión.')
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.escalate_justification(uuid, text) TO authenticated;
