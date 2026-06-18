-- Fix P1-2: attendances.date usaba `default current_date` (UTC). El Salvador es UTC-6,
-- así que un check-in después de ~6:00pm SV se guardaba con la fecha del día SIGUIENTE
-- (el edge function no setea `date`, depende del default). Eso desfasaba el verde del
-- calendario, los reportes diarios y el conteo por día.
--
-- Se alinea el default a la fecha de El Salvador y se corrigen las filas históricas
-- derivándolas del check_in real (timestamptz → fecha SV).

ALTER TABLE public.attendances
  ALTER COLUMN date SET DEFAULT (now() AT TIME ZONE 'America/El_Salvador')::date;

UPDATE public.attendances
   SET date = (check_in AT TIME ZONE 'America/El_Salvador')::date
 WHERE check_in IS NOT NULL
   AND date IS DISTINCT FROM (check_in AT TIME ZONE 'America/El_Salvador')::date;
