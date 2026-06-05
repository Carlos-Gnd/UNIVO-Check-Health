import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Users, CheckCircle, XCircle, Clock, TrendingUp, Calendar, MapPin, AlertTriangle, ShieldAlert, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { getStudents } from '@/modules/students/services/students.service';
import { getPractices } from '@/modules/practices/services/practices.service';
import { getAttendance } from '@/modules/attendance/services/attendance.service';
import { getActiveStudentsSnapshot } from '@/shared/backend/checkHealthBackend';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format } from 'date-fns';

// T-07.4 — posiciones geográficas aproximadas de cada sede en El Salvador
const SEDE_POSITIONS: Record<string, { left: string; top: string }> = {
  'Hospital Nacional Rosales':     { left: '42%', top: '52%' },
  'Unidad de Salud Santa Ana':     { left: '14%', top: '38%' },
  'Centro de Rehabilitación UNIVO': { left: '72%', top: '56%' },
};

const DEFAULT_POSITIONS = [
  { left: '25%', top: '40%' },
  { left: '50%', top: '55%' },
  { left: '70%', top: '35%' },
];

type ActiveStudent = {
  studentId: string;
  studentName: string;
  career: string;
  practiceId: string;
  siteName: string;
  checkIn: string;
  hoursToday: number;
  totalCycleHours: number;
};

