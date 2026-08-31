// R1-06: Error tracking en el cliente (Sentry).
// Variable de entorno requerida en .env.local / panel de Netlify:
//   VITE_SENTRY_DSN
// Si falta (cuenta institucional aún no creada — Sprint 4), initSentry() no hace
// nada: la app funciona igual, solo sin reporte a Sentry. Ver ErrorBoundary.tsx,
// que llama a Sentry.captureException además de su registro existente en audit_log.

import * as Sentry from '@sentry/react';

const isSentryConfigured = () => Boolean(import.meta.env.VITE_SENTRY_DSN);

export function initSentry(): void {
  if (!isSentryConfigured()) return;

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
  });
}
