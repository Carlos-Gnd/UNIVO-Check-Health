-- B1: el horario por alumno (student_schedules) es la unica fuente de verdad para
-- la ventana horaria de check-in. Antes habia DOS ventanas validandose a la vez:
--   1) la de la SEDE (campuses.check_in_from/to) dentro de validate_checkin_area, y
--   2) la del ALUMNO (student_schedules) dentro de la Edge Function validate-qr-checkin.
-- La de sede aplicaba igual a todos y chocaba con horarios individuales: un alumno
-- de las 8am y otro de las 2pm no podian compartir sede. Aqui validate_checkin_area
-- pasa a validar SOLO geofence; las columnas check_in_from/to de la sede quedan como
-- dato informativo (no rechazan). La franja por alumno (incl. turnos nocturnos que
-- cruzan medianoche) se valida en la Edge Function.

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
  v_inside_radius boolean;
begin
  select * into v_campus from public.campuses where id = p_campus_id;
  if v_campus.id is null then
    raise exception 'Campus not found: %', p_campus_id;
  end if;

  v_distance := public.haversine_meters(p_current_lat, p_current_lng, v_campus.latitude, v_campus.longitude);
  v_inside_radius := v_distance <= v_campus.radius_meters;

  return query
  select
    v_inside_radius,
    case
      when v_inside_radius then 'Ubicacion validada.'
      else format('Fuera del area por %.0f metros.', (v_distance - v_campus.radius_meters)::numeric)
    end,
    round(v_distance, 2),
    v_campus.radius_meters;
end;
$$;

-- Mismo cambio para el schema local app.* (entorno de desarrollo con supabase start).
-- En la base remota el schema `app` NO existe, así que solo se crea la función si
-- el schema está presente (evita "schema app does not exist" al hacer db push).
do $do$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'app') then
    execute $appfn$
      create or replace function app.validate_checkin_area(
        p_campus_id uuid,
        p_current_lat numeric,
        p_current_lng numeric
      )
      returns table(is_allowed boolean, message text, distance_meters numeric, radius_meters integer)
      language plpgsql
      as $body$
      declare
        v_campus app.campuses;
        v_distance numeric;
        v_inside_radius boolean;
      begin
        select * into v_campus from app.campuses where id = p_campus_id;
        if v_campus.id is null then
          raise exception 'Campus not found';
        end if;

        v_distance := app.haversine_meters(p_current_lat, p_current_lng, v_campus.latitude, v_campus.longitude);
        v_inside_radius := v_distance <= v_campus.radius_meters;

        return query
        select
          v_inside_radius,
          case
            when v_inside_radius then 'Location validated for check-in.'
            else format('Out of campus range by %.2f meters.', (v_distance - v_campus.radius_meters)::numeric)
          end,
          round(v_distance, 2),
          v_campus.radius_meters;
      end;
      $body$;
    $appfn$;
  end if;
end
$do$;
