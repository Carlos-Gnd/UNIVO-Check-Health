-- T-26.1: tabla weekly_evaluations (evaluación cualitativa semanal del docente)
-- 4 dimensiones en escala 1-5: actitud, puntualidad, desempeño técnico, trabajo en equipo.

CREATE TABLE IF NOT EXISTS public.weekly_evaluations (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id        uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_id        uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_start        date        NOT NULL,
  actitud           int         NOT NULL CHECK (actitud BETWEEN 1 AND 5),
  puntualidad       int         NOT NULL CHECK (puntualidad BETWEEN 1 AND 5),
  desempeno_tecnico int         NOT NULL CHECK (desempeno_tecnico BETWEEN 1 AND 5),
  trabajo_equipo    int         NOT NULL CHECK (trabajo_equipo BETWEEN 1 AND 5),
  comentario        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  actualizado_en    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_eval_unique UNIQUE (teacher_id, student_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_eval_student ON public.weekly_evaluations (student_id, week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_eval_teacher ON public.weekly_evaluations (teacher_id, week_start);

ALTER TABLE public.weekly_evaluations ENABLE ROW LEVEL SECURITY;

-- El docente crea/edita/lee las evaluaciones que él hizo
DROP POLICY IF EXISTS "teacher_manages_own_evals" ON public.weekly_evaluations;
CREATE POLICY "teacher_manages_own_evals" ON public.weekly_evaluations
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- El estudiante puede leer sus propias evaluaciones
DROP POLICY IF EXISTS "student_reads_own_evals" ON public.weekly_evaluations;
CREATE POLICY "student_reads_own_evals" ON public.weekly_evaluations
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

-- Coordinadores/Admin leen todas
DROP POLICY IF EXISTS "coordinators_read_evals" ON public.weekly_evaluations;
CREATE POLICY "coordinators_read_evals" ON public.weekly_evaluations
  FOR SELECT TO authenticated
  USING (upper(public.get_current_user_role()) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR'));

DROP POLICY IF EXISTS "service_role_evals" ON public.weekly_evaluations;
CREATE POLICY "service_role_evals" ON public.weekly_evaluations
  FOR ALL USING (auth.role() = 'service_role');

-- Trigger de actualizado_en (reusa fn_set_actualizado_en si existe; si no, la crea)
CREATE OR REPLACE FUNCTION public.fn_set_actualizado_en()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_weekly_eval_actualizado ON public.weekly_evaluations;
CREATE TRIGGER trg_weekly_eval_actualizado
  BEFORE UPDATE ON public.weekly_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_actualizado_en();
