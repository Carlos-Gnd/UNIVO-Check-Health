// T-16.1: Inicialización de Firebase Cloud Messaging + registro de token en BD.
// Variables de entorno requeridas en .env.local:
//   VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,
//   VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID,
//   VITE_FIREBASE_APP_ID, VITE_FIREBASE_VAPID_KEY
// Si alguna falta, la función termina silenciosamente (FCM opcional).

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { toast } from 'sonner';
import { supabase } from '@/shared/backend/supabaseClient';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const isFcmConfigured = () => Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  import.meta.env.VITE_FIREBASE_VAPID_KEY,
);

let app: FirebaseApp | null = null;

export async function initFcm(userId: string): Promise<void> {
  if (!isFcmConfigured()) return;
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return;

  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

  // Registrar service worker y enviarle la configuración de Firebase
  let swReg: ServiceWorkerRegistration | undefined;
  try {
    swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });

    // Esperamos a que el SW esté activo para enviarle la config
    await navigator.serviceWorker.ready;
    const activeWorker = swReg.active ?? swReg.installing ?? swReg.waiting;
    activeWorker?.postMessage({ type: 'FIREBASE_CONFIG', config: firebaseConfig });
  } catch {
    // No bloquea el login si el SW falla
  }

  const messaging = getMessaging(app);

  // Notificaciones en primer plano (app abierta)
  onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? 'UNIVO Check-Health';
    const body  = payload.notification?.body  ?? '';
    toast(title, { description: body });
  });

  // Solicitar permiso y registrar token
  const permission = await Notification.requestPermission().catch(() => 'denied' as NotificationPermission);
  if (permission !== 'granted') return;

  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: swReg,
  }).catch(() => null);

  if (!token) return;

  await supabase.from('push_tokens').upsert(
    { user_id: userId, token, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  );
}
