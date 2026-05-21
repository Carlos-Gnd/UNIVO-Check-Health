import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { CheckCircle2, Loader2, QrCode, XCircle } from 'lucide-react';
import { supabase } from '@/shared/backend/supabaseClient';
import { registerStudentCheckIn } from '@/shared/backend/checkHealthBackend';

type ScanState = 'idle' | 'scanning' | 'validating' | 'success' | 'error';

type QrPayload = {
  campus_id: string;
  date: string;
  exp?: number;
};

function decodeQrPayload(token: string): QrPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const raw = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(raw.padEnd(raw.length + ((4 - (raw.length % 4)) % 4), '='));
    return JSON.parse(json) as QrPayload;
  } catch {
    return null;
  }
}

export function StudentQrScannerPage() {
  const scannerDivId = 'qr-reader';
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [state, setState] = useState<ScanState>('idle');
  const [message, setMessage] = useState('');
  const [studentId, setStudentId] = useState<string | null>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user.id) setStudentId(data.session.user.id);
    });
  }, []);

  const startScanner = () => {
    if (scannerRef.current) return;
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
  };

  const handleScan = async (text: string, scanner: Html5QrcodeScanner) => {
    if (processingRef.current) return;
    processingRef.current = true;

    scanner.pause(true);
    setState('validating');

    const payload = decodeQrPayload(text);

    if (!payload?.campus_id) {
      setMessage('QR inválido: no contiene datos de sede.');
      setState('error');
      processingRef.current = false;
      return;
    }

    if (payload.exp && Date.now() / 1000 > payload.exp) {
      setMessage('QR expirado. Solicita uno nuevo al encargado.');
      setState('error');
      processingRef.current = false;
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    if (payload.date && payload.date !== today) {
      setMessage(`QR corresponde a ${payload.date}, no a hoy.`);
      setState('error');
      processingRef.current = false;
      return;
    }

    if (!studentId) {
      setMessage('Sesión no encontrada. Vuelve a iniciar sesión.');
      setState('error');
      processingRef.current = false;
      return;
    }

    // Get GPS
    let location: GeolocationCoordinates | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000, enableHighAccuracy: true }),
      );
      location = pos.coords;
    } catch {
      setMessage('No se pudo obtener tu ubicación GPS. Actívala e intenta de nuevo.');
      setState('error');
      processingRef.current = false;
      return;
    }

    const result = await registerStudentCheckIn({
      studentId,
      practiceId: payload.campus_id,
      location: { latitude: location.latitude, longitude: location.longitude, accuracyMeters: location.accuracy },
    });

    if (result.ok) {
      setMessage(result.message);
      setState('success');
      scanner.clear().catch(() => undefined);
      scannerRef.current = null;
    } else {
      setMessage(result.message);
      setState('error');
      scanner.resume();
    }

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
                  <span className="text-sm">Validando ubicación y QR…</span>
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
              <Button variant="outline" onClick={() => { setState('idle'); setMessage(''); processingRef.current = false; }}>
                Escanear otro QR
              </Button>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <XCircle className="w-10 h-10 text-red-500" />
              <p className="text-sm text-red-700 font-medium">{message}</p>
              <Button variant="outline" onClick={() => { stopScanner(); startScanner(); processingRef.current = false; }}>
                Intentar de nuevo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-gray-400 text-center">
        El escáner funciona solo dentro de la app. El registro requiere GPS activo.
      </p>
    </div>
  );
}
