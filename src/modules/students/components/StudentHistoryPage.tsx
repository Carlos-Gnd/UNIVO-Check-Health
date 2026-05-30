import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { supabase } from '@/shared/backend/supabaseClient';

type AttendanceRow = {
  id: string;
  date: string;
  check_in: string;
  check_out: string | null;
  worked_hours: number | null;
  status: string;
  review_status: string;
  campus_name: string;
};

const PAGE_SIZE = 10;

const statusLabel = (s: string) => {
  if (s === 'absent') return 'Ausente';
  if (s === 'late') return 'Tardanza';
  return 'Presente';
};

const statusClass = (s: string) => {
  if (s === 'absent') return 'bg-red-100 text-red-700';
  if (s === 'late') return 'bg-amber-100 text-amber-700';
  return 'bg-green-100 text-green-700';
};

const reviewLabel = (r: string) => {
  if (r === 'VALIDADO') return 'Validado';
  if (r === 'OBSERVADO') return 'En revisión';
  return 'Pendiente';
};

const reviewClass = (r: string) => {
  if (r === 'VALIDADO') return 'bg-green-100 text-green-700';
  if (r === 'OBSERVADO') return 'bg-orange-100 text-orange-700';
  return 'bg-gray-100 text-gray-600';
};

export function StudentHistoryPage() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('attendances')
        .select('id, date, check_in, check_out, worked_hours, status, review_status, campus_id, campuses(name)')
        .eq('student_id', userId)
        .order('date', { ascending: false });

      if (!error && data) {
        setRows(
          data.map((r: any) => ({
            id: r.id,
            date: r.date,
            check_in: r.check_in,
            check_out: r.check_out,
            worked_hours: r.worked_hours,
            status: r.status,
            review_status: r.review_status ?? 'PENDIENTE',
            campus_name: r.campuses?.name ?? 'Sede desconocida',
          })),
        );
      }
      setLoading(false);
    };
    void load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      return true;
    });
  }, [rows, statusFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const resetPage = () => setPage(0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Cargando historial…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Historial de asistencias</h2>
        <p className="text-sm text-slate-500 mt-0.5">Registro completo de entradas y salidas</p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="py-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); resetPage(); }}>
            <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="present">Presente</SelectItem>
              <SelectItem value="absent">Ausente</SelectItem>
              <SelectItem value="late">Tardanza</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); resetPage(); }} placeholder="Desde" />
          </div>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); resetPage(); }} placeholder="Hasta" />
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {paginated.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Sin registros para los filtros seleccionados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Sede</th>
                    <th className="px-4 py-3 text-left">Entrada</th>
                    <th className="px-4 py-3 text-left">Salida</th>
                    <th className="px-4 py-3 text-right">Horas</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-center">Revisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">
                        {format(parseISO(r.date), 'dd/MM/yyyy', { locale: es })}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate">{r.campus_name}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {format(parseISO(r.check_in), 'HH:mm')}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {r.check_out ? format(parseISO(r.check_out), 'HH:mm') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {r.worked_hours != null ? `${r.worked_hours.toFixed(1)}h` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={statusClass(r.status)}>{statusLabel(r.status)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={reviewClass(r.review_status)}>{reviewLabel(r.review_status)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-xs text-gray-500">
                Página {page + 1} de {totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
