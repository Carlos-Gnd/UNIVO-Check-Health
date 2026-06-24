import { supabase } from '@/shared/backend/supabaseClient';

export type CalendarRole = 'STUDENT' | 'SUPERVISOR' | 'DEAN';

export type RotationWindow = {
  studentId: string;
  studentName: string;
  career: string;
  campusId: string;
  campusName: string;
  schedule: string;
  weekdays: number[]; // ISO 1=lunes … 7=domingo; días en que el alumno asiste
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

type ScheduleSlotRow = {
  weekday: number;
  check_in_from: string | null;
  check_in_to: string | null;
};

// Fila de teacher_groups con sus relaciones embebidas vía PostgREST.
type AssignmentRow = {
  id: string;
  student_id: string;
  campus_id: string | null;
  start_date: string | null;
  end_date: string | null;
  student: { full_name: string | null; career: string | null } | null;
  campus: { name: string | null; supervisor_name: string | null } | null;
  schedules: ScheduleSlotRow[] | null;
};

const DAY_ABBR = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']; // index = ISO weekday

function normalizeRole(role: string): CalendarRole {
  const r = role.toUpperCase();
  if (r === 'ADMIN' || r === 'ADMINISTRADOR') return 'DEAN';
  if (r === 'STUDENT' || r === 'ESTUDIANTE' || r === 'ALUMNO') return 'STUDENT';
  return 'SUPERVISOR';
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Resume los slots en texto legible. Agrupa días con la misma franja horaria.
function buildScheduleLabel(slots: ScheduleSlotRow[]): string {
  if (slots.length === 0) return 'Horario no definido';
  const byTime = new Map<string, number[]>();
  for (const s of [...slots].sort((a, b) => a.weekday - b.weekday)) {
    const from = (s.check_in_from ?? '').slice(0, 5);
    const to = (s.check_in_to ?? '').slice(0, 5);
    const key = `${from}-${to}`;
    byTime.set(key, [...(byTime.get(key) ?? []), s.weekday]);
  }
  return [...byTime.entries()]
    .map(([time, days]) => `${days.map((d) => DAY_ABBR[d]).join(', ')} ${time}`)
    .join('  ·  ');
}

export async function fetchRotationsCalendar(): Promise<CalendarPayload> {
  const { data: auth } = await supabase.auth.getUser();
  const authUser = auth.user;
  if (!authUser?.id) {
    return { role: 'SUPERVISOR', windows: [], campusOptions: [], careerOptions: [] };
  }

  const { data: currentUser } = await supabase
    .from('users')
    .select('id, role, full_name')
    .eq('id', authUser.id)
    .single<CurrentUser>();

  const role = normalizeRole(currentUser?.role ?? 'COORDINATOR');

  // El RLS de teacher_groups ya acota las filas visibles por rol:
  //  ADMIN/COORDINATOR → todas; DOCENTE → su grupo; STUDENT → la suya.
  // No hace falta filtrar por id manualmente.
  const { data: rows } = await supabase
    .from('teacher_groups')
    .select(`
      id, student_id, campus_id, start_date, end_date,
      student:users!teacher_groups_student_id_fkey(full_name, career),
      campus:campuses(name, supervisor_name),
      schedules:student_schedules(weekday, check_in_from, check_in_to)
    `);

  const assignments = (rows ?? []) as unknown as AssignmentRow[];

  const windows: RotationWindow[] = assignments
    .map((a) => {
      if (!a.start_date || !a.end_date) return null; // sin rango no se puede ubicar en el calendario
      const slots = (a.schedules ?? []).filter((s) => s.check_in_from && s.check_in_to);
      const weekdays = slots.map((s) => s.weekday).sort((x, y) => x - y);
      return {
        studentId: a.student_id,
        studentName: a.student?.full_name ?? 'Sin nombre',
        career: a.student?.career ?? '—',
        campusId: a.campus_id ?? '',
        campusName: a.campus?.name ?? 'Sin sede',
        schedule: buildScheduleLabel(slots),
        weekdays,
        startDate: a.start_date,
        endDate: a.end_date,
        supervisorName: a.campus?.supervisor_name ?? '—',
      } satisfies RotationWindow;
    })
    .filter((row): row is RotationWindow => row !== null);

  // El alumno solo ve sus rotaciones vigentes/futuras.
  const filteredWindows =
    role === 'STUDENT' ? windows.filter((w) => w.endDate >= todayIso()) : windows;

  const campusOptions = [...new Map(filteredWindows.map((w) => [w.campusId, w.campusName])).entries()]
    .filter(([id]) => id !== '')
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    role,
    windows: filteredWindows,
    campusOptions,
    careerOptions: [...new Set(filteredWindows.map((w) => w.career))].sort((a, b) => a.localeCompare(b)),
  };
}
