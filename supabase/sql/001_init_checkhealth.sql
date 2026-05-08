create extension if not exists pgcrypto;

create schema if not exists app;

create table if not exists app.system_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into app.system_config (key, value)
values ('allowed_email_domain', 'univo.edu.sv')
on conflict (key) do nothing;

create type app.user_role as enum ('STUDENT', 'DOCENTE', 'COORDINADOR', 'REPRESENTANTE_SEDE', 'ADMIN');

create table if not exists app.users (
  id uuid primary key default gen_random_uuid(),
  student_code varchar(9) not null unique,
  full_name text,
  email text not null unique,
  role app.user_role not null default 'STUDENT',
  created_at timestamptz not null default now()
);

create table if not exists app.campuses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  radius_meters integer not null default 100,
  representative_name text,
  representative_phone text,
  created_by uuid references app.users(id),
  created_at timestamptz not null default now(),
  constraint campuses_lat_check check (latitude between -90 and 90),
  constraint campuses_lng_check check (longitude between -180 and 180),
  constraint campuses_radius_check check (radius_meters between 20 and 1000)
);

create table if not exists app.audit_log (
  id bigserial primary key,
  action text not null,
  actor_user_id uuid not null references app.users(id),
  target_user_id uuid references app.users(id),
  event_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);

create or replace function app.block_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only; updates/deletes are not allowed';
end;
$$;

drop trigger if exists trg_block_audit_update on app.audit_log;
create trigger trg_block_audit_update
before update on app.audit_log
for each row execute function app.block_audit_mutation();

drop trigger if exists trg_block_audit_delete on app.audit_log;
create trigger trg_block_audit_delete
before delete on app.audit_log
for each row execute function app.block_audit_mutation();

create or replace function app.allowed_email_domain()
returns text
language sql
stable
as $$
  select value from app.system_config where key = 'allowed_email_domain'
$$;

create or replace function app.register_univo_user(p_email text, p_full_name text default null)
returns app.users
language plpgsql
as $$
declare
  v_domain text := app.allowed_email_domain();
  v_code varchar(9);
  v_user app.users;
begin
  if split_part(lower(trim(p_email)), '@', 2) <> lower(v_domain) then
    raise exception 'Only @% emails are allowed', v_domain;
  end if;

  v_code := upper(left(split_part(trim(p_email), '@', 1), 9));
  if length(v_code) <> 9 then
    raise exception 'Student code must be 9 characters (got %)', v_code;
  end if;

  if exists (select 1 from app.users u where u.student_code = v_code) then
    raise exception 'Student code % already exists', v_code;
  end if;

  insert into app.users (student_code, full_name, email, role)
  values (v_code, p_full_name, lower(trim(p_email)), 'STUDENT')
  returning * into v_user;

  return v_user;
end;
$$;

create or replace function app.log_forced_session_close(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_reason text default null
)
returns app.audit_log
language plpgsql
as $$
declare
  v_actor_role app.user_role;
  v_log app.audit_log;
begin
  select role into v_actor_role from app.users where id = p_actor_user_id;
  if v_actor_role is null then
    raise exception 'Actor user does not exist';
  end if;

  if v_actor_role not in ('COORDINADOR', 'ADMIN') then
    raise exception 'Only COORDINADOR or ADMIN can revoke sessions';
  end if;

  insert into app.audit_log (action, actor_user_id, target_user_id, details)
  values (
    'FORCED_SESSION_CLOSE',
    p_actor_user_id,
    p_target_user_id,
    jsonb_build_object('reason', coalesce(p_reason, 'security incident'))
  )
  returning * into v_log;

  return v_log;
end;
$$;

create or replace function app.haversine_meters(
  p_lat1 numeric,
  p_lng1 numeric,
  p_lat2 numeric,
  p_lng2 numeric
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

create or replace function app.validate_checkin_area(
  p_campus_id uuid,
  p_current_lat numeric,
  p_current_lng numeric
)
returns table(is_allowed boolean, message text, distance_meters numeric, radius_meters integer)
language plpgsql
as $$
declare
  v_campus app.campuses;
  v_distance numeric;
begin
  select * into v_campus from app.campuses where id = p_campus_id;
  if v_campus.id is null then
    raise exception 'Campus not found';
  end if;

  v_distance := app.haversine_meters(p_current_lat, p_current_lng, v_campus.latitude, v_campus.longitude);
  return query
  select
    v_distance <= v_campus.radius_meters,
    case
      when v_distance <= v_campus.radius_meters then 'Location validated for check-in.'
      else format('Out of campus range by %.2f meters.', (v_distance - v_campus.radius_meters)::numeric)
    end,
    round(v_distance, 2),
    v_campus.radius_meters;
end;
$$;

create or replace function app.create_campus_as_coordinator(
  p_actor_user_id uuid,
  p_name text,
  p_latitude numeric,
  p_longitude numeric,
  p_radius_meters integer default 100,
  p_representative_name text default null,
  p_representative_phone text default null
)
returns app.campuses
language plpgsql
as $$
declare
  v_actor_role app.user_role;
  v_campus app.campuses;
begin
  if p_latitude not between -90 and 90 then
    raise exception 'Latitude must be between -90 and 90';
  end if;
  if p_longitude not between -180 and 180 then
    raise exception 'Longitude must be between -180 and 180';
  end if;

  select role into v_actor_role from app.users where id = p_actor_user_id;
  if v_actor_role <> 'COORDINADOR' then
    raise exception 'Only COORDINADOR can create campuses';
  end if;

  insert into app.campuses (
    name, latitude, longitude, radius_meters,
    representative_name, representative_phone, created_by
  )
  values (
    trim(p_name), p_latitude, p_longitude, p_radius_meters,
    p_representative_name, p_representative_phone, p_actor_user_id
  )
  returning * into v_campus;

  return v_campus;
end;
$$;
