import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Users } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { useDeanStore } from '@/modules/dean/store/useDeanStore';
import { getActiveStudentsSnapshot } from '@/shared/backend/checkHealthBackend';
import { PageHeader } from '@/shared/components/PageHeader';
import { StudentLiveMap } from '@/shared/components/StudentLiveMap';
import { fetchSharedDeviceAlerts, type SharedDeviceAlert } from '../services/dean.service';

const RESOLVED_SHARED_DEVICE_ALERTS_KEY = 'checkhealth_resolved_shared_device_alerts';
const RISK_PAGE_SIZE = 5;

const readResolvedSharedDeviceAlerts = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(RESOLVED_SHARED_DEVICE_ALERTS_KEY) ?? '[]') as string[]);
  } catch {
    return new Set<string>();
  }
};

const writeResolvedSharedDeviceAlerts = (ids: Set<string>) => {
  localStorage.setItem(RESOLVED_SHARED_DEVICE_ALERTS_KEY, JSON.stringify([...ids]));
};

export function DeanDashboardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { students, locations, globalStats, isLoading, loadData, setFilter } = useDeanStore();
  const [sharedDeviceAlerts, setSharedDeviceAlerts] = useState<SharedDeviceAlert[]>([]);
  const [resolvedAlertIds, setResolvedAlertIds] = useState<Set<string>>(() => readResolvedSharedDeviceAlerts());
  const [riskPage, setRiskPage] = useState(0);

  // T-18.3: filtros de mapa persistidos en URL
  const campusFilter = searchParams.get('campus') ?? 'all';

  const setMapFilter = (key: 'campus', value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === 'all') next.delete(key); else next.set(key, value);
      next.delete('career');
      return next;
    }, { replace: true });
  };

  const campusOptions = useMemo(() => locations.map((l) => ({ id: l.id, name: l.name })), [locations]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void fetchSharedDeviceAlerts().then(setSharedDeviceAlerts);
  }, []);

  const riskStudents = useMemo(
    () =>
      [...students]
        .filter((s) => s.compliancePercentage < globalStats.riskThreshold)
        .sort((a, b) => a.compliancePercentage - b.compliancePercentage),
    [globalStats.riskThreshold, students],
  );

  const totalRiskPages = Math.max(1, Math.ceil(riskStudents.length / RISK_PAGE_SIZE));
  const pagedRiskStudents = riskStudents.slice(riskPage * RISK_PAGE_SIZE, (riskPage + 1) * RISK_PAGE_SIZE);

  const activeSharedDeviceAlerts = sharedDeviceAlerts.filter((alert) => !resolvedAlertIds.has(alert.id));
  const latestSharedDeviceAlert = activeSharedDeviceAlerts[0];

  const resolveSharedDeviceAlert = (id: string) => {
    setResolvedAlertIds((current) => {
      const next = new Set(current);
      next.add(id);
      writeResolvedSharedDeviceAlerts(next);
      return next;
    });
  };

  const openStudentProfile = (studentId: string) => {
    setFilter('status', 'at-risk');
    navigate(`/dean/students?status=at-risk&student=${studentId}`);
  };

  useEffect(() => {
    if (riskPage > totalRiskPages - 1) setRiskPage(totalRiskPages - 1);
  }, [riskPage, totalRiskPages]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Cargando datos…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Vista general del cumplimiento de prácticas por sede y alumno." />

      {latestSharedDeviceAlert && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-red-800">
              <AlertTriangle className="h-4 w-4" />
              Dispositivo compartido
              <Badge className="bg-red-600 text-white">{activeSharedDeviceAlerts.length}</Badge>
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => resolveSharedDeviceAlert(latestSharedDeviceAlert.id)}>
              Resolver
            </Button>
          </CardHeader>
          <CardContent className="text-sm text-red-700">
            Mismo dispositivo activo en sedes distintas. Fingerprint: {latestSharedDeviceAlert.deviceFingerprint || 'sin dato'}.
          </CardContent>
        </Card>
      )}

      {/* T-07.5: Tarjetas de indicadores */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Alumnos Activos" value={globalStats.totalStudents} subtitle="en prácticas este período" icon={Users} />
        <StatCard title="Tasa de Cumplimiento Global" value={`${globalStats.globalComplianceRate}%`} subtitle="promedio de todos los alumnos" icon={CheckCircle2} />
        <StatCard title="Alumnos en Riesgo" value={globalStats.atRiskCount} subtitle={`menos del ${globalStats.riskThreshold}% de cumplimiento`} icon={AlertTriangle} danger />
        <StatCard title="Sedes Activas" value={globalStats.activeLocations} subtitle="lugares con prácticas este semestre" icon={Building2} />
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* T-19.3: Lista paginada de alumnos en riesgo */}
        <Card className="overflow-hidden border-brand-100 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-brand-700 via-brand-800 to-brand-900 border-b border-brand-900/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <div className="w-1 h-5 rounded-full bg-gold-400 shrink-0" />
                Alumnos en riesgo
              </CardTitle>
              <p className="text-xs text-brand-200 mt-0.5">Umbral configurado: &lt; {globalStats.riskThreshold}%</p>
            </div>
            <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/15 bg-white/10" onClick={() => { setFilter('status', 'at-risk'); navigate('/dean/students?status=at-risk'); }}>
              Ver todos
            </Button>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-4">
            {riskStudents.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin alumnos en riesgo</p>
            ) : (
              pagedRiskStudents.map((s) => (
                <div key={s.id} className="rounded-lg border border-brand-100 bg-gradient-to-r from-white to-brand-50/40 p-3 hover:border-brand-200 transition-colors">
                  <div className="flex items-start gap-2.5">
                    <div className={`mt-1 w-1 self-stretch rounded-full shrink-0 ${s.compliancePercentage < 40 ? 'bg-red-400' : 'bg-amber-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-brand-900 text-sm">{s.fullName}</p>
                        <Badge className={s.compliancePercentage < 40 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
                          {s.compliancePercentage < 40 ? 'Riesgo alto' : 'Riesgo medio'}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{s.carnet} · {s.sedeName}</p>
                      <p className="mt-1.5 text-xs text-gray-600">
                        {s.compliancePercentage}% cumplimiento · {s.goalHours - s.completedHours} h faltantes
                      </p>
                      <Button variant="link" className="mt-1 h-auto p-0 text-xs text-brand-700 hover:text-gold-700" onClick={() => openStudentProfile(s.id)}>
                        Ver perfil →
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
            {riskStudents.length > RISK_PAGE_SIZE && (
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-xs text-gray-500">Pagina {riskPage + 1} de {totalRiskPages}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={riskPage === 0} onClick={() => setRiskPage((page) => page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={riskPage >= totalRiskPages - 1} onClick={() => setRiskPage((page) => page + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* T-07.1: Resumen por sede */}
      <Card className="overflow-hidden border-brand-100 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-brand-700 via-brand-800 to-brand-900 border-b border-brand-900/30 pb-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <CardTitle className="flex items-center gap-2 text-white">
            <div className="w-1 h-5 rounded-full bg-gold-400 shrink-0" />
            Resumen rápido de sedes
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 pt-4">
          {locations.length === 0 ? (
            <p className="text-sm text-gray-400 col-span-3 text-center py-6">Sin sedes registradas</p>
          ) : (
            locations.map((l) => (
              <button
                key={l.id}
                onClick={() => navigate(`/dean/locations`)}
                className="rounded-lg border border-brand-100 bg-white p-4 text-left hover:border-brand-300 hover:bg-brand-50/50 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center shrink-0 shadow-sm group-hover:from-brand-500 group-hover:to-brand-700 transition-all">
                    <Building2 className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-brand-900 truncate text-sm">{l.name}</p>
                    <p className="text-xs text-gray-500 truncate">{l.doctorName}</p>
                  </div>
                  <Badge className={l.status === 'active' ? 'bg-gold-50 text-gold-700 border border-gold-200' : 'bg-gray-100 text-gray-500'}>
                    {l.status === 'active' ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
                <div className="mt-2 pt-2.5 border-t border-brand-50 flex justify-between text-xs text-gray-600">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {l.totalStudents} alumnos</span>
                  <span className={`font-semibold ${l.averageCompliance > 75 ? 'text-green-600' : l.averageCompliance >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                    {l.averageCompliance}% cumpl.
                  </span>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      {/* Mapa Realtime con filtros integrados en la tarjeta */}
      <StudentLiveMap
        fetchSnapshot={getActiveStudentsSnapshot}
        showCampusFilter
        campusOptions={campusOptions}
        campusFilter={campusFilter}
        onCampusFilterChange={(v) => setMapFilter('campus', v)}
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  danger,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  danger?: boolean;
}) {
  return (
    <Card className={`overflow-hidden border-0 shadow-[0_2px_12px_rgba(26,45,107,0.1)] ${danger ? 'ring-1 ring-red-200' : 'ring-1 ring-brand-100'}`}>
      <div className={`h-1 w-full ${danger ? 'bg-gradient-to-r from-red-400 to-red-600' : 'bg-gradient-to-r from-brand-600 via-brand-700 to-gold-400'}`} />
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
        <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-sm ${danger ? 'bg-gradient-to-br from-red-500 to-red-600' : 'bg-gradient-to-br from-brand-600 to-brand-800'}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${danger ? 'text-red-600' : 'text-brand-800'}`}>{value}</div>
        <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
