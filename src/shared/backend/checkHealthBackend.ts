import { supabase } from './supabaseClient';
import { Attendance, GeoPoint } from '@/modules/attendance/types';
import { DeviceInfo } from '@/modules/attendance/types';

type SiteCoverage = GeoPoint & { radiusMeters: number; name?: string };

type ActiveStudentRecord = {
  studentId: string;
  studentName: string;
  carnet: string;
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

type DeviceFingerprintConflict = {
  attendance_id: string;
  student_id: string;
  campus_id: string;
  check_in: string;
};

const EARTH_RADIUS_METERS = 6371000;
const MAX_HUMAN_SPEED_KMH = 140;
const REQUIRED_PRACTICE_HOURS = 240;
const FAKE_GPS_CONFIDENCE_THRESHOLD = 0.8;

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

const variance = (values: number[]) => {
  if (values.length < 2) return 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
};

export const analyzeFakeGpsPattern = (deviceInfo: DeviceInfo | undefined): DeviceInfo | undefined => {
  if (!deviceInfo) return undefined;

  const motionSamples = deviceInfo.motionSamples ?? [];
  const locationSamples = deviceInfo.locationSamples ?? [];
  const accelerationVariance = variance(motionSamples.map((sample) => sample.accelerationMagnitude));
  const rotationVariance = variance(motionSamples.map((sample) => sample.rotationRateMagnitude));
  const gpsDriftMeters = locationSamples.reduce((total, sample, index) => {
    const previous = locationSamples[index - 1];
    return previous ? total + distanceInMeters(previous, sample) : total;
  }, 0);

  const reasons: string[] = [];
  let confidence = 0;

  if (motionSamples.length >= 8 && accelerationVariance < 0.0004 && rotationVariance < 0.0004) {
    confidence += 0.45;
    reasons.push('Sensores de movimiento casi planos durante la captura.');
  }

  if (locationSamples.length >= 2 && gpsDriftMeters >= 25) {
    confidence += 0.35;
    reasons.push(`GPS cambio ${Math.round(gpsDriftMeters)} m durante la captura.`);
  }

  if (deviceInfo.gpsAccuracy !== null && deviceInfo.gpsAccuracy <= 5 && motionSamples.length >= 8) {
    confidence += 0.15;
    reasons.push('Precision GPS inusualmente alta para una lectura sin movimiento.');
  }

  if (locationSamples.length >= 2 && motionSamples.length === 0 && deviceInfo.gpsAccuracy !== null && deviceInfo.gpsAccuracy <= 5) {
    confidence += 0.2;
    reasons.push('GPS preciso sin muestras de acelerometro disponibles.');
  }

  const normalizedConfidence = Number(Math.min(confidence, 1).toFixed(2));
  const isFakeGps = normalizedConfidence > FAKE_GPS_CONFIDENCE_THRESHOLD;
  const fakeGpsAnalysis = {
    isFakeGps,
    confidence: normalizedConfidence,
    reasons,
    sampleCount: motionSamples.length,
    gpsDriftMeters: Number(gpsDriftMeters.toFixed(2)),
    accelerationVariance: Number(accelerationVariance.toFixed(6)),
    rotationVariance: Number(rotationVariance.toFixed(6)),
  };

  return {
    ...deviceInfo,
    fakeGpsAnalysis,
    isFakeGps,
    fakeGpsConfidence: normalizedConfidence,
  };
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

const logSharedDeviceConflict = async (params: {
  actorUserId: string;
  targetUserId: string;
  attemptedCampusId: string;
  activeCampusId: string;
  activeAttendanceId: string;
  deviceFingerprint: string;
}) => {
  await supabase.from('audit_log').insert({
    action: 'SHARED_DEVICE_ACTIVE_CONFLICT',
    actor_user_id: params.actorUserId,
    target_user_id: params.targetUserId,
    details: {
      attempted_campus_id: params.attemptedCampusId,
      active_campus_id: params.activeCampusId,
      active_attendance_id: params.activeAttendanceId,
      device_fingerprint: params.deviceFingerprint,
    },
  });
};

// Llama al RPC validate_location_coherence para verificar velocidad de desplazamiento.
// Reemplaza la lógica client-side de processLocationReviewJob (eliminada en Fase 4).
const checkLocationCoherence = async (studentId: string, location: GeoPoint): Promise<string | undefined> => {
  const { data } = await supabase.rpc('validate_location_coherence', {
    p_student_id: studentId,
    p_current_lat: location.latitude,
    p_current_lng: location.longitude,
  });
  return data?.[0]?.is_suspicious
    ? 'Desplazamiento inusual detectado entre registros consecutivos.'
    : undefined;
};

export const registerStudentCheckIn = async (params: {
  studentId: string;
  practiceId: string;
  location: GeoPoint;
  notes?: string;
  deviceId?: string;
  deviceFingerprint?: string;
  deviceInfo?: DeviceInfo;
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

  if (params.deviceFingerprint) {
    const { data: deviceConflict } = await supabase.rpc('detect_device_fingerprint_conflict', {
      p_device_fingerprint: params.deviceFingerprint,
      p_campus_id: params.practiceId,
      p_student_id: params.studentId,
    });
    const conflict = (deviceConflict?.[0] ?? null) as DeviceFingerprintConflict | null;

    if (conflict) {
      await logSharedDeviceConflict({
        actorUserId: params.studentId,
        targetUserId: conflict.student_id,
        attemptedCampusId: params.practiceId,
        activeCampusId: conflict.campus_id,
        activeAttendanceId: conflict.attendance_id,
        deviceFingerprint: params.deviceFingerprint,
      });

      return {
        ok: false,
        message: 'Dispositivo ya activo en otra sede. El intento fue enviado a auditoria.',
      };
    }
  }

  const deviceInfo = analyzeFakeGpsPattern(params.deviceInfo);
  const fakeGpsReason = deviceInfo?.fakeGpsAnalysis?.isFakeGps
    ? `Posible GPS falso detectado (${Math.round(deviceInfo.fakeGpsAnalysis.confidence * 100)}%): ${deviceInfo.fakeGpsAnalysis.reasons.join(' ')}`
    : undefined;

  // Verificación de coherencia espacio-temporal (reemplaza processLocationReviewJob client-side)
  const speedReason = await checkLocationCoherence(params.studentId, params.location);
  const suspiciousReason = fakeGpsReason ?? speedReason;

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
        device_info: deviceInfo,
        review_status: suspiciousReason ? 'OBSERVADO' : 'PENDIENTE',
        suspicious_reason: suspiciousReason,
        status: 'present',
      },
    ])
    .select()
    .single();

  if (insertError || !attendanceData) {
    return { ok: false, message: 'Error al registrar la asistencia.' };
  }

  if (fakeGpsReason) {
    await supabase.from('audit_log').insert({
      action: 'FAKE_GPS_DETECTED',
      actor_user_id: params.studentId,
      details: {
        attendance_id: (attendanceData as Record<string, unknown>).id,
        campus_id: params.practiceId,
        confidence: deviceInfo?.fakeGpsConfidence,
      },
    });
  }

  return {
    ok: true,
    attendance: mapAttendanceRow(attendanceData as Record<string, unknown>),
    message: 'Entrada registrada con hora oficial del servidor.',
  };
};

