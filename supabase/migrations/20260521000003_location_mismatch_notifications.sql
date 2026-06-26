-- T-12.2: queue push and email notifications when check-out location differs from check-in.

create table if not exists public.notification_outbox (
  id bigserial primary key,
  channel text not null check (channel in ('push', 'email')),
  type text not null,
  target_user_id uuid not null,
  attendance_id uuid not null references public.attendances(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_notification_outbox_pending
  on public.notification_outbox (channel, status, created_at)
  where status = 'pending';

create or replace function public.fn_queue_location_mismatch_notifications()
returns trigger
language plpgsql
as $$
declare
  v_payload jsonb;
begin
  if coalesce(new.location_mismatch, false) is false then
    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(old.location_mismatch, false) is true then
    return new;
  end if;

  v_payload := jsonb_build_object(
    'attendance_id', new.id,
    'student_id', new.student_id,
    'campus_id', new.campus_id,
    'check_in_location', new.check_in_location,
    'check_out_location', new.check_out_location,
    'message', 'Check-out registrado desde una ubicacion distinta al check-in'
  );

  insert into public.notification_outbox (channel, type, target_user_id, attendance_id, payload)
  select channel, 'LOCATION_MISMATCH', u.id, new.id, v_payload || jsonb_build_object('recipient_email', u.email)
  from public.users u
  cross join (values ('push'), ('email')) as channels(channel)
  where u.role in ('COORDINADOR', 'ADMIN');

  insert into public.audit_log (action, actor_user_id, target_user_id, details)
  values (
    'LOCATION_MISMATCH_NOTIFICATIONS_QUEUED',
    new.student_id,
    new.student_id,
    v_payload || jsonb_build_object('channels', jsonb_build_array('push', 'email'))
  );

  return new;
end;
$$;

drop trigger if exists trg_location_mismatch_notifications on public.attendances;
create trigger trg_location_mismatch_notifications
  after insert or update on public.attendances
  for each row execute function public.fn_queue_location_mismatch_notifications();
