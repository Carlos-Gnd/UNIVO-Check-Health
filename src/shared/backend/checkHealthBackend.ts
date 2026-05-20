import { supabase } from './supabaseClient';
import { Attendance, GeoPoint } from '@/modules/attendance/types';
import { DeviceInfo } from '@/modules/attendance/types';
import { SessionCredential, UserRole, UserSession } from './types';

type SiteCoverage = GeoPoint & { radiusMeters: number; name?: string };

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

const EARTH_RADIUS_METERS = 6371000;
const SHORT_SESSION_MINUTES = 15;
const LONG_SESSION_DAYS = 7;
const MAX_HUMAN_SPEED_KMH = 140;
const REVIEW_DELAY_MS = 250;
const REQUIRED_PRACTICE_HOURS = 480;

const readBackendStorage = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const writeBackendStorage = <T,>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
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

const createToken = (payload: Record<string, unknown>, type: 'short' | 'long') => {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = btoa(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(
        (type === 'short'
          ? Date.now() + SHORT_SESSION_MINUTES * 60 * 1000
          : Date.now() + LONG_SESSION_DAYS * 24 * 60 * 60 * 1000) / 1000,
      ),
    }),
  );
  const signature = simpleHash(`${header}.${body}.secret_RS256_mock`);
  return `${header}.${body}.${signature}`;
};

const createCredential = (userId: string, type: SessionCredential['type'], now: Date): SessionCredential => ({
  token: createToken({ sub: userId, type }, type),
  expiresAt: (
    type === 'short' ? addMinutes(now, SHORT_SESSION_MINUTES) : addDays(now, LONG_SESSION_DAYS)
  ).toISOString(),
  type,
});

