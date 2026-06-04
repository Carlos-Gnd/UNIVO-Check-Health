import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { supabase } from '@/shared/backend/supabaseClient';

// Forma mínima que necesita el mapa (subconjunto del snapshot de checkHealthBackend).
export type LiveMapStudent = {
  studentName: string;
  carnet?: string | null;
  siteName: string;
  hoursToday: number;
  lastLocation?: { latitude: number; longitude: number } | null;
};

// Mapa Leaflet reutilizable de estudiantes activos. La fuente de datos se inyecta
// vía `fetchSnapshot`, de modo que el decano (todos) y el docente (su grupo, T-23.1)
// comparten el mismo render. Refresca cada 30 s y, opcionalmente, en realtime.
export function StudentLiveMap({
  fetchSnapshot,
  title = 'Estudiantes activos en tiempo real',
  realtime = true,
}: {
  fetchSnapshot: () => Promise<LiveMapStudent[]>;
  title?: string;
  realtime?: boolean;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletInstance = useRef<any>(null);
  const markersLayer = useRef<any>(null);
  const leafletModule = useRef<any>(null);
  const channelId = useRef(`live-map-${Math.random().toString(36).slice(2)}`);
  // Ref a la función para evitar stale closures en intervalos/realtime.
  const fetchRef = useRef(fetchSnapshot);
  fetchRef.current = fetchSnapshot;

  const [studentCount, setStudentCount] = useState(0);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  const refreshMarkers = async (L: any) => {
    const students = await fetchRef.current();
    setStudentCount(students.length);
    if (!markersLayer.current) return;
    markersLayer.current.clearLayers();
    students.forEach((s) => {
      if (!s.lastLocation) return;
      L.marker([s.lastLocation.latitude, s.lastLocation.longitude])
        .bindPopup(
          `<b style="font-size:13px">${s.studentName}</b>` +
          (s.carnet ? `<br/><span style="font-size:11px;color:#6b7280">${s.carnet}</span>` : '') +
          `<br/><span style="font-size:11px">${s.siteName}</span>` +
          `<br/><span style="font-size:11px;color:#2563eb">${s.hoursToday.toFixed(1)} h hoy</span>`,
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
      markersLayer.current = L.layerGroup().addTo(map);
      leafletInstance.current = map;
      void refreshMarkers(L);
      interval = setInterval(() => void refreshMarkers(L), 30000);
    });
    return () => {
      isMounted = false;
      clearInterval(interval);
      leafletInstance.current?.remove();
      leafletInstance.current = null;
      markersLayer.current = null;
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

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <CardTitle className="flex items-center gap-2 min-w-0">
            <MapPin className="w-4 h-4 shrink-0 text-brand-700" />
            <span className="truncate">{title}</span>
          </CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            {realtime && (
              <Badge className={isRealtimeConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                {isRealtimeConnected ? 'Realtime' : 'Actualizando'}
              </Badge>
            )}
            <Badge className="bg-brand-100 text-brand-700">{studentCount} en sedes</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div style={{ position: 'relative', width: '100%', height: '320px', overflow: 'hidden', borderRadius: '0 0 0.5rem 0.5rem' }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </CardContent>
    </Card>
  );
}
