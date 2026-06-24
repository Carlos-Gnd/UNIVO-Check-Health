-- Código corto de 6 chars para check-in manual sin cámara.
-- El coordinador muestra el código junto al QR; el alumno lo digita en la app.

ALTER TABLE public.campus_daily_qr
  ADD COLUMN IF NOT EXISTS short_code VARCHAR(8);

CREATE INDEX IF NOT EXISTS idx_campus_daily_qr_short
  ON public.campus_daily_qr (campus_id, qr_date, short_code);
