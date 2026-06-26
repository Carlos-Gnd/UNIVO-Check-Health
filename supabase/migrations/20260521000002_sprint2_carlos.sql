-- Sprint 2 — Tareas de Carlos
-- T-08b.1, T-09.2, T-12.1, T-14.1, T-16.3, T-17.1, T-19.1, T-20.2, T-21.2

-- T-14.1: Extender review_status + agregar location_mismatch
ALTER TABLE public.attendances
  ADD COLUMN IF NOT EXISTS location_mismatch boolean NOT NULL DEFAULT false;

ALTER TABLE public.attendances
  ALTER COLUMN review_status SET DEFAULT 'PENDIENTE';

-- T-17.1: Tabla justifications + RLS
CREATE TABLE IF NOT EXISTS public.justifications (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id  uuid        NOT NULL REFERENCES public.attendances(id) ON DELETE CASCADE,
  student_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  motivo         text        NOT NULL,
  documento_url  text,
  status         text        NOT NULL DEFAULT 'PENDIENTE',
  revisado_por   uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  notas_revisor  text,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT justifications_status_ck CHECK (status IN ('PENDIENTE','APROBADO','RECHAZADO'))
);

CREATE INDEX IF NOT EXISTS justif_student_idx    ON public.justifications (student_id);
CREATE INDEX IF NOT EXISTS justif_attendance_idx ON public.justifications (attendance_id);

ALTER TABLE public.justifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_select_own" ON public.justifications;
CREATE POLICY "student_select_own" ON public.justifications FOR SELECT USING (student_id = auth.uid());

DROP POLICY IF EXISTS "student_insert_own" ON public.justifications;
CREATE POLICY "student_insert_own" ON public.justifications FOR INSERT WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "service_role_all" ON public.justifications;
CREATE POLICY "service_role_all" ON public.justifications FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS trg_justifications_actualizado_en ON public.justifications;
CREATE TRIGGER trg_justifications_actualizado_en
  BEFORE UPDATE ON public.justifications
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_actualizado_en();

-- T-09.2: RPC coherencia temporal y espacial
CREATE OR REPLACE FUNCTION public.validate_location_coherence(
  p_student_id  uuid,
  p_current_lat numeric,
  p_current_lng numeric,
  p_timestamp   timestamptz DEFAULT now()
) RETURNS TABLE(is_suspicious boolean, confidence_score numeric)
LANGUAGE plpgsql AS $$
DECLARE
  v_prev_lat  numeric;
  v_prev_lng  numeric;
  v_prev_ts   timestamptz;
  v_dist_m    numeric;
  v_elapsed_h numeric;
  v_speed_kmh numeric;
  v_conf      numeric := 0;
BEGIN
  SELECT (check_in_location->>'latitude')::numeric,
         (check_in_location->>'longitude')::numeric,
         COALESCE(check_out, check_in)
  INTO v_prev_lat, v_prev_lng, v_prev_ts
  FROM public.attendances
  WHERE student_id = p_student_id AND check_in_location IS NOT NULL
  ORDER BY COALESCE(check_out, check_in) DESC LIMIT 1;

  IF v_prev_lat IS NULL THEN
    RETURN QUERY SELECT false, 0.00::numeric; RETURN;
  END IF;

  v_dist_m    := public.haversine_meters(p_current_lat, p_current_lng, v_prev_lat, v_prev_lng);
  v_elapsed_h := GREATEST(EXTRACT(EPOCH FROM (p_timestamp - v_prev_ts)) / 3600.0, 0.001);
  v_speed_kmh := (v_dist_m / 1000.0) / v_elapsed_h;

  IF    v_speed_kmh > 140 THEN v_conf := 0.95;
  ELSIF v_speed_kmh >  80 THEN v_conf := 0.60;
  ELSIF v_speed_kmh >  40 THEN v_conf := 0.30;
  END IF;

  RETURN QUERY SELECT v_conf > 0.70, round(v_conf, 2);
END;
$$;

-- T-12.1: Trigger location_mismatch
CREATE OR REPLACE FUNCTION public.fn_check_location_mismatch()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_lat_in   numeric; v_lng_in  numeric;
  v_lat_out  numeric; v_lng_out numeric;
  v_dist     numeric; v_threshold numeric := 150;
BEGIN
  IF NEW.check_out_location IS NULL OR NEW.check_in_location IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(value::numeric, 150) INTO v_threshold FROM public.system_config WHERE key = 'location_mismatch_threshold_m';
  v_threshold := COALESCE(v_threshold, 150);
  v_lat_in  := (NEW.check_in_location->>'latitude')::numeric;
  v_lng_in  := (NEW.check_in_location->>'longitude')::numeric;
  v_lat_out := (NEW.check_out_location->>'latitude')::numeric;
  v_lng_out := (NEW.check_out_location->>'longitude')::numeric;
  v_dist := public.haversine_meters(v_lat_in, v_lng_in, v_lat_out, v_lng_out);
  IF v_dist > v_threshold THEN
    NEW.location_mismatch := true;
    NEW.review_status := 'OBSERVADO';
    NEW.suspicious_reason := format('%s Discrepancia %.0f m (umbral %.0f m).', COALESCE(NEW.suspicious_reason || ' ', ''), v_dist, v_threshold);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_location_mismatch ON public.attendances;
CREATE TRIGGER trg_location_mismatch
  BEFORE INSERT OR UPDATE ON public.attendances
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_location_mismatch();

