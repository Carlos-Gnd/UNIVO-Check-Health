import { useState, useEffect, type FormEvent } from 'react';
import { UserPlus, Loader2, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
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
import { supabaseAdmin } from '@/shared/backend/supabaseAdmin';
import { supabase } from '@/shared/backend/supabaseClient';

const UNIVO_DOMAIN = '@univo.edu.sv';
const CAREERS = ['Enfermería', 'Medicina', 'Fisioterapia', 'Radiología', 'Laboratorio Clínico', 'Nutrición'];
const ROLES = [
  { value: 'STUDENT', label: 'Estudiante' },
  { value: 'COORDINATOR', label: 'Coordinador' },
  { value: 'ADMIN', label: 'Administrador / Decano' },
];

interface UserRow {
  id: string;
  student_code: string;
  full_name: string | null;
  email: string;
  role: string;
  career: string | null;
}

export function UserManagement() {
  const [fullName, setFullName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [career, setCareer] = useState(CAREERS[0]);
  const [role, setRole] = useState('STUDENT');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('STUDENT');
  const [editCareer, setEditCareer] = useState(CAREERS[0]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  const derivedEmail = studentCode ? `${studentCode.toUpperCase()}${UNIVO_DOMAIN}` : '';

  const resetCreateForm = () => {
    setFullName('');
    setStudentCode('');
    setCareer(CAREERS[0]);
    setRole('STUDENT');
    setPassword('');
  };

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    const { data, error } = await supabase
      .from('users')
      .select('id, student_code, full_name, email, role, career')
      .order('created_at', { ascending: false });
    setIsLoadingUsers(false);
    if (error) {
      toast.error('Error al cargar usuarios');
      return;
    }
    setUsers((data as UserRow[]) ?? []);
  };

  useEffect(() => { void loadUsers(); }, []);

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = studentCode.trim().toUpperCase();
    const email = `${code}${UNIVO_DOMAIN}`;

    if (role === 'STUDENT' && !/^U\d{8}$/.test(code)) {
      toast.error('El carné de estudiante debe tener formato U + 8 dígitos (ej. U20240001)');
      return;
    }
    if (code.length < 4) {
      toast.error('El código debe tener al menos 4 caracteres');
      return;
    }
    if (password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setIsSubmitting(true);
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
    if (authError) {
      toast.error(`Error al crear usuario: ${authError.message}`);
      setIsSubmitting(false);
      return;
    }

    const { error: profileError } = await supabaseAdmin.from('users').insert({
      id: authData.user.id,
      student_code: code,
      full_name: fullName.trim(),
      email,
      role,
      career: role === 'STUDENT' ? career : null,
    });
    setIsSubmitting(false);

    if (profileError) {
      toast.error(`Usuario Auth creado pero perfil falló: ${profileError.message}`);
      return;
    }

    toast.success(`Usuario ${email} creado exitosamente`);
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
    const { error } = await supabaseAdmin
      .from('users')
      .update({
        full_name: editName.trim(),
        role: editRole,
        career: editRole === 'STUDENT' ? editCareer : null,
      })
      .eq('id', editingUser.id);
    setIsSavingEdit(false);

    if (error) {
      toast.error(`Error al actualizar usuario: ${error.message}`);
      return;
    }

    toast.success('Usuario actualizado');
    setEditingUser(null);
    void loadUsers();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeletingUserId(deleteTarget.id);
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(deleteTarget.id);
    if (authError) {
      setDeletingUserId(null);
      toast.error(`Error al eliminar en Auth: ${authError.message}`);
      return;
    }

    const { error: profileError } = await supabaseAdmin.from('users').delete().eq('id', deleteTarget.id);
    setDeletingUserId(null);

    if (profileError) {
      toast.error(`Auth eliminado, pero falló perfil: ${profileError.message}`);
      return;
    }

    toast.success('Usuario eliminado');
    setDeleteTarget(null);
    void loadUsers();
  };

  const roleBadge = (r: string) => (r === 'ADMIN' ? 'bg-purple-100 text-purple-700' : r === 'COORDINATOR' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700');
  const roleLabel = (r: string) => ROLES.find((x) => x.value === r)?.label ?? r;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Gestión de Usuarios</h1>
          <p className="mt-1 text-sm text-gray-500">Administra cuentas institucionales, roles y estado de acceso del personal y alumnado.</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setCreateOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Nuevo usuario
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Usuarios registrados</h2>
          <Button variant="outline" size="sm" onClick={loadUsers} disabled={isLoadingUsers}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Nombre</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Carné</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Correo</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Carrera</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Rol</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoadingUsers ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Sin usuarios registrados</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-gray-900">{u.full_name ?? '—'}</td>
                    <td className="px-6 py-3 text-gray-600 font-mono text-xs">{u.student_code}</td>
                    <td className="px-6 py-3 text-gray-600 text-xs">{u.email}</td>
                    <td className="px-6 py-3 text-gray-600">{u.career ?? '—'}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge(u.role)}`}>{roleLabel(u.role)}</span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                          <Pencil className="w-3.5 h-3.5 mr-1" />
                          Editar
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-700 border-red-200 hover:bg-red-50" onClick={() => setDeleteTarget(u)} disabled={deletingUserId === u.id}>
                          {deletingUserId === u.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
                          Eliminar
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Nuevo usuario</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="create-fullName" className="text-xs uppercase tracking-wide text-gray-600">Nombre completo</Label>
              <Input id="create-fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="María Fernanda García" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-studentCode" className="text-xs uppercase tracking-wide text-gray-600">Carné (código)</Label>
              <Input id="create-studentCode" value={studentCode} onChange={(e) => setStudentCode(e.target.value.toUpperCase())} placeholder="U20240001" maxLength={9} required />
              {derivedEmail && <p className="text-xs text-gray-400">Correo: <span className="text-gray-700 font-medium">{derivedEmail}</span></p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-role" className="text-xs uppercase tracking-wide text-gray-600">Rol</Label>
              <select id="create-role" value={role} onChange={(e) => setRole(e.target.value)} className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {role === 'STUDENT' && (
              <div className="space-y-1.5">
                <Label htmlFor="create-career" className="text-xs uppercase tracking-wide text-gray-600">Carrera</Label>
                <select id="create-career" value={career} onChange={(e) => setCareer(e.target.value)} className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {CAREERS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="create-password" className="text-xs uppercase tracking-wide text-gray-600">Contraseña temporal</Label>
              <Input id="create-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" minLength={8} required />
            </div>
            <div className="sm:col-span-2 flex justify-end pt-2">
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creando...</> : <><UserPlus className="w-4 h-4 mr-2" />Crear usuario</>}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => { if (!open) setEditingUser(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Editar usuario</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name" className="text-xs uppercase tracking-wide text-gray-600">Nombre completo</Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-role" className="text-xs uppercase tracking-wide text-gray-600">Rol</Label>
              <select id="edit-role" value={editRole} onChange={(e) => setEditRole(e.target.value)} className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {editRole === 'STUDENT' && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-career" className="text-xs uppercase tracking-wide text-gray-600">Carrera</Label>
                <select id="edit-career" value={editCareer} onChange={(e) => setEditCareer(e.target.value)} className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {CAREERS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isSavingEdit} className="bg-blue-600 hover:bg-blue-700 text-white">
                {isSavingEdit ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</> : 'Guardar cambios'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar usuario</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar usuario {deleteTarget?.email}? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingUserId)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              disabled={Boolean(deletingUserId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingUserId ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