export const registerStudentCheckOut = async (params: {
  attendanceId: string;
  location: GeoPoint;
  deviceId?: string;
  deviceFingerprint?: string;
  deviceInfo?: DeviceInfo;
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

  if (attendance.device_fingerprint && params.deviceFingerprint && attendance.device_fingerprint !== params.deviceFingerprint) {
    await supabase.from('audit_log').insert({
      action: 'CHECKOUT_DEVICE_FINGERPRINT_MISMATCH',
      actor_user_id: attendance.student_id,
      target_user_id: attendance.student_id,
      details: {
        attendance_id: params.attendanceId,
        campus_id: attendance.campus_id,
        check_in_device_fingerprint: attendance.device_fingerprint,
        check_out_device_fingerprint: params.deviceFingerprint,
      },
    });
    return { ok: false, message: 'La salida debe registrarse desde el mismo dispositivo usado para la entrada.' };
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

  const deviceInfo = analyzeFakeGpsPattern(params.deviceInfo);
  const fakeGpsReason = deviceInfo?.fakeGpsAnalysis?.isFakeGps
    ? `Posible GPS falso detectado (${Math.round(deviceInfo.fakeGpsAnalysis.confidence * 100)}%): ${deviceInfo.fakeGpsAnalysis.reasons.join(' ')}`
    : undefined;

  const { data: updatedAttendance, error: updateError } = await supabase
    .from('attendances')
    .update({
      check_out: now.toISOString(),
      check_out_location: params.location,
      worked_hours: workedHours,
      device_id: params.deviceId ?? attendance.device_id,
      check_out_device_fingerprint: params.deviceFingerprint ?? attendance.device_fingerprint,
      device_info: deviceInfo ?? attendance.device_info,
      review_status: fakeGpsReason ? 'OBSERVADO' : attendance.review_status,
      suspicious_reason: fakeGpsReason ?? attendance.suspicious_reason,
    })
    .eq('id', params.attendanceId)
    .select()
    .single();

  if (updateError || !updatedAttendance) {
    return { ok: false, message: updateError?.message ?? 'Error al registrar la salida.' };
  }

  return {
    ok: true,
    attendance: mapAttendanceRow(updatedAttendance as Record<string, unknown>),
    message: 'Salida registrada y horas acumuladas correctamente.',
  };
};

export const getActiveStudentsSnapshot = async (): Promise<ActiveStudentRecord[]> => {
  const [attendancesResult, usersResult, campusesResult] = await Promise.all([
    supabase.from('attendances').select('*').is('check_out', null),
    supabase.from('users').select('id, full_name, career, student_code').eq('role', 'STUDENT'),
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
      carnet: (student?.student_code as string) ?? '',
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

