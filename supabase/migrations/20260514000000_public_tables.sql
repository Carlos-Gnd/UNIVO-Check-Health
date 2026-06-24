-- Tablas en schema public para compatibilidad con PostgREST de Supabase Cloud.
-- Reemplaza las tablas del schema app (solo para local con CLI).

-- Config del sistema
create table if not exists public.system_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.system_config (key, value)
values ('allowed_email_domain', 'univo.edu.sv')
on conflict (key) do nothing;

-- Usuarios (estudiantes, docentes, coordinadores, etc.)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  student_code varchar(9) not null unique,
  full_name text,
  email text not null unique,
  role text not null default 'STUDENT',
  career text,
  photo_url text,
  created_at timestamptz not null default now()
);

-- Sedes / Lugares de práctica clínica
create table if not exists public.campuses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  radius_meters integer not null default 100,
  location_label text,
  supervisor_name text,
  supervisor_phone text,
  schedule text,
  start_date date,
  end_date date,
  description text,
  created_at timestamptz not null default now(),
  constraint campuses_lat_check check (latitude between -90 and 90),
  constraint campuses_lng_check check (longitude between -180 and 180),
  constraint campuses_radius_check check (radius_meters between 20 and 1000)
);

-- Registros de asistencia
create table if not exists public.attendances (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users(id),
  campus_id uuid not null references public.campuses(id),
  check_in timestamptz not null default now(),
  check_out timestamptz,
  date date not null default current_date,
  status text not null default 'present',
  notes text,
  check_in_location jsonb,
  check_out_location jsonb,
  security_seal text,
  check_out_security_seal text,
  worked_hours numeric(5,2),
  review_status text not null default 'clear',
  suspicious_reason text,
  device_id text,
  device_info jsonb,
  created_at timestamptz not null default now()
);

-- Log de auditoría (solo escritura, protegido por trigger)
create table if not exists public.audit_log (
  id bigserial primary key,
  action text not null,
  actor_user_id uuid not null,
  target_user_id uuid,
  event_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);

create or replace function public.block_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only; updates/deletes are not allowed';
end;
$$;

drop trigger if exists trg_block_audit_update on public.audit_log;
create trigger trg_block_audit_update
before update on public.audit_log
for each row execute function public.block_audit_mutation();

drop trigger if exists trg_block_audit_delete on public.audit_log;
create trigger trg_block_audit_delete
before delete on public.audit_log
for each row execute function public.block_audit_mutation();

-- Distancia Haversine en metros
create or replace function public.haversine_meters(
  p_lat1 numeric, p_lng1 numeric,
  p_lat2 numeric, p_lng2 numeric
)
returns numeric
language sql
immutable
as $$
  with c as (
    select radians((p_lat2 - p_lat1)::float8) as dlat,
           radians((p_lng2 - p_lng1)::float8) as dlng,
           radians(p_lat1::float8) as lat1,
           radians(p_lat2::float8) as lat2
  )
  select 2 * 6371000 * asin(
    sqrt(
      power(sin(dlat / 2), 2) +
      cos(lat1) * cos(lat2) * power(sin(dlng / 2), 2)
    )
  )
  from c
$$;

-- Valida si la ubicación GPS está dentro del radio de una sede
create or replace function public.validate_checkin_area(
  p_campus_id uuid,
  p_current_lat numeric,
  p_current_lng numeric
)
returns table(is_allowed boolean, message text, distance_meters numeric, radius_meters integer)
language plpgsql
as $$
declare
  v_campus public.campuses;
  v_distance numeric;
begin
  select * into v_campus from public.campuses where id = p_campus_id;
  if v_campus.id is null then
    raise exception 'Campus not found: %', p_campus_id;
  end if;

  v_distance := public.haversine_meters(p_current_lat, p_current_lng, v_campus.latitude, v_campus.longitude);
  return query
  select
    v_distance <= v_campus.radius_meters,
    case
      when v_distance <= v_campus.radius_meters then 'Ubicación validada.'
      else format('Fuera del área por %.0f metros.', (v_distance - v_campus.radius_meters)::numeric)
    end,
    round(v_distance, 2),
    v_campus.radius_meters;
end;
$$;

-- Permisos para desarrollo (reemplazar con RLS en producción)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- Seed: sedes de práctica clínica
insert into public.campuses (name, latitude, longitude, radius_meters, location_label, supervisor_name, schedule, start_date, end_date, description)
values
  (
    'Hospital Nacional Rosales',
    13.7013, -89.2045, 100,
    'Hospital Nacional Rosales',
    'Dr. Roberto Martínez',
    'Lunes a Viernes, 7:00 AM - 3:00 PM',
    '2026-01-15', '2026-05-30',
    'Práctica en el área de emergencias con rotación en diferentes especialidades.'
  ),
  (
    'Unidad de Salud Santa Ana',
    13.9942, -89.5597, 100,
    'Unidad de Salud Santa Ana',
    'Lic. Carmen Vásquez',
    'Martes y Jueves, 8:00 AM - 12:00 PM',
    '2026-02-01', '2026-06-15',
    'Atención primaria en salud y programas de prevención comunitaria.'
  ),
  (
    'Centro de Rehabilitación UNIVO',
    13.4869, -88.1771, 100,
    'Centro de Rehabilitación UNIVO',
    'Lic. Manuel Gómez',
    'Lunes, Miércoles y Viernes, 2:00 PM - 6:00 PM',
    '2026-01-20', '2026-05-20',
    'Rehabilitación de lesiones deportivas y terapias especializadas.'
  )
on conflict (name) do nothing;

-- Seed: estudiantes de prueba
insert into public.users (student_code, full_name, email, role, career)
values
  ('U20240001', 'María Fernanda García',  'U20240001@univo.edu.sv',    'STUDENT', 'Enfermería'),
  ('U20240002', 'Carlos Roberto Mejía',   'U20240002@univo.edu.sv',     'STUDENT', 'Medicina'),
  ('U20240003', 'Ana Sofía Rodríguez',    'U20240003@univo.edu.sv', 'STUDENT', 'Fisioterapia'),
  ('U20240004', 'José Luis Hernández',    'U20240004@univo.edu.sv', 'STUDENT', 'Medicina'),
  ('U20240005', 'Gabriela Patricia Flores','U20240005@univo.edu.sv',   'STUDENT', 'Enfermería'),
  ('U20240006', 'Daniel Alejandro Torres','U20240006@univo.edu.sv',    'STUDENT', 'Radiología')
on conflict (student_code) do nothing;
