-- #18 — Decisión del docente sobre la META del ciclo del alumno (aprobó/reprobó).
-- Complementa al cierre automático por horas (close_due_cycles, que marca
-- COMPLETED/INCOMPLETE según horas auditadas): aquí el docente confirma de forma
-- explícita si el alumno APROBÓ o REPROBÓ la meta de la práctica.

ALTER TABLE public.teacher_groups
  ADD COLUMN IF NOT EXISTS goal_decision      text,   -- 'APROBADO' | 'REPROBADO'
  ADD COLUMN IF NOT EXISTS goal_decided_by    uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS goal_decided_at    timestamptz,
  ADD COLUMN IF NOT EXISTS goal_decision_note text;

CREATE OR REPLACE FUNCTION public.decide_assignment_goal(
  p_assignment_id uuid,
  p_decision      text,
  p_note          text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor    uuid := auth.uid();
  v_role     text := upper(coalesce(public.get_current_user_role(), ''));
  v_assign   record;
  v_decision text := upper(trim(coalesce(p_decision, '')));
BEGIN
  IF v_decision NOT IN ('APROBADO', 'REPROBADO') THEN
    RAISE EXCEPTION 'Decisión inválida (usa APROBADO o REPROBADO).';
  END IF;

  SELECT id, teacher_id, student_id INTO v_assign
  FROM public.teacher_groups WHERE id = p_assignment_id;
  IF v_assign.id IS NULL THEN
    RAISE EXCEPTION 'Asignación no encontrada.';
  END IF;

  -- Solo el docente de la asignación, un coordinador o el admin pueden decidir.
  IF NOT (v_assign.teacher_id = v_actor OR v_role IN ('ADMIN', 'COORDINATOR', 'COORDINADOR')) THEN
    RAISE EXCEPTION 'No autorizado para decidir la meta de esta asignación.';
  END IF;

  UPDATE public.teacher_groups
     SET goal_decision      = v_decision,
         goal_decided_by    = v_actor,
         goal_decided_at    = now(),
         goal_decision_note = nullif(trim(coalesce(p_note, '')), '')
   WHERE id = p_assignment_id;

  INSERT INTO public.audit_log (action, actor_user_id, target_user_id, details)
  VALUES ('GOAL_DECISION', v_actor, v_assign.student_id,
          jsonb_build_object(
            'assignment_id', p_assignment_id,
            'decision',      v_decision,
            'note',          nullif(trim(coalesce(p_note, '')), '')));
END;
$$;

GRANT EXECUTE ON FUNCTION public.decide_assignment_goal(uuid, text, text) TO authenticated;
