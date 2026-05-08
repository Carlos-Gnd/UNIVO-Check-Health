import { loadFromStorage, saveToStorage } from '@/shared/utils/storage';
import { Practice } from '../types';

const STORAGE_KEY = 'univo_practices';

const mockPractices: Practice[] = [
  {
    id: '1',
    name: 'Práctica Hospitalaria - Emergencias',
    location: 'Hospital Nacional Rosales',
    supervisor: 'Dr. Roberto Martínez',
    schedule: 'Lunes a Viernes, 7:00 AM - 3:00 PM',
    startDate: '2026-01-15',
    endDate: '2026-05-30',
    description: 'Práctica en el área de emergencias con rotación en diferentes especialidades.',
  },
  {
    id: '2',
    name: 'Práctica de Enfermería Comunitaria',
    location: 'Unidad de Salud Santa Ana',
    supervisor: 'Lic. Carmen Vásquez',
    schedule: 'Martes y Jueves, 8:00 AM - 12:00 PM',
    startDate: '2026-02-01',
    endDate: '2026-06-15',
    description: 'Atención primaria en salud y programas de prevención comunitaria.',
  },
  {
    id: '3',
    name: 'Práctica de Fisioterapia Deportiva',
    location: 'Centro de Rehabilitación UNIVO',
    supervisor: 'Lic. Manuel Gómez',
    schedule: 'Lunes, Miércoles y Viernes, 2:00 PM - 6:00 PM',
    startDate: '2026-01-20',
    endDate: '2026-05-20',
    description: 'Rehabilitación de lesiones deportivas y terapias especializadas.',
  },
];

export const getPractices = (): Practice[] => {
  return loadFromStorage(STORAGE_KEY, mockPractices);
};

export const initPractices = (): void => {
  if (!localStorage.getItem(STORAGE_KEY)) {
    saveToStorage(STORAGE_KEY, mockPractices);
  }
};
