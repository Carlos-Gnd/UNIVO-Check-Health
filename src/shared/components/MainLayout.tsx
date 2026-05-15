import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import {
  LayoutDashboard,
  ClipboardCheck,
  Users,
  Stethoscope,
  BarChart3,
  Menu,
  X,
  Eye,
  EyeOff,
  LogOut,
  HeartPulse,
  FileCheck2,
  Activity,
  MapPin,
  UserPlus,
} from 'lucide-react';
import { useState, useEffect, type FormEvent } from 'react';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { supabase } from '@/shared/backend/supabaseClient';
import type { User } from '@supabase/supabase-js';

type AppRole = 'Encargado' | 'Decano';

const UNIVO_DOMAIN = '@univo.edu.sv';

export function MainLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentRole, setCurrentRole] = useState<AppRole>('Encargado');
  const [displayName, setDisplayName] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const resolveRole = async (userEmail: string) => {
    const { data } = await supabase
      .from('users')
      .select('role, full_name')
      .eq('email', userEmail)
      .single();
    setCurrentRole(data?.role === 'ADMIN' ? 'Decano' : 'Encargado');
    setDisplayName(data?.full_name ?? userEmail);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setCurrentUser(session.user);
          void resolveRole(session.user.email ?? '');
        } else {
          setCurrentUser(null);
          setCurrentRole('Encargado');
          setDisplayName('');
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const navigation = currentRole === 'Decano'
    ? [
        { name: 'Dashboard', href: '/dean/dashboard', icon: LayoutDashboard },
        { name: 'Alumnos', href: '/dean/students', icon: Users },
        { name: 'Sedes', href: '/dean/locations', icon: MapPin },
      ]
    : [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
        { name: 'Registro de Asistencia', href: '/checkin', icon: ClipboardCheck },
        { name: 'Estudiantes', href: '/students', icon: Users },
        { name: 'Prácticas', href: '/practices', icon: Stethoscope },
        { name: 'Reportes', href: '/reports', icon: BarChart3 },
        { name: 'Gestión de Usuarios', href: '/users', icon: UserPlus },
      ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail.endsWith(UNIVO_DOMAIN)) {
      toast.error(`Solo se permiten correos institucionales (${UNIVO_DOMAIN})`);
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    setIsLoading(false);

    if (error) {
      toast.error('Correo o contraseña inválidos');
      return;
    }

    setPassword('');
    toast.success('Bienvenido al sistema');
    navigate('/');
  };

  const handleLogout = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from('audit_log').insert({
        action: 'SIGN_OUT',
        actor_user_id: session.user.id,
        details: { email: session.user.email, timestamp: new Date().toISOString() },
      });
    }
    await supabase.auth.signOut();
    setIsMobileMenuOpen(false);
    setEmail('');
    setPassword('');
    setShowPassword(false);
    toast.success('Sesión cerrada');
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-white flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-6xl rounded-2xl overflow-hidden border border-blue-100 bg-white/95 backdrop-blur shadow-[0_20px_60px_rgba(14,116,144,0.15)]">
          <div className="lg:hidden p-5 border-b border-blue-100 bg-gradient-to-r from-white to-cyan-50/70">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-sm">
                <Stethoscope className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-bold tracking-normal sm:tracking-wide leading-tight text-slate-900">UNIVO Check-Health</h1>
                <p className="text-xs tracking-[0.16em] uppercase text-slate-500">Área de Salud</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2">
            <section className="hidden lg:block p-8 sm:p-10 border-r border-blue-100 bg-gradient-to-br from-white to-cyan-50/60">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-md">
                <Stethoscope className="w-10 h-10 text-white" />
              </div>
              <h1 className="mt-6 text-3xl font-bold tracking-wide text-slate-900">UNIVO Check-Health</h1>
              <p className="mt-1 text-sm tracking-[0.2em] uppercase text-slate-500">Área de Salud</p>
              <div className="mt-10 space-y-3">
                <div className="rounded-xl border border-blue-100 bg-white p-4 flex items-center gap-3 shadow-sm"><div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center"><FileCheck2 className="w-5 h-5 text-blue-600" /></div><div><p className="text-sm font-semibold text-slate-900">Registro de Asistencias</p><p className="text-xs text-slate-500">Control diario por estudiante y práctica</p></div></div>
                <div className="rounded-xl border border-blue-100 bg-white p-4 flex items-center gap-3 shadow-sm"><div className="w-9 h-9 rounded-lg bg-cyan-100 flex items-center justify-center"><HeartPulse className="w-5 h-5 text-cyan-600" /></div><div><p className="text-sm font-semibold text-slate-900">Prácticas del Área de Salud</p><p className="text-xs text-slate-500">Seguimiento de jornadas y cumplimiento</p></div></div>
                <div className="rounded-xl border border-blue-100 bg-white p-4 flex items-center gap-3 shadow-sm"><div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center"><Activity className="w-5 h-5 text-blue-600" /></div><div><p className="text-sm font-semibold text-slate-900">Reportes y Trazabilidad</p><p className="text-xs text-slate-500">Datos para revisión académica y clínica</p></div></div>
              </div>
            </section>

            <section className="p-5 sm:p-8 lg:p-10 bg-gradient-to-br from-blue-50/60 to-white">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500 text-center mb-5 sm:mb-6">Acceso al sistema</p>
              <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
                <div className="space-y-2"><Label htmlFor="email" className="text-slate-700 uppercase tracking-wide text-xs">Correo institucional</Label><Input id="email" type="email" placeholder={`U20240000${UNIVO_DOMAIN}`} value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12 bg-white border-blue-200 text-slate-900 placeholder:text-slate-400" /></div>
                <div className="space-y-2"><Label htmlFor="password" className="text-slate-700 uppercase tracking-wide text-xs">Contraseña</Label><div className="relative"><Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Ingresa tu contraseña" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 pr-11 bg-white border-blue-200 text-slate-900 placeholder:text-slate-400" required /><button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute inset-y-0 right-0 px-3 text-blue-500 hover:text-blue-700" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button></div></div>
                <Button type="submit" disabled={isLoading} className="w-full h-12 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold tracking-wide">{isLoading ? 'Verificando...' : 'Iniciar sesión'}</Button>
              </form>
            </section>
          </div>
          <div className="border-t border-blue-100 py-3.5 sm:py-4 px-4 text-center text-[11px] sm:text-xs text-slate-500">UNIVO Check-Health - Sistema de Registro y Control de Asistencias</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center shrink-0"><Stethoscope className="w-6 h-6 text-white" /></div>
              <div><h1 className="text-base sm:text-lg leading-tight font-semibold text-gray-900">UNIVO Check-Health</h1><p className="text-xs text-gray-500">Sistema de Asistencias</p></div>
            </div>
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="lg:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100">{isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}</button>
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto flex w-full">
        <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)] sticky top-16 self-start h-[calc(100vh-4rem)]">
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">{navigation.map((item) => { const Icon = item.icon; const active = isActive(item.href); return <Link key={item.name} to={item.href} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}><Icon className="w-5 h-5 shrink-0" /><span className="text-sm font-medium">{item.name}</span></Link>; })}</nav>
          <div className="p-4 border-t border-gray-200 space-y-3 shrink-0"><div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-3 rounded-lg"><p className="text-sm font-semibold text-gray-900 truncate">{displayName || currentUser.email}</p><p className="text-xs text-gray-600">{currentRole}</p></div><Button onClick={handleLogout} variant="outline" className="w-full justify-start"><LogOut className="w-4 h-4 mr-2" />Cerrar sesión</Button></div>
        </aside>

        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 top-16 z-40 bg-white overflow-y-auto">
            <nav className="p-4 space-y-1">
              {navigation.map((item) => { const Icon = item.icon; const active = isActive(item.href); return <Link key={item.name} to={item.href} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}><Icon className="w-5 h-5 shrink-0" /><span className="text-sm font-medium">{item.name}</span></Link>; })}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="px-4 py-2 mb-3"><p className="text-sm font-semibold text-gray-900 truncate">{displayName || currentUser.email}</p><p className="text-xs text-gray-500">{currentRole}</p></div>
                <Button onClick={handleLogout} variant="outline" className="w-full justify-start"><LogOut className="w-4 h-4 mr-2" />Cerrar sesión</Button>
              </div>
            </nav>
          </div>
        )}

        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
