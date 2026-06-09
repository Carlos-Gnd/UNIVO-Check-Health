// T-27.2: helpers puros para la firma del reporte consolidado del docente.
// Usan solo Web Crypto (disponible en Deno, Node 20+ y navegadores), sin APIs
// específicas de Deno, para que esta lógica sea unit-testable con Vitest.

// Construye el payload canónico que se sella: hash del PDF + autor + instante.
// El separador `|` evita ambigüedad entre campos.
export function buildSealPayload(reportHash: string, userId: string, signedAt: string): string {
  return `${reportHash}|${userId}|${signedAt}`;
}

// Sella el payload con HMAC-SHA256 y lo devuelve como hex en minúsculas (64 chars).
export type ReportSignatureRole = 'system' | 'teacher';

export type ReportSignaturePayload = {
  reportHash: string;
  signerId: string;
  signedAt: string;
  role: ReportSignatureRole;
};

export const SYSTEM_REPORT_SIGNER_ID = 'UNIVO_CHECK_HEALTH_SYSTEM';
export const SYSTEM_REPORT_SIGNER_NAME = 'UNIVO Check-Health';

export function buildReportSignaturePayload(params: ReportSignaturePayload): string {
  return `${params.reportHash}|${params.role}|${params.signerId}|${params.signedAt}`;
}

export async function verifyReportSignature(params: ReportSignaturePayload & { seal: string; secret: string }): Promise<boolean> {
  const expected = await hmacSeal(buildReportSignaturePayload(params), params.secret);
  return expected === params.seal;
}

export async function hmacSeal(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// T-35.1 — Firma digital X.509 real (RSA-SHA256) sobre el payload del reporte.
// Solo Web Crypto: importa la clave privada PKCS#8 (PEM) y firma; el certificado
// X.509 acompaña la firma para que un verificador valide con la clave pública.
// ─────────────────────────────────────────────────────────────────────────────

// Convierte un bloque PEM (con o sin cabeceras) a los bytes DER. Sin anotación de
// retorno para que TS infiera Uint8Array<ArrayBuffer> (no SharedArrayBuffer).
export function pemToBytes(pem: string) {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Variante que devuelve ArrayBuffer (compatibilidad). Web Crypto acepta ambos.
export function pemToArrayBuffer(pem: string): ArrayBuffer {
  return pemToBytes(pem).buffer;
}

// Firma el payload con la clave privada RSA (PKCS#8 PEM) → firma base64.
export async function signRsaSha256(payload: string, privateKeyPem: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToBytes(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

// Huella SHA-256 del certificado X.509 (DER) en hex — identifica el certificado.
export async function certFingerprint(certPem: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', pemToBytes(certPem));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
