// Paso de onboarding de permisos. Se muestra una vez por dispositivo, tras el
// gate legal en el primer inicio de sesión, para pedir de golpe los permisos que
// la app necesita (ubicación, cámara, notificaciones, sensores). Cada permiso se
// pide desde el gesto del botón (requisito de los navegadores). Es saltable.

import { useState } from 'react';
import { MapPin, Camera, Bell, Activity, Check, X, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

type Status = 'idle' | 'granted' | 'denied';

export const PERMISSIONS_KEY = 'checkhealth-permissions-prompted-v1';

export function PermissionsSetup({ onDone }: { onDone: () => void }) {
  const [gps, setGps] = useState<Status>('idle');
  const [cam, setCam] = useState<Status>('idle');
  const [notif, setNotif] = useState<Status>('idle');
  const [running, setRunning] = useState(false);
  const [asked, setAsked] = useState(false);

  const secure = typeof window !== 'undefined' && window.isSecureContext;

  const requestAll = async () => {
    setRunning(true);

    // 1. Ubicación (GPS) — imprescindible para marcar asistencia.
    await new Promise<void>((resolve) => {
      if (!('geolocation' in navigator)) { setGps('denied'); return resolve(); }
      navigator.geolocation.getCurrentPosition(
        () => { setGps('granted'); resolve(); },
        () => { setGps('denied'); resolve(); },
        { timeout: 10000, enableHighAccuracy: true },
      );
    });

    // 2. Cámara — para escanear el QR. Pedimos el permiso y soltamos el stream.
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('no-media');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach((t) => t.stop());
      setCam('granted');
    } catch { setCam('denied'); }

    // 3. Notificaciones — recordatorios y avisos.
    try {
      if ('Notification' in window) {
        const p = await Notification.requestPermission();
        setNotif(p === 'granted' ? 'granted' : 'denied');
      } else { setNotif('denied'); }
    } catch { setNotif('denied'); }

    // 4. Sensores de movimiento (iOS 13+) — best-effort, no se muestra estado.
    try {
      const dm = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
      if (dm && typeof dm.requestPermission === 'function') await dm.requestPermission();
    } catch { /* ignore */ }

    setAsked(true);
    setRunning(false);
  };

  const finish = () => {
    localStorage.setItem(PERMISSIONS_KEY, '1');
    onDone();
  };

  const row = (icon: React.ReactNode, title: string, desc: string, status: Status) => (
    <div className="flex items-start gap-3 rounded-lg border border-brand-100 p-3">
      <div className="mt-0.5 w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center ring-1 ring-brand-100 shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-brand-900">{title}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
      <div className="shrink-0 mt-1">
        {status === 'granted' && <Check className="w-5 h-5 text-green-600" />}
        {status === 'denied' && <X className="w-5 h-5 text-amber-500" />}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-surface to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-brand-100 bg-white shadow-[0_24px_70px_rgba(26,45,107,0.16)] p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center ring-1 ring-brand-100">
            <ShieldCheck className="w-6 h-6 text-brand-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-brand-900">Permisos de la app</h2>
            <p className="text-xs text-slate-500">Para que todo funcione, concede estos permisos</p>
          </div>
        </div>

        <div className="mt-5 space-y-2.5">
          {row(<MapPin className="w-5 h-5 text-brand-700" />, 'Ubicación (GPS)', 'Verifica que estás en la sede al marcar.', gps)}
          {row(<Camera className="w-5 h-5 text-brand-700" />, 'Cámara', 'Para escanear el código QR de la sede.', cam)}
          {row(<Bell className="w-5 h-5 text-brand-700" />, 'Notificaciones', 'Recordatorios de check-out y avisos.', notif)}
          {row(<Activity className="w-5 h-5 text-brand-700" />, 'Sensores de movimiento', 'Ayudan a detectar marcajes fraudulentos.', 'idle')}
        </div>

        {!secure && (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Abre la app desde su enlace seguro (https). Por una conexión no segura, la cámara y el GPS pueden no concederse.
          </p>
        )}

        <Button
          onClick={requestAll}
          disabled={running}
          className="w-full mt-6 h-11 bg-brand-800 hover:bg-brand-900 text-white font-semibold"
        >
          {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          {asked ? 'Volver a pedir permisos' : 'Conceder permisos'}
        </Button>

        <button type="button" onClick={finish} className="w-full mt-3 text-sm text-brand-700 hover:text-gold-700 font-medium">
          {asked ? 'Continuar' : 'Omitir por ahora'}
        </button>

        <p className="mt-3 text-[11px] text-slate-400 text-center">
          Si rechazas alguno, podrás concederlo después desde los ajustes del navegador.
        </p>
      </div>
    </div>
  );
}
