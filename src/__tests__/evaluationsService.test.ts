import { describe, it, expect, vi, beforeEach } from 'vitest';

// T-26.2 / T-26.3 — Evaluación semanal: upsert (una por estudiante/semana) y
// lectura del historial.

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  upsert: vi.fn(),
  fromResults: [] as Array<{ data?: unknown; error?: unknown }>,
}));

vi.mock('@/shared/backend/supabaseClient', () => ({
  supabase: {
    auth: { getUser: h.getUser },
    from: () => {
      const result = h.fromResults.shift() ?? { data: [], error: null };
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        upsert: (...args: unknown[]) => { h.upsert(...args); return builder; },
        then: (resolve: (v: unknown) => void) => resolve(result),
      };
      return builder;
    },
  },
}));

import {
  upsertWeeklyEvaluation,
  fetchStudentEvaluations,
} from '@/modules/teacher/services/evaluations.service';

beforeEach(() => {
  h.getUser.mockReset();
  h.upsert.mockReset();
  h.fromResults.length = 0;
  h.getUser.mockResolvedValue({ data: { user: { id: 'teacher-1' } } });
});

describe('upsertWeeklyEvaluation', () => {
  it('arma el payload con teacher_id y mapea las dimensiones, con on-conflict', async () => {
    h.fromResults.push({ error: null });

    const res = await upsertWeeklyEvaluation({
      studentId: 's1', weekStart: '2026-06-01',
      actitud: 5, puntualidad: 4, desempenoTecnico: 3, trabajoEquipo: 2,
      comentario: '  buen avance  ',
    });

    expect(h.upsert).toHaveBeenCalledWith(
      {
        teacher_id: 'teacher-1', student_id: 's1', week_start: '2026-06-01',
        actitud: 5, puntualidad: 4, desempeno_tecnico: 3, trabajo_equipo: 2,
        comentario: 'buen avance',
      },
      { onConflict: 'teacher_id,student_id,week_start' },
    );
    expect(res).toEqual({ ok: true });
  });

  it('convierte un comentario vacío en null', async () => {
    h.fromResults.push({ error: null });
    await upsertWeeklyEvaluation({
      studentId: 's1', weekStart: '2026-06-01',
      actitud: 3, puntualidad: 3, desempenoTecnico: 3, trabajoEquipo: 3, comentario: '   ',
    });
    expect(h.upsert.mock.calls[0][0]).toMatchObject({ comentario: null });
  });

  it('falla sin sesión', async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const res = await upsertWeeklyEvaluation({
      studentId: 's1', weekStart: '2026-06-01',
      actitud: 3, puntualidad: 3, desempenoTecnico: 3, trabajoEquipo: 3,
    });
    expect(res.ok).toBe(false);
  });

  it('propaga el error del upsert', async () => {
    h.fromResults.push({ error: { message: 'check constraint' } });
    const res = await upsertWeeklyEvaluation({
      studentId: 's1', weekStart: '2026-06-01',
      actitud: 9, puntualidad: 3, desempenoTecnico: 3, trabajoEquipo: 3,
    });
    expect(res).toEqual({ ok: false, message: 'check constraint' });
  });
});

describe('fetchStudentEvaluations', () => {
  it('mapea las filas al modelo de la vista', async () => {
    h.fromResults.push({
      data: [
        { id: 'e1', week_start: '2026-06-01', actitud: 5, puntualidad: 4,
          desempeno_tecnico: 3, trabajo_equipo: 2, comentario: 'ok', created_at: '2026-06-02T00:00:00Z' },
      ],
      error: null,
    });

    const [row] = await fetchStudentEvaluations('s1');
    expect(row).toEqual({
      id: 'e1', weekStart: '2026-06-01', actitud: 5, puntualidad: 4,
      desempenoTecnico: 3, trabajoEquipo: 2, comentario: 'ok', createdAt: '2026-06-02T00:00:00Z',
    });
  });

  it('devuelve [] ante error', async () => {
    h.fromResults.push({ data: null, error: { message: 'rls' } });
    expect(await fetchStudentEvaluations('s1')).toEqual([]);
  });
});
