import { supabase } from '@/shared/backend/supabaseClient';

export type CalendarRole = 'STUDENT' | 'SUPERVISOR' | 'DEAN';

export type RotationWindow = {
  studentId: string;
  studentName: string;
  career: string;
  campusId: string;
  campusName: string;
  schedule: string;
  startDate: string;
  endDate: string;
  supervisorName: string;
};

export type CalendarPayload = {
  role: CalendarRole;
  windows: RotationWindow[];
  campusOptions: { id: string; name: string }[];
  careerOptions: string[];
};

type CurrentUser = {
  id: string;
  role: string;
  full_name: string | null;
};

type CampusRow = {
  id: string;
  name: string;
  schedule: string | null;
  start_date: string | null;
  end_date: string | null;
  supervisor_name: string | null;
};

type AttendanceRef = {
  date: string;
  campus_id: string;
};

type StudentRow = {
  id: string;
  full_name: string | null;
  career: string | null;
  attendances: AttendanceRef[];
};

function normalizeRole(role: string): CalendarRole {
  if (role === 'ADMIN') return 'DEAN';
  if (role === 'STUDENT') return 'STUDENT';
  return 'SUPERVISOR';
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchRotationsCalendar(): Promise<CalendarPayload> {
  const { data: auth } = await supabase.auth.getUser();
  const authUser = auth.user;
  if (!authUser?.email) {
    return { role: 'SUPERVISOR', windows: [], campusOptions: [], careerOptions: [] };
  }

  const { data: currentUser } = await supabase
    .from('users')
    .select('id, role, full_name')
    .eq('email', authUser.email)
    .single<CurrentUser>();

  const role = normalizeRole(currentUser?.role ?? 'COORDINATOR');

  const [{ data: campuses }, { data: students }] = await Promise.all([
    supabase
      .from('campuses')
      .select('id, name, schedule, start_date, end_date, supervisor_name')
      .order('name'),
    supabase
      .from('users')
      .select(`
        id, full_name, career,
        attendances(date, campus_id)
      `)
      .eq('role', 'STUDENT'),
  ]);

  const safeCampuses = (campuses ?? []) as CampusRow[];
  const campusById = new Map(safeCampuses.map((c) => [c.id, c]));
  const safeStudents = (students ?? []) as unknown as StudentRow[];

  const windows: RotationWindow[] = safeStudents
    .map((student) => {
      const latestAttendance = [...(student.attendances ?? [])]
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (!latestAttendance?.campus_id) return null;
      const campus = campusById.get(latestAttendance.campus_id);
      if (!campus?.start_date || !campus?.end_date) return null;
      return {
        studentId: student.id,
        studentName: student.full_name ?? 'Sin nombre',
        career: student.career ?? '—',
        campusId: campus.id,
        campusName: campus.name,
        schedule: campus.schedule ?? 'Horario no definido',
        startDate: campus.start_date,
        endDate: campus.end_date,
        supervisorName: campus.supervisor_name ?? '—',
      } satisfies RotationWindow;
    })
    .filter((row): row is RotationWindow => row !== null);

  const filteredWindows = windows.filter((w) => {
    if (role === 'DEAN') return true;
    if (role === 'STUDENT') return w.studentId === currentUser?.id && w.endDate >= todayIso();
    return w.supervisorName === (currentUser?.full_name ?? '');
  });

  return {
    role,
    windows: filteredWindows,
    campusOptions: safeCampuses.map((c) => ({ id: c.id, name: c.name })),
    careerOptions: [...new Set(windows.map((w) => w.career))].sort((a, b) => a.localeCompare(b)),
  };
}
