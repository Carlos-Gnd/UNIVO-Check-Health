// T-27.1: genera el PDF del reporte consolidado del grupo del docente y lo firma
// digitalmente llamando a la Edge Function `sign-report` (T-27.2, Carlos).
//
// Nota de integridad: el sello (HMAC) se calcula sobre el hash del PDF, así que NO
// se estampa dentro del archivo descargado (eso cambiaría sus bytes e invalidaría
// el hash). El archivo que se descarga es exactamente el que se hasheó; el sello y
// el hash quedan registrados de forma inmutable en `audit_log` (firma "detached").
// La X.509 embebida queda para Sprint 4.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/shared/backend/supabaseClient';
import { getActiveStudentsSnapshot } from '@/shared/backend/checkHealthBackend';
import { fetchTeacherRoster, type TeacherStudent } from './teacher.service';

export type ReportMeta = { period?: string; groupLabel?: string };
export type SignReportResult = {
  ok: boolean;
  seal?: string;
  teacherSeal?: string;
  systemSeal?: string;
  signedAt?: string;
  signedBy?: string;
  systemSignedBy?: string;
  reportHash?: string;
  message?: string;
};

// SHA-256 en hex (minúsculas) de los bytes del PDF.
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Copia respaldada por ArrayBuffer (evita el tipo SharedArrayBuffer en subtle.digest).
  const view = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest('SHA-256', view);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type SnapshotHours = { hoursToday: number; totalCycleHours: number };

// Construye el PDF consolidado del grupo (A4, header UNIVO, tabla del roster).
// hoursMap: studentId → horas (sólo estudiantes con check-in activo en este momento).
export async function buildGroupReportPdf(
  roster: TeacherStudent[],
  meta: ReportMeta,
  hoursMap: Map<string, SnapshotHours> = new Map(),
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const margin = 18;
  const contentW = W - margin * 2;
  const pageH = doc.internal.pageSize.getHeight();

  // ── Logo ──────────────────────────────────────────────────────────────
  let logoDataUrl: string | null = null;
  try {
    const res = await fetch('/images/isologo.png');
    const blob = await res.blob();
    logoDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch { /* continúa sin logo */ }

  // ── Encabezado ────────────────────────────────────────────────────────
  doc.setFillColor(27, 58, 107);
  doc.rect(0, 0, W, 38, 'F');

  const logoSize = 22;
  const logoPad = 2.5;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, 7, logoSize, logoSize, 3, 3, 'F');
  doc.setDrawColor(245, 166, 35);
  doc.setLineWidth(0.9);
  doc.roundedRect(margin, 7, logoSize, logoSize, 3, 3, 'S');
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', margin + logoPad, 7 + logoPad, logoSize - logoPad * 2, logoSize - logoPad * 2);
  }

  const textX = margin + logoSize + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('UNIVO Check-Health', textX, 17);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(180, 200, 235);
  doc.text('Universidad de Oriente  •  Área de Salud', textX, 26);

  doc.setDrawColor(245, 166, 35);
  doc.setLineWidth(1);
  doc.line(0, 38, W, 38);

  // ── Título ────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(27, 58, 107);
  doc.text('REPORTE CONSOLIDADO DEL GRUPO', W / 2, 52, { align: 'center' });

  doc.setDrawColor(215, 225, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, 57, W - margin, 57);

  // ── Datos del grupo ───────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('INFORMACIÓN DEL GRUPO', margin, 65);

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, 69, contentW, 24, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, 69, contentW, 24, 2, 2, 'S');

  const half = contentW / 2;
  doc.setFontSize(9);
  [
    { label: 'Período:', value: meta.period ?? '—', x: margin + 6, lw: 18, y: 78 },
    { label: 'Grupo:', value: meta.groupLabel ?? '—', x: margin + 6, lw: 18, y: 87 },
    { label: 'Estudiantes:', value: String(roster.length), x: margin + half + 6, lw: 26, y: 78 },
    { label: 'Generado:', value: new Date().toLocaleDateString('es-SV'), x: margin + half + 6, lw: 26, y: 87 },
  ].forEach(({ label, value, x, lw, y }) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(label, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(value, x + lw, y);
  });

  // ── Tabla del roster ──────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('REGISTRO DE ESTUDIANTES', margin, 102);

  autoTable(doc, {
    startY: 106,
    margin: { left: margin, right: margin, bottom: 20 },
    head: [['#', 'Nombre', 'Carné', 'Carrera', 'H. jornada', 'H. ciclo', 'Evaluación']],
    body: roster.map((s, i) => {
      const hrs = hoursMap.get(s.studentId);
      return [
        String(i + 1),
        s.fullName,
        s.studentCode || '—',
        s.career,
        hrs != null ? hrs.hoursToday.toFixed(1) : '—',
        hrs != null ? hrs.totalCycleHours.toFixed(1) : '—',
        'Pendiente',
      ];
    }),
    headStyles: { fillColor: [27, 58, 107], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 46 },
      2: { cellWidth: 20 },
      3: { cellWidth: 46 },
      4: { cellWidth: 16, halign: 'right' },
      5: { cellWidth: 16, halign: 'right' },
      6: { cellWidth: 22, halign: 'center' },
    },
    didDrawPage: () => {
      doc.setDrawColor(215, 225, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, pageH - 18, W - margin, pageH - 18);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('UNIVO Check-Health  •  Reporte generado automáticamente', W / 2, pageH - 10, { align: 'center' });
    },
  });

  // ── Línea de firma ────────────────────────────────────────────────────
  let sigY = (doc as any).lastAutoTable.finalY + 16;
  if (sigY + 30 > pageH - 22) { doc.addPage(); sigY = 25; }

  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.4);
  doc.line(margin, sigY + 18, margin + 70, sigY + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Firma del Docente', margin, sigY + 23);

  doc.line(W - margin - 70, sigY + 18, W - margin, sigY + 18);
  doc.text('Fecha', W - margin - 70, sigY + 23);

  return doc;
}

