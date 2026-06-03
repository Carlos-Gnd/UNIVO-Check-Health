import { useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, ShieldQuestion } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/shared/components/ui/input-otp';
import { toast } from 'sonner';

const UNIVO_DOMAIN = '@univo.edu.sv';

async function verifySecurityAnswer(_email: string, _answer: string) {
  // TODO: conectar con backend cuando Carlos y Nelson terminen el flujo de recuperacion.
}

async function verifyRecoveryOtp(_email: string, _code: string) {
  // TODO: conectar con backend cuando Carlos y Nelson terminen el flujo de recuperacion.
}

export function RecoveryPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [answer, setAnswer] = useState('');
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

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

    setIsSubmitting(true);
    await verifySecurityAnswer(normalizedEmail, answer.trim());
    setIsSubmitting(false);
    setStep(2);
  };

  const handleOtpSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (otp.length !== 6) {
      toast.error('Ingresa el codigo de 6 digitos');
      return;
    }

    setIsSubmitting(true);
    await verifyRecoveryOtp(normalizedEmail, otp);
    setIsSubmitting(false);
    toast.success('Codigo recibido. El backend de recuperacion queda pendiente.');
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
                  placeholder={`U20240000${UNIVO_DOMAIN}`}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="security-answer" className="flex items-center gap-1 text-xs uppercase tracking-wide text-brand-700">
                  <ShieldQuestion className="h-3.5 w-3.5" />
                  Respuesta de seguridad
                </Label>
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
