import { AlertTriangle, Building2, CheckCircle2, LayoutDashboard, Users } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { useDeanStore } from '@/modules/dean/store/useDeanStore';

export function DeanDashboardPage() {
  const navigate = useNavigate();
  const { students, locations, globalStats, setFilter } = useDeanStore();

  const riskStudents = useMemo(
    () => [...students].filter((student) => student.compliancePercentage < 60).sort((a, b) => a.compliancePercentage - b.compliancePercentage).slice(0, 5),
    [students],
  );

  const chartData = useMemo(() => locations.map((location) => ({ name: location.name.replace('Hospital Nacional ', ''), fullName: location.name, value: location.averageCompliance })), [locations]);

  const barColor = (value: number) => (value > 75 ? '#16a34a' : value >= 50 ? '#f59e0b' : '#dc2626');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Dashboard de Decanato</h2>
        <p className="text-sm text-gray-600">Vista general del cumplimiento de prácticas por sede y alumno.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Alumnos Activos" value={globalStats.totalStudents} subtitle="en prácticas este período" icon={Users} />
        <StatCard title="Tasa de Cumplimiento Global" value={`${globalStats.globalComplianceRate}%`} subtitle="promedio de todos los alumnos" icon={CheckCircle2} />
        <StatCard title="Alumnos en Riesgo" value={globalStats.atRiskCount} subtitle="menos del 60% de cumplimiento" icon={AlertTriangle} danger />
        <StatCard title="Sedes Activas" value={globalStats.activeLocations} subtitle="lugares con prácticas este semestre" icon={Building2} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Cumplimiento por Sede</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <XAxis type="number" domain={[0, 100]} />
                <YAxis type="category" dataKey="name" width={170} />
                <Tooltip formatter={(value: number, _name, entry: any) => [`${value}%`, entry.payload.fullName]} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                  {chartData.map((item) => <Cell key={item.fullName} fill={barColor(item.value)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Alumnos en riesgo</CardTitle>
            <Button variant="outline" size="sm" onClick={() => { setFilter('status', 'at-risk'); navigate('/dean/students?status=at-risk'); }}>Ver todos</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {riskStudents.map((student) => (
              <div key={student.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">{student.fullName}</p>
                    <p className="text-xs text-gray-500">{student.sedeName}</p>
                  </div>
                  <Badge className={student.compliancePercentage < 40 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}>
                    {student.compliancePercentage < 40 ? 'Riesgo alto' : 'Riesgo medio'}
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  {student.compliancePercentage}% cumplimiento • {student.goalHours - student.completedHours} horas faltantes
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Resumen rápido de sedes</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {locations.map((location) => (
            <button key={location.id} onClick={() => navigate(`/dean/locations?location=${location.id}`)} className="rounded-lg border p-4 text-left hover:bg-gray-50">
              <p className="font-medium text-gray-900">{location.name}</p>
              <p className="mt-1 text-xs text-gray-500">{location.doctorName}</p>
              <div className="mt-3 flex justify-between text-sm text-gray-600">
                <span>{location.totalStudents} alumnos</span>
                <span>{location.averageCompliance}%</span>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, danger }: any) {
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
