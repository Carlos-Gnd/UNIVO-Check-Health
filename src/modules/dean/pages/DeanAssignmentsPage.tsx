import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarRange, ClipboardList, Loader2, Pencil, Plus, RefreshCw, Trash2, UserCog } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Badge } from '@/shared/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { toast } from 'sonner';
import { HelpTooltip } from '@/shared/components/HelpTooltip';
import {
  deleteAssignment, fetchAllSchedules, fetchAssignmentOptions, fetchAssignments, saveAssignment,
  type Assignment, type AssignmentOptions, type ScheduleSlot,
} from '@/modules/dean/services/assignments.service';

// ISO: 1=lunes … 7=domingo (coincide con student_schedules.weekday y EXTRACT(ISODOW)).
const DAYS: { weekday: number; label: string }[] = [
  { weekday: 1, label: 'Lunes' },
  { weekday: 2, label: 'Martes' },
  { weekday: 3, label: 'Miércoles' },
  { weekday: 4, label: 'Jueves' },
  { weekday: 5, label: 'Viernes' },
  { weekday: 6, label: 'Sábado' },
  { weekday: 7, label: 'Domingo' },
];

type DayRow = { weekday: number; enabled: boolean; from: string; to: string };

const defaultDays = (): DayRow[] =>
  DAYS.map((d) => ({ weekday: d.weekday, enabled: d.weekday <= 5, from: '07:00', to: '15:00' }));

const emptyOptions: AssignmentOptions = { students: [], teachers: [], coordinators: [], campuses: [] };
const periodPattern = /^\d{4}-[12]$/;

