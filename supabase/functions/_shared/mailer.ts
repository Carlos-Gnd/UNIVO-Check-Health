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

export async function sendMail(opts: { to: string; subject: string; html: string }): Promise<MailResult> {
  const user = Deno.env.get('GMAIL_USER');
  const pass = Deno.env.get('GMAIL_APP_PASSWORD');
  if (!user || !pass) return { ok: false, error: 'missing_gmail_credentials' };
  if (!opts.to) return { ok: false, error: 'missing_email_address' };

  const fromName = Deno.env.get('MAIL_FROM_NAME') ?? 'UNIVO Check-Health';
  const client = new SMTPClient({
    connection: {
      hostname: 'smtp.gmail.com',
      port: 465,
      tls: true,
      auth: { username: user, password: pass },
    },
  });

  try {
    await client.send({
      from: `${fromName} <${user}>`,
      to: opts.to,
      subject: opts.subject,
      content: 'Este mensaje requiere un cliente de correo compatible con HTML.',
      html: opts.html,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'smtp_send_failed' };
  } finally {
    await client.close().catch(() => {});
  }
}

// Envoltura HTML común para mantener un estilo consistente entre correos.
export function wrapHtml(bodyHtml: string): string {
  return `
    <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
      body { font-family: -apple-system, sans-serif; background: #f5f5f5; margin: 0; padding: 24px; }
      .card { background: #fff; border-radius: 12px; padding: 32px; max-width: 540px; margin: 0 auto; }
      h2 { color: #1e3a5f; margin-top: 0; }
      p  { color: #374151; line-height: 1.6; }
      .code { font-size: 28px; letter-spacing: 8px; font-weight: 700; color: #111827; }
      .cred { background: #f0f6ff; border: 1px solid #cfe0fb; border-radius: 8px; padding: 16px; margin: 16px 0; }
      .cred code { font-size: 15px; color: #1e3a5f; font-weight: 700; }
      .footer { font-size: 12px; color: #9ca3af; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
    </style></head><body><div class="card">${bodyHtml}
      <div class="footer">UNIVO Check-Health — Sistema de Registro y Control de Asistencias</div>
    </div></body></html>`;
}
