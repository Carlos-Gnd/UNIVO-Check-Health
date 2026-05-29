import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { CheckCircle2, Loader2, QrCode, XCircle } from 'lucide-react';
import { supabase } from '@/shared/backend/supabaseClient';
import { getDeviceFingerprint, getDeviceInfo } from '@/modules/attendance/services/attendance.service';
import { analyzeFakeGpsPattern } from '@/shared/backend/checkHealthBackend';
import type { MotionSensorSample, GeoPointSample } from '@/modules/attendance/types';

type ScanState = 'idle' | 'scanning' | 'validating' | 'success' | 'error';

const SENSOR_LIMIT = 30;

// Decodifica el payload del JWT solo para verificaciones UX rápidas (sin validar firma).
// La validación de firma real ocurre en la Edge Function validate-qr-checkin.
function peekQrPayload(token: string): { campus_id?: string; date?: string; exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const raw = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(raw.padEnd(raw.length + ((4 - (raw.length % 4)) % 4), '='));
    return JSON.parse(json) as { campus_id?: string; date?: string; exp?: number };
  } catch {
    return null;
  }
}

export function StudentQrScannerPage() {
  const scannerDivId = 'qr-reader';
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const processingRef = useRef(false);

  const [state, setState] = useState<ScanState>('idle');
  const [message, setMessage] = useState('');

  // Muestras de sensores recopiladas mientras el escáner está activo (T-09.1)
  const motionSamplesRef = useRef<MotionSensorSample[]>([]);
  const locationSamplesRef = useRef<GeoPointSample[]>([]);

  // Listener de acelerómetro: arranca al montar, para tener muestras listas
  useEffect(() => {
    const handleMotion = (event: DeviceMotionEvent) => {
      const acceleration = event.accelerationIncludingGravity ?? event.acceleration;
      const rotation = event.rotationRate;
      if (!acceleration && !rotation) return;

      const accelerationMagnitude = Math.sqrt(
        (acceleration?.x ?? 0) ** 2 + (acceleration?.y ?? 0) ** 2 + (acceleration?.z ?? 0) ** 2,
      );
      const rotationRateMagnitude = Math.sqrt(
        (rotation?.alpha ?? 0) ** 2 + (rotation?.beta ?? 0) ** 2 + (rotation?.gamma ?? 0) ** 2,
      );

      motionSamplesRef.current = [
        ...motionSamplesRef.current,
        {
          timestamp: Date.now(),
          accelerationMagnitude: Number(accelerationMagnitude.toFixed(4)),
          rotationRateMagnitude: Number(rotationRateMagnitude.toFixed(4)),
        },
      ].slice(-SENSOR_LIMIT);
    };

    // iOS 13+ requiere permiso explícito para DeviceMotionEvent
    const dm = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof dm.requestPermission === 'function') {
      dm.requestPermission().then((perm) => {
        if (perm === 'granted') window.addEventListener('devicemotion', handleMotion);
      }).catch(() => undefined);
    } else {
      window.addEventListener('devicemotion', handleMotion);
    }

    return () => window.removeEventListener('devicemotion', handleMotion);
  }, []);

  const startScanner = () => {
    if (scannerRef.current) return;
    motionSamplesRef.current = [];
    locationSamplesRef.current = [];
    setState('scanning');

    const scanner = new Html5QrcodeScanner(
      scannerDivId,
      {
        fps: 10,
        qrbox: { width: 260, height: 260 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        rememberLastUsedCamera: true,
      },
      false,
    );

    scanner.render(
      (decodedText) => void handleScan(decodedText, scanner),
      () => undefined,
    );

    scannerRef.current = scanner;
  };

  const stopScanner = () => {
    scannerRef.current?.clear().catch(() => undefined);
    scannerRef.current = null;
    setState('idle');
    setMessage('');
    processingRef.current = false;
  };

  const handleScan = async (text: string, scanner: Html5QrcodeScanner) => {
    if (processingRef.current) return;
    processingRef.current = true;
    scanner.pause(true);
    setState('validating');

    // Verificación UX rápida del payload (sin validar firma)
    const peek = peekQrPayload(text);
    if (!peek?.campus_id) {
      setMessage('QR inválido: no contiene datos de sede.');
      setState('error');
      processingRef.current = false;
      return;
    }
    if (peek.exp && Date.now() / 1000 > peek.exp) {
      setMessage('QR expirado. Solicita uno nuevo al encargado.');
      setState('error');
      processingRef.current = false;
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (peek.date && peek.date !== today) {
      setMessage(`QR corresponde a ${peek.date}, no a hoy.`);
      setState('error');
      processingRef.current = false;
      return;
    }

    // Verificar sesión activa
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setMessage('Sesión no encontrada. Vuelve a iniciar sesión.');
      setState('error');
      processingRef.current = false;
      return;
    }

    // Obtener GPS
    let coords: GeolocationCoordinates | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000, enableHighAccuracy: true }),
      );
      coords = pos.coords;
    } catch {
      setMessage('No se pudo obtener tu ubicación GPS. Actívala e intenta de nuevo.');
      setState('error');
      processingRef.current = false;
      return;
    }

    // Agregar lectura GPS actual a location samples
    locationSamplesRef.current = [
      ...locationSamplesRef.current,
      { latitude: coords.latitude, longitude: coords.longitude, accuracyMeters: coords.accuracy, timestamp: Date.now() },
    ].slice(-SENSOR_LIMIT);

    // Construir device info con análisis de GPS falso (T-09.1)
    const rawDeviceInfo = getDeviceInfo({
      location: { latitude: coords.latitude, longitude: coords.longitude, accuracyMeters: coords.accuracy },
      motionSamples: motionSamplesRef.current,
      locationSamples: locationSamplesRef.current,
    });
    const analyzedDeviceInfo = analyzeFakeGpsPattern(rawDeviceInfo);

    // Llamar Edge Function — la firma RS256 se verifica en el servidor
    const { data, error } = await supabase.functions.invoke('validate-qr-checkin', {
      body: {
        qr_token: text,
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy,
        device_fingerprint: getDeviceFingerprint(),
        device_info: analyzedDeviceInfo,
      },
    });

    if (error || !data?.ok) {
      setMessage(data?.message ?? error?.message ?? 'Error al validar el check-in.');
      setState('error');
      scanner.resume();
      processingRef.current = false;
      return;
    }

    setMessage(data.message ?? 'Entrada registrada con hora oficial del servidor.');
    setState('success');
    scanner.clear().catch(() => undefined);
    scannerRef.current = null;
    processingRef.current = false;
  };

  useEffect(() => () => { scannerRef.current?.clear().catch(() => undefined); }, []);

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <h2 className="text-2xl font-semibold text-gray-900">Escanear QR de entrada</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <QrCode className="w-4 h-4" /> Registro por QR
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === 'idle' && (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-gray-600">
                Solicita el QR al encargado de tu sede y escanéalo para registrar tu entrada.
              </p>
              <Button onClick={startScanner} className="bg-blue-600 hover:bg-blue-700 text-white">
                <QrCode className="w-4 h-4 mr-2" />Iniciar escáner
              </Button>
            </div>
          )}

          {(state === 'scanning' || state === 'validating') && (
            <div className="space-y-3">
              <div id={scannerDivId} className="overflow-hidden rounded-lg" />
              {state === 'validating' && (
                <div className="flex items-center justify-center gap-2 text-gray-600 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Validando QR, ubicación y hora…</span>
                </div>
              )}
              {state === 'scanning' && (
                <Button variant="outline" className="w-full" onClick={stopScanner}>
                  Cancelar
                </Button>
              )}
            </div>
          )}

          {state === 'success' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <Badge className="bg-green-100 text-green-700 text-sm px-3 py-1">Entrada registrada</Badge>
              <p className="text-sm text-gray-600">{message}</p>
              <Button
                variant="outline"
                onClick={() => { setState('idle'); setMessage(''); }}
              >
                Escanear otro QR
              </Button>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <XCircle className="w-10 h-10 text-red-500" />
              <p className="text-sm text-red-700 font-medium">{message}</p>
              <Button variant="outline" onClick={() => { stopScanner(); startScanner(); }}>
                Intentar de nuevo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-gray-400 text-center">
        El escáner funciona solo dentro de la app. El registro requiere GPS activo y QR del día.
      </p>
    </div>
  );
}
