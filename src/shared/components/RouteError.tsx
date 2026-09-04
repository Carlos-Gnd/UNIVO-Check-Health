import { useRouteError, useNavigate } from 'react-router';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from './ui/button';

// errorElement del router: sin esto, cualquier error de ruta (incluida la falla
// de "error loading dynamically imported module" cuando el navegador tenía la app
// abierta desde antes de un deploy nuevo, y el chunk que pide ya no existe) caía en
// la pantalla genérica de React Router ("💿 Hey developer 👋..."). El wrapper de
// lazyPage en routes.tsx ya intenta recargar una vez solo ante ese caso puntual;
// esto es la red de contención para lo que se le escape.
export function RouteError() {
  const error = useRouteError();
  const navigate = useNavigate();

  const message = error instanceof Error ? error.message : String(error);
  const isStaleChunk = /dynamically imported module|failed to fetch/i.test(message);

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-red-600" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Algo salió mal</h1>
          <p className="text-sm text-gray-500">
            {isStaleChunk
              ? 'La aplicación se actualizó mientras la tenías abierta. Recargá la página para seguir usándola.'
              : 'Ocurrió un error inesperado. Podés intentar recargar la página o volver al inicio.'}
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Recargar
          </Button>
          <Button variant="outline" onClick={() => navigate('/')}>
            <Home className="w-4 h-4 mr-2" />
            Volver al inicio
          </Button>
        </div>
      </div>
    </div>
  );
}
