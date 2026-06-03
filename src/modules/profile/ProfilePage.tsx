import { useEffect, useState, type FormEvent } from 'react';
import { Bell, Building2, Loader2, Phone, Save, Stethoscope, UserCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/shared/backend/supabaseClient';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';

type ProfileRole = 'STUDENT' | 'DOCENTE' | 'COORDINATOR' | 'ADMIN' | string;

interface UserProfile {
  role: ProfileRole;
  full_name: string | null;
  email: string;
  phone: string | null;
  notif_push: boolean;
  notif_email: boolean;
}

function normalizeRole(role: string | null | undefined): ProfileRole {
  const normalized = (role ?? '').toUpperCase().trim();
  if (normalized === 'TEACHER') return 'DOCENTE';
  if (normalized === 'COORDINADOR') return 'COORDINATOR';
  return normalized || 'STUDENT';
}

export function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [phone, setPhone] = useState('');
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
        .select('role, full_name, email, phone, notif_push, notif_email')
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
      setNotifPush(loadedProfile.notif_push);
      setNotifEmail(loadedProfile.notif_email);
    };

    void loadProfile();
  }, []);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);

    // TODO: descomentar cuando Carlos suba la migracion con las columnas del perfil dinamico.
    // const { data: authData } = await supabase.auth.getUser();
    // if (authData.user) {
    //   await supabase
    //     .from('users')
    //     .update({
    //       phone,
    //       notif_push: notifPush,
    //       notif_email: notifEmail,
    //       specialty,
    //       campus,
    //     })
    //     .eq('id', authData.user.id);
    // }

    setIsSaving(false);
    toast.info('Guardado pendiente de la migracion de perfil');
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
        <p className="mt-1 text-sm text-gray-500">Gestiona tus datos personales y preferencias de contacto.</p>
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
