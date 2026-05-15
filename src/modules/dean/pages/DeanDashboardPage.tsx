import { useEffect, useMemo } from 'react';
import { AlertTriangle, Building2, CheckCircle2, Loader2, Users } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { useDeanStore } from '@/modules/dean/store/useDeanStore';

export function DeanDashboardPage() {
  const navigate = useNavigate();
  const { students, locations, globalStats, isLoading, loadData, setFilter } = useDeanStore();

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const riskStudents = useMemo(
    () =>
      [...students]
        .filter((s) => s.compliancePercentage < 60)
        .sort((a, b) => a.compliancePercentage - b.compliancePercentage)
        .slice(0, 5),
    [students],
  );

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

      {/* T-07.5: Tarjetas de indicadores */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Alumnos Activos" value={globalStats.totalStudents} subtitle="en prácticas este período" icon={Users} />
        <StatCard title="Tasa de Cumplimiento Global" value={`${globalStats.globalComplianceRate}%`} subtitle="promedio de todos los alumnos" icon={CheckCircle2} />
        <StatCard title="Alumnos en Riesgo" value={globalStats.atRiskCount} subtitle="menos del 60% de cumplimiento" icon={AlertTriangle} danger />
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

        {/* T-07.2: Alumnos en riesgo */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Alumnos en riesgo</CardTitle>
            <Button variant="outline" size="sm" onClick={() => { setFilter('status', 'at-risk'); navigate('/dean/students'); }}>
              Ver todos
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {riskStudents.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin alumnos en riesgo</p>
            ) : (
              riskStudents.map((s) => (
                <div key={s.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{s.fullName}</p>
                      <p className="text-xs text-gray-500">{s.sedeName}</p>
                    </div>
                    <Badge className={s.compliancePercentage < 40 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}>
                      {s.compliancePercentage < 40 ? 'Riesgo alto' : 'Riesgo medio'}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    {s.compliancePercentage}% cumplimiento · {s.goalHours - s.completedHours} h faltantes
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

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
