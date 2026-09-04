import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importWithReload, CHUNK_RELOAD_KEY } from '@/shared/utils/lazyImportWithReload';

// Reproduce el bug real reportado en producción: "error loading dynamically
// imported module" al navegar a una ruta cuyo chunk cambió de hash tras un deploy
// nuevo mientras el usuario tenía la app abierta.
describe('importWithReload', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('devuelve el módulo normalmente cuando el import funciona', async () => {
    const mod = { default: 'ok' };
    const result = await importWithReload(() => Promise.resolve(mod));
    expect(result).toBe(mod);
  });

  it('limpia la marca de recarga cuando el import funciona (para el próximo deploy)', async () => {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    await importWithReload(() => Promise.resolve({ default: 'ok' }));
    expect(sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBeNull();
  });

  it('recarga una vez ante el error real de chunk obsoleto (caso del bug en producción)', async () => {
    const reload = vi.fn();
    const factory = () =>
      Promise.reject(
        new Error(
          'error loading dynamically imported module: https://univocheckhealth.vercel.app/assets/DeanDashboardPage-DaYfum0T.js',
        ),
      );

    // No esperamos a que resuelva — la promesa cuelga a propósito tras recargar.
    void importWithReload(factory, reload);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBe('1');
  });

  it('NO entra en bucle: si ya se recargó una vez y el chunk sigue sin existir, propaga el error', async () => {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    const reload = vi.fn();
    const factory = () => Promise.reject(new Error('error loading dynamically imported module: /x.js'));

    await expect(importWithReload(factory, reload)).rejects.toThrow('dynamically imported module');
    expect(reload).not.toHaveBeenCalled();
  });

  it('un error que NO es de chunk obsoleto se propaga directo, sin recargar', async () => {
    const reload = vi.fn();
    const factory = () => Promise.reject(new Error('TypeError: algo explotó adentro del componente'));

    await expect(importWithReload(factory, reload)).rejects.toThrow('algo explotó');
    expect(reload).not.toHaveBeenCalled();
  });
});
