<div align="center">

# UNIVO Check-Health

**Sistema de control de asistencia para prácticas clínicas**  
Universidad de Oriente (UNIVO) — El Salvador

[![Live Demo](https://img.shields.io/badge/Live%20Demo-univo--check--health.netlify.app-brightgreen?style=for-the-badge&logo=netlify)](https://univo-check-health.netlify.app/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

</div>

---

## Acerca del proyecto

UNIVO Check-Health digitaliza el ciclo completo del registro de asistencia en prácticas clínicas del área de salud. Reemplaza el control manual en papel con una solución web que valida la presencia física del estudiante mediante **geofencing GPS**, detecta falsificación de ubicación, y genera un **audit trail inmutable** de cada evento.

### Roles del sistema

| Rol | Descripción |
|-----|-------------|
| `STUDENT` | Registra entrada/salida con validación GPS |
| `ENCARGADO` | Coordinador de sede; supervisa asistencia en tiempo real |
| `ADMIN` | Decano; acceso completo a KPIs, reportes y configuración |

---

## Página en vivo

> Accede a la aplicación desplegada en Netlify:

**[https://univo-check-health.netlify.app/](https://univo-check-health.netlify.app/)**

---

## Modelo de seguridad y detección de fraude

La presencia física se verifica mediante tres capas independientes:

| Mecanismo | Descripción | Umbral |
|-----------|-------------|--------|
| **Geofencing GPS** | El servidor verifica que las coordenadas del dispositivo estén dentro del radio de la sede antes de registrar la asistencia | Radio configurable por sede |
| **Análisis de sensores IMU** | Detecta GPS simulado midiendo la varianza del acelerómetro y giroscopio; un dispositivo estático con GPS falso carece de microvibración natural | Confianza < 80 % → alerta |
| **Velocidad imposible** | Compara la posición de check-in con el último registro conocido; un desplazamiento físicamente imposible invalida el registro | > 140 km/h → rechazo |

Todos los eventos —incluyendo los rechazos— quedan registrados en el **audit log inmutable**, protegido por un trigger de base de datos que impide modificaciones.

---

## Funcionalidades

- **Autenticación institucional** — Supabase Auth restringido a correos `@univo.edu.sv`
- **Control de acceso por rol (RBAC)** — Navegación y vistas diferenciadas por `ADMIN`, `ENCARGADO` y `STUDENT`
- **Check-in / Check-out GPS** — Validación de geofencing en tiempo real mediante RPC `validate_checkin_area`
- **Detección de GPS falso** — Análisis de varianza de acelerómetro/giroscopio, umbral de confianza del 80 %
- **Detección de velocidad imposible** — Alerta si el desplazamiento supera 140 km/h entre registros consecutivos
- **Dashboard ejecutivo** — KPIs globales, gráficas Recharts y mapa interactivo de sedes (Leaflet)
- **Panel del Decano** — Lista de estudiantes con cumplimiento, CRUD de sedes con geofence editable
- **Gestión de usuarios** — Crear cuentas desde la app sin interrumpir la sesión activa
- **Historial de asistencias** — Tabla paginada con filtros; exportación CSV, PDF y XLSX
- **Audit log inmutable** — Registro de todas las acciones críticas protegido por trigger en base de datos
- **Diseño responsive** — Compatible con móvil (360 px), tablet, escritorio y ultrawide (≥ 1536 px)

---

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | React 18 + TypeScript + Vite 6 |
| Estilos | Tailwind CSS 4 + shadcn/ui (Radix UI) |
| Estado | Zustand + React Hook Form |
| Gráficas | Recharts |
| Mapas | Leaflet + react-leaflet |
| Backend | Supabase (PostgreSQL + Auth + Realtime) |
| Routing | React Router 7 |
| Exportación | jsPDF + SheetJS (xlsx) + CSV |
| Fechas | date-fns |
| Notificaciones | Sonner |
| Package manager | pnpm |

---

## Configuración local

> El backend corre en **Supabase Cloud** — no se necesita Docker ni Supabase local.

### Requisitos previos

- **Node.js 18+** — verificar con `node -v`
- **pnpm** — el proyecto rechaza npm y yarn

```bash
npm install -g pnpm
```

### Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/ReneAraniva/UNIVO-Check-Health-.git
cd "UNIVO-Check-Health-/Asistencia práctica salud app"

# 2. Instalar dependencias
pnpm install

# 3. Configurar variables de entorno (ver sección siguiente)

# 4. Iniciar el servidor de desarrollo
pnpm dev
```

La aplicación estará disponible en `http://localhost:5173`.

### Variables de entorno

Crear el archivo `.env.local` en la raíz del proyecto con las siguientes variables (solicitar valores al equipo):

```env
VITE_SUPABASE_URL=https://<proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<clave_anon_publica>
VITE_SUPABASE_SERVICE_ROLE=<clave_service_role>
```

> `.env.local` está en `.gitignore` — nunca subir las claves al repositorio.

### Solución de errores comunes

| Error | Causa | Solución |
|-------|-------|----------|
| Página en blanco o error de módulo | Se usó `npm install` en lugar de `pnpm` | Borrar `node_modules` y ejecutar `pnpm install` |
| `Invalid API key` en consola | `.env.local` ausente o con claves incorrectas | Verificar el archivo y reiniciar con `pnpm dev` |
| Login rechazado con correo válido | La cuenta no existe en Supabase Auth | Crearla desde el panel **Gestión de Usuarios** |
| `node -v` inferior a 18 | Vite 6 requiere Node 18+ | Actualizar con `nvm install 18` |

---

## Estructura del proyecto

```
Asistencia práctica salud app/
├── src/
│   ├── app/              # React Router (rutas + guards por rol)
│   ├── modules/          # Módulos por dominio de negocio
│   │   ├── admin/        # Gestión de usuarios
│   │   ├── attendance/   # Check-in / check-out + detección de fraude
│   │   ├── dashboard/    # Dashboard principal
│   │   ├── dean/         # Panel del Decano / Coordinador
│   │   ├── practices/    # Prácticas y sedes
│   │   ├── reports/      # Exportación CSV, PDF, XLSX
│   │   ├── rotations/    # Calendarios de rotación
│   │   └── students/     # Listado y progreso de estudiantes
│   └── shared/
│       ├── backend/      # Supabase clients + lógica de negocio
│       └── components/   # Layout, RoleGuard, shadcn/ui primitives
├── supabase/
│   └── migrations/       # Scripts SQL aplicados en Supabase Cloud
└── .env.local            # Variables de entorno (gitignored)
```

---

## Flujo de trabajo Git

```bash
# Crear rama por historia de usuario
git checkout -b feature/HU-XX-descripcion

# Commit semántico
git commit -m "feat: descripción del cambio"

# Abrir Pull Request hacia main
# Se requiere revisión antes de fusionar
```

**Prefijos válidos:** `feat:` `fix:` `docs:` `refactor:` `merge:`

---

## Equipo

| Nombre | Carné |
|--------|-------|
| Carlos Alberto Granados Amaya | U20240579 |
| René Francisco Pacheco Araniva | U20240844 |
| Nelson René Rodríguez Quintanilla | U20240270 |
| Verónica Nataly Morales Jiménez | U20220902 |
| David Alexander Urias Blanco | U20240435 |

**Cátedra:** Diseño de Componentes Web — Ing. José Adolfo Herrera Funes — UNIVO Ciclo I-2026
