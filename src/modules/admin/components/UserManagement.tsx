import { useState, useEffect, type FormEvent } from 'react';
import { BookOpen, Copy, IdCard, KeyRound, Loader2, Pencil, Puzzle, RefreshCw, ShieldCheck, Trash2, User, UserPlus } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { Switch } from '@/shared/components/ui/switch';
import { Badge } from '@/shared/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { toast } from 'sonner';
import { supabase } from '@/shared/backend/supabaseClient';
import { toggleUserActive } from '@/modules/dean/services/dean.service';

// B-01: las operaciones privilegiadas viven en la Edge Function admin-users.
// El cliente nunca maneja la service_role key.
type AdminAction = 'create' | 'update' | 'delete' | 'reset-password';
async function invokeAdmin<T = Record<string, unknown>>(
  action: AdminAction,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; message?: string; data?: T }> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action, ...payload },
  });
  if (error || !data?.ok) {
    return { ok: false, message: data?.error ?? error?.message ?? 'Error en la operación.' };
  }
  return { ok: true, data: data as T };
}

const UNIVO_DOMAIN = '@univo.edu.sv';
const CAREERS = ['Enfermería', 'Medicina', 'Fisioterapia', 'Radiología', 'Laboratorio Clínico', 'Nutrición'];
const ROLES = [
  { value: 'STUDENT',      label: 'Estudiante' },
  { value: 'DOCENTE',      label: 'Docente' },
  { value: 'COORDINATOR',  label: 'Coordinador' },
  { value: 'ADMIN',        label: 'Administrador / Decano' },
];

interface UserRow {
  id: string;
  student_code: string;
  full_name: string | null;
  email: string;
  role: string;
  career: string | null;
  is_active: boolean;
}

// Muestra email + contraseña tras crear el usuario
type CreatedCredentials = { email: string; password: string } | null;

