import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { CheckCircle2, Clock, Keyboard, Loader2, QrCode, XCircle } from 'lucide-react';
import { HelpTooltip } from '@/shared/components/HelpTooltip';
import { supabase } from '@/shared/backend/supabaseClient';
import { getDeviceFingerprint, getDeviceInfo } from '@/modules/attendance/services/attendance.service';
import { analyzeFakeGpsPattern } from '@/shared/backend/checkHealthBackend';
import type { MotionSensorSample, GeoPointSample } from '@/modules/attendance/types';
import { PageHeader } from '@/shared/components/PageHeader';

type ScanState = 'idle' | 'scanning' | 'validating' | 'success' | 'error' | 'countdown';
type Mode = 'camera' | 'manual';

type Campus = { id: string; name: string };
type SubjectChoice = {
  assignment_id: string;
  subject_id: string | null;
  subject_name: string;
  subject_code: string | null;
};

const SENSOR_LIMIT = 30;

function peekQrPayload(token: string): { campus_id?: string; date?: string; exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const raw = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(raw.padEnd(raw.length + ((4 - (raw.length % 4)) % 4), '='));
    return JSON.parse(json) as { campus_id?: string; date?: string; exp?: number };
  } catch { return null; }
}

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

function secondsUntil(timeStr: string): number {
  const svOffset = -6 * 60;
  const utcNow = Date.now() + new Date().getTimezoneOffset() * 60000;
  const svNow = new Date(utcNow + svOffset * 60000);
  const [h, m, sec] = timeStr.split(':').map(Number);
  const target = new Date(svNow);
  target.setHours(h, m, sec ?? 0, 0);
  const diff = Math.floor((target.getTime() - svNow.getTime()) / 1000);
  return diff > 0 ? diff : 0;
}

async function getGps(): Promise<GeolocationCoordinates> {
  return new Promise((res, rej) =>
    navigator.geolocation.getCurrentPosition((p) => res(p.coords), rej, { timeout: 10000, enableHighAccuracy: true }),
  );
}

// Detiene la cámara y libera el stream. Html5Qrcode requiere stop() antes de clear().
function teardownScanner(scanner: Html5Qrcode | null): void {
  if (!scanner) return;
  try {
    void scanner.stop().then(() => scanner.clear()).catch(() => undefined);
  } catch {
    // ya estaba detenido
  }
}

