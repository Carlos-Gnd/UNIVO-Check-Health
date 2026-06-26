import { describe, it, expect, vi, beforeEach } from 'vitest';

// T-32.1 — Flujo de escalamiento de justificaciones.
// La validación de rol y la transición de estado viven en el RPC
// `escalate_justification` (server-side). Aquí se prueba la capa cliente:
// que arme bien la llamada al RPC, normalice la nota y mapee la consulta de
// justificaciones rechazadas pendientes de escalar.

const rpc = vi.fn();
const order = vi.fn();

// Builder encadenable y "thenable": .select().eq().eq().order() se await-ea y
// resuelve { data, error }. Cada método devuelve el mismo builder.
function makeQuery() {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    order: (...args: unknown[]) => order(...args),
  };
  return builder;
}

vi.mock('@/shared/backend/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: () => makeQuery(),
  },
}));

import {
  escalateJustification,
  fetchRejectedJustifications,
} from '@/modules/dean/services/justifications.service';

beforeEach(() => {
  rpc.mockReset();
  order.mockReset();
});

describe('escalateJustification', () => {
  it('llama al RPC escalate_justification con id y nota recortada', async () => {
    rpc.mockResolvedValue({ error: null });

    const res = await escalateJustification('just-1', '  Revisar de nuevo  ');

    expect(rpc).toHaveBeenCalledWith('escalate_justification', {
      p_id: 'just-1',
      p_nota: 'Revisar de nuevo',
    });
    expect(res).toEqual({ ok: true });
  });

  it('convierte una nota vacía o solo espacios en null', async () => {
    rpc.mockResolvedValue({ error: null });

    await escalateJustification('just-1', '   ');

    expect(rpc).toHaveBeenCalledWith('escalate_justification', {
      p_id: 'just-1',
      p_nota: null,
    });
  });

  it('propaga el mensaje de error del RPC (p. ej. rol no autorizado)', async () => {
    rpc.mockResolvedValue({
      error: { message: 'Solo un coordinador puede escalar una justificación' },
    });

    const res = await escalateJustification('just-1', 'nota');

    expect(res).toEqual({
      ok: false,
      message: 'Solo un coordinador puede escalar una justificación',
    });
  });
});

describe('fetchRejectedJustifications', () => {
  it('mapea una fila rechazada completa al modelo del panel', async () => {
    order.mockResolvedValue({
      data: [
        {
          id: 'j1',
          attendance_id: 'a1',
          student_id: 's1',
          motivo: 'Cita médica',
          documento_url: 'https://x/doc.pdf',
          status: 'RECHAZADO',
          notas_revisor: 'Documento ilegible',
          creado_en: '2026-06-01T08:00:00.000Z',
          actualizado_en: '2026-06-02T09:00:00.000Z',
          student: { student_code: 'UNV-001', full_name: 'Ana López', career: 'Enfermería' },
          attendance: {
            date: '2026-06-01',
            check_in: '2026-06-01T07:00:00.000Z',
            check_out: null,
            campuses: { name: 'Hospital San Juan' },
          },
        },
      ],
      error: null,
    });

    const res = await fetchRejectedJustifications();

    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      id: 'j1',
      studentCode: 'UNV-001',
      studentName: 'Ana López',
      career: 'Enfermería',
      campusName: 'Hospital San Juan',
      reason: 'Cita médica',
      status: 'RECHAZADO',
      reviewerNotes: 'Documento ilegible',
    });
  });

  it('usa valores por defecto cuando faltan student/attendance', async () => {
    order.mockResolvedValue({
      data: [
        {
          id: 'j2',
          attendance_id: 'a2',
          student_id: 's2',
          motivo: 'Sin documento',
          documento_url: null,
          status: 'RECHAZADO',
          notas_revisor: null,
          creado_en: '2026-06-03T10:00:00.000Z',
          actualizado_en: '2026-06-03T11:00:00.000Z',
          student: null,
          attendance: null,
        },
      ],
      error: null,
    });

    const [row] = await fetchRejectedJustifications();

    expect(row.studentCode).toBe('Sin carnet');
    expect(row.studentName).toBe('Estudiante sin nombre');
    expect(row.career).toBe('Sin carrera');
    expect(row.campusName).toBe('Sede desconocida');
    // Sin attendance.date cae al prefijo de creado_en (yyyy-mm-dd).
    expect(row.attendanceDate).toBe('2026-06-03');
  });

  it('devuelve [] cuando la consulta falla', async () => {
    order.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await fetchRejectedJustifications()).toEqual([]);
  });
});
