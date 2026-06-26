-- Auditoría #5: unifica review_status al vocabulario canónico
-- PENDIENTE / VALIDADO / OBSERVADO.
--
-- Quedaban resabios del vocabulario viejo (clear / pending_review / flagged):
--   1) el DEFAULT de public.attendances (20260514000000) seguía siendo 'clear', y
--   2) filas históricas con esos valores.
-- El frontend (CheckIn, dashboard del decano) comparaba contra 'flagged', que nunca
-- coincide con el valor real 'OBSERVADO' → las asistencias observadas jamás se
-- marcaban "En revisión". El código que ESCRIBE ya usaba el vocabulario nuevo
-- (validate-qr-checkin, checkHealthBackend, trigger 20260521000002); aquí se alinea
-- el DATO y el DEFAULT.

UPDATE public.attendances SET review_status = 'PENDIENTE'
  WHERE review_status IN ('clear', 'pending_review');

UPDATE public.attendances SET review_status = 'OBSERVADO'
  WHERE review_status = 'flagged';

ALTER TABLE public.attendances ALTER COLUMN review_status SET DEFAULT 'PENDIENTE';
