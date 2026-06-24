-- T-19.3: umbral configurable para lista de estudiantes en riesgo.

INSERT INTO public.system_config(key, value)
VALUES ('risk_threshold_pct', '60')
ON CONFLICT (key) DO NOTHING;
