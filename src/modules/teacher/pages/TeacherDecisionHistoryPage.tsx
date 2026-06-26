import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Download, FileText, Loader2, RotateCcw, Search } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { PageHeader } from '@/shared/components/PageHeader';
import { HelpTooltip } from '@/shared/components/HelpTooltip';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/shared/components/ui/table';
import {
  fetchTeacherDecisionHistory,
  type TeacherDecision,
  type TeacherDecisionStatus,
} from '@/modules/teacher/services/teacherHistory.service';

export function TeacherDecisionHistoryPage() {
  const [rows, setRows] = useState<TeacherDecision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [studentId, setStudentId] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = async () => {
    setIsLoading(true);
    setRows(await fetchTeacherDecisionHistory());
    setIsLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const students = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    rows.forEach((row) => {
      if (row.studentId) map.set(row.studentId, { id: row.studentId, label: `${row.studentName} - ${row.studentCode}` });
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const eventDate = row.eventAt.slice(0, 10);
      const matchesStudent = studentId === 'all' || row.studentId === studentId;
      const matchesFrom = !fromDate || eventDate >= fromDate;
      const matchesTo = !toDate || eventDate <= toDate;
      const haystack = `${row.studentName} ${row.studentCode} ${row.status} ${row.reviewerNotes ?? ''}`.toLowerCase();
      const matchesSearch = !term || haystack.includes(term);
      return matchesStudent && matchesFrom && matchesTo && matchesSearch;
    });
  }, [rows, search, studentId, fromDate, toDate]);

  const clearFilters = () => {
    setSearch('');
    setStudentId('all');
    setFromDate('');
    setToDate('');
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('UNIVO Check-Health - Historial de decisiones del docente', 14, 16);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')} | Registros: ${filtered.length}`, 14, 23);

    autoTable(doc, {
      startY: 29,
      head: [['Fecha', 'Estudiante', 'Carnet', 'Decision', 'Comentario']],
      body: filtered.map((row) => [
        formatDateTime(row.eventAt),
        row.studentName,
        row.studentCode,
        statusLabel(row.status),
        row.reviewerNotes ?? 'Sin comentario',
      ]),
      headStyles: { fillColor: [27, 58, 107], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 55 },
        2: { cellWidth: 28 },
        3: { cellWidth: 28 },
        4: { cellWidth: 130 },
      },
    });

    doc.save(`historial-decisiones-docente-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Cargando historial...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Historial de decisiones"
        description="Registro de las resoluciones que has tomado sobre las incidencias y justificaciones de tus estudiantes (aprobadas, rechazadas o escaladas)."
        action={(
          <div className="flex items-center gap-2">
            <HelpTooltip side="left" text="Cada fila es una resolución que registraste sobre una justificación o incidencia. El registro es inmutable: queda como respaldo de auditoría y no puede editarse ni borrarse." />
            <Button variant="outline" onClick={exportPdf} disabled={filtered.length === 0} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              <Download className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
          </div>
        )}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4 text-brand-700" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr_0.7fr_0.7fr_auto] lg:items-end">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-gray-600">Buscar</Label>
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Estudiante, carnet, decision o comentario" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-gray-600">Estudiante</Label>
              <select
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                className="h-10 w-full rounded-md border border-brand-100 bg-white px-3 text-sm text-brand-900 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/25"
              >
                <option value="all">Todos</option>
                {students.map((student) => <option key={student.id} value={student.id}>{student.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-gray-600">Desde</Label>
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-gray-600">Hasta</Label>
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </div>
            <Button variant="outline" onClick={clearFilters}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Total" value={filtered.length} />
        <SummaryCard label="Aprobadas" value={filtered.filter((row) => row.status === 'APROBADO').length} tone="green" />
        <SummaryCard label="Rechazadas" value={filtered.filter((row) => row.status === 'RECHAZADO').length} tone="red" />
        <SummaryCard label="Escaladas" value={filtered.filter((row) => row.status === 'ESCALADO').length} tone="amber" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">{filtered.length} decision{filtered.length !== 1 ? 'es' : ''}</CardTitle>
          <Badge className="bg-brand-100 text-brand-800">
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Registro inmutable
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">No hay decisiones para los filtros seleccionados.</p>
          ) : (
            <>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Estudiante</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead>Comentario</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{formatDateTime(row.eventAt)}</TableCell>
                        <TableCell>
                          <p className="font-medium text-gray-900">{row.studentName}</p>
                          <p className="text-xs text-gray-500">{row.studentCode}</p>
                        </TableCell>
                        <TableCell>{statusBadge(row.status)}</TableCell>
                        <TableCell className="max-w-[520px] whitespace-normal text-gray-700">{row.reviewerNotes ?? 'Sin comentario'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="divide-y divide-gray-100 lg:hidden">
                {filtered.map((row) => (
                  <div key={row.id} className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900">{row.studentName}</p>
                        <p className="text-xs text-gray-500">{row.studentCode} - {formatDateTime(row.eventAt)}</p>
                      </div>
                      {statusBadge(row.status)}
                    </div>
                    <p className="text-sm text-gray-700">{row.reviewerNotes ?? 'Sin comentario'}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, tone = 'brand' }: { label: string; value: number; tone?: 'brand' | 'green' | 'red' | 'amber' }) {
  const colors = {
    brand: 'text-brand-800',
    green: 'text-green-700',
    red: 'text-red-700',
    amber: 'text-amber-700',
  };
  return (
    <Card>
      <CardContent className="py-4 text-center">
        <p className={`text-2xl font-semibold ${colors[tone]}`}>{value}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">{label}</p>
      </CardContent>
    </Card>
  );
}

function statusBadge(status: TeacherDecisionStatus) {
  const classes: Record<TeacherDecisionStatus, string> = {
    APROBADO: 'bg-green-100 text-green-800',
    RECHAZADO: 'bg-red-100 text-red-800',
    PENDIENTE: 'bg-gray-100 text-gray-700',
    ESCALADO: 'bg-amber-100 text-amber-800',
    DESCONOCIDO: 'bg-gray-100 text-gray-700',
  };
  return <Badge className={classes[status]}>{statusLabel(status)}</Badge>;
}

function statusLabel(status: TeacherDecisionStatus) {
  const labels: Record<TeacherDecisionStatus, string> = {
    APROBADO: 'Aprobada',
    RECHAZADO: 'Rechazada',
    PENDIENTE: 'Pendiente',
    ESCALADO: 'Escalada',
    DESCONOCIDO: 'Sin estado',
  };
  return labels[status];
}

function formatDateTime(value: string) {
  return format(parseISO(value), 'dd/MM/yyyy HH:mm', { locale: es });
}
