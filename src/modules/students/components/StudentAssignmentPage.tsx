import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Building2, CalendarDays, Clock, Loader2, MapPin, Phone, UserCircle, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { supabase } from '@/shared/backend/supabaseClient';
import { PageHeader } from '@/shared/components/PageHeader';

const DAY_NAMES = ['', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];

type DaySlot = { weekday: number; from: string; to: string };

type Assignment = {
  id: string;
  campusName: string;
  subjectName: string;
  subjectCode: string | null;
  requiredHours: number | null;
  address: string;
  supervisorName: string;
  supervisorPhone: string;
  teacherName: string;
  coordinatorName: string;
  period: string;
  startDate: string;
  endDate: string;
  lat: number;
  lng: number;
  campusActive: boolean;
  slots: DaySlot[];
};

type AssignmentRow = {
  id: string;
  period: string;
  start_date: string | null;
  end_date: string | null;
  campus: {
    name: string | null;
    location_label: string | null;
    supervisor_name: string | null;
    supervisor_phone: string | null;
    latitude: number | null;
    longitude: number | null;
    is_active: boolean | null;
  } | null;
  subject: {
    code: string | null;
    name: string | null;
    required_hours: number | null;
  } | null;
  teacher: { full_name: string | null } | null;
  coordinator: { full_name: string | null } | null;
  schedules: { weekday: number; check_in_from: string | null; check_in_to: string | null }[] | null;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isAssignmentActive(assignment: Assignment, today: string): boolean {
  return assignment.campusActive && (!assignment.startDate || assignment.startDate <= today) && (!assignment.endDate || assignment.endDate >= today);
}

export function StudentAssignmentPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('teacher_groups')
        .select(`
          id, period, start_date, end_date,
          campus:campuses(name, location_label, supervisor_name, supervisor_phone, latitude, longitude, is_active),
          subject:subjects(code, name, required_hours),
          teacher:users!teacher_groups_teacher_id_fkey(full_name),
          coordinator:users!teacher_groups_coordinator_id_fkey(full_name),
          schedules:student_schedules(weekday, check_in_from, check_in_to)
        `)
        .eq('student_id', userId);

      const rows = ((data ?? []) as unknown as AssignmentRow[])
        .map((row) => {
          const slots: DaySlot[] = (row.schedules ?? [])
            .filter((s) => s.check_in_from && s.check_in_to)
            .map((s) => ({
              weekday: s.weekday,
              from: (s.check_in_from ?? '').slice(0, 5),
              to: (s.check_in_to ?? '').slice(0, 5),
            }))
            .sort((a, b) => a.weekday - b.weekday);

          return {
            id: row.id,
            campusName: row.campus?.name ?? 'Sede sin nombre',
            subjectName: row.subject?.name ?? 'Practica sin materia',
            subjectCode: row.subject?.code ?? null,
            requiredHours: row.subject?.required_hours ?? null,
            address: row.campus?.location_label ?? row.campus?.name ?? '',
            supervisorName: row.campus?.supervisor_name ?? '-',
            supervisorPhone: row.campus?.supervisor_phone ?? '',
            teacherName: row.teacher?.full_name ?? '-',
            coordinatorName: row.coordinator?.full_name ?? '-',
            period: row.period,
            startDate: row.start_date ?? '',
            endDate: row.end_date ?? '',
            lat: Number(row.campus?.latitude ?? 0),
            lng: Number(row.campus?.longitude ?? 0),
            campusActive: Boolean(row.campus?.is_active),
            slots,
          };
        })
        .sort((a, b) => {
          const today = todayIso();
          const activeDelta = Number(isAssignmentActive(b, today)) - Number(isAssignmentActive(a, today));
          if (activeDelta !== 0) return activeDelta;
          return (a.endDate || '9999-12-31').localeCompare(b.endDate || '9999-12-31');
        });

      setAssignments(rows);
      setLoading(false);
    };

    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Cargando tus asignaciones...</span>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <PageHeader title="Mis sedes y materias" description="Consulta tus sedes, materias, horarios y responsables asignados." />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Building2 className="w-10 h-10 text-gray-300" />
            <p className="text-sm text-gray-500">
              Aun no tienes asignaciones registradas.
              <br />
              Tu coordinador asignara tus sedes, materias, docentes y horarios.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const today = todayIso();

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <PageHeader title="Mis sedes y materias" description="Asignaciones activas, horarios y responsables por materia." />

      <div className="grid gap-4 lg:grid-cols-2">
        {assignments.map((assignment) => {
          const active = isAssignmentActive(assignment, today);
          return (
            <Card key={assignment.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <CardTitle className="text-base flex items-start gap-2">
                  <BookOpen className="w-4 h-4 text-brand-700 mt-0.5 shrink-0" />
                  <span>
                    {assignment.subjectCode && <span className="text-brand-700">{assignment.subjectCode} - </span>}
                    {assignment.subjectName}
                  </span>
                </CardTitle>
                <Badge className={active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}>
                  {active ? 'Activa' : 'Inactiva'}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-2 text-gray-700">
                  <Building2 className="w-4 h-4 text-brand-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">{assignment.campusName}</p>
                    <p className="text-gray-600">{assignment.address}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 rounded-md border border-brand-100 bg-brand-50/50 px-3 py-2 text-xs text-brand-900 sm:grid-cols-2">
                  <span>Docente: <strong>{assignment.teacherName}</strong></span>
                  <span>Coordinador: <strong>{assignment.coordinatorName}</strong></span>
                  {assignment.requiredHours && <span>Meta: <strong>{assignment.requiredHours} h</strong></span>}
                  <span>Periodo: <strong>{assignment.period}</strong></span>
                </div>

                {assignment.slots.length > 0 && (
                  <div className="flex items-start gap-2 text-gray-700">
                    <CalendarDays className="w-4 h-4 text-brand-400 mt-0.5 shrink-0" />
                    <div className="space-y-0.5">
                      <p className="font-medium text-gray-800">Horario de practica</p>
                      {assignment.slots.map((slot) => (
                        <div key={slot.weekday} className="flex items-center gap-2 text-gray-600">
                          <Clock className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                          <span className="w-20 shrink-0">{DAY_NAMES[slot.weekday]}</span>
                          <strong>{slot.from} - {slot.to}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {assignment.startDate && assignment.endDate && (
                  <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    <strong>{format(parseISO(assignment.startDate), "d 'de' MMMM yyyy", { locale: es })}</strong>
                    {' '}al{' '}
                    <strong>{format(parseISO(assignment.endDate), "d 'de' MMMM yyyy", { locale: es })}</strong>
                  </div>
                )}

                <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="flex items-center gap-1.5 font-semibold text-gray-900">
                      <UserCircle className="w-4 h-4 text-brand-700" />
                      Encargado de sede
                    </p>
                    <p className="text-gray-700">{assignment.supervisorName}</p>
                    {assignment.supervisorPhone && (
                      <a href={`tel:${assignment.supervisorPhone}`} className="inline-flex items-center gap-1.5 text-xs text-brand-700 hover:underline">
                        <Phone className="w-3.5 h-3.5" />
                        {assignment.supervisorPhone}
                      </a>
                    )}
                  </div>
                  {assignment.lat !== 0 && assignment.lng !== 0 && (
                    <a
                      href={`https://maps.google.com/?q=${assignment.lat},${assignment.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-brand-700 hover:underline"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      Abrir ubicacion
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
