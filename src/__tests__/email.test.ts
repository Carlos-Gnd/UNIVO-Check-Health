import { describe, it, expect } from 'vitest';
import { toInstitutionalEmail, UNIVO_DOMAIN } from '@/shared/utils/email';

// T-54.1 — Login por carné: la entrada (carné o correo) se normaliza a correo
// institucional antes de autenticar.

describe('toInstitutionalEmail', () => {
  it('autocompleta el dominio cuando recibe solo el carné', () => {
    expect(toInstitutionalEmail('U20240000')).toBe(`u20240000${UNIVO_DOMAIN}`);
  });

  it('respeta un correo institucional ya completo', () => {
    expect(toInstitutionalEmail('U20240000@univo.edu.sv')).toBe('u20240000@univo.edu.sv');
  });

  it('recorta espacios y normaliza a minúsculas', () => {
    expect(toInstitutionalEmail('  U2024ABC  ')).toBe(`u2024abc${UNIVO_DOMAIN}`);
  });

  it('no toca correos de otro dominio (la validación posterior los rechaza)', () => {
    expect(toInstitutionalEmail('ajeno@gmail.com')).toBe('ajeno@gmail.com');
  });

  it('devuelve cadena vacía para entrada vacía', () => {
    expect(toInstitutionalEmail('   ')).toBe('');
  });
});
