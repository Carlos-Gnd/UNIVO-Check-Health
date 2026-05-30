// Código corto determinista de 6 chars (A-Z 0-9) derivado de campus_id + date + secret.
// Permite check-in manual sin cámara; el coordinador lo muestra junto al QR.
export async function deriveShortCode(
  campusId: string,
  date: string,
  secret: string,
): Promise<string> {
  const data = new TextEncoder().encode(`${campusId}:${date}:${secret}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hash);
  // Primeros 4 bytes → número sin signo → base36 uppercase → 6 chars
  const num = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return num.toString(36).toUpperCase().padStart(6, '0').slice(-6);
}
