import { addAttendance, getAttendance, updateAttendance } from '@/modules/attendance/services/attendance.service';
import { Attendance, GeoPoint } from '@/modules/attendance/types';
import { getPractices } from '@/modules/practices/services/practices.service';
import { Practice } from '@/modules/practices/types';
import { getStudents } from '@/modules/students/services/students.service';
import { SessionCredential, UserRole, UserSession } from './types';

type SiteCoverage = GeoPoint & {
  radiusMeters: number;
};

type ActiveStudentRecord = {
  studentId: string;
  studentName: string;
  career: string;
  practiceId: string;
  siteName: string;
  checkIn: string;
  hoursToday: number;
  totalCycleHours: number;
  lastLocation?: GeoPoint;
};

type AttendanceResult = {
  ok: boolean;
  attendance?: Attendance;
  message: string;
};

type LocationReviewJob = {
  id: string;
  attendanceId: string;
  type: 'check-in' | 'check-out';
  createdAt: string;
  processedAt?: string;
};

type CoordinatorAlert = {
  id: string;
  attendanceId: string;
  studentId: string;
  message: string;
  createdAt: string;
  read: boolean;
};

const BACKEND_STORAGE_KEYS = {
  SESSIONS: 'checkhealth_backend_sessions',
  ROLE_ASSIGNMENTS: 'checkhealth_backend_role_assignments',
  HOURS_CACHE: 'checkhealth_backend_hours_cache',
  LOCATION_REVIEW_JOBS: 'checkhealth_backend_location_review_jobs',
  COORDINATOR_ALERTS: 'checkhealth_backend_coordinator_alerts',
};

const ROLE_ACCESS: Record<UserRole, string[]> = {
  Estudiante: ['dashboard:student', 'attendance:self'],
  Docente: ['dashboard:teacher', 'attendance:read'],
  Coordinador: ['dashboard:coordinator', 'attendance:read', 'attendance:write', 'sessions:revoke'],
  'Representante de sede': ['dashboard:site', 'attendance:read'],
  Administrador: ['dashboard:admin', 'attendance:read', 'attendance:write', 'sessions:revoke', 'roles:write'],
};

const SITE_COVERAGE_BY_PRACTICE_ID: Record<string, SiteCoverage> = {
  '1': { latitude: 13.7013, longitude: -89.2045, radiusMeters: 100 },
  '2': { latitude: 13.9942, longitude: -89.5597, radiusMeters: 100 },
  '3': { latitude: 13.4869, longitude: -88.1771, radiusMeters: 100 },
};

const EARTH_RADIUS_METERS = 6371000;
const SHORT_SESSION_MINUTES = 15;
const LONG_SESSION_DAYS = 7;
const MAX_HUMAN_SPEED_KMH = 140;
const REVIEW_DELAY_MS = 250;

const COORD_EMAIL = 'david@gmail.com';

const readBackendStorage = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.error(`Error reading ${key}:`, error);
    return fallback;
  }
};

