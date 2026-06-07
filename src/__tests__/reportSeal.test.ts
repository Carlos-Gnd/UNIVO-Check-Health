import { describe, it, expect } from 'vitest';
import { buildSealPayload, hmacSeal } from '../../supabase/functions/_shared/reportSeal.ts';

// T-27.2 — Firma digital del reporte consolidado (sign-report Edge Function).
// La Edge Function es Deno; estos tests cubren su lógica criptográfica pura,
// extraída a _shared/reportSeal.ts para ser ejercitable con Vitest.

describe('buildSealPayload', () => {
  it('arma el payload canónico hash|userId|signedAt con separador "|"', () => {
    expect(buildSealPayload('abc123', 'user-1', '2026-06-04T00:00:00.000Z'))
      .toBe('abc123|user-1|2026-06-04T00:00:00.000Z');
  });

  it('mantiene el orden de los campos (no es conmutable)', () => {
    const a = buildSealPayload('h', 'u', 't');
    const b = buildSealPayload('u', 'h', 't');
    expect(a).not.toBe(b);
  });
});

describe('hmacSeal', () => {
  it('coincide con un vector conocido de HMAC-SHA256 (known-answer test)', async () => {
    // openssl/node: HMAC-SHA256(message="abc", key="key")
    expect(await hmacSeal('abc', 'key'))
      .toBe('9c196e32dc0175f86f4b1cb89289d6619de6bee699e4c378e68309ed97a1a6ab');
  });

  it('devuelve 64 caracteres hex en minúsculas (32 bytes)', async () => {
    const seal = await hmacSeal('payload-cualquiera', 'secreto');
    expect(seal).toMatch(/^[0-9a-f]{64}$/);
  });

  it('es determinista: mismo payload + secreto producen el mismo sello', async () => {
    const payload = buildSealPayload('hashX', 'docente-9', '2026-06-04T12:00:00.000Z');
    expect(await hmacSeal(payload, 'QR_JWT_SECRET')).toBe(await hmacSeal(payload, 'QR_JWT_SECRET'));
  });

  it('cambia el sello si cambia el secreto (no falsificable sin la clave)', async () => {
    const payload = buildSealPayload('hashX', 'docente-9', '2026-06-04T12:00:00.000Z');
    expect(await hmacSeal(payload, 'secreto-real')).not.toBe(await hmacSeal(payload, 'secreto-atacante'));
  });

  it('cambia el sello si cambia el hash del reporte (detecta manipulación del PDF)', async () => {
    const secret = 'QR_JWT_SECRET';
    const a = await hmacSeal(buildSealPayload('hash-original', 'd1', 't'), secret);
    const b = await hmacSeal(buildSealPayload('hash-alterado', 'd1', 't'), secret);
    expect(a).not.toBe(b);
  });
});
