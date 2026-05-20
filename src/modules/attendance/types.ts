export interface DeviceInfo {
  browser: string;
  gpsAccuracy: number | null;
  connectionType: string;
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
  reviewStatus?: 'clear' | 'pending_review' | 'flagged';
  suspiciousReason?: string;
  deviceId?: string;
  deviceFingerprint?: string;
  deviceInfo?: DeviceInfo;
}

export interface AttendanceRecord extends Attendance {
  studentName: string;
  practiceName: string;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}
