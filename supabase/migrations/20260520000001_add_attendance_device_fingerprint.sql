-- T-10.1: store a stable device fingerprint on check-in.

alter table if exists public.attendances
  add column if not exists device_fingerprint text;

create index if not exists idx_public_attendances_device_fingerprint
  on public.attendances (device_fingerprint)
  where device_fingerprint is not null;

-- Schema local app.* (entorno de desarrollo). En la nube `app` NO existe, así que
-- estas sentencias deben ejecutarse SOLO si el schema está presente: el CREATE INDEX
-- sobre app.attendances no tiene guardia propia y abortaba toda la migración en la nube.
do $do$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'app') then
    alter table if exists app.attendances
      add column if not exists device_fingerprint text;
    create index if not exists idx_app_attendances_device_fingerprint
      on app.attendances (device_fingerprint)
      where device_fingerprint is not null;
  end if;
end
$do$;
