-- S4-03.4 - Override del decano sobre el gate de prerrequisitos/nivel academico.
-- El gate de S4-03.3 bloquea (UI + trigger) cuando el alumno no cumple. El decano
-- (ADMIN) puede forzar la asignacion con una justificacion obligatoria que queda
-- en audit_log. El override se materializa como una concesion explicita por
-- (alumno, materia) que el trigger consulta para permitir la insercion/edicion.

CREATE TABLE IF NOT EXISTS public.assignment_gate_overrides (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid        NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  subject_id  uuid        NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  granted_by  uuid        REFERENCES public.users(id),
  reason      text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assignment_gate_override_unique UNIQUE (student_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_gate_override_student_subject
  ON public.assignment_gate_overrides (student_id, subject_id);

ALTER TABLE public.assignment_gate_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_reads_overrides" ON public.assignment_gate_overrides;
CREATE POLICY "admin_reads_overrides" ON public.assignment_gate_overrides
  FOR SELECT TO authenticated
  USING (upper(public.get_current_user_role()) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR'));

DROP POLICY IF EXISTS "service_role_overrides" ON public.assignment_gate_overrides;
CREATE POLICY "service_role_overrides" ON public.assignment_gate_overrides
  FOR ALL USING (auth.role() = 'service_role');

-- RPC: el decano concede el override. Solo ADMIN; justificacion obligatoria.
CREATE OR REPLACE FUNCTION public.grant_assignment_override(
  p_student_id uuid,
  p_subject_id uuid,
  p_reason     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role  text := upper(coalesce(public.get_current_user_role(), ''));
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
BEGIN
  IF v_role <> 'ADMIN' THEN
    RAISE EXCEPTION 'Solo el decano puede forzar una asignacion.';
  END IF;
  IF p_student_id IS NULL OR p_subject_id IS NULL THEN
    RAISE EXCEPTION 'Alumno y materia son obligatorios.';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'La justificacion del override es obligatoria.';
  END IF;

  INSERT INTO public.assignment_gate_overrides (student_id, subject_id, granted_by, reason)
  VALUES (p_student_id, p_subject_id, v_actor, v_reason)
  ON CONFLICT (student_id, subject_id)
  DO UPDATE SET granted_by = excluded.granted_by,
               reason      = excluded.reason,
               created_at  = now();

  INSERT INTO public.audit_log (action, actor_user_id, target_user_id, details)
  VALUES (
    'PREREQ_OVERRIDE',
    v_actor,
    p_student_id,
    jsonb_build_object(
      'subject_id', p_subject_id,
      'reason', v_reason,
      'source', 'grant_assignment_override'
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_assignment_override(uuid, uuid, text) TO authenticated;

-- El gate (S4-03.3) ahora respeta un override vigente para (alumno, materia).
CREATE OR REPLACE FUNCTION public.enforce_assignment_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gate record;
BEGIN
  -- Service role se usa para seeds/backfills y no representa una accion manual.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.student_id IS NOT DISTINCT FROM OLD.student_id
     AND NEW.subject_id IS NOT DISTINCT FROM OLD.subject_id THEN
    RETURN NEW;
  END IF;

  -- Override del decano: si existe una concesion para (alumno, materia), se permite.
  IF NEW.subject_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.assignment_gate_overrides o
    WHERE o.student_id = NEW.student_id
      AND o.subject_id = NEW.subject_id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT *
    INTO v_gate
  FROM public.validate_assignment_gate(NEW.student_id, NEW.subject_id)
  LIMIT 1;

  IF NOT COALESCE(v_gate.ok, false) THEN
    RAISE EXCEPTION '%', COALESCE(v_gate.message, 'El alumno no cumple los requisitos de la materia.');
  END IF;

  RETURN NEW;
END;
$$;
