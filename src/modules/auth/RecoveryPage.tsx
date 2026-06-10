import { useEffect, useState, type FormEvent } from 'react';
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

// supabase-js mete los errores HTTP (4xx/5xx) en `error` con la respuesta en
// `error.context`; sin leerla solo veríamos "Failed to send a request to the Edge
// Function". Aquí extraemos el mensaje real que devuelve la función.
async function extractServerError(error: unknown): Promise<string | undefined> {
  const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } })?.context;
  if (ctx && typeof ctx.json === 'function') {
    try { return (await ctx.json())?.error; } catch { /* respuesta no-JSON */ }
  }
  return undefined;
}

async function invokeRecovery(body: Record<string, unknown>, fallback: string) {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; message?: string; error?: string }>('recovery-otp', { body });
  if (error) {
    const serverMsg = await extractServerError(error);
    throw new Error(serverMsg ?? error.message ?? fallback);
  }
  if (data?.ok !== true) throw new Error(data?.error ?? fallback);
  return data.message ?? fallback;
}

async function requestRecoveryOtp(email: string, answer: string) {
  return invokeRecovery({ action: 'request', email, answer }, 'No se pudo enviar el código.');
}

async function verifyRecoveryOtp(email: string, code: string) {
  return invokeRecovery({ action: 'verify', email, code }, 'No se pudo validar el código.');
}

export function RecoveryPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [answer, setAnswer] = useState('');
  const [otp, setOtp] = useState('');
  const [question, setQuestion] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [doneMsg, setDoneMsg] = useState('');

  const normalizedEmail = email.trim().toLowerCase();

  // B2: muestra la pregunta de seguridad automáticamente al escribir un correo
  // institucional válido (con debounce). Antes dependía de onBlur, que en móvil
  // exige tocar fuera del campo y dejaba la pregunta oculta.
  useEffect(() => {
    if (!normalizedEmail.endsWith(UNIVO_DOMAIN)) {
      setQuestion(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const q = await fetchSecurityQuestion(normalizedEmail);
      if (!cancelled) setQuestion(q);
    }, 450);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [normalizedEmail]);

  // Backup: también intenta al salir del campo (por si el debounce no corrió aún).
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
      setDoneMsg(message);
      setDone(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo validar el codigo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative bg-brand-900" style={{ backgroundImage: 'url(/images/fondo_login.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 bg-brand-900/50" />
      <div className="relative z-10 w-full max-w-5xl rounded-2xl overflow-hidden border border-gold-400/20 shadow-[0_24px_70px_rgba(10,17,40,0.55)]">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Panel izquierdo — marca (igual al login) */}
          <section className="hidden lg:block p-8 sm:p-10 border-r border-white/10 bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900">
            <div className="w-24 h-24 rounded-2xl bg-white border border-gold-200 flex items-center justify-center shadow-[0_4px_18px_rgba(0,0,0,0.35)] overflow-hidden">
              <img src="/images/isologo.png" alt="Logo UNIVO Check-Health" className="w-20 h-20 object-contain" />
            </div>
            <div className="mt-6 flex items-center gap-3">
              <div className="w-1 h-10 rounded-full bg-gold-400 shrink-0" />
              <div>
                <h1 className="text-3xl font-bold tracking-wide text-white">UNIVO Check-Health</h1>
                <p className="mt-0.5 text-sm tracking-[0.2em] uppercase text-gold-300">Recuperar acceso</p>
              </div>
            </div>
            <div className="mt-10 space-y-3">
              <div className={`rounded-xl border p-4 flex items-center gap-3 ${step === 1 ? 'border-gold-400/30 bg-white/10' : 'border-white/10 bg-white/5'}`}>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-400/15 ring-1 ring-gold-400/30 text-gold-300 font-semibold shrink-0">1</div>
                <div><p className="text-sm font-semibold text-white">Verifica tu identidad</p><p className="text-xs text-brand-100/60">Pregunta de seguridad ligada a tu correo</p></div>
              </div>
              <div className={`rounded-xl border p-4 flex items-center gap-3 ${step === 2 ? 'border-gold-400/30 bg-white/10' : 'border-white/10 bg-white/5'}`}>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15 text-gold-300 font-semibold shrink-0">2</div>
                <div><p className="text-sm font-semibold text-white">Código OTP</p><p className="text-xs text-brand-100/60">Te llega a tu correo institucional</p></div>
              </div>
            </div>
          </section>

          {/* Panel derecho — formulario */}
          <section className="p-5 sm:p-8 lg:p-10 bg-gradient-to-br from-brand-800 via-brand-900 to-[#071024]">
            <Link to="/" className="inline-flex items-center gap-2 text-xs font-medium text-gold-400/80 hover:text-gold-300">
              <ArrowLeft className="h-4 w-4" />Volver al acceso
            </Link>
            <p className="mt-5 text-xs uppercase tracking-[0.22em] text-gold-400 mb-5">
              {step === 1 ? 'Paso 1 · Seguridad' : 'Paso 2 · Código OTP'}
            </p>

            <div className="rounded-xl bg-white/95 p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
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
          ) : done ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-brand-900">¡Identidad verificada!</h2>
              <p className="text-sm text-slate-600">{doneMsg}</p>
              <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 text-left">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Te enviamos una <strong>contraseña temporal</strong> a tu correo. Si no la ves, <strong>revisa la carpeta de Spam</strong>. Al iniciar sesión te pediremos crear una contraseña nueva.</span>
              </p>
              <Button asChild className="mt-2 w-full bg-brand-800 text-white hover:bg-brand-900">
                <Link to="/">Ir a iniciar sesión</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-brand-700">Código de verificación</Label>
                <p className="text-xs text-slate-500">Ingresa el código de 6 dígitos que enviamos a tu correo.</p>
                <InputOTP maxLength={6} value={otp} onChange={setOtp} containerClassName="justify-center">
                  <InputOTPGroup className="gap-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <InputOTPSlot key={index} index={index} className="h-12 w-12 rounded-md border border-brand-200 bg-white text-lg font-semibold text-brand-900 shadow-sm" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Enviamos el código a tu correo institucional (y de respaldo, si tienes). Si no lo ves en unos minutos, <strong>revisa tu carpeta de Spam o Correo no deseado</strong> y marca el mensaje como seguro.</span>
              </p>
              <Button type="submit" disabled={isSubmitting} className="w-full bg-brand-800 text-white hover:bg-brand-900">
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Validando...</> : <><CheckCircle2 className="mr-2 h-4 w-4" />Validar codigo</>}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep(1)} className="w-full text-brand-700">
                Cambiar respuesta
              </Button>
            </form>
          )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