// Genera + firma + descarga el reporte. Devuelve el sello para mostrarlo en la UI.
export async function signGroupReport(meta: ReportMeta): Promise<SignReportResult> {
  const [roster, snapshot] = await Promise.all([
    fetchTeacherRoster(meta.period),
    getActiveStudentsSnapshot(),
  ]);
  const hoursMap = new Map<string, SnapshotHours>(
    snapshot.map((s) => [s.studentId, { hoursToday: s.hoursToday, totalCycleHours: s.totalCycleHours }]),
  );
  const doc = await buildGroupReportPdf(roster, meta, hoursMap);

  const bytes = new Uint8Array(doc.output('arraybuffer'));
  const reportHash = await sha256Hex(bytes);

  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    seal?: string;
    teacher_seal?: string;
    system_seal?: string;
    signed_at?: string;
    signed_by?: string;
    system_signed_by?: string;
    error?: string;
  }>('sign-report', {
    body: { report_hash: reportHash, period: meta.period ?? null, group_label: meta.groupLabel ?? null },
  });

  const teacherSeal = data?.teacher_seal ?? data?.seal;
  const systemSeal = data?.system_seal;
  if (error || !data?.ok || !teacherSeal || !systemSeal) {
    return { ok: false, reportHash, message: data?.error ?? error?.message ?? 'No se pudo firmar el reporte.' };
  }

  // Descarga el PDF exacto que se firmó (sin modificarlo tras el hash).
  doc.save(`reporte-grupo-${meta.period ?? 'actual'}-${reportHash.slice(0, 8)}.pdf`);

  return {
    ok: true,
    seal: teacherSeal,
    teacherSeal,
    systemSeal,
    signedAt: data.signed_at,
    signedBy: data.signed_by,
    systemSignedBy: data.system_signed_by,
    reportHash,
  };
}
