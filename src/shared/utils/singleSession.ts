import { supabase } from '@/shared/backend/supabaseClient';

// Sesión única por usuario a nivel de app (alternativa al ajuste Pro de Supabase).
// Guarda un session_id por navegador; el último login gana y el resto se cierra.
const KEY = 'checkhealth-session';

type Stored = { userId: string; sessionId: string };

function read(): Stored | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; }
}

export function clearLocalSession() {
  localStorage.removeItem(KEY);
}

// Reclama la sesión para este usuario. Reusa el id si ya existe en este navegador
// (una recarga NO debe superseder); genera y supersede si es un login nuevo u otro usuario.
export async function claimSession(userId: string): Promise<string> {
  const stored = read();
  if (stored && stored.userId === userId && stored.sessionId) {
    return stored.sessionId;
  }
  const sessionId = crypto.randomUUID();
  localStorage.setItem(KEY, JSON.stringify({ userId, sessionId } satisfies Stored));
  await supabase.rpc('set_active_session', { p_session_id: sessionId });
  return sessionId;
}

// Compara mi session_id con el activo en BD.
// 'superseded' → otro dispositivo inició sesión después; 'unknown' → no concluir nada.
export async function checkSession(userId: string, mySessionId: string): Promise<'ok' | 'superseded' | 'unknown'> {
  const { data, error } = await supabase
    .from('users')
    .select('active_session_id')
    .eq('id', userId)
    .single();
  if (error || !data) return 'unknown';
  const active = (data as { active_session_id: string | null }).active_session_id;
  if (!active) return 'unknown';
  return active === mySessionId ? 'ok' : 'superseded';
}
