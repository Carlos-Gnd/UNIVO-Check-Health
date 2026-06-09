import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarOff, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Card, CardContent } from '@/shared/components/ui/card';
import { PageHeader } from '@/shared/components/PageHeader';
import { fetchHolidays, addHoliday, deleteHoliday, type Holiday } from '@/shared/backend/holidays.service';

export function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => { setLoading(true); setHolidays(await fetchHolidays()); setLoading(false); };
  useEffect(() => { void load(); }, []);

  const handleAdd = async () => {
    if (!date) { toast.error('Selecciona una fecha.'); return; }
    if (name.trim().length < 2) { toast.error('Escribe el nombre del feriado.'); return; }
    setSaving(true);
    const res = await addHoliday(date, name);
    setSaving(false);
    if (!res.ok) { toast.error(res.message ?? 'No se pudo guardar.'); return; }
    toast.success('Día no hábil agregado');
    setDate(''); setName('');
    void load();
  };

  const handleDelete = async (d: string) => {
    setDeleting(d);
    const res = await deleteHoliday(d);
    setDeleting(null);
    if (!res.ok) { toast.error(res.message ?? 'No se pudo eliminar.'); return; }
    toast.success('Día no hábil eliminado');
    void load();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Días no hábiles" description="Feriados y días sin práctica: no cuentan como falta en el progreso del alumno." />

      <Card>
        <CardContent className="py-4 grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-brand-700">Fecha</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-brand-700">Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Día de la Independencia" />
          </div>
          <Button onClick={() => void handleAdd()} disabled={saving} className="bg-brand-800 hover:bg-brand-900 text-white">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}Agregar
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Cargando…</div>
      ) : holidays.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No hay días no hábiles registrados.</p>
      ) : (
        <div className="space-y-2">
          {holidays.map((h) => (
            <Card key={h.date} className="border-slate-200">
              <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarOff className="w-4 h-4 text-brand-600" />
                  <span className="font-medium text-slate-800">{format(parseISO(h.date), "d 'de' MMMM yyyy", { locale: es })}</span>
                  <span className="text-slate-500">· {h.name}</span>
                </div>
                <Button size="sm" variant="outline" className="text-red-700 border-red-200 hover:bg-red-50"
                  onClick={() => void handleDelete(h.date)} disabled={deleting === h.date}>
                  {deleting === h.date ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
