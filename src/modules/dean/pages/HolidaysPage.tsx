import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarOff, Loader2, Pencil, Plus, RotateCw, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { PageHeader } from '@/shared/components/PageHeader';
import { fetchHolidays, addHoliday, deleteHoliday, type Holiday } from '@/shared/backend/holidays.service';

export function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [editing, setEditing] = useState(false); // true = la fecha ya existe (se edita)
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => { setLoading(true); setHolidays(await fetchHolidays()); setLoading(false); };
  useEffect(() => { void load(); }, []);

  const resetForm = () => { setDate(''); setName(''); setRecurring(false); setEditing(false); };

  const startEdit = (h: Holiday) => { setDate(h.date); setName(h.name); setRecurring(h.recurring); setEditing(true); };

  const handleAdd = async () => {
    if (!date) { toast.error('Selecciona una fecha.'); return; }
    if (name.trim().length < 2) { toast.error('Escribe el nombre del feriado.'); return; }
    setSaving(true);
    const res = await addHoliday(date, name, recurring);
    setSaving(false);
    if (!res.ok) { toast.error(res.message ?? 'No se pudo guardar.'); return; }
    toast.success(editing ? 'Día no hábil actualizado' : 'Día no hábil agregado');
    resetForm();
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
        <CardContent className="py-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-brand-700">Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={editing} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-brand-700">Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Día de la Independencia" />
            </div>
            <Button onClick={() => void handleAdd()} disabled={saving} className="bg-brand-800 hover:bg-brand-900 text-white">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : editing ? <Pencil className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {editing ? 'Guardar' : 'Agregar'}
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
              <RotateCw className="w-3.5 h-3.5 text-brand-600" />
              Se repite cada año (feriado anual)
            </label>
            {editing && (
              <button type="button" onClick={resetForm} className="text-xs text-gray-500 hover:underline flex items-center gap-1">
                <X className="w-3 h-3" />Cancelar edición
              </button>
            )}
          </div>
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
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <CalendarOff className="w-4 h-4 text-brand-600" />
                  <span className="font-medium text-slate-800">
                    {h.recurring
                      ? format(parseISO(h.date), "d 'de' MMMM", { locale: es })
                      : format(parseISO(h.date), "d 'de' MMMM yyyy", { locale: es })}
                  </span>
                  <span className="text-slate-500">· {h.name}</span>
                  {h.recurring && <Badge className="bg-brand-100 text-brand-700 text-[10px] gap-1"><RotateCw className="w-3 h-3" />cada año</Badge>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => startEdit(h)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-700 border-red-200 hover:bg-red-50"
                    onClick={() => void handleDelete(h.date)} disabled={deleting === h.date}>
                    {deleting === h.date ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
