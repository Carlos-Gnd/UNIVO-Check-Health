import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import { getStudents, getPractices, getAttendance, addAttendance, updateAttendance } from '../utils/data';
import { Student, Practice, Attendance } from '../types';
import { format } from 'date-fns';

export function CheckIn() {
  const [students, setStudents] = useState<Student[]>([]);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedPractice, setSelectedPractice] = useState('');
  const [notes, setNotes] = useState('');
  const [todayAttendance, setTodayAttendance] = useState<Attendance[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setStudents(getStudents());
    setPractices(getPractices());
    
    const today = format(new Date(), 'yyyy-MM-dd');
    const attendance = getAttendance();
    setTodayAttendance(attendance.filter(a => a.date === today));
  };

  const handleCheckIn = () => {
    if (!selectedStudent || !selectedPractice) {
      toast.error('Por favor selecciona un estudiante y una práctica');
      return;
    }

    const today = format(new Date(), 'yyyy-MM-dd');
    const now = new Date().toISOString();

    // Check if already checked in today
    const existing = todayAttendance.find(
      a => a.studentId === selectedStudent && a.practiceId === selectedPractice
    );

    if (existing && !existing.checkOut) {
      toast.error('Este estudiante ya tiene un check-in activo');
      return;
    }

    const newAttendance: Attendance = {
      id: Date.now().toString(),
      studentId: selectedStudent,
      practiceId: selectedPractice,
      checkIn: now,
      date: today,
      status: 'present',
      notes: notes || undefined,
    };

    addAttendance(newAttendance);
    loadData();
    
    const student = students.find(s => s.id === selectedStudent);
    toast.success(`Check-in registrado para ${student?.name}`);
    
    // Reset form
    setSelectedStudent('');
    setSelectedPractice('');
    setNotes('');
  };

  const handleCheckOut = (attendanceId: string) => {
    const now = new Date().toISOString();
    updateAttendance(attendanceId, { checkOut: now });
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
        {/* Check-in Form */}
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
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {record.studentName}
                      </p>
                      <p className="text-xs text-gray-500">{record.practiceName}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Entrada: {format(new Date(record.checkIn), 'HH:mm')}
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
