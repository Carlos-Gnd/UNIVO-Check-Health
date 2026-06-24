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
  const headerContent = logoUrl
    ? `<img src="${logoUrl}" alt="${brand}" style="height:44px;display:block;margin:0 auto 10px" />`
    : '';
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${brand}</title>
  <style>
    body { font-family: -apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; background:#dde4f0; margin:0; padding:0; -webkit-text-size-adjust:100%; }
    .wrapper { width:100%; background:#dde4f0; padding:32px 16px; box-sizing:border-box; }
    .container { max-width:560px; margin:0 auto; }

    /* Header navy */
    .header { background:linear-gradient(135deg,#080f24 0%,#0f1b3d 40%,#1a2d6b 100%); border-radius:16px 16px 0 0; padding:30px 36px 24px; text-align:center; }
    .header-logo-text { font-size:23px; font-weight:800; letter-spacing:0.4px; color:#ffffff; margin:0; }
    .header-logo-text span { color:#f5a623; }
    .header-tagline { font-size:10.5px; letter-spacing:0.22em; text-transform:uppercase; color:rgba(245,166,35,0.65); margin-top:5px; }

    /* Barra dorada */
    .gold-bar { height:3px; background:linear-gradient(90deg,transparent 0%,#f5a623 35%,#e09615 65%,transparent 100%); }

    /* Tarjeta blanca */
    .card { background:#ffffff; padding:36px 36px 28px; box-shadow:0 20px 52px rgba(10,20,60,0.13); }
    .card h2 { color:#0f1b3d; font-size:21px; font-weight:700; margin:0 0 14px; }
    .card p { color:#374151; line-height:1.68; margin:0 0 14px; font-size:15px; }
    .card p:last-child { margin-bottom:0; }

    /* Código OTP */
    .code { display:block; font-family:'Courier New',Courier,monospace; font-size:38px; letter-spacing:12px; font-weight:800; color:#f5a623; background:linear-gradient(135deg,#080f24,#1a2d6b); border-radius:12px; padding:22px 16px; text-align:center; margin:22px 0; text-shadow:0 0 24px rgba(245,166,35,0.45); }

    /* Credenciales */
    .cred { background:#f6f9ff; border:1px solid #dce6f5; border-left:4px solid #f5a623; border-radius:10px; padding:18px 20px; margin:20px 0; }
    .cred p { margin:0 0 9px; color:#374151; font-size:14.5px; }
    .cred p:last-child { margin-bottom:0; }
    .cred code { font-family:'Courier New',Courier,monospace; font-size:14px; font-weight:700; color:#0f1b3d; background:#e4ecfa; padding:3px 7px; border-radius:5px; }

    /* Aviso de seguridad */
    .card strong { color:#0f1b3d; }

    /* Footer */
    .footer { background:linear-gradient(135deg,#080f24,#0f1b3d); border-radius:0 0 16px 16px; padding:16px 24px; text-align:center; }
    .footer p { font-size:11px; color:rgba(255,255,255,0.3); margin:0; line-height:1.55; }
    .footer span { color:rgba(245,166,35,0.5); }

    @media (max-width:600px) {
      .card { padding:24px 20px 20px; }
      .header { padding:22px 20px 18px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        ${headerContent}
        <p class="header-logo-text">UNIVO <span>Check-Health</span></p>
        <p class="header-tagline">Sistema de Asistencias · Área de Salud</p>
      </div>
      <div class="gold-bar"></div>
      <div class="card">
        ${bodyHtml}
      </div>
      <div class="footer">
        <p><span>${brand}</span> — Sistema de Registro y Control de Asistencias<br>Universidad de Oriente (UNIVO), El Salvador</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}
