import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent } from '@/shared/components/ui/card';
import { PageHeader } from '@/shared/components/PageHeader';
import { fetchMyConductReports, type ConductReport } from '../services/hospital.service';

export function HospitalIncidentsPage() {
  const [reports, setReports] = useState<ConductReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchMyConductReports().then((r) => { setReports(r); setLoading(false); });
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Reportes de conducta" description="Historial de reportes que has presentado." />

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Cargando…</div>
      ) : reports.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">Aún no has presentado reportes de conducta.</p>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <Card key={r.id} className="border-slate-200">
              <CardContent className="py-3 px-4 space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />{r.studentName}
                  </div>
                  <Badge className="bg-slate-100 text-slate-600">{r.campusName}</Badge>
                </div>
                <p className="text-sm text-slate-600">{r.motivo}</p>
                <p className="text-xs text-slate-400">{format(parseISO(r.createdAt), "d 'de' MMMM yyyy, HH:mm", { locale: es })}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
