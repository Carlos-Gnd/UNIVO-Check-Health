import { useState, useEffect, type FormEvent } from 'react';
import { UserPlus, Loader2, RefreshCw } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { toast } from 'sonner';
import { supabaseAdmin } from '@/shared/backend/supabaseAdmin';
import { supabase } from '@/shared/backend/supabaseClient';

const UNIVO_DOMAIN = '@univo.edu.sv';

const CAREERS = [
  'Enfermería',
  'Medicina',
  'Fisioterapia',
  'Radiología',
  'Laboratorio Clínico',
  'Nutrición',
];

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

  const derivedEmail = studentCode
    ? `${studentCode.toUpperCase()}${UNIVO_DOMAIN}`
    : '';

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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
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

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      toast.error(`Error al crear usuario: ${authError.message}`);
      setIsSubmitting(false);
      return;
    }

    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
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
    setFullName('');
    setStudentCode('');
    setCareer(CAREERS[0]);
    setRole('STUDENT');
    setPassword('');
    void loadUsers();
  };

  const roleBadge = (r: string) => {
    if (r === 'ADMIN') return 'bg-purple-100 text-purple-700';
    if (r === 'COORDINATOR') return 'bg-blue-100 text-blue-700';
    return 'bg-green-100 text-green-700';
  };

  const roleLabel = (r: string) => ROLES.find((x) => x.value === r)?.label ?? r;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Gestión de Usuarios</h1>
        <p className="mt-1 text-sm text-gray-500">Crea cuentas institucionales para estudiantes y personal.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-blue-600" />
          Nuevo usuario
        </h2>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-xs uppercase tracking-wide text-gray-600">Nombre completo</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="María Fernanda García"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="studentCode" className="text-xs uppercase tracking-wide text-gray-600">Carné (código)</Label>
            <Input
              id="studentCode"
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
              placeholder="U20240001"
              maxLength={9}
              required
            />
            {derivedEmail && (
              <p className="text-xs text-gray-400">Correo: <span className="text-gray-700 font-medium">{derivedEmail}</span></p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role" className="text-xs uppercase tracking-wide text-gray-600">Rol</Label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {role === 'STUDENT' && (
            <div className="space-y-1.5">
              <Label htmlFor="career" className="text-xs uppercase tracking-wide text-gray-600">Carrera</Label>
              <select
                id="career"
                value={career}
                onChange={(e) => setCareer(e.target.value)}
                className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CAREERS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs uppercase tracking-wide text-gray-600">Contraseña temporal</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              minLength={8}
              required
            />
          </div>

          <div className="sm:col-span-2 flex justify-end pt-2">
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creando...</> : <><UserPlus className="w-4 h-4 mr-2" />Crear usuario</>}
            </Button>
          </div>
        </form>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoadingUsers ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">Sin usuarios registrados</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-gray-900">{u.full_name ?? '—'}</td>
                    <td className="px-6 py-3 text-gray-600 font-mono text-xs">{u.student_code}</td>
                    <td className="px-6 py-3 text-gray-600 text-xs">{u.email}</td>
                    <td className="px-6 py-3 text-gray-600">{u.career ?? '—'}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge(u.role)}`}>
                        {roleLabel(u.role)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
