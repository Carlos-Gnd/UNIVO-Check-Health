// T-54.1: login por carné. La encuesta (N=98) indica que 90.8% prefiere
// ingresar el carné en vez del correo completo. Esta utilidad convierte la
// entrada (carné o correo) en el correo institucional para Supabase Auth.

export const UNIVO_DOMAIN = '@univo.edu.sv';

// "U20240000" -> "u20240000@univo.edu.sv"; un correo ya completo se respeta.
// Cadena vacía -> "" (la validación posterior la rechaza).
export function toInstitutionalEmail(input: string): string {
  const value = input.trim().toLowerCase();
  if (!value) return '';
  if (value.includes('@')) return value;
  return `${value}${UNIVO_DOMAIN}`;
}
