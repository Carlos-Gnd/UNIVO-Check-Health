import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Building2, CalendarDays, Clock, Loader2, MapPin, Phone, UserCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { supabase } from '@/shared/backend/supabaseClient';
import { PageHeader } from '@/shared/components/PageHeader';

const DAY_NAMES = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']; // index = ISO weekday

type DaySlot = { weekday: number; from: string; to: string };

type Assignment = {
  campusName: string;
  address: string;
  supervisorName: string;
  supervisorPhone: string;
  period: string;
  startDate: string;
  endDate: string;
  lat: number;
  lng: number;
  campusActive: boolean;
  slots: DaySlot[];
};

// Filas de teacher_groups con sede + horario embebidos (RLS acota a la propia asignación).
type AssignmentRow = {
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
  schedules: { weekday: number; check_in_from: string | null; check_in_to: string | null }[] | null;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StudentAssignmentPage() {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) { setLoading(false); return; }

      const { data } = await supabase
        .from('teacher_groups')
        .select(`
          period, start_date, end_date,
          campus:campuses(name, location_label, supervisor_name, supervisor_phone, latitude, longitude, is_active),
          schedules:student_schedules(weekday, check_in_from, check_in_to)
        `)
        .eq('student_id', userId);

      const rows = (data ?? []) as unknown as AssignmentRow[];
      if (rows.length === 0) { setLoading(false); return; }

      // Elegir la rotación vigente hoy; si ninguna, la de fin más reciente.
      const today = todayIso();
      const active = rows.find(
        (r) => (!r.start_date || r.start_date <= today) && (!r.end_date || r.end_date >= today),
      );
      const chosen = active ?? [...rows].sort((a, b) => (b.end_date ?? '').localeCompare(a.end_date ?? ''))[0];

      const slots: DaySlot[] = (chosen.schedules ?? [])
        .filter((s) => s.check_in_from && s.check_in_to)
        .map((s) => ({ weekday: s.weekday, from: (s.check_in_from ?? '').slice(0, 5), to: (s.check_in_to ?? '').slice(0, 5) }))
        .sort((a, b) => a.weekday - b.weekday);

      setAssignment({
        campusName: chosen.campus?.name ?? 'Sede sin nombre',
        address: chosen.campus?.location_label ?? chosen.campus?.name ?? '',
        supervisorName: chosen.campus?.supervisor_name ?? '—',
        supervisorPhone: chosen.campus?.supervisor_phone ?? '',
        period: chosen.period,
        startDate: chosen.start_date ?? '',
        endDate: chosen.end_date ?? '',
        lat: Number(chosen.campus?.latitude ?? 0),
        lng: Number(chosen.campus?.longitude ?? 0),
        campusActive: Boolean(chosen.campus?.is_active),
        slots,
      });
      setLoading(false);
    };

    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Cargando tu sede…</span>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <PageHeader title="Mi sede y encargado" description="Consulta tu sede asignada, horario y doctor encargado." />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Building2 className="w-10 h-10 text-gray-300" />
            <p className="text-sm text-gray-500">
              Aún no tienes una sede asignada.<br />
              Tu coordinador asignará tu sede, docente y horario de práctica.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const today = todayIso();
  const isActive = assignment.campusActive && (!assignment.endDate || assignment.endDate >= today);

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <PageHeader title="Mi sede y encargado" description="Consulta tu sede asignada, horario y doctor encargado." />

      {/* Sede principal */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-700" />
            {assignment.campusName}
          </CardTitle>
          <Badge className={isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}>
            {isActive ? 'Activa' : 'Inactiva'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start gap-2 text-gray-700">
            <MapPin className="w-4 h-4 text-brand-400 mt-0.5 shrink-0" />
            <span>{assignment.address}</span>
          </div>

          {assignment.slots.length > 0 && (
            <div className="flex items-start gap-2 text-gray-700">
              <CalendarDays className="w-4 h-4 text-brand-400 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <p className="font-medium text-gray-800">Horario de práctica</p>
                {assignment.slots.map((s) => (
                  <div key={s.weekday} className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                    <span className="w-20 shrink-0">{DAY_NAMES[s.weekday]}</span>
                    <strong>{s.from} – {s.to}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {assignment.startDate && assignment.endDate && (
            <div className="rounded-md bg-brand-50 px-3 py-2 text-xs text-brand-800">
              Período <strong>{assignment.period}</strong>:&nbsp;
              <strong>{format(parseISO(assignment.startDate), "d 'de' MMMM yyyy", { locale: es })}</strong>
              &nbsp;al&nbsp;
              <strong>{format(parseISO(assignment.endDate), "d 'de' MMMM yyyy", { locale: es })}</strong>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Doctor / supervisor */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCircle className="w-4 h-4 text-brand-700" />
            Doctor encargado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="font-semibold text-gray-900">{assignment.supervisorName}</p>
          {assignment.supervisorPhone && (
            <div className="flex items-center gap-2 text-gray-600">
              <Phone className="w-4 h-4 text-brand-400 shrink-0" />
              <a href={`tel:${assignment.supervisorPhone}`} className="hover:text-brand-700">
                {assignment.supervisorPhone}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mini mapa embebido */}
      {assignment.lat !== 0 && assignment.lng !== 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-brand-700" />
              Ubicación
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-hidden rounded-b-xl">
            <iframe
              title="Ubicación de la sede"
              className="w-full h-48"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://maps.google.com/maps?q=${assignment.lat},${assignment.lng}&z=16&output=embed`}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
