import { describe, it, expect, vi, beforeEach } from 'vitest';

// T-30.1 — Revisión de justificaciones (aprobar/rechazar) + listado de pendientes.
// El trigger de audit_log es server-side; aquí se prueba la capa cliente.

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
        update: () => builder,
        eq: () => builder,
        order: () => builder,
        then: (resolve: (v: unknown) => void) => resolve(result),
      };
      return builder;
    },
  },
}));

import {
  reviewJustification,
  fetchPendingJustifications,
} from '@/modules/dean/services/justifications.service';

beforeEach(() => {
  h.getUser.mockReset();
  h.fromResults.length = 0;
  h.getUser.mockResolvedValue({ data: { user: { id: 'reviewer-1' } } });
});

describe('reviewJustification', () => {
  it('confirma la decisión cuando el update no falla', async () => {
    h.fromResults.push({ error: null });
    const res = await reviewJustification({ id: 'j1', status: 'APROBADO', notes: '  ok  ' });
    expect(res).toEqual({ ok: true });
  });

  it('propaga el mensaje de error del update', async () => {
    h.fromResults.push({ error: { message: 'rls denied' } });
    const res = await reviewJustification({ id: 'j1', status: 'RECHAZADO', notes: 'doc ilegible' });
    expect(res).toEqual({ ok: false, message: 'rls denied' });
  });
});

describe('fetchPendingJustifications', () => {
  it('mapea las filas pendientes con sus valores por defecto', async () => {
    h.fromResults.push({
      data: [
        {
          id: 'j1', attendance_id: 'a1', student_id: 's1', motivo: 'Cita',
          documento_url: null, status: 'PENDIENTE', notas_revisor: null,
          creado_en: '2026-06-01T08:00:00.000Z', actualizado_en: '2026-06-01T08:00:00.000Z',
          student: null, attendance: null,
        },
      ],
      error: null,
    });

    const [row] = await fetchPendingJustifications();
    expect(row).toMatchObject({
      id: 'j1', studentCode: 'Sin carnet', studentName: 'Estudiante sin nombre',
      campusName: 'Sede desconocida', status: 'PENDIENTE',
    });
  });

  it('devuelve [] ante error de consulta', async () => {
    h.fromResults.push({ data: null, error: { message: 'boom' } });
    expect(await fetchPendingJustifications()).toEqual([]);
  });
});
