import { useEffect, useState } from 'react';
import { BookOpen, CalendarClock, Loader2, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent } from '@/shared/components/ui/card';
import { PageHeader } from '@/shared/components/PageHeader';
import { fetchCampusSubjects, type CampusSubject } from '../services/hospital.service';

// #7 — Vista de materias / prácticas programadas en la sede del representante.
export function HospitalSubjectsPage() {
  const [subjects, setSubjects] = useState<CampusSubject[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setSubjects(await fetchCampusSubjects());
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Materias y prácticas en mi sede"
        description="Asignaturas programadas en tu sede, con su docente, alumnos y días de práctica."
        action={(
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Actualizar
          </Button>
        )}
      />

      {loading ? (
        <div className="flex items-center justify-center py-10 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Cargando…</div>
      ) : subjects.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No hay materias ni prácticas asignadas a tu sede todavía.</p>
      ) : (
        <div className="space-y-3">
          {subjects.map((s, i) => (
            <Card key={`${s.subjectId ?? 'na'}-${s.teacherName}-${i}`} className="border-slate-200">
              <CardContent className="py-4 px-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-brand-700 shrink-0" />
                    <span className="truncate">{s.subjectName}</span>
                    {s.subjectCode && <span className="font-mono text-xs text-slate-400">{s.subjectCode}</span>}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Docente: <span className="text-slate-700">{s.teacherName}</span>
                    {s.career ? <> · {s.career}</> : null}
                  </p>
                  {s.scheduleDays && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <CalendarClock className="w-3 h-3" />{s.scheduleDays}
                    </p>
                  )}
                </div>
                <Badge className="bg-brand-100 text-brand-800 shrink-0 self-start sm:self-auto">
                  <Users className="w-3 h-3 mr-1" />{s.studentCount} {s.studentCount === 1 ? 'alumno' : 'alumnos'}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
