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
import { fetchTeacherRoster, type TeacherStudent } from './teacher.service';

export type ReportMeta = { period?: string; groupLabel?: string };
export type SignReportResult = {
  ok: boolean;
  seal?: string;
  signedAt?: string;
  signedBy?: string;
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

// Construye el PDF consolidado del grupo (A4, encabezado UNIVO + tabla del roster).
export function buildGroupReportPdf(roster: TeacherStudent[], meta: ReportMeta): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFontSize(16);
  doc.text('UNIVO Check-Health', 14, 18);
  doc.setFontSize(12);
  doc.text('Reporte consolidado del grupo', 14, 26);
  doc.setFontSize(10);
  doc.text(`Período: ${meta.period ?? '—'}`, 14, 34);
  doc.text(`Grupo: ${meta.groupLabel ?? '—'}`, 14, 40);
  doc.text(`Estudiantes: ${roster.length}`, 14, 46);

  autoTable(doc, {
    startY: 52,
    head: [['#', 'Carné', 'Nombre', 'Carrera']],
    body: roster.map((s, i) => [String(i + 1), s.studentCode || '—', s.fullName, s.career]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 58, 95] },
  });

  return doc;
}

// Genera + firma + descarga el reporte. Devuelve el sello para mostrarlo en la UI.
export async function signGroupReport(meta: ReportMeta): Promise<SignReportResult> {
  const roster = await fetchTeacherRoster(meta.period);
  const doc = buildGroupReportPdf(roster, meta);

  const bytes = new Uint8Array(doc.output('arraybuffer'));
  const reportHash = await sha256Hex(bytes);

  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean; seal?: string; signed_at?: string; signed_by?: string; error?: string;
  }>('sign-report', {
    body: { report_hash: reportHash, period: meta.period ?? null, group_label: meta.groupLabel ?? null },
  });

  if (error || !data?.ok || !data.seal) {
    return { ok: false, reportHash, message: data?.error ?? error?.message ?? 'No se pudo firmar el reporte.' };
  }

  // Descarga el PDF exacto que se firmó (sin modificarlo tras el hash).
  doc.save(`reporte-grupo-${meta.period ?? 'actual'}-${reportHash.slice(0, 8)}.pdf`);

  return {
    ok: true,
    seal: data.seal,
    signedAt: data.signed_at,
    signedBy: data.signed_by,
    reportHash,
  };
}
