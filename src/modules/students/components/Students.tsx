import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Search, Mail, GraduationCap, History, X } from 'lucide-react';
import { getStudents } from '../services/students.service';
import { getAttendance } from '@/modules/attendance/services/attendance.service';
import { Student } from '../types';
import { AttendanceHistory } from './AttendanceHistory';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/shared/components/ui/table';

export function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [studentStats, setStudentStats] = useState<Record<string, { rate: number; totalAttendance: number }>>({});
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  useEffect(() => {
    const load = async () => {
      const [loadedStudents, attendance] = await Promise.all([getStudents(), getAttendance()]);
      const stats: Record<string, { rate: number; totalAttendance: number }> = {};
      loadedStudents.forEach((s) => {
        const sa = attendance.filter((a) => a.studentId === s.id);
        const present = sa.filter((a) => a.status === 'present' || a.status === 'late').length;
        stats[s.id] = {
          totalAttendance: sa.length,
          rate: sa.length > 0 ? Math.round((present / sa.length) * 100) : 0,
        };
      });
      setStudents(loadedStudents);
      setStudentStats(stats);
    };
    void load();
  }, []);

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.carnet.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.career.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const initials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const rateBadgeClass = (r: number) =>
    r >= 90 ? 'bg-green-100 text-green-800' : r >= 75 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Estudiantes</h2>
        <p className="text-sm text-gray-600 mt-1">Gestión de estudiantes en prácticas del área de salud</p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre, carnet o carrera…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Cards — mobile y tablet (<lg) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-4">
        {filtered.map((s) => {
          const stats = studentStats[s.id] ?? { rate: 0, totalAttendance: 0 };
          return (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <Avatar className="w-14 h-14 shrink-0">
                    <AvatarImage src={s.photo} alt={s.name} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-sm">
                      {initials(s.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm leading-tight">{s.name}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">{s.carnet}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <div className="flex items-center gap-2 text-sm">
                  <GraduationCap className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-gray-600 truncate">{s.career}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-gray-600 truncate text-xs">{s.email}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-gray-500">{stats.totalAttendance} registros</span>
                  <Badge className={rateBadgeClass(stats.rate)}>{stats.rate}%</Badge>
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => setSelectedStudent(s)}>
                  <History className="w-4 h-4 mr-2" />Ver historial
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabla — desktop (≥lg) */}
      <Card className="hidden lg:block">
        <CardHeader>
          <CardTitle>Lista de Estudiantes</CardTitle>
          <CardDescription>{filtered.length} encontrados</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Carnet</TableHead>
                  <TableHead>Carrera</TableHead>
                  <TableHead className="hidden xl:table-cell">Email</TableHead>
                  <TableHead>Asistencias</TableHead>
                  <TableHead className="text-right">Tasa</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No se encontraron estudiantes
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((s) => {
                    const stats = studentStats[s.id] ?? { rate: 0, totalAttendance: 0 };
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="shrink-0">
                              <AvatarImage src={s.photo} alt={s.name} />
                              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-xs">
                                {initials(s.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium truncate max-w-[180px]">{s.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{s.carnet}</TableCell>
                        <TableCell className="max-w-[130px] truncate">{s.career}</TableCell>
                        <TableCell className="hidden xl:table-cell text-xs text-gray-500 max-w-[180px] truncate">{s.email}</TableCell>
                        <TableCell>{stats.totalAttendance}</TableCell>
                        <TableCell className="text-right">
                          <Badge className={rateBadgeClass(stats.rate)}>{stats.rate}%</Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(s)} className="text-blue-600 hover:text-blue-800 whitespace-nowrap">
                            <History className="w-4 h-4 mr-1" />Historial
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Panel historial */}
      {selectedStudent && (
        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Historial — {selectedStudent.name}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(null)}>
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <AttendanceHistory studentId={selectedStudent.id} studentName={selectedStudent.name} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
