-- A-04: Índices faltantes en columnas usadas frecuentemente en JOINs y WHERE.
-- La tabla attendances.student_id no tenía índice → seq scan en cada check-in,
-- consulta del decano, compliance alert, etc.
-- Todos los índices son IF NOT EXISTS (idempotentes).

-- ── attendances ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_attendances_student_id
  ON public.attendances (student_id);

CREATE INDEX IF NOT EXISTS idx_attendances_campus_id
  ON public.attendances (campus_id);

CREATE INDEX IF NOT EXISTS idx_attendances_status
  ON public.attendances (status);

CREATE INDEX IF NOT EXISTS idx_attendances_date
  ON public.attendances (date);

-- Índice compuesto para la query más común: asistencias activas de un alumno en una fecha
CREATE INDEX IF NOT EXISTS idx_attendances_student_date
  ON public.attendances (student_id, date DESC);

-- ── notification_outbox ───────────────────────────────────────────────────────
-- El índice parcial sobre pending+created_at ya existe (20260529000003),
-- añadir índice general sobre status para la query de retry y failed.
CREATE INDEX IF NOT EXISTS idx_notification_outbox_status
  ON public.notification_outbox (status, created_at);

-- ── justifications ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_justifications_student_id
  ON public.justifications (student_id);

CREATE INDEX IF NOT EXISTS idx_justifications_status
  ON public.justifications (status);

-- ── teacher_groups ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_teacher_groups_student_id
  ON public.teacher_groups (student_id);

CREATE INDEX IF NOT EXISTS idx_teacher_groups_teacher_id
  ON public.teacher_groups (teacher_id);

-- ── users ─────────────────────────────────────────────────────────────────────
-- role se usa en EXISTS subqueries de casi todas las políticas RLS
CREATE INDEX IF NOT EXISTS idx_users_role
  ON public.users (role);
