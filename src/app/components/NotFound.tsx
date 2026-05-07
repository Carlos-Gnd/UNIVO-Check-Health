import { Link } from 'react-router';
import { Home, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';

export function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-semibold text-gray-900 mb-2">404</h1>
          <p className="text-lg text-gray-600">Página no encontrada</p>
          <p className="text-sm text-gray-500 mt-2">
            La página que buscas no existe o ha sido movida.
          </p>
        </div>
        <Link to="/">
          <Button>
            <Home className="w-4 h-4 mr-2" />
            Volver al inicio
          </Button>
        </Link>
      </div>
    </div>
  );
}
