# UNIVO Check-Health

Sistema web para el **registro y control de asistencias** de prácticas clínicas del área de salud en la Universidad de Oriente (UNIVO), El Salvador.

Digitaliza el ciclo completo de prácticas mediante geofencing GPS, auditoría inmutable, dashboard ejecutivo y gestión de usuarios por roles.

---

## Estado del proyecto

| Sprint | Período | Estado | HUs |
|--------|---------|--------|-----|
| Sprint 0 | Setup inicial | Completado | Repo, DB schema, wireframes |
| **Sprint 1** | Mes 1 | **Completado** | HU-01 → HU-07 (34 SP) |
| Sprint 2 | Mes 2 | Pendiente | HU-08 → HU-22 (62 SP) |
| Sprint 3+ | Mes 3+ | Futuro | HU-23 → HU-49 |

### Funcionalidades completadas (Sprint 1)

- **Autenticación** — Supabase Auth con validación de dominio `@univo.edu.sv`. Solo cuentas institucionales.
- **RBAC** — Rol `ADMIN` (Decano) y `ENCARGADO` (Coordinador) asignados desde base de datos. Navegación diferenciada por rol.
- **Gestión de usuarios** — Panel para crear cuentas (nombre, carné, rol, carrera) sin afectar la sesión activa.
- **Check-in / Check-out** — Validación de geofencing en tiempo real vía RPC `validate_checkin_area`. Registro de hora firmada por servidor.
- **Dashboard** — Estadísticas globales, gráficas de asistencia (Recharts), mapa de sedes activas.
- **Módulo Decano** — Dashboard con KPIs reales desde Supabase, lista de estudiantes con cumplimiento, CRUD completo de sedes con geofence.
- **Historial de asistencias** — Tabla paginada con filtros por estudiante, práctica y estado. Export CSV.
- **Módulo Estudiantes / Prácticas / Reportes** — Vistas completas con datos en tiempo real.
- **Diseño responsive** — Mobile (360 px), tablet, desktop y ultrawide (≥ 1536 px).
- **Audit log** — Registro inmutable de acciones críticas (sign-out, eventos de seguridad).

---

## Configuración local (para todo el equipo)

> El backend corre en **Supabase Cloud** — no se necesita Docker ni Supabase local.

### Requisitos

- **Node.js 18 o superior** — verificar con `node -v`
- **pnpm** — el proyecto no acepta npm ni yarn

```bash
# Instalar pnpm si no lo tienes
npm install -g pnpm
```

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/ReneAraniva/UNIVO-Check-Health-.git
cd UNIVO-Check-Health-/Check-Health

# 2. Crear el archivo de variables de entorno
#    (pedir las credenciales a Carlos)
cp .env.example .env.local   # o crear el archivo manualmente

# 3. Instalar dependencias
pnpm install

# 4. Levantar el servidor de desarrollo
pnpm dev
```

La aplicación estará disponible en `http://localhost:5173`.

### Archivo `.env.local`

Crear el archivo `Check-Health/.env.local` con las siguientes variables (pedir valores al equipo):

```env
VITE_SUPABASE_URL=https://<proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<clave_anon_publica>
VITE_SUPABASE_SERVICE_ROLE=<clave_service_role>
```

> `.env.local` está en `.gitignore` — nunca subir las claves al repositorio.

### Credenciales de prueba

| Usuario | Correo | Rol |
|---------|--------|-----|
| Administrador | `admin@univo.edu.sv` | Decano (acceso completo) |
| Estudiante 1 | `U20240001@univo.edu.sv` | Encargado |

Contraseñas: solicitar al equipo. Para crear nuevos usuarios, usar el panel **Gestión de Usuarios** dentro de la app.

### Solución de errores comunes

| Error | Causa | Solución |
|-------|-------|---------|
| Página en blanco / error de módulo | Se usó `npm install` en vez de `pnpm` | Borrar `node_modules` y `package-lock.json`, luego `pnpm install` |
| `Invalid API key` en consola | `.env.local` no existe o tiene las claves incorrectas | Verificar el archivo y reiniciar `pnpm dev` |
| Login rechazado con correo válido | La cuenta no existe en Supabase Auth | Crearla desde el panel de Gestión de Usuarios |
| `node -v` < 18 | Vite 6 requiere Node 18+ | Actualizar Node con `nvm install 18` |

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite 6 |
| Estilos | Tailwind CSS 4 + shadcn/ui (Radix UI) |
| Estado | Zustand + React Hook Form |
| Gráficas | Recharts |
| Backend | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Routing | React Router 7 |
| Fechas | date-fns |
| Notificaciones | Sonner |
| Package manager | pnpm |

---

## Estructura del proyecto

```
Check-Health/
├── src/
│   ├── app/          # Rutas (React Router)
│   ├── modules/      # Módulos por feature
│   │   ├── admin/        # Gestión de usuarios
│   │   ├── attendance/   # Check-in / check-out
│   │   ├── dashboard/    # Dashboard principal
│   │   ├── dean/         # Panel del decano/coordinador
│   │   ├── practices/    # Prácticas / sedes
│   │   ├── reports/      # Reportes y exportación
│   │   └── students/     # Listado de estudiantes
│   └── shared/       # Layout, cliente Supabase, UI primitives
├── supabase/
│   └── migrations/   # Scripts SQL aplicados en Supabase Cloud
└── .env.local        # Variables de entorno (no subir a git)
```

---

## Flujo de trabajo Git

```bash
# Crear rama por feature
git checkout -b feature/HU-XX-descripcion

# Commit con prefijo
git commit -m "feat: descripción del cambio"

# Abrir Pull Request hacia main
# Revisión requerida antes de fusionar
```

Prefijos válidos: `feat:`, `fix:`, `docs:`, `refactor:`, `merge:`.

---

## Equipo

| Nombre | Carné | Rol |
|--------|-------|-----|
| Carlos Alberto Granados Amaya | U20240579 | Scrum Master / Full-stack |
| René Francisco Pacheco Araniva | U20240844 | Backend / Integraciones |
| Nelson René Rodríguez Quintanilla | U20240270 | Backend / Supabase |
| Verónica Nataly Morales Jiménez | U20220902 | Frontend / UI |
| David Alexander Urias Blanco | U20240435 | Frontend / Reportes |

Cátedra: **Diseño de Componentes Web** — Ing. José Adolfo Herrera Funes — UNIVO Ciclo I-2026.
