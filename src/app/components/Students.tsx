import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Search, Mail, GraduationCap } from 'lucide-react';
import { getStudents, getAttendance } from '../utils/data';
import { Student } from '../types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

export function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [studentStats, setStudentStats] = useState<Record<string, any>>({});

  useEffect(() => {
    const loadedStudents = getStudents();
    const attendance = getAttendance();

    // Calculate stats for each student
    const stats: Record<string, any> = {};
    loadedStudents.forEach(student => {
      const studentAttendance = attendance.filter(a => a.studentId === student.id);
      const present = studentAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
      const total = studentAttendance.length;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;

      stats[student.id] = {
        totalAttendance: total,
        presentCount: present,
        rate: rate,
      };
    });

    setStudents(loadedStudents);
    setStudentStats(stats);
  }, []);

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.carnet.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.career.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAttendanceColor = (rate: number) => {
    if (rate >= 90) return 'bg-green-100 text-green-800';
    if (rate >= 75) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Estudiantes</h2>
          <p className="text-sm text-gray-600 mt-1">
            Gestión de estudiantes en prácticas del área de salud
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre, carnet o carrera..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Students Grid - Mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-4">
        {filteredStudents.map((student) => {
          const stats = studentStats[student.id] || { rate: 0, totalAttendance: 0 };
          return (
            <Card key={student.id}>
              <CardHeader>
                <div className="flex items-start gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={student.photo} alt={student.name} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                      {getInitials(student.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">{student.name}</CardTitle>
                    <CardDescription>{student.carnet}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <GraduationCap className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{student.career}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600 truncate">{student.email}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-gray-500">Asistencia</span>
                  <Badge className={getAttendanceColor(stats.rate)}>
                    {stats.rate}%
                  </Badge>
                </div>
                <div className="text-xs text-gray-500">
                  {stats.totalAttendance} registros totales
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Students Table - Desktop */}
      <Card className="hidden lg:block">
        <CardHeader>
          <CardTitle>Lista de Estudiantes</CardTitle>
          <CardDescription>
            {filteredStudents.length} estudiantes encontrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estudiante</TableHead>
                <TableHead>Carnet</TableHead>
                <TableHead>Carrera</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Asistencias</TableHead>
                <TableHead className="text-right">Tasa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No se encontraron estudiantes
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((student) => {
                  const stats = studentStats[student.id] || { rate: 0, totalAttendance: 0 };
                  return (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={student.photo} alt={student.name} />
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                              {getInitials(student.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{student.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{student.carnet}</TableCell>
                      <TableCell>{student.career}</TableCell>
                      <TableCell>{student.email}</TableCell>
                      <TableCell>{stats.totalAttendance}</TableCell>
                      <TableCell className="text-right">
                        <Badge className={getAttendanceColor(stats.rate)}>
                          {stats.rate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
