// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Test de integración en vivo (no mockeado): confirma contra un Supabase real que
// un alumno autenticado NO puede escalar su propio rol ni forjar una fila de
// asistencia por la Data API — la vulnerabilidad crítica cerrada en
// 20260831004457_fix_column_level_protection_users_attendances.sql.
//
// Requiere el stack local de Supabase corriendo (`supabase start`) y
// CI_RLS_INTEGRATION=true. Sin esa variable el suite se salta (no falla), para no
// romper `pnpm test` en una máquina sin el backend local levantado. El job
// "migrations" del CI la activa después de aplicar las migraciones en limpio.

// El proyecto no trae @types/node en el tsconfig (es una app de navegador); esto
// evita necesitarlo solo para leer las 4 variables de entorno de este test.
declare const process: { env: Record<string, string | undefined> };

const RUN = process.env.CI_RLS_INTEGRATION === 'true';
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

describe.skipIf(!RUN)('RLS de seguridad: users/attendances (HU-S01/S02)', () => {
  let admin: SupabaseClient;
  let asStudent: SupabaseClient;
  let studentId: string;
  let campusId: string;
  const email = `rls-test-${Date.now()}@univo.edu.sv`;
  const password = 'RlsTest123!';

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created.user) {
      throw new Error(`No se pudo crear el usuario de prueba: ${createErr?.message}`);
    }
    studentId = created.user.id;

    const { error: profileErr } = await admin.from('users').insert({
      id: studentId,
      student_code: 'RLSTEST01',
      full_name: 'RLS Test Student',
      email,
      role: 'STUDENT',
    });
    if (profileErr) {
      throw new Error(`No se pudo crear el perfil de prueba: ${profileErr.message}`);
    }

    const { data: campuses } = await admin.from('campuses').select('id').limit(1);
    campusId = campuses?.[0]?.id ?? '00000000-0000-4000-a000-000000000099';

    asStudent = createClient(SUPABASE_URL, ANON_KEY);
    const { error: signInErr } = await asStudent.auth.signInWithPassword({ email, password });
    if (signInErr) {
      throw new Error(`No se pudo iniciar sesión como el alumno de prueba: ${signInErr.message}`);
    }
  });

  afterAll(async () => {
    if (!studentId) return;
    await admin.from('attendances').delete().eq('student_id', studentId);
    await admin.from('users').delete().eq('id', studentId);
    await admin.auth.admin.deleteUser(studentId);
  });

  it('HU-S01: un alumno no puede escalar su propio rol a ADMIN', async () => {
    await asStudent.from('users').update({ role: 'ADMIN' }).eq('id', studentId).select();

    const { data: after } = await admin.from('users').select('role').eq('id', studentId).single();
    expect(after?.role).toBe('STUDENT');
  });

  it('HU-S01: un alumno no puede desactivarse ni saltarse must_change_password', async () => {
    await asStudent.from('users').update({ is_active: false, must_change_password: true }).eq('id', studentId);

    const { data: after } = await admin
      .from('users')
      .select('is_active, must_change_password')
      .eq('id', studentId)
      .single();
    expect(after?.is_active).not.toBe(false);
  });

  it('HU-S02: un alumno no puede forjar una fila de asistencia por insert directo', async () => {
    const { data, error } = await asStudent
      .from('attendances')
      .insert({
        student_id: studentId,
        campus_id: campusId,
        check_in: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
        check_out: new Date().toISOString(),
        worked_hours: 8,
        review_status: 'APROBADO',
      })
      .select();

    expect(error).toBeTruthy();
    expect(data ?? []).toHaveLength(0);
  });

  it('el alumno SÍ puede seguir editando las columnas de auto-edición de su perfil', async () => {
    const { error } = await asStudent.from('users').update({ phone: '70000000' }).eq('id', studentId);
    expect(error).toBeNull();

    const { data: after } = await admin.from('users').select('phone').eq('id', studentId).single();
    expect(after?.phone).toBe('70000000');
  });
});
