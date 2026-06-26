import { useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/shared/backend/supabaseClient';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { isAcceptablePassword, passwordStrength } from '@/shared/utils/passwordStrength';

const LEVEL_STYLES: Record<string, { bar: string; text: string; fill: number }> = {
  'débil': { bar: 'bg-red-500', text: 'text-red-600', fill: 1 },
  'media': { bar: 'bg-amber-500', text: 'text-amber-600', fill: 3 },
  'fuerte': { bar: 'bg-green-600', text: 'text-green-700', fill: 5 },
};

// Pantalla bloqueante que obliga a cambiar la contraseña temporal de un solo uso
// en el primer ingreso. Al terminar, llama onDone() para liberar el acceso.
export function ForcePasswordChange({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const strength = useMemo(() => passwordStrength(password), [password]);
  const style = LEVEL_STYLES[strength.level];
  const matches = confirm.length > 0 && password === confirm;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isAcceptablePassword(password)) {
      toast.error('La contraseña es muy débil. Usa al menos 8 caracteres combinando mayúsculas, números o símbolos.');
      return;
    }
    if (password !== confirm) {
      toast.error('Las contraseñas no coinciden.');
      return;
    }

    setIsSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        toast.error(updateError.message || 'No se pudo actualizar la contraseña.');
        return;
      }
      const { error: rpcError } = await supabase.rpc('complete_password_change');
      if (rpcError) {
        toast.error('La contraseña se cambió, pero hubo un problema al confirmar. Vuelve a iniciar sesión.');
        return;
      }
      toast.success('Contraseña actualizada. ¡Bienvenido/a!');
      onDone();
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(245,166,35,0.14),transparent_28%),linear-gradient(135deg,#eef3fb_0%,#f7f9fd_48%,#ffffff_100%)] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md rounded-xl border border-brand-100 bg-white shadow-[0_24px_70px_rgba(26,45,107,0.16)]">
        <div className="border-b border-brand-100 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-brand-900">Crea tu contraseña</h1>
              <p className="mt-1 text-sm text-slate-500">
                Tu contraseña actual es temporal y de un solo uso. Define una nueva para continuar.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
          <div className="space-y-2">
            <Label htmlFor="new-password" className="flex items-center gap-1 text-xs uppercase tracking-wide text-brand-700">
              <KeyRound className="h-3.5 w-3.5" />
              Nueva contraseña
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-700"
                aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Medidor de fuerza */}
            {password.length > 0 && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((seg) => (
                    <div
                      key={seg}
                      className={`h-1.5 flex-1 rounded-full ${seg <= style.fill ? style.bar : 'bg-gray-200'}`}
                    />
                  ))}
                </div>
                <p className={`text-xs font-medium ${style.text}`}>Seguridad: {strength.level}</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-xs uppercase tracking-wide text-brand-700">
              Repite la contraseña
            </Label>
            <Input
              id="confirm-password"
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Vuelve a escribirla"
              required
            />
            {confirm.length > 0 && (
              <p className={`text-xs ${matches ? 'text-green-700' : 'text-red-600'}`}>
                {matches ? 'Las contraseñas coinciden.' : 'Las contraseñas no coinciden.'}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isSaving || !isAcceptablePassword(password) || !matches}
            className="w-full bg-brand-800 text-white hover:bg-brand-900"
          >
            {isSaving
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
              : <><CheckCircle2 className="mr-2 h-4 w-4" />Guardar y continuar</>}
          </Button>

          <Button type="button" variant="ghost" onClick={handleLogout} className="w-full text-brand-700">
            <LogOut className="mr-2 h-4 w-4" />Cerrar sesión
          </Button>
        </form>
      </div>
    </div>
  );
}
