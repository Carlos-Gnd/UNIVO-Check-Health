-- T-51.2: OTP de 6 digitos para recuperacion por correo de respaldo.
-- Guarda solo hash + salt, expira en 10 minutos y limita intentos.

CREATE TABLE IF NOT EXISTS public.recovery_otps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  backup_email text NOT NULL,
  otp_hash    text NOT NULL,
  otp_salt    text NOT NULL,
  attempts    smallint NOT NULL DEFAULT 0,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recovery_otps_attempts_ck CHECK (attempts BETWEEN 0 AND 3)
);

CREATE INDEX IF NOT EXISTS idx_recovery_otps_email_created
  ON public.recovery_otps (lower(email), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recovery_otps_pending
  ON public.recovery_otps (lower(email), expires_at DESC)
  WHERE consumed_at IS NULL;

ALTER TABLE public.recovery_otps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_recovery_otps" ON public.recovery_otps;
CREATE POLICY "service_role_recovery_otps" ON public.recovery_otps
  FOR ALL USING (auth.role() = 'service_role');
