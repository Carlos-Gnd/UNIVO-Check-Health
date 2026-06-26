-- B15: días no hábiles recurrentes (feriados que se repiten cada año) y edición.
-- Antes solo se podían agregar/eliminar fechas puntuales; un feriado anual debía
-- recrearse cada año. Con `recurring`, una fecha marcada como anual aplica al mismo
-- mes-día de cualquier año (el frontend expande las ocurrencias al consultar).

alter table public.holidays add column if not exists recurring boolean not null default false;
