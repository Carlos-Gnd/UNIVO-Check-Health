import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useDeanStore } from '@/modules/dean/store/useDeanStore';
import type { DeanStudent, Location } from '@/modules/dean/types';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';

export function DeanLocationsPage() {
  const { locations, setSelectedLocation, selectedLocation } = useDeanStore();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [params] = useSearchParams();

  const activeCount = locations.filter((location) => location.status === 'active').length;
  const filtered = useMemo(() => locations.filter((location) => location.name.toLowerCase().includes(search.toLowerCase()) && (status === 'all' || location.status === status)), [locations, search, status]);

  const selectedByQuery = params.get('location');
  const preselected = selectedByQuery ? locations.find((location) => location.id === selectedByQuery) ?? null : null;
  const modalLocation = selectedLocation ?? preselected;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-gray-900">Sedes</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="relative md:col-span-2"><Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" /><Input className="pl-9" placeholder="Buscar sede" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Select value={status} onValueChange={(value: any) => setStatus(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="active">Activas</SelectItem><SelectItem value="inactive">Inactivas</SelectItem></SelectContent></Select>
      </div>
      <p className="text-sm text-gray-600">{activeCount} sedes activas este período</p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((location) => (
          <div key={location.id} className="rounded-lg border bg-white p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-gray-900">{location.name}</p><p className="text-xs text-gray-500">{location.address}</p></div><Badge className={location.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}>{location.status === 'active' ? 'Activa' : 'Inactiva'}</Badge></div>
            <div className="mt-3 space-y-1 text-sm text-gray-700"><p>Doctor: {location.doctorName} <Badge className="ml-1 bg-green-100 text-green-700">Activo</Badge></p><p>Total alumnos: {location.totalStudents}</p><p>Radio GPS: {location.allowedRadiusMeters} m</p></div>
            <div className="mt-3"><div className="mb-1 flex justify-between text-sm"><span>Cumplimiento promedio</span><span>{location.averageCompliance}%</span></div><div className="h-2 rounded bg-gray-200"><div className="h-full rounded bg-blue-600" style={{ width: `${location.averageCompliance}%` }} /></div></div>
            <Button className="mt-4 w-full" variant="outline" onClick={() => setSelectedLocation(location)}>Ver detalle</Button>
          </div>
        ))}
      </div>

      <LocationDetailModal location={modalLocation} onClose={() => setSelectedLocation(null)} />
    </div>
  );
}

function LocationDetailModal({ location, onClose }: { location: Location | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(location)} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        {location && (<><DialogHeader><DialogTitle>{location.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 text-sm">
            <p><span className="font-semibold">Dirección:</span> {location.address}</p>
            <p><span className="font-semibold">Coordenadas:</span> {location.coordinates.lat}, {location.coordinates.lng}</p>
            <p><span className="font-semibold">Radio permitido:</span> {location.allowedRadiusMeters} m</p>
            <p><span className="font-semibold">Doctor encargado:</span> {location.doctorName}</p>
            <div className="h-48 overflow-hidden rounded border bg-gray-100"><iframe title="mapa" className="h-full w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://maps.google.com/maps?q=${location.coordinates.lat},${location.coordinates.lng}&z=15&output=embed`} /></div>
            <div className="overflow-x-auto rounded border"><table className="w-full min-w-[600px] text-sm"><thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Carnet</th><th className="px-3 py-2 text-left">Nombre</th><th className="px-3 py-2 text-left">% Cumplimiento</th><th className="px-3 py-2 text-left">Estado</th></tr></thead><tbody>{location.students.map((student) => <tr key={student.id} className="border-t"><td className="px-3 py-2">{student.carnet}</td><td className="px-3 py-2">{student.fullName}</td><td className="px-3 py-2">{student.compliancePercentage}%</td><td className="px-3 py-2"><StatusBadge status={student.status} /></td></tr>)}</tbody></table></div>
            <div><div className="mb-1 flex justify-between"><span>Cumplimiento promedio de la sede</span><span>{location.averageCompliance}%</span></div><div className="h-3 rounded bg-gray-200"><div className="h-full rounded bg-blue-600" style={{ width: `${location.averageCompliance}%` }} /></div></div>
          </div></>)}
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: DeanStudent['status'] }) {
  if (status === 'at-risk') return <Badge className="bg-red-100 text-red-700">En riesgo</Badge>;
  if (status === 'completed') return <Badge className="bg-green-100 text-green-700">Completado</Badge>;
  return <Badge className="bg-amber-100 text-amber-700">En progreso</Badge>;
}
