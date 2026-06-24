# Esquema de base de datos y trabajos pg_cron (Q-07)

Documento de referencia del backend Supabase. Aclara el **esquema dual** `public`/`app`
y deja inventariados los **trabajos pg_cron**, todos persistidos en migraciones (no
activados a mano en el dashboard).

## 1. Esquema dual `public` vs `app`

| Esquema | Uso | Migraciones |
|---------|-----|-------------|
| **`public`** | **Canónico.** Es el que usa el proyecto en la nube: PostgREST lo expone, las RLS viven aquí, y toda la lógica real (tablas, RPCs, triggers, Edge Functions) opera sobre `public`. | `20260514000000_public_tables.sql` en adelante. |
| **`app`** | **Legado, solo desarrollo local.** Lo crean las migraciones `2024*` para `supabase start` (stack local con Docker). **La nube no lo usa.** | `20240101000000_init_checkhealth.sql`, `20240101000001_attendance.sql`. |

**Reglas:**
- Toda tabla/función/política **nueva** se crea en `public`. No agregar objetos a `app`.
- No se borran las migraciones `2024*` porque romperían el `supabase start` local; quedan
  documentadas como local-only. Si en la nube llegó a crearse el esquema `app` (por un
  `db push` que incluyó esas migraciones), es inofensivo: nada lo referencia.
- Fuente de verdad para tipos/consultas: siempre `public`.

## 2. Inventario de pg_cron

Todos los jobs se programan dentro de un bloque `DO` **idempotente** (verifican
`pg_extension`, hacen `unschedule` si ya existe y luego `schedule`), de modo que reaplicar
la migración no duplica el job. Horario en **UTC** (El Salvador = UTC−6).

| Job | Cron (UTC) | Llama a | Propósito | Migración |
|-----|-----------|---------|-----------|-----------|
| `checkhealth_detect_open_attendances_30m` | `*/30 * * * *` | `fn_run_open_attendance_omission_job()` | Alerta de omisión por asistencia abierta prolongada (HU-20). | `20260525000004` |
| `checkhealth_checkout_reminders` | `*/30 * * * *` | `fn_enqueue_checkout_reminders()` | Recordatorio de check-out al alumno (encuesta #1). | `20260530000005` |
| `checkhealth_close_due_cycles` | `0 7 * * *` (01:00 SV) | `close_due_cycles()` | Cierre automático del ciclo + horas auditadas por materia (T-34.1). | `20260605000008` |

### Obsoletos (desprogramados, no recrear)
| Job | Estado |
|-----|--------|
| `checkhealth_generate_daily_qrs` | **Desprogramado** en `20260530000008_fase3_static_qr_and_ip.sql`. El QR pasó de diario a **estático por sede** (Fase 3); ya no rota por día. |

## 3. Requisito de despliegue

`pg_cron` debe estar **habilitado** en el proyecto Supabase (Dashboard → Database →
Extensions, o `CREATE EXTENSION pg_cron;`). Si se habilita **después** de aplicar una
migración que programa un job, reejecutar el bloque `DO $outer$ ... $outer$` de esa
migración (los bloques avisan con `RAISE NOTICE` cuando la extensión no está activa).

Verificación rápida de los jobs activos:

```sql
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
```
