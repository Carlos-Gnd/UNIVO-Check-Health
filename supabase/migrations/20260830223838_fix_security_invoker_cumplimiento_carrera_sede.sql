-- H-3 (INFORME_REVISION_CheckHealth.md, 2026-08-27): v_cumplimiento_carrera_sede
-- (creada en 20260521000002_sprint2_carlos.sql, T-19.1) no tenía security_invoker,
-- así que en Postgres corre con los privilegios de su creador y hace bypass de la
-- RLS de users/attendances/campuses: cualquier authenticated (incluido un alumno)
-- podía leer cumplimiento agregado de todas las carreras/sedes vía la Data API.
--
-- Confirmado que hoy no la usa nada del frontend (grep sin resultados en src/) —
-- probablemente quedó huérfana desde Sprint 2. Se endurece con las dos medidas:
-- security_invoker (que la vista respete la RLS de las tablas base) + REVOKE
-- explícito (nadie del cliente puede leerla mientras no la use ninguna pantalla).
-- Si en el futuro se vuelve a usar desde el panel de decano, otorgar SELECT
-- puntualmente a los roles que corresponda en vez de dejarla abierta a todos.

ALTER VIEW public.v_cumplimiento_carrera_sede SET (security_invoker = true);

REVOKE ALL ON public.v_cumplimiento_carrera_sede FROM anon, authenticated;
