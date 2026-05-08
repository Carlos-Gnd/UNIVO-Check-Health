# UNIVO Check-Health

Aplicación web para el **registro y control de asistencias** de prácticas del área de salud en la Universidad de Oriente (UNIVO).

## Objetivo del proyecto

Este sistema permite:

- Registrar entradas y salidas de estudiantes en prácticas.
- Gestionar estudiantes y prácticas.
- Visualizar reportes de asistencia.
- Exportar datos en CSV para revisión.

Actualmente, la app funciona con **datos locales (mock/localStorage)** para revisión académica. Más adelante se integrará backend y base de datos.

## Backend local Sprint 1 (Carlos)

Se agrego base de datos local para tareas de Sprint 1 con imagen de Supabase Postgres.

```bash
docker compose up -d
```

El script de inicializacion corre automaticamente desde:

```txt
supabase/sql/001_init_checkhealth.sql
```

Documentacion:
- `docs/backend/sprint1-carlos.md`
- `docs/qa/sprint1-casos-carlos.md`

## Demo local rápida

1. Instalar dependencias:

```bash
pnpm install
```

2. Levantar entorno de desarrollo:

```bash
pnpm dev
```

3. Abrir en navegador:

```txt
http://localhost:5173
```

## Build de producción

```bash
pnpm build
```

Para previsualizar build local:

```bash
pnpm preview
```

## Credenciales temporales (solo frontend)

- Correo: `David@gmail.com`
- Contraseña: `david123`

Estas credenciales son provisionales para revisión. No hay autenticación real con servidor todavía.

## Stack tecnológico

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Componentes UI (shadcn/radix + utilidades)
- date-fns
- sonner (notificaciones)

## Estructura principal

```txt
src/
  app/
    App.tsx
    routes.tsx
  modules/
    dashboard/
      components/
    attendance/
      components/
      services/
      types.ts
    students/
      components/
      services/
      types.ts
    practices/
      components/
      services/
      types.ts
    reports/
      components/
  shared/
    components/
      MainLayout.tsx      # Layout principal + login temporal
      NotFound.tsx
      ui/                 # Componentes reutilizables
    utils/
      storage.ts
  styles/
    index.css
    tailwind.css
    theme.css
  main.tsx
```

## Estado actual

- Login responsive implementado.
- Sidebar y navegación responsive.
- Vista de reportes adaptada:
  - Tabla en desktop.
  - Tarjetas en móvil/tablet.
- Arquitectura monolítica modular aplicada (`modules` + `shared`).
- Nombre de paquete actualizado a:
  - `@check-health/my-make-file`

## Flujo de trabajo recomendado para el equipo

1. Crear rama por feature:

```bash
git checkout -b feature/nombre-feature
```

2. Hacer cambios y commits claros.
3. Abrir Pull Request hacia `main`.
4. Pedir revisión de al menos 1 compañero antes de merge.

## Próximos pasos sugeridos

- Integrar backend (API REST o similar).
- Mover autenticación a servidor (JWT/sesiones).
- Conectar base de datos (estudiantes, prácticas, asistencias).
- Agregar validaciones de negocio y roles.
- Implementar pruebas (unitarias/integración).

## Notas importantes

- La información actual se guarda localmente en navegador.
- Al limpiar almacenamiento local, los datos pueden perderse.
- Proyecto orientado a avance académico y revisión funcional inicial.

