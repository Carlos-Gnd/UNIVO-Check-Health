export type DeanAttendanceStatus = 'valid' | 'review' | 'absent';
export type DeanStudentStatus = 'at-risk' | 'in-progress' | 'completed';
export type LocationStatus = 'active' | 'inactive';

export interface DeanAttendance {
  id: string;
  date: string;
  checkInTime: string;
  sedeName: string;
  status: DeanAttendanceStatus;
}

export interface DeanStudent {
  id: string;
  carnet: string;
  fullName: string;
  career: string;
  sedeId: string;
  sedeName: string;
  doctorName: string;
  completedHours: number;
  goalHours: number;
  compliancePercentage: number;
  absences: number;
  status: DeanStudentStatus;
  attendances: DeanAttendance[];
}

export interface Location {
  id: string;
  name: string;
  address: string;
  coordinates: { lat: number; lng: number };
  allowedRadiusMeters: number;
  doctorName: string;
  doctorStatus: 'active' | 'inactive';
  totalStudents: number;
  averageCompliance: number;
  status: LocationStatus;
  students: DeanStudent[];
}

export interface DeanGlobalStats {
  totalStudents: number;
  globalComplianceRate: number;
  atRiskCount: number;
  activeLocations: number;
}

export interface DeanFilters {
  sede: string;
  status: 'all' | DeanStudentStatus;
  period: string;
  search: string;
}
