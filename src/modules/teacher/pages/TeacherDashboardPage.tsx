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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Mi grupo</h1>
          <p className="mt-1 text-sm text-gray-500">Estudiantes activos de tu grupo en tiempo real.</p>
        </div>
        <Button onClick={handleSignReport} disabled={isSigning} className="bg-brand-800 text-white hover:bg-brand-900">
          {isSigning
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Firmando...</>
            : <><FileSignature className="mr-2 h-4 w-4" />Firmar reporte del grupo</>}
        </Button>
      </div>

      <StudentLiveMap title="Estudiantes activos de mi grupo" fetchSnapshot={fetchTeacherActiveSnapshot} />
    </div>
  );
}
