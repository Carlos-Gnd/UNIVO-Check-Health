import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Bell, Building2, Info, Loader2, Mail, Phone, Save, ShieldQuestion, Stethoscope, UserCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/shared/backend/supabaseClient';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';

type ProfileRole = 'STUDENT' | 'DOCENTE' | 'COORDINATOR' | 'ADMIN' | string;

// Preguntas de seguridad predefinidas (consistencia y menos errores que texto libre).
const SECURITY_QUESTIONS = [
  '¿Cuál es el nombre de tu primera mascota?',
  '¿En qué ciudad naciste?',
  '¿Cuál es el nombre de tu mejor amigo/a de la infancia?',
  '¿Cuál es tu comida favorita?',
  '¿Cuál es el nombre de tu escuela primaria?',
];

interface UserProfile {
  role: ProfileRole;
  full_name: string | null;
  email: string;
  phone: string | null;
  backup_email: string | null;
  security_question: string | null;
  notif_push: boolean;
  notif_email: boolean;
}

function normalizeRole(role: string | null | undefined): ProfileRole {
  const normalized = (role ?? '').toUpperCase().trim();
  if (normalized === 'TEACHER') return 'DOCENTE';
  if (normalized === 'COORDINADOR') return 'COORDINATOR';
  return normalized || 'STUDENT';
}

// Tooltip de ayuda contextual reutilizable (ícono de información como disparador).
function HelpTooltip({ children }: { children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" tabIndex={-1} aria-label="Más información" className="text-brand-400 hover:text-brand-700">
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-balance">{children}</TooltipContent>
    </Tooltip>
  );
}

