import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Loader2, Clock, Target, TrendingUp, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/shared/backend/supabaseClient';
import { getStudentHoursProgress } from '@/shared/backend/checkHealthBackend';

type StudentInfo = {
  name: string;
  code: string;
  career: string;
  campusName: string;
  period: string;
  supervisorName: string;
};

type AttendanceRecord = {
  date: string;
  checkIn: string;
  checkOut: string;
  hours: number;
};

export function StudentProgressPage() {
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(0);
  const [required, setRequired] = useState(240);
  const [info, setInfo] = useState<StudentInfo | null>(null);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) { setLoading(false); return; }

      const [progress, profileRes, groupRes, attendanceRes] = await Promise.all([
        getStudentHoursProgress(userId),
        supabase.from('users').select('full_name, student_code, career').eq('id', userId).single(),
        supabase
          .from('teacher_groups')
          .select('period, start_date, end_date, campus:campuses(name, supervisor_name)')
          .eq('student_id', userId),
        supabase
          .from('attendances')
          .select('date, check_in, check_out, worked_hours')
          .eq('student_id', userId)
          .not('check_out', 'is', null)
          .order('date', { ascending: true }),
      ]);

      setCompleted(progress.completedHours);
      setRequired(progress.requiredHours);

      const today = new Date().toISOString().slice(0, 10);
      const rows = (groupRes.data ?? []) as unknown as {
        period: string; start_date: string | null; end_date: string | null;
        campus: { name: string | null; supervisor_name: string | null } | null;
      }[];
      const active = rows.find(
        (r) => (!r.start_date || r.start_date <= today) && (!r.end_date || r.end_date >= today),
      );
      const chosen = active ?? [...rows].sort((a, b) => (b.end_date ?? '').localeCompare(a.end_date ?? ''))[0];

      setInfo({
        name: profileRes.data?.full_name ?? '—',
        code: profileRes.data?.student_code ?? '—',
        career: profileRes.data?.career ?? '—',
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
        })),
      );

      setLoading(false);
    };
    void load();
  }, []);

  const pct = Math.min(100, Math.round((completed / required) * 100));
  const remaining = Math.max(0, required - completed);
  const barColor = pct >= 85 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';

  const exportPdf = async () => {
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
      { label: 'Nombre:',  value: info?.name     ?? '—', x: dataX1, lw: 18, y: 78 },
      { label: 'Carnet:',  value: info?.code      ?? '—', x: dataX1, lw: 18, y: 88 },
      { label: 'Área:',    value: info?.career    ?? '—', x: dataX1, lw: 18, y: 98 },
      { label: 'Sede:',    value: info?.campusName ?? '—', x: dataX2, lw: 14, y: 78 },
      { label: 'Período:', value: info?.period    ?? '—', x: dataX2, lw: 20, y: 88 },
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
      body: attendances.length > 0
        ? attendances.map((r) => [
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
    doc.text(info?.supervisorName ?? '—', margin, sigLineY + 11);

    // Fecha
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.4);
    doc.line(margin + 100, sigLineY, margin + 155, sigLineY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Fecha', margin + 100, sigLineY + 5);

    doc.save(`constancia-horas-${info?.code ?? 'estudiante'}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
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
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Progreso de horas</h2>
          <p className="text-sm text-slate-500 mt-0.5">Cumplimiento del período actual</p>
        </div>
        <Button variant="outline" onClick={() => void exportPdf()}>
          <Download className="w-4 h-4 mr-2" />
          Descargar constancia
        </Button>
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
