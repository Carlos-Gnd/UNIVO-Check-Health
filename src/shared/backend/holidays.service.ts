import { supabase } from '@/shared/backend/supabaseClient';

// R-03 — Feriados / días no hábiles. Catálogo compartido: el progreso del alumno
// los excluye de las ausencias y el coordinador/decano los gestiona.

export type Holiday = { date: string; name: string };

export async function fetchHolidays(): Promise<Holiday[]> {
  const { data, error } = await supabase
    .from('holidays')
    .select('holiday_date, name')
    .order('holiday_date');
  if (error || !data) return [];
  return (data as any[]).map((h) => ({ date: h.holiday_date as string, name: h.name as string }));
}

export async function fetchHolidayDates(): Promise<Set<string>> {
  const list = await fetchHolidays();
  return new Set(list.map((h) => h.date));
}

export async function addHoliday(date: string, name: string): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('holidays').upsert({ holiday_date: date, name: name.trim() });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteHoliday(date: string): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('holidays').delete().eq('holiday_date', date);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
