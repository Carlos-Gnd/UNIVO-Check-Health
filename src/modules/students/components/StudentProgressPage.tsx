import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Loader2, Clock, Target, TrendingUp, Download, AlertCircle, FileCheck, Building2, User } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/shared/backend/supabaseClient';
import { getStudentHoursProgress } from '@/shared/backend/checkHealthBackend';

type StudentProfile = {
  name: string;
  code: string;
  career: string;
};

type GroupInfo = {
  campusId: string | null;
  campusName: string;
  period: string;
  startDate: string | null;
  endDate: string | null;
  supervisorName: string;
};

// Kept for backward compat with PDF fields that need combined info
type StudentInfo = StudentProfile & {
  campusName: string;
  period: string;
  supervisorName: string;
};

type AttendanceRecord = {
  date: string;
  checkIn: string;
  checkOut: string;
  hours: number;
  campusId: string | null;
};

export function StudentProgressPage() {
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(0);
  const [required, setRequired] = useState(240);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [info, setInfo] = useState<StudentInfo | null>(null); // primer grupo (compat PDF)
  const [allGroups, setAllGroups] = useState<GroupInfo[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [absentCount, setAbsentCount] = useState(0);
  const [justificationCount, setJustificationCount] = useState(0);
  // Fechas de ausencia computadas (días de rotación pasados sin asistencia registrada)
  const [computedAbsentDates, setComputedAbsentDates] = useState<string[]>([]);
  // Mapa fecha → status de justificación para cruzar en el PDF
  const [justificationDateMap, setJustificationDateMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) { setLoading(false); return; }

      const [progress, profileRes, groupRes, attendanceRes, allAttDateRes, justDataRes] = await Promise.all([
        getStudentHoursProgress(userId),
        supabase.from('users').select('full_name, student_code, career').eq('id', userId).single(),
        supabase
          .from('teacher_groups')
          .select('campus_id, period, start_date, end_date, campus:campuses(name, supervisor_name), schedules:student_schedules(weekday)')
          .eq('student_id', userId),
        supabase
          .from('attendances')
          .select('date, check_in, check_out, worked_hours, campus_id')
          .eq('student_id', userId)
          .not('check_out', 'is', null)
          .order('date', { ascending: true }),
        // Todas las fechas con check-in (incluyendo las sin check-out) para detectar ausencias
        supabase
          .from('attendances')
          .select('date')
          .eq('student_id', userId),
        // Justificaciones con fecha de asistencia para cruzar en el PDF
        supabase
          .from('justifications')
          .select('status, attendance:attendances!justifications_attendance_id_fkey(date)')
          .eq('student_id', userId),
      ]);

      setCompleted(progress.completedHours);
      setRequired(progress.requiredHours);

      const studentProfile: StudentProfile = {
        name: profileRes.data?.full_name ?? '—',
        code: profileRes.data?.student_code ?? '—',
        career: profileRes.data?.career ?? '—',
      };
      setProfile(studentProfile);

      const today = new Date().toISOString().slice(0, 10);
      const rows = (groupRes.data ?? []) as unknown as {
        campus_id: string | null;
        period: string; start_date: string | null; end_date: string | null;
        campus: { name: string | null; supervisor_name: string | null } | null;
        schedules: { weekday: number }[] | null;
      }[];

      const groups: GroupInfo[] = rows.map((r) => ({
        campusId: r.campus_id ?? null,
        campusName: r.campus?.name ?? '—',
        period: r.period,
        startDate: r.start_date,
        endDate: r.end_date,
        supervisorName: r.campus?.supervisor_name ?? '—',
      }));
      setAllGroups(groups);

      // Primer grupo activo (o más reciente) para compat con lógica existente
      const active = rows.find(
        (r) => (!r.start_date || r.start_date <= today) && (!r.end_date || r.end_date >= today),
      );
      const chosen = active ?? [...rows].sort((a, b) => (b.end_date ?? '').localeCompare(a.end_date ?? ''))[0];
      setInfo({
        ...studentProfile,
        campusName: chosen?.campus?.name ?? '—',
        period: chosen?.period ?? '—',
        supervisorName: chosen?.campus?.supervisor_name ?? '—',
      });

      setAttendances(
        (attendanceRes.data ?? []).map((row: Record<string, unknown>) => ({
          date: row.date as string,
          checkIn: row.check_in as string,
          checkOut: row.check_out as string,
          hours: row.worked_hours != null ? Number(Number(row.worked_hours).toFixed(1)) : 0,
          campusId: (row.campus_id as string | null) ?? null,
        })),
      );

      // Construir mapa de fechas con asistencia registrada (check-in de cualquier tipo)
      const attendedSet = new Set((allAttDateRes.data ?? []).map((r: any) => r.date as string));

      // Construir mapa fecha → status de justificación
      const justMap = new Map<string, string>();
      for (const row of (justDataRes.data ?? []) as any[]) {
        const d = row.attendance?.date;
        if (d) justMap.set(d as string, row.status as string);
      }
      setJustificationDateMap(justMap);
      setJustificationCount(justDataRes.data?.length ?? 0);

      // Computar ausencias: días de rotación pasados sin ningún check-in registrado
      const absents: string[] = [];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(23, 59, 59, 999);

      for (const group of rows) {
        if (!group.start_date || !group.end_date) continue;
        const weekdays = (group.schedules ?? []).map((s) => Number(s.weekday));
        if (weekdays.length === 0) continue;
        let cursor = new Date(`${group.start_date}T00:00:00`);
        const end = new Date(Math.min(new Date(`${group.end_date}T23:59:59`).getTime(), yesterday.getTime()));
        while (cursor <= end) {
          const dow = cursor.getDay();
          const isoWeekday = dow === 0 ? 7 : dow;
          if (weekdays.includes(isoWeekday)) {
            const dateStr = cursor.toISOString().slice(0, 10);
            if (!attendedSet.has(dateStr)) absents.push(dateStr);
          }
          cursor.setDate(cursor.getDate() + 1);
        }
      }
      absents.sort();
      setComputedAbsentDates(absents);
      setAbsentCount(absents.length);

      setLoading(false);
    };
    void load();
  }, []);

  const pct = Math.min(100, Math.round((completed / required) * 100));
  const remaining = Math.max(0, required - completed);
  const barColor = pct >= 85 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';

  const exportPdf = async (group: GroupInfo) => {
    // Filtrar asistencias y ausencias para esta sede y período específico
    const groupAttendances = attendances.filter((a) =>
      (!group.campusId || a.campusId === group.campusId) &&
      (!group.startDate || a.date >= group.startDate) &&
      (!group.endDate || a.date <= group.endDate),
    );
    const groupAbsentDates = computedAbsentDates.filter((d) =>
      (!group.startDate || d >= group.startDate) &&
      (!group.endDate || d <= group.endDate),
    );

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210;
    const margin = 18;
    const contentW = W - margin * 2;
    const pageH = doc.internal.pageSize.getHeight();

    const drawFooter = () => {
      doc.setDrawColor(215, 225, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, pageH - 18, W - margin, pageH - 18);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Constancia generada el ${format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })}`,
        W / 2, pageH - 12, { align: 'center' },
      );
      doc.text(
        'UNIVO Check-Health  •  Sistema de Control de Asistencias Clínicas',
        W / 2, pageH - 7, { align: 'center' },
      );
    };

    // ── Cargar logo ──────────────────────────────────────────────────────
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

    // ── Encabezado ───────────────────────────────────────────────────────
    doc.setFillColor(27, 58, 107);
    doc.rect(0, 0, W, 38, 'F');

    const logoX = margin;
    const logoY = 7;
    const logoSize = 22;
    const logoPad = 2.5;

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(logoX, logoY, logoSize, logoSize, 3, 3, 'F');
    doc.setDrawColor(245, 166, 35);
    doc.setLineWidth(0.9);
    doc.roundedRect(logoX, logoY, logoSize, logoSize, 3, 3, 'S');

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', logoX + logoPad, logoY + logoPad, logoSize - logoPad * 2, logoSize - logoPad * 2);
    }

    const textX = margin + logoSize + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text('UNIVO Check-Health', textX, 17);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(180, 200, 235);
    doc.text('Universidad de Oriente  •  Área de Salud', textX, 26);

    doc.setDrawColor(245, 166, 35);
    doc.setLineWidth(1);
    doc.line(0, 38, W, 38);

    // ── Título ───────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(27, 58, 107);
    doc.text('CONSTANCIA DE HORAS PRÁCTICAS', W / 2, 52, { align: 'center' });

    doc.setDrawColor(215, 225, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, 57, W - margin, 57);

    // ── Datos del estudiante (3 filas) ───────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('DATOS DEL ESTUDIANTE', margin, 65);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, 69, contentW, 36, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, 69, contentW, 36, 2, 2, 'S');

    const half = contentW / 2;
    const dataX1 = margin + 6;
    const dataX2 = margin + half + 6;

    doc.setFontSize(9);
    [
      { label: 'Nombre:',  value: profile?.name   ?? '—', x: dataX1, lw: 18, y: 78 },
      { label: 'Carnet:',  value: profile?.code   ?? '—', x: dataX1, lw: 18, y: 88 },
      { label: 'Área:',    value: profile?.career  ?? '—', x: dataX1, lw: 18, y: 98 },
      { label: 'Sede:',    value: group.campusName,        x: dataX2, lw: 14, y: 78 },
      { label: 'Período:', value: group.period,            x: dataX2, lw: 20, y: 88 },
    ].forEach(({ label, value, x, lw, y }) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text(label, x, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(value, x + lw, y);
    });

    doc.setDrawColor(215, 225, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, 110, W - margin, 110);

    // ── Progreso de horas ────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('PROGRESO DE HORAS', margin, 118);

    const barY = 122;
    const barH = 11;
    const filledW = contentW * Math.min(1, completed / required);

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, barY, contentW, barH, 2, 2, 'F');

    if (pct >= 85) doc.setFillColor(22, 163, 74);
    else if (pct >= 60) doc.setFillColor(245, 158, 11);
    else doc.setFillColor(239, 68, 68);

    if (filledW > 0) doc.roundedRect(margin, barY, filledW, barH, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    if (pct > 12) {
      doc.text(`${pct}%`, margin + filledW / 2, barY + 7.2, { align: 'center' });
    } else {
      doc.setTextColor(71, 85, 105);
      doc.text(`${pct}%`, margin + filledW + 4, barY + 7.2);
    }

    const statsY = barY + barH + 12;
    const colW = contentW / 3;
    [
      { value: `${completed} h`, label: 'Horas completadas' },
      { value: `${required} h`,  label: 'Horas requeridas' },
      { value: `${remaining} h`, label: 'Horas restantes' },
    ].forEach((stat, i) => {
      const cx = margin + colW * i + colW / 2;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin + colW * i + 2, statsY - 5, colW - 4, 20, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.25);
      doc.roundedRect(margin + colW * i + 2, statsY - 5, colW - 4, 20, 2, 2, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(27, 58, 107);
      doc.text(stat.value, cx, statsY + 6, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(stat.label, cx, statsY + 12, { align: 'center' });
    });

    // ── Tabla de asistencias ─────────────────────────────────────────────
    const tableStartY = statsY + 28;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('REGISTRO DE ASISTENCIAS', margin, tableStartY - 3);

    autoTable(doc, {
      startY: tableStartY,
      margin: { left: margin, right: margin, bottom: 25 },
      head: [['Fecha', 'Entrada', 'Salida', 'Horas']],
      body: groupAttendances.length > 0
        ? groupAttendances.map((r) => [
            format(parseISO(r.date), 'dd/MM/yyyy', { locale: es }),
            format(parseISO(r.checkIn), 'HH:mm'),
            format(parseISO(r.checkOut), 'HH:mm'),
            `${r.hours} h`,
          ])
        : [['Sin registros de asistencia', '', '', '']],
      tableWidth: contentW,
      headStyles: {
        fillColor: [27, 58, 107],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 44 },
        1: { cellWidth: 38 },
        2: { cellWidth: 38 },
        3: { cellWidth: contentW - 120, halign: 'right' },
      },
      didDrawPage: drawFooter,
    });

    // ── Tabla de ausencias (días de rotación pasados sin check-in) ───────
    if (groupAbsentDates.length > 0) {
      const absStartY = (doc as any).lastAutoTable.finalY + 10;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('AUSENCIAS', margin, absStartY - 2);

      const justLabel = (dateStr: string) => {
        const st = justificationDateMap.get(dateStr);
        if (!st) return 'Sin justificación';
        if (st === 'APROBADO') return 'Justificada';
        if (st === 'PENDIENTE') return 'Justificación pendiente';
        return 'Justificación rechazada';
      };

      autoTable(doc, {
        startY: absStartY,
        margin: { left: margin, right: margin, bottom: 25 },
        head: [['Fecha', 'Estado justificación']],
        body: groupAbsentDates.map((dateStr) => [
          format(parseISO(dateStr), 'dd/MM/yyyy', { locale: es }),
          justLabel(dateStr),
        ]),
        tableWidth: contentW,
        headStyles: { fillColor: [185, 28, 28], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [254, 242, 242] },
        columnStyles: {
          0: { cellWidth: 44 },
          1: { cellWidth: contentW - 44 },
        },
        didDrawPage: drawFooter,
      });
    }

    // ── Firma del coordinador ────────────────────────────────────────────
    let sigY = (doc as any).lastAutoTable.finalY + 14;

    if (sigY + 38 > pageH - 25) {
      doc.addPage();
      drawFooter();
      sigY = 25;
    }

    doc.setDrawColor(215, 225, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, sigY, W - margin, sigY);

    // Línea de firma
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.4);
    const sigLineY = sigY + 22;
    doc.line(margin, sigLineY, margin + 80, sigLineY);

    // Etiqueta y nombre pre-impreso
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('Firma del Encargado', margin, sigLineY + 5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(group.supervisorName, margin, sigLineY + 11);

    // Fecha
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.4);
    doc.line(margin + 100, sigLineY, margin + 155, sigLineY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Fecha', margin + 100, sigLineY + 5);

    const campusSlug = group.campusName.toLowerCase().replace(/\s+/g, '-').slice(0, 20);
    doc.save(`constancia-${profile?.code ?? 'estudiante'}-${campusSlug}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Cargando progreso…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Progreso de horas</h2>
        <p className="text-sm text-slate-500 mt-0.5">Cumplimiento del período actual</p>
      </div>

      <Card>
        <CardContent className="pt-6 pb-6 space-y-5">
          <div className="text-center">
            <div className={`text-5xl font-bold tabular-nums ${pct >= 85 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
              {pct}%
            </div>
            <p className="text-sm text-slate-500 mt-1">{completed} de {required} horas</p>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>0 h</span>
              <span>Meta: {required} h</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Clock} label="Completadas" value={`${completed} h`} color="text-slate-700" />
        <StatCard icon={Target} label="Meta" value={`${required} h`} color="text-slate-700" />
        <StatCard icon={TrendingUp} label="Restantes" value={`${remaining} h`} color={remaining === 0 ? 'text-emerald-600' : 'text-amber-600'} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={AlertCircle} label="Ausencias" value={String(absentCount)} color={absentCount > 0 ? 'text-red-500' : 'text-emerald-600'} />
        <StatCard icon={FileCheck} label="Justificaciones" value={String(justificationCount)} color={justificationCount > 0 ? 'text-amber-600' : 'text-slate-700'} />
      </div>

      {/* Sedes asignadas — una constancia por sede */}
      {allGroups.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {allGroups.length === 1 ? 'Sede asignada' : 'Sedes asignadas'}
          </p>
          {allGroups.map((g, i) => (
            <Card key={`${g.campusId ?? 'null'}-${i}`} className="border-slate-200">
              <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-slate-800 truncate">
                    <Building2 className="w-4 h-4 shrink-0 text-brand-600" />
                    <span className="truncate">{g.campusName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 truncate">
                    <User className="w-3 h-3 shrink-0" />
                    <span className="truncate">{g.supervisorName}</span>
                    <span className="text-slate-300">·</span>
                    <span>{g.period}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void exportPdf(g)} className="shrink-0">
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Constancia
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pct >= 100 && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="py-4 text-center text-emerald-700 text-sm font-medium">
            Meta alcanzada — Has completado las horas requeridas del período.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5 text-center space-y-1.5">
        <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
        <Icon className="w-4 h-4 mx-auto text-slate-400" />
        <p className="text-xs text-slate-400">{label}</p>
      </CardContent>
    </Card>
  );
}
