-- T-10.1: store a stable device fingerprint on check-in.

alter table if exists public.attendances
  add column if not exists device_fingerprint text;

alter table if exists app.attendances
  add column if not exists device_fingerprint text;

create index if not exists idx_public_attendances_device_fingerprint
  on public.attendances (device_fingerprint)
  where device_fingerprint is not null;

create index if not exists idx_app_attendances_device_fingerprint
  on app.attendances (device_fingerprint)
  where device_fingerprint is not null;
