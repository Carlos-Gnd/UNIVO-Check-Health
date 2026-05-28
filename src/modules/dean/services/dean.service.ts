import { supabase } from '@/shared/backend/supabaseClient';
import type { DeanAttendance, DeanGlobalStats, DeanStudent, Location } from '../types';

const GOAL_HOURS = 240;
const SHARED_DEVICE_ALERT_ACTION = 'SHARED_DEVICE_ACTIVE_CONFLICT';
const DEFAULT_RISK_THRESHOLD = 60;

type AttRow = {
  id: string;
  date: string;
  check_in: string;
  check_out: string | null;
  status: string;
  worked_hours: number | null;
  review_status: string;
  campus_id: string;
  campuses: { name: string; supervisor_name: string | null } | null;
};

type UserRow = {
  id: string;
  student_code: string;
  full_name: string | null;
  career: string | null;
  attendances: AttRow[];
};

type CampusRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  location_label: string | null;
  supervisor_name: string | null;
  supervisor_phone: string | null;
  schedule: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
};

type SharedDeviceAlertRow = {
  id: number;
  actor_user_id: string;
  target_user_id: string | null;
  event_at: string;
  details: {
    attempted_campus_id?: string;
    active_campus_id?: string;
    active_attendance_id?: string;
    device_fingerprint?: string;
  } | null;
};

export type SharedDeviceAlert = {
  id: string;
  attemptedStudentId: string;
  activeStudentId: string | null;
  attemptedCampusId: string;
  activeCampusId: string;
  activeAttendanceId: string;
  deviceFingerprint: string;
  createdAt: string;
};

async function fetchRiskThreshold(): Promise<number> {
  const { data } = await supabase
    .from('system_config')
    .select('value')
    .in('key', ['risk_threshold_pct', 'compliance_alert_threshold_pct'])
    .order('key', { ascending: false });

  const rawValue = data?.find((item) => item.value != null)?.value;
  const threshold = Number(rawValue);
  return Number.isFinite(threshold) && threshold > 0 ? threshold : DEFAULT_RISK_THRESHOLD;
}

function mapStudentRow(row: UserRow, riskThreshold: number): DeanStudent {
  const completedHours = row.attendances.reduce((s, a) => s + (a.worked_hours ?? 0), 0);
  const absences = row.attendances.filter((a) => a.status === 'absent').length;
  const pct = Math.min(100, Math.round((completedHours / GOAL_HOURS) * 100));

  const latest = [...row.attendances].sort((a, b) => b.date.localeCompare(a.date))[0];
  const sedeId = latest?.campus_id ?? '';
  const sedeName = latest?.campuses?.name ?? 'Sin sede';
  const doctorName = latest?.campuses?.supervisor_name ?? '—';

  const attendances: DeanAttendance[] = row.attendances.map((a) => ({
    id: a.id,
    date: a.date,
    checkInTime: a.check_in ? new Date(a.check_in).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' }) : '',
    sedeName: a.campuses?.name ?? sedeName,
    status: a.status === 'absent' ? 'absent' : a.review_status === 'flagged' ? 'review' : 'valid',
  }));

  return {
    id: row.id,
    carnet: row.student_code,
    fullName: row.full_name ?? row.student_code,
    career: row.career ?? '—',
    sedeId,
    sedeName,
    doctorName,
    completedHours: Math.round(completedHours * 10) / 10,
    goalHours: GOAL_HOURS,
    compliancePercentage: pct,
    absences,
    status: pct > 85 ? 'completed' : pct >= riskThreshold ? 'in-progress' : 'at-risk',
    attendances,
  };
}

export async function fetchDeanStudents(): Promise<DeanStudent[]> {
  const [riskThreshold, studentsResult] = await Promise.all([
    fetchRiskThreshold(),
    supabase
      .from('users')
      .select(`
        id, student_code, full_name, career,
        attendances(id, date, check_in, check_out, status, worked_hours, review_status, campus_id,
          campuses(name, supervisor_name))
      `)
      .eq('role', 'STUDENT'),
  ]);

  if (studentsResult.error || !studentsResult.data) return [];
  return (studentsResult.data as unknown as UserRow[]).map((row) => mapStudentRow(row, riskThreshold));
}

