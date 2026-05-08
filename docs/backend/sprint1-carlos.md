# Sprint 1 - Tareas de Carlos (Backend + QA)

Este documento cubre las tareas:
- T-01.1 y T-01.2 (HU-01)
- T-02.2 (HU-02)
- T-03.1 (HU-03)
- T-07.3 (HU-07)
- Evidencia base para QA: T-01.7, T-03.8, T-07.6

## Levantar BD local (Supabase Postgres)

```bash
docker compose up -d
```

Conexion local:
- Host: `localhost`
- Puerto: `54322`
- DB: `checkhealth`
- User: `postgres`
- Password: `postgres`

## Objetos implementados en SQL

Archivo: `supabase/sql/001_init_checkhealth.sql`

1. `app.system_config` con `allowed_email_domain` configurable.
2. `app.users` con `student_code` unico (9 caracteres).
3. `app.audit_log` append-only (bloquea update/delete con trigger).
4. `app.campuses` con coordenadas y radio configurable (default 100m).
5. Funciones:
   - `app.register_univo_user(...)`
   - `app.log_forced_session_close(...)`
   - `app.validate_checkin_area(...)`
   - `app.create_campus_as_coordinator(...)`

## Mapeo directo a tareas

- T-01.1: validacion de dominio institucional en `register_univo_user`.
- T-01.2: extraccion de codigo (primeros 9 chars del correo) + restriccion unica.
- T-02.2: bitacora de cierre forzado con inmutabilidad.
- T-03.1: geocercas por sede + verificacion server-side con mensaje descriptivo.
- T-07.3: alta de sedes solo por coordinador con validacion geografica.
