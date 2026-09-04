import { supabase } from '@/shared/backend/supabaseClient';

const KEY = 'checkhealth-session';

type Stored = { userId: string; sessionId: string };

function read(): Stored | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function clearLocalSession() {
  localStorage.removeItem(KEY);
}

export function getLocalSessionId(): string | null {
  return read()?.sessionId ?? null;
}

function getDeviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|Android/i.test(ua)) return 'Dispositivo movil';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS/i.test(ua)) return 'Mac';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Navegador';
}

// Da el id de sesión de ESTE dispositivo, sin tocar el servidor todavía. Si ya
// había uno guardado para este mismo usuario (recarga de página, misma pestaña),
// lo reutiliza — eso es lo que distingue "reconectar" de "sesión nueva".
export function getOrCreateLocalSessionId(userId: string): { sessionId: string; isNewDevice: boolean } {
  const stored = read();
  if (stored && stored.userId === userId && stored.sessionId) {
    return { sessionId: stored.sessionId, isNewDevice: false };
  }
  const sessionId = crypto.randomUUID();
  localStorage.setItem(KEY, JSON.stringify({ userId, sessionId } satisfies Stored));
  return { sessionId, isNewDevice: true };
}

// Reclama la sesión en el servidor: la registra como la activa y revoca
// cualquier otra sesión no revocada del mismo usuario (sesión única real, ver
// 20260904054624_fix_single_session_enforcement.sql).
export async function claimSession(sessionId: string): Promise<void> {
  await supabase.rpc('set_active_session', {
    p_session_id: sessionId,
    p_device_label: getDeviceLabel(),
    p_user_agent: navigator.userAgent,
  });
}

export type OtherActiveSession = { deviceLabel: string | null; lastSeenAt: string };

// Se llama ANTES de claimSession() en un dispositivo nuevo, para poder avisarle
// al usuario que hay otra sesión activa y dejarlo elegir si la cierra.
export async function findOtherActiveSession(): Promise<OtherActiveSession | null> {
  const { data, error } = await supabase.rpc('list_my_active_sessions');
  if (error || !data || data.length === 0) return null;
  const row = data[0] as { device_label: string | null; last_seen_at: string };
  return { deviceLabel: row.device_label, lastSeenAt: row.last_seen_at };
}

export async function checkSession(mySessionId: string): Promise<'ok' | 'revoked' | 'unknown'> {
  const { data, error } = await supabase.rpc('touch_active_session', { p_session_id: mySessionId });
  if (error || data == null) return 'unknown';
  return data === true ? 'ok' : 'revoked';
}
