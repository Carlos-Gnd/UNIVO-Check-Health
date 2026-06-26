import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { MapPin, User, Calendar, Clock, Users } from 'lucide-react';
import { getPractices, getStudentsByCampus, type AssignedStudent } from '../services/practices.service';
import { getAttendance } from '@/modules/attendance/services/attendance.service';
import { PageHeader } from '@/shared/components/PageHeader';
import { Practice } from '../types';
import { format } from 'date-fns';

export function Practices() {
  const [practices, setPractices] = useState<Practice[]>([]);
  const [practiceStats, setPracticeStats] = useState<Record<string, { totalAttendance: number; activeStudents: number }>>({});
  const [studentsByCampus, setStudentsByCampus] = useState<Map<string, AssignedStudent[]>>(new Map());

  useEffect(() => {
    const load = async () => {
      const [loadedPractices, attendance, byCampus] = await Promise.all([
        getPractices(), getAttendance(), getStudentsByCampus(),
      ]);
      const stats: Record<string, { totalAttendance: number; activeStudents: number }> = {};
      loadedPractices.forEach((p) => {
        const pa = attendance.filter((a) => a.practiceId === p.id);
        stats[p.id] = {
          totalAttendance: pa.length,
          activeStudents: new Set(pa.map((a) => a.studentId)).size,
        };
      });
      setPractices(loadedPractices);
      setPracticeStats(stats);
      setStudentsByCampus(byCampus);
    };
    void load();
  }, []);

  const statusColor = (start: string, end: string) => {
    const now = new Date();
    if (now < new Date(start)) return 'bg-brand-100 text-brand-800';
    if (now > new Date(end)) return 'bg-gray-100 text-gray-800';
    return 'bg-green-100 text-green-800';
  };

  const statusText = (start: string, end: string) => {
    const now = new Date();
    if (now < new Date(start)) return 'Próxima';
    if (now > new Date(end)) return 'Finalizada';
    return 'En Curso';
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Prácticas" description="Sedes de práctica con sus alumnos asignados y actividad." />

      {practices.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-gray-500">No hay prácticas registradas en este momento</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {practices.map((p) => {
          const stats = practiceStats[p.id] ?? { totalAttendance: 0, activeStudents: 0 };
          const assigned = studentsByCampus.get(p.id) ?? [];
          return (
            <Card key={p.id} className="hover:shadow-lg transition-shadow flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base leading-tight">{p.name}</CardTitle>
                    {p.description && (
                      <CardDescription className="mt-1.5 text-xs line-clamp-2">{p.description}</CardDescription>
                    )}
                  </div>
                  <Badge className={`${statusColor(p.startDate, p.endDate)} shrink-0`}>
                    {statusText(p.startDate, p.endDate)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 flex-1">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-brand-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.location}</p>
                    <p className="text-xs text-gray-500">Ubicación</p>
                  </div>
                </div>

                {p.supervisor && (
                  <div className="flex items-start gap-2.5">
                    <User className="w-4 h-4 text-brand-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.supervisor}</p>
                      <p className="text-xs text-gray-500">Supervisor</p>
                    </div>
                  </div>
                )}

                {p.schedule && (
                  <div className="flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-brand-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{p.schedule}</p>
                      <p className="text-xs text-gray-500">Horario</p>
                    </div>
                  </div>
                )}

                {p.startDate && p.endDate && (
                  <div className="flex items-start gap-2.5">
                    <Calendar className="w-4 h-4 text-brand-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {format(new Date(p.startDate), 'dd/MM/yyyy')} — {format(new Date(p.endDate), 'dd/MM/yyyy')}
                      </p>
                      <p className="text-xs text-gray-500">Período</p>
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-gray-100 grid grid-cols-3 gap-2">
                  <div className="text-center p-2 bg-brand-50 rounded-lg">
                    <p className="text-lg font-semibold text-brand-900">{assigned.length}</p>
                    <p className="text-[11px] text-brand-700">Asignados</p>
                  </div>
                  <div className="text-center p-2 bg-amber-50 rounded-lg">
                    <p className="text-lg font-semibold text-amber-900">{stats.activeStudents}</p>
                    <p className="text-[11px] text-amber-700">Con registro</p>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded-lg">
                    <p className="text-lg font-semibold text-green-900">{stats.totalAttendance}</p>
                    <p className="text-[11px] text-green-600">Asistencias</p>
                  </div>
                </div>

                {/* Alumnos asignados a esta sede */}
                <div className="pt-1">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
                    <Users className="w-3.5 h-3.5 text-brand-500" />
                    Alumnos asignados
                  </div>
                  {assigned.length === 0 ? (
                    <p className="text-xs text-gray-400">Sin alumnos asignados a esta sede.</p>
                  ) : (
                    <ul className="space-y-1 max-h-40 overflow-y-auto">
                      {assigned.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate text-gray-700">{s.name}</span>
                          <span className="font-mono text-[10px] text-gray-400 shrink-0">{s.code}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
