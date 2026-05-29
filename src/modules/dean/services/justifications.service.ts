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

// ─────────────────────────────────────────────────────────────────────────────
// Funciones del panel del estudiante (T-17.2)
// ─────────────────────────────────────────────────────────────────────────────

export type StudentJustification = {
  id: string;
  attendanceDate: string;
  campusName: string;
  reason: string;
  documentUrl: string | null;
  status: JustificationStatus;
  reviewerNotes: string | null;
  createdAt: string;
};

export type AttendanceOption = {
  id: string;
  date: string;
  campusName: string;
  checkIn: string;
};

export async function fetchStudentJustifications(): Promise<StudentJustification[]> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return [];

  const { data, error } = await supabase
    .from('justifications')
    .select(`
      id, motivo, documento_url, status, notas_revisor, creado_en,
      attendance:attendances!justifications_attendance_id_fkey(
        date, check_in, campuses(name)
      )
    `)
    .eq('student_id', authData.user.id)
    .order('creado_en', { ascending: false });

  if (error || !data) return [];

  return (data as any[]).map((row) => ({
    id: row.id,
    attendanceDate: row.attendance?.date ?? row.creado_en.slice(0, 10),
    campusName: row.attendance?.campuses?.name ?? 'Sede desconocida',
    reason: row.motivo,
    documentUrl: row.documento_url,
    status: row.status as JustificationStatus,
    reviewerNotes: row.notas_revisor,
    createdAt: row.creado_en,
  }));
}

export async function fetchStudentAttendances(): Promise<AttendanceOption[]> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return [];

  const { data, error } = await supabase
    .from('attendances')
    .select('id, date, check_in, campuses(name)')
    .eq('student_id', authData.user.id)
    .not('check_out', 'is', null)
    .order('date', { ascending: false })
    .limit(60);

  if (error || !data) return [];

  return (data as any[]).map((row) => ({
    id: row.id,
    date: row.date,
    campusName: row.campuses?.name ?? 'Sede desconocida',
    checkIn: row.check_in,
  }));
}

export async function submitJustification(params: {
  attendanceId: string;
  reason: string;
  documentFile?: File;
}): Promise<{ ok: boolean; message?: string }> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return { ok: false, message: 'Sesión no encontrada.' };

  // Verificar que no haya una justificación pendiente para la misma asistencia
  const { data: existing } = await supabase
    .from('justifications')
    .select('id')
    .eq('attendance_id', params.attendanceId)
    .eq('student_id', userId)
    .eq('status', 'PENDIENTE')
    .single();

  if (existing) return { ok: false, message: 'Ya tienes una justificación pendiente para esta asistencia.' };

  let documentUrl: string | null = null;

  if (params.documentFile) {
    const ext = params.documentFile.name.split('.').pop() ?? 'bin';
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('justifications')
      .upload(path, params.documentFile, { cacheControl: '3600', upsert: false });

    if (uploadError) return { ok: false, message: 'Error al subir el documento.' };

    const { data: urlData } = supabase.storage.from('justifications').getPublicUrl(path);
    documentUrl = urlData.publicUrl;
  }

  const { error } = await supabase.from('justifications').insert({
    attendance_id: params.attendanceId,
    student_id: userId,
    motivo: params.reason.trim(),
    documento_url: documentUrl,
    status: 'PENDIENTE',
  });

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
