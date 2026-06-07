import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, Search } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { PageHeader } from '@/shared/components/PageHeader';
import {
  fetchAllJustifications,
  type AllJustification,
  type JustificationStatus,
} from '@/modules/dean/services/justifications.service';

const PAGE_SIZE = 10;

const STATUS_CONFIG: Record<JustificationStatus, { label: string; className: string }> = {
  PENDIENTE: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700' },
  APROBADO:  { label: 'Aprobado',  className: 'bg-green-100 text-green-700' },
  RECHAZADO: { label: 'Rechazado', className: 'bg-red-100 text-red-700' },
};

export function IncidentsDashboardPage() {
  const [rows, setRows] = useState<AllJustification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [campusFilter, setCampusFilter] = useState('all');
  const [docenteFilter, setDocenteFilter] = useState('all');
  const [pendingPage, setPendingPage] = useState(0);
  const [closedPage, setClosedPage] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    void fetchAllJustifications().then((data) => {
      setRows(data);
      setIsLoading(false);
    });
  }, []);

  const campuses = useMemo(
    () => [...new Set(rows.map((r) => r.campusName))].sort(),
    [rows],
  );

  const docentes = useMemo(
    () =>
      [...new Set(rows.map((r) => r.reviewerName).filter((n): n is string => Boolean(n)))].sort(),
    [rows],
  );

  const resetPages = () => { setPendingPage(0); setClosedPage(0); };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (campusFilter !== 'all' && row.campusName !== campusFilter) return false;
      if (docenteFilter !== 'all' && row.reviewerName !== docenteFilter) return false;
      if (term && !`${row.studentName} ${row.studentCode} ${row.career} ${row.campusName} ${row.reason}`
        .toLowerCase().includes(term)) return false;
      return true;
    });
  }, [rows, search, campusFilter, docenteFilter]);

  const pending = useMemo(() => filtered.filter((r) => r.status === 'PENDIENTE'), [filtered]);
  const closed  = useMemo(() => filtered.filter((r) => r.status !== 'PENDIENTE'),  [filtered]);

  const pendingTotalPages = Math.max(1, Math.ceil(pending.length / PAGE_SIZE));
  const closedTotalPages  = Math.max(1, Math.ceil(closed.length  / PAGE_SIZE));

  useEffect(() => { if (pendingPage > pendingTotalPages - 1) setPendingPage(pendingTotalPages - 1); }, [pendingPage, pendingTotalPages]);
  useEffect(() => { if (closedPage  > closedTotalPages  - 1) setClosedPage(closedTotalPages   - 1); }, [closedPage,  closedTotalPages]);

  const pendingPaginated = pending.slice(pendingPage * PAGE_SIZE, (pendingPage + 1) * PAGE_SIZE);
  const closedPaginated  = closed.slice(closedPage   * PAGE_SIZE, (closedPage  + 1) * PAGE_SIZE);

  const totalPending = rows.filter((r) => r.status === 'PENDIENTE').length;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Cargando incidencias...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Panel de incidencias"
        description="Vista global de justificaciones abiertas y cerradas."
        action={<Badge className="w-fit bg-amber-500/20 text-amber-200 border border-amber-400/30">{totalPending} pendiente{totalPending !== 1 ? 's' : ''}</Badge>}
      />

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); resetPages(); }}
                className="pl-9"
                placeholder="Buscar por estudiante, carnet, sede o motivo"
              />
            </div>
            <Select value={campusFilter} onValueChange={(v) => { setCampusFilter(v); resetPages(); }}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Sede" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las sedes</SelectItem>
                {campuses.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={docenteFilter} onValueChange={(v) => { setDocenteFilter(v); setClosedPage(0); }}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Docente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los docentes</SelectItem>
                {docentes.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            Abiertas
            {pending.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="closed" className="gap-2">
            Cerradas
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
              {closed.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-3">
          <IncidentsTable
            rows={pendingPaginated}
            page={pendingPage}
            totalPages={pendingTotalPages}
            total={pending.length}
            onPage={setPendingPage}
            showReviewer={false}
            emptyMessage="No hay justificaciones pendientes con los filtros actuales."
          />
        </TabsContent>

        <TabsContent value="closed" className="mt-3">
          <IncidentsTable
            rows={closedPaginated}
            page={closedPage}
            totalPages={closedTotalPages}
            total={closed.length}
            onPage={setClosedPage}
            showReviewer={true}
            emptyMessage="No hay justificaciones cerradas con los filtros actuales."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type TableProps = {
  rows: AllJustification[];
  page: number;
  totalPages: number;
  total: number;
  onPage: (updater: (p: number) => number) => void;
  showReviewer: boolean;
  emptyMessage: string;
};

function IncidentsTable({ rows, page, totalPages, total, onPage, showReviewer, emptyMessage }: TableProps) {
  return (
    <Card className="overflow-hidden border-brand-100 shadow-sm">
      <CardHeader className="bg-gradient-to-r from-brand-700 via-brand-800 to-brand-700 border-b border-brand-900/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] flex flex-row items-center justify-between py-3">
        <CardTitle className="text-base flex items-center gap-2 text-white">
          <div className="w-1 h-5 rounded-full bg-gold-400 shrink-0" />
          {total} registro{total !== 1 ? 's' : ''}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">{emptyMessage}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Estudiante</th>
                  <th className="px-4 py-3 text-left">Asistencia</th>
                  <th className="px-4 py-3 text-left">Motivo</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  {showReviewer && <th className="px-4 py-3 text-left">Revisado por</th>}
                  <th className="px-4 py-3 text-left">Documento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => {
                  const status = STATUS_CONFIG[row.status];
                  return (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{row.studentName}</p>
                        <p className="text-xs text-gray-500">{row.studentCode} - {row.career}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <p className="font-medium">{formatDate(row.attendanceDate)}</p>
                        <p className="text-xs text-gray-500">{row.campusName}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="line-clamp-2 max-w-[280px] text-gray-700">{row.reason}</p>
                        <p className="mt-1 text-xs text-gray-400">Enviada {formatDateTime(row.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={status.className}>{status.label}</Badge>
                        {row.reviewerNotes && (
                          <p className="mt-1 line-clamp-1 max-w-[180px] text-xs text-gray-500">{row.reviewerNotes}</p>
                        )}
                      </td>
                      {showReviewer && (
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {row.reviewerName ?? <span className="text-gray-400">—</span>}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        {row.documentUrl ? (
                          <Button variant="outline" size="sm" asChild>
                            <a href={row.documentUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Abrir
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-gray-400">Sin documento</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-xs text-gray-500">Página {page + 1} de {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => onPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatDate(value: string) {
  return format(parseISO(value), 'dd/MM/yyyy', { locale: es });
}

function formatDateTime(value: string) {
  return format(parseISO(value), 'dd/MM/yyyy HH:mm', { locale: es });
}
