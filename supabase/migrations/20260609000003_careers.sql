-- B6: catálogo de carreras configurable. Antes las carreras estaban hardcodeadas
-- en el frontend (UserManagement) y el nivel académico se limitaba a 1..10, lo que
-- no alcanza para carreras largas como Medicina. Ahora cada carrera declara su
-- número de ciclos y el selector de nivel se adapta a ella.

CREATE TABLE IF NOT EXISTS public.careers (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL UNIQUE,
  total_cycles smallint    NOT NULL DEFAULT 10,
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT careers_total_cycles_check CHECK (total_cycles BETWEEN 1 AND 20)
);

ALTER TABLE public.careers ENABLE ROW LEVEL SECURITY;

-- Todo usuario autenticado puede leer el catálogo de carreras.
DROP POLICY IF EXISTS "authenticated_reads_careers" ON public.careers;
CREATE POLICY "authenticated_reads_careers" ON public.careers
  FOR SELECT TO authenticated
  USING (true);

-- Solo ADMIN/COORDINATOR gestionan carreras.
DROP POLICY IF EXISTS "coordinators_manage_careers" ON public.careers;
CREATE POLICY "coordinators_manage_careers" ON public.careers
  FOR ALL TO authenticated
  USING (upper(public.get_current_user_role()) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR'))
  WITH CHECK (upper(public.get_current_user_role()) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR'));

DROP POLICY IF EXISTS "service_role_careers" ON public.careers;
CREATE POLICY "service_role_careers" ON public.careers
  FOR ALL USING (auth.role() = 'service_role');

-- Semilla con las carreras que estaban hardcodeadas (Medicina con ciclos extendidos).
INSERT INTO public.careers (name, total_cycles) VALUES
  ('Medicina', 16),
  ('Enfermería', 10),
  ('Fisioterapia', 10),
  ('Radiología', 8),
  ('Laboratorio Clínico', 8),
  ('Nutrición', 10)
ON CONFLICT (name) DO NOTHING;
