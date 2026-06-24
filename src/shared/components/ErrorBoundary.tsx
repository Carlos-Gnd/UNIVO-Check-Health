import { Component, type ErrorInfo, type ReactNode } from 'react';
import { supabase } from '@/shared/backend/supabaseClient';

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

// Captura errores de render de React para que un fallo en una pantalla no deje la app
// en blanco. Registra el error en audit_log (best-effort) como monitoreo gratuito y
// muestra una pantalla de recuperación. No reemplaza a un Sentry, pero da visibilidad.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('UI ErrorBoundary:', error, info.componentStack);
    void supabase.auth.getUser().then(({ data }) => {
      void supabase.from('audit_log').insert({
        action: 'UI_ERROR',
        actor_user_id: data.user?.id ?? null,
        details: {
          message: error.message,
          stack: (error.stack ?? '').slice(0, 2000),
          component_stack: (info.componentStack ?? '').slice(0, 2000),
          path: typeof window !== 'undefined' ? window.location.pathname : null,
        },
      });
    }).catch(() => undefined);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-brand-50">
        <div className="max-w-md w-full rounded-2xl border border-brand-100 bg-white p-8 text-center shadow-lg">
          <h1 className="text-lg font-semibold text-brand-900">Algo salió mal</h1>
          <p className="mt-2 text-sm text-slate-500">
            Ocurrió un error inesperado en esta pantalla. El incidente quedó registrado.
            Vuelve a intentarlo o recarga la página.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
            >
              Reintentar
            </button>
            <button
              onClick={() => window.location.assign('/')}
              className="rounded-md border border-brand-200 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              Ir al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }
}
