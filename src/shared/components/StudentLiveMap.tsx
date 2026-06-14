import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { supabase } from '@/shared/backend/supabaseClient';

// Forma mínima que necesita el mapa (subconjunto del snapshot de checkHealthBackend).
export type LiveMapStudent = {
  studentName: string;
  carnet?: string | null;
  practiceId?: string | null;
  siteName: string;
  hoursToday: number;
  totalCycleHours?: number;
  lastLocation?: { latitude: number; longitude: number } | null;
};

export type LiveMapCampusOption = {
  id?: string | null;
  name: string;
};

// Mapa Leaflet reutilizable de estudiantes activos. La fuente de datos se inyecta
// vía `fetchSnapshot`, de modo que el decano (todos) y el docente (su grupo, T-23.1)
// comparten el mismo render. Refresca cada 30 s y, opcionalmente, en realtime.
export function StudentLiveMap({
  fetchSnapshot,
  title = 'Estudiantes activos en tiempo real',
  realtime = true,
  showCampusFilter = false,
  campusOptions,
}: {
  fetchSnapshot: () => Promise<LiveMapStudent[]>;
  title?: string;
  realtime?: boolean;
  showCampusFilter?: boolean;
  campusOptions?: LiveMapCampusOption[];
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletInstance = useRef<any>(null);
  const markersLayer = useRef<any>(null);
  const campusLayer = useRef<any>(null);
  const leafletModule = useRef<any>(null);
  const channelId = useRef(`live-map-${Math.random().toString(36).slice(2)}`);
  // Ref a la función para evitar stale closures en intervalos/realtime.
  const fetchRef = useRef(fetchSnapshot);
  const campusFilterRef = useRef('all');
  fetchRef.current = fetchSnapshot;

  const [visibleCampusCount, setVisibleCampusCount] = useState(0);
  const [campusFilter, setCampusFilter] = useState('all');
  const [mapCampusOptions, setMapCampusOptions] = useState<LiveMapCampusOption[]>([]);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  campusFilterRef.current = campusFilter;

  // B14: marcadores con divIcon (CSS). El icono por defecto de Leaflet depende de
  // imágenes que Vite no empaqueta, así que los marcadores salían "invisibles".
  const studentIcon = (L: any) => L.divIcon({
    className: '',
    html: '<div style="width:16px;height:16px;border-radius:50%;background:#2563eb;border:2px solid #fff;box-shadow:0 0 0 3px rgba(37,99,235,.35)"></div>',
    iconSize: [16, 16], iconAnchor: [8, 8],
  });
  const campusIcon = (L: any) => L.divIcon({
    className: '',
    html: '<div style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;background:#f5a623;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);font-size:13px">🏥</div>',
    iconSize: [24, 24], iconAnchor: [12, 12],
  });

  // B14: dibuja las sedes (marcador + círculo de geocerca) una sola vez.
  const drawCampuses = async (L: any) => {
    if (!campusLayer.current) return;
    const { data } = await supabase
      .from('campuses')
      .select('id, name, location_label, latitude, longitude, radius_meters')
      .eq('is_active', true);
    const allowed = campusOptions
      ? new Set(campusOptions.map((c) => c.id ?? c.name))
      : null;
    const campuses = (data ?? [])
      .map((c: any) => ({
        ...c,
        displayName: (c.location_label as string) ?? (c.name as string),
      }))
      .filter((c: any) => !allowed || allowed.has(c.id) || allowed.has(c.name) || allowed.has(c.displayName));
    const visibleCampuses = campuses.filter((c: any) =>
      campusFilterRef.current === 'all' ||
      c.id === campusFilterRef.current ||
      c.name === campusFilterRef.current ||
      c.displayName === campusFilterRef.current,
    );
    campusLayer.current.clearLayers();
    setVisibleCampusCount(visibleCampuses.length);
    setMapCampusOptions(campuses.map((c: any) => ({ id: c.id, name: c.displayName })));
    visibleCampuses.forEach((c: any) => {
      if (c.latitude == null || c.longitude == null) return;
      const lat = Number(c.latitude); const lng = Number(c.longitude);
      L.marker([lat, lng], { icon: campusIcon(L) })
        .bindPopup(`<b style="font-size:13px">${c.displayName}</b><br/><span style="font-size:11px;color:#6b7280">Sede de práctica</span>`)
        .addTo(campusLayer.current);
      if (c.radius_meters) {
        L.circle([lat, lng], { radius: c.radius_meters, color: '#f5a623', weight: 1, fillColor: '#f5a623', fillOpacity: 0.08 })
          .addTo(campusLayer.current);
      }
    });
  };

  const refreshMarkers = async (L: any) => {
    const students = (await fetchRef.current()).filter((s) =>
      campusFilterRef.current === 'all' ||
      s.practiceId === campusFilterRef.current ||
      s.siteName === campusFilterRef.current,
    );
    if (!markersLayer.current) return;
    markersLayer.current.clearLayers();
    students.forEach((s) => {
      if (!s.lastLocation) return;
      L.marker([s.lastLocation.latitude, s.lastLocation.longitude], { icon: studentIcon(L) })
        .bindPopup(
          `<b style="font-size:13px">${s.studentName}</b>` +
          (s.carnet ? `<br/><span style="font-size:11px;color:#6b7280">${s.carnet}</span>` : '') +
          `<br/><span style="font-size:11px">${s.siteName}</span>` +
          `<br/><span style="font-size:11px;color:#2563eb">${s.hoursToday.toFixed(1)} h jornada</span>` +
          (s.totalCycleHours != null ? `<br/><span style="font-size:11px;color:#7c3aed">${s.totalCycleHours.toFixed(1)} h ciclo</span>` : ''),
        )
        .addTo(markersLayer.current);
    });
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    let isMounted = true;
    import('leaflet').then((L) => {
      if (!isMounted || !mapRef.current || leafletInstance.current) return;
      leafletModule.current = L;
      const map = L.map(mapRef.current, { zoomControl: true }).setView([13.7942, -88.8965], 8);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);
      campusLayer.current = L.layerGroup().addTo(map);
      markersLayer.current = L.layerGroup().addTo(map);
      leafletInstance.current = map;
      void drawCampuses(L);
      void refreshMarkers(L);
      interval = setInterval(() => void refreshMarkers(L), 30000);
    });
    return () => {
      isMounted = false;
      clearInterval(interval);
      leafletInstance.current?.remove();
      leafletInstance.current = null;
      markersLayer.current = null;
      campusLayer.current = null;
      leafletModule.current = null;
    };
  }, []);

  useEffect(() => {
    if (!realtime) return;
    let refreshTimeout: ReturnType<typeof setTimeout> | undefined;

    const refreshFromRealtime = () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        if (leafletModule.current) void refreshMarkers(leafletModule.current);
      }, 300);
    };

    const channel = supabase
      .channel(channelId.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendances' }, refreshFromRealtime)
      .subscribe((status) => setIsRealtimeConnected(status === 'SUBSCRIBED'));

    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      setIsRealtimeConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [realtime]);

  useEffect(() => {
    if (!leafletModule.current) return;
    void drawCampuses(leafletModule.current);
    void refreshMarkers(leafletModule.current);
  }, [campusFilter, campusOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card className="overflow-hidden border-brand-100 shadow-sm">
      <CardHeader className="space-y-3 bg-gradient-to-r from-brand-700 via-brand-800 to-brand-700 border-b border-brand-900/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <CardTitle className="flex items-center gap-2 min-w-0 text-white">
            <div className="w-1 h-5 rounded-full bg-gold-400 shrink-0" />
            <MapPin className="w-4 h-4 shrink-0 text-gold-300" />
            <span className="truncate">{title}</span>
          </CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            {realtime && (
              <Badge className={isRealtimeConnected ? 'bg-green-500/20 text-green-200 border border-green-400/30' : 'bg-white/10 text-brand-200 border border-white/20'}>
                {isRealtimeConnected ? 'Realtime' : 'Actualizando'}
              </Badge>
            )}
            <Badge className="bg-gold-500/20 text-gold-200 border border-gold-400/30">
              {visibleCampusCount} {visibleCampusCount === 1 ? 'sede' : 'sedes'}
            </Badge>
          </div>
        </div>
        {showCampusFilter && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={campusFilter} onValueChange={setCampusFilter}>
              <SelectTrigger className="w-full sm:w-52 h-8 text-xs bg-white/10 border-white/20 text-white hover:bg-white/15">
                <SelectValue placeholder="Todas las sedes" />
              </SelectTrigger>
              <SelectContent className="z-[1000]">
                <SelectItem value="all">Todas las sedes</SelectItem>
                {mapCampusOptions.map((c) => (
                  <SelectItem key={c.id ?? c.name} value={c.id ?? c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex items-center gap-4 px-4 py-2 text-xs text-gray-500 border-b">
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-blue-600 border border-white shadow" />Estudiante activo</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3.5 h-3.5 rounded bg-gold-500 border border-white" />Sede (con su radio permitido)</span>
        </div>
        <div style={{ position: 'relative', width: '100%', height: '320px', overflow: 'hidden', borderRadius: '0 0 0.5rem 0.5rem' }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </CardContent>
    </Card>
  );
}
