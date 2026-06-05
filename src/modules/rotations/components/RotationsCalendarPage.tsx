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
import { ChevronLeft, ChevronRight, Download, FileText, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

// JS getDay() es 0=domingo..6=sábado; lo paso a ISO 1=lunes..7=domingo.
function isoWeekday(date: Date): number {
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

function dayEntries(date: Date, windows: RotationWindow[]): DayItem[] {
  const iso = isoWeekday(date);
  return windows
    .filter((w) =>
      isWithinInterval(date, { start: parseISO(w.startDate), end: parseISO(w.endDate) }) &&
      w.weekdays.includes(iso),
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

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const dateStr = format(new Date(), 'dd/MM/yyyy');

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('UNIVO Check-Health — Calendario de Rotaciones', 14, 16);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado: ${dateStr}  |  Rotaciones: ${visibleWindows.length}`, 14, 23);

    autoTable(doc, {
      startY: 28,
      head: [['Alumno', 'Carrera', 'Sede', 'Supervisor', 'Horario', 'Inicio', 'Fin']],
      body: visibleWindows.map((w) => [
        w.studentName, w.career, w.campusName, w.supervisorName,
        w.schedule, w.startDate, w.endDate,
      ]),
      headStyles: { fillColor: [30, 58, 107], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 245, 250] },
    });

    doc.save(`rotaciones_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const exportXlsx = async () => {
    const { utils, writeFile } = await import('xlsx');
    const data = visibleWindows.map((w) => ({
      Alumno: w.studentName,
      Carrera: w.career,
      Sede: w.campusName,
      Supervisor: w.supervisorName,
      Horario: w.schedule,
      'Fecha inicio': w.startDate,
      'Fecha fin': w.endDate,
    }));
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Rotaciones');
    writeFile(wb, `rotaciones_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

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
      <div className="rounded-xl bg-gradient-to-r from-brand-700 to-brand-800 p-5 shadow-[0_4px_20px_rgba(26,45,107,0.2)] border border-brand-600/40">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-10 rounded-full bg-gold-400 shrink-0" />
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-white via-gold-200 to-gold-400 bg-clip-text text-transparent">Calendario de rotaciones</h2>
              <p className="text-sm text-brand-200 mt-0.5">
                {role === 'STUDENT' && 'Vista mensual de tus rotaciones futuras.'}
                {role === 'SUPERVISOR' && 'Vista mensual de rotaciones de tus alumnos asignados.'}
                {role === 'DEAN' && 'Vista global de rotaciones por sede y carrera.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportPdf} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              <FileText className="h-4 w-4 mr-1.5" />PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => void exportXlsx()} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              <Download className="h-4 w-4 mr-1.5" />Excel
            </Button>
            <div className="flex items-center gap-2 ml-auto md:ml-0">
              <Button variant="outline" size="icon" onClick={() => setMonth((m) => subMonths(m, 1))} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="min-w-32 sm:min-w-44 text-center text-sm font-medium capitalize text-white">
                {format(month, 'MMMM yyyy', { locale: es })}
              </p>
              <Button variant="outline" size="icon" onClick={() => setMonth((m) => addMonths(m, 1))} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
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
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {DAY_NAMES.map((name) => (
              <div key={name} className="text-[10px] sm:text-xs font-medium text-gray-500 text-center">{name}</div>
            ))}
            {monthDays.map((day) => {
              const inMonth = day.getMonth() === month.getMonth();
              const entries = dayEntries(day, visibleWindows);
              const isFutureOrToday = !isBefore(day, new Date(today.getFullYear(), today.getMonth(), today.getDate()));
              const studentEntries = role === 'STUDENT' ? entries.filter(() => isFutureOrToday) : entries;
              const dayList = role === 'STUDENT' ? studentEntries : entries;
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => dayList.length > 0 && setSelectedDay(day)}
                  disabled={dayList.length === 0}
                  className={`min-h-16 sm:min-h-28 rounded-lg border p-1 sm:p-2 text-left transition-colors ${
                    inMonth ? 'bg-white' : 'bg-brand-50/20 text-gray-400'
                  } ${dayList.length > 0 ? 'cursor-pointer hover:bg-brand-50/40' : 'cursor-default'}`}
                >
                  <p className="text-[10px] sm:text-xs font-semibold">{format(day, 'd')}</p>
                  <div className="mt-0.5 sm:mt-1 space-y-0.5 sm:space-y-1">
                    {dayList.slice(0, 2).map((e, idx) => (
                      <div key={`${e.studentName}-${idx}`} className="hidden sm:block rounded bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-700">
                        {role === 'STUDENT' ? e.campusName : e.studentName}
                      </div>
                    ))}
                    {dayList.length > 0 && (
                      <div className="sm:hidden w-2 h-2 rounded-full bg-brand-500 mt-1" />
                    )}
                    {dayList.length > 2 && (
                      <p className="hidden sm:block text-[10px] text-gray-500">+{dayList.length - 2} más</p>
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
