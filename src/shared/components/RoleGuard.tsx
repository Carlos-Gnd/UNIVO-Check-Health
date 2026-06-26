import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/shared/backend/supabaseClient';
import { canonicalRole, type CanonicalRole } from '@/shared/utils/roles';

// El guard acepta sinónimos en `allow` (ADMIN/COORDINADOR/DOCENTE…) pero compara
// contra el rol canónico del usuario, así un decano 'ADMINISTRADOR' nunca se bloquea.
type UserRole = 'ADMIN' | 'STUDENT' | 'COORDINATOR' | 'COORDINADOR' | 'TEACHER' | 'DOCENTE' | 'REPRESENTATIVE';

const ROLE_HOME: Record<CanonicalRole, string> = {
  ADMIN: '/dean/dashboard',
  STUDENT: '/rotations',
  COORDINATOR: '/',
  TEACHER: '/teacher/dashboard',
  REPRESENTATIVE: '/hospital/live',
};

export function RoleGuard({
  allow,
  children,
}: {
  allow: UserRole[];
  children: ReactNode;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<CanonicalRole | null>(null);

  useEffect(() => {
    const resolve = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData.user;
      if (!authUser?.id) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      setIsAuthenticated(true);
      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('id', authUser.id)
        .single<{ role: string }>();
      setRole(canonicalRole(data?.role));
      setIsLoading(false);
    };
    void resolve();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Validando permisos…</span>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!role) return <Navigate to="/" replace />;
  // `allow` puede traer sinónimos (COORDINADOR, DOCENTE…); se canonizan para comparar.
  const allowed = allow.map(canonicalRole);
  if (!allowed.includes(role)) return <Navigate to={ROLE_HOME[role]} replace />;
  return <>{children}</>;
}
