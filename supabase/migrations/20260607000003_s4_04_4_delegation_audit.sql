-- S4-04.4 - Auditoria de delegacion.
-- Registra altas/ediciones/bajas de sedes y cambios directos de usuarios hechos por
-- usuarios autenticados. Las operaciones server-side de admin-users agregan su log
-- en la Edge Function porque usan service_role.

CREATE OR REPLACE FUNCTION public.audit_delegated_client_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text := upper(public.get_current_user_role());
  v_record_id text := CASE WHEN TG_OP = 'DELETE' THEN OLD.id::text ELSE NEW.id::text END;
  v_target uuid := NULL;
  v_action text;
BEGIN
  IF v_actor IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF v_actor_role NOT IN ('ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE') THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'users' THEN
    v_target := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
    v_action := CASE TG_OP
      WHEN 'INSERT' THEN 'DELEGATED_USER_CREATED'
      WHEN 'UPDATE' THEN 'DELEGATED_USER_UPDATED'
      WHEN 'DELETE' THEN 'DELEGATED_USER_DELETED'
      ELSE 'DELEGATED_USER_CHANGED'
    END;
  ELSIF TG_TABLE_NAME = 'campuses' THEN
    v_action := CASE TG_OP
      WHEN 'INSERT' THEN 'DELEGATED_CAMPUS_CREATED'
      WHEN 'UPDATE' THEN 'DELEGATED_CAMPUS_UPDATED'
      WHEN 'DELETE' THEN 'DELEGATED_CAMPUS_DELETED'
      ELSE 'DELEGATED_CAMPUS_CHANGED'
    END;
  ELSE
    v_action := 'DELEGATED_' || upper(TG_TABLE_NAME) || '_' || TG_OP;
  END IF;

  INSERT INTO public.audit_log(action, actor_user_id, target_user_id, details)
  VALUES (
    v_action,
    v_actor,
    v_target,
    jsonb_build_object(
      'actor_role', v_actor_role,
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'record_id', v_record_id,
      'new', CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE NULL END,
      'old', CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE NULL END
    )
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_campuses_delegation ON public.campuses;
CREATE TRIGGER trg_audit_campuses_delegation
AFTER INSERT OR UPDATE OR DELETE ON public.campuses
FOR EACH ROW EXECUTE FUNCTION public.audit_delegated_client_change();

DROP TRIGGER IF EXISTS trg_audit_users_delegation ON public.users;
CREATE TRIGGER trg_audit_users_delegation
AFTER INSERT OR UPDATE OR DELETE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.audit_delegated_client_change();
