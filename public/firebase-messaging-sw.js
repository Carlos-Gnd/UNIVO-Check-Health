// Service Worker para notificaciones push en segundo plano (FCM).
// La configuración de Firebase se recibe desde src/shared/utils/firebase.ts
// a través de postMessage después de registrar el SW.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

let messaging = null;

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'FIREBASE_CONFIG') return;

  try {
    const app = firebase.initializeApp(event.data.config);
    messaging = firebase.messaging(app);

    messaging.onBackgroundMessage((payload) => {
      const title   = payload.notification?.title ?? 'UNIVO Check-Health';
      const options = {
        body:  payload.notification?.body ?? '',
        icon:  '/favicon.ico',
        badge: '/favicon.ico',
        data:  payload.data ?? {},
      };
      self.registration.showNotification(title, options);
    });
  } catch (err) {
    console.error('[FCM SW] Error al inicializar Firebase:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});
