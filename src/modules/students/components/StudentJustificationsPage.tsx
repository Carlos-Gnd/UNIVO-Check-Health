import { useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, FileText, FileWarning, Loader2, Paperclip, Plus, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import { PageHeader } from '@/shared/components/PageHeader';
import {
  fetchStudentJustifications,
  fetchStudentAttendances,
  submitJustification,
  type StudentJustification,
  type AttendanceOption,
} from '@/modules/dean/services/justifications.service';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const ACCEPTED_EXT = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx';

const statusLabel: Record<string, string> = { PENDIENTE: 'Pendiente', APROBADO: 'Aprobada', RECHAZADO: 'Rechazada' };
const statusClass: Record<string, string> = {
  PENDIENTE:  'bg-amber-100 text-amber-700',
  APROBADO:   'bg-green-100 text-green-700',
  RECHAZADO:  'bg-red-100 text-red-700',
};

export function StudentJustificationsPage() {
  const [rows, setRows]           = useState<StudentJustification[]>([]);
  const [attendances, setAttendances] = useState<AttendanceOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm]   = useState(false);

  // Form state
  const [attendanceId, setAttendanceId] = useState('');
  const [reason, setReason]       = useState('');
  const [file, setFile]           = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setIsLoading(true);
    const [justifs, atts] = await Promise.all([
      fetchStudentJustifications(),
      fetchStudentAttendances(),
    ]);
    setRows(justifs);
    setAttendances(atts);
    setIsLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const resetForm = () => {
    setAttendanceId('');
    setReason('');
    setFile(null);
    setIsSaving(false);
  };

  const openForm = () => { resetForm(); setShowForm(true); };
  const closeForm = () => { if (!isSaving) { resetForm(); setShowForm(false); } };

  const handleFile = (f: File | undefined) => {
    if (!f) return;
    if (!ACCEPTED_TYPES.includes(f.type)) {
      toast.error('Tipo de archivo no permitido. Usa PDF, imagen o Word.');
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      toast.error('El archivo excede los 10 MB.');
      return;
    }
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async () => {
    if (!attendanceId) { toast.error('Selecciona una asistencia.'); return; }
    if (!reason.trim()) { toast.error('El motivo es obligatorio.'); return; }

    setIsSaving(true);
    const result = await submitJustification({ attendanceId, reason, documentFile: file ?? undefined });
    setIsSaving(false);

    if (!result.ok) {
      toast.error(result.message ?? 'Error al enviar la solicitud.');
      return;
    }

    toast.success('Solicitud enviada. El coordinador revisará tu caso.');
    closeForm();
    void load();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Cargando justificaciones…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <PageHeader
        title="Justificaciones"
        description="Solicita justificación para ausencias o tardanzas."
        action={(
          <Button onClick={openForm} className="bg-white/10 border border-white/20 text-white hover:bg-white/20">
            <Plus className="w-4 h-4 mr-1.5" />Nueva solicitud
          </Button>
        )}
      />

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <FileWarning className="w-10 h-10 text-gray-300" />
            <p className="text-sm text-gray-500">No has enviado ninguna justificación todavía.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-sm font-semibold text-gray-900">
                    {format(parseISO(row.attendanceDate), 'dd/MM/yyyy', { locale: es })} — {row.campusName}
                  </CardTitle>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Enviada el {format(parseISO(row.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </p>
                </div>
                <Badge className={statusClass[row.status] ?? 'bg-gray-100 text-gray-600'}>
                  {statusLabel[row.status] ?? row.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <p className="text-sm text-gray-700">{row.reason}</p>
                {row.documentUrl && (
                  <a
                    href={row.documentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-brand-700 hover:underline"
                  >
                    <Paperclip className="w-3 h-3" />Ver documento adjunto
                  </a>
                )}
                {row.reviewerNotes && (
                  <div className="rounded bg-brand-50 px-3 py-2 text-xs text-gray-600 border border-brand-100">
                    <span className="font-medium">Nota del revisor:</span> {row.reviewerNotes}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog para nueva justificación */}
      <Dialog open={showForm} onOpenChange={closeForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileWarning className="h-5 w-5 text-brand-700" />Nueva solicitud de justificación</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-1">
            {/* Selección de asistencia */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-brand-700"><CalendarDays className="h-3.5 w-3.5" />Asistencia a justificar *</Label>
              <Select value={attendanceId} onValueChange={setAttendanceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una jornada" />
                </SelectTrigger>
                <SelectContent>
                  {attendances.length === 0 ? (
                    <SelectItem value="-" disabled>Sin asistencias registradas</SelectItem>
                  ) : (
                    attendances.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {format(parseISO(a.date), 'dd/MM/yyyy', { locale: es })} — {a.campusName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Motivo */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-brand-700"><FileText className="h-3.5 w-3.5" />Motivo *</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                placeholder="Describe el motivo de tu ausencia o tardanza…"
              />
            </div>

            {/* Zona drag-and-drop */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-brand-700"><Paperclip className="h-3.5 w-3.5" />Documento de respaldo (opcional, máx. 10 MB)</Label>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors ${
                  isDragging ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                }`}
              >
                <Upload className="w-6 h-6 text-gray-400" />
                {file ? (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Paperclip className="w-4 h-4" />
                    <span className="truncate max-w-[240px]">{file.name}</span>
                    <span className="text-xs text-gray-400">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-500">Arrastra aquí o haz clic para seleccionar</p>
                    <p className="text-xs text-gray-400">PDF, imágenes o Word · máx. 10 MB</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_EXT}
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeForm} disabled={isSaving}>Cancelar</Button>
              <Button
                onClick={handleSubmit}
                disabled={isSaving}
                className="bg-brand-700 hover:bg-brand-800 text-white"
              >
                {isSaving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                Enviar solicitud
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
