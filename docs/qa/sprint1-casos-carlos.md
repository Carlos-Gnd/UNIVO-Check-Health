# QA Sprint 1 - Casos de prueba (Carlos)

## T-01.7 - Login institucional y sesion

Caso QA-01: Correo externo rechazado
- Pasos: invocar `app.register_univo_user('test@gmail.com', 'Test')`.
- Esperado: error `Only @univo.edu.sv emails are allowed`.

Caso QA-02: Codigo duplicado rechazado
- Pasos:
  1. `app.register_univo_user('U20240579@univo.edu.sv', 'A')`
  2. `app.register_univo_user('U20240579x@univo.edu.sv', 'B')`
- Esperado: segundo intento falla por codigo `U20240579` existente.

Caso QA-03: Roles validos para revocacion
- Pasos:
  1. Crear usuario coordinador.
  2. Ejecutar `app.log_forced_session_close(actor, target, 'test')`.
- Esperado: registro insertado con accion `FORCED_SESSION_CLOSE`.

Caso QA-04: Rol no autorizado para revocacion
- Pasos: ejecutar `app.log_forced_session_close` con actor `STUDENT`.
- Esperado: error `Only COORDINADOR or ADMIN can revoke sessions`.

## T-03.8 - Geocerca y hora de servidor

Caso QA-05: Check-in dentro de geocerca
- Pasos:
  1. Crear sede con radio 100.
  2. Ejecutar `app.validate_checkin_area(campus, punto_cercano)`.
- Esperado: `is_allowed=true`.

Caso QA-06: Check-in fuera de geocerca
- Pasos: ejecutar `app.validate_checkin_area(campus, punto_lejano)`.
- Esperado: `is_allowed=false` y mensaje descriptivo de distancia excedida.

Caso QA-07: Hora no manipulable por cliente
- Pasos: insertar eventos con funciones SQL sin enviar hora de cliente.
- Esperado: `event_at` proviene de `now()` del servidor.

## T-07.6 - Dashboard y sedes

Caso QA-08: Solo coordinador crea sede
- Pasos:
  1. Actor STUDENT intenta `app.create_campus_as_coordinator(...)`.
  2. Actor COORDINADOR repite.
- Esperado: primer intento falla, segundo crea sede.

Caso QA-09: Coordenadas invalidas
- Pasos: crear sede con latitud > 90 o longitud > 180.
- Esperado: error de validacion geografica.

Caso QA-10: Sede disponible inmediatamente
- Pasos:
  1. Crear sede valida.
  2. Consultar `select * from app.campuses where name = ...`.
- Esperado: aparece al instante y lista para asignaciones.
