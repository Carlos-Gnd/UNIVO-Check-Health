import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Building2, CalendarDays, Clock, Loader2, MapPin, Phone, UserCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { supabase } from '@/shared/backend/supabaseClient';

type CampusInfo = {
  id: string;
  name: string;
  address: string;
  supervisorName: string;
  supervisorPhone: string;
  schedule: string;
  startDate: string;
  endDate: string;
  checkInFrom: string;
  checkInTo: string;
  lat: number;
  lng: number;
  isActive: boolean;
};

export function StudentAssignmentPage() {
  const [campus, setCampus] = useState<CampusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAttendances, setHasAttendances] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) { setLoading(false); return; }

      // Buscar la asistencia más reciente para obtener la sede asignada
      const { data: att } = await supabase
        .from('attendances')
        .select('campus_id, date')
        .eq('student_id', userId)
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (!att?.campus_id) {
        setHasAttendances(false);
        setLoading(false);
        return;
      }

      setHasAttendances(true);

      const { data: c } = await supabase
        .from('campuses')
        .select('id, name, location_label, supervisor_name, supervisor_phone, schedule, start_date, end_date, check_in_from, check_in_to, latitude, longitude, is_active')
        .eq('id', att.campus_id)
        .single();

      if (c) {
        setCampus({
          id: c.id as string,
          name: c.name as string,
          address: (c.location_label as string) ?? (c.name as string),
          supervisorName: (c.supervisor_name as string) ?? '—',
          supervisorPhone: (c.supervisor_phone as string) ?? '',
          schedule: (c.schedule as string) ?? '',
          startDate: (c.start_date as string) ?? '',
          endDate: (c.end_date as string) ?? '',
          checkInFrom: (c.check_in_from as string) ?? '',
          checkInTo: (c.check_in_to as string) ?? '',
          lat: Number(c.latitude),
          lng: Number(c.longitude),
          isActive: Boolean(c.is_active),
        });
      }

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

  if (!hasAttendances || !campus) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <h2 className="text-2xl font-semibold text-gray-900">Mi sede y encargado</h2>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Building2 className="w-10 h-10 text-gray-300" />
            <p className="text-sm text-gray-500">
              Aún no tienes registros de asistencia.<br />
              Tu sede aparecerá aquí una vez que realices tu primer check-in.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const isActive = campus.isActive && (!campus.endDate || campus.endDate >= today);

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h2 className="text-2xl font-semibold text-gray-900">Mi sede y encargado</h2>

      {/* Sede principal */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-700" />
            {campus.name}
          </CardTitle>
          <Badge className={isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}>
            {isActive ? 'Activa' : 'Inactiva'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start gap-2 text-gray-700">
            <MapPin className="w-4 h-4 text-brand-400 mt-0.5 shrink-0" />
            <span>{campus.address}</span>
          </div>

          {campus.schedule && (
            <div className="flex items-start gap-2 text-gray-700">
              <CalendarDays className="w-4 h-4 text-brand-400 mt-0.5 shrink-0" />
              <span>{campus.schedule}</span>
            </div>
          )}

          {(campus.checkInFrom || campus.checkInTo) && (
            <div className="flex items-center gap-2 text-gray-700">
              <Clock className="w-4 h-4 text-brand-400 shrink-0" />
              <span>
                Ventana de check-in:&nbsp;
                <strong>
                  {campus.checkInFrom ? campus.checkInFrom.slice(0, 5) : '—'}
                  {campus.checkInTo ? ` – ${campus.checkInTo.slice(0, 5)}` : ''}
                </strong>
              </span>
            </div>
          )}

          {campus.startDate && campus.endDate && (
            <div className="rounded-md bg-brand-50 px-3 py-2 text-xs text-brand-800">
              Período:&nbsp;
              <strong>{format(parseISO(campus.startDate), "d 'de' MMMM yyyy", { locale: es })}</strong>
              &nbsp;al&nbsp;
              <strong>{format(parseISO(campus.endDate), "d 'de' MMMM yyyy", { locale: es })}</strong>
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
          <p className="font-semibold text-gray-900">{campus.supervisorName}</p>
          {campus.supervisorPhone && (
            <div className="flex items-center gap-2 text-gray-600">
              <Phone className="w-4 h-4 text-brand-400 shrink-0" />
              <a href={`tel:${campus.supervisorPhone}`} className="hover:text-brand-700">
                {campus.supervisorPhone}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mini mapa embebido */}
      {campus.lat && campus.lng && (
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
              src={`https://maps.google.com/maps?q=${campus.lat},${campus.lng}&z=16&output=embed`}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
