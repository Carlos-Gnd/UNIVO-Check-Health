-- R-02 / R-03 — Recomendaciones de producto.
-- R-02: cupo máximo de estudiantes por sede (evita sobre-asignar la capacidad).
-- R-03: calendario de feriados / días no hábiles (para que ausencias y countdown
--       no marquen falta en días sin práctica).

-- ─────────────────────────────────────────────────────────────────────────────
-- R-02 — Cupo por sede + enforcement en la asignación.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.campuses
  ADD COLUMN IF NOT EXISTS max_students integer CHECK (max_students IS NULL OR max_students > 0);

CREATE OR REPLACE FUNCTION public.enforce_campus_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max     integer;
  v_current integer;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;  -- seeds/backfills no cuentan como acción manual
  END IF;
  IF NEW.campus_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT max_students INTO v_max FROM public.campuses WHERE id = NEW.campus_id;
  IF v_max IS NULL THEN
    RETURN NEW;  -- sin cupo definido = sin límite
  END IF;

  -- Estudiantes distintos ya asignados a la sede en el mismo período (ciclo abierto).
  SELECT count(DISTINCT student_id) INTO v_current
  FROM public.teacher_groups
  WHERE campus_id = NEW.campus_id
    AND period = NEW.period
    AND closed_at IS NULL
    AND student_id <> NEW.student_id
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_current >= v_max THEN
    RAISE EXCEPTION 'La sede alcanzó su cupo máximo de % estudiantes para el período %.', v_max, NEW.period;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_campus_capacity ON public.teacher_groups;
CREATE TRIGGER trg_enforce_campus_capacity
BEFORE INSERT OR UPDATE OF campus_id, student_id, period ON public.teacher_groups
FOR EACH ROW
EXECUTE FUNCTION public.enforce_campus_capacity();

-- ─────────────────────────────────────────────────────────────────────────────
-- R-03 — Feriados / días no hábiles.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.holidays (
  holiday_date date        PRIMARY KEY,
  name         text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_reads_holidays" ON public.holidays;
CREATE POLICY "authenticated_reads_holidays" ON public.holidays
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "coordinators_manage_holidays" ON public.holidays;
CREATE POLICY "coordinators_manage_holidays" ON public.holidays
  FOR ALL TO authenticated
  USING (upper(public.get_current_user_role()) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR'))
  WITH CHECK (upper(public.get_current_user_role()) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR'));

DROP POLICY IF EXISTS "service_role_holidays" ON public.holidays;
CREATE POLICY "service_role_holidays" ON public.holidays
  FOR ALL USING (auth.role() = 'service_role');
