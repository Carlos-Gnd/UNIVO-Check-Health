import { describe, it, expect } from 'vitest';
import { csvCell } from '@/modules/dean/services/cycleExport.service';

describe('csvCell (HU-37)', () => {
  it('deja sin comillas los valores simples', () => {
    expect(csvCell('Ana Lopez')).toBe('Ana Lopez');
    expect(csvCell(240)).toBe('240');
  });

  it('representa null/undefined como cadena vacía', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('entrecomilla y escapa cuando hay comas, comillas o saltos de línea', () => {
    expect(csvCell('Rosales, San Salvador')).toBe('"Rosales, San Salvador"');
    expect(csvCell('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(csvCell('linea1\nlinea2')).toBe('"linea1\nlinea2"');
  });
});
