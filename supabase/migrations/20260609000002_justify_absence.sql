-- B3: permitir justificar una AUSENCIA cuando el alumno NO pudo marcar asistencia.
-- Antes justifications.attendance_id era NOT NULL, asi que solo se podia justificar
-- una jornada ya registrada — justo lo contrario de lo que se necesita cuando el
-- problema es que no se logro marcar. Ahora una justificacion puede anclarse a una
-- asistencia (attendance_id) O a una fecha de ausencia (absence_date).

alter table public.justifications alter column attendance_id drop not null;
alter table public.justifications add column if not exists absence_date date;
alter table public.justifications
  add column if not exists absence_campus_id uuid references public.campuses(id) on delete set null;

-- Integridad: debe referenciar una asistencia o, en su defecto, una fecha de ausencia.
alter table public.justifications drop constraint if exists justifications_target_ck;
alter table public.justifications add constraint justifications_target_ck
  check (attendance_id is not null or absence_date is not null);

-- Los triggers de notificacion (decision/escalacion) insertan en notification_outbox
-- con NEW.attendance_id. Para una ausencia ese valor es NULL, asi que la columna
-- debe admitir NULL o la revision del coordinador fallaria.
alter table public.notification_outbox alter column attendance_id drop not null;
