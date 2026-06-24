-- #19 — Solicitud de credenciales desde el login.
-- Un aspirante que no fue registrado puede solicitar acceso; un docente o el decano
-- aprueba (lo que crea su usuario y envía credenciales) o rechaza la solicitud.

CREATE TABLE IF NOT EXISTS public.access_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name      text NOT NULL,
  student_code   text NOT NULL,
  email          text,
  career         text,
  requested_role text NOT NULL DEFAULT 'STUDENT',
  reason         text,
  status         text NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  decided_by     uuid REFERENCES public.users(id),
  decided_at     timestamptz,
  decision_note  text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_requests_status ON public.access_requests (status, created_at);

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Cualquiera (incluso sin sesión) puede CREAR una solicitud desde el login.
DROP POLICY IF EXISTS "anyone_insert_access_request" ON public.access_requests;
CREATE POLICY "anyone_insert_access_request" ON public.access_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending');

-- Solo el personal (docente/coordinador/decano) puede leer y resolver solicitudes.
DROP POLICY IF EXISTS "staff_read_access_requests" ON public.access_requests;
CREATE POLICY "staff_read_access_requests" ON public.access_requests
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND upper(u.role) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE')
  ));

DROP POLICY IF EXISTS "staff_update_access_requests" ON public.access_requests;
CREATE POLICY "staff_update_access_requests" ON public.access_requests
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND upper(u.role) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE')
  ));
