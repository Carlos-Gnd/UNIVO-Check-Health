import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Bell, Building2, Camera, GraduationCap, Image as ImageIcon, Info, KeyRound, Loader2, Mail, MonitorSmartphone, Phone, RefreshCw, Save, ShieldQuestion, Stethoscope, UserCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/shared/backend/supabaseClient';
import { getStudentHoursProgress } from '@/shared/backend/checkHealthBackend';
import { fetchCareers } from '@/modules/dean/services/catalog.service';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { isAcceptablePassword, passwordStrength } from '@/shared/utils/passwordStrength';
import { getLocalSessionId } from '@/shared/utils/singleSession';
import { PageHeader } from '@/shared/components/PageHeader';

const STRENGTH_STYLE: Record<string, { bar: string; text: string; fill: number }> = {
  'débil': { bar: 'bg-red-500', text: 'text-red-600', fill: 1 },
  'media': { bar: 'bg-amber-500', text: 'text-amber-600', fill: 3 },
  'fuerte': { bar: 'bg-green-600', text: 'text-green-700', fill: 5 },
};

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
  photo_url: string | null;
  notif_push: boolean;
  notif_email: boolean;
  career: string | null;
  academic_level: number | null;
}

type ActiveSession = {
  session_id: string;
  device_label: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  is_current: boolean;
};

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  // B18: información académica del alumno (carrera, ciclo, progreso de horas).
  const [totalCycles, setTotalCycles] = useState<number | null>(null);
  const [hours, setHours] = useState<{ completedHours: number; requiredHours: number } | null>(null);
  // Cambio de contraseña (requiere la contraseña actual).
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isRevokingSession, setIsRevokingSession] = useState<string | null>(null);

  const loadSessions = async () => {
    setIsLoadingSessions(true);
    const { data, error } = await supabase.rpc('list_my_active_sessions');
    setIsLoadingSessions(false);
    if (error) {
      toast.error('No se pudieron cargar tus sesiones.');
      return;
    }
    const currentSessionId = getLocalSessionId();
    setSessions(((data ?? []) as ActiveSession[]).map((session) => ({
      ...session,
      is_current: session.session_id === currentSessionId || session.is_current,
    })));
  };

  const revokeSession = async (sessionId: string) => {
    setIsRevokingSession(sessionId);
    const { error } = await supabase.rpc('revoke_my_session', { p_session_id: sessionId });
    setIsRevokingSession(null);
    if (error) {
      toast.error('No se pudo cerrar la sesion.');
      return;
    }
    toast.success('Sesion cerrada.');
    if (sessionId === getLocalSessionId()) {
      await supabase.auth.signOut();
      return;
    }
    void loadSessions();
  };

  const revokeOtherSessions = async () => {
    const currentSessionId = getLocalSessionId();
    if (!currentSessionId) return;
    setIsRevokingSession('__others__');
    const { error } = await supabase.rpc('revoke_my_other_sessions', { p_current_session_id: currentSessionId });
    setIsRevokingSession(null);
    if (error) {
      toast.error('No se pudieron cerrar las otras sesiones.');
      return;
    }
    toast.success('Otras sesiones cerradas.');
    void loadSessions();
  };

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
        .select('role, full_name, email, phone, backup_email, security_question, photo_url, notif_push, notif_email, career, academic_level')
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
      setAvatarUrl(loadedProfile.photo_url ?? null);
      setNotifPush(loadedProfile.notif_push);
      setNotifEmail(loadedProfile.notif_email);

      // B18: para estudiantes, carga ciclos de la carrera y progreso de horas.
      if (loadedProfile.role === 'STUDENT') {
        void getStudentHoursProgress(authData.user.id).then(setHours).catch(() => undefined);
        if (loadedProfile.career) {
          void fetchCareers().then((list) => {
            setTotalCycles(list.find((c) => c.name === loadedProfile.career)?.totalCycles ?? null);
          }).catch(() => undefined);
        }
      }
    };

    void loadProfile();
    void loadSessions();
  }, []);

  // T-53.3: sube la foto al bucket avatars ({user_id}/avatar.<ext>, upsert) y
  // persiste la URL pública en users.photo_url.
  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // permite re-seleccionar el mismo archivo
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('La foto debe ser una imagen.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no puede superar 2 MB.');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        toast.error('Sesión no encontrada.');
        return;
      }

      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${authData.user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, cacheControl: '3600' });
      if (uploadError) {
        toast.error('No se pudo subir la foto.');
        return;
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      // Cache-busting para que el navegador no muestre la versión anterior.
      const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('users')
        .update({ photo_url: publicUrl })
        .eq('id', authData.user.id);
      if (updateError) {
        toast.error('La foto se subió pero no se pudo guardar en el perfil.');
        return;
      }

      setAvatarUrl(publicUrl);
      toast.success('Foto de perfil actualizada.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

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

  // Cambio de contraseña: verifica la actual reautenticando antes de actualizar.
  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;

    if (!isAcceptablePassword(newPassword)) {
      toast.error('La nueva contraseña es muy débil: usa al menos 8 caracteres combinando mayúsculas, números o símbolos.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas nuevas no coinciden.');
      return;
    }
    if (newPassword === currentPassword) {
      toast.error('La nueva contraseña debe ser distinta de la actual.');
      return;
    }

    setIsChangingPassword(true);
    try {
      // Reautenticar con la contraseña actual para verificar identidad.
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });
      if (verifyError) {
        toast.error('La contraseña actual es incorrecta.');
        return;
      }

      const { error: updError } = await supabase.auth.updateUser({ password: newPassword });
      if (updError) {
        toast.error(updError.message || 'No se pudo cambiar la contraseña.');
        return;
      }

      toast.success('Contraseña actualizada correctamente.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setIsChangingPassword(false);
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
      <PageHeader title="Mi perfil" description="Gestiona tus datos personales, contacto y seguridad de la cuenta." />

      <form onSubmit={handleSave} className="max-w-3xl rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-4 border-b border-gray-100 pb-5">
          <div className="relative shrink-0">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-100">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
              ) : (
                <UserCircle className="h-9 w-9" />
              )}
            </div>
            {isUploadingPhoto && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">{profile.full_name ?? profile.email}</h2>
            <p className="text-sm text-gray-500">{profile.email}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-brand-700">{profile.role}</p>
            {/* Cámara (capture en móvil) o galería (selector de archivos). */}
            <div className="mt-2 flex gap-2">
              <label className={`inline-flex cursor-pointer items-center gap-1 rounded-md border border-brand-200 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 ${isUploadingPhoto ? 'pointer-events-none opacity-50' : ''}`}>
                <Camera className="h-3.5 w-3.5" /> Cámara
                <input type="file" accept="image/*" capture="environment" className="hidden" disabled={isUploadingPhoto} onChange={handlePhotoChange} />
              </label>
              <label className={`inline-flex cursor-pointer items-center gap-1 rounded-md border border-brand-200 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 ${isUploadingPhoto ? 'pointer-events-none opacity-50' : ''}`}>
                <ImageIcon className="h-3.5 w-3.5" /> Galería
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={isUploadingPhoto} onChange={handlePhotoChange} />
              </label>
            </div>
            <p className="mt-1 text-xs text-slate-400">JPG, PNG o WebP · máx 2 MB</p>
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
                    No distingue mayúsculas/minúsculas ni espacios al inicio o final.
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
          <div className="mt-5 rounded-lg border border-brand-100 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-900">
              <GraduationCap className="h-4 w-4" />
              Información académica
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-md border bg-brand-50/50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-gray-400">Carrera</p>
                <p className="text-sm font-medium text-brand-900">{profile.career ?? 'No definida'}</p>
              </div>
              <div className="rounded-md border bg-brand-50/50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-gray-400">Ciclo actual</p>
                <p className="text-sm font-medium text-brand-900">
                  {profile.academic_level != null ? `Ciclo ${profile.academic_level}${totalCycles ? ` de ${totalCycles}` : ''}` : 'No definido'}
                </p>
              </div>
              <div className="rounded-md border bg-brand-50/50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-gray-400">Progreso de carrera</p>
                <p className="text-sm font-medium text-brand-900">
                  {profile.academic_level != null && totalCycles ? `${Math.round((profile.academic_level / totalCycles) * 100)}%` : '—'}
                </p>
              </div>
            </div>
            {hours && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Horas de práctica acumuladas</span>
                  <span className="font-medium text-brand-800">{hours.completedHours} / {hours.requiredHours} h</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${(hours.completedHours / hours.requiredHours) >= 0.85 ? 'bg-green-500' : (hours.completedHours / hours.requiredHours) >= 0.6 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, Math.round((hours.completedHours / Math.max(1, hours.requiredHours)) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

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

      <section className="max-w-3xl rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-900">
              <MonitorSmartphone className="h-4 w-4" />
              Sesiones y dispositivos activos
            </div>
            <p className="mt-1 text-xs text-slate-500">Revisa donde esta abierta tu cuenta y cierra accesos que no reconozcas.</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void loadSessions()} disabled={isLoadingSessions}>
              {isLoadingSessions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Actualizar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void revokeOtherSessions()}
              disabled={isRevokingSession === '__others__' || sessions.filter((session) => !session.is_current).length === 0}
            >
              {isRevokingSession === '__others__' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
              Cerrar otras
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {sessions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 py-6 text-center text-sm text-gray-400">Sin sesiones activas para mostrar.</p>
          ) : (
            sessions.map((session) => (
              <div key={session.session_id} className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{session.device_label ?? 'Navegador'}</p>
                    {session.is_current && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">Actual</span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-gray-500">{session.user_agent ?? 'Agente no disponible'}</p>
                  <p className="mt-1 text-xs text-gray-400">Ultima actividad: {formatSessionDate(session.last_seen_at)}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void revokeSession(session.session_id)}
                  disabled={isRevokingSession === session.session_id}
                  className={session.is_current ? 'border-red-200 text-red-700 hover:bg-red-50' : ''}
                >
                  {isRevokingSession === session.session_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                  {session.is_current ? 'Cerrar esta sesion' : 'Cerrar'}
                </Button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Cambio de contraseña (form aparte: requiere la contraseña actual). */}
      <form onSubmit={handleChangePassword} className="max-w-3xl rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-brand-900">
          <KeyRound className="h-4 w-4" />
          Cambiar contraseña
        </div>
        <p className="mt-1 text-xs text-slate-500">Ingresa tu contraseña actual y define una nueva.</p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="current-password" className="text-xs uppercase tracking-wide text-brand-700">Contraseña actual</Label>
            <Input
              id="current-password"
              type={showPasswords ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-xs uppercase tracking-wide text-brand-700">Nueva contraseña</Label>
            <Input
              id="new-password"
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-new-password" className="text-xs uppercase tracking-wide text-brand-700">Repetir nueva</Label>
            <Input
              id="confirm-new-password"
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        {newPassword.length > 0 && (() => {
          const strength = passwordStrength(newPassword);
          const style = STRENGTH_STYLE[strength.level];
          const matches = confirmPassword.length > 0 && newPassword === confirmPassword;
          return (
            <div className="mt-3 space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((seg) => (
                  <div key={seg} className={`h-1.5 flex-1 rounded-full ${seg <= style.fill ? style.bar : 'bg-gray-200'}`} />
                ))}
              </div>
              <p className={`text-xs font-medium ${style.text}`}>Seguridad: {strength.level}</p>
              {confirmPassword.length > 0 && (
                <p className={`text-xs ${matches ? 'text-green-700' : 'text-red-600'}`}>
                  {matches ? 'Las contraseñas coinciden.' : 'Las contraseñas no coinciden.'}
                </p>
              )}
            </div>
          );
        })()}

        <div className="mt-4 flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" checked={showPasswords} onChange={(e) => setShowPasswords(e.target.checked)} />
            Mostrar contraseñas
          </label>
          <Button
            type="submit"
            disabled={isChangingPassword || !isAcceptablePassword(newPassword) || newPassword !== confirmPassword || !currentPassword}
            className="bg-brand-800 text-white hover:bg-brand-900"
          >
            {isChangingPassword ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cambiando...</> : <><KeyRound className="mr-2 h-4 w-4" />Cambiar contraseña</>}
          </Button>
        </div>
      </form>
    </div>
  );
}

function formatSessionDate(value: string): string {
  return new Intl.DateTimeFormat('es-SV', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}
