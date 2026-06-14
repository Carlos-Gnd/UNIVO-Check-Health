import { useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, UserPlus } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { toast } from 'sonner';
import { submitAccessRequest } from './access.service';

const ROLES = [
  { value: 'STUDENT', label: 'Estudiante' },
  { value: 'DOCENTE', label: 'Docente' },
  { value: 'COORDINATOR', label: 'Coordinador' },
  { value: 'REPRESENTATIVE', label: 'Representante hospitalario' },
];

const CAREERS = ['Enfermería', 'Medicina', 'Fisioterapia', 'Radiología', 'Laboratorio Clínico', 'Nutrición'];

export function RequestAccessPage() {
  const [fullName, setFullName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [requestedRole, setRequestedRole] = useState('STUDENT');
  const [career, setCareer] = useState(CAREERS[0]);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (fullName.trim().length < 3) { toast.error('Ingresa tu nombre completo.'); return; }
    if (studentCode.trim().length < 4) { toast.error('Ingresa tu carné o código.'); return; }

    setIsSubmitting(true);
    const res = await submitAccessRequest({
      fullName,
      studentCode,
      requestedRole,
      career: requestedRole === 'STUDENT' ? career : undefined,
      reason,
    });
    setIsSubmitting(false);

    if (!res.ok) { toast.error(res.message ?? 'No se pudo enviar la solicitud.'); return; }
    setDone(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative bg-brand-900" style={{ backgroundImage: 'url(/images/fondo_login.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 bg-brand-900/50" />
      <div className="login-card relative z-10 w-full max-w-lg rounded-2xl overflow-hidden border border-gold-400/20 shadow-[0_24px_70px_rgba(10,17,40,0.55)] bg-gradient-to-br from-brand-800 via-brand-900 to-[#071024]">
        <div className="p-6 sm:p-8">
          <div className="login-logo flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-white border border-gold-200 flex items-center justify-center shadow-sm overflow-hidden">
              <img src="/images/isologo.png" alt="Logo UNIVO Check-Health" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Solicitar acceso</h1>
              <p className="text-xs tracking-[0.16em] uppercase text-gold-300">UNIVO Check-Health</p>
            </div>
          </div>

          {done ? (
            <div className="login-label space-y-4 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
              <p className="text-sm text-brand-100">
                Tu solicitud fue enviada. Un docente o el decano la revisará; si se aprueba,
                recibirás tus credenciales en tu correo institucional.
              </p>
              <Button asChild className="w-full bg-brand-700 hover:bg-brand-600 text-white border border-gold-400/20">
                <Link to="/">Volver a iniciar sesión</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="login-label text-xs text-brand-200/70">
                ¿No tienes cuenta? Completa este formulario. Tu solicitud será revisada por un
                docente o el decano antes de crear tu acceso.
              </p>

              <div className="login-field-1 space-y-1.5">
                <Label htmlFor="ra-name" className="text-white/80 uppercase tracking-wide text-xs">Nombre completo</Label>
                <Input id="ra-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="h-11 bg-white/90 text-brand-900" placeholder="María Fernanda García" />
              </div>

              <div className="login-field-2 space-y-1.5">
                <Label htmlFor="ra-code" className="text-white/80 uppercase tracking-wide text-xs">Carné o código</Label>
                <Input id="ra-code" value={studentCode} onChange={(e) => setStudentCode(e.target.value.toUpperCase())} required maxLength={9} className="h-11 bg-white/90 text-brand-900" placeholder="U20240001" />
              </div>

              <div className="login-feature-1 space-y-1.5">
                <Label htmlFor="ra-role" className="text-white/80 uppercase tracking-wide text-xs">Rol solicitado</Label>
                <select id="ra-role" value={requestedRole} onChange={(e) => setRequestedRole(e.target.value)} className="w-full h-11 rounded-md border border-white/20 bg-white/90 px-3 text-sm text-brand-900">
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              {requestedRole === 'STUDENT' && (
                <div className="login-feature-2 space-y-1.5">
                  <Label htmlFor="ra-career" className="text-white/80 uppercase tracking-wide text-xs">Carrera</Label>
                  <select id="ra-career" value={career} onChange={(e) => setCareer(e.target.value)} className="w-full h-11 rounded-md border border-white/20 bg-white/90 px-3 text-sm text-brand-900">
                    {CAREERS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              <div className="login-feature-3 space-y-1.5">
                <Label htmlFor="ra-reason" className="text-white/80 uppercase tracking-wide text-xs">Motivo (opcional)</Label>
                <Textarea id="ra-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="bg-white/90 text-brand-900" placeholder="Ej. Soy estudiante de nuevo ingreso a prácticas." />
              </div>

              <Button type="submit" disabled={isSubmitting} className="login-btn w-full h-11 bg-gradient-to-r from-brand-600 via-brand-700 to-brand-800 hover:from-brand-500 text-white font-semibold border border-gold-400/20">
                {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando…</> : <><UserPlus className="w-4 h-4 mr-2" />Enviar solicitud</>}
              </Button>

              <Link to="/" className="login-btn inline-flex items-center gap-2 text-xs font-medium text-gold-400/80 hover:text-gold-300">
                <ArrowLeft className="w-4 h-4" /> Volver a iniciar sesión
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
