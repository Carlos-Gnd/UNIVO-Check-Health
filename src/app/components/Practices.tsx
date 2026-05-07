import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { MapPin, User, Calendar, Clock } from 'lucide-react';
import { getPractices, getAttendance, getStudents } from '../utils/data';
import { Practice } from '../types';
import { format } from 'date-fns';

export function Practices() {
  const [practices, setPractices] = useState<Practice[]>([]);
  const [practiceStats, setPracticeStats] = useState<Record<string, any>>({});

  useEffect(() => {
    const loadedPractices = getPractices();
    const attendance = getAttendance();
    const students = getStudents();

    // Calculate stats for each practice
    const stats: Record<string, any> = {};
    loadedPractices.forEach(practice => {
      const practiceAttendance = attendance.filter(a => a.practiceId === practice.id);
      const uniqueStudents = new Set(practiceAttendance.map(a => a.studentId));
      
      stats[practice.id] = {
        totalAttendance: practiceAttendance.length,
        activeStudents: uniqueStudents.size,
      };
    });

    setPractices(loadedPractices);
    setPracticeStats(stats);
  }, []);

  const getStatusColor = (startDate: string, endDate: string) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (now < start) return 'bg-blue-100 text-blue-800';
    if (now > end) return 'bg-gray-100 text-gray-800';
    return 'bg-green-100 text-green-800';
  };

  const getStatusText = (startDate: string, endDate: string) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (now < start) return 'Próxima';
    if (now > end) return 'Finalizada';
    return 'En Curso';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Prácticas</h2>
        <p className="text-sm text-gray-600 mt-1">
          Gestión de prácticas profesionales del área de salud
        </p>
      </div>

      {/* Practices Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {practices.map((practice) => {
          const stats = practiceStats[practice.id] || { totalAttendance: 0, activeStudents: 0 };
          return (
            <Card key={practice.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{practice.name}</CardTitle>
                    <CardDescription className="mt-2">{practice.description}</CardDescription>
                  </div>
                  <Badge className={getStatusColor(practice.startDate, practice.endDate)}>
                    {getStatusText(practice.startDate, practice.endDate)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Location */}
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{practice.location}</p>
                    <p className="text-xs text-gray-500">Ubicación</p>
                  </div>
                </div>

                {/* Supervisor */}
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{practice.supervisor}</p>
                    <p className="text-xs text-gray-500">Supervisor</p>
                  </div>
                </div>

                {/* Schedule */}
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{practice.schedule}</p>
                    <p className="text-xs text-gray-500">Horario</p>
                  </div>
                </div>

                {/* Dates */}
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {format(new Date(practice.startDate), 'dd/MM/yyyy')} - {format(new Date(practice.endDate), 'dd/MM/yyyy')}
                    </p>
                    <p className="text-xs text-gray-500">Periodo</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-semibold text-blue-900">{stats.activeStudents}</p>
                      <p className="text-xs text-blue-600">Estudiantes</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-semibold text-green-900">{stats.totalAttendance}</p>
                      <p className="text-xs text-green-600">Asistencias</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {practices.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-gray-500">
              No hay prácticas registradas en este momento
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
