import { describe, it, expect, vi, beforeEach } from 'vitest';

// T-23.2 — Servicio del grupo del docente: roster y snapshot de activos
// filtrados por las asignaciones de `teacher_groups` del docente autenticado.

// vi.hoisted evita problemas de TDZ: la fábrica de vi.mock se evalúa antes que
// las declaraciones de módulo, así que las dependencias mockeadas viven aquí.
const h = vi.hoisted(() => ({
  // Cola de resultados que devuelve cada llamada a supabase.from(...).
  fromResults: [] as Array<{ data: unknown; error: unknown }>,
  getUser: vi.fn(),
  snapshot: vi.fn(),
}));

vi.mock('@/shared/backend/supabaseClient', () => ({
  supabase: {
    auth: { getUser: h.getUser },
    // Builder encadenable y thenable; cada from() consume el siguiente resultado.
    from: () => {
      const result = h.fromResults.shift() ?? { data: [], error: null };
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        then: (resolve: (v: unknown) => void) => resolve(result),
      };
      return builder;
    },
  },
}));

vi.mock('@/shared/backend/checkHealthBackend', () => ({
  getActiveStudentsSnapshot: h.snapshot,
}));

import {
  fetchTeacherRoster,
  fetchTeacherActiveSnapshot,
} from '@/modules/teacher/services/teacher.service';

beforeEach(() => {
  h.fromResults.length = 0;
  h.getUser.mockReset();
  h.snapshot.mockReset();
  h.getUser.mockResolvedValue({ data: { user: { id: 'teacher-1' } } });
});

describe('fetchTeacherRoster', () => {
  it('devuelve [] si no hay sesión', async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    expect(await fetchTeacherRoster()).toEqual([]);
  });

  it('devuelve [] si el docente no tiene estudiantes asignados', async () => {
    h.fromResults.push({ data: [], error: null }); // getGroupStudentIds
    expect(await fetchTeacherRoster()).toEqual([]);
  });

  it('mapea el roster con materia/sede y descarta filas sin estudiante', async () => {
    // S4-04.1: una sola consulta a teacher_groups (filtrada por teacher_id).
    h.fromResults.push({
      data: [
        { campus_id: 'c1', subject_id: 'sub1', campus: { name: 'Rosales' }, subject: { name: 'Práctica I', code: 'ENF101' }, student: { id: 's1', full_name: 'Ana López', student_code: 'U1', career: 'Enfermería' } },
        { campus_id: null, subject_id: null, campus: null, subject: null, student: { id: 's2', full_name: null, student_code: null, career: null } },
        { campus_id: 'c3', subject_id: null, campus: null, subject: null, student: null }, // se descarta: sin studentId
      ],
      error: null,
    });

    const roster = await fetchTeacherRoster();

    expect(roster).toHaveLength(2);
    expect(roster[0]).toEqual({
      studentId: 's1', fullName: 'Ana López', studentCode: 'U1', career: 'Enfermería',
      campusId: 'c1', campusName: 'Rosales', subjectId: 'sub1', subjectName: 'ENF101 · Práctica I',
      goalDecision: null, schedule: [],
    });
    expect(roster[1]).toEqual({
      studentId: 's2', fullName: 'Sin nombre', studentCode: '', career: '—',
      campusId: null, campusName: 'Sin sede', subjectId: null, subjectName: 'Sin materia',
      goalDecision: null, schedule: [],
    });
  });

  it('devuelve [] si la consulta de asignaciones falla', async () => {
    h.fromResults.push({ data: null, error: { message: 'rls' } });
    expect(await fetchTeacherRoster()).toEqual([]);
  });
});

describe('fetchTeacherActiveSnapshot', () => {
  it('no consulta el snapshot si el grupo está vacío', async () => {
    h.fromResults.push({ data: [], error: null });
    expect(await fetchTeacherActiveSnapshot()).toEqual([]);
    expect(h.snapshot).not.toHaveBeenCalled();
  });

  it('filtra el snapshot global dejando solo a los estudiantes del grupo', async () => {
    h.fromResults.push({ data: [{ student_id: 's1' }, { student_id: 's3' }], error: null });
    h.snapshot.mockResolvedValue([
      { studentId: 's1', fullName: 'Ana' },
      { studentId: 's2', fullName: 'Beto' }, // fuera del grupo
      { studentId: 's3', fullName: 'Caro' },
    ]);

    const active = await fetchTeacherActiveSnapshot();

    expect(active.map((s: { studentId: string }) => s.studentId)).toEqual(['s1', 's3']);
  });
});
