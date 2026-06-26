import { test, expect } from '@playwright/test';

// Smoke E2E del flujo crítico: login del alumno → marcar asistencia (código manual)
// → ver el modal de confirmación. Mockea GPS vía playwright.config (geolocation).
//
// Necesita cuentas/datos reales por variables de entorno (ver playwright.config.ts).
// Sin E2E_STUDENT_PASSWORD el test se SKIPea para no fallar en CI/local sin credenciales.

const STUDENT_CODE = process.env.E2E_STUDENT_CODE ?? 'U20240001';
const STUDENT_PASS = process.env.E2E_STUDENT_PASSWORD ?? '';
const CAMPUS_NAME  = process.env.E2E_CAMPUS_NAME ?? 'Hospital Nacional Rosales';
const SHORT_CODE   = process.env.E2E_SHORT_CODE ?? '';

test.describe('Check-in del alumno', () => {
  test.skip(!STUDENT_PASS, 'Define E2E_STUDENT_PASSWORD (y E2E_SHORT_CODE) para correr este test.');

  test('login y pantalla de QR carga', async ({ page }) => {
    await page.goto('/');
    await page.fill('#email', STUDENT_CODE);
    await page.fill('#password', STUDENT_PASS);
    await page.getByRole('button', { name: /iniciar sesión/i }).click();

    // La app autenticada redirige; el alumno tiene acceso al escáner.
    await page.goto('/student/qr');
    await expect(page.getByText(/registrar entrada|registrar salida/i)).toBeVisible();
  });

  test('marca asistencia con código manual y muestra el modal de éxito', async ({ page }) => {
    test.skip(!SHORT_CODE, 'Define E2E_SHORT_CODE (código de 6 letras del encargado).');

    await page.goto('/');
    await page.fill('#email', STUDENT_CODE);
    await page.fill('#password', STUDENT_PASS);
    await page.getByRole('button', { name: /iniciar sesión/i }).click();

    await page.goto('/student/qr');
    await page.getByRole('button', { name: /código manual/i }).click();

    // Selecciona la sede (Radix Select) y escribe el código.
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: CAMPUS_NAME }).click();
    await page.getByPlaceholder('ABC123').fill(SHORT_CODE);
    await page.getByRole('button', { name: /registrar entrada/i }).click();

    // El modal de confirmación (#2) debe aparecer.
    await expect(
      page.getByText(/has marcado asistencia exitosamente|salida registrada/i),
    ).toBeVisible({ timeout: 15_000 });
  });
});
