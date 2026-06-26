import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Search, Mail, GraduationCap, History, X } from 'lucide-react';
import { getStudents } from '../services/students.service';
import { getAttendance } from '@/modules/attendance/services/attendance.service';
import { Student } from '../types';
import { AttendanceHistory } from './AttendanceHistory';
import { PageHeader } from '@/shared/components/PageHeader';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/shared/components/ui/table';

export function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [careerFilter, setCareerFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [sedeFilter, setSedeFilter] = useState('all');
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

  // Opciones de filtro derivadas de los alumnos cargados.
  const careerOptions = useMemo(() => Array.from(new Set(students.map((s) => s.career).filter(Boolean))).sort(), [students]);
  const levelOptions = useMemo(() => Array.from(new Set(students.map((s) => s.academicLevel).filter((l): l is number => l != null))).sort((a, b) => a - b), [students]);
  const sedeOptions = useMemo(() => Array.from(new Set(students.flatMap((s) => s.sedes))).sort(), [students]);

  const filtered = students.filter((s) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      s.name.toLowerCase().includes(term) ||
      s.carnet.toLowerCase().includes(term) ||
      s.career.toLowerCase().includes(term);
    const matchesCareer = careerFilter === 'all' || s.career === careerFilter;
    const matchesLevel = levelFilter === 'all' || String(s.academicLevel) === levelFilter;
    const matchesSede = sedeFilter === 'all' || s.sedes.includes(sedeFilter);
    return matchesSearch && matchesCareer && matchesLevel && matchesSede;
  });

  const initials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const rateBadgeClass = (r: number) =>
    r >= 90 ? 'bg-green-100 text-green-800' : r >= 75 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';

  return (
    <div className="space-y-6">
      <PageHeader title="Estudiantes" description="Gestión de estudiantes en prácticas del área de salud." />

      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-400" />
            <Input
              placeholder="Buscar por nombre, carnet o carrera…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Select value={careerFilter} onValueChange={setCareerFilter}>
              <SelectTrigger><SelectValue placeholder="Carrera" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las carreras</SelectItem>
                {careerOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger><SelectValue placeholder="Ciclo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los ciclos</SelectItem>
                {levelOptions.map((l) => <SelectItem key={l} value={String(l)}>Ciclo {l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sedeFilter} onValueChange={setSedeFilter}>
              <SelectTrigger><SelectValue placeholder="Sede" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las sedes</SelectItem>
                {sedeOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {(careerFilter !== 'all' || levelFilter !== 'all' || sedeFilter !== 'all' || searchTerm) && (
            <button
              type="button"
              onClick={() => { setSearchTerm(''); setCareerFilter('all'); setLevelFilter('all'); setSedeFilter('all'); }}
              className="text-xs text-brand-600 hover:underline flex items-center gap-1"
            >
              <X className="w-3 h-3" />Limpiar filtros · {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            </button>
          )}
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
                    <AvatarFallback className="bg-gradient-to-br from-brand-500 to-brand-300 text-white text-sm">
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
                  <GraduationCap className="w-4 h-4 text-brand-400 shrink-0" />
                  <span className="text-gray-600 truncate">{s.career}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-brand-400 shrink-0" />
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
                              <AvatarFallback className="bg-gradient-to-br from-brand-500 to-brand-300 text-white text-xs">
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
                          <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(s)} className="text-brand-700 hover:text-brand-900 whitespace-nowrap">
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
        <Card className="border-brand-200">
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