export function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalPractices: 0,
    todayAttendance: 0,
    attendanceRate: 0,
  });

  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [activeStudents, setActiveStudents] = useState<ActiveStudent[]>([]);

  // T-07.4 — filtros de mapa
  const [sedeFilter, setSedeFilter] = useState('all');
  const [careerFilter, setCareerFilter] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState<ActiveStudent | null>(null);
  const [expandedSede, setExpandedSede] = useState<string | null>(null);

  // T-07.5: indicadores clave del ciclo
  const [cycleIndicators, setCycleIndicators] = useState({
    overallCompliance: 0,
    atRiskStudents: [] as { id: string; name: string; rate: number }[],
    practicesWithIncidents: [] as { name: string; incidents: number }[],
    lastUpdated: '',
  });
  const [riskPanelOpen, setRiskPanelOpen] = useState(false);

  useEffect(() => {
    const loadDashboardData = async () => {
      const [students, practices, attendance] = await Promise.all([
        getStudents(),
        getPractices(),
        getAttendance(),
      ]);

      const today = format(new Date(), 'yyyy-MM-dd');
      const todayRecords = attendance.filter((a) => a.date === today);
      const presentToday = todayRecords.filter((a) => a.status === 'present' || a.status === 'late').length;

      const totalAttendance = attendance.length;
      const presentCount = attendance.filter((a) => a.status === 'present' || a.status === 'late').length;
      const rate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

      setStats({
        totalStudents: students.length,
        totalPractices: practices.length,
        todayAttendance: presentToday,
        attendanceRate: rate,
      });

      const recent = attendance
        .sort((a, b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime())
        .slice(0, 5)
        .map((a) => {
          const student = students.find((s) => s.id === a.studentId);
          const practice = practices.find((p) => p.id === a.practiceId);
          return {
            ...a,
            studentName: student?.name || 'Unknown',
            practiceName: practice?.name || 'Unknown',
          };
        });

      // T-07.5: calcular indicadores clave del ciclo
      const studentRates = students.map((s) => {
        const sa = attendance.filter((a) => a.studentId === s.id);
        const present = sa.filter((a) => a.status === 'present' || a.status === 'late').length;
        const r = sa.length > 0 ? Math.round((present / sa.length) * 100) : 0;
        return { id: s.id, name: s.name, rate: r };
      });
      const atRisk = studentRates.filter((s) => s.rate < 75).sort((a, b) => a.rate - b.rate);
      const practiceIncidents = practices.map((p) => {
        const pa = attendance.filter((a) => a.practiceId === p.id && (a.status === 'absent' || a.status === 'late'));
        return { name: p.name.length > 30 ? p.name.slice(0, 30) + '…' : p.name, incidents: pa.length };
      }).filter((p) => p.incidents > 0).sort((a, b) => b.incidents - a.incidents);
      const overallCompliance = studentRates.length > 0
        ? Math.round(studentRates.reduce((acc, s) => acc + s.rate, 0) / studentRates.length)
        : 0;
      setCycleIndicators({
        overallCompliance,
        atRiskStudents: atRisk,
        practicesWithIncidents: practiceIncidents,
        lastUpdated: format(new Date(), 'HH:mm'),
      });

      setRecentActivity(recent);
      setActiveStudents(await getActiveStudentsSnapshot());
    };

    void loadDashboardData();
    const intervalId = window.setInterval(() => void loadDashboardData(), 30000);
    // T-07.5: los indicadores del ciclo se recalculan cada 5 minutos
    const cycleIntervalId = window.setInterval(async () => {
      const [students, practices, attendance] = await Promise.all([
        getStudents(),
        getPractices(),
        getAttendance(),
      ]);
      const studentRates = students.map((s) => {
        const sa = attendance.filter((a) => a.studentId === s.id);
        const present = sa.filter((a) => a.status === 'present' || a.status === 'late').length;
        const r = sa.length > 0 ? Math.round((present / sa.length) * 100) : 0;
        return { id: s.id, name: s.name, rate: r };
      });
      const atRisk = studentRates.filter((s) => s.rate < 75).sort((a, b) => a.rate - b.rate);
      const practiceIncidents = practices.map((p) => {
        const pa = attendance.filter((a) => a.practiceId === p.id && (a.status === 'absent' || a.status === 'late'));
        return { name: p.name.length > 30 ? p.name.slice(0, 30) + '…' : p.name, incidents: pa.length };
      }).filter((p) => p.incidents > 0).sort((a, b) => b.incidents - a.incidents);
      const overallCompliance = studentRates.length > 0
        ? Math.round(studentRates.reduce((acc, s) => acc + s.rate, 0) / studentRates.length)
        : 0;
      setCycleIndicators({
        overallCompliance,
        atRiskStudents: atRisk,
        practicesWithIncidents: practiceIncidents,
        lastUpdated: format(new Date(), 'HH:mm'),
      });
    }, 300000);
    return () => {
      window.clearInterval(intervalId);
      window.clearInterval(cycleIntervalId);
    };
  }, []);

  const statusData = [
    { name: 'Presente', value: stats.todayAttendance, color: '#10b981' },
    { name: 'Ausente', value: Math.max(0, stats.totalStudents - stats.todayAttendance), color: '#ef4444' },
  ];

  const weeklyData = [
    { day: 'Lun', asistencias: 15 },
    { day: 'Mar', asistencias: 18 },
    { day: 'Mié', asistencias: 16 },
    { day: 'Jue', asistencias: 20 },
    { day: 'Vie', asistencias: 14 },
  ];

  // T-07.4 — opciones únicas de filtros
  const sedeOptions = useMemo(
    () => [...new Set(activeStudents.map((s) => s.siteName))],
    [activeStudents],
  );
  const careerOptions = useMemo(
    () => [...new Set(activeStudents.map((s) => s.career))],
    [activeStudents],
  );

  // T-07.4 — estudiantes filtrados por sede y carrera
  const filteredStudents = useMemo(
    () =>
      activeStudents.filter((s) => {
        const matchSede = sedeFilter === 'all' || s.siteName === sedeFilter;
        const matchCareer = careerFilter === 'all' || s.career === careerFilter;
        return matchSede && matchCareer;
      }),
    [activeStudents, sedeFilter, careerFilter],
  );

  // T-07.4 — agrupa estudiantes filtrados por sede
  const sedeGroups = useMemo(() => {
    const groups: Record<string, ActiveStudent[]> = {};
    filteredStudents.forEach((s) => {
      if (!groups[s.siteName]) groups[s.siteName] = [];
      groups[s.siteName].push(s);
    });
    return Object.entries(groups).map(([siteName, students]) => ({ siteName, students }));
  }, [filteredStudents]);

  const complianceColor = cycleIndicators.overallCompliance >= 85
    ? 'text-green-600' : cycleIndicators.overallCompliance >= 70
    ? 'text-yellow-600' : 'text-red-600';
  const complianceBg = cycleIndicators.overallCompliance >= 85
    ? 'bg-green-50 border-green-200' : cycleIndicators.overallCompliance >= 70
    ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-gradient-to-r from-brand-700 to-brand-800 p-5 shadow-[0_4px_20px_rgba(26,45,107,0.2)] border border-brand-600/40">
        <div className="flex items-center gap-3">
          <div className="w-1 h-10 rounded-full bg-gold-400 shrink-0" />
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-white via-gold-200 to-gold-400 bg-clip-text text-transparent">Dashboard</h2>
            <p className="text-sm text-brand-200 mt-0.5">Resumen general del sistema de asistencias</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="overflow-hidden border-0 shadow-[0_2px_12px_rgba(26,45,107,0.1)] ring-1 ring-brand-100">
          <div className="h-1 w-full bg-gradient-to-r from-brand-600 via-brand-700 to-gold-400" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
            <CardTitle className="text-sm font-medium text-slate-500">Total Estudiantes</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center shadow-sm">
              <Users className="w-4 h-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-brand-800">{stats.totalStudents}</div>
            <p className="text-xs text-slate-400 mt-0.5">Activos en prácticas</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-[0_2px_12px_rgba(26,45,107,0.1)] ring-1 ring-brand-100">
          <div className="h-1 w-full bg-gradient-to-r from-brand-600 via-brand-700 to-gold-400" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
            <CardTitle className="text-sm font-medium text-slate-500">Asistencias Hoy</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center shadow-sm">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-brand-800">{stats.todayAttendance}</div>
            <p className="text-xs text-slate-400 mt-0.5">Registros completados</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-[0_2px_12px_rgba(26,45,107,0.1)] ring-1 ring-brand-100">
          <div className="h-1 w-full bg-gradient-to-r from-brand-600 via-brand-700 to-gold-400" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
            <CardTitle className="text-sm font-medium text-slate-500">Prácticas Activas</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center shadow-sm">
              <Calendar className="w-4 h-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-brand-800">{stats.totalPractices}</div>
            <p className="text-xs text-slate-400 mt-0.5">En este semestre</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-[0_2px_12px_rgba(26,45,107,0.1)] ring-1 ring-brand-100">
          <div className="h-1 w-full bg-gradient-to-r from-brand-600 via-brand-700 to-gold-400" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
            <CardTitle className="text-sm font-medium text-slate-500">Tasa de Asistencia</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center shadow-sm">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-brand-800">{stats.attendanceRate}%</div>
            <p className="text-xs text-slate-400 mt-0.5">Promedio general</p>
          </CardContent>
        </Card>
      </div>


      {/* T-07.5: Tarjetas de indicadores clave del ciclo */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-brand-800 flex items-center gap-2">
            <div className="w-1 h-5 rounded-full bg-gold-500 shrink-0" />
            <Activity className="w-4 h-4 text-brand-700" />
            Indicadores Clave del Ciclo
          </h3>
          <span className="text-xs text-gray-400">
            Actualizado a las {cycleIndicators.lastUpdated} · cada 5 min
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Cumplimiento general */}
          <Card className={`border ${complianceBg}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Cumplimiento General
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-4xl font-bold ${complianceColor}`}>
                {cycleIndicators.overallCompliance}%
              </div>
              <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    cycleIndicators.overallCompliance >= 85 ? 'bg-green-500'
                    : cycleIndicators.overallCompliance >= 70 ? 'bg-yellow-500'
                    : 'bg-red-500'
                  }`}
                  style={{ width: `${cycleIndicators.overallCompliance}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {cycleIndicators.overallCompliance >= 85
                  ? 'Cumplimiento satisfactorio'
                  : cycleIndicators.overallCompliance >= 70
                  ? 'Requiere atención'
                  : 'Cumplimiento crítico'}
              </p>
            </CardContent>
          </Card>

          {/* Estudiantes en riesgo — clic abre panel con lista y acceso a historial */}
          <Card
            className={`border cursor-pointer transition-shadow hover:shadow-md ${
              cycleIndicators.atRiskStudents.length > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
            }`}
            onClick={() => setRiskPanelOpen((prev) => !prev)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Estudiantes en Riesgo
                {cycleIndicators.atRiskStudents.length > 0 && (
                  <Badge className="bg-red-100 text-red-700 ml-auto">{cycleIndicators.atRiskStudents.length}</Badge>
                )}
                {riskPanelOpen
                  ? <ChevronUp className="w-3 h-3 ml-auto text-gray-400" />
                  : <ChevronDown className="w-3 h-3 ml-auto text-gray-400" />
                }
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cycleIndicators.atRiskStudents.length === 0 ? (
                <div className="flex flex-col items-center py-3 text-green-600">
                  <CheckCircle className="w-8 h-8 mb-1" />
                  <p className="text-sm font-medium">Sin estudiantes en riesgo</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {cycleIndicators.atRiskStudents.slice(0, 3).map((s) => (
                    <div key={s.id} className="flex items-center justify-between">
                      <p className="text-sm text-gray-800 truncate flex-1">
                        {s.name.split(' ').slice(0, 2).join(' ')}
                      </p>
                      <Badge className="bg-red-100 text-red-700 shrink-0 ml-2">{s.rate}%</Badge>
                    </div>
                  ))}
                  {cycleIndicators.atRiskStudents.length > 3 && (
                    <p className="text-xs text-gray-400 text-center mt-1">
                      +{cycleIndicators.atRiskStudents.length - 3} más · clic para ver todos
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sedes con más incidencias */}
          <Card className={`border ${
            cycleIndicators.practicesWithIncidents.length > 0 ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'
          }`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-orange-500" />
                Incidencias por Práctica
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cycleIndicators.practicesWithIncidents.length === 0 ? (
                <div className="flex flex-col items-center py-3 text-green-600">
                  <CheckCircle className="w-8 h-8 mb-1" />
                  <p className="text-sm font-medium">Sin incidencias registradas</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {cycleIndicators.practicesWithIncidents.slice(0, 3).map((p, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <p className="text-sm text-gray-800 truncate flex-1">{p.name}</p>
                      <Badge className="bg-orange-100 text-orange-700 shrink-0 ml-2">{p.incidents}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Panel expandible de estudiantes en riesgo con acceso a historial */}
        {riskPanelOpen && cycleIndicators.atRiskStudents.length > 0 && (
          <Card className="mt-3 border border-red-200 bg-red-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-700">
                Lista completa — Estudiantes en Riesgo ({cycleIndicators.atRiskStudents.length})
              </CardTitle>
              <CardDescription>Asistencia menor al 75%</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {cycleIndicators.atRiskStudents.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-red-600" />
                      </div>
                      <p className="text-sm font-medium text-gray-900">{s.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-100 text-red-700">{s.rate}%</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() => {
                          const params = new URLSearchParams({ student: s.id });
                          navigate(`/students?${params.toString()}`);
                        }}
                      >
                        Ver historial
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="overflow-hidden border-brand-100 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-brand-700 via-brand-800 to-brand-700 border-b border-brand-900/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] pb-3">
            <CardTitle className="flex items-center gap-2 text-white">
              <div className="w-1 h-5 rounded-full bg-gold-400 shrink-0" />
              Asistencias Semanales
            </CardTitle>
            <CardDescription className="text-brand-200">Últimos 5 días</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] sm:h-[260px] md:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="asistencias" fill="var(--ch-navy-500)" name="Asistencias" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-brand-100 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-brand-700 via-brand-800 to-brand-700 border-b border-brand-900/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] pb-3">
            <CardTitle className="flex items-center gap-2 text-white">
              <div className="w-1 h-5 rounded-full bg-gold-400 shrink-0" />
              Estado de Hoy
            </CardTitle>
            <CardDescription className="text-brand-200">Distribución de asistencias</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] sm:h-[260px] md:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* T-07.4 — Mapa de estudiantes activos por sede */}
      <Card className="overflow-hidden border-brand-100 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-brand-700 via-brand-800 to-brand-700 border-b border-brand-900/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <div className="w-1 h-5 rounded-full bg-gold-400 shrink-0" />
                <MapPin className="w-4 h-4 text-gold-300" />
                Estudiantes Activos por Sede
              </CardTitle>
              <CardDescription className="text-brand-200">
                Jornadas en curso · actualiza cada 30 segundos
              </CardDescription>
            </div>
            {/* Filtros — afectan mapa e indicadores simultáneamente */}
            <div className="flex flex-wrap gap-2">
              <Select value={sedeFilter} onValueChange={(v) => { setSedeFilter(v); setExpandedSede(null); }}>
                <SelectTrigger className="w-full sm:w-40 h-8 text-xs bg-white/10 border-white/20 text-white hover:bg-white/15">
                  <SelectValue placeholder="Sede" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las sedes</SelectItem>
                  {sedeOptions.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={careerFilter} onValueChange={(v) => { setCareerFilter(v); setExpandedSede(null); }}>
                <SelectTrigger className="w-full sm:w-40 h-8 text-xs bg-white/10 border-white/20 text-white hover:bg-white/15">
                  <SelectValue placeholder="Carrera" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las carreras</SelectItem>
                  {careerOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <MapPin className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No hay estudiantes con jornada activa</p>
            </div>
          ) : (
            <>
              {/* Mapa esquemático con sedes posicionadas geográficamente */}
              <div className="relative h-48 sm:h-64 rounded-lg overflow-hidden border bg-[#eef4ee] mb-4">
                {/* Fondo topográfico simplificado */}
                <svg
                  className="absolute inset-0 w-full h-full"
                  viewBox="0 0 400 200"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <rect width="400" height="200" fill="#eef4ee" />
                  <path d="M0,80 Q60,55 130,65 Q200,75 260,58 Q320,42 400,60 L400,200 L0,200 Z" fill="#d4e8d4" opacity="0.6" />
                  <path d="M0,130 Q80,115 160,122 Q240,130 310,115 Q360,105 400,118 L400,200 L0,200 Z" fill="#c3ddc3" opacity="0.4" />
                  {/* Líneas de referencia sutiles */}
                  <line x1="0" y1="100" x2="400" y2="100" stroke="#b2d0b2" strokeWidth="0.5" strokeDasharray="6 4" />
                  <line x1="200" y1="0" x2="200" y2="200" stroke="#b2d0b2" strokeWidth="0.5" strokeDasharray="6 4" />
                </svg>

                {/* Pins de sede */}
                {sedeGroups.map((group, idx) => {
                  const pos = SEDE_POSITIONS[group.siteName] ?? DEFAULT_POSITIONS[idx % DEFAULT_POSITIONS.length];
                  const isExpanded = expandedSede === group.siteName;
                  return (
                    <div
                      key={group.siteName}
                      className="absolute"
                      style={{ left: pos.left, top: pos.top, transform: 'translate(-50%, -50%)', zIndex: isExpanded ? 20 : 10 }}
                    >
                      {/* Pulso animado para sedes con estudiantes activos */}
                      <span className="absolute inset-0 rounded-full bg-brand-400 opacity-20 animate-ping" />
                      <div
                        className={`relative rounded-xl border-2 shadow-md cursor-pointer transition-all duration-200 bg-white ${
                          isExpanded ? 'border-brand-700 shadow-lg' : 'border-brand-400 hover:border-brand-700'
                        }`}
                        onClick={() => setExpandedSede(isExpanded ? null : group.siteName)}
                      >
                        <div className="px-3 py-2 min-w-[120px]">
                          <p className="text-xs font-bold text-gray-900 truncate max-w-[130px]">
                            {group.siteName.replace(/^(Hospital|Unidad de Salud|Centro de) /, '')}
                          </p>
                          <p className="text-xs text-brand-700 font-semibold">
                            {group.students.length} activo{group.students.length !== 1 ? 's' : ''}
                          </p>
                          {/* Lista compacta de estudiantes */}
                          {isExpanded && (
                            <div className="mt-1.5 space-y-1 border-t pt-1.5">
                              {group.students.map((s) => (
                                <button
                                  key={s.studentId}
                                  className="block w-full text-left text-xs text-gray-700 hover:text-brand-700 truncate"
                                  onClick={(e) => { e.stopPropagation(); setSelectedStudent(s); }}
                                >
                                  • {s.studentName.split(' ').slice(0, 2).join(' ')}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Leyenda de sedes */}
              <div className="flex flex-wrap gap-2">
                {sedeGroups.map((group) => (
                  <Badge key={group.siteName} className="bg-brand-50 text-brand-700 border border-brand-200 text-xs font-normal">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500 inline-block mr-1.5" />
                    {group.siteName} · {group.students.length}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* T-07.4 — Modal de detalle del estudiante */}
      <Dialog open={Boolean(selectedStudent)} onOpenChange={() => setSelectedStudent(null)}>
        <DialogContent className="sm:max-w-sm">
          {selectedStudent && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedStudent.studentName}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500 mb-1">Carrera</p>
                    <p className="font-medium text-gray-900">{selectedStudent.career}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500 mb-1">Sede</p>
                    <p className="font-medium text-gray-900 text-xs leading-tight">{selectedStudent.siteName}</p>
                  </div>
                  <div className="rounded-lg bg-brand-50 p-3">
                    <p className="text-xs text-brand-700 mb-1">Horas hoy</p>
                    <p className="text-xl font-bold text-brand-700">{selectedStudent.hoursToday.toFixed(2)} h</p>
                  </div>
                  <div className="rounded-lg bg-green-50 p-3">
                    <p className="text-xs text-green-600 mb-1">Total ciclo</p>
                    <p className="text-xl font-bold text-green-700">{selectedStudent.totalCycleHours.toFixed(1)} h</p>
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Estado del registro</p>
                    <Badge className="bg-green-100 text-green-700">Jornada activa</Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">Entrada</p>
                    <p className="font-mono text-sm font-semibold text-gray-800">
                      {format(new Date(selectedStudent.checkIn), 'HH:mm')}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Estudiantes Activos (lista) */}
      <Card className="overflow-hidden border-brand-100 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-brand-700 via-brand-800 to-brand-700 border-b border-brand-900/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] pb-3">
          <CardTitle className="flex items-center gap-2 text-white">
            <div className="w-1 h-5 rounded-full bg-gold-400 shrink-0" />
            Estudiantes Activos
          </CardTitle>
          <CardDescription className="text-brand-200">Consulta backend actualizada cada 30 segundos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activeStudents.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No hay estudiantes activos en este momento
              </p>
            ) : (
              activeStudents.map((student) => (
                <div
                  key={`${student.studentId}-${student.practiceId}`}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg bg-brand-50/40 p-4"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{student.studentName}</p>
                    <p className="text-xs text-gray-500">{student.career}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Sede</p>
                    <p className="text-sm font-medium text-gray-900">{student.siteName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Jornada de hoy</p>
                    <p className="text-sm font-medium text-gray-900">{student.hoursToday.toFixed(2)} h</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-brand-100 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-brand-700 via-brand-800 to-brand-700 border-b border-brand-900/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] pb-3">
          <CardTitle className="flex items-center gap-2 text-white">
            <div className="w-1 h-5 rounded-full bg-gold-400 shrink-0" />
            Actividad Reciente
          </CardTitle>
          <CardDescription className="text-brand-200">Últimos registros de asistencia</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No hay registros recientes
              </p>
            ) : (
              recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-4 bg-brand-50/40 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        activity.status === 'present'
                          ? 'bg-green-100'
                          : activity.status === 'late'
                            ? 'bg-yellow-100'
                            : 'bg-red-100'
                      }`}
                    >
                      {activity.status === 'present' ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : activity.status === 'late' ? (
                        <Clock className="w-5 h-5 text-yellow-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{activity.studentName}</p>
                      <p className="text-xs text-gray-500">{activity.practiceName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {format(new Date(activity.checkIn), 'HH:mm')}
                    </p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(activity.checkIn), 'dd/MM/yyyy')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
