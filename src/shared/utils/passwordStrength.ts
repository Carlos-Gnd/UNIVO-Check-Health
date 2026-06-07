// Evaluación de fuerza de contraseña (heurística simple, sin dependencias).
// Se usa en el cambio obligatorio de contraseña al primer ingreso.

export type StrengthLevel = 'débil' | 'media' | 'fuerte';

export type PasswordStrength = {
  score: number; // 0..5
  level: StrengthLevel;
};

// Suma puntos por longitud y variedad de caracteres.
export function passwordStrength(password: string): PasswordStrength {
  const pw = password ?? '';
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  let level: StrengthLevel = 'débil';
  if (score >= 4) level = 'fuerte';
  else if (score >= 2) level = 'media';

  // Una contraseña demasiado corta nunca es más que débil.
  if (pw.length < 8) return { score: Math.min(score, 1), level: 'débil' };

  return { score, level };
}

// Mínimo aceptable para el cambio obligatorio: al menos 8 chars y nivel ≥ media.
export function isAcceptablePassword(password: string): boolean {
  const { level } = passwordStrength(password);
  return (password ?? '').length >= 8 && level !== 'débil';
}
