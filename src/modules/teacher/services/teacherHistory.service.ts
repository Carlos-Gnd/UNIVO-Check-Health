import { supabase } from '@/shared/backend/supabaseClient';

export type TeacherDecisionStatus = 'APROBADO' | 'RECHAZADO' | 'PENDIENTE' | 'ESCALADO' | 'DESCONOCIDO';

export type TeacherDecision = {
  id: number;
  action: string;
  eventAt: string;
  studentId: string | null;
  studentName: string;
  studentCode: string;
  status: TeacherDecisionStatus;
  previousStatus: string | null;
  justificationId: string | null;
  attendanceId: string | null;
  reviewerNotes: string | null;
  escalated: boolean;
};

type AuditRow = {
  id: number;
  action: string;
  event_at: string;
  target_user_id: string | null;
  details: {
    justification_id?: string;
    attendance_id?: string;
    status_anterior?: string;
    status_nuevo?: string;
    escalated?: boolean;
    notas_revisor?: string;
  } | null;
};

type UserRow = {
  id: string;
  full_name: string | null;
  student_code: string | null;
};

export async function fetchTeacherDecisionHistory(): Promise<TeacherDecision[]> {
  const { data: authData } = await supabase.auth.getUser();
  const teacherId = authData.user?.id;
  if (!teacherId) return [];

  const { data, error } = await supabase
    .from('audit_log')
    .select('id, action, event_at, target_user_id, details')
    .eq('actor_user_id', teacherId)
    .in('action', ['JUSTIFICATION_REVIEWED', 'JUSTIFICATION_ESCALATED'])
    .order('event_at', { ascending: false })
    .limit(250);

  if (error || !data) {
    if (error) console.error('Error loading teacher decision history', error);
    return [];
  }

  const rows = data as AuditRow[];
  const studentIds = Array.from(new Set(rows.map((row) => row.target_user_id).filter(Boolean))) as string[];
  const users = await fetchUsersById(studentIds);

  return rows.map((row) => {
    const student = row.target_user_id ? users.get(row.target_user_id) : undefined;
    const status = normalizeStatus(row.action, row.details?.status_nuevo, row.details?.escalated);

    return {
      id: row.id,
      action: row.action,
      eventAt: row.event_at,
      studentId: row.target_user_id,
      studentName: student?.full_name ?? 'Estudiante sin nombre',
      studentCode: student?.student_code ?? 'Sin carnet',
      status,
      previousStatus: row.details?.status_anterior ?? null,
      justificationId: row.details?.justification_id ?? null,
      attendanceId: row.details?.attendance_id ?? null,
      reviewerNotes: row.details?.notas_revisor ?? null,
      escalated: Boolean(row.details?.escalated),
    };
  });
}

async function fetchUsersById(ids: string[]): Promise<Map<string, UserRow>> {
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, student_code')
    .in('id', ids);

  if (error || !data) return new Map();
  return new Map((data as UserRow[]).map((user) => [user.id, user]));
}

function normalizeStatus(action: string, status?: string, escalated?: boolean): TeacherDecisionStatus {
  if (action === 'JUSTIFICATION_ESCALATED' || escalated) return 'ESCALADO';
  const normalized = (status ?? '').toUpperCase();
  if (['APROBADO', 'RECHAZADO', 'PENDIENTE'].includes(normalized)) {
    return normalized as TeacherDecisionStatus;
  }
  return 'DESCONOCIDO';
}
