import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { LogOut, Monitor, ShieldAlert } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

export type OtherSession = { deviceLabel: string | null; lastSeenAt: string };

// Pantalla bloqueante que aparece SOLO cuando el login detecta que ya hay otra
// sesión activa para este usuario (sesión única). Estilo banco: se le pregunta al
// usuario antes de cerrar la sesión del otro dispositivo, en vez de cerrarla en
// silencio y que el otro dispositivo se entere hasta 45s después.
export function ActiveSessionConflict({
  session,
  onConfirm,
  onCancel,
}: {
  session: OtherSession;
  onConfirm: () => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const [isWorking, setIsWorking] = useState<'confirm' | 'cancel' | null>(null);

  const lastSeen = formatDistanceToNow(new Date(session.lastSeenAt), { locale: es, addSuffix: true });
  const deviceLabel = session.deviceLabel ?? 'otro dispositivo';

  const handleConfirm = async () => {
    setIsWorking('confirm');
    try {
      await onConfirm();
    } finally {
      setIsWorking(null);
    }
  };

  const handleCancel = async () => {
    setIsWorking('cancel');
    try {
      await onCancel();
    } finally {
      setIsWorking(null);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(245,166,35,0.14),transparent_28%),linear-gradient(135deg,#eef3fb_0%,#f7f9fd_48%,#ffffff_100%)] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md rounded-xl border border-brand-100 bg-white shadow-[0_24px_70px_rgba(26,45,107,0.16)]">
        <div className="border-b border-brand-100 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-100">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-brand-900">Ya tenés una sesión activa</h1>
              <p className="mt-1 text-sm text-slate-500">
                Solo se permite una sesión por cuenta a la vez. Para continuar acá, hay que cerrar la otra.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex items-center gap-3 rounded-lg border border-brand-100 bg-brand-50/50 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white ring-1 ring-brand-100 text-brand-700">
              <Monitor className="h-4 w-4" />
            </div>
            <div className="text-sm">
              <p className="font-medium text-brand-900">{deviceLabel}</p>
              <p className="text-xs text-slate-500">Última actividad {lastSeen}</p>
            </div>
          </div>

          <Button
            type="button"
            disabled={isWorking !== null}
            onClick={() => void handleConfirm()}
            className="w-full bg-brand-800 text-white hover:bg-brand-900"
          >
            Cerrar esa sesión y continuar acá
          </Button>

          <Button
            type="button"
            variant="ghost"
            disabled={isWorking !== null}
            onClick={() => void handleCancel()}
            className="w-full text-brand-700"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
