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
import { supabase } from '@/shared/backend/supabaseClient';
import { fetchRotationsCalendar, type CalendarRole, type RotationWindow } from '../services/rotationsCalendar.service';
import { PageHeader } from '@/shared/components/PageHeader';

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
  const [attendedDates, setAttendedDates] = useState<Set<string>>(new Set());
  const [justifiedDates, setJustifiedDates] = useState<Set<string>>(new Set());

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

  // Para alumnos: carga fechas de asistencia y justificación del mes visible para colorear.
  useEffect(() => {
    if (role !== 'STUDENT') return;
    const fetchStudentStatus = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;
      const monthStart = format(startOfMonth(month), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(month), 'yyyy-MM-dd');
      const [attRes, justRes] = await Promise.all([
        supabase.from('attendances').select('date').eq('student_id', userId)
          .gte('date', monthStart).lte('date', monthEnd),
        supabase.from('justifications')
          .select('attendance:attendances!justifications_attendance_id_fkey(date)')
          .eq('student_id', userId),
      ]);
      setAttendedDates(new Set((attRes.data ?? []).map((r) => r.date as string)));
      setJustifiedDates(new Set(
        (justRes.data ?? [])
          .map((r: any) => r.attendance?.date as string | undefined)
          .filter((d): d is string => !!d && d >= monthStart && d <= monthEnd),
      ));
    };
    void fetchStudentStatus();
  }, [role, month]);

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

  const exportPdf = async () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;

    // Logo institucional (B13: el PDF de rotaciones ahora luce como el de horas).
    let logoDataUrl: string | null = null;
    try {
      const res = await fetch('/images/isologo.png');
      const blob = await res.blob();
      logoDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch { /* continúa sin logo */ }

    // ── Encabezado con marca ──────────────────────────────────────────────
    doc.setFillColor(27, 58, 107);
    doc.rect(0, 0, W, 30, 'F');
    if (logoDataUrl) {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, 5, 20, 20, 3, 3, 'F');
      doc.addImage(logoDataUrl, 'PNG', margin + 2, 7, 16, 16);
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('UNIVO Check-Health', margin + 26, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(245, 166, 35);
    doc.text('Calendario de Rotaciones', margin + 26, 20);
    doc.setFontSize(8);
    doc.setTextColor(226, 232, 240);
    doc.text(`Generado: ${format(new Date(), "d 'de' MMMM yyyy", { locale: es })}  ·  ${visibleWindows.length} rotaciones`, margin + 26, 26);

    autoTable(doc, {
      startY: 36,
      head: [['Alumno', 'Carrera', 'Sede', 'Supervisor', 'Horario', 'Inicio', 'Fin']],
      body: visibleWindows.map((w) => [
        w.studentName, w.career, w.campusName, w.supervisorName,
        w.schedule, w.startDate, w.endDate,
      ]),
      headStyles: { fillColor: [27, 58, 107], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8, cellPadding: 2 },
      alternateRowStyles: { fillColor: [240, 246, 255] },
      margin: { left: margin, right: margin },
      didDrawPage: () => {
        doc.setDrawColor(215, 225, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, pageH - 12, W - margin, pageH - 12);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text('UNIVO Check-Health  •  Sistema de Control de Asistencias Clínicas', W / 2, pageH - 7, { align: 'center' });
      },
    });

    doc.save(`rotaciones_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const exportXlsx = async () => {
    const { utils, writeFile } = await import('xlsx');
    const headers = ['Alumno', 'Carrera', 'Sede', 'Supervisor', 'Horario', 'Fecha inicio', 'Fecha fin'];
    const rows = visibleWindows.map((w) => [
      w.studentName, w.career, w.campusName, w.supervisorName, w.schedule, w.startDate, w.endDate,
    ]);
    // Título + metadatos arriba y luego la tabla (B13: el Excel ya no sale "plano").
    const aoa = [
      ['UNIVO Check-Health — Calendario de Rotaciones'],
      [`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, `Rotaciones: ${visibleWindows.length}`],
      [],
      headers,
      ...rows,
    ];
    const ws = utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 24 }, { wch: 22 }, { wch: 20 }, { wch: 13 }, { wch: 13 }];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
    ws['!autofilter'] = { ref: utils.encode_range({ s: { r: 3, c: 0 }, e: { r: 3 + rows.length, c: 6 } }) };
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
      <PageHeader
        title="Calendario de rotaciones"
        description={
          role === 'STUDENT'
            ? 'Vista mensual de tus rotaciones futuras.'
            : role === 'SUPERVISOR'
              ? 'Vista mensual de rotaciones de tus alumnos asignados.'
              : 'Vista global de rotaciones por sede y carrera.'
        }
        action={(
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
        )}
      />

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
              const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
              const isPast = isBefore(day, todayMidnight);
              const dayList = entries;

              // Color de asistencia para alumno en días pasados con rotación programada
              const dateStr = format(day, 'yyyy-MM-dd');
              let attendanceStatus: 'attended' | 'justified' | 'absent' | null = null;
              if (role === 'STUDENT' && isPast && entries.length > 0 && inMonth) {
                if (attendedDates.has(dateStr)) attendanceStatus = 'attended';
                else if (justifiedDates.has(dateStr)) attendanceStatus = 'justified';
                else attendanceStatus = 'absent';
              }

              const borderClass = attendanceStatus === 'absent' ? 'border-red-300' :
                attendanceStatus === 'justified' ? 'border-amber-300' :
                attendanceStatus === 'attended' ? 'border-green-300' : '';

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => dayList.length > 0 && setSelectedDay(day)}
                  disabled={dayList.length === 0}
                  className={`min-h-16 sm:min-h-28 rounded-lg border p-1 sm:p-2 text-left transition-colors ${
                    inMonth ? 'bg-white' : 'bg-brand-50/20 text-gray-400'
                  } ${borderClass} ${dayList.length > 0 ? 'cursor-pointer hover:bg-brand-50/40' : 'cursor-default'}`}
                >
                  <div className="flex items-start justify-between">
                    <p className="text-[10px] sm:text-xs font-semibold">{format(day, 'd')}</p>
                    {attendanceStatus === 'attended' && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="Asistió" />}
                    {attendanceStatus === 'justified' && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Justificación enviada" />}
                    {attendanceStatus === 'absent' && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Sin asistencia" />}
                  </div>
                  <div className="mt-0.5 sm:mt-1 space-y-0.5 sm:space-y-1">
                    {dayList.slice(0, 2).map((e, idx) => (
                      <div key={`${e.studentName}-${idx}`} className={`hidden sm:block rounded px-1.5 py-0.5 text-[10px] ${
                        attendanceStatus === 'absent' ? 'bg-red-50 text-red-700' :
                        attendanceStatus === 'justified' ? 'bg-amber-50 text-amber-700' :
                        attendanceStatus === 'attended' ? 'bg-green-50 text-green-700' :
                        'bg-brand-50 text-brand-700'
                      }`}>
                        {role === 'STUDENT' ? e.campusName : e.studentName}
                      </div>
                    ))}
                    {dayList.length > 0 && (
                      <div className={`sm:hidden w-2 h-2 rounded-full mt-1 ${
                        attendanceStatus === 'absent' ? 'bg-red-500' :
                        attendanceStatus === 'justified' ? 'bg-amber-400' :
                        attendanceStatus === 'attended' ? 'bg-green-500' :
                        'bg-brand-500'
                      }`} />
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

      {role === 'STUDENT' && (
        <div className="flex flex-wrap gap-4 text-xs text-gray-600 px-1">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />Asistió</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />Justificación enviada</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />Sin asistencia ni justificación</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-brand-500 inline-block" />Próxima rotación</span>
        </div>
      )}

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
