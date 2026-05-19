-- T-08b.2: validate check-in against each campus time window.
-- NULL window values keep the previous behavior: only geofence validation applies.

alter table if exists public.campuses
  add column if not exists check_in_from time,
  add column if not exists check_in_to time;

alter table if exists app.campuses
  add column if not exists check_in_from time,
  add column if not exists check_in_to time;

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
  v_current_time time := (now() at time zone 'America/El_Salvador')::time;
  v_inside_radius boolean;
  v_inside_window boolean;
begin
  select * into v_campus from public.campuses where id = p_campus_id;
  if v_campus.id is null then
    raise exception 'Campus not found: %', p_campus_id;
  end if;

  v_distance := public.haversine_meters(p_current_lat, p_current_lng, v_campus.latitude, v_campus.longitude);
  v_inside_radius := v_distance <= v_campus.radius_meters;
  v_inside_window :=
    v_campus.check_in_from is null
    or v_campus.check_in_to is null
    or (
      case
        when v_campus.check_in_from <= v_campus.check_in_to then
          v_current_time between v_campus.check_in_from and v_campus.check_in_to
        else
          v_current_time >= v_campus.check_in_from or v_current_time <= v_campus.check_in_to
      end
    );

  return query
  select
    v_inside_radius and v_inside_window,
    case
      when not v_inside_window then 'Fuera de horario'
      when v_inside_radius then 'Ubicacion validada.'
      else format('Fuera del area por %.0f metros.', (v_distance - v_campus.radius_meters)::numeric)
    end,
    round(v_distance, 2),
    v_campus.radius_meters;
end;
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
  v_current_time time := (now() at time zone 'America/El_Salvador')::time;
  v_inside_radius boolean;
  v_inside_window boolean;
begin
  select * into v_campus from app.campuses where id = p_campus_id;
  if v_campus.id is null then
    raise exception 'Campus not found';
  end if;

  v_distance := app.haversine_meters(p_current_lat, p_current_lng, v_campus.latitude, v_campus.longitude);
  v_inside_radius := v_distance <= v_campus.radius_meters;
  v_inside_window :=
    v_campus.check_in_from is null
    or v_campus.check_in_to is null
    or (
      case
        when v_campus.check_in_from <= v_campus.check_in_to then
          v_current_time between v_campus.check_in_from and v_campus.check_in_to
        else
          v_current_time >= v_campus.check_in_from or v_current_time <= v_campus.check_in_to
      end
    );

  return query
  select
    v_inside_radius and v_inside_window,
    case
      when not v_inside_window then 'Fuera de horario'
      when v_inside_radius then 'Location validated for check-in.'
      else format('Out of campus range by %.2f meters.', (v_distance - v_campus.radius_meters)::numeric)
    end,
    round(v_distance, 2),
    v_campus.radius_meters;
end;
$$;
