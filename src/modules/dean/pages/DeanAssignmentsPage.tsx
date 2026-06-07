import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarRange, ClipboardList, Loader2, Pencil, Plus, RefreshCw, Trash2, UserCog } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Badge } from '@/shared/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Combobox } from '@/shared/components/ui/combobox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { toast } from 'sonner';
import { HelpTooltip } from '@/shared/components/HelpTooltip';
import { PageHeader } from '@/shared/components/PageHeader';
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

const emptyOptions: AssignmentOptions = { students: [], teachers: [], coordinators: [], campuses: [], subjects: [] };
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
  const [subjectId, setSubjectId] = useState('');
  const [period, setPeriod] = useState('2026-1');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [requiredHours, setRequiredHours] = useState('');
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
    const subject = new Map(options.subjects.map((s) => [s.id, `${s.code} - ${s.name}`]));
    return { person, campus, subject };
  }, [options]);

  const resetForm = () => {
    setEditingId(null);
    setStudentId(''); setTeacherId(''); setCoordinatorId(''); setCampusId(''); setSubjectId('');
    setPeriod('2026-1'); setStartDate(''); setEndDate(''); setRequiredHours('');
    setDays(defaultDays());
  };

  const openCreate = () => { resetForm(); setOpen(true); };

  const openEdit = (a: Assignment) => {
    setEditingId(a.id);
    setStudentId(a.student_id);
    setTeacherId(a.teacher_id);
    setCoordinatorId(a.coordinator_id ?? '');
    setCampusId(a.campus_id ?? '');
    setSubjectId(a.subject_id ?? '');
    setPeriod(a.period);
    setStartDate(a.start_date ?? '');
    setEndDate(a.end_date ?? '');
    setRequiredHours(a.required_hours != null ? String(a.required_hours) : '');
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
    if (!subjectId) { toast.error('La materia de practica es obligatoria.'); return; }
    if (!period.trim()) { toast.error('El periodo es obligatorio.'); return; }
    if (!periodPattern.test(period.trim())) { toast.error('Usa el formato de periodo AAAA-CICLO, por ejemplo 2026-1.'); return; }
    if (startDate && endDate && endDate < startDate) { toast.error('La fecha de fin no puede ser anterior al inicio.'); return; }
    const hoursTrim = requiredHours.trim();
    if (hoursTrim && (!(Number(hoursTrim) > 0))) { toast.error('Las horas requeridas deben ser un número mayor que 0.'); return; }

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
      subject_id: subjectId,
      period: period.trim(),
      start_date: startDate || null,
      end_date: endDate || null,
      required_hours: hoursTrim ? Number(hoursTrim) : null,
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
      <PageHeader
        title="Asignaciones"
        description="Asigna a cada alumno su sede, docente, coordinador y horario de práctica por día."
        action={(
        <>
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />Actualizar
          </Button>
          <Button className="bg-white/10 border border-white/20 text-white hover:bg-white/20" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />Nueva asignación
          </Button>
        </>
        )}
      />

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
                <div><span className="text-xs text-gray-400 uppercase tracking-wide">Materia</span><p className="text-gray-700 truncate">{a.subject_id ? (nameMaps.subject.get(a.subject_id) ?? '—') : '—'}</p></div>
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
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Materia</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Docente</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Coordinador</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Período</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Horario</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
            ) : assignments.length === 0 ? (
              <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-400">Sin asignaciones. Crea la primera con "Nueva asignación".</td></tr>
            ) : (
              assignments.map((a) => (
                <tr key={a.id} className="hover:bg-brand-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{nameMaps.person.get(a.student_id) ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{a.campus_id ? (nameMaps.campus.get(a.campus_id) ?? '—') : '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{a.subject_id ? (nameMaps.subject.get(a.subject_id) ?? '—') : '—'}</td>
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
                <Combobox value={studentId} onChange={setStudentId} placeholder="Selecciona alumno" options={options.students.map((s) => ({ value: s.id, label: s.label }))} />
              </Field>
              <Field label="Sede de práctica" required>
                <Combobox value={campusId} onChange={setCampusId} placeholder="Selecciona sede" options={options.campuses.map((c) => ({ value: c.id, label: c.name }))} />
              </Field>
              <Field label="Materia de práctica" required help="La asignación se bloquea si el alumno no cumple el nivel académico mínimo o los prerrequisitos de esta materia.">
                <Combobox
                  value={subjectId}
                  onChange={setSubjectId}
                  placeholder="Selecciona materia"
                  options={options.subjects.map((s) => ({
                    value: s.id,
                    label: `${s.code} - ${s.name}${s.min_academic_level != null ? ` · Nivel ${s.min_academic_level}+` : ''}`,
                  }))}
                />
              </Field>
              <Field label="Docente supervisor" required>
                <Combobox value={teacherId} onChange={setTeacherId} placeholder="Selecciona docente" options={options.teachers.map((t) => ({ value: t.id, label: t.label }))} />
              </Field>
              <Field label="Coordinador" help="Persona que supervisa la asignación a nivel administrativo y revisa incidencias. Puede ser un coordinador o el decano.">
                <Combobox value={coordinatorId} onChange={setCoordinatorId} placeholder="Selecciona coordinador" options={options.coordinators.map((c) => ({ value: c.id, label: c.label }))} />
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
              <Field label="Horas requeridas del ciclo" help="Horas de práctica que este alumno debe cumplir en este ciclo. No todos los alumnos tienen las mismas. Déjalo vacío para usar las horas por defecto de la materia.">
                <Input
                  type="number" min={1} step="0.5" value={requiredHours}
                  onChange={(e) => setRequiredHours(e.target.value)}
                  placeholder="Por defecto de la materia (p. ej. 240)"
                />
              </Field>
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

