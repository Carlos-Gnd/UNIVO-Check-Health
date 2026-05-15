# UNIVO Check-Health

Aplicación web para el **registro y control de asistencias** de prácticas del área de salud en la Universidad de Oriente (UNIVO).

## Objetivo del proyecto

Digitalizar y auditar el ciclo completo de prácticas clínicas de la Facultad de Ciencias de la Salud, garantizando la integridad académica mediante:

- Verificación geográfica (Geofencing) para asegurar la presencia física.
- Registro de evidencias fotográficas con metadatos EXIF.
- Auditoría inmutable de registros de entrada y salida.
- Dashboard ejecutivo para la coordinación y supervisión docente.

## Configuración del Entorno de Desarrollo

Este proyecto utiliza **Supabase Local Development** para la base de datos y servicios de backend.

### 1. Requisitos previos
- Node.js (v18+)
- Docker Desktop (necesario para el backend local)
- pnpm

### 2. Levantar el Backend (Supabase)
En la raíz de la carpeta `Check-Health`:

```bash
# Iniciar contenedores de Supabase (Postgres, Auth, Storage, API)
npx supabase start

# Aplicar migraciones y semillas de datos si es necesario
npx supabase db reset
```

### 3. Levantar el Frontend
```bash
# Instalar dependencias
pnpm install

# Iniciar servidor de desarrollo
pnpm dev
```

La aplicación estará disponible en `http://localhost:5173`.

## Stack Tecnológico

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS.
- **Backend/DB:** Supabase (Postgres, PostgREST, Auth).
- **UI Components:** Radix UI / shadcn/ui.
- **Utilidades:** date-fns, sonner (notificaciones), recharts (gráficas), zustand (estado global).

## Estado del Proyecto

- **Autenticación:** Implementada mediante roles (Estudiante, Docente, Coordinador, Representante).
- **Asistencia:** Registro de Check-in/out funcional con validación de geocerca en tiempo real.
- **Persistencia:** Integración real con base de datos Postgres mediante el cliente oficial de Supabase.
- **Módulo de Coordinación (Decano):** Dashboard de estadísticas, gestión de alumnos y sedes.

## Flujo de Trabajo

1. Crear rama por feature: `git checkout -b feature/nombre-feature`
2. Realizar cambios y commits claros.
3. Abrir Pull Request hacia `main`.
4. Revisión técnica antes de fusionar.

## Notas importantes
- El proyecto se encuentra en fase de integración de microservicios.
- Las coordenadas de las sedes para pruebas están definidas en el archivo de semillas (`supabase/seed.sql`).