const simpleHash = (payload: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
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

const mapAttendanceRow = (row: Record<string, unknown>): Attendance => ({
  id: row.id as string,
  studentId: row.student_id as string,
  practiceId: row.campus_id as string,
  checkIn: row.check_in as string,
  checkOut: (row.check_out as string) ?? undefined,
  date: row.date as string,
  status: row.status as Attendance['status'],
  notes: (row.notes as string) ?? undefined,
  checkInLocation: (row.check_in_location as GeoPoint) ?? undefined,
  checkOutLocation: (row.check_out_location as GeoPoint) ?? undefined,
  securitySeal: (row.security_seal as string) ?? undefined,
  checkOutSecuritySeal: (row.check_out_security_seal as string) ?? undefined,
  workedHours: (row.worked_hours as number) ?? undefined,
  reviewStatus: (row.review_status as Attendance['reviewStatus']) ?? undefined,
  suspiciousReason: (row.suspicious_reason as string) ?? undefined,
  deviceId: (row.device_id as string) ?? undefined,
  deviceFingerprint: (row.device_fingerprint as string) ?? undefined,
  deviceInfo: (row.device_info as DeviceInfo) ?? undefined,
});

const getCampusById = async (campusId: string): Promise<SiteCoverage | null> => {
  const { data, error } = await supabase
    .from('campuses')
    .select('id, latitude, longitude, radius_meters, name')
    .eq('id', campusId)
    .single();

  if (error || !data) return null;

  return {
    latitude: Number(data.latitude),
    longitude: Number(data.longitude),
    radiusMeters: Number(data.radius_meters),
    name: (data.name as string) ?? undefined,
  };
};

const getOfficialServerTime = () => new Date();

export const assignAccessLevel = (email: string): { role: UserRole; access: string[] } => {
  const domain = email.trim().toLowerCase().split('@')[1] ?? '';
  let role: UserRole = 'Estudiante';
  if (domain === 'coordinador.univo.edu.sv') role = 'Coordinador';
  else if (domain === 'docente.univo.edu.sv') role = 'Docente';
  else if (domain === 'hospital.edu.sv') role = 'Representante de sede';
  else if (domain === 'admin.univo.edu.sv') role = 'Administrador';
  return { role, access: ROLE_ACCESS[role] };
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
    sessions.map((s) => (s.userId === targetUserId ? { ...s, revokedAt: now } : s)),
  );
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

const queueLocationReview = (attendanceId: string, type: LocationReviewJob['type']) => {
  const jobs = readBackendStorage<LocationReviewJob[]>(BACKEND_STORAGE_KEYS.LOCATION_REVIEW_JOBS, []);
  const job: LocationReviewJob = {
    id: `job_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    attendanceId,
    type,
    createdAt: getOfficialServerTime().toISOString(),
  };
  writeBackendStorage(BACKEND_STORAGE_KEYS.LOCATION_REVIEW_JOBS, [...jobs, job]);
  window.setTimeout(() => void processLocationReviewJob(job), REVIEW_DELAY_MS);
};

const processLocationReviewJob = async (job: LocationReviewJob) => {
  const { data: attendance, error: fetchError } = await supabase
    .from('attendances')
    .select('*')
    .eq('id', job.attendanceId)
    .single();

  if (fetchError || !attendance) return;

  const { data: previousRecords } = await supabase
    .from('attendances')
    .select('check_in, check_out, check_in_location')
    .eq('student_id', attendance.student_id)
    .neq('id', attendance.id)
    .not('check_in_location', 'is', null)
    .order('check_in', { ascending: false })
    .limit(1);

  const previous = previousRecords?.[0];
  const currentLocation =
    job.type === 'check-out' ? attendance.check_out_location : attendance.check_in_location;

  if (!previous || !currentLocation || !previous.check_in_location) return;

  const previousTime = new Date(previous.check_out ?? previous.check_in).getTime();
  const currentTime = new Date(
    job.type === 'check-out' ? (attendance.check_out ?? attendance.check_in) : attendance.check_in,
  ).getTime();
  const elapsedHours = Math.max((currentTime - previousTime) / (1000 * 60 * 60), 0.01);
  const speedKmh =
    distanceInMeters(
      previous.check_in_location as GeoPoint,
      currentLocation as GeoPoint,
    ) /
    1000 /
    elapsedHours;

  if (speedKmh > MAX_HUMAN_SPEED_KMH) {
    const reason = `Desplazamiento inusual detectado: ${Math.round(speedKmh)} km/h entre registros.`;
    await supabase
      .from('attendances')
      .update({ review_status: 'pending_review', suspicious_reason: reason })
      .eq('id', job.attendanceId);
    addCoordinatorAlert({
      attendanceId: job.attendanceId,
      studentId: attendance.student_id as string,
      message: reason,
    });
  }
};

export const registerStudentCheckIn = async (params: {
  studentId: string;
  practiceId: string;
  location: GeoPoint;
  notes?: string;
  deviceId?: string;
  deviceFingerprint?: string;
}): Promise<AttendanceResult> => {
  const { data: validationData, error: validationError } = await supabase.rpc('validate_checkin_area', {
    p_campus_id: params.practiceId,
    p_current_lat: params.location.latitude,
    p_current_lng: params.location.longitude,
  });

  if (validationError || !validationData || !validationData[0]?.is_allowed) {
    return {
      ok: false,
      message: validationData?.[0]?.message ?? 'Ubicación fuera del área permitida.',
    };
  }

  const { data: activeRecords } = await supabase
    .from('attendances')
    .select('id')
    .eq('student_id', params.studentId)
    .is('check_out', null);

  if (activeRecords && activeRecords.length > 0) {
    return { ok: false, message: 'Este estudiante ya tiene una entrada activa.' };
  }

  const { data: attendanceData, error: insertError } = await supabase
    .from('attendances')
    .insert([
      {
        student_id: params.studentId,
        campus_id: params.practiceId,
        notes: params.notes,
        check_in_location: params.location,
        device_id: params.deviceId,
        device_fingerprint: params.deviceFingerprint,
        status: 'present',
      },
    ])
    .select()
    .single();

  if (insertError || !attendanceData) {
    return { ok: false, message: 'Error al registrar la asistencia.' };
  }

  const mapped = mapAttendanceRow(attendanceData as Record<string, unknown>);
  queueLocationReview(mapped.id, 'check-in');

  return {
    ok: true,
    attendance: mapped,
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
    .select('*')
    .eq('id', params.attendanceId)
    .single();

  if (fetchError || !attendance) {
    return { ok: false, message: 'No se encontró el registro activo.' };
  }

  if (attendance.check_out) {
    return { ok: false, message: 'La salida ya fue registrada para esta jornada.' };
  }

  const { data: validationData, error: validationError } = await supabase.rpc('validate_checkin_area', {
    p_campus_id: attendance.campus_id,
    p_current_lat: params.location.latitude,
    p_current_lng: params.location.longitude,
  });

  if (validationError || !validationData || !validationData[0]?.is_allowed) {
    return {
      ok: false,
      message: validationData?.[0]?.message ?? 'Ubicación fuera del área permitida.',
    };
  }

  const now = new Date();
  const workedHours = Number(
    ((now.getTime() - new Date(attendance.check_in as string).getTime()) / (1000 * 60 * 60)).toFixed(2),
  );

  const { data: updatedAttendance, error: updateError } = await supabase
    .from('attendances')
    .update({
      check_out: now.toISOString(),
      check_out_location: params.location,
      worked_hours: workedHours,
      device_id: params.deviceId ?? attendance.device_id,
    })
    .eq('id', params.attendanceId)
    .select()
    .single();

  if (updateError || !updatedAttendance) {
    return { ok: false, message: 'Error al registrar la salida.' };
  }

  const mapped = mapAttendanceRow(updatedAttendance as Record<string, unknown>);
  queueLocationReview(mapped.id, 'check-out');

  return {
    ok: true,
    attendance: mapped,
    message: 'Salida registrada y horas acumuladas correctamente.',
  };
};

export const getActiveStudentsSnapshot = async (): Promise<ActiveStudentRecord[]> => {
  const [attendancesResult, usersResult, campusesResult] = await Promise.all([
    supabase.from('attendances').select('*').is('check_out', null),
    supabase.from('users').select('id, full_name, career').eq('role', 'STUDENT'),
    supabase.from('campuses').select('id, name, location_label'),
  ]);

  if (attendancesResult.error || !attendancesResult.data) return [];

  const students = usersResult.data ?? [];
  const campuses = campusesResult.data ?? [];
  const now = Date.now();

  return attendancesResult.data.map((row) => {
    const student = students.find((s) => s.id === row.student_id);
    const campus = campuses.find((c) => c.id === row.campus_id);
    return {
      studentId: row.student_id as string,
      studentName: (student?.full_name as string) ?? 'Desconocido',
      career: (student?.career as string) ?? 'Sin carrera',
      practiceId: row.campus_id as string,
      siteName: (campus?.location_label as string) ?? (campus?.name as string) ?? 'Sede no registrada',
      checkIn: row.check_in as string,
      hoursToday: Number(((now - new Date(row.check_in as string).getTime()) / (1000 * 60 * 60)).toFixed(2)),
      totalCycleHours: 0,
      lastLocation: (row.check_out_location ?? row.check_in_location) as GeoPoint | undefined,
    };
  });
};

export const getCoordinatorAlerts = () => {
  return readBackendStorage<CoordinatorAlert[]>(BACKEND_STORAGE_KEYS.COORDINATOR_ALERTS, []);
};

export const getStudentHoursProgress = async (
  studentId: string,
): Promise<{ completedHours: number; requiredHours: number }> => {
  const { data } = await supabase
    .from('attendances')
    .select('worked_hours, check_in, check_out')
    .eq('student_id', studentId);

  let completed = 0;
  if (data) {
    for (const row of data) {
      if (row.worked_hours != null) {
        completed += Number(row.worked_hours);
      } else if (!row.check_out) {
        completed += (Date.now() - new Date(row.check_in as string).getTime()) / (1000 * 60 * 60);
      }
    }
  }

  return { completedHours: Number(completed.toFixed(1)), requiredHours: REQUIRED_PRACTICE_HOURS };
};

export const checkLocationVsPractice = async (
  practiceId: string,
  location: GeoPoint,
): Promise<{ distance: number; isInside: boolean; radiusMeters: number; center: GeoPoint }> => {
  const campus = await getCampusById(practiceId);
  if (!campus) {
    return { distance: Infinity, isInside: false, radiusMeters: 100, center: location };
  }
  const distance = distanceInMeters(location, campus);
  const tolerance = location.accuracyMeters ?? 0;
  return {
    distance: Math.round(distance),
    isInside: distance <= campus.radiusMeters + tolerance,
    radiusMeters: campus.radiusMeters,
    center: { latitude: campus.latitude, longitude: campus.longitude },
  };
};

// Solo para compatibilidad con createSecuritySeal (no expuesto como export)
void createSecuritySeal;
