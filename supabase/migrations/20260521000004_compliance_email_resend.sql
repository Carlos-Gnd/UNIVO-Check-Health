-- T-16.2: configure compliance alert emails for Resend/SMTP delivery.
-- Secrets such as RESEND_API_KEY must live in the deployment environment, not in Git.

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

insert into public.system_config (key, value)
values
  ('resend_from_email', 'Check Health <notificaciones@checkhealth.univo.edu.sv>'),
  ('resend_dashboard_url', '/student/progress'),
  ('compliance_email_subject', 'Alerta de cumplimiento de horas')
on conflict (key) do update set
  value = excluded.value,
  updated_at = now();

create or replace function public.fn_compliance_alert_email_html(
  p_student_name text,
  p_compliance_pct numeric,
  p_threshold numeric,
  p_total_hours numeric,
  p_goal_hours numeric,
  p_dashboard_url text
)
returns text
language sql
stable
as $$
  select format(
    '<!doctype html>
    <html>
      <body style="font-family:Arial,sans-serif;color:#111827;line-height:1.5">
        <h2 style="color:#b91c1c">Alerta de cumplimiento</h2>
        <p>Hola %s, tu avance actual es de <strong>%s%%</strong>, por debajo del umbral configurado de <strong>%s%%</strong>.</p>
        <p>Horas completadas: <strong>%s</strong> de <strong>%s</strong>.</p>
        <p><a href="%s" style="background:#2563eb;color:#ffffff;padding:10px 14px;border-radius:6px;text-decoration:none">Ver dashboard</a></p>
      </body>
    </html>',
    coalesce(nullif(p_student_name, ''), 'estudiante'),
    coalesce(p_compliance_pct, 0),
    coalesce(p_threshold, 0),
    coalesce(p_total_hours, 0),
    coalesce(p_goal_hours, 0),
    coalesce(nullif(p_dashboard_url, ''), '/student/progress')
  )
$$;

create or replace function public.fn_queue_compliance_alert_email()
returns trigger
language plpgsql
as $$
declare
  v_student public.users;
  v_from_email text;
  v_dashboard_url text;
  v_subject text;
  v_attendance_id uuid;
  v_payload jsonb;
begin
  if new.action <> 'compliance_alert' then
    return new;
  end if;

  v_attendance_id := nullif(new.details->>'attendance_id', '')::uuid;
  if v_attendance_id is null then
    return new;
  end if;

  select * into v_student from public.users where id = new.target_user_id;
  if v_student.id is null or v_student.email is null then
    return new;
  end if;

  select coalesce(value, 'Check Health <notificaciones@checkhealth.univo.edu.sv>')
    into v_from_email
  from public.system_config
  where key = 'resend_from_email';

  select coalesce(value, '/student/progress')
    into v_dashboard_url
  from public.system_config
  where key = 'resend_dashboard_url';

  select coalesce(value, 'Alerta de cumplimiento de horas')
    into v_subject
  from public.system_config
  where key = 'compliance_email_subject';

  v_payload := jsonb_build_object(
    'provider', 'resend',
    'smtp_ready', true,
    'from', coalesce(v_from_email, 'Check Health <notificaciones@checkhealth.univo.edu.sv>'),
    'to', v_student.email,
    'subject', coalesce(v_subject, 'Alerta de cumplimiento de horas'),
    'dashboard_url', coalesce(v_dashboard_url, '/student/progress'),
    'template', 'compliance_alert',
    'html', public.fn_compliance_alert_email_html(
      v_student.full_name,
      (new.details->>'compliance_pct')::numeric,
      (new.details->>'threshold')::numeric,
      (new.details->>'total_hours')::numeric,
      (new.details->>'goal_hours')::numeric,
      coalesce(v_dashboard_url, '/student/progress')
    ),
    'details', new.details
  );

  if not exists (
    select 1
    from public.notification_outbox n
    where n.channel = 'email'
      and n.type = 'COMPLIANCE_ALERT'
      and n.target_user_id = new.target_user_id
      and n.attendance_id = v_attendance_id
  ) then
    insert into public.notification_outbox (channel, type, target_user_id, attendance_id, payload)
    values ('email', 'COMPLIANCE_ALERT', new.target_user_id, v_attendance_id, v_payload);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_queue_compliance_alert_email on public.audit_log;
create trigger trg_queue_compliance_alert_email
  after insert on public.audit_log
  for each row execute function public.fn_queue_compliance_alert_email();
