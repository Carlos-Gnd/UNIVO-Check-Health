import { useState } from 'react';
import { FileSignature, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { StudentLiveMap } from '@/shared/components/StudentLiveMap';
import { PageHeader } from '@/shared/components/PageHeader';
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
    </div>
  );
}
