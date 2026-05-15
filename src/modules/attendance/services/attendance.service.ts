import { supabase } from '@/shared/backend/supabaseClient';
import { Attendance, DeviceInfo } from '../types';

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

const mapRow = (row: Record<string, unknown>): Attendance => ({
  id: row.id as string,
  studentId: row.student_id as string,
  practiceId: row.campus_id as string,
  checkIn: row.check_in as string,
  checkOut: (row.check_out as string) ?? undefined,
  date: row.date as string,
  status: row.status as Attendance['status'],
  notes: (row.notes as string) ?? undefined,
  checkInLocation: (row.check_in_location as Attendance['checkInLocation']) ?? undefined,
  checkOutLocation: (row.check_out_location as Attendance['checkOutLocation']) ?? undefined,
  securitySeal: (row.security_seal as string) ?? undefined,
  checkOutSecuritySeal: (row.check_out_security_seal as string) ?? undefined,
  workedHours: (row.worked_hours as number) ?? undefined,
  reviewStatus: (row.review_status as Attendance['reviewStatus']) ?? undefined,
  suspiciousReason: (row.suspicious_reason as string) ?? undefined,
  deviceId: (row.device_id as string) ?? undefined,
  deviceInfo: (row.device_info as DeviceInfo) ?? undefined,
});

export const getAttendance = async (): Promise<Attendance[]> => {
  const { data, error } = await supabase.from('attendances').select('*');
  if (error || !data) return [];
  return data.map(mapRow);
};
