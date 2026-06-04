// T-27.2: helpers puros para la firma del reporte consolidado del docente.
// Usan solo Web Crypto (disponible en Deno, Node 20+ y navegadores), sin APIs
// específicas de Deno, para que esta lógica sea unit-testable con Vitest.

// Construye el payload canónico que se sella: hash del PDF + autor + instante.
// El separador `|` evita ambigüedad entre campos.
export function buildSealPayload(reportHash: string, userId: string, signedAt: string): string {
  return `${reportHash}|${userId}|${signedAt}`;
}

// Sella el payload con HMAC-SHA256 y lo devuelve como hex en minúsculas (64 chars).
export async function hmacSeal(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
