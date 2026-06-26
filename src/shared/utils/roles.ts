// Normalización canónica de roles. Existe UNA sola fuente de verdad para mapear los
// múltiples sinónimos de rol (ES/EN) a un valor canónico, y así evitar bugs como el
// del decano 'ADMINISTRADOR' que no matcheaba en guards/RLS.

export type CanonicalRole = 'ADMIN' | 'COORDINATOR' | 'TEACHER' | 'STUDENT' | 'REPRESENTATIVE';

export function canonicalRole(raw: string | null | undefined): CanonicalRole | null {
  const u = (raw ?? '').toUpperCase().trim();
  if (!u) return null;
  if (u === 'ADMIN' || u === 'ADMINISTRADOR' || u === 'DECANO') return 'ADMIN';
  if (u === 'COORDINATOR' || u === 'COORDINADOR' || u === 'ENCARGADO') return 'COORDINATOR';
  if (u === 'TEACHER' || u === 'DOCENTE') return 'TEACHER';
  if (u === 'STUDENT' || u === 'ESTUDIANTE' || u === 'ALUMNO') return 'STUDENT';
  if (u === 'REPRESENTATIVE' || u === 'REPRESENTANTE') return 'REPRESENTATIVE';
  return null;
}

// Etiqueta en español para mostrar en la UI.
export function roleLabel(raw: string | null | undefined): string {
  switch (canonicalRole(raw)) {
    case 'ADMIN': return 'Decano';
    case 'COORDINATOR': return 'Encargado';
    case 'TEACHER': return 'Docente';
    case 'STUDENT': return 'Alumno';
    case 'REPRESENTATIVE': return 'Representante';
    default: return '—';
  }
}
