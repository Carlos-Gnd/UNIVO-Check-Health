import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { fetchRotationsCalendar, type CalendarRole, type RotationWindow } from '../services/rotationsCalendar.service';

type DayItem = {
  studentName: string;
  career: string;
  campusName: string;
  schedule: string;
};

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function buildMonthGrid(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days: Date[] = [];
  let cursor = start;
  while (isBefore(cursor, end) || isSameDay(cursor, end)) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

function dayEntries(date: Date, windows: RotationWindow[]): DayItem[] {
  return windows
    .filter((w) =>
      isWithinInterval(date, { start: parseISO(w.startDate), end: parseISO(w.endDate) }),
    )
    .map((w) => ({
      studentName: w.studentName,
      career: w.career,
      campusName: w.campusName,
      schedule: w.schedule,
    }));
}

export function RotationsCalendarPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<CalendarRole>('SUPERVISOR');
  const [month, setMonth] = useState(new Date());
  const [windows, setWindows] = useState<RotationWindow[]>([]);
  const [campusFilter, setCampusFilter] = useState('all');
  const [careerFilter, setCareerFilter] = useState('all');
  const [campusOptions, setCampusOptions] = useState<{ id: string; name: string }[]>([]);
  const [careerOptions, setCareerOptions] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const data = await fetchRotationsCalendar();
      setRole(data.role);
      setWindows(data.windows);
      setCampusOptions(data.campusOptions);
      setCareerOptions(data.careerOptions);
      setIsLoading(false);
    };
    void load();
  }, []);

  const visibleWindows = useMemo(() => {
    return windows.filter((w) => {
      const campusOk = campusFilter === 'all' || w.campusId === campusFilter;
      const careerOk = careerFilter === 'all' || w.career === careerFilter;
      return campusOk && careerOk;
    });
  }, [campusFilter, careerFilter, windows]);

  const monthDays = useMemo(() => buildMonthGrid(month), [month]);
  const selectedDayEntries = selectedDay ? dayEntries(selectedDay, visibleWindows) : [];
  const today = new Date();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Cargando calendario de rotaciones…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Calendario de rotaciones</h2>
          <p className="text-sm text-gray-600">
            {role === 'STUDENT' && 'Vista mensual de tus rotaciones futuras.'}
            {role === 'SUPERVISOR' && 'Vista mensual de rotaciones de tus alumnos asignados.'}
            {role === 'DEAN' && 'Vista global de rotaciones por sede y carrera.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => subMonths(m, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="min-w-44 text-center text-sm font-medium capitalize">
            {format(month, 'MMMM yyyy', { locale: es })}
          </p>
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {role === 'DEAN' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select value={campusFilter} onValueChange={setCampusFilter}>
            <SelectTrigger><SelectValue placeholder="Filtrar por sede" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las sedes</SelectItem>
              {campusOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={careerFilter} onValueChange={setCareerFilter}>
            <SelectTrigger><SelectValue placeholder="Filtrar por carrera" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las carreras</SelectItem>
              {careerOptions.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Vista mensual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {DAY_NAMES.map((name) => (
              <div key={name} className="text-xs font-medium text-gray-500 text-center">{name}</div>
            ))}
            {monthDays.map((day) => {
              const inMonth = day.getMonth() === month.getMonth();
              const entries = dayEntries(day, visibleWindows);
              const isFutureOrToday = !isBefore(day, new Date(today.getFullYear(), today.getMonth(), today.getDate()));
              const studentEntries = role === 'STUDENT' ? entries.filter(() => isFutureOrToday) : entries;
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => role === 'SUPERVISOR' && setSelectedDay(day)}
                  className={`min-h-28 rounded-lg border p-2 text-left transition-colors ${
                    inMonth ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 text-gray-400'
                  }`}
                >
                  <p className="text-xs font-semibold">{format(day, 'd')}</p>
                  <div className="mt-1 space-y-1">
                    {(role === 'STUDENT' ? studentEntries : entries).slice(0, 2).map((e, idx) => (
                      <div key={`${e.studentName}-${idx}`} className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-800">
                        {role === 'STUDENT' ? e.campusName : e.studentName}
                      </div>
                    ))}
                    {(role === 'STUDENT' ? studentEntries : entries).length > 2 && (
                      <p className="text-[10px] text-gray-500">+{(role === 'STUDENT' ? studentEntries : entries).length - 2} más</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedDay)} onOpenChange={() => setSelectedDay(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Alumnos del {selectedDay ? format(selectedDay, 'dd/MM/yyyy') : ''}
            </DialogTitle>
          </DialogHeader>
          {selectedDayEntries.length === 0 ? (
            <p className="text-sm text-gray-500">No hay rotaciones para este día.</p>
          ) : (
            <div className="space-y-2">
              {selectedDayEntries.map((entry, idx) => (
                <div key={`${entry.studentName}-${idx}`} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-900">{entry.studentName}</p>
                    <Badge variant="outline">{entry.career}</Badge>
                  </div>
                  <p className="text-sm text-gray-600">{entry.campusName}</p>
                  <p className="text-xs text-gray-500">{entry.schedule}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
