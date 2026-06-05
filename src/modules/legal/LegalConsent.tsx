// Gate bloqueante de consentimiento legal. Se muestra tras el login (después del
// cambio de contraseña obligatorio) cuando el usuario no ha aceptado la versión
// vigente de los documentos legales. Sin aceptar, no se entra a la aplicación.

import { useState } from 'react';
import { Link } from 'react-router';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { supabase } from '@/shared/backend/supabaseClient';
import { toast } from 'sonner';
import { LEGAL_VERSION } from './legalContent';

export function LegalConsent({ onAccept }: { onAccept: () => void }) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAccept = async () => {
    if (!checked) return;
    setSaving(true);
    const { error } = await supabase.rpc('accept_legal_terms', { p_version: LEGAL_VERSION });
    setSaving(false);
    if (error) {
      toast.error('No se pudo registrar tu aceptación. Intenta de nuevo.');
      return;
    }
    onAccept();
  };

  const link = (href: string, label: string) => (
    <Link to={href} className="text-brand-700 underline hover:text-gold-700">
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-surface to-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-brand-100 bg-white shadow-[0_24px_70px_rgba(26,45,107,0.16)] p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center ring-1 ring-brand-100">
            <ShieldCheck className="w-6 h-6 text-brand-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-brand-900">Antes de continuar</h2>
            <p className="text-xs text-slate-500">Tu privacidad y el uso correcto del sistema</p>
          </div>
        </div>

        <p className="mt-5 text-sm text-slate-700">
          UNIVO Check-Health trata datos como tu <strong>ubicación al marcar</strong>, tu dirección IP y
          una huella de tu dispositivo para verificar tu asistencia y prevenir el fraude. Para usar la
          aplicación debes leer y aceptar nuestros documentos:
        </p>

        <ul className="mt-3 space-y-1.5 text-sm">
          <li>• {link('/legal/privacy', 'Política de Privacidad')}</li>
          <li>• {link('/legal/cookies', 'Política de Cookies y Almacenamiento')}</li>
          <li>• {link('/legal/terms', 'Términos y Condiciones')}</li>
        </ul>

        <label className="mt-5 flex items-start gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-brand-200 text-brand-700 focus:ring-brand-700"
          />
          <span className="text-sm text-slate-700">
            He leído y acepto la Política de Privacidad, la Política de Cookies y los Términos y
            Condiciones de UNIVO Check-Health.
          </span>
        </label>

        <Button
          onClick={handleAccept}
          disabled={!checked || saving}
          className="w-full mt-6 h-11 bg-brand-800 hover:bg-brand-900 text-white font-semibold"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Aceptar y continuar
        </Button>

        <button
          type="button"
          onClick={() => void supabase.auth.signOut()}
          className="w-full mt-3 text-xs text-slate-500 hover:text-brand-700"
        >
          No acepto — cerrar sesión
        </button>
      </div>
    </div>
  );
}
