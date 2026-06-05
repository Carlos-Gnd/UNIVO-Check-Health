import type React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import { LoadingScreen } from './LoadingScreen';
import { initFcm } from '@/shared/utils/firebase';
import {
  LayoutDashboard,
  ClipboardCheck,
  Users,
  Stethoscope,
  BarChart3,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  LogOut,
  HeartPulse,
  FileCheck2,
  Activity,
  MapPin,
  UserPlus,
  CalendarDays,
  QrCode,
  History,
  Gauge,
  FileWarning,
  Hospital,
  ClipboardList,
  UserCog,
  AlertTriangle,
  UserCircle,
} from 'lucide-react';
import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { supabase } from '@/shared/backend/supabaseClient';
import { claimSession, checkSession, clearLocalSession } from '@/shared/utils/singleSession';
import { toInstitutionalEmail, UNIVO_DOMAIN } from '@/shared/utils/email';
import { ForcePasswordChange } from '@/modules/auth/ForcePasswordChange';
import { LegalConsent } from '@/modules/legal/LegalConsent';
import { LEGAL_VERSION } from '@/modules/legal/legalContent';
import { PermissionsSetup, PERMISSIONS_KEY } from '@/modules/auth/PermissionsSetup';
import type { User } from '@supabase/supabase-js';

type AppRole = 'Encargado' | 'Decano' | 'Alumno' | 'Docente';
type NavItem = { name: string; href: string; icon: React.ElementType; badge?: number };
const APP_LOGO_SRC = '/images/isologo.png';

function mapAppRole(rawRole: string | null | undefined): AppRole {
  const normalized = (rawRole ?? '').toUpperCase().trim();
  if (normalized === 'ADMIN' || normalized === 'ADMINISTRADOR') return 'Decano';
  if (normalized === 'STUDENT' || normalized === 'ESTUDIANTE' || normalized === 'ALUMNO') return 'Alumno';
  if (normalized === 'DOCENTE' || normalized === 'TEACHER') return 'Docente';
  return 'Encargado';
}

