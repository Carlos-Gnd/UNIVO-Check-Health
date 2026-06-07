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
