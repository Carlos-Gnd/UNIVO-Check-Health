-- Fix crítico del check-in: el INSERT de validate-qr-checkin fallaba con
--   ERROR 42703: column "device_fingerprint" of relation "attendances" does not exist
-- (visible solo ahora que el fix del overload #1 dejó llegar el flujo al INSERT).
--
-- Causa: 20260520000001 creaba un índice sobre `app.attendances` SIN guardia de
-- existencia de schema; en la nube `app` no existe, así que esa migración no dejó la
-- columna `device_fingerprint` en `public.attendances` (y posiblemente otras ALTER del
-- mismo patrón quedaron a medias).
--
-- Aquí se garantizan, de forma idempotente y SOLO en `public`, todas las columnas que
-- el edge function inserta en el check-in. `add column if not exists` no toca las que ya
-- existan.

ALTER TABLE public.attendances
  ADD COLUMN IF NOT EXISTS device_fingerprint text,
  ADD COLUMN IF NOT EXISTS device_info        jsonb,
  ADD COLUMN IF NOT EXISTS suspicious_reason  text,
  ADD COLUMN IF NOT EXISTS check_in_ip        text,
  ADD COLUMN IF NOT EXISTS check_in_ip_info   jsonb,
  ADD COLUMN IF NOT EXISTS check_out_ip       text,
  ADD COLUMN IF NOT EXISTS check_out_ip_info  jsonb,
  ADD COLUMN IF NOT EXISTS assignment_id      uuid REFERENCES public.teacher_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subject_id         uuid REFERENCES public.subjects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_public_attendances_device_fingerprint
  ON public.attendances (device_fingerprint)
  WHERE device_fingerprint IS NOT NULL;
