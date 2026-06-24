import { useEffect, useRef, useState } from 'react';
import { Loader2, LocateFixed, Search } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { toast } from 'sonner';

// Selector de coordenadas en mapa. Resuelve el problema de pedirle lat/lng a mano
// a un usuario no técnico: puede buscar la dirección, hacer clic en el mapa o
// arrastrar el marcador. Rellena lat/lng (6 decimales, como numeric(9,6) en BD).
const SV_CENTER: [number, number] = [13.7942, -88.8965];

export function CoordinatePicker({
  lat,
  lng,
  onChange,
}: {
  lat: string;
  lng: string;
  onChange: (lat: string, lng: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const emit = (la: number, ln: number) =>
    onChangeRef.current(la.toFixed(6), ln.toFixed(6));

  const placeMarker = (la: number, ln: number, doEmit: boolean) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([la, ln]);
    } else {
      // divIcon HTML evita el problema del icono por defecto roto con Vite.
      const icon = L.divIcon({
        className: '',
        html: '<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;background:#1d4ed8;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);transform:rotate(-45deg)"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 18],
      });
      const marker = L.marker([la, ln], { draggable: true, icon }).addTo(map);
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        emit(p.lat, p.lng);
      });
      markerRef.current = marker;
    }
    if (doEmit) emit(la, ln);
  };

  // Inicializa el mapa una vez.
  useEffect(() => {
    let mounted = true;
    void import('leaflet').then((L) => {
      if (!mounted || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const latN = parseFloat(lat);
      const lngN = parseFloat(lng);
      const hasInitial = Number.isFinite(latN) && Number.isFinite(lngN);
      const map = L.map(containerRef.current, { zoomControl: true })
        .setView(hasInitial ? [latN, lngN] : SV_CENTER, hasInitial ? 16 : 8);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);
      mapRef.current = map;
      if (hasInitial) placeMarker(latN, lngN, false);
      map.on('click', (e: any) => placeMarker(e.latlng.lat, e.latlng.lng, true));
    });
    return () => {
      mounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      leafletRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza el marcador cuando lat/lng cambian desde fuera (campos numéricos).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    if (!Number.isFinite(latN) || !Number.isFinite(lngN)) return;
    const cur = markerRef.current?.getLatLng?.();
    if (cur && Math.abs(cur.lat - latN) < 1e-6 && Math.abs(cur.lng - lngN) < 1e-6) return;
    placeMarker(latN, lngN, false);
    map.setView([latN, lngN], Math.max(map.getZoom() ?? 15, 15));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=sv&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
      const results = (await res.json()) as { lat: string; lon: string }[];
      if (!results || results.length === 0) {
        toast.error('No se encontró esa dirección. Prueba con otro nombre o ubica el punto en el mapa.');
        return;
      }
      const la = parseFloat(results[0].lat);
      const ln = parseFloat(results[0].lon);
      mapRef.current?.setView([la, ln], 16);
      placeMarker(la, ln, true);
    } catch {
      toast.error('No se pudo buscar la dirección. Revisa tu conexión.');
    } finally {
      setSearching(false);
    }
  };

  const handleMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Tu navegador no permite obtener la ubicación.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapRef.current?.setView([latitude, longitude], 16);
        placeMarker(latitude, longitude, true);
      },
      () => toast.error('No se pudo obtener tu ubicación. Concede el permiso o ubica el punto manualmente.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-brand-400" />
          <Input
            className="pl-9"
            placeholder="Hospital y departamento (ej. Hospital San Juan de Dios, San Miguel)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); void handleSearch(); }
            }}
          />
        </div>
        <Button type="button" variant="outline" onClick={() => void handleSearch()} disabled={searching}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
        <Button type="button" variant="outline" onClick={handleMyLocation} title="Usar mi ubicación actual">
          <LocateFixed className="h-4 w-4" />
        </Button>
      </div>
      <div ref={containerRef} className="h-56 w-full rounded-lg border border-brand-100 overflow-hidden" />
      <p className="text-xs text-gray-500">
        Busca el hospital por nombre y departamento, haz clic en el mapa o arrastra el marcador. Las coordenadas se llenan solas.
      </p>
    </div>
  );
}