-- T-19.1: Vista cumplimiento por carrera y sede
CREATE OR REPLACE VIEW public.v_cumplimiento_carrera_sede AS
SELECT u.career AS carrera, c.id AS campus_id, c.name AS campus_nombre,
  COUNT(DISTINCT u.id) AS total_alumnos,
  ROUND(COALESCE(SUM(a.worked_hours),0) / NULLIF(COUNT(DISTINCT u.id),0) / 240.0 * 100, 1) AS cumplimiento_pct
FROM public.users u
LEFT JOIN public.attendances a ON a.student_id = u.id AND a.check_out IS NOT NULL
LEFT JOIN public.campuses   c ON c.id = a.campus_id
WHERE u.role = 'STUDENT'
GROUP BY u.career, c.id, c.name;

-- T-16.3: Trigger alerta cumplimiento
CREATE OR REPLACE FUNCTION public.fn_compliance_alert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_threshold numeric; v_goal numeric; v_total_h numeric; v_pct numeric;
BEGIN
  SELECT COALESCE(value::numeric, 60)  INTO v_threshold FROM public.system_config WHERE key = 'compliance_alert_threshold_pct';
  SELECT COALESCE(value::numeric, 240) INTO v_goal      FROM public.system_config WHERE key = 'required_practice_hours';
  v_threshold := COALESCE(v_threshold, 60); v_goal := COALESCE(v_goal, 240);
  SELECT COALESCE(SUM(worked_hours), 0) INTO v_total_h FROM public.attendances WHERE student_id = NEW.student_id AND check_out IS NOT NULL;
  v_pct := ROUND((v_total_h / NULLIF(v_goal, 0)) * 100, 1);
  IF v_pct < v_threshold THEN
    INSERT INTO public.audit_log(action, actor_user_id, target_user_id, details)
    VALUES ('compliance_alert', NEW.student_id, NEW.student_id,
      jsonb_build_object('compliance_pct', v_pct, 'threshold', v_threshold, 'total_hours', v_total_h, 'goal_hours', v_goal, 'attendance_id', NEW.id));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_compliance_alert ON public.attendances;
CREATE TRIGGER trg_compliance_alert
  AFTER INSERT OR UPDATE OF worked_hours ON public.attendances
  FOR EACH ROW WHEN (NEW.check_out IS NOT NULL)
  EXECUTE FUNCTION public.fn_compliance_alert();

-- T-20.2: Funciones de omisión
CREATE OR REPLACE FUNCTION public.fn_log_omission_alert(p_attendance_id uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_att record;
BEGIN
  SELECT * INTO v_att FROM public.attendances WHERE id = p_attendance_id;
  IF v_att IS NULL THEN RETURN; END IF;
  INSERT INTO public.audit_log(action, actor_user_id, target_user_id, details)
  VALUES ('omission_alert', v_att.student_id, v_att.student_id,
    jsonb_build_object('attendance_id', p_attendance_id, 'campus_id', v_att.campus_id, 'check_in', v_att.check_in,
      'hours_open', ROUND(EXTRACT(EPOCH FROM (now() - v_att.check_in)) / 3600.0, 1)));
END; $$;

CREATE OR REPLACE FUNCTION public.fn_detect_open_attendances(p_max_hours numeric DEFAULT 12)
RETURNS TABLE(student_id uuid, attendance_id uuid, hours_open numeric) LANGUAGE sql AS $$
  SELECT a.student_id, a.id, ROUND(EXTRACT(EPOCH FROM (now() - a.check_in)) / 3600.0, 1)
  FROM public.attendances a
  WHERE a.check_out IS NULL AND EXTRACT(EPOCH FROM (now() - a.check_in)) / 3600.0 > p_max_hours;
$$;

-- T-21.2: Actualizar validate_checkin_area con ventana horaria explícita
CREATE OR REPLACE FUNCTION public.validate_checkin_area(
  p_campus_id   uuid, p_current_lat numeric, p_current_lng numeric,
  p_timestamp   timestamptz DEFAULT now()
)
RETURNS TABLE(is_allowed boolean, message text, distance_meters numeric, radius_meters integer)
LANGUAGE plpgsql AS $$
DECLARE v_campus public.campuses; v_distance numeric; v_now_time time;
BEGIN
  SELECT * INTO v_campus FROM public.campuses WHERE id = p_campus_id;
  IF v_campus.id IS NULL THEN RAISE EXCEPTION 'Campus not found: %', p_campus_id; END IF;
  v_distance := public.haversine_meters(p_current_lat, p_current_lng, v_campus.latitude, v_campus.longitude);
  IF v_distance > v_campus.radius_meters THEN
    RETURN QUERY SELECT false,
      format('Fuera del área por %.0f metros.', (v_distance - v_campus.radius_meters)::numeric),
      round(v_distance, 2), v_campus.radius_meters; RETURN;
  END IF;
  IF v_campus.check_in_from IS NOT NULL AND v_campus.check_in_to IS NOT NULL THEN
    v_now_time := p_timestamp::time;
    IF v_now_time < v_campus.check_in_from OR v_now_time > v_campus.check_in_to THEN
      RETURN QUERY SELECT false,
        format('Fuera de la ventana horaria permitida (%s – %s).', v_campus.check_in_from, v_campus.check_in_to),
        round(v_distance, 2), v_campus.radius_meters; RETURN;
    END IF;
  END IF;
  RETURN QUERY SELECT true, 'Ubicación y horario validados.'::text, round(v_distance, 2), v_campus.radius_meters;
END; $$;

-- Seed: claves de configuración necesarias
INSERT INTO public.system_config(key, value) VALUES
  ('compliance_alert_threshold_pct',  '60'),
  ('required_practice_hours',         '240'),
  ('location_mismatch_threshold_m',   '150')
ON CONFLICT (key) DO NOTHING;
