-- Fix P0-1: public.detect_device_fingerprint_conflict FALTABA en la nube.
-- Vivía en 20260520000002 junto a un `create function app.*` SIN guardia de schema;
-- como en la nube `app` no existe, esa migración abortaba antes de... no: el orden hacía
-- que la creación pública tampoco quedara. Resultado: la detección de "mismo dispositivo
-- activo en dos sedes" (HU-10 / SHARED_DEVICE_ACTIVE_CONFLICT) estaba ROTA en silencio
-- — el edge function validate-qr-checkin llama esta RPC, atrapa el error y deja pasar el
-- check-in como si no hubiera conflicto.
--
-- Esta migración recrea la función SOLO en public, idempotente y sin tocar app.*.

create or replace function public.detect_device_fingerprint_conflict(
  p_device_fingerprint text,
  p_campus_id uuid,
  p_student_id uuid
)
returns table(
  attendance_id uuid,
  student_id uuid,
  campus_id uuid,
  check_in timestamptz
)
language sql
stable
as $$
  select a.id, a.student_id, a.campus_id, a.check_in
  from public.attendances a
  where a.device_fingerprint = p_device_fingerprint
    and a.check_out is null
    and a.campus_id <> p_campus_id
    and a.student_id <> p_student_id
  order by a.check_in desc
  limit 1
$$;

grant execute on function public.detect_device_fingerprint_conflict(text, uuid, uuid) to authenticated, service_role;
