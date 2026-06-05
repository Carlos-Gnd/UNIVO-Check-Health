import { useState } from 'react';
import { FileSignature, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { StudentLiveMap } from '@/shared/components/StudentLiveMap';
import { fetchTeacherActiveSnapshot, CURRENT_PERIOD } from '../services/teacher.service';
import { signGroupReport } from '../services/report.service';

export function TeacherDashboardPage() {
  const [isSigning, setIsSigning] = useState(false);

  // T-27.1: genera, firma (sign-report) y descarga el reporte consolidado del grupo.
  const handleSignReport = async () => {
    setIsSigning(true);
    try {
      const res = await signGroupReport({ period: CURRENT_PERIOD, groupLabel: 'Mi grupo' });
      if (!res.ok) {
        toast.error(res.message ?? 'No se pudo firmar el reporte.');
        return;
      }
      toast.success(`Reporte firmado por ${res.signedBy ?? 'el sistema'}. Sello: ${res.seal?.slice(0, 12)}…`);
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-gradient-to-r from-brand-700 to-brand-800 p-5 shadow-[0_4px_20px_rgba(26,45,107,0.2)] border border-brand-600/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-10 rounded-full bg-gold-400 shrink-0" />
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white via-gold-200 to-gold-400 bg-clip-text text-transparent">Mi grupo</h1>
              <p className="mt-0.5 text-sm text-brand-200">Estudiantes activos de tu grupo en tiempo real.</p>
            </div>
          </div>
          <Button onClick={handleSignReport} disabled={isSigning} className="bg-white/10 border border-white/20 text-white hover:bg-white/20 backdrop-blur-sm font-semibold shrink-0">
            {isSigning
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Firmando...</>
              : <><FileSignature className="mr-2 h-4 w-4" />Firmar reporte del grupo</>}
          </Button>
        </div>
      </div>

      <StudentLiveMap title="Estudiantes activos de mi grupo" fetchSnapshot={fetchTeacherActiveSnapshot} />
    </div>
  );
}
