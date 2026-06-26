import { describe, it, expect } from 'vitest';
import {
  pemToArrayBuffer,
  signRsaSha256,
  certFingerprint,
} from '../../supabase/functions/_shared/reportSeal.ts';

// Convierte un ArrayBuffer a PEM con la cabecera indicada (para las pruebas).
function toPem(buf: ArrayBuffer, label: string): string {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  const lines = b64.match(/.{1,64}/g)?.join('\n') ?? b64;
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----`;
}

describe('pemToArrayBuffer', () => {
  it('decodifica un PEM ignorando cabeceras y espacios', () => {
    const original = new Uint8Array([1, 2, 3, 4, 250, 255]);
    const pem = toPem(original.buffer, 'TEST BLOCK');
    const back = new Uint8Array(pemToArrayBuffer(pem));
    expect([...back]).toEqual([...original]);
  });

  it('es equivalente con o sin cabeceras', () => {
    const bytes = new Uint8Array([9, 8, 7]);
    const pem = toPem(bytes.buffer, 'X');
    const raw = btoa(String.fromCharCode(...bytes));
    expect([...new Uint8Array(pemToArrayBuffer(pem))])
      .toEqual([...new Uint8Array(pemToArrayBuffer(raw))]);
  });
});

describe('certFingerprint', () => {
  it('es determinista (mismo cert → misma huella SHA-256 de 64 hex)', async () => {
    const cert = toPem(new Uint8Array([10, 20, 30, 40]).buffer, 'CERTIFICATE');
    const a = await certFingerprint(cert);
    const b = await certFingerprint(cert);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('cambia si cambia el certificado', async () => {
    const c1 = toPem(new Uint8Array([1]).buffer, 'CERTIFICATE');
    const c2 = toPem(new Uint8Array([2]).buffer, 'CERTIFICATE');
    expect(await certFingerprint(c1)).not.toBe(await certFingerprint(c2));
  });
});

describe('signRsaSha256', () => {
  it('produce una firma RSA verificable con la clave pública', async () => {
    const pair = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true, ['sign', 'verify'],
    );
    const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
    const privatePem = toPem(pkcs8, 'PRIVATE KEY');

    const payload = 'hash|system|UNIVO_CHECK_HEALTH_SYSTEM|2026-06-08T00:00:00.000Z';
    const sigB64 = await signRsaSha256(payload, privatePem);

    const sig = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5', pair.publicKey, sig, new TextEncoder().encode(payload),
    );
    expect(ok).toBe(true);
  });

  it('la firma no verifica si el payload cambia', async () => {
    const pair = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true, ['sign', 'verify'],
    );
    const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
    const sigB64 = await signRsaSha256('payload-original', toPem(pkcs8, 'PRIVATE KEY'));
    const sig = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5', pair.publicKey, sig, new TextEncoder().encode('payload-alterado'),
    );
    expect(ok).toBe(false);
  });
});
