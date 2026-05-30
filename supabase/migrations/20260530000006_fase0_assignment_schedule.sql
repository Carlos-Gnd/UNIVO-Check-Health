-- Fase 0 — Modelo de datos: asignación real + horario por alumno/día
-- Raíz de la que dependen: UI de asignación (Fase 1), calendario veraz (Fase 2)
-- y la ventana horaria por alumno en el check-in (Fase 3e).
--
-- Problema que resuelve: hoy la "asignación" y el "horario" se INFIEREN de la
-- última asistencia del alumno (StudentAssignmentPage.tsx, rotationsCalendar.service.ts).
-- Eso está al revés: primero se asigna y se define el horario, LUEGO se marca.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extender teacher_groups → tabla de asignación canónica
--    (ya tiene teacher_id, student_id, campus_id, period)
--    La rotación pertenece al ALUMNO, no a la sede: por eso start/end van aquí.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.teacher_groups
  ADD COLUMN IF NOT EXISTS coordinator_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS start_date     date,
  ADD COLUMN IF NOT EXISTS end_date       date;

ALTER TABLE public.teacher_groups
  DROP CONSTRAINT IF EXISTS teacher_groups_dates_check;
ALTER TABLE public.teacher_groups
  ADD CONSTRAINT teacher_groups_dates_check
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);

CREATE INDEX IF NOT EXISTS idx_teacher_groups_coordinator
  ON public.teacher_groups (coordinator_id, period);
CREATE INDEX IF NOT EXISTS idx_teacher_groups_campus
  ON public.teacher_groups (campus_id, period);

-- El coordinador también debe poder leer las asignaciones donde figura como tal.
-- (la política coordinators_manage_groups ya cubre ADMIN/COORDINATOR vía rol;
--  esta cubre a un usuario asignado como coordinator_id aunque su rol cambie.)
DROP POLICY IF EXISTS "coordinator_reads_own_assignments" ON public.teacher_groups;
CREATE POLICY "coordinator_reads_own_assignments" ON public.teacher_groups
  FOR SELECT TO authenticated
  USING (coordinator_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. student_schedules → horario por alumno/día
--    Cuelga de una asignación (teacher_groups). Permite "Juan: lunes 7-15,
--    martes 9-17". weekday usa ISO: 1=lunes … 7=domingo (EXTRACT(ISODOW)).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_schedules (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid    NOT NULL REFERENCES public.teacher_groups(id) ON DELETE CASCADE,
  weekday       smallint NOT NULL,
  check_in_from time    NOT NULL,
  check_in_to   time    NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_schedules_weekday_check CHECK (weekday BETWEEN 1 AND 7),
  CONSTRAINT student_schedules_time_check    CHECK (check_in_to > check_in_from),
  CONSTRAINT student_schedules_unique        UNIQUE (assignment_id, weekday)
);

CREATE INDEX IF NOT EXISTS idx_student_schedules_assignment
  ON public.student_schedules (assignment_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS de student_schedules
--    get_current_user_role() es SECURITY DEFINER STABLE → sin recursión.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.student_schedules ENABLE ROW LEVEL SECURITY;

-- El alumno ve solo el horario de sus propias asignaciones
DROP POLICY IF EXISTS "student_reads_own_schedule" ON public.student_schedules;
CREATE POLICY "student_reads_own_schedule" ON public.student_schedules
  FOR SELECT TO authenticated
  USING (
    assignment_id IN (
      SELECT id FROM public.teacher_groups WHERE student_id = auth.uid()
    )
  );

-- El docente ve el horario de los alumnos de su grupo
DROP POLICY IF EXISTS "teacher_reads_group_schedule" ON public.student_schedules;
CREATE POLICY "teacher_reads_group_schedule" ON public.student_schedules
  FOR SELECT TO authenticated
  USING (
    assignment_id IN (
      SELECT id FROM public.teacher_groups WHERE teacher_id = auth.uid()
    )
  );

-- Coordinadores/Admin gestionan todos los horarios (la UI de Fase 1 los crea)
DROP POLICY IF EXISTS "coordinators_manage_schedules" ON public.student_schedules;
CREATE POLICY "coordinators_manage_schedules" ON public.student_schedules
  FOR ALL TO authenticated
  USING (upper(public.get_current_user_role()) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR'))
  WITH CHECK (upper(public.get_current_user_role()) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR'));

DROP POLICY IF EXISTS "service_role_student_schedules" ON public.student_schedules;
CREATE POLICY "service_role_student_schedules" ON public.student_schedules
  FOR ALL USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Vista de conveniencia: asignación activa + sede del alumno autenticado
--    Reemplaza la inferencia desde attendances en StudentAssignmentPage (Fase 2).
-- ─────────────────────────────────────────────────────────────────────────────
-- security_invoker = true → el RLS de teacher_groups se evalúa contra quien
-- consulta (no contra el dueño de la vista). Sin esto, un alumno vería TODAS
-- las asignaciones. Requiere Postgres 15+ (Supabase corre PG17).
CREATE OR REPLACE VIEW public.v_student_assignment
WITH (security_invoker = true) AS
SELECT
  tg.id            AS assignment_id,
  tg.student_id,
  tg.teacher_id,
  tg.coordinator_id,
  tg.campus_id,
  tg.period,
  tg.start_date,
  tg.end_date,
  c.name           AS campus_name,
  c.location_label,
  c.supervisor_name,
  c.supervisor_phone,
  c.check_in_from  AS campus_check_in_from,
  c.check_in_to    AS campus_check_in_to,
  c.latitude,
  c.longitude,
  c.is_active      AS campus_is_active,
  teacher.full_name AS teacher_name,
  coord.full_name   AS coordinator_name
FROM public.teacher_groups tg
LEFT JOIN public.campuses    c       ON c.id = tg.campus_id
LEFT JOIN public.users       teacher ON teacher.id = tg.teacher_id
LEFT JOIN public.users       coord   ON coord.id = tg.coordinator_id;

GRANT SELECT ON public.v_student_assignment TO authenticated;
