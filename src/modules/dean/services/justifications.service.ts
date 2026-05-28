import { supabase } from '@/shared/backend/supabaseClient';

export type JustificationStatus = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

export type PendingJustification = {
  id: string;
  attendanceId: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  career: string;
  campusName: string;
  attendanceDate: string;
  checkIn: string | null;
  checkOut: string | null;
  reason: string;
  documentUrl: string | null;
  status: JustificationStatus;
  reviewerNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

type JustificationRow = {
  id: string;
  attendance_id: string;
  student_id: string;
  motivo: string;
  documento_url: string | null;
  status: JustificationStatus;
  notas_revisor: string | null;
  creado_en: string;
  actualizado_en: string;
  student?: {
    student_code: string | null;
    full_name: string | null;
    career: string | null;
  } | null;
  attendance?: {
    date: string | null;
    check_in: string | null;
    check_out: string | null;
    campuses?: { name: string | null } | null;
  } | null;
};

export async function fetchPendingJustifications(): Promise<PendingJustification[]> {
  const { data, error } = await supabase
    .from('justifications')
    .select(`
      id,
      attendance_id,
      student_id,
      motivo,
      documento_url,
      status,
      notas_revisor,
      creado_en,
      actualizado_en,
      student:users!justifications_student_id_fkey(student_code, full_name, career),
      attendance:attendances!justifications_attendance_id_fkey(
        date,
        check_in,
        check_out,
        campuses(name)
      )
    `)
    .eq('status', 'PENDIENTE')
    .order('creado_en', { ascending: true });

  if (error || !data) {
    if (error) console.error('Error loading pending justifications', error);
    return [];
  }

  return (data as unknown as JustificationRow[]).map((row) => ({
    id: row.id,
    attendanceId: row.attendance_id,
    studentId: row.student_id,
    studentCode: row.student?.student_code ?? 'Sin carnet',
    studentName: row.student?.full_name ?? 'Estudiante sin nombre',
    career: row.student?.career ?? 'Sin carrera',
    campusName: row.attendance?.campuses?.name ?? 'Sede desconocida',
    attendanceDate: row.attendance?.date ?? row.creado_en.slice(0, 10),
    checkIn: row.attendance?.check_in ?? null,
    checkOut: row.attendance?.check_out ?? null,
    reason: row.motivo,
    documentUrl: row.documento_url,
    status: row.status,
    reviewerNotes: row.notas_revisor,
    createdAt: row.creado_en,
    updatedAt: row.actualizado_en,
  }));
}

export async function reviewJustification(params: {
  id: string;
  status: Exclude<JustificationStatus, 'PENDIENTE'>;
  notes: string;
}): Promise<{ ok: boolean; message?: string }> {
  const { data: authData } = await supabase.auth.getUser();
  const reviewerId = authData.user?.id;

  const { error } = await supabase
    .from('justifications')
    .update({
      status: params.status,
      notas_revisor: params.notes.trim(),
      revisado_por: reviewerId ?? null,
      actualizado_en: new Date().toISOString(),
    })
    .eq('id', params.id);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export function subscribeToJustificationChanges(onChange: () => void) {
  const channel = supabase
    .channel('pending-justifications-review')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'justifications' },
      () => onChange(),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
