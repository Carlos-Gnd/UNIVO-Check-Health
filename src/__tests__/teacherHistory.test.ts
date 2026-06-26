import { describe, it, expect, vi, beforeEach } from 'vitest';

// T-28.1 — Historial de decisiones del docente (lee audit_log) + normalización
// del estado a partir de la acción y los detalles del evento.

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
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
        in: () => builder,
        order: () => builder,
        limit: () => builder,
        then: (resolve: (v: unknown) => void) => resolve(result),
      };
      return builder;
    },
  },
}));

import { fetchTeacherDecisionHistory } from '@/modules/teacher/services/teacherHistory.service';

beforeEach(() => {
  h.getUser.mockReset();
  h.fromResults.length = 0;
  h.getUser.mockResolvedValue({ data: { user: { id: 'teacher-1' } } });
});

describe('fetchTeacherDecisionHistory', () => {
  it('devuelve [] sin sesión', async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    expect(await fetchTeacherDecisionHistory()).toEqual([]);
  });

  it('normaliza los estados y resuelve el nombre del estudiante', async () => {
    // 1ª consulta: audit_log. 2ª consulta: users por id.
    h.fromResults.push({
      data: [
        { id: 1, action: 'JUSTIFICATION_REVIEWED', event_at: 't1', target_user_id: 's1',
          details: { justification_id: 'j1', status_nuevo: 'APROBADO', escalated: false, notas_revisor: 'ok' } },
        { id: 2, action: 'JUSTIFICATION_ESCALATED', event_at: 't2', target_user_id: 's2',
          details: { justification_id: 'j2', status_nuevo: 'PENDIENTE', escalated: true } },
        { id: 3, action: 'JUSTIFICATION_REVIEWED', event_at: 't3', target_user_id: null,
          details: { status_nuevo: 'RARO' } },
      ],
      error: null,
    });
    h.fromResults.push({
      data: [
        { id: 's1', full_name: 'Ana López', student_code: 'U1' },
        { id: 's2', full_name: 'Beto Ruiz', student_code: 'U2' },
      ],
      error: null,
    });

    const rows = await fetchTeacherDecisionHistory();

    expect(rows[0]).toMatchObject({ status: 'APROBADO', studentName: 'Ana López', reviewerNotes: 'ok' });
    expect(rows[1]).toMatchObject({ status: 'ESCALADO', studentName: 'Beto Ruiz', escalated: true });
    // status desconocido + sin estudiante → defaults
    expect(rows[2]).toMatchObject({ status: 'DESCONOCIDO', studentName: 'Estudiante sin nombre' });
  });

  it('devuelve [] ante error de audit_log', async () => {
    h.fromResults.push({ data: null, error: { message: 'rls' } });
    expect(await fetchTeacherDecisionHistory()).toEqual([]);
  });
});
