import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Download, Filter } from 'lucide-react';
import { getStudents, getPractices, getAttendance } from '../utils/data';
import { AttendanceRecord } from '../types';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

export function Reports() {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>([]);
  const [filterStudent, setFilterStudent] = useState('all');
  const [filterPractice, setFilterPractice] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [students, setStudents] = useState(getStudents());
  const [practices, setPractices] = useState(getPractices());

  useEffect(() => {
    loadAttendanceRecords();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filterStudent, filterPractice, filterStatus, attendanceRecords]);

  const loadAttendanceRecords = () => {
    const attendance = getAttendance();
    const students = getStudents();
    const practices = getPractices();

    const records: AttendanceRecord[] = attendance.map(a => {
      const student = students.find(s => s.id === a.studentId);
      const practice = practices.find(p => p.id === a.practiceId);
      return {
        ...a,
        studentName: student?.name || 'Desconocido',
        practiceName: practice?.name || 'Desconocido',
      };
    });

    setAttendanceRecords(records.sort((a, b) => 
      new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime()
    ));
  };

  const applyFilters = () => {
    let filtered = [...attendanceRecords];

    if (filterStudent !== 'all') {
      filtered = filtered.filter(r => r.studentId === filterStudent);
    }

    if (filterPractice !== 'all') {
      filtered = filtered.filter(r => r.practiceId === filterPractice);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }

    setFilteredRecords(filtered);
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      present: 'bg-green-100 text-green-800',
      late: 'bg-yellow-100 text-yellow-800',
      absent: 'bg-red-100 text-red-800',
      excused: 'bg-blue-100 text-blue-800',
    };

    const labels = {
      present: 'Presente',
      late: 'Tardanza',
      absent: 'Ausente',
      excused: 'Justificado',
    };

    return (
      <Badge className={colors[status as keyof typeof colors]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const calculateDuration = (checkIn: string, checkOut?: string) => {
    if (!checkOut) return 'En curso';
    
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const handleExport = () => {
    // Simple CSV export
    const headers = ['Fecha', 'Estudiante', 'Práctica', 'Entrada', 'Salida', 'Duración', 'Estado'];
    const rows = filteredRecords.map(r => [
      format(new Date(r.date), 'dd/MM/yyyy'),
      r.studentName,
      r.practiceName,
      format(new Date(r.checkIn), 'HH:mm'),
      r.checkOut ? format(new Date(r.checkOut), 'HH:mm') : 'N/A',
      calculateDuration(r.checkIn, r.checkOut),
      r.status,
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-asistencias-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Reportes</h2>
          <p className="text-sm text-gray-600 mt-1">
            Análisis detallado de asistencias y registros
          </p>
        </div>
        <Button onClick={handleExport} variant="outline" className="w-full sm:w-auto">
          <Download className="w-4 h-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
          <CardDescription>Filtra los registros por diferentes criterios</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filter-student">Estudiante</Label>
              <Select value={filterStudent} onValueChange={setFilterStudent}>
                <SelectTrigger id="filter-student">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-practice">Práctica</Label>
              <Select value={filterPractice} onValueChange={setFilterPractice}>
                <SelectTrigger id="filter-practice">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {practices.map((practice) => (
                    <SelectItem key={practice.id} value={practice.id}>
                      {practice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-status">Estado</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger id="filter-status">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="present">Presente</SelectItem>
                  <SelectItem value="late">Tardanza</SelectItem>
                  <SelectItem value="absent">Ausente</SelectItem>
                  <SelectItem value="excused">Justificado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-semibold text-gray-900">{filteredRecords.length}</p>
              <p className="text-sm text-gray-600 mt-1">Total Registros</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-semibold text-green-600">
                {filteredRecords.filter(r => r.status === 'present').length}
              </p>
              <p className="text-sm text-gray-600 mt-1">Presentes</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-semibold text-yellow-600">
                {filteredRecords.filter(r => r.status === 'late').length}
              </p>
              <p className="text-sm text-gray-600 mt-1">Tardanzas</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-semibold text-red-600">
                {filteredRecords.filter(r => r.status === 'absent').length}
              </p>
              <p className="text-sm text-gray-600 mt-1">Ausentes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registros de Asistencia</CardTitle>
          <CardDescription>
            {filteredRecords.length} registros encontrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden lg:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Práctica</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Salida</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No se encontraron registros
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        {format(new Date(record.date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">{record.studentName}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {record.practiceName}
                      </TableCell>
                      <TableCell>{format(new Date(record.checkIn), 'HH:mm')}</TableCell>
                      <TableCell>
                        {record.checkOut ? format(new Date(record.checkOut), 'HH:mm') : '-'}
                      </TableCell>
                      <TableCell>{calculateDuration(record.checkIn, record.checkOut)}</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 lg:hidden">
            {filteredRecords.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No se encontraron registros
              </div>
            ) : (
              filteredRecords.map((record) => (
                <div key={record.id} className="rounded-lg border border-gray-200 p-4 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{record.studentName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{record.practiceName}</p>
                    </div>
                    {getStatusBadge(record.status)}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-gray-500">Fecha</p>
                      <p className="text-gray-900 font-medium">{format(new Date(record.date), 'dd/MM/yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Duración</p>
                      <p className="text-gray-900 font-medium">{calculateDuration(record.checkIn, record.checkOut)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Entrada</p>
                      <p className="text-gray-900 font-medium">{format(new Date(record.checkIn), 'HH:mm')}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Salida</p>
                      <p className="text-gray-900 font-medium">
                        {record.checkOut ? format(new Date(record.checkOut), 'HH:mm') : '-'}
                      </p>
                    </div>
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
