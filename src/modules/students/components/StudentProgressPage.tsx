import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Loader2, Clock, Target, TrendingUp } from 'lucide-react';
import { supabase } from '@/shared/backend/supabaseClient';
import { getStudentHoursProgress } from '@/shared/backend/checkHealthBackend';

export function StudentProgressPage() {
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(0);
  const [required, setRequired] = useState(240);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user.id) { setLoading(false); return; }
      const progress = await getStudentHoursProgress(data.session.user.id);
      setCompleted(progress.completedHours);
      setRequired(progress.requiredHours);
      setLoading(false);
    };
    void load();
  }, []);

  const pct = Math.min(100, Math.round((completed / required) * 100));
  const remaining = Math.max(0, required - completed);
  const barColor = pct >= 85 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Cargando progreso…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <h2 className="text-2xl font-semibold text-gray-900">Progreso de horas</h2>

      {/* Indicador principal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" /> Cumplimiento del período
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>{completed} h completadas</span>
            <span>{pct}%</span>
          </div>
          <div className="h-4 w-full rounded-full bg-gray-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 text-right">Meta: {required} h</p>
        </CardContent>
      </Card>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Clock} label="Horas completadas" value={`${completed} h`} color="text-blue-600" />
        <StatCard icon={Target} label="Meta del período" value={`${required} h`} color="text-gray-600" />
        <StatCard icon={TrendingUp} label="Horas restantes" value={`${remaining} h`} color={remaining === 0 ? 'text-green-600' : 'text-amber-600'} />
      </div>

      {pct >= 100 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-4 text-center text-green-700 text-sm font-medium">
            ¡Meta alcanzada! Has completado las horas requeridas del período.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 text-center space-y-1">
        <Icon className={`w-5 h-5 mx-auto ${color}`} />
        <p className={`text-xl font-semibold ${color}`}>{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </CardContent>
    </Card>
  );
}