export function DeanAssignmentsPage() {
  const [options, setOptions] = useState<AssignmentOptions>(emptyOptions);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [schedules, setSchedules] = useState<Map<string, ScheduleSlot[]>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [coordinatorId, setCoordinatorId] = useState('');
  const [campusId, setCampusId] = useState('');
  const [period, setPeriod] = useState('2026-1');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [days, setDays] = useState<DayRow[]>(defaultDays());
  const [isSaving, setIsSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    const [opts, rows, sched] = await Promise.all([
      fetchAssignmentOptions(),
      fetchAssignments(),
      fetchAllSchedules(),
    ]);
    setOptions(opts);
    setAssignments(rows);
    setSchedules(sched);
    setIsLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const nameMaps = useMemo(() => {
    const person = new Map<string, string>();
    [...options.students, ...options.teachers, ...options.coordinators].forEach((p) => person.set(p.id, p.label));
    const campus = new Map(options.campuses.map((c) => [c.id, c.name]));
    return { person, campus };
  }, [options]);

  const resetForm = () => {
    setEditingId(null);
    setStudentId(''); setTeacherId(''); setCoordinatorId(''); setCampusId('');
    setPeriod('2026-1'); setStartDate(''); setEndDate('');
    setDays(defaultDays());
  };

  const openCreate = () => { resetForm(); setOpen(true); };

  const openEdit = (a: Assignment) => {
    setEditingId(a.id);
    setStudentId(a.student_id);
    setTeacherId(a.teacher_id);
    setCoordinatorId(a.coordinator_id ?? '');
    setCampusId(a.campus_id ?? '');
    setPeriod(a.period);
    setStartDate(a.start_date ?? '');
    setEndDate(a.end_date ?? '');
    const slots = schedules.get(a.id) ?? [];
    setDays(DAYS.map((d) => {
      const slot = slots.find((s) => s.weekday === d.weekday);
      return slot
        ? { weekday: d.weekday, enabled: true, from: slot.check_in_from, to: slot.check_in_to }
        : { weekday: d.weekday, enabled: false, from: '07:00', to: '15:00' };
    }));
    setOpen(true);
  };

  const setDay = (weekday: number, patch: Partial<DayRow>) =>
    setDays((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!studentId || !teacherId) { toast.error('El alumno y el docente son obligatorios.'); return; }
    if (!campusId) { toast.error('La sede de practica es obligatoria.'); return; }
    if (!period.trim()) { toast.error('El periodo es obligatorio.'); return; }
    if (!periodPattern.test(period.trim())) { toast.error('Usa el formato de periodo AAAA-CICLO, por ejemplo 2026-1.'); return; }
    if (startDate && endDate && endDate < startDate) { toast.error('La fecha de fin no puede ser anterior al inicio.'); return; }

    const enabled = days.filter((d) => d.enabled);
    if (enabled.length === 0) { toast.error('Define al menos un día de práctica en el horario.'); return; }
    const badDay = enabled.find((d) => d.to <= d.from);
    if (badDay) { toast.error(`En ${DAYS.find((x) => x.weekday === badDay.weekday)?.label} la hora de salida debe ser posterior a la de entrada.`); return; }

    setIsSaving(true);
    const result = await saveAssignment({
      id: editingId ?? undefined,
      student_id: studentId,
      teacher_id: teacherId,
      coordinator_id: coordinatorId || null,
      campus_id: campusId,
      period: period.trim(),
      start_date: startDate || null,
      end_date: endDate || null,
      schedules: enabled.map((d) => ({ weekday: d.weekday, check_in_from: d.from, check_in_to: d.to })),
    });
    setIsSaving(false);

    if (!result.ok) { toast.error(result.message ?? 'No se pudo guardar la asignación.'); return; }
    toast.success(editingId ? 'Asignación actualizada' : 'Asignación creada');
    setOpen(false);
    resetForm();
    void load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    const result = await deleteAssignment(deleteTarget.id);
    setDeletingId(null);
    if (!result.ok) { toast.error(result.message ?? 'No se pudo eliminar.'); return; }
    toast.success('Asignación eliminada');
    setDeleteTarget(null);
    void load();
  };

  const scheduleSummary = (id: string): string => {
    const slots = schedules.get(id) ?? [];
    if (slots.length === 0) return 'Sin horario';
    return slots
      .sort((a, b) => a.weekday - b.weekday)
      .map((s) => `${DAYS.find((d) => d.weekday === s.weekday)?.label.slice(0, 3)} ${s.check_in_from}-${s.check_in_to}`)
      .join(' · ');
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Asignaciones</h1>
          <p className="mt-1 text-sm text-gray-500">Asigna a cada alumno su sede, docente, coordinador y horario de práctica por día.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />Actualizar
          </Button>
          <Button className="bg-brand-700 hover:bg-brand-800 text-white" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />Nueva asignación
          </Button>
        </div>
      </div>

      {/* Tarjetas — móvil y tablet (<lg) */}
      <div className="lg:hidden space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />Cargando…
          </div>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Sin asignaciones. Crea la primera con "Nueva asignación".</p>
        ) : (
          assignments.map((a) => (
            <div key={a.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{nameMaps.person.get(a.student_id) ?? '—'}</p>
                  <Badge className="mt-1 bg-brand-100 text-brand-700">{a.period}</Badge>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => openEdit(a)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="outline" className="text-red-700 border-red-200 hover:bg-red-50"
                    onClick={() => setDeleteTarget(a)} disabled={deletingId === a.id}>
                    {deletingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4 text-sm">
                <div><span className="text-xs text-gray-400 uppercase tracking-wide">Sede</span><p className="text-gray-700 truncate">{a.campus_id ? (nameMaps.campus.get(a.campus_id) ?? '—') : '—'}</p></div>
                <div><span className="text-xs text-gray-400 uppercase tracking-wide">Docente</span><p className="text-gray-700 truncate">{nameMaps.person.get(a.teacher_id) ?? '—'}</p></div>
                {a.coordinator_id && (
                  <div className="sm:col-span-2"><span className="text-xs text-gray-400 uppercase tracking-wide">Coordinador</span><p className="text-gray-700 truncate">{nameMaps.person.get(a.coordinator_id)}</p></div>
                )}
              </div>
              {scheduleSummary(a.id) !== 'Sin horario' && (
                <p className="text-xs text-gray-500 border-t pt-2">{scheduleSummary(a.id)}</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Tabla — desktop (≥lg) */}
      <div className="hidden lg:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Alumno</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Sede</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Docente</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Coordinador</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Período</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Horario</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
            ) : assignments.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">Sin asignaciones. Crea la primera con "Nueva asignación".</td></tr>
            ) : (
              assignments.map((a) => (
                <tr key={a.id} className="hover:bg-brand-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{nameMaps.person.get(a.student_id) ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{a.campus_id ? (nameMaps.campus.get(a.campus_id) ?? '—') : '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{nameMaps.person.get(a.teacher_id) ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{a.coordinator_id ? (nameMaps.person.get(a.coordinator_id) ?? '—') : '—'}</td>
                  <td className="px-4 py-3"><Badge className="bg-brand-100 text-brand-700">{a.period}</Badge></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{scheduleSummary(a.id)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => openEdit(a)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="outline" className="text-red-700 border-red-200 hover:bg-red-50"
                        onClick={() => setDeleteTarget(a)} disabled={deletingId === a.id}>
                        {deletingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal crear / editar */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-brand-700" />{editingId ? 'Editar asignación' : 'Nueva asignación'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Alumno" required>
                <NativeSelect value={studentId} onChange={setStudentId} placeholder="Selecciona alumno" options={options.students.map((s) => ({ value: s.id, label: s.label }))} />
              </Field>
              <Field label="Sede de práctica" required>
                <NativeSelect value={campusId} onChange={setCampusId} placeholder="Selecciona sede" options={options.campuses.map((c) => ({ value: c.id, label: c.name }))} />
              </Field>
              <Field label="Docente supervisor" required>
                <NativeSelect value={teacherId} onChange={setTeacherId} placeholder="Selecciona docente" options={options.teachers.map((t) => ({ value: t.id, label: t.label }))} />
              </Field>
              <Field label="Coordinador" help="Persona que supervisa la asignación a nivel administrativo y revisa incidencias. Puede ser un coordinador o el decano.">
                <NativeSelect value={coordinatorId} onChange={setCoordinatorId} placeholder="Selecciona coordinador" options={options.coordinators.map((c) => ({ value: c.id, label: c.label }))} />
              </Field>
              <Field label="Período" required help="Ciclo académico de la rotación, en formato AÑO-CICLO (ej. 2026-1 para el primer ciclo de 2026).">
                <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-1" />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Inicio rotación" help="Primer y último día de la rotación del alumno en esta sede. Definen en qué fechas aparece en el calendario.">
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </Field>
                <Field label="Fin rotación">
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </Field>
              </div>
            </div>

            <div className="rounded-lg border border-brand-100 bg-brand-50/40 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarRange className="h-4 w-4 text-brand-700" />
                <span className="text-sm font-semibold text-brand-900">Horario por día</span>
                <HelpTooltip text="Activa solo los días en que el alumno asiste a la sede y define la hora de entrada y salida de cada uno. El calendario y la validación de check-in usan este horario." />
                <span className="text-xs text-gray-500">Activa los días de práctica y define la ventana horaria de cada uno.</span>
              </div>
              <div className="space-y-2">
                {days.map((d) => {
                  const dayLabel = DAYS.find((x) => x.weekday === d.weekday)?.label ?? '';
                  return (
                    <div key={d.weekday} className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2 w-28 shrink-0">
                        <Switch checked={d.enabled} onCheckedChange={(v) => setDay(d.weekday, { enabled: v })} aria-label={`Activar ${dayLabel}`} />
                        <span className={`text-sm ${d.enabled ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>{dayLabel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input type="time" value={d.from} disabled={!d.enabled} onChange={(e) => setDay(d.weekday, { from: e.target.value })} className="w-28" />
                        <span className="text-gray-400 text-sm">a</span>
                        <Input type="time" value={d.to} disabled={!d.enabled} onChange={(e) => setDay(d.weekday, { to: e.target.value })} className="w-28" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button type="submit" disabled={isSaving} className="bg-brand-800 hover:bg-brand-900 text-white shadow-sm shadow-brand-900/15">
                {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</> : <><ClipboardList className="w-4 h-4 mr-2" />{editingId ? 'Guardar cambios' : 'Crear asignación'}</>}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmación de eliminación */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-red-600" />Eliminar asignación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar la asignación de <strong>{deleteTarget ? (nameMaps.person.get(deleteTarget.student_id) ?? 'este alumno') : ''}</strong>? Se borrará también su horario. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingId)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()} disabled={Boolean(deletingId)} className="bg-red-600 hover:bg-red-700 text-white">
              {deletingId ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, required, help, children }: { label: string; required?: boolean; help?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-brand-700 flex items-center gap-1">
        {label}{required && <span className="text-red-500">*</span>}
        {help && <HelpTooltip text={help} />}
      </Label>
      {children}
    </div>
  );
}

function NativeSelect({
  value, onChange, options, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 rounded-md border border-brand-100 bg-white px-3 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-700/25 focus:border-brand-700"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
