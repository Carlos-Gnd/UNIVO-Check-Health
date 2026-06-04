import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ClipboardList, Loader2, Save, Star } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { fetchTeacherRoster, type TeacherStudent } from '../services/teacher.service';
import {
  fetchStudentEvaluations,
  upsertWeeklyEvaluation,
  type WeeklyEvaluation,
} from '../services/evaluations.service';

const DIMENSIONS = [
  { key: 'actitud', label: 'Actitud' },
  { key: 'puntualidad', label: 'Puntualidad' },
  { key: 'desempenoTecnico', label: 'Desempeño técnico' },
  { key: 'trabajoEquipo', label: 'Trabajo en equipo' },
] as const;

type DimensionKey = (typeof DIMENSIONS)[number]['key'];
type Scores = Record<DimensionKey, number>;

const DEFAULT_SCORES: Scores = { actitud: 3, puntualidad: 3, desempenoTecnico: 3, trabajoEquipo: 3 };

// Lunes (ISO) de la semana de una fecha, en formato yyyy-mm-dd.
function mondayOf(date = new Date()): string {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

export function TeacherEvaluationsPage() {
  const [roster, setRoster] = useState<TeacherStudent[]>([]);
  const [studentId, setStudentId] = useState('');
  const [weekStart, setWeekStart] = useState(mondayOf());
  const [scores, setScores] = useState<Scores>(DEFAULT_SCORES);
  const [comentario, setComentario] = useState('');
  const [history, setHistory] = useState<WeeklyEvaluation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      const list = await fetchTeacherRoster();
      setRoster(list);
      if (list.length > 0) setStudentId(list[0].studentId);
      setIsLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!studentId) {
      setHistory([]);
      return;
    }
    void (async () => setHistory(await fetchStudentEvaluations(studentId)))();
  }, [studentId]);

  const selectedStudent = useMemo(
    () => roster.find((s) => s.studentId === studentId),
    [roster, studentId],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!studentId) {
      toast.error('Selecciona un estudiante.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await upsertWeeklyEvaluation({
        studentId,
        weekStart,
        actitud: scores.actitud,
        puntualidad: scores.puntualidad,
        desempenoTecnico: scores.desempenoTecnico,
        trabajoEquipo: scores.trabajoEquipo,
        comentario,
      });
      if (!res.ok) {
        toast.error(res.message ?? 'No se pudo guardar la evaluación.');
        return;
      }
      toast.success('Evaluación guardada.');
      setComentario('');
      setHistory(await fetchStudentEvaluations(studentId));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-700" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Evaluación semanal</h1>
        <p className="mt-1 text-sm text-gray-500">Registra el desempeño cualitativo de los estudiantes de tu grupo.</p>
      </div>

      {roster.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
          No tienes estudiantes asignados en el período actual.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Formulario */}
          <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="eval-student" className="text-xs uppercase tracking-wide text-brand-700">Estudiante</Label>
                <select
                  id="eval-student"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                >
                  {roster.map((s) => (
                    <option key={s.studentId} value={s.studentId}>
                      {s.fullName}{s.studentCode ? ` · ${s.studentCode}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="eval-week" className="text-xs uppercase tracking-wide text-brand-700">Semana (lunes)</Label>
                <input
                  id="eval-week"
                  type="date"
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {DIMENSIONS.map((dim) => (
                <div key={dim.key} className="flex items-center justify-between gap-3">
                  <Label className="text-sm text-gray-700">{dim.label}</Label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-label={`${dim.label}: ${n}`}
                        onClick={() => setScores((prev) => ({ ...prev, [dim.key]: n }))}
                        className="p-0.5"
                      >
                        <Star className={`h-5 w-5 ${n <= scores[dim.key] ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              <Label htmlFor="eval-comment" className="text-xs uppercase tracking-wide text-brand-700">Comentario (opcional)</Label>
              <textarea
                id="eval-comment"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                placeholder="Observaciones de la semana…"
              />
            </div>

            <div className="mt-5 flex justify-end">
              <Button type="submit" disabled={isSaving} className="bg-brand-800 text-white hover:bg-brand-900">
                {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : <><Save className="mr-2 h-4 w-4" />Guardar evaluación</>}
              </Button>
            </div>
          </form>

          {/* Historial (T-26.3) */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-900">
              <ClipboardList className="h-4 w-4" />
              Historial {selectedStudent ? `de ${selectedStudent.fullName}` : ''}
            </div>
            {history.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">Sin evaluaciones registradas.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {history.map((ev) => (
                  <li key={ev.id} className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-800">
                        Semana del {format(parseISO(ev.weekStart), "d 'de' MMMM yyyy", { locale: es })}
                      </span>
                      <span className="text-xs text-gray-500">
                        Prom. {((ev.actitud + ev.puntualidad + ev.desempenoTecnico + ev.trabajoEquipo) / 4).toFixed(1)}/5
                      </span>
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-600">
                      <span>Actitud: {ev.actitud}</span>
                      <span>Puntualidad: {ev.puntualidad}</span>
                      <span>Desempeño: {ev.desempenoTecnico}</span>
                      <span>Trabajo en equipo: {ev.trabajoEquipo}</span>
                    </div>
                    {ev.comentario && <p className="mt-1 text-xs italic text-gray-500">“{ev.comentario}”</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