export function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [phone, setPhone] = useState('');
  const [backupEmail, setBackupEmail] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [hasSecurityConfigured, setHasSecurityConfigured] = useState(false);
  const [notifPush, setNotifPush] = useState(true);
  const [notifEmail, setNotifEmail] = useState(true);
  const [specialty, setSpecialty] = useState('');
  const [campus, setCampus] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        toast.error('No se pudo leer la sesion');
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('role, full_name, email, phone, backup_email, security_question, notif_push, notif_email')
        .eq('id', authData.user.id)
        .single();

      setIsLoading(false);
      if (error) {
        toast.error('No se pudo cargar el perfil');
        return;
      }

      const loadedProfile = {
        ...(data as UserProfile),
        role: normalizeRole(data?.role),
      };
      setProfile(loadedProfile);
      setPhone(loadedProfile.phone ?? '');
      setBackupEmail(loadedProfile.backup_email ?? '');
      setSecurityQuestion(loadedProfile.security_question ?? '');
      setHasSecurityConfigured(Boolean(loadedProfile.security_question));
      setNotifPush(loadedProfile.notif_push);
      setNotifEmail(loadedProfile.notif_email);
    };

    void loadProfile();
  }, []);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedBackup = backupEmail.trim().toLowerCase();
    if (trimmedBackup && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedBackup)) {
      toast.error('El correo de respaldo no tiene un formato válido.');
      return;
    }

    const answer = securityAnswer.trim();
    if (answer && answer.length < 2) {
      toast.error('La respuesta de seguridad es demasiado corta.');
      return;
    }
    if (answer && !securityQuestion) {
      toast.error('Selecciona una pregunta de seguridad para tu respuesta.');
      return;
    }

    setIsSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        toast.error('Sesión no encontrada.');
        return;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({
          phone: phone.trim() || null,
          backup_email: trimmedBackup || null,
          notif_push: notifPush,
          notif_email: notifEmail,
        })
        .eq('id', authData.user.id);

      if (updateError) {
        toast.error('No se pudieron guardar los datos del perfil.');
        return;
      }

      // La respuesta se hashea server-side (bcrypt) vía RPC; solo se envía si el
      // usuario escribió una respuesta nueva.
      if (answer && securityQuestion) {
        const { error: rpcError } = await supabase.rpc('set_security_question', {
          p_question: securityQuestion,
          p_answer: answer,
        });
        if (rpcError) {
          toast.error('Perfil guardado, pero la pregunta de seguridad no pudo actualizarse.');
          return;
        }
        setHasSecurityConfigured(true);
        setSecurityAnswer('');
      }

      toast.success('Perfil actualizado correctamente.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-700" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
        No se encontro informacion de perfil.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Mi perfil</h1>
        <p className="mt-1 text-sm text-gray-500">Gestiona tus datos personales, contacto y seguridad de la cuenta.</p>
      </div>

      <form onSubmit={handleSave} className="max-w-3xl rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3 border-b border-gray-100 pb-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <UserCircle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">{profile.full_name ?? profile.email}</h2>
            <p className="text-sm text-gray-500">{profile.email}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-brand-700">{profile.role}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="profile-phone" className="flex items-center gap-1 text-xs uppercase tracking-wide text-brand-700">
              <Phone className="h-3.5 w-3.5" />
              Telefono
            </Label>
            <Input id="profile-phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="7000-0000" />
          </div>

          {profile.role === 'DOCENTE' && (
            <div className="space-y-2">
              <Label htmlFor="profile-specialty" className="flex items-center gap-1 text-xs uppercase tracking-wide text-brand-700">
                <Stethoscope className="h-3.5 w-3.5" />
                Especialidad
              </Label>
              <Input id="profile-specialty" value={specialty} onChange={(event) => setSpecialty(event.target.value)} placeholder="Area o especialidad" />
            </div>
          )}

          {profile.role === 'COORDINATOR' && (
            <div className="space-y-2">
              <Label htmlFor="profile-campus" className="flex items-center gap-1 text-xs uppercase tracking-wide text-brand-700">
                <Building2 className="h-3.5 w-3.5" />
                Campus
              </Label>
              <Input id="profile-campus" value={campus} onChange={(event) => setCampus(event.target.value)} placeholder="Campus asignado" />
            </div>
          )}
        </div>

        {/* Seguridad de la cuenta: correo de respaldo + pregunta de seguridad.
            Ambos son necesarios para el flujo de recuperación de acceso (HU-51). */}
        <div className="mt-5 rounded-lg border border-brand-100 bg-brand-50/40 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-900">
            <ShieldQuestion className="h-4 w-4" />
            Seguridad y recuperación de acceso
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Configura estos datos para poder recuperar tu cuenta si olvidas tu contraseña.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="profile-backup-email" className="flex items-center gap-1 text-xs uppercase tracking-wide text-brand-700">
                <Mail className="h-3.5 w-3.5" />
                Correo de respaldo
                <HelpTooltip>
                  Correo personal (no institucional) donde recibirás el código de verificación si necesitas
                  recuperar tu acceso. Solo se usa para recuperación y avisos de respaldo.
                </HelpTooltip>
              </Label>
              <Input
                id="profile-backup-email"
                type="email"
                value={backupEmail}
                onChange={(event) => setBackupEmail(event.target.value)}
                placeholder="tucorreo@gmail.com"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-security-question" className="flex items-center gap-1 text-xs uppercase tracking-wide text-brand-700">
                  Pregunta de seguridad
                </Label>
                <select
                  id="profile-security-question"
                  value={securityQuestion}
                  onChange={(event) => setSecurityQuestion(event.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                >
                  <option value="">Selecciona una pregunta…</option>
                  {SECURITY_QUESTIONS.map((question) => (
                    <option key={question} value={question}>{question}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-security-answer" className="flex items-center gap-1 text-xs uppercase tracking-wide text-brand-700">
                  Respuesta de seguridad
                  <HelpTooltip>
                    No distingue mayúsculas/minúsculas ni espacios al inicio/final. Tu respuesta se guarda
                    cifrada (bcrypt); el sistema nunca la almacena en texto plano.
                  </HelpTooltip>
                </Label>
                <Input
                  id="profile-security-answer"
                  value={securityAnswer}
                  onChange={(event) => setSecurityAnswer(event.target.value)}
                  placeholder={hasSecurityConfigured ? '•••••• (configurada — escribe para cambiarla)' : 'Escribe tu respuesta'}
                  autoComplete="off"
                />
              </div>
            </div>
            <p className="text-xs text-slate-400">
              {hasSecurityConfigured
                ? 'Ya tienes una pregunta de seguridad configurada. Deja la respuesta en blanco para mantenerla.'
                : 'Aún no has configurado una pregunta de seguridad.'}
            </p>
          </div>
        </div>

        {profile.role === 'STUDENT' && (
          <div className="mt-5 rounded-lg border border-brand-100 bg-brand-50/60 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-900">
              <Bell className="h-4 w-4" />
              Preferencias de notificacion
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-md border border-white bg-white px-3 py-2 text-sm text-gray-700 shadow-sm">
                Notificaciones push
                <Switch checked={notifPush} onCheckedChange={setNotifPush} />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-md border border-white bg-white px-3 py-2 text-sm text-gray-700 shadow-sm">
                Notificaciones por correo
                <Switch checked={notifEmail} onCheckedChange={setNotifEmail} />
              </label>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button type="submit" disabled={isSaving} className="bg-brand-800 text-white hover:bg-brand-900">
            {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : <><Save className="mr-2 h-4 w-4" />Guardar cambios</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
