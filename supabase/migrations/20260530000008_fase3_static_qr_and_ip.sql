-- Fase 3 — QR estático por sede + captura de IP + endurecimiento.
-- El QR pasa de DIARIO a ESTÁTICO: un código por sede, imprimible y reutilizable.
-- La seguridad se traslada al geofence (más preciso), la ventana horaria por
-- alumno (student_schedules) y la IP del check-in.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tabla del QR estático por sede (una fila por sede, no por día)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campus_qr (
  campus_id  uuid PRIMARY KEY REFERENCES public.campuses(id) ON DELETE CASCADE,
  token      text NOT NULL,
  short_code text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campus_qr ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campus_qr_read_coordinators" ON public.campus_qr;
CREATE POLICY "campus_qr_read_coordinators" ON public.campus_qr
  FOR SELECT TO authenticated
  USING (upper(public.get_current_user_role()) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR'));

DROP POLICY IF EXISTS "service_role_campus_qr_static" ON public.campus_qr;
CREATE POLICY "service_role_campus_qr_static" ON public.campus_qr
  FOR ALL USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. IP del dispositivo en check-in / check-out (señal forense, no bloqueo duro)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.attendances
  ADD COLUMN IF NOT EXISTS check_in_ip       text,
  ADD COLUMN IF NOT EXISTS check_out_ip      text,
  ADD COLUMN IF NOT EXISTS check_in_ip_info  jsonb,
  ADD COLUMN IF NOT EXISTS check_out_ip_info jsonb;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Desmontar el QR diario: ya no se pre-genera nada a medianoche.
--    (La tabla campus_daily_qr se deja por compatibilidad; deja de usarse.)
-- ─────────────────────────────────────────────────────────────────────────────
DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'checkhealth_generate_daily_qrs') THEN
    PERFORM cron.unschedule('checkhealth_generate_daily_qrs');
    RAISE NOTICE 'pg_cron job checkhealth_generate_daily_qrs desprogramado (QR ahora es estático).';
  END IF;
END;
$outer$;