export function StudentQrScannerPage() {
  const scannerDivId = 'qr-reader';
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);

  const [mode, setMode] = useState<Mode>('camera');
  const [state, setState] = useState<ScanState>('idle');
  const [message, setMessage] = useState('');
  const [cameraError, setCameraError] = useState('');

  // Modo manual
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [selectedCampus, setSelectedCampus] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [subjectChoices, setSubjectChoices] = useState<SubjectChoice[]>([]);
  const [pendingValidation, setPendingValidation] = useState<{ body: Record<string, unknown>; campusIdForCountdown?: string } | null>(null);
  const [selectedSubject, setSelectedSubject] = useState('');

  // Countdown
  const [countdownSecs, setCountdownSecs] = useState(0);
  const [windowOpen, setWindowOpen] = useState('');
  const [windowClose, setWindowClose] = useState('');
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sensores
  const motionSamplesRef = useRef<MotionSensorSample[]>([]);
  const locationSamplesRef = useRef<GeoPointSample[]>([]);
  const motionHandlerRef = useRef<((e: DeviceMotionEvent) => void) | null>(null);
  const motionGrantedRef = useRef(false);

  // Cargar sedes activas para el modo manual
  useEffect(() => {
    supabase.from('campuses').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => { if (data) setCampuses(data as Campus[]); });
  }, []);

  // Listener de acelerómetro (best-effort). En iOS 13+ el permiso debe pedirse
  // desde un gesto del usuario (ver ensureMotionPermission); aquí solo se engancha
  // directo en navegadores sin gate de permiso (Android Chrome, desktop). Si el
  // navegador no expone DeviceMotion (Firefox desktop) o lo bloquea (Brave Shields),
  // el evento simplemente nunca llega y el check-in continúa sin estas muestras.
  useEffect(() => {
    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity ?? event.acceleration;
      const rot = event.rotationRate;
      if (!acc && !rot) return;
      const am = Math.sqrt((acc?.x ?? 0) ** 2 + (acc?.y ?? 0) ** 2 + (acc?.z ?? 0) ** 2);
      const rm = Math.sqrt((rot?.alpha ?? 0) ** 2 + (rot?.beta ?? 0) ** 2 + (rot?.gamma ?? 0) ** 2);
      motionSamplesRef.current = [
        ...motionSamplesRef.current,
        { timestamp: Date.now(), accelerationMagnitude: +am.toFixed(4), rotationRateMagnitude: +rm.toFixed(4) },
      ].slice(-SENSOR_LIMIT);
    };
    motionHandlerRef.current = handleMotion;
    const dm = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
    if (typeof dm !== 'undefined' && typeof dm.requestPermission !== 'function') {
      window.addEventListener('devicemotion', handleMotion);
      motionGrantedRef.current = true;
    }
    return () => { if (motionHandlerRef.current) window.removeEventListener('devicemotion', motionHandlerRef.current); };
  }, []);

  // Pide el permiso de DeviceMotion en iOS DESDE un gesto del usuario (botón). Es
  // best-effort: si no existe la API, el usuario niega, o el navegador lo bloquea,
  // el check-in sigue sin sensores (la detección de fraude tolera 0 muestras).
  const ensureMotionPermission = () => {
    if (motionGrantedRef.current) return;
    const dm = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
    if (typeof dm === 'undefined' || typeof dm.requestPermission !== 'function') return;
    dm.requestPermission()
      .then((p) => {
        if (p === 'granted' && motionHandlerRef.current) {
          window.addEventListener('devicemotion', motionHandlerRef.current);
          motionGrantedRef.current = true;
        }
      })
      .catch(() => undefined);
  };

  // Countdown tick
  useEffect(() => {
    if (state !== 'countdown') {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      return;
    }
    countdownRef.current = setInterval(() => {
      setCountdownSecs((p) => {
        if (p <= 1) { clearInterval(countdownRef.current!); countdownRef.current = null; setState('idle'); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [state]);

  // Liberar la cámara al desmontar el componente
  useEffect(() => () => { teardownScanner(scannerRef.current); scannerRef.current = null; }, []);

  // Arranca la cámara SOLO cuando el <div id="qr-reader"> ya está montado en el DOM.
  // El bug anterior instanciaba el scanner y llamaba render() en el mismo click,
  // antes de que React pintara el div → html5-qrcode no encontraba el elemento y la
  // cámara nunca abría. Aquí el efecto corre tras el commit, con el div ya presente.
  useEffect(() => {
    if (mode !== 'camera' || state !== 'scanning' || scannerRef.current) return;
    if (!document.getElementById(scannerDivId)) return;
    const scanner = new Html5Qrcode(scannerDivId, { verbose: false });
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (decodedText) => void handleScan(decodedText, scanner),
        undefined,
      )
      .then(() => {
        // iOS Safari exige playsinline o el video intenta ir a pantalla completa y falla.
        const video = document.querySelector<HTMLVideoElement>(`#${scannerDivId} video`);
        if (video) {
          video.setAttribute('playsinline', 'true');
          video.setAttribute('muted', 'true');
          video.muted = true;
        }
      })
      .catch(() => {
        setCameraError('No se pudo acceder a la cámara. Revisa los permisos del navegador o usa el código manual.');
        teardownScanner(scanner);
        scannerRef.current = null;
        setState('idle');
      });
    // handleScan se define más abajo; el callback solo se ejecuta tras el montaje.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, state]);

  // Libera la cámara al salir del escaneo (éxito, error, countdown o idle).
  useEffect(() => {
    if (state === 'scanning' || state === 'validating') return;
    if (scannerRef.current) { teardownScanner(scannerRef.current); scannerRef.current = null; }
  }, [state]);

  const startScanner = () => {
    ensureMotionPermission(); // gesto del usuario: aquí sí lo concede iOS
    motionSamplesRef.current = [];
    locationSamplesRef.current = [];
    setCameraError('');
    setMessage('');
    setState('scanning'); // el useEffect de arriba arranca la cámara una vez montado el div
  };

  const stopScanner = () => {
    teardownScanner(scannerRef.current);
    scannerRef.current = null;
    setState('idle');
    setMessage('');
    processingRef.current = false;
  };

  const tryStartCountdown = async (campusId: string) => {
    const { data } = await supabase.from('campuses').select('check_in_from, check_in_to').eq('id', campusId).single();
    if (!data?.check_in_from) return false;
    const secs = secondsUntil(data.check_in_from);
    if (secs <= 0) return false;
    setWindowOpen((data.check_in_from as string).slice(0, 5));
    setWindowClose(data.check_in_to ? (data.check_in_to as string).slice(0, 5) : '');
    setCountdownSecs(secs);
    setState('countdown');
    return true;
  };

  // Construye device_info con análisis de fraude
  const buildDeviceInfo = (coords: GeolocationCoordinates) => {
    locationSamplesRef.current = [
      ...locationSamplesRef.current,
      { latitude: coords.latitude, longitude: coords.longitude, accuracyMeters: coords.accuracy, timestamp: Date.now() },
    ].slice(-SENSOR_LIMIT);
    const raw = getDeviceInfo({
      location: { latitude: coords.latitude, longitude: coords.longitude, accuracyMeters: coords.accuracy },
      motionSamples: motionSamplesRef.current,
      locationSamples: locationSamplesRef.current,
    });
    return analyzeFakeGpsPattern(raw);
  };

  // Llamada unificada a la Edge Function
  const callValidate = async (
    body: Record<string, unknown>,
    campusIdForCountdown?: string,
  ) => {
    const { data, error } = await supabase.functions.invoke('validate-qr-checkin', { body });
    if (error || !data?.ok) {
      if (data?.requires_subject_choice && Array.isArray(data.assignments)) {
        setSubjectChoices(data.assignments as SubjectChoice[]);
        setPendingValidation({ body, campusIdForCountdown });
        setSelectedSubject('');
        setMessage(data.message ?? 'Selecciona la materia para registrar la entrada.');
        setState('error');
        return false;
      }
      const msg: string = data?.message ?? error?.message ?? 'Error al validar el check-in.';
      if ((msg.toLowerCase().includes('horario') || msg.toLowerCase().includes('ventana')) && campusIdForCountdown) {
        const started = await tryStartCountdown(campusIdForCountdown);
        if (started) return true; // countdown activo
      }
      setMessage(msg);
      setState('error');
      return false;
    }
    setMessage(data.message ?? 'Entrada registrada con hora oficial del servidor.');
    setState('success');
    return true;
  };

  const submitSubjectChoice = async () => {
    if (!pendingValidation || !selectedSubject) return;
    setState('validating');
    setSubjectChoices([]);
    const subjectId = selectedSubject === '__none__' ? null : selectedSubject;
    await callValidate(
      { ...pendingValidation.body, subject_id: subjectId },
      pendingValidation.campusIdForCountdown,
    );
    setPendingValidation(null);
  };

  // ── Modo cámara ──────────────────────────────────────────────────────────────
  const handleScan = async (text: string, scanner: Html5Qrcode) => {
    if (processingRef.current) return;
    processingRef.current = true;
    scanner.pause(true);
    setState('validating');

    const peek = peekQrPayload(text);
    if (!peek?.campus_id) {
      setMessage('QR inválido: no contiene datos de sede.'); setState('error');
      processingRef.current = false; return;
    }
    if (peek.exp && Date.now() / 1000 > peek.exp) {
      setMessage('QR expirado. Solicita uno nuevo al encargado.'); setState('error');
      processingRef.current = false; return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (peek.date && peek.date !== today) {
      setMessage(`QR corresponde a ${peek.date}, no a hoy.`); setState('error');
      processingRef.current = false; return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setMessage('Sesión no encontrada. Vuelve a iniciar sesión.'); setState('error');
      processingRef.current = false; return;
    }

    let coords: GeolocationCoordinates;
    try { coords = await getGps(); }
    catch {
      setMessage('No se pudo obtener tu ubicación GPS. Actívala e intenta de nuevo.');
      setState('error'); processingRef.current = false; return;
    }

    // El cierre de la cámara lo maneja el efecto al cambiar de estado (success/error/countdown).
    await callValidate({
      qr_token: text,
      lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy,
      device_fingerprint: getDeviceFingerprint(),
      device_info: buildDeviceInfo(coords),
    }, peek.campus_id);

    processingRef.current = false;
  };

  // ── Modo manual ──────────────────────────────────────────────────────────────
  const handleManualSubmit = async () => {
    if (!selectedCampus) { setMessage('Selecciona tu sede.'); return; }
    const code = shortCode.trim().toUpperCase();
    if (code.length !== 6) { setMessage('El código debe tener 6 caracteres.'); return; }
    ensureMotionPermission(); // gesto del usuario

    setIsSubmittingManual(true);
    setState('validating');

    let coords: GeolocationCoordinates;
    try { coords = await getGps(); }
    catch {
      setMessage('No se pudo obtener tu ubicación GPS. Actívala e intenta de nuevo.');
      setState('error'); setIsSubmittingManual(false); return;
    }

    await callValidate({
      short_code: code,
      campus_id: selectedCampus,
      lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy,
      device_fingerprint: getDeviceFingerprint(),
      device_info: buildDeviceInfo(coords),
    }, selectedCampus);

    setIsSubmittingManual(false);
  };

  const resetAll = () => {
    setState('idle');
    setMessage('');
    setCameraError('');
    setShortCode('');
    setSelectedCampus('');
    setSubjectChoices([]);
    setPendingValidation(null);
    setSelectedSubject('');
    processingRef.current = false;
  };

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <PageHeader
        title="Registrar entrada"
        description="Escanea el QR de tu sede o usa el código manual del encargado."
        action={<HelpTooltip side="left" text="Apunta la cámara al QR que muestra tu encargado en la sede. Si la cámara no funciona, usa 'Código manual' e ingresa las 6 letras. Debes estar dentro de la sede y dentro de tu horario para que el registro se acepte." />}
      />

      {/* Selector de modo */}
      {(state === 'idle' || cameraError) && (
        <div className="flex rounded-lg border overflow-hidden">
          <button
            onClick={() => { setMode('camera'); setCameraError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${mode === 'camera' ? 'bg-brand-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            <QrCode className="w-4 h-4" />Escanear QR
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${mode === 'manual' ? 'bg-brand-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            <Keyboard className="w-4 h-4" />Código manual
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {mode === 'camera' ? <><QrCode className="w-4 h-4" />Registro por QR</> : <><Keyboard className="w-4 h-4" />Código del encargado</>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* ── Modo cámara ── */}
          {mode === 'camera' && state === 'idle' && (
            <div className="text-center py-4 space-y-3">
              {cameraError
                ? <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{cameraError}</p>
                : <p className="text-sm text-gray-600">Solicita el QR al encargado de tu sede y escanéalo.</p>}
              {!cameraError && (
                <Button onClick={startScanner} className="bg-brand-700 hover:bg-brand-800 text-white">
                  <QrCode className="w-4 h-4 mr-2" />Iniciar escáner
                </Button>
              )}
            </div>
          )}

          {mode === 'camera' && (state === 'scanning' || state === 'validating') && (
            <div className="space-y-3">
              <div id={scannerDivId} className="overflow-hidden rounded-lg" />
              {state === 'validating' && (
                <div className="flex items-center justify-center gap-2 text-gray-600 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Validando QR, ubicación y hora…</span>
                </div>
              )}
              {state === 'scanning' && (
                <Button variant="outline" className="w-full" onClick={stopScanner}>Cancelar</Button>
              )}
            </div>
          )}

          {/* ── Modo manual ── */}
          {mode === 'manual' && state === 'idle' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Pídele al encargado el <strong>código de 6 caracteres</strong> que aparece junto al QR en su pantalla.
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide">Tu sede *</Label>
                <Select value={selectedCampus} onValueChange={setSelectedCampus}>
                  <SelectTrigger><SelectValue placeholder="Selecciona tu sede" /></SelectTrigger>
                  <SelectContent>
                    {campuses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide">Código del encargado *</Label>
                <Input
                  value={shortCode}
                  onChange={(e) => setShortCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  placeholder="ABC123"
                  className="text-center text-2xl font-mono tracking-widest uppercase"
                  maxLength={6}
                />
                <p className="text-xs text-gray-400 text-center">{shortCode.length}/6 caracteres</p>
              </div>
              {message && (
                <p className="text-sm text-red-700 text-center font-medium">{message}</p>
              )}
              <Button
                onClick={handleManualSubmit}
                disabled={isSubmittingManual || shortCode.length !== 6 || !selectedCampus}
                className="w-full bg-brand-700 hover:bg-brand-800 text-white"
              >
                {isSubmittingManual ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Registrar entrada
              </Button>
            </div>
          )}

          {/* Validando (modo manual) */}
          {mode === 'manual' && state === 'validating' && (
            <div className="flex items-center justify-center gap-2 text-gray-600 py-8">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Validando código, ubicación y hora…</span>
            </div>
          )}

          {/* ── Countdown ── */}
          {state === 'countdown' && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="w-8 h-8 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">El check-in aún no está habilitado</p>
                {windowOpen && <p className="text-xs text-gray-500 mt-1">Ventana: <strong>{windowOpen}</strong>{windowClose ? ` – ${windowClose}` : ''}</p>}
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-8 py-4">
                <p className="text-xs text-amber-600 uppercase tracking-widest mb-1">Abre en</p>
                <p className="text-4xl font-mono font-bold text-amber-700 tabular-nums">{formatCountdown(countdownSecs)}</p>
              </div>
              <Badge className="bg-amber-100 text-amber-700">El escáner se habilitará automáticamente</Badge>
            </div>
          )}

          {/* ── Éxito ── */}
          {state === 'success' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <Badge className="bg-green-100 text-green-700 text-sm px-3 py-1">Entrada registrada</Badge>
              <p className="text-sm text-gray-600">{message}</p>
              <Button variant="outline" onClick={resetAll}>Registrar otro</Button>
            </div>
          )}

          {/* ── Error (cámara) ── */}
          {state === 'error' && mode === 'camera' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <XCircle className="w-10 h-10 text-red-500" />
              <p className="text-sm text-red-700 font-medium">{message}</p>
              {subjectChoices.length > 0 ? (
                <SubjectChoicePanel
                  choices={subjectChoices}
                  selectedSubject={selectedSubject}
                  onSelect={setSelectedSubject}
                  onSubmit={() => void submitSubjectChoice()}
                />
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { stopScanner(); startScanner(); }}>Reintentar</Button>
                  <Button variant="outline" onClick={() => { resetAll(); setMode('manual'); }}>
                    <Keyboard className="w-4 h-4 mr-1.5" />Usar código
                  </Button>
                </div>
              )}
            </div>
          )}

          {state === 'error' && mode === 'manual' && subjectChoices.length > 0 && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-amber-700 text-center font-medium">{message}</p>
              <SubjectChoicePanel
                choices={subjectChoices}
                selectedSubject={selectedSubject}
                onSelect={setSelectedSubject}
                onSubmit={() => void submitSubjectChoice()}
              />
            </div>
          )}

        </CardContent>
      </Card>

      <p className="text-xs text-gray-400 text-center">
        El check-in requiere GPS activo y estar dentro del área de la sede.
      </p>
    </div>
  );
}

function SubjectChoicePanel({
  choices,
  selectedSubject,
  onSelect,
  onSubmit,
}: {
  choices: SubjectChoice[];
  selectedSubject: string;
  onSelect: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="w-full space-y-3 text-left">
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide">Materia *</Label>
        <Select value={selectedSubject} onValueChange={onSelect}>
          <SelectTrigger><SelectValue placeholder="Selecciona materia" /></SelectTrigger>
          <SelectContent>
            {choices.map((choice) => (
              <SelectItem key={choice.assignment_id} value={choice.subject_id ?? '__none__'}>
                {choice.subject_code ? `${choice.subject_code} - ` : ''}{choice.subject_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button className="w-full bg-brand-700 hover:bg-brand-800 text-white" disabled={!selectedSubject} onClick={onSubmit}>
        Registrar entrada
      </Button>
    </div>
  );
}