const writeBackendStorage = <T,>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing ${key}:`, error);
  }
};

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60 * 1000);

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const toRadians = (degrees: number) => degrees * (Math.PI / 180);

const distanceInMeters = (from: GeoPoint, to: GeoPoint) => {
  const latitudeDistance = toRadians(to.latitude - from.latitude);
  const longitudeDistance = toRadians(to.longitude - from.longitude);
  const startLatitude = toRadians(from.latitude);
  const endLatitude = toRadians(to.latitude);

  const haversine =
    Math.sin(latitudeDistance / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDistance / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const createToken = (payload: any, type: 'short' | 'long') => {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({ 
    ...payload, 
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor((type === 'short' ? Date.now() + SHORT_SESSION_MINUTES * 60 * 1000 : Date.now() + LONG_SESSION_DAYS * 24 * 60 * 60 * 1000) / 1000)
  }));
  const signature = simpleHash(`${header}.${body}.secret_RS256_mock`);
  return `${header}.${body}.${signature}`;
};

const createCredential = (userId: string, type: SessionCredential['type'], now: Date): SessionCredential => ({
  token: createToken({ sub: userId, type }, type),
  expiresAt: (type === 'short' ? addMinutes(now, SHORT_SESSION_MINUTES) : addDays(now, LONG_SESSION_DAYS)).toISOString(),
  type,
});

const simpleHash = (payload: string) => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
};

const createSecuritySeal = (attendance: Pick<Attendance, 'id' | 'studentId' | 'practiceId' | 'checkIn' | 'checkOut' | 'date'>) => {
  const payload = [
    attendance.id,
    attendance.studentId,
    attendance.practiceId,
    attendance.checkIn,
    attendance.checkOut ?? '',
    attendance.date,
  ].join('|');

  return `seal_${simpleHash(payload)}_${simpleHash(payload.split('').reverse().join(''))}`;
};

const getCoverageForPractice = (practiceId: string): SiteCoverage => {
  return SITE_COVERAGE_BY_PRACTICE_ID[practiceId] ?? SITE_COVERAGE_BY_PRACTICE_ID['3'];
};

export const getTrustedPracticeLocation = (practiceId: string): GeoPoint => {
  const coverage = getCoverageForPractice(practiceId);

  return {
    latitude: coverage.latitude,
    longitude: coverage.longitude,
    accuracyMeters: 5,
  };
};

const getOfficialServerTime = () => new Date();

export const assignAccessLevel = (email: string): { role: UserRole; access: string[] } => {
  const normalizedEmail = email.trim().toLowerCase();
  const domain = normalizedEmail.split('@')[1];
  
  // Asignación por dominio (HU-04)
  let role: UserRole = 'Estudiante';
  
  if (domain === 'coordinador.univo.edu.sv' || normalizedEmail === COORD_EMAIL) {
    role = 'Coordinador';
  } else if (domain === 'docente.univo.edu.sv') {
    role = 'Docente';
  } else if (domain === 'hospital.edu.sv') {
    role = 'Representante de sede';
  } else if (domain === 'admin.univo.edu.sv') {
    role = 'Administrador';
  }

  return {
    role,
    access: ROLE_ACCESS[role],
  };
};

export const generateSessionCredentials = (email: string, userId = email.trim().toLowerCase()): UserSession => {
  const normalizedEmail = email.trim().toLowerCase();
  const now = getOfficialServerTime();
  const accessLevel = assignAccessLevel(normalizedEmail);
  const session: UserSession = {
    userId,
    email: normalizedEmail,
    role: accessLevel.role,
    access: accessLevel.access,
    shortLived: createCredential(userId, 'short', now),
    longLived: createCredential(userId, 'long', now),
    createdAt: now.toISOString(),
  };
  const sessions = readBackendStorage<UserSession[]>(BACKEND_STORAGE_KEYS.SESSIONS, []);

  writeBackendStorage(BACKEND_STORAGE_KEYS.SESSIONS, [...sessions, session]);

  return session;
};

export const revokeUserSessions = (targetUserId: string): void => {
  const now = getOfficialServerTime().toISOString();
  const sessions = readBackendStorage<UserSession[]>(BACKEND_STORAGE_KEYS.SESSIONS, []);

  writeBackendStorage(
    BACKEND_STORAGE_KEYS.SESSIONS,
    sessions.map((session) => (session.userId === targetUserId ? { ...session, revokedAt: now } : session)),
  );
};

const getHoursCache = () => readBackendStorage<Record<string, number>>(BACKEND_STORAGE_KEYS.HOURS_CACHE, {});

const updateHoursCache = (studentId: string, hours: number) => {
  const cache = getHoursCache();
  writeBackendStorage(BACKEND_STORAGE_KEYS.HOURS_CACHE, {
    ...cache,
    [studentId]: Number(((cache[studentId] ?? 0) + hours).toFixed(2)),
  });
};

const validateLocationInsidePractice = (practiceId: string, location: GeoPoint) => {
  const coverage = getCoverageForPractice(practiceId);
  const distance = distanceInMeters(location, coverage);
  const tolerance = location.accuracyMeters ?? 0;

  return {
    distance,
    isInside: distance <= coverage.radiusMeters + tolerance,
  };
};

const getActiveAttendance = (studentId: string, practiceId?: string) => {
  return getAttendance().find((attendance) => {
    const sameStudent = attendance.studentId === studentId;
    const samePractice = practiceId ? attendance.practiceId === practiceId : true;
    return sameStudent && samePractice && !attendance.checkOut;
  });
};

const queueLocationReview = (attendanceId: string, type: LocationReviewJob['type']) => {
  const jobs = readBackendStorage<LocationReviewJob[]>(BACKEND_STORAGE_KEYS.LOCATION_REVIEW_JOBS, []);
  const job: LocationReviewJob = {
    id: `job_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    attendanceId,
    type,
    createdAt: getOfficialServerTime().toISOString(),
  };

  writeBackendStorage(BACKEND_STORAGE_KEYS.LOCATION_REVIEW_JOBS, [...jobs, job]);
  window.setTimeout(() => processLocationReviewJob(job), REVIEW_DELAY_MS);
};

