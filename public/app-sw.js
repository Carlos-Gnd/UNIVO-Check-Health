// Service worker mínimo de UNIVO Check-Health.
// PWA INSTALABLE PERO SIEMPRE ONLINE: este SW NO cachea datos ni respuestas.
// Su único fetch handler es de paso directo a la red, lo justo para cumplir el
// criterio de instalabilidad de los navegadores. No hay modo offline (decisión
// D4-09: lo offline queda fuera por complejidad y aspectos legales).

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Passthrough: siempre va a la red. Si no hay red, el navegador muestra su error
// estándar (no servimos una página offline a propósito).
self.addEventListener('fetch', () => { /* network-only: sin respond, el navegador usa la red */ });
