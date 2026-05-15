import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Loader2, MapPin, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useDeanStore } from '@/modules/dean/store/useDeanStore';
import type { Location } from '@/modules/dean/types';
import { createCampus, updateCampus, deleteCampus, type CampusFormData } from '@/modules/dean/services/dean.service';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { toast } from 'sonner';

const EMPTY_FORM: CampusFormData = {
  name: '', latitude: '', longitude: '', radius_meters: '100',
  location_label: '', supervisor_name: '', supervisor_phone: '',
  schedule: '', start_date: '', end_date: '', description: '',
};

export function DeanLocationsPage() {
  const { locations, isLoading, loadData, setSelectedLocation, selectedLocation } = useDeanStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CampusFormData>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filtered = useMemo(
    () =>
      locations.filter(
        (l) =>
          l.name.toLowerCase().includes(search.toLowerCase()) &&
          (statusFilter === 'all' || l.status === statusFilter),
      ),
    [locations, search, statusFilter],
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (l: Location) => {
    setEditingId(l.id);
    setForm({
      name: l.name,
      latitude: String(l.coordinates.lat),
      longitude: String(l.coordinates.lng),
      radius_meters: String(l.allowedRadiusMeters),
      location_label: l.address,
      supervisor_name: l.doctorName === '—' ? '' : l.doctorName,
      supervisor_phone: l.doctorPhone ?? '',
      schedule: l.schedule ?? '',
      start_date: l.startDate ?? '',
      end_date: l.endDate ?? '',
      description: l.description ?? '',
    });
    setShowForm(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.latitude || !form.longitude) {
      toast.error('Nombre, latitud y longitud son obligatorios');
      return;
    }
    setIsSaving(true);
    const result = editingId
      ? await updateCampus(editingId, form)
      : await createCampus(form);
    setIsSaving(false);
    if (!result.ok) {
      toast.error(result.message ?? 'Error al guardar la sede');
      return;
    }
    toast.success(editingId ? 'Sede actualizada' : 'Sede creada');
    setShowForm(false);
    void loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const result = await deleteCampus(deleteTarget.id);
    setIsDeleting(false);
    if (!result.ok) {
      toast.error(result.message ?? 'No se pudo eliminar la sede');
      return;
    }
    toast.success('Sede eliminada');
    setDeleteTarget(null);
    void loadData();
  };

  const set = (field: keyof CampusFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Cargando sedes…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-gray-900">Sedes</h2>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="w-4 h-4 mr-1.5" />Nueva sede
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
          <Input className="pl-9" placeholder="Buscar sede" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="active">Activas</SelectItem>
            <SelectItem value="inactive">Inactivas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-gray-600">
        {locations.filter((l) => l.status === 'active').length} sedes activas · {filtered.length} mostradas
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 col-span-3 text-center py-12">Sin sedes registradas</p>
        ) : (
          filtered.map((l) => (
            <div key={l.id} className="rounded-lg border bg-white p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{l.name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />{l.address}
                  </p>
                </div>
                <Badge className={l.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}>
                  {l.status === 'active' ? 'Activa' : 'Inactiva'}
                </Badge>
              </div>

              <div className="space-y-1 text-sm text-gray-700">
                {l.doctorName !== '—' && <p>Supervisor: {l.doctorName}</p>}
                {l.doctorPhone && <p className="text-xs text-gray-500">{l.doctorPhone}</p>}
                {l.schedule && <p className="text-xs text-gray-500">{l.schedule}</p>}
                <p>Radio GPS: {l.allowedRadiusMeters} m</p>
                <p>Alumnos asignados: {l.totalStudents}</p>
              </div>

              {l.totalStudents > 0 && (
                <div>
                  <div className="mb-1 flex justify-between text-xs text-gray-500">
                    <span>Cumplimiento</span><span>{l.averageCompliance}%</span>
                  </div>
                  <div className="h-2 rounded bg-gray-200">
                    <div
                      className={`h-full rounded ${l.averageCompliance > 75 ? 'bg-green-500' : l.averageCompliance >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${l.averageCompliance}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button className="flex-1" variant="outline" size="sm" onClick={() => setSelectedLocation(l)}>
                  Ver detalle
                </Button>
                <Button variant="outline" size="sm" onClick={() => openEdit(l)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteTarget(l)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal crear/editar sede — T-07.3 */}
      <Dialog open={showForm} onOpenChange={(open) => !isSaving && setShowForm(open)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar sede' : 'Nueva sede'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs uppercase tracking-wide">Nombre de la sede *</Label>
              <Input value={form.name} onChange={set('name')} placeholder="Hospital Nacional Rosales" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide">Latitud *</Label>
              <Input value={form.latitude} onChange={set('latitude')} placeholder="13.7013" type="number" step="any" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide">Longitud *</Label>
              <Input value={form.longitude} onChange={set('longitude')} placeholder="-89.2045" type="number" step="any" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide">Radio GPS (metros)</Label>
              <Input value={form.radius_meters} onChange={set('radius_meters')} placeholder="100" type="number" min="20" max="1000" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide">Dirección / Etiqueta</Label>
              <Input value={form.location_label} onChange={set('location_label')} placeholder="Hospital Nacional Rosales, SS" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide">Supervisor encargado</Label>
              <Input value={form.supervisor_name} onChange={set('supervisor_name')} placeholder="Dr. Roberto Martínez" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide">Teléfono supervisor</Label>
              <Input value={form.supervisor_phone} onChange={set('supervisor_phone')} placeholder="2222-3333" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs uppercase tracking-wide">Horario</Label>
              <Input value={form.schedule} onChange={set('schedule')} placeholder="Lunes a Viernes, 7:00 AM - 3:00 PM" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide">Fecha inicio</Label>
              <Input value={form.start_date} onChange={set('start_date')} type="date" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide">Fecha fin</Label>
              <Input value={form.end_date} onChange={set('end_date')} type="date" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs uppercase tracking-wide">Descripción</Label>
              <Input value={form.description} onChange={set('description')} placeholder="Descripción breve de la práctica…" />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" disabled={isSaving} onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                {editingId ? 'Guardar cambios' : 'Crear sede'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmación de eliminación */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Eliminar sede</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-700">
            ¿Seguro que deseas eliminar <strong>{deleteTarget?.name}</strong>?
            Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancelar</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal detalle de sede */}
      <LocationDetailModal location={selectedLocation} onClose={() => setSelectedLocation(null)} />
    </div>
  );
}

function LocationDetailModal({ location, onClose }: { location: Location | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(location)} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        {location && (
          <>
            <DialogHeader><DialogTitle>{location.name}</DialogTitle></DialogHeader>
            <div className="space-y-4 text-sm">
              <p><span className="font-semibold">Dirección:</span> {location.address}</p>
              <p><span className="font-semibold">Coordenadas:</span> {location.coordinates.lat}, {location.coordinates.lng}</p>
              <p><span className="font-semibold">Radio permitido:</span> {location.allowedRadiusMeters} m</p>
              <p><span className="font-semibold">Supervisor:</span> {location.doctorName}</p>
              {location.doctorPhone && <p><span className="font-semibold">Teléfono:</span> {location.doctorPhone}</p>}
              {location.schedule && <p><span className="font-semibold">Horario:</span> {location.schedule}</p>}
              {location.description && <p><span className="font-semibold">Descripción:</span> {location.description}</p>}

              <div className="h-48 overflow-hidden rounded border bg-gray-100">
                <iframe
                  title="mapa"
                  className="h-full w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://maps.google.com/maps?q=${location.coordinates.lat},${location.coordinates.lng}&z=15&output=embed`}
                />
              </div>

              {location.students.length > 0 && (
                <div className="overflow-x-auto rounded border">
                  <table className="w-full min-w-[500px] text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Carnet</th>
                        <th className="px-3 py-2 text-left">Nombre</th>
                        <th className="px-3 py-2 text-left">% Cumplimiento</th>
                        <th className="px-3 py-2 text-left">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {location.students.map((s) => (
                        <tr key={s.id} className="border-t">
                          <td className="px-3 py-2 font-mono text-xs">{s.carnet}</td>
                          <td className="px-3 py-2">{s.fullName}</td>
                          <td className="px-3 py-2">{s.compliancePercentage}%</td>
                          <td className="px-3 py-2">
                            {s.status === 'at-risk'
                              ? <Badge className="bg-red-100 text-red-700">En riesgo</Badge>
                              : s.status === 'completed'
                                ? <Badge className="bg-green-100 text-green-700">Completado</Badge>
                                : <Badge className="bg-amber-100 text-amber-700">En progreso</Badge>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
