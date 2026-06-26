import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Loader2, Search, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { PageHeader } from '@/shared/components/PageHeader';
import { HelpTooltip } from '@/shared/components/HelpTooltip';
import {
  fetchPendingJustificationsResult,
  confirmHospitalPresenceAfterTechFailure,
  fetchPresenceConfirmationOptions,
  reviewJustification,
  subscribeToJustificationChanges,
  type JustificationStatus,
  type PendingJustification,
  type PresenceConfirmationOptions,
} from '@/modules/dean/services/justifications.service';

const PAGE_SIZE = 10;
const emptyPresenceOptions: PresenceConfirmationOptions = { students: [], campuses: [] };

type ReviewAction = Exclude<JustificationStatus, 'PENDIENTE'>;

export function DeanJustificationsPage() {
  const [rows, setRows] = useState<PendingJustification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<PendingJustification | null>(null);
  const [action, setAction] = useState<ReviewAction>('APROBADO');
  const [notes, setNotes] = useState('');
  const [presenceOpen, setPresenceOpen] = useState(false);
  const [presenceOptions, setPresenceOptions] = useState<PresenceConfirmationOptions>(emptyPresenceOptions);
  const [presenceStudentId, setPresenceStudentId] = useState('');
  const [presenceCampusId, setPresenceCampusId] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [representativeRole, setRepresentativeRole] = useState('');
  const [presenceReason, setPresenceReason] = useState('');
  const [isPresenceSaving, setIsPresenceSaving] = useState(false);

  const loadRows = async () => {
    setIsLoading(true);
    const result = await fetchPendingJustificationsResult();
    setRows(result.rows);
    setIsLoading(false);
    if (result.error) {
      toast.error(`No se pudieron cargar las justificaciones: ${result.error}`);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  useEffect(() => {
    return subscribeToJustificationChanges(() => {
      void loadRows();
    });
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      `${row.studentName} ${row.studentCode} ${row.career} ${row.campusName} ${row.reason}`
        .toLowerCase()
        .includes(term),
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages - 1) setPage(totalPages - 1);
  }, [page, totalPages]);

  const openReview = (row: PendingJustification, nextAction: ReviewAction) => {
    setSelected(row);
    setAction(nextAction);
    setNotes(nextAction === 'APROBADO' ? 'Solicitud aprobada.' : '');
  };

  const closeReview = () => {
    if (isSaving) return;
    setSelected(null);
    setNotes('');
  };

  const submitReview = async () => {
    if (!selected) return;
    const cleanNotes = notes.trim();
    if (action === 'RECHAZADO' && cleanNotes.length === 0) {
      toast.error('El comentario es obligatorio al rechazar.');
      return;
    }

    setIsSaving(true);
    const result = await reviewJustification({
      id: selected.id,
      status: action,
      notes: cleanNotes || 'Solicitud aprobada.',
    });
    setIsSaving(false);

    if (!result.ok) {
      toast.error(result.message ?? 'No se pudo actualizar la solicitud.');
      return;
    }

    setRows((current) => current.filter((row) => row.id !== selected.id));
    toast.success(action === 'APROBADO' ? 'Solicitud aprobada.' : 'Solicitud rechazada.');
    closeReview();
    void loadRows();
  };

  const openPresenceConfirmation = async () => {
    setPresenceOpen(true);
    setPresenceOptions(await fetchPresenceConfirmationOptions());
  };

  const closePresenceConfirmation = () => {
    if (isPresenceSaving) return;
    setPresenceOpen(false);
    setPresenceStudentId('');
    setPresenceCampusId('');
    setRepresentativeName('');
    setRepresentativeRole('');
    setPresenceReason('');
  };

  const submitPresenceConfirmation = async () => {
    if (!presenceStudentId || !presenceCampusId) {
      toast.error('Selecciona estudiante y sede.');
      return;
    }
    if (representativeName.trim().length < 3) {
      toast.error('Ingresa el nombre del representante.');
      return;
    }

    setIsPresenceSaving(true);
    const result = await confirmHospitalPresenceAfterTechFailure({
      studentId: presenceStudentId,
      campusId: presenceCampusId,
      representativeName,
      representativeRole,
      reason: presenceReason,
    });
    setIsPresenceSaving(false);

    if (!result.ok) {
      toast.error(result.message ?? 'No se pudo confirmar la presencia.');
      return;
    }

    toast.success('Presencia confirmada y enviada a auditoria.');
    closePresenceConfirmation();
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Cargando solicitudes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Solicitudes pendientes"
        description="Revisión de justificaciones enviadas por estudiantes."
        action={(
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Badge className="w-fit bg-amber-500/20 text-amber-200 border border-amber-400/30">{rows.length} pendientes</Badge>
            <Button onClick={openPresenceConfirmation} variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Confirmar falla técnica
            </Button>
            <HelpTooltip side="bottom" text="Úsalo cuando un estudiante SÍ estuvo en la sede pero no pudo marcar por una falla del sistema (sin señal, app caída, QR dañado). Registra manualmente su presencia ese día, dejando constancia en la auditoría." />
          </div>
        )}
      />

      <Card>
        <CardContent className="py-4">
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              className="pl-9"
              placeholder="Buscar por estudiante, carnet, carrera, sede o motivo"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {filtered.length} solicitud{filtered.length !== 1 ? 'es' : ''}
          </CardTitle>
          <Badge className="bg-gray-100 text-gray-600">Tiempo real</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {paginated.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">No hay solicitudes pendientes para revisar.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Estudiante</th>
                    <th className="px-4 py-3 text-left">Asistencia</th>
                    <th className="px-4 py-3 text-left">Motivo</th>
                    <th className="px-4 py-3 text-left">Documento</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{row.studentName}</p>
                        <p className="text-xs text-gray-500">{row.studentCode} - {row.career}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <p className="font-medium">{formatDate(row.attendanceDate)}</p>
                        <p className="text-xs text-gray-500">
                          {row.campusName} - {formatTime(row.checkIn)} a {formatTime(row.checkOut)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="line-clamp-2 max-w-[340px] text-gray-700">{row.reason}</p>
                        <p className="mt-1 text-xs text-gray-400">Enviada {formatDateTime(row.createdAt)}</p>
                      </td>
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
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" onClick={() => openReview(row, 'APROBADO')}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Aprobar
                          </Button>
                          <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => openReview(row, 'RECHAZADO')}>
                            <XCircle className="mr-2 h-4 w-4" />
                            Rechazar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-xs text-gray-500">Pagina {page + 1} de {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={closeReview}>
        <DialogContent className="sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{action === 'APROBADO' ? 'Aprobar solicitud' : 'Rechazar solicitud'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-lg border bg-gray-50 p-3 text-sm">
                  <p className="font-medium text-gray-900">{selected.studentName}</p>
                  <p className="text-gray-600">{formatDate(selected.attendanceDate)} - {selected.campusName}</p>
                  <p className="mt-2 text-gray-700">{selected.reason}</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="review-notes" className="text-sm font-medium text-gray-700">
                    Comentario {action === 'RECHAZADO' ? 'obligatorio' : 'de revision'}
                  </label>
                  <Textarea
                    id="review-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={4}
                    placeholder={action === 'RECHAZADO' ? 'Indica el motivo del rechazo' : 'Comentario para el estudiante'}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={closeReview} disabled={isSaving}>Cancelar</Button>
                  <Button
                    onClick={submitReview}
                    disabled={isSaving}
                    className={action === 'APROBADO' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-600 text-white hover:bg-red-700'}
                  >
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmar
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={presenceOpen} onOpenChange={(open) => { if (!open) closePresenceConfirmation(); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Confirmar presencia por falla técnica</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="presence-student" className="text-sm font-medium text-gray-700">Estudiante</label>
                <Select value={presenceStudentId} onValueChange={setPresenceStudentId}>
                  <SelectTrigger id="presence-student"><SelectValue placeholder="Selecciona estudiante" /></SelectTrigger>
                  <SelectContent>
                    {presenceOptions.students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>{student.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label htmlFor="presence-campus" className="text-sm font-medium text-gray-700">Sede</label>
                <Select value={presenceCampusId} onValueChange={setPresenceCampusId}>
                  <SelectTrigger id="presence-campus"><SelectValue placeholder="Selecciona sede" /></SelectTrigger>
                  <SelectContent>
                    {presenceOptions.campuses.map((campus) => (
                      <SelectItem key={campus.id} value={campus.id}>{campus.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="representative-name" className="text-sm font-medium text-gray-700">Representante</label>
                <Input
                  id="representative-name"
                  value={representativeName}
                  onChange={(event) => setRepresentativeName(event.target.value)}
                  placeholder="Nombre completo"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="representative-role" className="text-sm font-medium text-gray-700">Cargo</label>
                <Input
                  id="representative-role"
                  value={representativeRole}
                  onChange={(event) => setRepresentativeRole(event.target.value)}
                  placeholder="Ej. jefe de turno"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="presence-reason" className="text-sm font-medium text-gray-700">Motivo de la falla</label>
              <Textarea
                id="presence-reason"
                value={presenceReason}
                onChange={(event) => setPresenceReason(event.target.value)}
                rows={4}
                placeholder="Ej. sin internet en la sede, cámara dañada o QR no disponible"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closePresenceConfirmation} disabled={isPresenceSaving}>Cancelar</Button>
              <Button onClick={submitPresenceConfirmation} disabled={isPresenceSaving} className="bg-brand-700 text-white hover:bg-brand-800">
                {isPresenceSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar presencia
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatDate(value: string) {
  return format(parseISO(value), 'dd/MM/yyyy', { locale: es });
}

function formatDateTime(value: string) {
  return format(parseISO(value), 'dd/MM/yyyy HH:mm', { locale: es });
}

function formatTime(value: string | null) {
  if (!value) return 'Sin salida';
  return format(parseISO(value), 'HH:mm');
}