export function MainLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => localStorage.getItem('checkhealth-sidebar-collapsed') === '1',
  );

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      localStorage.setItem('checkhealth-sidebar-collapsed', prev ? '0' : '1');
      return !prev;
    });
  };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentRole, setCurrentRole] = useState<AppRole>('Encargado');
  const [displayName, setDisplayName] = useState('');
  const [isResolvingRole, setIsResolvingRole] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(true);
  const [needsPermissions, setNeedsPermissions] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const sessionIdRef = useRef<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const resolveRole = async (userId: string, fallbackEmail: string) => {
    setIsResolvingRole(true);
    const { data } = await supabase
      .from('users')
      .select('role, full_name')
      .eq('id', userId)
      .single();
    setCurrentRole(mapAppRole(data?.role));
    setDisplayName(data?.full_name ?? fallbackEmail);
    setIsResolvingRole(false);

    // must_change_password se consulta aparte: si la columna aún no existe
    // (migración no aplicada), su error no debe romper la resolución de rol.
    const { data: flag } = await supabase
      .from('users')
      .select('must_change_password')
      .eq('id', userId)
      .single();
    setMustChangePassword(Boolean(flag?.must_change_password));

    // Consentimiento legal. Fail-open si la columna aún no existe (migración no
    // aplicada): no bloquear el acceso. Solo bloquea si se lee y la versión
    // aceptada no coincide con la vigente.
    const { data: legal, error: legalErr } = await supabase
      .from('users')
      .select('accepted_legal_version')
      .eq('id', userId)
      .single();
    setLegalAccepted(legalErr ? true : legal?.accepted_legal_version === LEGAL_VERSION);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setCurrentUser(session.user);
          setNeedsPermissions(localStorage.getItem(PERMISSIONS_KEY) !== '1');
          void resolveRole(session.user.id, session.user.email ?? '');
          // Sesión única: reclama (o reusa) el id de sesión para este usuario.
          void claimSession(session.user.id).then((id) => { sessionIdRef.current = id; });
        } else {
          setCurrentUser(null);
          setCurrentRole('Encargado');
          setDisplayName('');
          setMustChangePassword(false);
          setLegalAccepted(true);
          setNeedsPermissions(false);
          setIsResolvingRole(false);
          sessionIdRef.current = null;
          clearLocalSession();
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // Sesión única: si otro dispositivo inició sesión después, este cliente se cierra.
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const verify = async () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      const result = await checkSession(currentUser.id, sid);
      if (!cancelled && result === 'superseded') {
        toast.error('Tu sesión se cerró porque iniciaste sesión en otro dispositivo.');
        await supabase.auth.signOut();
      }
    };
    const interval = setInterval(() => void verify(), 45000);
    const onFocus = () => void verify();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [currentUser]);

  useEffect(() => {
    if (currentRole !== 'Decano') return;
    const load = () => {
      void supabase
        .from('justifications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDIENTE')
        .then(({ count }) => setPendingCount(count ?? 0));
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [currentRole]);

  useEffect(() => {
    if (!currentUser || isResolvingRole) return;
    if (currentRole === 'Alumno' && location.pathname === '/') navigate('/rotations', { replace: true });
    if (currentRole === 'Decano' && location.pathname === '/') navigate('/dean/dashboard', { replace: true });
    if (currentRole === 'Docente' && location.pathname === '/') navigate('/teacher/dashboard', { replace: true });
  }, [currentUser, currentRole, isResolvingRole, location.pathname, navigate]);

  const navigation: NavItem[] = currentRole === 'Decano'
    ? [
        { name: 'Dashboard', href: '/dean/dashboard', icon: LayoutDashboard },
        { name: 'Calendario', href: '/rotations', icon: CalendarDays },
        { name: 'Alumnos', href: '/dean/students', icon: Users },
        { name: 'Sedes', href: '/dean/locations', icon: MapPin },
        { name: 'Asignaciones', href: '/dean/assignments', icon: UserCog },
        { name: 'Justificaciones', href: '/dean/justifications', icon: ClipboardList },
        { name: 'Incidencias', href: '/dean/incidents', icon: AlertTriangle, badge: pendingCount },
        { name: 'Gestión de Usuarios', href: '/users', icon: UserPlus },
      ]
    : currentRole === 'Alumno'
      ? [
          { name: 'Calendario', href: '/rotations', icon: CalendarDays },
          { name: 'Escanear QR', href: '/student/qr', icon: QrCode },
          { name: 'Historial', href: '/student/history', icon: History },
          { name: 'Progreso de Horas', href: '/student/progress', icon: Gauge },
          { name: 'Justificaciones', href: '/student/justifications', icon: FileWarning },
          { name: 'Mi Sede y Encargado', href: '/student/assignment', icon: Hospital },
        ]
    : currentRole === 'Docente'
      ? [
          { name: 'Mi Grupo', href: '/teacher/dashboard', icon: LayoutDashboard },
          { name: 'Calendario', href: '/rotations', icon: CalendarDays },
          { name: 'Evaluaciones', href: '/teacher/evaluations', icon: ClipboardList },
          { name: 'Justificaciones', href: '/dean/justifications', icon: FileWarning },
          { name: 'Historial de Decisiones', href: '/teacher/history', icon: History },
          { name: 'Incidencias', href: '/dean/incidents', icon: AlertTriangle },
          { name: 'Sedes', href: '/dean/locations', icon: MapPin },
          { name: 'Gestión de Usuarios', href: '/users', icon: UserPlus },
        ]
      : [
          { name: 'Dashboard', href: '/', icon: LayoutDashboard },
          { name: 'Calendario', href: '/rotations', icon: CalendarDays },
          { name: 'Registro de Asistencia', href: '/checkin', icon: ClipboardCheck },
          { name: 'Estudiantes', href: '/students', icon: Users },
          { name: 'Asignaciones', href: '/dean/assignments', icon: UserCog },
          { name: 'Prácticas', href: '/practices', icon: Stethoscope },
          { name: 'Justificaciones', href: '/dean/justifications', icon: ClipboardList },
          { name: 'Incidencias', href: '/dean/incidents', icon: AlertTriangle },
          { name: 'Reportes', href: '/reports', icon: BarChart3 },
        ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    // Resuelve el identificador (carné/código O correo) al correo real con el que
    // autenticar. Si el carné no existe en BD, cae al autocompletado @univo.edu.sv.
    const identifier = email.trim();
    const { data: resolved } = await supabase.rpc('email_for_login', { p_identifier: identifier });
    const loginEmail = ((resolved as string | null) ?? toInstitutionalEmail(identifier)).toLowerCase();

    if (!loginEmail.endsWith(UNIVO_DOMAIN)) {
      setIsLoading(false);
      toast.error(`Usa tu carné o correo institucional (${UNIVO_DOMAIN})`);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });
    setIsLoading(false);

    if (error) {
      toast.error('Correo o contraseña inválidos');
      return;
    }

    // Registrar token FCM para notificaciones push (T-16.1); no bloquea si falla
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user.id) {
      void initFcm(sessionData.session.user.id);
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
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(245,166,35,0.14),transparent_28%),linear-gradient(135deg,#eef3fb_0%,#f7f9fd_48%,#ffffff_100%)] flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-6xl rounded-2xl overflow-hidden border border-brand-100 bg-white/95 backdrop-blur shadow-[0_24px_70px_rgba(26,45,107,0.16)]">
          <div className="lg:hidden p-5 border-b border-brand-100 bg-gradient-to-r from-white to-brand-50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white border border-gold-200 flex items-center justify-center shadow-sm overflow-hidden">
                <img src={APP_LOGO_SRC} alt="Logo UNIVO Check-Health" className="w-10 h-10 object-contain" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-bold tracking-normal sm:tracking-wide leading-tight text-slate-900">UNIVO Check-Health</h1>
                <p className="text-xs tracking-[0.16em] uppercase text-slate-500">Área de Salud</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2">
            <section className="hidden lg:block p-8 sm:p-10 border-r border-brand-100 bg-gradient-to-br from-white via-brand-50/60 to-gold-50/40">
              <div className="w-24 h-24 rounded-2xl bg-white border border-gold-200 flex items-center justify-center shadow-md overflow-hidden">
                <img src={APP_LOGO_SRC} alt="Logo UNIVO Check-Health" className="w-20 h-20 object-contain" />
              </div>
              <h1 className="mt-6 text-3xl font-bold tracking-wide text-brand-900">UNIVO Check-Health</h1>
              <p className="mt-1 text-sm tracking-[0.2em] uppercase text-brand-600">Área de Salud</p>
              <div className="mt-10 space-y-3">
                <div className="rounded-xl border border-brand-100 bg-white p-4 flex items-center gap-3 shadow-sm"><div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center ring-1 ring-brand-100"><FileCheck2 className="w-5 h-5 text-brand-700" /></div><div><p className="text-sm font-semibold text-brand-900">Registro de Asistencias</p><p className="text-xs text-slate-500">Control diario por estudiante y práctica</p></div></div>
                <div className="rounded-xl border border-gold-200 bg-white p-4 flex items-center gap-3 shadow-sm"><div className="w-9 h-9 rounded-lg bg-gold-50 flex items-center justify-center ring-1 ring-gold-100"><HeartPulse className="w-5 h-5 text-gold-700" /></div><div><p className="text-sm font-semibold text-brand-900">Prácticas del Área de Salud</p><p className="text-xs text-slate-500">Seguimiento de jornadas y cumplimiento</p></div></div>
                <div className="rounded-xl border border-brand-100 bg-white p-4 flex items-center gap-3 shadow-sm"><div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center ring-1 ring-brand-100"><Activity className="w-5 h-5 text-brand-700" /></div><div><p className="text-sm font-semibold text-brand-900">Reportes y Trazabilidad</p><p className="text-xs text-slate-500">Datos para revisión académica y clínica</p></div></div>
              </div>
            </section>

            <section className="p-5 sm:p-8 lg:p-10 bg-gradient-to-br from-brand-50/40 to-white">
              <p className="text-xs uppercase tracking-[0.22em] text-brand-600 text-center mb-5 sm:mb-6">Acceso al sistema</p>
              <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
                <div className="space-y-2"><Label htmlFor="email" className="text-brand-900 uppercase tracking-wide text-xs">Carné o correo institucional</Label><Input id="email" type="text" placeholder="U20240000" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12 bg-white border-brand-100 text-brand-900 placeholder:text-slate-400 focus-visible:ring-brand-700" /><p className="text-xs text-slate-500">Estudiantes: ingresa tu carné. Personal (decano, docente, encargado): tu correo institucional.</p></div>
                <div className="space-y-2"><Label htmlFor="password" className="text-brand-900 uppercase tracking-wide text-xs">Contraseña</Label><div className="relative"><Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Ingresa tu contraseña" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 pr-11 bg-white border-brand-100 text-brand-900 placeholder:text-slate-400 focus-visible:ring-brand-700" required /><button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute inset-y-0 right-0 px-3 text-brand-500 hover:text-gold-700" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button></div><div className="text-right"><Link to="/auth/recovery" className="text-xs font-medium text-brand-700 hover:text-gold-700">¿Olvidaste tu contraseña?</Link></div></div>
                <Button type="submit" disabled={isLoading} className="w-full h-12 mt-2 bg-brand-800 hover:bg-brand-900 text-white font-semibold tracking-wide shadow-sm shadow-brand-900/15">{isLoading ? 'Verificando...' : 'Iniciar sesión'}</Button>
              </form>
            </section>
          </div>
          <div className="border-t border-brand-100 py-3.5 sm:py-4 px-4 text-center text-[11px] sm:text-xs text-slate-500">
            <p>UNIVO Check-Health - Sistema de Registro y Control de Asistencias</p>
            <p className="mt-1 space-x-2">
              <Link to="/legal/privacy" className="text-brand-600 hover:text-gold-700">Privacidad</Link>
              <span className="text-slate-300">·</span>
              <Link to="/legal/cookies" className="text-brand-600 hover:text-gold-700">Cookies</Link>
              <span className="text-slate-300">·</span>
              <Link to="/legal/terms" className="text-brand-600 hover:text-gold-700">Términos</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isResolvingRole) {
    return <LoadingScreen />;
  }

  // Contraseña temporal de un solo uso: bloquea la app hasta crear una nueva.
  if (mustChangePassword) {
    return <ForcePasswordChange onDone={() => setMustChangePassword(false)} />;
  }

  // Consentimiento legal obligatorio al ingresar (privacidad, cookies, términos).
  if (!legalAccepted) {
    return <LegalConsent onAccept={() => setLegalAccepted(true)} />;
  }

  // Onboarding de permisos (una vez por dispositivo, al primer inicio de sesión).
  if (needsPermissions) {
    return <PermissionsSetup onDone={() => setNeedsPermissions(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-surface to-white">
      <header className="bg-brand-700 border-b border-brand-800 shadow-[0_2px_16px_rgba(26,45,107,0.15)] sticky top-0 z-50 backdrop-blur">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white border border-gold-200 rounded-lg flex items-center justify-center shrink-0 overflow-hidden shadow-sm"><img src={APP_LOGO_SRC} alt="Logo UNIVO Check-Health" className="w-8 h-8 object-contain" /></div>
              <div><h1 className="text-base sm:text-lg leading-tight font-semibold text-white">UNIVO Check-Health</h1><p className="text-xs text-gold-200">Sistema de Asistencias</p></div>
            </div>
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="lg:hidden p-2 rounded-md text-white hover:text-gold-200 hover:bg-brand-600">{isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}</button>
          </div>
        </div>
      </header>

      <div className="max-w-[1800px] mx-auto flex w-full">
        <aside className={`hidden lg:flex lg:flex-col ${isSidebarCollapsed ? 'w-16' : 'w-64'} shrink-0 bg-gradient-to-b from-brand-700 via-brand-800 to-brand-700 border-r border-brand-800/60 min-h-[calc(100vh-4rem)] sticky top-16 self-start h-[calc(100vh-4rem)] shadow-[8px_0_24px_rgba(26,45,107,0.14)] transition-[width] duration-200`}>
          <div className={`flex p-2 ${isSidebarCollapsed ? 'justify-center' : 'justify-end'}`}>
            <button
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
              aria-label={isSidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
              className="p-1.5 rounded-md text-brand-100/80 hover:bg-white/10 hover:text-white"
            >
              {isSidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
          </div>
          <nav className="flex-1 p-3 pt-0 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  title={isSidebarCollapsed ? item.name : undefined}
                  className={`flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3'} py-2.5 rounded-md text-sm transition-colors ${
                    active
                      ? 'bg-white text-brand-900 font-semibold border-l-4 border-gold-500 pl-2 shadow-sm'
                      : 'text-brand-100/85 hover:bg-white/10 hover:text-white border-l-4 border-transparent pl-2'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span className="flex-1">{item.name}</span>}
                  {!isSidebarCollapsed && item.badge != null && item.badge > 0 && (
                    <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold leading-none text-brand-900">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-white/10 space-y-3 shrink-0 bg-brand-900/30">
            {isSidebarCollapsed ? (
              <Link to="/profile" title={displayName || currentUser.email} className="flex justify-center rounded-md bg-white p-2 shadow-sm hover:bg-brand-50">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-100 bg-brand-50 text-brand-700">
                  <UserCircle className="h-5 w-5" />
                </div>
              </Link>
            ) : (
              <Link to="/profile" className="flex items-center gap-3 rounded-md border-l-4 border-gold-500 bg-white p-3 shadow-sm transition-colors hover:bg-brand-50">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-brand-900 truncate">{displayName || currentUser.email}</p>
                  <p className="text-xs text-brand-700 font-semibold mt-0.5">{currentRole}</p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-100 bg-brand-50 text-brand-700">
                  <UserCircle className="h-5 w-5" />
                </div>
              </Link>
            )}
            <Button
              onClick={handleLogout}
              variant="ghost"
              title="Cerrar sesión"
              className={`w-full bg-brand-800/55 text-brand-50 hover:bg-brand-700 hover:text-white border border-white/10 ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-start'}`}
            >
              <LogOut className={`w-4 h-4 ${isSidebarCollapsed ? '' : 'mr-2'}`} />{!isSidebarCollapsed && 'Cerrar sesión'}
            </Button>
          </div>
        </aside>

        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 top-16 z-40 bg-gradient-to-b from-brand-700 via-brand-800 to-brand-700 overflow-y-auto">
            <nav className="p-3 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                      active
                        ? 'bg-white text-brand-900 font-semibold border-l-4 border-gold-500 pl-2 shadow-sm'
                        : 'text-brand-100/85 hover:bg-white/10 hover:text-white border-l-4 border-transparent pl-2'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{item.name}</span>
                    {item.badge != null && item.badge > 0 && (
                      <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold leading-none text-brand-900">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
              <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                <Link to="/profile" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 rounded-md border-l-4 border-gold-500 bg-white p-3 shadow-sm transition-colors hover:bg-brand-50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-brand-900 truncate">{displayName || currentUser.email}</p>
                    <p className="text-xs text-brand-700 font-semibold mt-0.5">{currentRole}</p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-100 bg-brand-50 text-brand-700">
                    <UserCircle className="h-5 w-5" />
                  </div>
                </Link>
                <Button onClick={handleLogout} variant="ghost" className="w-full justify-start bg-brand-800/55 text-brand-50 hover:bg-brand-700 hover:text-white border border-white/10">
                  <LogOut className="w-4 h-4 mr-2" />Cerrar sesión
                </Button>
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
