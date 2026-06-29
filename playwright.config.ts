import { defineConfig } from '@playwright/test';

// E2E de UNIVO Check-Health. Requiere: `pnpm add -D @playwright/test` + `npx playwright install chromium`.
// Variables de entorno (cuentas de prueba reales — NO commitear):
//   E2E_BASE_URL            URL a probar (por defecto el dev server local).
//   E2E_STUDENT_CODE        carné del alumno de prueba (ej. U20240001).
//   E2E_STUDENT_PASSWORD    contraseña del alumno (si falta, el test se SKIPea).
//   E2E_CAMPUS_NAME         nombre de la sede sembrada (geolocalización abajo debe caer en su radio).
//   E2E_SHORT_CODE          código de 6 letras del encargado para el check-in manual.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    headless: true,
    locale: 'es-SV',
    // El check-in valida GPS dentro del radio de la sede: se mockea la ubicación.
    // Coordenadas del seed "Hospital Nacional Rosales" (ajústalas a tu sede de prueba).
    geolocation: {
      latitude: Number(process.env.E2E_LAT ?? '13.7013'),
      longitude: Number(process.env.E2E_LNG ?? '-89.2045'),
    },
    permissions: ['geolocation'],
  },
  // Si se prueba contra una URL remota (E2E_BASE_URL), no se levanta el dev server local.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
