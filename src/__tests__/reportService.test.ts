import { describe, it, expect, vi, beforeEach } from 'vitest';

// T-27.1 — Generación + firma del reporte consolidado del grupo.
// Se prueba el hash SHA-256 del PDF y el cableado con la Edge Function sign-report.

const h = vi.hoisted(() => ({
  invoke: vi.fn(),
  fetchTeacherRoster: vi.fn(),
}));

// jsPDF mockeado: output('arraybuffer') devuelve 8 bytes en cero (deterministas).
vi.mock('jspdf', () => ({
  default: class {
    setFontSize() {}
    text() {}
    save() {}
    output() { return new Uint8Array(8).buffer; }
  },
}));
vi.mock('jspdf-autotable', () => ({ default: () => {} }));

vi.mock('@/shared/backend/supabaseClient', () => ({
  supabase: { functions: { invoke: h.invoke } },
}));
vi.mock('@/modules/teacher/services/teacher.service', () => ({
  fetchTeacherRoster: h.fetchTeacherRoster,
}));

import { sha256Hex, signGroupReport } from '@/modules/teacher/services/report.service';

beforeEach(() => {
  h.invoke.mockReset();
  h.fetchTeacherRoster.mockReset();
  h.fetchTeacherRoster.mockResolvedValue([
    { studentId: 's1', fullName: 'Ana López', studentCode: 'U1', career: 'Enfermería', campusId: 'c1' },
  ]);
});

describe('sha256Hex', () => {
  it('coincide con el vector conocido SHA-256("abc")', async () => {
    const bytes = new Uint8Array([0x61, 0x62, 0x63]); // "abc"
    expect(await sha256Hex(bytes))
      .toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('signGroupReport', () => {
  it('firma el hash del PDF vía sign-report y devuelve el sello', async () => {
    h.invoke.mockResolvedValue({
      data: { ok: true, seal: 'deadbeef', signed_at: '2026-06-04T12:00:00.000Z', signed_by: 'Dr. René' },
      error: null,
    });

    const res = await signGroupReport({ period: '2026-1', groupLabel: 'Enfermería A' });

    // El hash enviado debe ser el SHA-256 de los 8 bytes en cero del PDF mock.
    const expectedHash = await sha256Hex(new Uint8Array(8));
    expect(h.invoke).toHaveBeenCalledWith('sign-report', {
      body: { report_hash: expectedHash, period: '2026-1', group_label: 'Enfermería A' },
    });
    expect(res).toMatchObject({ ok: true, seal: 'deadbeef', signedBy: 'Dr. René', reportHash: expectedHash });
  });

  it('propaga el error cuando sign-report rechaza la firma', async () => {
    h.invoke.mockResolvedValue({ data: { ok: false, error: 'No autorizado para firmar reportes.' }, error: null });

    const res = await signGroupReport({ period: '2026-1' });

    expect(res.ok).toBe(false);
    expect(res.message).toBe('No autorizado para firmar reportes.');
  });
});
