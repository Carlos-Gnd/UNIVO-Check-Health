import { loadFromStorage, saveToStorage } from '@/shared/utils/storage';
import { Attendance, DeviceInfo } from '../types';

const STORAGE_KEY = 'univo_attendance';

export const getDeviceInfo = (): DeviceInfo => {
  const ua = navigator.userAgent;
  let browser = 'Desconocido';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';

  const nav = navigator as Navigator & { connection?: { effectiveType?: string } };
  const connectionType = nav.connection?.effectiveType ?? '';

  return { browser, gpsAccuracy: null, connectionType };
};

const mockAttendance: Attendance[] = [
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

export const getAttendance = (): Attendance[] => {
  return loadFromStorage(STORAGE_KEY, mockAttendance);
};

export const addAttendance = (attendance: Attendance): void => {
  const current = getAttendance();
  current.push(attendance);
  saveToStorage(STORAGE_KEY, current);
};

export const updateAttendance = (id: string, updates: Partial<Attendance>): void => {
  const current = getAttendance();
  const index = current.findIndex(a => a.id === id);
  if (index !== -1) {
    current[index] = { ...current[index], ...updates };
    saveToStorage(STORAGE_KEY, current);
  }
};

export const initAttendance = (): void => {
  if (!localStorage.getItem(STORAGE_KEY)) {
    saveToStorage(STORAGE_KEY, mockAttendance);
  }
};
