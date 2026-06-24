export interface DeviceInfo {
  browser: string;
  gpsAccuracy: number | null;
  connectionType: string;
  motionSamples?: MotionSensorSample[];
  locationSamples?: GeoPointSample[];
  fakeGpsAnalysis?: FakeGpsAnalysis;
  isFakeGps?: boolean;
  fakeGpsConfidence?: number;
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
  reviewStatus?: 'PENDIENTE' | 'VALIDADO' | 'OBSERVADO';
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

export interface GeoPointSample extends GeoPoint {
  timestamp: number;
}

export interface MotionSensorSample {
  timestamp: number;
  accelerationMagnitude: number;
  rotationRateMagnitude: number;
}

export interface FakeGpsAnalysis {
  isFakeGps: boolean;
  confidence: number;
  reasons: string[];
  sampleCount: number;
  gpsDriftMeters: number;
  accelerationVariance: number;
  rotationVariance: number;
}
