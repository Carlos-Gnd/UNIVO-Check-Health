// Extraído de app/routes.tsx para poder testearlo (window.location.reload no se
// puede probar de forma realista si queda inline dentro de createBrowserRouter).
//
// Si el navegador tenía la app abierta desde ANTES de un deploy nuevo, el hash del
// chunk que pide ya no existe en el servidor ("error loading dynamically imported
// module") — recarga la página una sola vez para traer el index.html actualizado
// con el manifest correcto, en vez de dejar que el error genérico de React Router
// ("💿 Hey developer 👋...") sea lo único que ve el usuario.
export const CHUNK_RELOAD_KEY = 'checkhealth-chunk-reload';

function isStaleChunkError(err: unknown): boolean {
  return err instanceof Error && /dynamically imported module|failed to fetch/i.test(err.message);
}

// `reload` es inyectable para poder testearlo sin depender de window.location real.
export async function importWithReload<T>(
  factory: () => Promise<T>,
  reload: () => void = () => window.location.reload(),
): Promise<T> {
  try {
    const mod = await factory();
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    return mod;
  } catch (err) {
    const alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1';
    if (isStaleChunkError(err) && !alreadyReloaded) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
      reload();
      // La página está por recargar — cuelga la promesa a propósito en vez de
      // resolver con nada usable.
      return new Promise<T>(() => {});
    }
    throw err;
  }
}
