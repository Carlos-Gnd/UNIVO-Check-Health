import { useEffect, useMemo, useState } from 'react';
import { FileSignature, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { StudentLiveMap } from '@/shared/components/StudentLiveMap';
import { PageHeader } from '@/shared/components/PageHeader';
import { fetchTeacherActiveSnapshot, fetchTeacherRoster, CURRENT_PERIOD, type TeacherStudent } from '../services/teacher.service';
import { signGroupReport } from '../services/report.service';

export function TeacherDashboardPage() {
  const [isSigning, setIsSigning] = useState(false);
  const [roster, setRoster] = useState<TeacherStudent[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [campusFilter, setCampusFilter] = useState('all');

  useEffect(() => {
    void fetchTeacherRoster().then((r) => { setRoster(r); setLoadingRoster(false); });
  }, []);

  const subjects = useMemo(
    () => [...new Set(roster.map((s) => s.subjectName))].sort(),
    [roster],
  );
  const campuses = useMemo(
    () => [...new Set(roster.map((s) => s.campusName))].sort(),
    [roster],
  );

  // Agrupa el roster filtrado por "materia · sede" (S4-04.1).
  const groups = useMemo(() => {
    const filtered = roster.filter((s) =>
      (subjectFilter === 'all' || s.subjectName === subjectFilter) &&
      (campusFilter === 'all' || s.campusName === campusFilter),
    );
    const map = new Map<string, { subjectName: string; campusName: string; students: TeacherStudent[] }>();
    for (const s of filtered) {
      const key = `${s.subjectName}__${s.campusName}`;
      const g = map.get(key) ?? { subjectName: s.subjectName, campusName: s.campusName, students: [] };
      g.students.push(s);
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) =>
      a.subjectName.localeCompare(b.subjectName) || a.campusName.localeCompare(b.campusName),
    );
  }, [roster, subjectFilter, campusFilter]);

  // T-27.1: genera, firma (sign-report) y descarga el reporte consolidado del grupo.
  const handleSignReport = async () => {
    setIsSigning(true);
    try {
      const res = await signGroupReport({ period: CURRENT_PERIOD, groupLabel: 'Mi grupo' });
      if (!res.ok) {
        toast.error(res.message ?? 'No se pudo firmar el reporte.');
        return;
      }
      toast.success(
        `Reporte con doble firma: docente ${res.teacherSeal?.slice(0, 10)}..., sistema ${res.systemSeal?.slice(0, 10)}...`,
      );
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mi grupo"
        description="Estudiantes activos de tu grupo en tiempo real."
        action={(
          <Button onClick={handleSignReport} disabled={isSigning} className="bg-white/10 border border-white/20 text-white hover:bg-white/20 backdrop-blur-sm font-semibold shrink-0">
            {isSigning
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Firmando...</>
              : <><FileSignature className="mr-2 h-4 w-4" />Firmar reporte del grupo</>}
          </Button>
        )}
      />

      <StudentLiveMap title="Estudiantes activos de mi grupo" fetchSnapshot={fetchTeacherActiveSnapshot} />

      {/* Grupos por materia / sede (S4-04.1) */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Users className="w-4 h-4 text-brand-600" />Grupos por materia y sede
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="h-9 w-44 text-sm"><SelectValue placeholder="Materia" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las materias</SelectItem>
                {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={campusFilter} onValueChange={setCampusFilter}>
              <SelectTrigger className="h-9 w-44 text-sm"><SelectValue placeholder="Sede" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las sedes</SelectItem>
                {campuses.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loadingRoster ? (
          <div className="flex items-center justify-center py-10 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Cargando grupos…</div>
        ) : groups.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No hay alumnos en tu grupo para los filtros seleccionados.</p>
        ) : (
          groups.map((g) => (
            <Card key={`${g.subjectName}__${g.campusName}`} className="border-slate-200">
              <CardContent className="py-3 px-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium text-slate-800">{g.subjectName}</div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-slate-100 text-slate-600">{g.campusName}</Badge>
                    <Badge className="bg-brand-100 text-brand-700">{g.students.length} {g.students.length === 1 ? 'alumno' : 'alumnos'}</Badge>
                  </div>
                </div>
                <div className="divide-y divide-slate-50">
                  {g.students.map((s) => (
                    <div key={`${s.studentId}-${g.subjectName}`} className="flex items-center justify-between py-1.5 text-sm">
                      <span className="text-slate-700 truncate">{s.fullName}</span>
                      <span className="text-xs text-slate-400 font-mono shrink-0">{s.studentCode}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
