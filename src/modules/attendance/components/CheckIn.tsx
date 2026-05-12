import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { toast } from 'sonner';
import { CheckCircle, Clock, XCircle, MapPin, Navigation, AlertTriangle, Users, ArrowRightLeft } from 'lucide-react';
import { getStudents } from '@/modules/students/services/students.service';
import { getPractices } from '@/modules/practices/services/practices.service';
import { getAttendance } from '../services/attendance.service';
import {
  getTrustedPracticeLocation,
  registerStudentCheckIn,
  registerStudentCheckOut,
  checkLocationVsPractice,
} from '@/shared/backend/checkHealthBackend';
import { Student } from '@/modules/students/types';
import { Practice } from '@/modules/practices/types';
import { Attendance, GeoPoint } from '../types';
import { format } from 'date-fns';

const DEVICE_ID_STORAGE_KEY = 'checkhealth-device-id';

const getDeviceId = () => {
  const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;
  const deviceId = `device_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  return deviceId;
};

// T-03.6: Calcula tiempo transcurrido desde check-in usando hora del servidor
function formatElapsed(checkInIso: string, now: Date): string {
  const ms = Math.max(0, now.getTime() - new Date(checkInIso).getTime());
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// T-03.5: Radar SVG que muestra posición del estudiante vs área de cobertura de la sede
function LocationRadarMap({
  userLocation,
  radiusMeters,
  center,
  distance,
  isInside,
}: {
  userLocation: GeoPoint;
  radiusMeters: number;
  center: GeoPoint;
  distance: number;
  isInside: boolean;
}) {
  const SIZE = 200;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const DISPLAY_RADIUS = 55;
  const scale = DISPLAY_RADIUS / (radiusMeters * 3);

  const latDiff = (userLocation.latitude - center.latitude) * 111000;
  const lngDiff =
    (userLocation.longitude - center.longitude) *
    111000 *
    Math.cos((center.latitude * Math.PI) / 180);

  const MAX_PX = SIZE / 2 - 14;
  const rawX = cx + lngDiff * scale;
  const rawY = cy - latDiff * scale;
  const dotX = Math.max(cx - MAX_PX, Math.min(cx + MAX_PX, rawX));
  const dotY = Math.max(cy - MAX_PX, Math.min(cy + MAX_PX, rawY));

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="mx-auto block"
      aria-label="Mapa de cobertura de la sede"
    >
      <circle cx={cx} cy={cy} r={SIZE / 2 - 2} fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
      <line x1={cx} y1={8} x2={cx} y2={SIZE - 8} stroke="#e2e8f0" strokeWidth="0.5" />
      <line x1={8} y1={cy} x2={SIZE - 8} y2={cy} stroke="#e2e8f0" strokeWidth="0.5" />
      <circle cx={cx} cy={cy} r={DISPLAY_RADIUS * 2} fill="none" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="4 3" />
      <circle cx={cx} cy={cy} r={DISPLAY_RADIUS} fill="rgba(34,197,94,0.12)" stroke="#22c55e" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r={6} fill="#3b82f6" />
      <circle cx={cx} cy={cy} r={3} fill="white" />
      <circle cx={dotX} cy={dotY} r={8} fill={isInside ? '#22c55e' : '#ef4444'} stroke="white" strokeWidth="2" />
      <text x={cx + DISPLAY_RADIUS + 3} y={cy - 2} fontSize="8" fill="#64748b">{radiusMeters}m</text>
      <text x={cx} y={SIZE - 6} textAnchor="middle" fontSize="9" fill={isInside ? '#16a34a' : '#dc2626'}>
        {isInside ? 'Dentro del área permitida' : `A ${distance} m del área`}
      </text>
    </svg>
  );
}


// T-03.7: Evento del feed en tiempo real
function FeedEvent({ event }: {
  event: {
    studentName: string;
    practiceName: string;
    time: string;
    type: 'checkin' | 'checkout';
    isNew?: boolean;
  };
}) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-500 ${
      event.isNew ? 'bg-blue-50 border-blue-200 animate-in slide-in-from-top-2' : 'bg-gray-50 border-transparent'
    }`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        event.type === 'checkin' ? 'bg-green-100' : 'bg-orange-100'
      }`}>
        {event.type === 'checkin'
          ? <CheckCircle className="w-4 h-4 text-green-600" />
          : <XCircle className="w-4 h-4 text-orange-600" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{event.studentName}</p>
        <p className="text-xs text-gray-500 truncate">{event.practiceName}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-mono text-gray-500">{event.time}</p>
        <Badge variant="outline" className={`text-xs mt-0.5 ${
          event.type === 'checkin' ? 'text-green-700 border-green-200' : 'text-orange-700 border-orange-200'
        }`}>
          {event.type === 'checkin' ? 'Entrada' : 'Salida'}
        </Badge>
      </div>
    </div>
  );
}

export function CheckIn() {
  const [students, setStudents] = useState<Student[]>([]);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedPractice, setSelectedPractice] = useState('');
  const [notes, setNotes] = useState('');
  const [todayAttendance, setTodayAttendance] = useState<Attendance[]>([]);

  // T-03.5 — estado de ubicación GPS
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationCheck, setLocationCheck] = useState<{
    distance: number;
    isInside: boolean;
    radiusMeters: number;
    center: GeoPoint;
  } | null>(null);

  // T-03.6 — reloj del servidor (sincronizado, no almacenado en browser)
  const [serverTime, setServerTime] = useState(new Date());
  // T-03.7: feed de eventos en tiempo real (máx 20)
  const [feedEvents, setFeedEvents] = useState<Array<{
    id: string;
    studentName: string;
    practiceName: string;
    time: string;
    type: 'checkin' | 'checkout';
    isNew?: boolean;
  }>>([]);
  const feedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [feedOnline, setFeedOnline] = useState(navigator.onLine);

  const loadData = useCallback(() => {
    setStudents(getStudents());
    setPractices(getPractices());
    const today = format(new Date(), 'yyyy-MM-dd');
    const attendance = getAttendance();
    setTodayAttendance(attendance.filter((a) => a.date === today));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // T-03.6 — tick de 1 segundo usando hora real del servidor (no se persiste en browser)
  useEffect(() => {
    const tick = window.setInterval(() => setServerTime(new Date()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  // T-03.5 — polling de GPS cada 10 segundos
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('GPS no disponible en este dispositivo');
      return;
    }

    const fetchLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyMeters: pos.coords.accuracy,
          });
          setLocationError(null);
        },
        (err) =>
          setLocationError(
            err.code === 1 ? 'Permiso de ubicación denegado' : 'No se pudo obtener la ubicación',
          ),
        { timeout: 8000, maximumAge: 5000 },
      );
    };

    fetchLocation();
    const locationInterval = window.setInterval(fetchLocation, 10000);
    return () => window.clearInterval(locationInterval);
  }, []);

  // T-03.5 — valida si el estudiante está dentro del área al cambiar práctica o posición
  useEffect(() => {
    if (!selectedPractice || !userLocation) {
      setLocationCheck(null);
      return;
    }
    setLocationCheck(checkLocationVsPractice(selectedPractice, userLocation));
  }, [selectedPractice, userLocation]);


  // T-03.7: reconexión automática + construcción del feed desde asistencias del día
  useEffect(() => {
    const handleOnline = () => setFeedOnline(true);
    const handleOffline = () => setFeedOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // T-03.7: reconstruir feed cada vez que cambian las asistencias del día
  useEffect(() => {
    const events: typeof feedEvents = [];
    todayAttendance.forEach((a) => {
      const student = students.find((s) => s.id === a.studentId);
      const practice = practices.find((p) => p.id === a.practiceId);
      const name = student?.name ?? 'Desconocido';
      const pname = practice?.name ?? 'Desconocido';
      events.push({
        id: a.id + '-in',
        studentName: name,
        practiceName: pname,
        time: format(new Date(a.checkIn), 'HH:mm'),
        type: 'checkin',
      });
      if (a.checkOut) {
        events.push({
          id: a.id + '-out',
          studentName: name,
          practiceName: pname,
          time: format(new Date(a.checkOut), 'HH:mm'),
          type: 'checkout',
        });
      }
    });
    events.sort((a, b) => b.time.localeCompare(a.time));
    setFeedEvents(events.slice(0, 20));
  }, [todayAttendance, students, practices]);

  const gpsUnavailable = !navigator.geolocation || locationError !== null;
  const canCheckIn =
    !gpsUnavailable &&
    userLocation !== null &&
    (locationCheck === null || locationCheck.isInside);

  // T-03.7: agrega un evento nuevo al feed con animación
  const pushFeedEvent = (event: typeof feedEvents[0]) => {
    setFeedEvents((prev) => {
      const next = [{ ...event, isNew: true }, ...prev].slice(0, 20);
      if (feedTimerRef.current) clearTimeout(feedTimerRef.current);
      feedTimerRef.current = setTimeout(() => {
        setFeedEvents((cur) => cur.map((e) => ({ ...e, isNew: false })));
      }, 2000);
      return next;
    });
  };

    const handleCheckIn = () => {
    if (!selectedStudent || !selectedPractice) {
      toast.error('Por favor selecciona un estudiante y una práctica');
      return;
    }
    if (!userLocation) {
      toast.error('Se requiere ubicación GPS para registrar asistencia');
      return;
    }

    const existing = todayAttendance.find(
      (a) => a.studentId === selectedStudent && a.practiceId === selectedPractice,
    );
    if (existing && !existing.checkOut) {
      toast.error('Este estudiante ya tiene un check-in activo');
      return;
    }

    const result = registerStudentCheckIn({
      studentId: selectedStudent,
      practiceId: selectedPractice,
      notes: notes || undefined,
      location: userLocation,
      deviceId: getDeviceId(),
    });

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    const student = students.find((s) => s.id === selectedStudent);
    const practice = practices.find((p) => p.id === selectedPractice);
    const timeStr = format(new Date(), 'HH:mm');
    loadData();
    toast.success(`Check-in registrado para ${student?.name}`);
    // T-03.7: agregar al feed
    pushFeedEvent({
      id: Date.now().toString() + '-in',
      studentName: student?.name ?? 'Desconocido',
      practiceName: practice?.name ?? 'Desconocido',
      time: timeStr,
      type: 'checkin',
    });
    setSelectedStudent('');
    setSelectedPractice('');
    setNotes('');
  };

  const handleCheckOut = (attendanceId: string) => {
    const attendance = todayAttendance.find((a) => a.id === attendanceId);
    if (!attendance) {
      toast.error('No se encontró el registro activo');
      return;
    }

    const result = registerStudentCheckOut({
      attendanceId,
      location: getTrustedPracticeLocation(attendance.practiceId),
      deviceId: getDeviceId(),
    });

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    const rec = todayAttendance.find((a) => a.id === attendanceId);
    const studentName = students.find((s) => s.id === rec?.studentId)?.name ?? 'Desconocido';
    const practiceName = practices.find((p) => p.id === rec?.practiceId)?.name ?? 'Desconocido';
    loadData();
    toast.success('Check-out registrado exitosamente');
    // T-03.7: agregar checkout al feed
    pushFeedEvent({
      id: attendanceId + '-out',
      studentName,
      practiceName,
      time: format(new Date(), 'HH:mm'),
      type: 'checkout',
    });
  };

  const activeCheckIns = todayAttendance
    .filter((a) => !a.checkOut)
    .map((a) => ({
      ...a,
      studentName: students.find((s) => s.id === a.studentId)?.name,
      practiceName: practices.find((p) => p.id === a.practiceId)?.name,
    }));

  const showRadar = Boolean(selectedPractice && userLocation && locationCheck);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Registro de Asistencia</h2>
        <p className="text-sm text-gray-600 mt-1">
          Registra la entrada y salida de estudiantes en prácticas
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulario de check-in */}
        <Card>
          <CardHeader>
            <CardTitle>Nuevo Registro</CardTitle>
            <CardDescription>Completa la información para registrar asistencia</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="student">Estudiante</Label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger id="student">
                  <SelectValue placeholder="Selecciona un estudiante" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name} - {student.carnet}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="practice">Práctica</Label>
              <Select value={selectedPractice} onValueChange={setSelectedPractice}>
                <SelectTrigger id="practice">
                  <SelectValue placeholder="Selecciona una práctica" />
                </SelectTrigger>
                <SelectContent>
                  {practices.map((practice) => (
                    <SelectItem key={practice.id} value={practice.id}>
                      {practice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Observaciones adicionales..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* T-03.5 — Mapa radar de cobertura */}
            {showRadar && locationCheck && userLocation && (
              <div className="rounded-lg border bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  Área de cobertura · sede asignada
                </p>
                <LocationRadarMap
                  userLocation={userLocation}
                  radiusMeters={locationCheck.radiusMeters}
                  center={locationCheck.center}
                  distance={locationCheck.distance}
                  isInside={locationCheck.isInside}
                />
                <p className="text-xs text-gray-400 text-center mt-1">
                  Ubicación actualizada cada 10 s
                </p>
              </div>
            )}

            {/* T-03.5 — Estado de ubicación */}
            <div
              className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
                gpsUnavailable
                  ? 'bg-red-50 text-red-700'
                  : locationCheck === null
                    ? 'bg-gray-50 text-gray-600'
                    : locationCheck.isInside
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
              }`}
            >
              {gpsUnavailable ? (
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <Navigation className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <span>
                {locationError
                  ? locationError
                  : !navigator.geolocation
                    ? 'GPS no disponible en este dispositivo'
                    : !userLocation
                      ? 'Obteniendo ubicación GPS…'
                      : !selectedPractice
                        ? 'Selecciona una práctica para validar tu ubicación'
                        : locationCheck?.isInside
                          ? 'Dentro del área permitida — check-in habilitado'
                          : `Fuera del área (${locationCheck?.distance ?? '—'} m) — acércate a la sede`}
              </span>
            </div>

            <Button
              onClick={handleCheckIn}
              className="w-full"
              disabled={!selectedStudent || !selectedPractice || !canCheckIn}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Registrar Check-In
            </Button>

            {gpsUnavailable && (
              <p className="text-xs text-center text-red-500">
                Sin GPS habilitado no es posible registrar asistencia
              </p>
            )}
          </CardContent>
        </Card>

        {/* Check-Ins Activos con reloj T-03.6 */}
        <Card>
          <CardHeader>
            <CardTitle>Check-Ins Activos</CardTitle>
            <CardDescription>Estudiantes que aún no han hecho check-out</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeCheckIns.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No hay check-ins activos
                </p>
              ) : (
                activeCheckIns.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{record.studentName}</p>
                      <p className="text-xs text-gray-500">{record.practiceName}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Entrada: {format(new Date(record.checkIn), 'HH:mm')}
                      </p>
                      {/* T-03.6 — Reloj de jornada sincronizado con hora del servidor */}
                      <p className="text-xs font-mono font-semibold text-blue-600 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatElapsed(record.checkIn, serverTime)}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleCheckOut(record.id)}
                      size="sm"
                      variant="outline"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Check-Out
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>


      {/* T-03.7: Feed de actividad en tiempo real del grupo */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Actividad del Grupo — Tiempo Real
              </CardTitle>
              <CardDescription>
                Últimos 20 eventos del día · Se actualiza automáticamente
              </CardDescription>
            </div>
            <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${
              feedOnline
                ? 'text-green-600 bg-green-50 border-green-200'
                : 'text-red-500 bg-red-50 border-red-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full inline-block ${
                feedOnline ? 'bg-green-500 animate-pulse' : 'bg-red-400'
              }`} />
              {feedOnline ? 'En vivo' : 'Sin conexión'}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {feedEvents.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">
              <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No hay eventos hoy todavía
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {feedEvents.map((event) => (
                <FeedEvent key={event.id} event={event} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumen del Día */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen del Día</CardTitle>
          <CardDescription>
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-900">Presentes</span>
              </div>
              <p className="text-2xl font-semibold text-green-900">
                {todayAttendance.filter((a) => a.status === 'present').length}
              </p>
            </div>

            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-5 h-5 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-900">Tardanzas</span>
              </div>
              <p className="text-2xl font-semibold text-yellow-900">
                {todayAttendance.filter((a) => a.status === 'late').length}
              </p>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Activos</span>
              </div>
              <p className="text-2xl font-semibold text-blue-900">
                {todayAttendance.filter((a) => !a.checkOut).length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
