import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { QrCode, History, Gauge, FileWarning, Hospital, CalendarDays, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { PageHeader } from '@/shared/components/PageHeader';
import { supabase } from '@/shared/backend/supabaseClient';
import { getStudentHoursProgress } from '@/shared/backend/checkHealthBackend';

type Quick = { name: string; href: string; icon: React.ElementType; desc: string };

const QUICK_LINKS: Quick[] = [
  { name: 'Registrar entrada/salida', href: '/student/qr', icon: QrCode, desc: 'Escanea el QR de tu sede' },
  { name: 'Mi sede y encargado', href: '/student/assignment', icon: Hospital, desc: 'Sede, docente y coordinador' },
  { name: 'Progreso de horas', href: '/student/progress', icon: Gauge, desc: 'Horas acumuladas por materia' },
  { name: 'Historial', href: '/student/history', icon: History, desc: 'Tus marcajes anteriores' },
  { name: 'Justificaciones', href: '/student/justifications', icon: FileWarning, desc: 'Justifica ausencias o tardanzas' },
  { name: 'Calendario', href: '/rotations', icon: CalendarDays, desc: 'Tus rotaciones programadas' },
];

export function StudentDashboardPage() {
  const [name, setName] = useState('');
  const [hours, setHours] = useState<{ completedHours: number; requiredHours: number } | null>(null);
  const [openShift, setOpenShift] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const [{ data: profile }, hrs, { data: open }] = await Promise.all([
        supabase.from('users').select('full_name').eq('id', user.id).single(),
        getStudentHoursProgress(user.id),
        supabase.from('attendances').select('id').eq('student_id', user.id).is('check_out', null).limit(1).maybeSingle(),
      ]);
      setName((profile?.full_name as string) ?? '');
      setHours(hrs);
      setOpenShift(Boolean(open));
      setLoading(false);
    })();
  }, []);

  const pct = hours ? Math.min(100, Math.round((hours.completedHours / Math.max(1, hours.requiredHours)) * 100)) : 0;
  const barColor = pct >= 85 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="space-y-5">
      <PageHeader
        title={name ? `Hola, ${name.split(' ')[0]}` : 'Mi panel'}
        description="Resumen de tu práctica clínica y accesos rápidos."
      />

      {loading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-gray-400"><Loader2 className="h-5 w-5 animate-spin" />Cargando…</div>
      ) : (
        <>
          {openShift && (
            <Link to="/student/qr" className="block">
              <Card className="border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors">
                <CardContent className="py-4 flex items-center gap-3 text-blue-900">
                  <QrCode className="h-5 w-5" />
                  <div>
                    <p className="text-sm font-semibold">Tienes una entrada activa sin salida</p>
                    <p className="text-xs text-blue-700">Toca aquí para registrar tu salida y acumular las horas.</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}

          <Card>
            <CardContent className="py-5">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-semibold text-brand-900">Progreso de horas de práctica</span>
                {hours && <span className="text-brand-700 font-medium">{hours.completedHours} / {hours.requiredHours} h ({pct}%)</span>}
              </div>
              <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_LINKS.map((q) => (
              <Link key={q.href} to={q.href}>
                <Card className="h-full hover:border-brand-300 hover:shadow-md transition-all">
                  <CardContent className="py-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center ring-1 ring-brand-100 shrink-0">
                      <q.icon className="w-5 h-5 text-brand-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-brand-900">{q.name}</p>
                      <p className="text-xs text-gray-500">{q.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
