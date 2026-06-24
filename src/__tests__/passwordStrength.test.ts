import { describe, it, expect } from 'vitest';
import { passwordStrength, isAcceptablePassword } from '@/shared/utils/passwordStrength';

// Fuerza de contraseña para el cambio obligatorio al primer ingreso.

describe('passwordStrength', () => {
  it('marca como débil una contraseña corta aunque tenga variedad', () => {
    expect(passwordStrength('Aa1$').level).toBe('débil');
  });

  it('marca como débil una larga pero monótona', () => {
    expect(passwordStrength('aaaaaaaaaaaa').level).toBe('media'); // 12+ chars suma, pero sin variedad
  });

  it('reconoce una contraseña fuerte (longitud + variedad)', () => {
    const s = passwordStrength('Univo2026$Seguro');
    expect(s.level).toBe('fuerte');
    expect(s.score).toBeGreaterThanOrEqual(4);
  });

  it('cadena vacía → débil, score 0', () => {
    expect(passwordStrength('')).toEqual({ score: 0, level: 'débil' });
  });
});

describe('isAcceptablePassword', () => {
  it('rechaza menos de 8 caracteres', () => {
    expect(isAcceptablePassword('Aa1$xy')).toBe(false);
  });

  it('rechaza débil', () => {
    expect(isAcceptablePassword('1234567')).toBe(false);
  });

  it('acepta una contraseña de fuerza media o más con 8+ caracteres', () => {
    expect(isAcceptablePassword('Univo2026')).toBe(true);
  });
});
