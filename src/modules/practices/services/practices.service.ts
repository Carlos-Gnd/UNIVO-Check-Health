import { supabase } from '@/shared/backend/supabaseClient';
import { Practice } from '../types';

export const getPractices = async (): Promise<Practice[]> => {
  const { data, error } = await supabase
    .from('campuses')
    .select('id, name, location_label, supervisor_name, schedule, start_date, end_date, description');

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    name: (row.name as string) ?? '',
    location: (row.location_label as string) ?? (row.name as string) ?? '',
    supervisor: (row.supervisor_name as string) ?? '',
    schedule: (row.schedule as string) ?? '',
    startDate: (row.start_date as string) ?? '',
    endDate: (row.end_date as string) ?? '',
    description: (row.description as string) ?? '',
  }));
};
