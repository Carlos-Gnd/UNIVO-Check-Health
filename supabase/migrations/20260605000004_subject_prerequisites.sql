-- S4-03.2 — Prerrequisitos entre materias
-- Una materia puede exigir haber cursado otras antes (además del nivel académico
-- mínimo, que ya vive en subjects.min_academic_level). El gate de asignación
-- (S4-03.3, Nelson) consulta esta tabla; aquí solo se modela.

CREATE TABLE IF NOT EXISTS public.subject_prerequisites (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id          uuid        NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  requires_subject_id uuid        NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subject_prereq_unique  UNIQUE (subject_id, requires_subject_id),
  CONSTRAINT subject_prereq_no_self CHECK (subject_id <> requires_subject_id)
);

CREATE INDEX IF NOT EXISTS idx_subject_prereq_subject
  ON public.subject_prerequisites (subject_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: catálogo de referencia (lectura para todos), gestión ADMIN/COORDINATOR.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.subject_prerequisites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_reads_prereqs" ON public.subject_prerequisites;
CREATE POLICY "authenticated_reads_prereqs" ON public.subject_prerequisites
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "coordinators_manage_prereqs" ON public.subject_prerequisites;
CREATE POLICY "coordinators_manage_prereqs" ON public.subject_prerequisites
  FOR ALL TO authenticated
  USING (upper(public.get_current_user_role()) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR'))
  WITH CHECK (upper(public.get_current_user_role()) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR'));

DROP POLICY IF EXISTS "service_role_prereqs" ON public.subject_prerequisites;
CREATE POLICY "service_role_prereqs" ON public.subject_prerequisites
  FOR ALL USING (auth.role() = 'service_role');
