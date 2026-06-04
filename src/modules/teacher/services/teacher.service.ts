// T-23.2: datos del grupo del docente autenticado.
// Provee el roster del grupo y el snapshot de estudiantes activos filtrado por grupo,
// para que el mapa del docente (T-23.1, René) y las evaluaciones (T-26.x) consuman.

import { supabase } from '@/shared/backend/supabaseClient';
import { getActiveStudentsSnapshot } from '@/shared/backend/checkHealthBackend';

export const CURRENT_PERIOD = '2026-1';

export type TeacherStudent = {
  studentId: string;
  fullName: string;
  studentCode: string;
  career: string;
  campusId: string | null;
};

// Devuelve los student_id asignados al docente autenticado en el período actual.
async function getGroupStudentIds(period = CURRENT_PERIOD): Promise<string[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data, error } = await supabase
    .from('teacher_groups')
    .select('student_id')
    .eq('teacher_id', auth.user.id)
    .eq('period', period);

  if (error || !data) return [];
  return data.map((r) => r.student_id as string);
}

// Roster del grupo (nombre, carnet, carrera) — para listados y evaluaciones.
export async function fetchTeacherRoster(period = CURRENT_PERIOD): Promise<TeacherStudent[]> {
  const ids = await getGroupStudentIds(period);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('teacher_groups')
    .select('campus_id, student:users!teacher_groups_student_id_fkey(id, full_name, student_code, career)')
    .eq('period', period)
    .in('student_id', ids);

  if (error || !data) return [];

  return (data as any[]).map((row) => ({
    studentId: row.student?.id,
    fullName: row.student?.full_name ?? 'Sin nombre',
    studentCode: row.student?.student_code ?? '',
    career: row.student?.career ?? '—',
    campusId: row.campus_id ?? null,
  })).filter((s) => s.studentId);
}

// Snapshot de estudiantes ACTIVOS (con check-in abierto) del grupo del docente.
// Reusa getActiveStudentsSnapshot y filtra por los IDs del grupo (HU-23).
export async function fetchTeacherActiveSnapshot(period = CURRENT_PERIOD) {
  const ids = new Set(await getGroupStudentIds(period));
  if (ids.size === 0) return [];
  const all = await getActiveStudentsSnapshot();
  return all.filter((s) => ids.has(s.studentId));
}
