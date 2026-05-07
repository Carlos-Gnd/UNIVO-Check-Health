import { loadFromStorage, saveToStorage } from '@/shared/utils/storage';
import { Student } from '../types';

const STORAGE_KEY = 'univo_students';

const mockStudents: Student[] = [
  {
    id: '1',
    name: 'María Fernanda García',
    carnet: 'UM-2024-001',
    email: 'mgarcia@univo.edu.sv',
    career: 'Enfermería',
    photo: 'https://images.unsplash.com/photo-1643297653753-2d3f459edc6b?w=200&h=200&fit=crop',
  },
  {
    id: '2',
    name: 'Carlos Roberto Mejía',
    carnet: 'UM-2024-002',
    email: 'cmejia@univo.edu.sv',
    career: 'Medicina',
    photo: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&h=200&fit=crop',
  },
  {
    id: '3',
    name: 'Ana Sofía Rodríguez',
    carnet: 'UM-2024-003',
    email: 'arodriguez@univo.edu.sv',
    career: 'Fisioterapia',
    photo: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=200&h=200&fit=crop',
  },
  {
    id: '4',
    name: 'José Luis Hernández',
    carnet: 'UM-2024-004',
    email: 'jhernandez@univo.edu.sv',
    career: 'Medicina',
    photo: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&h=200&fit=crop',
  },
  {
    id: '5',
    name: 'Gabriela Patricia Flores',
    carnet: 'UM-2024-005',
    email: 'gflores@univo.edu.sv',
    career: 'Enfermería',
    photo: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&h=200&fit=crop',
  },
  {
    id: '6',
    name: 'Daniel Alejandro Torres',
    carnet: 'UM-2024-006',
    email: 'dtorres@univo.edu.sv',
    career: 'Radiología',
    photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop',
  },
];

export const getStudents = (): Student[] => {
  return loadFromStorage(STORAGE_KEY, mockStudents);
};

export const initStudents = (): void => {
  if (!localStorage.getItem(STORAGE_KEY)) {
    saveToStorage(STORAGE_KEY, mockStudents);
  }
};
