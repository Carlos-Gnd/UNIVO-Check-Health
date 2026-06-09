import { useEffect, useState } from 'react';
import { Loader2, ShieldAlert, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { StudentLiveMap } from '@/shared/components/StudentLiveMap';
import { PageHeader } from '@/shared/components/PageHeader';
import {
  fetchCampusActiveStudents, fetchCampusLiveSnapshot, reportStudentConduct,
  type CampusActiveStudent,
} from '../services/hospital.service';

export function HospitalLivePage() {
  const [students, setStudents] = useState<CampusActiveStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<CampusActiveStudent | null>(null);
  const [motivo, setMotivo] = useState('');
  const [reporting, setReporting] = useState(false);

  const load = async () => {
    setLoading(true);
    setStudents(await fetchCampusActiveStudents());
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const handleReport = async () => {
    if (!target) return;
    const reason = motivo.trim();
    if (reason.length < 10) { toast.error('Describe el motivo (mínimo 10 caracteres).'); return; }
    setReporting(true);
    const res = await reportStudentConduct(target.attendanceId, reason);
    setReporting(false);
    if (!res.ok) { toast.error(res.message ?? 'No se pudo enviar el reporte.'); return; }
    toast.success('Reporte enviado al coordinador y docente.');
    setTarget(null);
    setMotivo('');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estudiantes en mi sede"
        description="Estudiantes con práctica activa en tu sede en tiempo real."
        action={(
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Actualizar
          </Button>
        )}
      />

      <StudentLiveMap title="Estudiantes activos en mi sede" fetchSnapshot={fetchCampusLiveSnapshot} />

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estudiantes activos</p>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Cargando…</div>
        ) : students.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No hay estudiantes con práctica activa en este momento.</p>
        ) : (
          students.map((s) => (
            <Card key={s.attendanceId} className="border-slate-200">
              <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{s.studentName} <span className="text-xs text-slate-400 font-mono">{s.studentCode}</span></p>
                  <p className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500">
                    <Clock className="w-3 h-3" />{s.hoursToday} h · {s.career}
                    <Badge className="bg-emerald-100 text-emerald-700 ml-1">Activo</Badge>
                  </p>
                </div>
                <Button size="sm" variant="outline" className="text-amber-700 border-amber-200 hover:bg-amber-50 shrink-0"
                  onClick={() => { setTarget(s); setMotivo(''); }}>
                  <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />Reportar
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* HU-40 — reporte de conducta */}
      <Dialog open={Boolean(target)} onOpenChange={(o) => { if (!o && !reporting) { setTarget(null); setMotivo(''); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <ShieldAlert className="h-5 w-5" />Reportar conducta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Reporta la conducta de <strong>{target?.studentName}</strong>. El coordinador y el docente del estudiante serán notificados y el reporte queda en auditoría.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-brand-700">Motivo <span className="text-red-500">*</span></Label>
              <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Describe la conducta observada (mínimo 10 caracteres)…" rows={4} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setTarget(null); setMotivo(''); }} disabled={reporting}>Cancelar</Button>
              <Button onClick={() => void handleReport()} disabled={reporting} className="bg-amber-600 hover:bg-amber-700 text-white">
                {reporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando…</> : <><ShieldAlert className="w-4 h-4 mr-2" />Enviar reporte</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
