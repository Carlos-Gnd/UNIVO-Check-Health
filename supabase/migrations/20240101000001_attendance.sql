create type app.attendance_status as enum ('present', 'absent', 'late', 'excused');
create type app.review_status as enum ('clear', 'pending_review');

create table if not exists app.attendances (
  id uuid primary key default app.new_uuid(),
  student_id uuid not null references app.users(id),
  campus_id uuid not null references app.campuses(id),
  check_in timestamptz not null default now(),
  check_out timestamptz,
  date date not null default current_date,
  status app.attendance_status not null default 'present',
  notes text,
  
  -- Geolocation JSON
  check_in_location jsonb,
  check_out_location jsonb,
  
  -- Security and Audit
  security_seal text,
  check_out_security_seal text,
  worked_hours numeric(5,2),
  review_status app.review_status default 'clear',
  suspicious_reason text,
  device_id text,
  device_info jsonb,
  
  created_at timestamptz not null default now()
);

-- Policies or Triggers can go here
