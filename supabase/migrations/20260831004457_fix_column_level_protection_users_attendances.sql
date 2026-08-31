-- CRÍTICO — verificado empíricamente el 2026-08-31 contra el stack local (mismas
-- políticas que producción): un alumno autenticado podía escalar su propio rol a
-- ADMIN con un simple `update users set role='ADMIN' where id = auth.uid()` vía la
-- Data API. La política "users_update_own" (20260529000005_rls_hardening.sql)
-- restringe QUÉ FILA puede tocar (la propia), pero nunca restringió QUÉ COLUMNAS —
-- exactamente el hueco que HU-S01 (Plan_Cierre_CheckHealth, jul 2026) ya había
-- anticipado en sus notas y que nunca se implementó.
--
-- HU-S02 (forjar asistencias) hoy solo está bloqueado por accidente: un trigger
-- interno intenta escribir en notification_outbox al insertar en attendances, y
-- esa tabla sí tiene RLS estricta, así que la transacción entera se revierte como
-- efecto colateral — no porque attendances esté realmente protegida. Se cierra acá
-- de raíz eliminando la política que permitía el insert directo del alumno: no hay
-- ningún flujo legítimo que inserte asistencias así (confirmado por grep en src/,
-- el único camino real es la Edge Function validate-qr-checkin con service_role).

-- ── HU-S01: proteger columnas sensibles de public.users ──────────────────────
-- El propio usuario solo puede tocar los campos de auto-edición de su perfil
-- (foto, contacto, preferencias, pregunta de seguridad, consentimiento legal,
-- su sesión activa). Todo lo demás (role, is_active, student_code,
-- must_change_password, academic_level, career, email, campus_id, created_at)
-- solo lo puede cambiar service_role (Edge Functions como admin-users).
CREATE OR REPLACE FUNCTION public.fn_protect_users_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.role                   IS DISTINCT FROM OLD.role
     OR NEW.is_active            IS DISTINCT FROM OLD.is_active
     OR NEW.student_code         IS DISTINCT FROM OLD.student_code
     OR NEW.must_change_password IS DISTINCT FROM OLD.must_change_password
     OR NEW.academic_level       IS DISTINCT FROM OLD.academic_level
     OR NEW.career               IS DISTINCT FROM OLD.career
     OR NEW.email                IS DISTINCT FROM OLD.email
     OR NEW.campus_id            IS DISTINCT FROM OLD.campus_id
     OR NEW.created_at           IS DISTINCT FROM OLD.created_at
     OR NEW.id                   IS DISTINCT FROM OLD.id
  THEN
    RAISE EXCEPTION 'No autorizado: esta columna de users solo puede modificarla el sistema.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_users_columns ON public.users;
CREATE TRIGGER trg_protect_users_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_protect_users_columns();

-- ── HU-S02: quitar la vía de insert directo del alumno en attendances ────────
DROP POLICY IF EXISTS "attendances_student_insert_own" ON public.attendances;
