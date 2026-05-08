import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { Badge } from '@/shared/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle, Clock, XCircle, Wifi, Monitor, MapPin, Users, ArrowRightLeft } from 'lucide-react';
import { getStudents } from '@/modules/students/services/students.service';
import { getPractices } from '@/modules/practices/services/practices.service';
import { getAttendance, getDeviceInfo } from '../services/attendance.service';
import { getTrustedPracticeLocation, registerStudentCheckIn, registerStudentCheckOut } from '@/shared/backend/checkHealthBackend';
import { Student } from '@/modules/students/types';
import { Practice } from '@/modules/practices/types';
import { Attendance } from '../types';
import { format } from 'date-fns';

const DEVICE_ID_STORAGE_KEY = 'checkhealth-device-id';

const getDeviceId = () => {
  const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;
  const deviceId = `device_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  return deviceId;
};

// T-05.2: Confirmación visual animada
function CheckInSuccess({ studentName, time, onDone }: { studentName: string; time: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="flex flex-col items-center justify-center py-8 animate-in fade-in zoom-in duration-300">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4 animate-in zoom-in duration-500">
        <CheckCircle className="w-12 h-12 text-green-600" />
      </div>
      <p className="text-lg font-semibold text-gray-900">¡Check-in registrado!</p>
      <p className="text-sm text-gray-600 mt-1">{studentName}</p>
      <p className="text-xs text-gray-400 mt-2 font-mono bg-gray-50 px-3 py-1 rounded-full">{time}</p>
    </div>
  );
}

// T-03.7: Evento del feed en tiempo real
function FeedEvent({ event }: { event: { studentName: string; practiceName: string; time: string; type: 'checkin' | 'checkout'; isNew?: boolean } }) {
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
  // T-05.2: confirmación visual
  const [successInfo, setSuccessInfo] = useState<{ name: string; time: string } | null>(null);
  // T-03.7: feed en tiempo real (máx 20)
  const [feedEvents, setFeedEvents] = useState<Array<{
    id: string; studentName: string; practiceName: string; time: string; type: 'checkin' | 'checkout'; isNew?: boolean;
  }>>([]);
  const feedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadData = () => {
    const loadedStudents = getStudents();
    const loadedPractices = getPractices();
    setStudents(loadedStudents);
    setPractices(loadedPractices);

    const today = format(new Date(), 'yyyy-MM-dd');
    const attendance = getAttendance();
    const todayRec = attendance.filter(a => a.date === today);
    setTodayAttendance(todayRec);

    // Construir feed desde registros del día, ordenado desc, máx 20
    const events: typeof feedEvents = [];
    todayRec.forEach(a => {
      const student = loadedStudents.find(s => s.id === a.studentId);
      const practice = loadedPractices.find(p => p.id === a.practiceId);
      const name = student?.name ?? 'Desconocido';
      const pname = practice?.name ?? 'Desconocido';
      events.push({ id: a.id + '-in', studentName: name, practiceName: pname, time: format(new Date(a.checkIn), 'HH:mm'), type: 'checkin' });
      if (a.checkOut) {
        events.push({ id: a.id + '-out', studentName: name, practiceName: pname, time: format(new Date(a.checkOut), 'HH:mm'), type: 'checkout' });
      }
    });
    events.sort((a, b) => b.time.localeCompare(a.time));
    setFeedEvents(events.slice(0, 20));
  };

  const pushFeedEvent = (event: typeof feedEvents[0]) => {
    setFeedEvents(prev => {
      const next = [{ ...event, isNew: true }, ...prev].slice(0, 20);
      if (feedTimerRef.current) clearTimeout(feedTimerRef.current);
      feedTimerRef.current = setTimeout(() => {
        setFeedEvents(cur => cur.map(e => ({ ...e, isNew: false })));
      }, 2000);
      return next;
    });
  };

  const handleCheckIn = () => {
    if (!selectedStudent || !selectedPractice) {
      toast.error('Por favor selecciona un estudiante y una práctica');
      return;
    }

    const existing = todayAttendance.find(
      a => a.studentId === selectedStudent && a.practiceId === selectedPractice
    );
    if (existing && !existing.checkOut) {
      toast.error('Este estudiante ya tiene un check-in activo');
      return;
    }

    // T-04.3: capturar info del dispositivo
    const deviceInfo = getDeviceInfo();

    const result = registerStudentCheckIn({
      studentId: selectedStudent,
      practiceId: selectedPractice,
      notes: notes || undefined,
      location: getTrustedPracticeLocation(selectedPractice),
      deviceId: getDeviceId(),
    });

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    // Guardar deviceInfo en el registro creado
    if (result.attendance) {
      const { updateAttendance } = require('../services/attendance.service');
      updateAttendance(result.attendance.id, { deviceInfo });
    }

    const student = students.find(s => s.id === selectedStudent);
    const practice = practices.find(p => p.id === selectedPractice);
    const timeStr = format(new Date(), 'HH:mm');

    // T-05.2: mostrar confirmación visual
    setSuccessInfo({ name: student?.name ?? '', time: timeStr });

    // T-03.7: agregar al feed
    pushFeedEvent({
      id: (result.attendance?.id ?? Date.now().toString()) + '-in',
      studentName: student?.name ?? 'Desconocido',
      practiceName: practice?.name ?? 'Desconocido',
      time: timeStr,
      type: 'checkin',
    });

    loadData();
    setSelectedStudent('');
    setSelectedPractice('');
    setNotes('');
  };

  const handleCheckOut = (attendanceId: string) => {
    const attendance = todayAttendance.find(a => a.id === attendanceId);

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

    const student = students.find(s => s.id === attendance.studentId);
    const practice = practices.find(p => p.id === attendance.practiceId);
    const timeStr = format(new Date(), 'HH:mm');

    // T-03.7: agregar checkout al feed
    pushFeedEvent({
      id: attendanceId + '-out',
      studentName: student?.name ?? 'Desconocido',
      practiceName: practice?.name ?? 'Desconocido',
      time: timeStr,
      type: 'checkout',
    });

    loadData();
    toast.success('Check-out registrado exitosamente');
  };

  const getActiveCheckIns = () => {
    return todayAttendance
      .filter(a => !a.checkOut)
      .map(a => {
        const student = students.find(s => s.id === a.studentId);
        const practice = practices.find(p => p.id === a.practiceId);
        return { ...a, studentName: student?.name, practiceName: practice?.name };
      });
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Registro de Asistencia</h2>
        <p className="text-sm text-gray-600 mt-1">
          Registra la entrada y salida de estudiantes en prácticas
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Check-in Form — T-05.2: alterna con confirmación visual */}
        <Card>
          <CardHeader>
            <CardTitle>Nuevo Registro</CardTitle>
            <CardDescription>Completa la información para registrar asistencia</CardDescription>
          </CardHeader>
          <CardContent>
            {successInfo ? (
              <CheckInSuccess
                studentName={successInfo.name}
                time={successInfo.time}
                onDone={() => setSuccessInfo(null)}
              />
            ) : (
              <div className="space-y-4">
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

                <Button onClick={handleCheckIn} className="w-full">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Registrar Check-In
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Check-ins */}
        <Card>
          <CardHeader>
            <CardTitle>Check-Ins Activos</CardTitle>
            <CardDescription>Estudiantes que aún no han hecho check-out</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {getActiveCheckIns().length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No hay check-ins activos
                </p>
              ) : (
                getActiveCheckIns().map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{record.studentName}</p>
                      <p className="text-xs text-gray-500">{record.practiceName}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Entrada: {format(new Date(record.checkIn), 'HH:mm')}
                      </p>
                      {/* T-04.3: info del dispositivo */}
                      {record.deviceInfo && (
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                            <Monitor className="w-3 h-3" />{record.deviceInfo.browser || '—'}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                            <Wifi className="w-3 h-3" />{record.deviceInfo.connectionType || '—'}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                            <MapPin className="w-3 h-3" />
                            {record.deviceInfo.gpsAccuracy != null ? `±${record.deviceInfo.gpsAccuracy}m` : 'GPS —'}
                          </span>
                        </div>
                      )}
                    </div>
                    <Button onClick={() => handleCheckOut(record.id)} size="sm" variant="outline">
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
                Últimos 20 eventos del día · Actualización automática cada 10 seg
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              En vivo
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
              {feedEvents.map(event => (
                <FeedEvent key={event.id} event={event} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's Summary */}
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
                {todayAttendance.filter(a => a.status === 'present').length}
              </p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-5 h-5 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-900">Tardanzas</span>
              </div>
              <p className="text-2xl font-semibold text-yellow-900">
                {todayAttendance.filter(a => a.status === 'late').length}
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Activos</span>
              </div>
              <p className="text-2xl font-semibold text-blue-900">
                {todayAttendance.filter(a => !a.checkOut).length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
