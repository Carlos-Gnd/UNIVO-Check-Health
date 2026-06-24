-- T-10.2: detect active check-ins from the same device in different campuses.

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

-- Schema local app.* (solo si existe; en la nube `app` no existe y este create
-- abortaba la migración → la función pública de arriba nunca quedaba aplicada).
do $do$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'app') then
    execute $appfn$
      create or replace function app.detect_device_fingerprint_conflict(
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
      as $body$
        select a.id, a.student_id, a.campus_id, a.check_in
        from app.attendances a
        where a.device_fingerprint = p_device_fingerprint
          and a.check_out is null
          and a.campus_id <> p_campus_id
          and a.student_id <> p_student_id
        order by a.check_in desc
        limit 1
      $body$;
    $appfn$;
  end if;
end
$do$;
