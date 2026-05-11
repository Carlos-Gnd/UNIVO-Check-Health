import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { toast } from 'sonner';
import { CheckCircle, Clock, XCircle, MapPin, Navigation, AlertTriangle } from 'lucide-react';
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

  const gpsUnavailable = !navigator.geolocation || locationError !== null;
  const canCheckIn =
    !gpsUnavailable &&
    userLocation !== null &&
    (locationCheck === null || locationCheck.isInside);

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

    loadData();
    const student = students.find((s) => s.id === selectedStudent);
    toast.success(`Check-in registrado para ${student?.name}`);
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

    loadData();
    toast.success('Check-out registrado exitosamente');
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
