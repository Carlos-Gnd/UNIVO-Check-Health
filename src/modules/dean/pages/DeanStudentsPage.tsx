import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { format } from 'date-fns';
import { ArrowUpDown, Download } from 'lucide-react';
import { useDeanStore } from '@/modules/dean/store/useDeanStore';
import type { DeanStudent } from '@/modules/dean/types';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Badge } from '@/shared/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';

const PAGE_SIZE = 10;

export function DeanStudentsPage() {
  const { students, locations, filters, setFilter, selectedStudent, setSelectedStudent } = useDeanStore();
  const [params] = useSearchParams();
  const [sortBy, setSortBy] = useState<keyof DeanStudent>('fullName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const status = params.get('status');
    if (status === 'at-risk') setFilter('status', 'at-risk');
  }, [params, setFilter]);

  const filtered = useMemo(() => {
    let rows = students.filter((student) => {
      const searchOk = `${student.fullName} ${student.carnet}`.toLowerCase().includes(filters.search.toLowerCase());
      const sedeOk = filters.sede === 'all' || student.sedeId === filters.sede;
      const statusOk = filters.status === 'all' || student.status === filters.status;
      return searchOk && sedeOk && statusOk;
    });

    rows = [...rows].sort((a, b) => {
      const left = a[sortBy];
      const right = b[sortBy];
      if (typeof left === 'number' && typeof right === 'number') return sortDir === 'asc' ? left - right : right - left;
      return sortDir === 'asc' ? String(left).localeCompare(String(right)) : String(right).localeCompare(String(left));
    });
    return rows;
  }, [filters, students, sortBy, sortDir]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const toggleSort = (field: keyof DeanStudent) => {
    if (sortBy === field) setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(field); setSortDir('asc'); }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-gray-900">Alumnos</h2>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Input placeholder="Buscar por nombre o carnet" value={filters.search} onChange={(e) => { setFilter('search', e.target.value); setPage(1); }} className="xl:col-span-2" />
        <Select value={filters.sede} onValueChange={(value) => { setFilter('sede', value); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Sede" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas las sedes</SelectItem>{locations.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.status} onValueChange={(value: any) => { setFilter('status', value); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="at-risk">En riesgo (&lt;60%)</SelectItem>
            <SelectItem value="in-progress">En progreso (60-85%)</SelectItem>
            <SelectItem value="completed">Completado (&gt;85%)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.period} onValueChange={(value) => setFilter('period', value)}>
          <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent><SelectItem value="2026-1">2026-1 (actual)</SelectItem><SelectItem value="2025-2">2025-2</SelectItem></SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button variant="outline" className="w-full" onClick={() => console.log('Exportar Excel', filtered)}><Download className="mr-2 h-4 w-4" />Excel</Button>
          <Button variant="outline" className="w-full" onClick={() => console.log('Exportar PDF', filtered)}><Download className="mr-2 h-4 w-4" />PDF</Button>
        </div>
      </div>

      <p className="text-sm text-gray-600">Mostrando {filtered.length} de {students.length} alumnos</p>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[1300px] text-sm">
          <thead className="bg-gray-50">
            <tr>{['#','Carnet','Nombre completo','Sede','Doctor encargado','Horas completadas','Meta','% Cumplimiento','Faltas','Estado','Acciones'].map((head, index) => <th key={head} className="px-3 py-2 text-left font-medium text-gray-600">{index > 0 && index < 10 ? <button onClick={() => toggleSort(['id','carnet','fullName','sedeName','doctorName','completedHours','goalHours','compliancePercentage','absences'][index] as keyof DeanStudent)} className="inline-flex items-center gap-1">{head}<ArrowUpDown className="h-3.5 w-3.5" /></button> : head}</th>)}</tr>
          </thead>
          <tbody>
            {paged.map((student, idx) => (
              <tr key={student.id} className="border-t">
                <td className="px-3 py-2">{(page - 1) * PAGE_SIZE + idx + 1}</td><td className="px-3 py-2">{student.carnet}</td><td className="px-3 py-2">{student.fullName}</td><td className="px-3 py-2">{student.sedeName}</td><td className="px-3 py-2">{student.doctorName}</td><td className="px-3 py-2">{student.completedHours}</td><td className="px-3 py-2">{student.goalHours}</td>
                <td className="px-3 py-2"><div className="flex items-center gap-2"><div className="h-2 w-20 overflow-hidden rounded bg-gray-200"><div className={`h-full ${student.compliancePercentage > 85 ? 'bg-green-600' : student.compliancePercentage >= 60 ? 'bg-amber-500' : 'bg-red-600'}`} style={{ width: `${student.compliancePercentage}%` }} /></div><span className={student.compliancePercentage > 85 ? 'text-green-700' : student.compliancePercentage >= 60 ? 'text-amber-700' : 'text-red-700'}>{student.compliancePercentage}%</span></div></td>
                <td className="px-3 py-2">{student.absences}</td><td className="px-3 py-2"><StatusBadge status={student.status} /></td>
                <td className="px-3 py-2"><Button size="sm" variant="outline" onClick={() => setSelectedStudent(student)}>Ver detalle</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between"><span className="text-sm text-gray-600">Página {page} de {totalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)}>Anterior</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((prev) => prev + 1)}>Siguiente</Button></div></div>

      <StudentDetailModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />
    </div>
  );
}

function StatusBadge({ status }: { status: DeanStudent['status'] }) {
  if (status === 'at-risk') return <Badge className="bg-red-100 text-red-700">En riesgo</Badge>;
  if (status === 'completed') return <Badge className="bg-green-100 text-green-700">Completado</Badge>;
  return <Badge className="bg-amber-100 text-amber-700">En progreso</Badge>;
}

function StudentDetailModal({ student, onClose }: { student: DeanStudent | null; onClose: () => void }) {
  const monthDays = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const attendanceMap = new Map(student?.attendances.map((item) => [Number(item.date.slice(-2)), item.status]));
  return (
    <Dialog open={Boolean(student)} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {student && (<><DialogHeader><DialogTitle>{student.fullName} - {student.carnet}</DialogTitle></DialogHeader>
          <div className="space-y-4 text-sm">
            <p><span className="font-semibold">Carrera:</span> {student.career}</p>
            <p><span className="font-semibold">Sede:</span> {student.sedeName} - {student.doctorName}</p>
            <div className="grid gap-3 md:grid-cols-4"><Info label="Horas" value={student.completedHours} /><Info label="Meta" value={student.goalHours} /><Info label="% Cumplimiento" value={`${student.compliancePercentage}%`} /><Info label="Faltas" value={student.absences} /></div>
            <div><div className="mb-1 flex justify-between"><span>Progreso</span><span>{student.compliancePercentage}%</span></div><div className="h-3 w-full rounded bg-gray-200"><div className={`h-full rounded ${student.compliancePercentage > 85 ? 'bg-green-600' : student.compliancePercentage >= 60 ? 'bg-amber-500' : 'bg-red-600'}`} style={{ width: `${student.compliancePercentage}%` }} /></div></div>
            <div><p className="mb-2 font-semibold">Calendario del mes</p><div className="grid grid-cols-7 gap-1">{Array.from({ length: monthDays }).map((_, idx) => { const day = idx + 1; const status = attendanceMap.get(day); return <div key={day} className={`flex h-8 items-center justify-center rounded text-xs ${status === 'valid' ? 'bg-green-100 text-green-700' : status === 'review' ? 'bg-amber-100 text-amber-700' : status === 'absent' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>{day}</div>; })}</div></div>
            <div><p className="mb-2 font-semibold">Últimas 10 asistencias</p><div className="space-y-2">{student.attendances.slice(0, 10).map((item) => <div key={item.id} className="flex items-center justify-between rounded border px-3 py-2"><span>{format(new Date(item.date), 'dd/MM/yyyy')} {item.checkInTime} - {item.sedeName}</span><Badge className={item.status === 'valid' ? 'bg-green-100 text-green-700' : item.status === 'review' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>{item.status === 'valid' ? 'Válida' : item.status === 'review' ? 'En revisión' : 'Falta'}</Badge></div>)}</div></div>
          </div></>)}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string | number }) { return <div className="rounded border p-2"><p className="text-xs text-gray-500">{label}</p><p className="text-base font-semibold">{value}</p></div>; }
