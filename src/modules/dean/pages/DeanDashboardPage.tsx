import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Building2, CheckCircle2, ChevronLeft, ChevronRight, Loader2, MapPin, Users } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { useDeanStore } from '@/modules/dean/store/useDeanStore';
import { getActiveStudentsSnapshot } from '@/shared/backend/checkHealthBackend';
import { supabase } from '@/shared/backend/supabaseClient';
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

function LiveMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletInstance = useRef<any>(null);
  const markersLayer = useRef<any>(null);
  const leafletModule = useRef<any>(null);
  const [studentCount, setStudentCount] = useState(0);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  const refreshMarkers = async (L: any) => {
    const students = await getActiveStudentsSnapshot();
    setStudentCount(students.length);
    if (!markersLayer.current) return;
    markersLayer.current.clearLayers();
    students.forEach((s) => {
      if (!s.lastLocation) return;
      L.marker([s.lastLocation.latitude, s.lastLocation.longitude])
        .bindPopup(`<b>${s.studentName}</b><br/>${s.siteName}<br/>${s.hoursToday.toFixed(1)} h hoy`)
        .addTo(markersLayer.current);
    });
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    let isMounted = true;
    import('leaflet').then((L) => {
      if (!isMounted || !mapRef.current || leafletInstance.current) return;
      leafletModule.current = L;
      const map = L.map(mapRef.current, { zoomControl: true }).setView([13.7942, -88.8965], 8);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);
      markersLayer.current = L.layerGroup().addTo(map);
      leafletInstance.current = map;
      void refreshMarkers(L);
      interval = setInterval(() => void refreshMarkers(L), 30000);
    });
    return () => {
      isMounted = false;
      clearInterval(interval);
      leafletInstance.current?.remove();
      leafletInstance.current = null;
      markersLayer.current = null;
      leafletModule.current = null;
    };
  }, []);

  useEffect(() => {
    let refreshTimeout: ReturnType<typeof setTimeout> | undefined;

    const refreshFromRealtime = () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        if (leafletModule.current) void refreshMarkers(leafletModule.current);
      }, 300);
    };

    const channel = supabase
      .channel('dean-live-map-attendances')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendances' },
        refreshFromRealtime,
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      setIsRealtimeConnected(false);
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-600" />Estudiantes activos en tiempo real
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge className={isRealtimeConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
            {isRealtimeConnected ? 'Realtime' : 'Actualizando'}
          </Badge>
          <Badge className="bg-blue-100 text-blue-700">{studentCount} en sedes</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden rounded-b-lg">
        <div ref={mapRef} style={{ height: 320 }} />
      </CardContent>
    </Card>
  );
}

export function DeanDashboardPage() {
  const navigate = useNavigate();
  const { students, locations, globalStats, isLoading, loadData, setFilter } = useDeanStore();
  const [sharedDeviceAlerts, setSharedDeviceAlerts] = useState<SharedDeviceAlert[]>([]);
  const [resolvedAlertIds, setResolvedAlertIds] = useState<Set<string>>(() => readResolvedSharedDeviceAlerts());
  const [riskPage, setRiskPage] = useState(0);

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

  const chartData = useMemo(
    () =>
      locations
        .filter((l) => l.status === 'active')
        .map((l) => ({
          name: l.name.length > 20 ? l.name.slice(0, 18) + '…' : l.name,
          fullName: l.name,
          value: l.averageCompliance,
        })),
    [locations],
  );

  const barColor = (v: number) => (v > 75 ? '#16a34a' : v >= 50 ? '#f59e0b' : '#dc2626');
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
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Dashboard de Decanato</h2>
        <p className="text-sm text-gray-600">Vista general del cumplimiento de prácticas por sede y alumno.</p>
      </div>

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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Alumnos Activos" value={globalStats.totalStudents} subtitle="en prácticas este período" icon={Users} />
        <StatCard title="Tasa de Cumplimiento Global" value={`${globalStats.globalComplianceRate}%`} subtitle="promedio de todos los alumnos" icon={CheckCircle2} />
        <StatCard title="Alumnos en Riesgo" value={globalStats.atRiskCount} subtitle={`menos del ${globalStats.riskThreshold}% de cumplimiento`} icon={AlertTriangle} danger />
        <StatCard title="Sedes Activas" value={globalStats.activeLocations} subtitle="lugares con prácticas este semestre" icon={Building2} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* T-07.2: Cumplimiento por sede */}
        <Card>
          <CardHeader><CardTitle>Cumplimiento por Sede</CardTitle></CardHeader>
          <CardContent className="h-80">
            {chartData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center pt-16">Sin datos de sedes activas</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number, _n, entry: any) => [`${v}%`, entry.payload.fullName]} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                    {chartData.map((item) => <Cell key={item.fullName} fill={barColor(item.value)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* T-19.3: Lista paginada de alumnos en riesgo */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Alumnos en riesgo</CardTitle>
              <p className="text-xs text-gray-500">Umbral configurado: &lt; {globalStats.riskThreshold}%</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setFilter('status', 'at-risk'); navigate('/dean/students?status=at-risk'); }}>
              Ver todos
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {riskStudents.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin alumnos en riesgo</p>
            ) : (
              pagedRiskStudents.map((s) => (
                <div key={s.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{s.fullName}</p>
                      <p className="text-xs text-gray-500">{s.carnet} · {s.sedeName}</p>
                    </div>
                    <Badge className={s.compliancePercentage < 40 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}>
                      {s.compliancePercentage < 40 ? 'Riesgo alto' : 'Riesgo medio'}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    {s.compliancePercentage}% cumplimiento · {s.goalHours - s.completedHours} h faltantes
                  </p>
                  <Button variant="link" className="mt-2 h-auto p-0 text-blue-700" onClick={() => openStudentProfile(s.id)}>
                    Ver perfil
                  </Button>
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

      {/* T-18.1: Mapa de estudiantes activos */}
      <LiveMap />

      {/* T-07.1: Resumen por sede */}
      <Card>
        <CardHeader><CardTitle>Resumen rápido de sedes</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {locations.length === 0 ? (
            <p className="text-sm text-gray-400 col-span-3 text-center py-6">Sin sedes registradas</p>
          ) : (
            locations.map((l) => (
              <button
                key={l.id}
                onClick={() => navigate(`/dean/locations`)}
                className="rounded-lg border p-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-gray-900 truncate">{l.name}</p>
                  <Badge className={l.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}>
                    {l.status === 'active' ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-gray-500 truncate">{l.doctorName}</p>
                <div className="mt-3 flex justify-between text-sm text-gray-600">
                  <span>{l.totalStudents} alumnos</span>
                  <span>{l.averageCompliance}% cumplimiento</span>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm text-gray-600">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${danger ? 'text-red-600' : 'text-blue-600'}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-semibold ${danger ? 'text-red-600' : 'text-gray-900'}`}>{value}</div>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
