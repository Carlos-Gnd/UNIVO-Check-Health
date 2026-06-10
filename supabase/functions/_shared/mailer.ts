// Envío de correo centralizado vía Gmail SMTP con App Password.
// Se migró desde Resend porque no tenemos autorización para usar el dominio
// institucional (univo.edu.sv) como remitente verificado. Gmail permite enviar
// desde la propia cuenta usando una "contraseña de aplicación" (requiere 2FA).
//
// Secrets requeridos (supabase secrets set ...):
//   GMAIL_USER          — dirección Gmail emisora (también es el remitente)
//   GMAIL_APP_PASSWORD  — App Password de 16 caracteres (NO la contraseña normal)
//   MAIL_FROM_NAME      — (opcional) nombre visible; por defecto "UNIVO Check-Health"
//
// Límites de Gmail: ~500 correos/día (cuenta gratuita) o ~2000/día (Workspace).

import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

export type MailResult = { ok: boolean; error?: string };

// Deriva una versión de texto plano legible a partir del HTML, para enviar un
// correo multipart real (text + html). Un cuerpo de texto coherente mejora bastante
// la puntuación anti-spam frente al dummy "requiere un cliente HTML".
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(p|div|h\d|li|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export async function sendMail(opts: { to: string | string[]; subject: string; html: string }): Promise<MailResult> {
  const user = Deno.env.get('GMAIL_USER');
  const pass = Deno.env.get('GMAIL_APP_PASSWORD');
  if (!user || !pass) return { ok: false, error: 'missing_gmail_credentials' };
  const recipients = (Array.isArray(opts.to) ? opts.to : [opts.to]).filter((r) => !!r && r.includes('@'));
  if (recipients.length === 0) return { ok: false, error: 'missing_email_address' };

  const fromName = Deno.env.get('MAIL_FROM_NAME') ?? 'UNIVO Check-Health';

  // Importante: la instanciación de SMTPClient y el envío van DENTRO del try. El
  // constructor de denomailer puede lanzar en el runtime de Edge (usa Web Workers
  // restringidos); si escapaba, el runtime devolvía un 500 genérico SIN CORS y el
  // navegador reportaba "CORS Missing Allow Origin" en vez del motivo real.
  let client: SMTPClient | undefined;
  try {
    client = new SMTPClient({
      connection: {
        hostname: 'smtp.gmail.com',
        port: 465,
        tls: true,
        auth: { username: user, password: pass },
      },
    });
    const sendPromise = client.send({
      from: `${fromName} <${user}>`,
      to: recipients,
      replyTo: user,
      subject: opts.subject,
      content: htmlToText(opts.html),
      html: opts.html,
    });
    await Promise.race([
      sendPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('smtp_timeout')), 20000)),
    ]);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'smtp_send_failed' };
  } finally {
    // OJO: NO usar `client.close().catch(...)`. Si close() devuelve undefined (el
    // cliente nunca conectó), llamar `.catch` sobre undefined lanza un TypeError
    // DENTRO del finally que tapaba el error real y crasheaba la función (500 sin
    // CORS). Con try/catch el cierre es seguro pase lo que pase.
    try { await client?.close(); } catch { /* ignore */ }
  }
}

// Envoltura HTML común para mantener un estilo consistente y con marca entre correos.
// El logo se referencia por URL pública (LOGO_URL, opcional); si no está, se usa un
// encabezado con la marca en texto sobre el azul institucional.
export function wrapHtml(bodyHtml: string): string {
  const logoUrl = Deno.env.get('LOGO_URL') ?? '';
  const brand = Deno.env.get('MAIL_FROM_NAME') ?? 'UNIVO Check-Health';
  const header = logoUrl
    ? `<img src="${logoUrl}" alt="${brand}" style="height:40px;display:block;margin:0 auto" />`
    : `<span style="font-size:20px;font-weight:800;letter-spacing:0.5px;color:#ffffff">UNIVO <span style="color:#f5a623">Check-Health</span></span>`;
  return `
    <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #eef3fb; margin: 0; padding: 24px; }
      .wrap { max-width: 540px; margin: 0 auto; }
      .brandbar { background: linear-gradient(135deg,#1a2d6b,#26408b); border-radius: 12px 12px 0 0; padding: 22px 32px; text-align: center; }
      .card { background: #fff; border-radius: 0 0 12px 12px; padding: 32px; box-shadow: 0 16px 40px rgba(26,45,107,0.12); }
      h2 { color: #1e3a5f; margin-top: 0; }
      p  { color: #374151; line-height: 1.6; }
      .code { font-size: 28px; letter-spacing: 8px; font-weight: 700; color: #1a2d6b; background:#f0f6ff; border:1px solid #cfe0fb; border-radius:8px; padding:14px; text-align:center; }
      .cred { background: #f0f6ff; border: 1px solid #cfe0fb; border-radius: 8px; padding: 16px; margin: 16px 0; }
      .cred code { font-size: 15px; color: #1e3a5f; font-weight: 700; }
      .footer { font-size: 12px; color: #9ca3af; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px; text-align:center; }
    </style></head><body><div class="wrap">
      <div class="brandbar">${header}</div>
      <div class="card">${bodyHtml}
        <div class="footer">${brand} — Sistema de Registro y Control de Asistencias · Universidad de Oriente (UNIVO)</div>
      </div>
    </div></body></html>`;
}
