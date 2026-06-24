-- Q-01 / B-02 — Rate-limiting genérico para Edge Functions
-- Ventana deslizante atómica por (bucket, key). Una fila por clave; el RPC
-- incrementa y resetea la ventana cuando expira, en una sola sentencia
-- (INSERT ... ON CONFLICT DO UPDATE), evitando condiciones de carrera.
-- Lo usan validate-qr-checkin (por alumno) y recovery-otp (por IP).

CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket       text        NOT NULL,
  key          text        NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  count        integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, key)
);

-- Solo service_role (y el RPC SECURITY DEFINER) tocan esta tabla. Sin políticas
-- para authenticated/anon: un usuario no debe poder inflar contadores ajenos.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_rate_limits" ON public.rate_limits;
CREATE POLICY "service_role_rate_limits" ON public.rate_limits
  FOR ALL USING (auth.role() = 'service_role');

-- Devuelve TRUE si la petición está dentro del límite, FALSE si lo excede.
CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  p_bucket         text,
  p_key            text,
  p_max            integer,
  p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now   timestamptz := now();
  v_count integer;
BEGIN
  INSERT INTO public.rate_limits AS rl (bucket, key, window_start, count)
  VALUES (p_bucket, p_key, v_now, 1)
  ON CONFLICT (bucket, key) DO UPDATE SET
    count = CASE
      WHEN rl.window_start < v_now - make_interval(secs => p_window_seconds) THEN 1
      ELSE rl.count + 1
    END,
    window_start = CASE
      WHEN rl.window_start < v_now - make_interval(secs => p_window_seconds) THEN v_now
      ELSE rl.window_start
    END
  RETURNING count INTO v_count;

  RETURN v_count <= p_max;
END;
$$;

-- Solo las Edge Functions (service_role) pueden invocarlo.
REVOKE ALL ON FUNCTION public.rate_limit_hit(text, text, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, text, integer, integer) TO service_role;

-- Nota: las filas viejas se pueden purgar con un pg_cron periódico
--   DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 day';
-- No es crítico (la ventana se resetea sola); se deja como mantenimiento opcional.
