import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Users, CheckCircle, XCircle, Clock, TrendingUp, Calendar } from 'lucide-react';
import { getStudents } from '@/modules/students/services/students.service';
import { getPractices } from '@/modules/practices/services/practices.service';
import { getAttendance } from '@/modules/attendance/services/attendance.service';
import { getActiveStudentsSnapshot } from '@/shared/backend/checkHealthBackend';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format } from 'date-fns';

export function Dashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalPractices: 0,
    todayAttendance: 0,
    attendanceRate: 0,
  });

  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [activeStudents, setActiveStudents] = useState<any[]>([]);

  useEffect(() => {
    const loadDashboardData = () => {
      const students = getStudents();
      const practices = getPractices();
      const attendance = getAttendance();

      const today = format(new Date(), 'yyyy-MM-dd');
      const todayRecords = attendance.filter(a => a.date === today);
      const presentToday = todayRecords.filter(a => a.status === 'present' || a.status === 'late').length;

      const totalAttendance = attendance.length;
      const presentCount = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
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
        .map(a => {
          const student = students.find(s => s.id === a.studentId);
          const practice = practices.find(p => p.id === a.practiceId);
          return {
            ...a,
            studentName: student?.name || 'Unknown',
            practiceName: practice?.name || 'Unknown',
          };
        });

      setRecentActivity(recent);
      setActiveStudents(getActiveStudentsSnapshot());
    };

    loadDashboardData();
    const intervalId = window.setInterval(loadDashboardData, 30000);

    return () => window.clearInterval(intervalId);
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-600 mt-1">
          Resumen general del sistema de asistencias
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Estudiantes
            </CardTitle>
            <Users className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">{stats.totalStudents}</div>
            <p className="text-xs text-gray-500 mt-1">Activos en prácticas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Asistencias Hoy
            </CardTitle>
            <CheckCircle className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">{stats.todayAttendance}</div>
            <p className="text-xs text-gray-500 mt-1">Registros completados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Prácticas Activas
            </CardTitle>
            <Calendar className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">{stats.totalPractices}</div>
            <p className="text-xs text-gray-500 mt-1">En este semestre</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Tasa de Asistencia
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">{stats.attendanceRate}%</div>
            <p className="text-xs text-gray-500 mt-1">Promedio general</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Asistencias Semanales</CardTitle>
            <CardDescription>Últimos 5 días</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="asistencias" fill="#3b82f6" name="Asistencias" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado de Hoy</CardTitle>
            <CardDescription>Distribución de asistencias</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
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
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Estudiantes Activos</CardTitle>
          <CardDescription>Consulta backend actualizada cada 30 segundos</CardDescription>
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
                  className="grid grid-cols-1 gap-3 rounded-lg bg-gray-50 p-4 md:grid-cols-[1.4fr_1fr_1fr]"
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

      <Card>
        <CardHeader>
          <CardTitle>Actividad Reciente</CardTitle>
          <CardDescription>Últimos registros de asistencia</CardDescription>
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
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      activity.status === 'present' ? 'bg-green-100' :
                      activity.status === 'late' ? 'bg-yellow-100' :
                      'bg-red-100'
                    }`}>
                      {activity.status === 'present' ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : activity.status === 'late' ? (
                        <Clock className="w-5 h-5 text-yellow-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {activity.studentName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {activity.practiceName}
                      </p>
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