const addCoordinatorAlert = (alert: Omit<CoordinatorAlert, 'id' | 'createdAt' | 'read'>) => {
  const alerts = readBackendStorage<CoordinatorAlert[]>(BACKEND_STORAGE_KEYS.COORDINATOR_ALERTS, []);
  writeBackendStorage(BACKEND_STORAGE_KEYS.COORDINATOR_ALERTS, [
    ...alerts,
    {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      createdAt: getOfficialServerTime().toISOString(),
      read: false,
    },
  ]);
};

const processLocationReviewJob = (job: LocationReviewJob) => {
  const attendance = getAttendance().find((record) => record.id === job.attendanceId);

  if (!attendance) {
    return;
  }

  const previousRecords = getAttendance()
    .filter((record) => record.studentId === attendance.studentId && record.id !== attendance.id && record.checkInLocation)
    .sort((a, b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime());
  const previous = previousRecords[0];
  const currentLocation = job.type === 'check-out' ? attendance.checkOutLocation : attendance.checkInLocation;

  if (!previous || !currentLocation || !previous.checkInLocation) {
    return;
  }

  const previousTime = new Date(previous.checkOut ?? previous.checkIn).getTime();
  const currentTime = new Date(job.type === 'check-out' ? attendance.checkOut ?? attendance.checkIn : attendance.checkIn).getTime();
  const elapsedHours = Math.max((currentTime - previousTime) / (1000 * 60 * 60), 0.01);
  const speedKmh = (distanceInMeters(previous.checkInLocation, currentLocation) / 1000) / elapsedHours;

  if (speedKmh > MAX_HUMAN_SPEED_KMH) {
    const reason = `Desplazamiento inusual detectado: ${Math.round(speedKmh)} km/h entre registros.`;
    updateAttendance(attendance.id, {
      reviewStatus: 'pending_review',
      suspiciousReason: reason,
    });
    addCoordinatorAlert({
      attendanceId: attendance.id,
      studentId: attendance.studentId,
      message: reason,
    });
  }
};

import { supabase } from './supabaseClient';

export const registerStudentCheckIn = async (params: {
  studentId: string;
  practiceId: string;
  location: GeoPoint;
  notes?: string;
  deviceId?: string;
}): Promise<AttendanceResult> => {
  // Use Supabase RPC to validate location against campus radius
  const { data: validationData, error: validationError } = await supabase.rpc('validate_checkin_area', {
    p_campus_id: params.practiceId,
    p_current_lat: params.location.latitude,
    p_current_lng: params.location.longitude
  });

  if (validationError || !validationData || !validationData[0]?.is_allowed) {
    return {
      ok: false,
      message: validationData?.[0]?.message || 'Registro rechazado: Ubicación inválida o fuera de rango.',
    };
  }

  // Check for active attendance
  const { data: activeRecords } = await supabase
    .from('attendances')
    .select('*')
    .eq('student_id', params.studentId)
    .is('check_out', null);

  if (activeRecords && activeRecords.length > 0) {
    return {
      ok: false,
      message: 'Este estudiante ya tiene una entrada activa.',
    };
  }

  // Insert real attendance
  const { data: attendanceData, error: insertError } = await supabase
    .from('attendances')
    .insert([{
      student_id: params.studentId,
      campus_id: params.practiceId,
      notes: params.notes,
      check_in_location: params.location,
      device_id: params.deviceId,
      status: 'present'
    }])
    .select()
    .single();

  if (insertError) {
    return { ok: false, message: 'Error registrando asistencia en la base de datos.' };
  }

  return {
    ok: true,
    attendance: attendanceData as any,
    message: 'Entrada registrada con hora oficial del servidor.',
  };
};

export const registerStudentCheckOut = async (params: {
  attendanceId: string;
  location: GeoPoint;
  deviceId?: string;
}): Promise<AttendanceResult> => {
  const { data: attendance, error: fetchError } = await supabase
    .from('attendances')
    .select('*, campus_id')
    .eq('id', params.attendanceId)
    .single();

  if (fetchError || !attendance) {
    return { ok: false, message: 'No se encontro el registro activo.' };
  }

  if (attendance.check_out) {
    return { ok: false, message: 'La salida ya fue registrada para esta jornada.' };
  }

  const { data: validationData, error: validationError } = await supabase.rpc('validate_checkin_area', {
    p_campus_id: attendance.campus_id,
    p_current_lat: params.location.latitude,
    p_current_lng: params.location.longitude
  });

  if (validationError || !validationData || !validationData[0]?.is_allowed) {
    return {
      ok: false,
      message: validationData?.[0]?.message || 'Salida rechazada: Ubicación inválida.',
    };
  }

  const now = new Date();
  const workedHours = Number(((now.getTime() - new Date(attendance.check_in).getTime()) / (1000 * 60 * 60)).toFixed(2));

  const { data: updatedAttendance, error: updateError } = await supabase
    .from('attendances')
    .update({
      check_out: now.toISOString(),
      check_out_location: params.location,
      worked_hours: workedHours,
      device_id: params.deviceId ?? attendance.device_id
    })
    .eq('id', params.attendanceId)
    .select()
    .single();

  if (updateError) {
    return { ok: false, message: 'Error actualizando salida en la base de datos.' };
  }

  return {
    ok: true,
    attendance: updatedAttendance as any,
    message: 'Salida registrada y horas acumuladas correctamente.',
  };
};

export const getActiveStudentsSnapshot = (): ActiveStudentRecord[] => {
  const students = getStudents();
  const practices = getPractices();
  const hoursCache = getHoursCache();
  const now = getOfficialServerTime().getTime();

  return getAttendance()
    .filter((attendance) => !attendance.checkOut)
    .map((attendance) => {
      const student = students.find((item) => item.id === attendance.studentId);
      const practice = practices.find((item: Practice) => item.id === attendance.practiceId);
      const hoursToday = Number(((now - new Date(attendance.checkIn).getTime()) / (1000 * 60 * 60)).toFixed(2));

      return {
        studentId: attendance.studentId,
        studentName: student?.name ?? 'Desconocido',
        career: student?.career ?? 'Sin carrera',
        practiceId: attendance.practiceId,
        siteName: practice?.location ?? 'Sede no registrada',
        checkIn: attendance.checkIn,
        hoursToday,
        totalCycleHours: Number((hoursCache[attendance.studentId] ?? 0).toFixed(2)),
        lastLocation: attendance.checkOutLocation ?? attendance.checkInLocation,
      };
    });
};

export const getCoordinatorAlerts = () => {
  return readBackendStorage<CoordinatorAlert[]>(BACKEND_STORAGE_KEYS.COORDINATOR_ALERTS, []);
};

const REQUIRED_PRACTICE_HOURS = 480;

export const getStudentHoursProgress = (studentId: string): { completedHours: number; requiredHours: number } => {
  const hoursCache = getHoursCache();
  const active = getActiveAttendance(studentId);
  let completed = Number((hoursCache[studentId] ?? 0).toFixed(1));
  if (active) {
    const sessionHours =
      (getOfficialServerTime().getTime() - new Date(active.checkIn).getTime()) / (1000 * 60 * 60);
    completed = Number((completed + sessionHours).toFixed(1));
  }
  return { completedHours: completed, requiredHours: REQUIRED_PRACTICE_HOURS };
};

export const checkLocationVsPractice = (
  practiceId: string,
  location: GeoPoint,
): { distance: number; isInside: boolean; radiusMeters: number; center: GeoPoint } => {
  const coverage = getCoverageForPractice(practiceId);
  const distance = distanceInMeters(location, coverage);
  const tolerance = location.accuracyMeters ?? 0;
  return {
    distance: Math.round(distance),
    isInside: distance <= coverage.radiusMeters + tolerance,
    radiusMeters: coverage.radiusMeters,
    center: { latitude: coverage.latitude, longitude: coverage.longitude },
  };
};
