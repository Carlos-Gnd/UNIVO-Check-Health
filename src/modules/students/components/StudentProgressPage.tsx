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
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Progreso de horas</h2>
        <p className="text-sm text-slate-500 mt-0.5">Cumplimiento del período actual</p>
      </div>

      {/* Indicador principal */}
      <Card>
        <CardContent className="pt-6 pb-6 space-y-5">
          {/* Porcentaje grande centrado */}
          <div className="text-center">
            <div className={`text-5xl font-bold tabular-nums ${pct >= 85 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
              {pct}%
            </div>
            <p className="text-sm text-slate-500 mt-1">{completed} de {required} horas</p>
          </div>

          {/* Barra de progreso */}
          <div className="space-y-2">
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>0 h</span>
              <span>Meta: {required} h</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Clock} label="Completadas" value={`${completed} h`} color="text-slate-700" />
        <StatCard icon={Target} label="Meta" value={`${required} h`} color="text-slate-700" />
        <StatCard icon={TrendingUp} label="Restantes" value={`${remaining} h`} color={remaining === 0 ? 'text-emerald-600' : 'text-amber-600'} />
      </div>

      {pct >= 100 && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="py-4 text-center text-emerald-700 text-sm font-medium">
            Meta alcanzada — Has completado las horas requeridas del período.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5 text-center space-y-1.5">
        <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
      </CardContent>
    </Card>
  );
}