export function UserManagement() {
  const [fullName, setFullName]           = useState('');
  const [studentCode, setStudentCode]     = useState('');
  const [career, setCareer]               = useState(CAREERS[0]);
  const [role, setRole]                   = useState('STUDENT');
  const [password, setPassword]           = useState('');
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [users, setUsers]                 = useState<UserRow[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [createOpen, setCreateOpen]       = useState(false);
  const [createdCreds, setCreatedCreds]   = useState<CreatedCredentials>(null);

  const [editingUser, setEditingUser]     = useState<UserRow | null>(null);
  const [editName, setEditName]           = useState('');
  const [editRole, setEditRole]           = useState('STUDENT');
  const [editCareer, setEditCareer]       = useState(CAREERS[0]);
  const [isSavingEdit, setIsSavingEdit]   = useState(false);

  const [deleteTarget, setDeleteTarget]   = useState<UserRow | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const [togglingId, setTogglingId]       = useState<string | null>(null);
  const [resetingId, setResetingId]       = useState<string | null>(null);

  const derivedEmail = studentCode ? `${studentCode.toUpperCase()}${UNIVO_DOMAIN}` : '';

  const resetCreateForm = () => {
    setFullName(''); setStudentCode(''); setCareer(CAREERS[0]);
    setRole('STUDENT'); setPassword('');
  };

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    const { data, error } = await supabase
      .from('users')
      .select('id, student_code, full_name, email, role, career, is_active')
      .order('created_at', { ascending: false });
    setIsLoadingUsers(false);
    if (error) { toast.error('Error al cargar usuarios'); return; }
    setUsers((data as UserRow[]) ?? []);
  };

  useEffect(() => { void loadUsers(); }, []);

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code  = studentCode.trim().toUpperCase();
    const email = `${code}${UNIVO_DOMAIN}`;

    if (role === 'STUDENT' && !/^U\d{8}$/.test(code)) {
      toast.error('Carné de estudiante: U + 8 dígitos (ej. U20240001)');
      return;
    }
    if (code.length < 4) { toast.error('El código debe tener al menos 4 caracteres'); return; }
    if (password.length < 8) { toast.error('La contraseña debe tener al menos 8 caracteres'); return; }

    setIsSubmitting(true);
    const result = await invokeAdmin('create', {
      email,
      password,
      student_code: code,
      full_name: fullName.trim(),
      role,
      career: role === 'STUDENT' ? career : null,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      toast.error(result.message ?? 'Error al crear usuario');
      return;
    }

    setCreatedCreds({ email, password });
    resetCreateForm();
    setCreateOpen(false);
    void loadUsers();
  };

  const openEdit = (user: UserRow) => {
    setEditingUser(user);
    setEditName(user.full_name ?? '');
    setEditRole(user.role);
    setEditCareer(user.career ?? CAREERS[0]);
  };

  const handleEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSavingEdit(true);
    const result = await invokeAdmin('update', {
      id: editingUser.id,
      full_name: editName.trim(),
      role: editRole,
      career: editRole === 'STUDENT' ? editCareer : null,
    });
    setIsSavingEdit(false);
    if (!result.ok) { toast.error(result.message ?? 'Error al actualizar'); return; }
    toast.success('Usuario actualizado');
    setEditingUser(null);
    void loadUsers();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeletingUserId(deleteTarget.id);
    const result = await invokeAdmin('delete', { id: deleteTarget.id });
    setDeletingUserId(null);
    if (!result.ok) { toast.error(result.message ?? 'Error al eliminar'); return; }
    toast.success('Usuario eliminado');
    setDeleteTarget(null);
    void loadUsers();
  };

  const handleToggleActive = async (user: UserRow) => {
    setTogglingId(user.id);
    const result = await toggleUserActive(user.id, !user.is_active);
    setTogglingId(null);
    if (!result.ok) { toast.error(result.message ?? 'Error al cambiar estado'); return; }
    toast.success(user.is_active ? `${user.full_name ?? user.email} desactivado` : `${user.full_name ?? user.email} activado`);
    void loadUsers();
  };

  const handleResetPassword = async (user: UserRow) => {
    setResetingId(user.id);
    const result = await invokeAdmin<{ action_link: string }>('reset-password', { email: user.email });
    setResetingId(null);
    if (!result.ok || !result.data?.action_link) {
      toast.error(result.message ?? 'No se pudo generar el link de restablecimiento');
      return;
    }
    await navigator.clipboard.writeText(result.data.action_link).catch(() => undefined);
    toast.success('Link de restablecimiento copiado al portapapeles');
  };

  const roleBadge  = (r: string) => r === 'ADMIN' ? 'bg-purple-100 text-purple-700' : r === 'COORDINATOR' ? 'bg-brand-100 text-brand-700' : 'bg-green-100 text-green-700';
  const roleLabel  = (r: string) => ROLES.find((x) => x.value === r)?.label ?? r;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Gestión de Usuarios</h1>
          <p className="mt-1 text-sm text-gray-500">Administra cuentas institucionales, roles y estado de acceso.</p>
        </div>
        <Button className="bg-brand-700 hover:bg-brand-800 text-white" onClick={() => setCreateOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />Nuevo usuario
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Usuarios registrados</h2>
          <Button variant="outline" size="sm" onClick={loadUsers} disabled={isLoadingUsers}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />Actualizar
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Carné</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Correo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Carrera</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Rol</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Activo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoadingUsers ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">Sin usuarios registrados</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className={`hover:bg-brand-50 transition-colors ${!u.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">{u.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{u.student_code}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{u.email}</td>
                    <td className="px-4 py-3 text-gray-600">{u.career ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge(u.role)}`}>
                        {roleLabel(u.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {togglingId === u.id ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto text-gray-400" />
                      ) : (
                        <Switch
                          checked={u.is_active}
                          onCheckedChange={() => void handleToggleActive(u)}
                          aria-label={u.is_active ? 'Desactivar usuario' : 'Activar usuario'}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          title="Generar link de restablecimiento de contraseña"
                          disabled={resetingId === u.id}
                          onClick={() => void handleResetPassword(u)}
                        >
                          {resetingId === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-700 border-red-200 hover:bg-red-50"
                          onClick={() => setDeleteTarget(u)}
                          disabled={deletingUserId === u.id}
                        >
                          {deletingUserId === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal crear usuario */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-brand-700" />Nuevo usuario</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="create-fullName" className="text-xs uppercase tracking-wide text-brand-700"><User className="h-3.5 w-3.5" />Nombre completo</Label>
              <Input id="create-fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="María Fernanda García" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-studentCode" className="text-xs uppercase tracking-wide text-brand-700"><IdCard className="h-3.5 w-3.5" />Carné / Código</Label>
              <Input
                id="create-studentCode"
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                placeholder="U20240001"
                maxLength={role === 'STUDENT' ? 9 : 20}
                required
              />
              {derivedEmail && (
                <p className="text-xs text-slate-500">
                  Correo de acceso: <span className="text-brand-800 font-medium select-all">{derivedEmail}</span>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-role" className="text-xs uppercase tracking-wide text-brand-700"><Puzzle className="h-3.5 w-3.5" />Rol</Label>
              <select id="create-role" value={role} onChange={(e) => setRole(e.target.value)} className="w-full h-10 rounded-md border border-brand-100 bg-white px-3 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-700/25 focus:border-brand-700">
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {role === 'STUDENT' && (
              <div className="space-y-1.5">
                <Label htmlFor="create-career" className="text-xs uppercase tracking-wide text-brand-700"><BookOpen className="h-3.5 w-3.5" />Carrera</Label>
                <select id="create-career" value={career} onChange={(e) => setCareer(e.target.value)} className="w-full h-10 rounded-md border border-brand-100 bg-white px-3 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-700/25 focus:border-brand-700">
                  {CAREERS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="create-password" className="text-xs uppercase tracking-wide text-brand-700"><ShieldCheck className="h-3.5 w-3.5" />Contraseña temporal</Label>
              <Input id="create-password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" minLength={8} required />
              <p className="text-xs text-slate-500">Se muestra en texto para que puedas copiarla.</p>
            </div>
            <div className="sm:col-span-2 flex justify-end pt-2">
              <Button type="submit" disabled={isSubmitting} className="bg-brand-800 hover:bg-brand-900 text-white shadow-sm shadow-brand-900/15">
                {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creando...</> : <><UserPlus className="w-4 h-4 mr-2" />Crear usuario</>}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal credenciales creadas */}
      <Dialog open={Boolean(createdCreds)} onOpenChange={() => setCreatedCreds(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-brand-700" />Usuario creado exitosamente</DialogTitle></DialogHeader>
          {createdCreds && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Comparte estas credenciales con el usuario. Puede cambiar la contraseña desde su perfil.
              </p>
              <div className="space-y-3 rounded-lg bg-brand-50 p-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Correo de acceso</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono text-gray-900 select-all">{createdCreds.email}</code>
                    <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(createdCreds.email); toast.success('Correo copiado'); }}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Contraseña temporal</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono text-gray-900 select-all">{createdCreds.password}</code>
                    <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(createdCreds.password); toast.success('Contraseña copiada'); }}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
              <Badge className="bg-amber-100 text-amber-700 text-xs">
                El panel del alumno empieza en /rotations al iniciar sesión
              </Badge>
              <div className="flex justify-end">
                <Button onClick={() => setCreatedCreds(null)} className="bg-brand-700 hover:bg-brand-800 text-white">Entendido</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal editar */}
      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => { if (!open) setEditingUser(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5 text-brand-700" />Editar usuario</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name" className="text-xs uppercase tracking-wide text-brand-700"><User className="h-3.5 w-3.5" />Nombre completo</Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-role" className="text-xs uppercase tracking-wide text-brand-700"><Puzzle className="h-3.5 w-3.5" />Rol</Label>
              <select id="edit-role" value={editRole} onChange={(e) => setEditRole(e.target.value)} className="w-full h-10 rounded-md border border-brand-100 bg-white px-3 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-700/25 focus:border-brand-700">
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {editRole === 'STUDENT' && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-career" className="text-xs uppercase tracking-wide text-brand-700"><BookOpen className="h-3.5 w-3.5" />Carrera</Label>
                <select id="edit-career" value={editCareer} onChange={(e) => setEditCareer(e.target.value)} className="w-full h-10 rounded-md border border-brand-100 bg-white px-3 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-700/25 focus:border-brand-700">
                  {CAREERS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isSavingEdit} className="bg-brand-800 hover:bg-brand-900 text-white shadow-sm shadow-brand-900/15">
                {isSavingEdit ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</> : 'Guardar cambios'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmación de eliminación */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-red-600" />Eliminar usuario</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar <strong>{deleteTarget?.email}</strong>? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingUserId)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()} disabled={Boolean(deletingUserId)} className="bg-red-600 hover:bg-red-700 text-white">
              {deletingUserId ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
