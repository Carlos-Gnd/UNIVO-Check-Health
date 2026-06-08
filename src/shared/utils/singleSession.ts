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

async function registerSession(sessionId: string): Promise<void> {
  await supabase.rpc('set_active_session', {
    p_session_id: sessionId,
    p_device_label: getDeviceLabel(),
    p_user_agent: navigator.userAgent,
  });
}

export async function claimSession(userId: string): Promise<string> {
  const stored = read();
  if (stored && stored.userId === userId && stored.sessionId) {
    await registerSession(stored.sessionId);
    return stored.sessionId;
  }

  const sessionId = crypto.randomUUID();
  localStorage.setItem(KEY, JSON.stringify({ userId, sessionId } satisfies Stored));
  await registerSession(sessionId);
  return sessionId;
}

export async function checkSession(_userId: string, mySessionId: string): Promise<'ok' | 'revoked' | 'unknown'> {
  const { data, error } = await supabase.rpc('touch_active_session', { p_session_id: mySessionId });
  if (error || data == null) return 'unknown';
  return data === true ? 'ok' : 'revoked';
}