export async function fetchDeanLocations(): Promise<Location[]> {
  const { data, error } = await supabase
    .from('campuses')
    .select('id, name, latitude, longitude, radius_meters, location_label, supervisor_name, supervisor_phone, schedule, start_date, end_date, description')
    .order('name');

  if (error || !data) return [];

  const today = new Date().toISOString().slice(0, 10);
  return (data as CampusRow[]).map((c) => ({
    id: c.id,
    name: c.name,
    address: c.location_label ?? c.name,
    coordinates: { lat: Number(c.latitude), lng: Number(c.longitude) },
    allowedRadiusMeters: c.radius_meters,
    doctorName: c.supervisor_name ?? '—',
    doctorPhone: c.supervisor_phone ?? '',
    schedule: c.schedule ?? '',
    startDate: c.start_date ?? '',
    endDate: c.end_date ?? '',
    description: c.description ?? '',
    doctorStatus: 'active' as const,
    totalStudents: 0,
    averageCompliance: 0,
    status: (!c.end_date || c.end_date >= today ? 'active' : 'inactive') as 'active' | 'inactive',
    students: [],
  }));
}

export async function fetchDeanData(): Promise<{
  students: DeanStudent[];
  locations: Location[];
  globalStats: DeanGlobalStats;
}> {
  const [students, locations, riskThreshold] = await Promise.all([
    fetchDeanStudents(),
    fetchDeanLocations(),
    fetchRiskThreshold(),
  ]);

  const locMap = new Map(locations.map((l) => [l.id, l]));
  students.forEach((s) => {
    const loc = locMap.get(s.sedeId);
    if (loc) {
      loc.students.push(s);
      loc.totalStudents = loc.students.length;
      loc.averageCompliance = Math.round(
        loc.students.reduce((sum, st) => sum + st.compliancePercentage, 0) / loc.students.length,
      );
    }
  });

  const globalStats: DeanGlobalStats = {
    totalStudents: students.length,
    globalComplianceRate:
      students.length > 0
        ? Math.round(students.reduce((s, st) => s + st.compliancePercentage, 0) / students.length)
        : 0,
    atRiskCount: students.filter((s) => s.status === 'at-risk').length,
    activeLocations: locations.filter((l) => l.status === 'active').length,
    riskThreshold,
  };

  return { students, locations, globalStats };
}

export async function fetchSharedDeviceAlerts(): Promise<SharedDeviceAlert[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, actor_user_id, target_user_id, event_at, details')
    .eq('action', SHARED_DEVICE_ALERT_ACTION)
    .order('event_at', { ascending: false })
    .limit(20);

  if (error || !data) return [];

  return (data as SharedDeviceAlertRow[]).map((row) => ({
    id: String(row.id),
    attemptedStudentId: row.actor_user_id,
    activeStudentId: row.target_user_id,
    attemptedCampusId: row.details?.attempted_campus_id ?? '',
    activeCampusId: row.details?.active_campus_id ?? '',
    activeAttendanceId: row.details?.active_attendance_id ?? '',
    deviceFingerprint: row.details?.device_fingerprint ?? '',
    createdAt: row.event_at,
  }));
}

export type CampusFormData = {
  name: string;
  latitude: string;
  longitude: string;
  radius_meters: string;
  location_label: string;
  supervisor_name: string;
  supervisor_phone: string;
  schedule: string;
  start_date: string;
  end_date: string;
  description: string;
  check_in_from: string;
  check_in_to: string;
};

export async function createCampus(form: CampusFormData): Promise<{ ok: boolean; message?: string }> {
  const radius = Math.max(50, Number(form.radius_meters) || 100);
  const { error } = await supabase.from('campuses').insert({
    name: form.name.trim(),
    latitude: Number(form.latitude),
    longitude: Number(form.longitude),
    radius_meters: radius,
    location_label: form.location_label.trim() || null,
    supervisor_name: form.supervisor_name.trim() || null,
    supervisor_phone: form.supervisor_phone.trim() || null,
    schedule: form.schedule.trim() || null,
    start_date: form.start_date || null,
    end_date: form.end_date || null,
    description: form.description.trim() || null,
    check_in_from: form.check_in_from || null,
    check_in_to: form.check_in_to || null,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function updateCampus(id: string, form: CampusFormData): Promise<{ ok: boolean; message?: string }> {
  const radius = Math.max(50, Number(form.radius_meters) || 100);
  const { error } = await supabase
    .from('campuses')
    .update({
      name: form.name.trim(),
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      radius_meters: radius,
      location_label: form.location_label.trim() || null,
      supervisor_name: form.supervisor_name.trim() || null,
      supervisor_phone: form.supervisor_phone.trim() || null,
      schedule: form.schedule.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      description: form.description.trim() || null,
      check_in_from: form.check_in_from || null,
      check_in_to: form.check_in_to || null,
    })
    .eq('id', id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteCampus(id: string): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('campuses').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
