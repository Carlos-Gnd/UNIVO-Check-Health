import { useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, Info, KeyRound, Loader2, ShieldQuestion } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/shared/components/ui/input-otp';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { toast } from 'sonner';
import { supabase } from '@/shared/backend/supabaseClient';

const UNIVO_DOMAIN = '@univo.edu.sv';

// Recupera la pregunta de seguridad del usuario para mostrársela (no es secreta).
// Devuelve null si el correo no existe o no tiene pregunta configurada.
async function fetchSecurityQuestion(email: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_security_question', { p_email: email });
  if (error) return null;
  return (data as string | null) ?? null;
}

async function requestRecoveryOtp(email: string, answer: string) {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; message?: string; error?: string }>('recovery-otp', {
    body: { action: 'request', email, answer },
  });
  if (error || data?.ok !== true) {
    throw new Error(data?.error ?? error?.message ?? 'No se pudo enviar el codigo.');
  }
  return data.message ?? 'Codigo enviado al correo de respaldo.';
}

async function verifyRecoveryOtp(email: string, code: string) {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; message?: string; error?: string }>('recovery-otp', {
    body: { action: 'verify', email, code },
  });
  if (error || data?.ok !== true) {
    throw new Error(data?.error ?? error?.message ?? 'No se pudo validar el codigo.');
  }
  return data.message ?? 'Codigo verificado correctamente.';
}

export function RecoveryPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [answer, setAnswer] = useState('');
  const [otp, setOtp] = useState('');
  const [question, setQuestion] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  // Al salir del campo de correo, intenta mostrar la pregunta de seguridad del usuario.
  const handleEmailBlur = async () => {
    if (!normalizedEmail.endsWith(UNIVO_DOMAIN)) {
      setQuestion(null);
      return;
    }
    setQuestion(await fetchSecurityQuestion(normalizedEmail));
  };

  const handleAnswerSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!normalizedEmail.endsWith(UNIVO_DOMAIN)) {
      toast.error(`Usa tu correo institucional ${UNIVO_DOMAIN}`);
      return;
    }
    if (answer.trim().length < 2) {
      toast.error('Ingresa tu respuesta de seguridad');
      return;
    }

    try {
      setIsSubmitting(true);
      const message = await requestRecoveryOtp(normalizedEmail, answer.trim());
      toast.success(message);
      setStep(2);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo enviar el codigo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (otp.length !== 6) {
      toast.error('Ingresa el codigo de 6 digitos');
      return;
    }

    try {
      setIsSubmitting(true);
      const message = await verifyRecoveryOtp(normalizedEmail, otp);
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo validar el codigo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(245,166,35,0.14),transparent_28%),linear-gradient(135deg,#eef3fb_0%,#f7f9fd_48%,#ffffff_100%)] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-xl rounded-xl border border-brand-100 bg-white shadow-[0_24px_70px_rgba(26,45,107,0.16)]">
        <div className="border-b border-brand-100 p-5 sm:p-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-900">
            <ArrowLeft className="h-4 w-4" />
            Volver al acceso
          </Link>
          <div className="mt-5 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-brand-900">Recuperar acceso</h1>
              <p className="mt-1 text-sm text-slate-500">Verifica tu identidad para continuar con el cambio de contraseña.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 border-b border-brand-100 text-sm font-medium">
          <div className={`flex items-center gap-2 px-5 py-3 ${step === 1 ? 'bg-brand-50 text-brand-900' : 'text-slate-500'}`}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-700 text-xs text-white">1</span>
            Seguridad
          </div>
          <div className={`flex items-center gap-2 px-5 py-3 ${step === 2 ? 'bg-brand-50 text-brand-900' : 'text-slate-500'}`}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-700 text-xs text-white">2</span>
            Codigo OTP
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {step === 1 ? (
            <form onSubmit={handleAnswerSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="recovery-email" className="text-xs uppercase tracking-wide text-brand-700">Correo institucional</Label>
                <Input
                  id="recovery-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onBlur={handleEmailBlur}
                  placeholder={`U20240000${UNIVO_DOMAIN}`}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="security-answer" className="flex items-center gap-1 text-xs uppercase tracking-wide text-brand-700">
                  <ShieldQuestion className="h-3.5 w-3.5" />
                  Respuesta de seguridad
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" tabIndex={-1} aria-label="Más información" className="text-brand-400 hover:text-brand-700">
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-balance">
                      No distingue mayúsculas/minúsculas ni espacios al inicio o final.
                    </TooltipContent>
                  </Tooltip>
                </Label>
                {question ? (
                  <p className="rounded-md border border-brand-100 bg-brand-50/60 px-3 py-2 text-sm text-brand-900">
                    {question}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400">
                    Escribe tu correo para ver tu pregunta de seguridad.
                  </p>
                )}
                <Input
                  id="security-answer"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="Ingresa tu respuesta"
                  required
                />
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full bg-brand-800 text-white hover:bg-brand-900">
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verificando...</> : 'Continuar'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-brand-700">Codigo de verificacion</Label>
                <InputOTP maxLength={6} value={otp} onChange={setOtp} containerClassName="justify-center">
                  <InputOTPGroup>
                    {Array.from({ length: 6 }).map((_, index) => (
                      <InputOTPSlot key={index} index={index} className="h-11 w-11 text-base" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full bg-brand-800 text-white hover:bg-brand-900">
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Validando...</> : <><CheckCircle2 className="mr-2 h-4 w-4" />Validar codigo</>}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep(1)} className="w-full text-brand-700">
                Cambiar respuesta
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
