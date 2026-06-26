import { describe, it, expect, vi, beforeEach } from 'vitest';

// T-36.1: generacion + doble firma del reporte consolidado del grupo.
// Se prueba el hash SHA-256 del PDF y que el cliente exige firma docente + sistema.

const h = vi.hoisted(() => ({
  invoke: vi.fn(),
  fetchTeacherRoster: vi.fn(),
  getActiveStudentsSnapshot: vi.fn(),
}));

vi.mock('jspdf', () => ({
  default: class {
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setFillColor() {}
    setDrawColor() {}
    setLineWidth() {}
    rect() {}
    roundedRect() {}
    line() {}
    text() {}
    addPage() {}
    save() {}
    output() { return new Uint8Array(8).buffer; }
    internal = { pageSize: { getHeight: () => 297 } };
  },
}));
vi.mock('jspdf-autotable', () => ({
  default: (doc: { lastAutoTable?: { finalY: number } }) => {
    doc.lastAutoTable = { finalY: 120 };
  },
}));

vi.mock('@/shared/backend/supabaseClient', () => ({
  supabase: { functions: { invoke: h.invoke } },
}));
vi.mock('@/shared/backend/checkHealthBackend', () => ({
  getActiveStudentsSnapshot: h.getActiveStudentsSnapshot,
}));
vi.mock('@/modules/teacher/services/teacher.service', () => ({
  fetchTeacherRoster: h.fetchTeacherRoster,
}));

import { sha256Hex, signGroupReport } from '@/modules/teacher/services/report.service';

beforeEach(() => {
  h.invoke.mockReset();
  h.fetchTeacherRoster.mockReset();
  h.getActiveStudentsSnapshot.mockReset();
  h.fetchTeacherRoster.mockResolvedValue([
    { studentId: 's1', fullName: 'Ana Lopez', studentCode: 'U1', career: 'Enfermeria', campusId: 'c1' },
  ]);
  h.getActiveStudentsSnapshot.mockResolvedValue([]);
});

describe('sha256Hex', () => {
  it('coincide con el vector conocido SHA-256("abc")', async () => {
    const bytes = new Uint8Array([0x61, 0x62, 0x63]);
    expect(await sha256Hex(bytes))
      .toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('signGroupReport', () => {
  it('firma el hash del PDF via sign-report y devuelve la doble firma', async () => {
    h.invoke.mockResolvedValue({
      data: {
        ok: true,
        seal: 'teacher-deadbeef',
        teacher_seal: 'teacher-deadbeef',
        system_seal: 'system-cafebabe',
        signed_at: '2026-06-04T12:00:00.000Z',
        signed_by: 'Dr. Rene',
        system_signed_by: 'UNIVO Check-Health',
      },
      error: null,
    });

    const res = await signGroupReport({ period: '2026-1', groupLabel: 'Enfermeria A' });

    const expectedHash = await sha256Hex(new Uint8Array(8));
    expect(h.invoke).toHaveBeenCalledWith('sign-report', {
      body: { report_hash: expectedHash, period: '2026-1', group_label: 'Enfermeria A' },
    });
    expect(res).toMatchObject({
      ok: true,
      seal: 'teacher-deadbeef',
      teacherSeal: 'teacher-deadbeef',
      systemSeal: 'system-cafebabe',
      signedBy: 'Dr. Rene',
      systemSignedBy: 'UNIVO Check-Health',
      reportHash: expectedHash,
    });
  });

  it('rechaza la respuesta si falta la firma del sistema', async () => {
    h.invoke.mockResolvedValue({
      data: { ok: true, seal: 'teacher-deadbeef', teacher_seal: 'teacher-deadbeef', signed_by: 'Dr. Rene' },
      error: null,
    });

    const res = await signGroupReport({ period: '2026-1' });

    expect(res.ok).toBe(false);
    expect(res.message).toBe('No se pudo firmar el reporte.');
  });

  it('propaga el error cuando sign-report rechaza la firma', async () => {
    h.invoke.mockResolvedValue({ data: { ok: false, error: 'No autorizado para firmar reportes.' }, error: null });

    const res = await signGroupReport({ period: '2026-1' });

    expect(res.ok).toBe(false);
    expect(res.message).toBe('No autorizado para firmar reportes.');
  });
});
