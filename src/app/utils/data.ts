import { Student, Practice, Attendance } from '../types';

// Mock data for students
export const mockStudents: Student[] = [
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

// Mock data for practices
export const mockPractices: Practice[] = [
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

// Mock data for attendance
export const mockAttendance: Attendance[] = [
  {
    id: '1',
    studentId: '1',
    practiceId: '1',
    checkIn: '2026-04-08T07:15:00',
    checkOut: '2026-04-08T15:00:00',
    date: '2026-04-08',
    status: 'present',
  },
  {
    id: '2',
    studentId: '2',
    practiceId: '1',
    checkIn: '2026-04-08T07:30:00',
    checkOut: '2026-04-08T15:10:00',
    date: '2026-04-08',
    status: 'late',
  },
  {
    id: '3',
    studentId: '3',
    practiceId: '3',
    checkIn: '2026-04-08T14:00:00',
    date: '2026-04-08',
    status: 'present',
  },
  {
    id: '4',
    studentId: '5',
    practiceId: '2',
    checkIn: '2026-04-08T08:00:00',
    checkOut: '2026-04-08T12:00:00',
    date: '2026-04-08',
    status: 'present',
  },
];

// Local storage helper functions
const STORAGE_KEYS = {
  STUDENTS: 'univo_students',
  PRACTICES: 'univo_practices',
  ATTENDANCE: 'univo_attendance',
};

export const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.error(`Error loading ${key}:`, error);
    return defaultValue;
  }
};

export const saveToStorage = <T,>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving ${key}:`, error);
  }
};

// Initialize data
export const initializeData = () => {
  if (!localStorage.getItem(STORAGE_KEYS.STUDENTS)) {
    saveToStorage(STORAGE_KEYS.STUDENTS, mockStudents);
  }
  if (!localStorage.getItem(STORAGE_KEYS.PRACTICES)) {
    saveToStorage(STORAGE_KEYS.PRACTICES, mockPractices);
  }
  if (!localStorage.getItem(STORAGE_KEYS.ATTENDANCE)) {
    saveToStorage(STORAGE_KEYS.ATTENDANCE, mockAttendance);
  }
};

// Data access functions
export const getStudents = (): Student[] => {
  return loadFromStorage(STORAGE_KEYS.STUDENTS, mockStudents);
};

export const getPractices = (): Practice[] => {
  return loadFromStorage(STORAGE_KEYS.PRACTICES, mockPractices);
};

export const getAttendance = (): Attendance[] => {
  return loadFromStorage(STORAGE_KEYS.ATTENDANCE, mockAttendance);
};

export const addAttendance = (attendance: Attendance): void => {
  const current = getAttendance();
  current.push(attendance);
  saveToStorage(STORAGE_KEYS.ATTENDANCE, current);
};

export const updateAttendance = (id: string, updates: Partial<Attendance>): void => {
  const current = getAttendance();
  const index = current.findIndex(a => a.id === id);
  if (index !== -1) {
    current[index] = { ...current[index], ...updates };
    saveToStorage(STORAGE_KEYS.ATTENDANCE, current);
  }
};
