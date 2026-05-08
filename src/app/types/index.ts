// Types for the application
export interface Student {
  id: string;
  name: string;
  carnet: string;
  email: string;
  career: string;
  photo?: string;
}

export interface Practice {
  id: string;
  name: string;
  location: string;
  supervisor: string;
  schedule: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface Attendance {
  id: string;
  studentId: string;
  practiceId: string;
  checkIn: string;
  checkOut?: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
  checkInLocation?: GeoPoint;
  checkOutLocation?: GeoPoint;
  securitySeal?: string;
  checkOutSecuritySeal?: string;
  workedHours?: number;
  reviewStatus?: 'clear' | 'pending_review';
  suspiciousReason?: string;
  deviceId?: string;
}

export interface AttendanceRecord extends Attendance {
  studentName: string;
  practiceName: string;
}

export type UserRole = 'Estudiante' | 'Docente' | 'Coordinador' | 'Representante de sede' | 'Administrador';

export interface GeoPoint {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}

export interface SessionCredential {
  token: string;
  expiresAt: string;
  type: 'short' | 'long';
}

export interface UserSession {
  userId: string;
  email: string;
  role: UserRole;
  access: string[];
  shortLived: SessionCredential;
  longLived: SessionCredential;
  createdAt: string;
  revokedAt?: string;
}
