import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { toast } from 'sonner';
import { CheckCircle, Clock, XCircle, TrendingUp } from 'lucide-react';
import { getStudents } from '@/modules/students/services/students.service';
import { getPractices } from '@/modules/practices/services/practices.service';
import { getAttendance } from '../services/attendance.service';
import {
  getTrustedPracticeLocation,
  registerStudentCheckIn,
  registerStudentCheckOut,
  getStudentHoursProgress,
} from '@/shared/backend/checkHealthBackend';
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

// T-06.2: Indicador circular de progreso de horas (verde/amarillo/rojo según avance)
function HoursProgressRing({
  completedHours,
  requiredHours,
}: {
  completedHours: number;
  requiredHours: number;
}) {
  const pct = Math.min(100, requiredHours > 0 ? (completedHours / requiredHours) * 100 : 0);
  const r = 34;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const color = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  const label = pct >= 75 ? 'Al día' : pct >= 50 ? 'A tiempo justo' : 'En riesgo';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#e5e7eb" strokeWidth="7" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 44 44)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="44" y="40" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#111827">
          {completedHours.toFixed(0)}h
        </text>
        <text x="44" y="54" textAnchor="middle" fontSize="8" fill="#6b7280">
          de {requiredHours}h
        </text>
      </svg>
      <span className="text-xs font-semibold" style={{ color }}>
        {label}
      </span>
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

  // T-06.2 — progreso de horas por estudiante
  const [hoursProgress, setHoursProgress] = useState<
    Record<string, { completedHours: number; requiredHours: number }>
  >({});

  const loadData = useCallback(() => {
    setStudents(getStudents());
    setPractices(getPractices());
    const today = format(new Date(), 'yyyy-MM-dd');
    const attendance = getAttendance();
    setTodayAttendance(attendance.filter((a) => a.date === today));
  }, []);

  // T-06.2 — carga progreso de horas de todos los estudiantes
  const loadHoursProgress = useCallback(() => {
    const all = getStudents();
    const progress: Record<string, { completedHours: number; requiredHours: number }> = {};
    all.forEach((s) => {
      progress[s.id] = getStudentHoursProgress(s.id);
    });
    setHoursProgress(progress);
  }, []);

  useEffect(() => {
    loadData();
    loadHoursProgress();

    // T-06.2 — se actualiza solo cuando el usuario vuelve a la pantalla, no sondeo constante
    const handleVisibility = () => {
      if (!document.hidden) {
        loadData();
        loadHoursProgress();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadData, loadHoursProgress]);

  const handleCheckIn = () => {
    if (!selectedStudent || !selectedPractice) {
      toast.error('Por favor selecciona un estudiante y una práctica');
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
      location: getTrustedPracticeLocation(selectedPractice),
      deviceId: getDeviceId(),
    });

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    loadData();
    loadHoursProgress();
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
    loadHoursProgress();
    toast.success('Check-out registrado exitosamente');
  };

  const activeCheckIns = todayAttendance
    .filter((a) => !a.checkOut)
    .map((a) => ({
      ...a,
      studentName: students.find((s) => s.id === a.studentId)?.name,
      practiceName: practices.find((p) => p.id === a.practiceId)?.name,
    }));

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

            <Button onClick={handleCheckIn} className="w-full">
              <CheckCircle className="w-4 h-4 mr-2" />
              Registrar Check-In
            </Button>
          </CardContent>
        </Card>

        {/* Check-Ins Activos */}
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

      {/* T-06.2 — Indicadores circulares de progreso de horas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            Progreso de Horas
          </CardTitle>
          <CardDescription>
            Se actualiza al regresar a la pantalla · Verde ≥75% · Amarillo ≥50% · Rojo &lt;50%
          </CardDescription>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Sin estudiantes registrados</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {students.map((student) => {
                const progress = hoursProgress[student.id];
                if (!progress) return null;
                return (
                  <div key={student.id} className="flex flex-col items-center gap-1">
                    <HoursProgressRing
                      completedHours={progress.completedHours}
                      requiredHours={progress.requiredHours}
                    />
                    <p className="text-xs text-center text-gray-700 font-medium leading-tight">
                      {student.name.split(' ').slice(0, 2).join(' ')}
                    </p>
                  </div>
                );
              })}
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
