// T-06.3: Historial de asistencias con paginación y filtro por estado
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { CheckCircle, Clock, XCircle, HelpCircle, ChevronDown, History } from 'lucide-react';
import { getAttendance } from '@/modules/attendance/services/attendance.service';
import { getPractices } from '@/modules/practices/services/practices.service';
import { Attendance } from '@/modules/attendance/types';
import { format } from 'date-fns';

const PAGE_SIZE = 10;

const STATUS_LABELS: Record<string, string> = {
  present: 'Validado',
  late: 'Tardanza',
  absent: 'En revisión',
  excused: 'Justificado',
};

const STATUS_COLORS: Record<string, string> = {
  present: 'bg-green-100 text-green-800',
  late: 'bg-yellow-100 text-yellow-800',
  absent: 'bg-red-100 text-red-800',
  excused: 'bg-brand-100 text-brand-800',
};

const STATUS_ICONS: Record<string, JSX.Element> = {
  present: <CheckCircle className="w-4 h-4 text-green-600" />,
  late: <Clock className="w-4 h-4 text-yellow-600" />,
  absent: <XCircle className="w-4 h-4 text-red-600" />,
  excused: <HelpCircle className="w-4 h-4 text-brand-700" />,
};

interface Props {
  studentId: string;
  studentName: string;
}

export function AttendanceHistory({ studentId, studentName }: Props) {
  const [allRecords, setAllRecords] = useState<(Attendance & { practiceName: string })[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    const load = async () => {
      const [attendance, practices] = await Promise.all([getAttendance(), getPractices()]);
      const records = attendance
        .filter(a => a.studentId === studentId)
        .map(a => ({
          ...a,
          practiceName: practices.find(p => p.id === a.practiceId)?.name ?? 'Desconocida',
        }))
        .sort((a, b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime());
      setAllRecords(records);
      setVisibleCount(PAGE_SIZE);
    };
    void load();
  }, [studentId]);

  const filtered = filterStatus === 'all'
    ? allRecords
    : allRecords.filter(r => r.status === filterStatus);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const calculateDuration = (checkIn: string, checkOut?: string) => {
    if (!checkOut) return 'En curso';
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-brand-700" />
              Historial de Asistencias
            </CardTitle>
            <CardDescription>{studentName} · {filtered.length} registros</CardDescription>
          </div>
          <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setVisibleCount(PAGE_SIZE); }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="present">Validado</SelectItem>
              <SelectItem value="late">Tardanza</SelectItem>
              <SelectItem value="absent">En revisión</SelectItem>
              <SelectItem value="excused">Justificado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-8">No hay registros con ese filtro</p>
        ) : (
          <div className="space-y-3">
            {visible.map(record => (
              <div key={record.id} className="flex items-start gap-3 p-3 rounded-lg border border-brand-100 bg-brand-50/40 hover:bg-white transition-colors">
                <div className="mt-0.5">{STATUS_ICONS[record.status]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900 truncate">{record.practiceName}</p>
                    <Badge className={STATUS_COLORS[record.status]}>
                      {STATUS_LABELS[record.status]}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-gray-500">
                    <div>
                      <p className="text-gray-400">Fecha</p>
                      <p className="font-medium text-gray-700">{format(new Date(record.date), 'dd/MM/yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Entrada</p>
                      <p className="font-medium text-gray-700">{format(new Date(record.checkIn), 'HH:mm')}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Duración</p>
                      <p className="font-medium text-gray-700">{calculateDuration(record.checkIn, record.checkOut)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {hasMore && (
              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
              >
                <ChevronDown className="w-4 h-4 mr-2" />
                Cargar más ({filtered.length - visibleCount} restantes)
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
