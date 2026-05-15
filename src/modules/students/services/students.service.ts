import { supabase } from '@/shared/backend/supabaseClient';
import { Student } from '../types';

export const getStudents = async (): Promise<Student[]> => {
  const { data, error } = await supabase
    .from('users')
    .select('id, student_code, full_name, email, career, photo_url')
    .eq('role', 'STUDENT');

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    name: (row.full_name as string) ?? '',
    carnet: (row.student_code as string) ?? '',
    email: (row.email as string) ?? '',
    career: (row.career as string) ?? '',
    photo: (row.photo_url as string) ?? undefined,
  }));
};
