import { describe, it, expect } from 'vitest';
import {
  SYSTEM_REPORT_SIGNER_ID,
  buildReportSignaturePayload,
  buildSealPayload,
  hmacSeal,
  verifyReportSignature,
} from '../../supabase/functions/_shared/reportSeal.ts';

describe('buildSealPayload', () => {
  it('arma el payload canonico hash|userId|signedAt con separador "|"', () => {
    expect(buildSealPayload('abc123', 'user-1', '2026-06-04T00:00:00.000Z'))
      .toBe('abc123|user-1|2026-06-04T00:00:00.000Z');
  });

  it('mantiene el orden de los campos', () => {
    const a = buildSealPayload('h', 'u', 't');
    const b = buildSealPayload('u', 'h', 't');
    expect(a).not.toBe(b);
  });
});

describe('buildReportSignaturePayload', () => {
  it('incluye hash, rol, firmante y fecha para doble firma', () => {
    expect(buildReportSignaturePayload({
      reportHash: 'hash-1',
      role: 'teacher',
      signerId: 'docente-1',
      signedAt: '2026-06-07T20:00:00.000Z',
    })).toBe('hash-1|teacher|docente-1|2026-06-07T20:00:00.000Z');
  });

  it('separa la firma del sistema de la firma docente', () => {
    const signedAt = '2026-06-07T20:00:00.000Z';
    const teacher = buildReportSignaturePayload({
      reportHash: 'hash-1',
      role: 'teacher',
      signerId: 'docente-1',
      signedAt,
    });
    const system = buildReportSignaturePayload({
      reportHash: 'hash-1',
      role: 'system',
      signerId: SYSTEM_REPORT_SIGNER_ID,
      signedAt,
    });
    expect(teacher).not.toBe(system);
  });
});

describe('hmacSeal', () => {
  it('coincide con un vector conocido de HMAC-SHA256', async () => {
    expect(await hmacSeal('abc', 'key'))
      .toBe('9c196e32dc0175f86f4b1cb89289d6619de6bee699e4c378e68309ed97a1a6ab');
  });

  it('devuelve 64 caracteres hex en minusculas', async () => {
    const seal = await hmacSeal('payload-cualquiera', 'secreto');
    expect(seal).toMatch(/^[0-9a-f]{64}$/);
  });

  it('es determinista', async () => {
    const payload = buildSealPayload('hashX', 'docente-9', '2026-06-04T12:00:00.000Z');
    expect(await hmacSeal(payload, 'QR_JWT_SECRET')).toBe(await hmacSeal(payload, 'QR_JWT_SECRET'));
  });

  it('cambia el sello si cambia el secreto', async () => {
    const payload = buildSealPayload('hashX', 'docente-9', '2026-06-04T12:00:00.000Z');
    expect(await hmacSeal(payload, 'secreto-real')).not.toBe(await hmacSeal(payload, 'secreto-atacante'));
  });

  it('cambia el sello si cambia el hash del reporte', async () => {
    const secret = 'QR_JWT_SECRET';
    const a = await hmacSeal(buildSealPayload('hash-original', 'd1', 't'), secret);
    const b = await hmacSeal(buildSealPayload('hash-alterado', 'd1', 't'), secret);
    expect(a).not.toBe(b);
  });

  it('verifica una firma de reporte y rechaza un rol distinto', async () => {
    const secret = 'QR_JWT_SECRET';
    const payload = {
      reportHash: 'hash-reporte',
      role: 'teacher' as const,
      signerId: 'docente-1',
      signedAt: '2026-06-07T20:00:00.000Z',
    };
    const seal = await hmacSeal(buildReportSignaturePayload(payload), secret);

    await expect(verifyReportSignature({ ...payload, seal, secret })).resolves.toBe(true);
    await expect(verifyReportSignature({ ...payload, role: 'system', seal, secret })).resolves.toBe(false);
  });
});
