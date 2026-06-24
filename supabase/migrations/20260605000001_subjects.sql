-- S4-02.1 — Modelo académico: tabla subjects (materias / asignaturas)
-- Hoy no existe el concepto de materia. La carga horaria se infería global
-- (REQUIRED_PRACTICE_HOURS 240/480, fuente de inconsistencias). Pasa a vivir
-- por materia: subjects.required_hours. Cada materia declara además el nivel
-- académico mínimo para cursarla (S4-03). Reference data: la lee todo usuario
-- autenticado; solo ADMIN/COORDINATOR la gestiona.

CREATE TABLE IF NOT EXISTS public.subjects (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code               text        NOT NULL UNIQUE,
  name               text        NOT NULL,
  career             text,
  required_hours     integer     NOT NULL DEFAULT 240,
  min_academic_level smallint,
  is_active          boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subjects_required_hours_check CHECK (required_hours > 0),
  CONSTRAINT subjects_min_level_check      CHECK (min_academic_level IS NULL OR min_academic_level >= 0)
);

CREATE INDEX IF NOT EXISTS idx_subjects_career ON public.subjects (career);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: get_current_user_role() es SECURITY DEFINER STABLE → sin recursión.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- Todo usuario autenticado puede leer el catálogo de materias (el alumno elige
-- materia al marcar; la UI de asignación las lista).
DROP POLICY IF EXISTS "authenticated_reads_subjects" ON public.subjects;
CREATE POLICY "authenticated_reads_subjects" ON public.subjects
  FOR SELECT TO authenticated
  USING (true);

-- Solo ADMIN/COORDINATOR crean/editan materias.
DROP POLICY IF EXISTS "coordinators_manage_subjects" ON public.subjects;
CREATE POLICY "coordinators_manage_subjects" ON public.subjects
  FOR ALL TO authenticated
  USING (upper(public.get_current_user_role()) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR'))
  WITH CHECK (upper(public.get_current_user_role()) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR'));

DROP POLICY IF EXISTS "service_role_subjects" ON public.subjects;
CREATE POLICY "service_role_subjects" ON public.subjects
  FOR ALL USING (auth.role() = 'service_role');
