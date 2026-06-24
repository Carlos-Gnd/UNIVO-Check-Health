-- Tablas administrativas: períodos académicos, asignaciones de alumnos,
-- metas de horas, y estados por período (usuarios y sedes).
-- Requeridas para HU-15 (calendario de rotaciones), HU-13 (progreso de horas)
-- y gestión de ciclos por el Decano.

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCIÓN COMPARTIDA: actualiza `actualizado_en` automáticamente en cada UPDATE
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_set_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PERÍODOS ACADÉMICOS
--    Define ciclos (2026-1, 2026-2), sus fechas y cuál está activo.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.periodos_academicos (
  id             uuid        primary key default gen_random_uuid(),
  codigo         text        not null unique,           -- ej: 2026-1
  nombre         text        not null,                  -- ej: Ciclo I 2026
  fecha_inicio   date        not null,
  fecha_fin      date        not null,
  activo         boolean     not null default false,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint periodos_fechas_ck check (fecha_fin >= fecha_inicio)
);

-- Solo un período puede estar activo a la vez
create unique index if not exists periodos_activo_unico_idx
  on public.periodos_academicos (activo)
  where activo = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ASIGNACIONES DE ALUMNOS
--    Asignación oficial por período: alumno + sede + encargado + horario.
--    Base de datos para el calendario de rotaciones (HU-15) y
--    el panel "Mi Sede y Encargado" del estudiante.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.asignaciones_alumnos (
  id             uuid        primary key default gen_random_uuid(),
  alumno_id      uuid        not null references public.users(id)               on delete cascade,
  sede_id        uuid        not null references public.campuses(id)            on delete restrict,
  encargado_id   uuid            null references public.users(id)               on delete set null,
  periodo_id     uuid        not null references public.periodos_academicos(id) on delete restrict,
  carrera        text            null,                  -- para filtros del Decano
  horario        text            null,
  fecha_inicio   date        not null,
  fecha_fin      date        not null,
  estado         text        not null default 'activa',
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint asignaciones_fechas_ck check (fecha_fin >= fecha_inicio),
  constraint asignaciones_estado_ck check (estado in ('activa','finalizada','cancelada'))
);

create index if not exists asig_alumno_idx    on public.asignaciones_alumnos (alumno_id);
create index if not exists asig_periodo_idx   on public.asignaciones_alumnos (periodo_id);
create index if not exists asig_sede_idx      on public.asignaciones_alumnos (sede_id);
create index if not exists asig_encargado_idx on public.asignaciones_alumnos (encargado_id);

-- Evita registrar al mismo alumno dos veces en la misma sede y período
create unique index if not exists asig_slot_unico_idx
  on public.asignaciones_alumnos (alumno_id, periodo_id, sede_id, fecha_inicio, fecha_fin);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. METAS DE HORAS POR ALUMNO
--    Permite asignar meta de horas individual por alumno y período.
--    Evita hardcodear "240 horas para todos" — cada carrera puede tener meta distinta.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.metas_horas_alumno (
  id             uuid          primary key default gen_random_uuid(),
  alumno_id      uuid          not null references public.users(id)               on delete cascade,
  periodo_id     uuid          not null references public.periodos_academicos(id) on delete cascade,
  meta_horas     numeric(6,2)  not null,
  origen         text          not null default 'manual',  -- manual | por_carrera
  notas          text              null,
  creado_en      timestamptz   not null default now(),
  actualizado_en timestamptz   not null default now(),
  constraint metas_horas_positiva_ck check (meta_horas > 0),
  constraint metas_origen_ck          check (origen in ('manual','por_carrera')),
  unique (alumno_id, periodo_id)
);

create index if not exists metas_periodo_idx on public.metas_horas_alumno (periodo_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ESTADO DE USUARIO POR PERÍODO
--    Activa o desactiva un usuario en un período concreto sin borrar su historial.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.estado_usuario_periodo (
  id             uuid        primary key default gen_random_uuid(),
  usuario_id     uuid        not null references public.users(id)               on delete cascade,
  periodo_id     uuid        not null references public.periodos_academicos(id) on delete cascade,
  activo         boolean     not null default true,
  motivo         text            null,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (usuario_id, periodo_id)
);

create index if not exists estado_usuario_periodo_idx on public.estado_usuario_periodo (periodo_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ESTADO DE SEDE POR PERÍODO
--    Activa o desactiva una sede en un período concreto sin borrarla.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.estado_sede_periodo (
  id             uuid        primary key default gen_random_uuid(),
  sede_id        uuid        not null references public.campuses(id)            on delete cascade,
  periodo_id     uuid        not null references public.periodos_academicos(id) on delete cascade,
  activo         boolean     not null default true,
  motivo         text            null,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (sede_id, periodo_id)
);

create index if not exists estado_sede_periodo_idx on public.estado_sede_periodo (periodo_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGERS: mantiene actualizado_en al día en todas las tablas nuevas
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'periodos_academicos',
    'asignaciones_alumnos',
    'metas_horas_alumno',
    'estado_usuario_periodo',
    'estado_sede_periodo'
  ] loop
    execute format(
      'drop trigger if exists trg_%1$s_actualizado_en on public.%1$s;
       create trigger trg_%1$s_actualizado_en
         before update on public.%1$s
         for each row execute function public.fn_set_actualizado_en();',
      t
    );
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS (Row Level Security)
--    Política temporal: solo service_role accede (panel admin / backend).
--    Reemplazar por políticas granulares por rol antes de producción.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'periodos_academicos',
    'asignaciones_alumnos',
    'metas_horas_alumno',
    'estado_usuario_periodo',
    'estado_sede_periodo'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format(
      'drop policy if exists "service_role_all" on public.%I;
       create policy "service_role_all" on public.%I
         for all using (auth.role() = ''service_role'');',
      t, t
    );
  end loop;
end $$;
