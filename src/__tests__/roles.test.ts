import { describe, it, expect } from 'vitest';
import { canonicalRole, roleLabel } from '@/shared/utils/roles';

describe('canonicalRole', () => {
  it('mapea ADMIN y sus sinónimos a ADMIN (fix del decano ADMINISTRADOR)', () => {
    expect(canonicalRole('ADMIN')).toBe('ADMIN');
    expect(canonicalRole('ADMINISTRADOR')).toBe('ADMIN');
    expect(canonicalRole('administrador')).toBe('ADMIN');
    expect(canonicalRole('DECANO')).toBe('ADMIN');
    expect(canonicalRole('  Admin  ')).toBe('ADMIN');
  });

  it('mapea los sinónimos de coordinador', () => {
    expect(canonicalRole('COORDINATOR')).toBe('COORDINATOR');
    expect(canonicalRole('COORDINADOR')).toBe('COORDINATOR');
    expect(canonicalRole('ENCARGADO')).toBe('COORDINATOR');
  });

  it('mapea docente, alumno y representante', () => {
    expect(canonicalRole('DOCENTE')).toBe('TEACHER');
    expect(canonicalRole('TEACHER')).toBe('TEACHER');
    expect(canonicalRole('ESTUDIANTE')).toBe('STUDENT');
    expect(canonicalRole('ALUMNO')).toBe('STUDENT');
    expect(canonicalRole('STUDENT')).toBe('STUDENT');
    expect(canonicalRole('REPRESENTANTE')).toBe('REPRESENTATIVE');
    expect(canonicalRole('REPRESENTATIVE')).toBe('REPRESENTATIVE');
  });

  it('devuelve null para vacío o desconocido', () => {
    expect(canonicalRole('')).toBeNull();
    expect(canonicalRole(null)).toBeNull();
    expect(canonicalRole(undefined)).toBeNull();
    expect(canonicalRole('OTRO_ROL')).toBeNull();
  });
});

describe('roleLabel', () => {
  it('devuelve etiquetas en español por rol canónico', () => {
    expect(roleLabel('ADMINISTRADOR')).toBe('Decano');
    expect(roleLabel('COORDINADOR')).toBe('Encargado');
    expect(roleLabel('DOCENTE')).toBe('Docente');
    expect(roleLabel('ALUMNO')).toBe('Alumno');
    expect(roleLabel('REPRESENTANTE')).toBe('Representante');
    expect(roleLabel('xxx')).toBe('—');
  });
});
