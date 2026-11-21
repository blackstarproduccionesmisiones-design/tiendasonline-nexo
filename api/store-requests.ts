import type { IncomingMessage, ServerResponse } from 'node:http';
import nodemailer from 'nodemailer';
import { readJsonBody, sendJson } from './_firebase.js';

const MASTER_ADMIN_NOTIFY_EMAIL = 'nexodigitalposadas@gmail.com';
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 6;
const ipRequests = new Map<string, number[]>();

function cleanLine(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getClientIp(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for'];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  if (raw) {
    return raw.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (ipRequests.get(ip) || []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    ipRequests.set(ip, recent);
    return true;
  }
  recent.push(now);
  if (ipRequests.size > 500) {
    ipRequests.clear();
  }
  ipRequests.set(ip, recent);
  return false;
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Método no permitido.' });
    return;
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp)) {
    sendJson(res, 429, {
      error: 'RATE_LIMITED',
      message: 'Recibimos varias solicitudes seguidas. Esperá unos minutos antes de volver a intentar.',
    });
    return;
  }

  const body = await readJsonBody(req);
  const storeName = cleanLine(body.storeName, 100);
  const category = cleanLine(body.category, 80);
  const fullName = cleanLine(body.fullName, 100);
  const phone = cleanLine(body.phone, 30);
  const requestId = cleanLine(body.requestId, 128);

  if (storeName.length < 2) {
    sendJson(res, 400, { error: 'INVALID_STORE_NAME', message: 'Ingresá el nombre de la tienda.' });
    return;
  }
  if (category.length < 2) {
    sendJson(res, 400, { error: 'INVALID_CATEGORY', message: 'Ingresá el rubro del comercio.' });
    return;
  }
  if (fullName.length < 2) {
    sendJson(res, 400, { error: 'INVALID_FULL_NAME', message: 'Ingresá tu nombre y apellido.' });
    return;
  }
  if (phone.replace(/[^\d+]/g, '').length < 6) {
    sendJson(res, 400, { error: 'INVALID_PHONE', message: 'Ingresá un número de teléfono válido.' });
    return;
  }

  const subject = `Nueva solicitud CREAR TIENDA: ${storeName} (${category})`;
  const textBody = [
    'Nueva solicitud de creación de tienda en NEXO+',
    '----------------------------------------------',
    `Nombre de la tienda: ${storeName}`,
    `Rubro: ${category}`,
    `Nombre y apellido: ${fullName}`,
    `Teléfono / WhatsApp: ${phone}`,
    requestId ? `ID de registro: ${requestId}` : '',
    `Fecha: ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join('\n');

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; color: #18181b; max-width: 560px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden;">
      <div style="background: #18181b; color: #ffffff; padding: 20px 24px;">
        <p style="margin: 0; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #a1a1aa;">NEXO+ · Panel Maestro</p>
        <h1 style="margin: 6px 0 0; font-size: 20px;">Nueva solicitud: CREAR TIENDA</h1>
      </div>
      <div style="padding: 24px; background: #ffffff;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #71717a; width: 170px;">Nombre de la tienda</td>
            <td style="padding: 8px 0; font-weight: 600;">${escapeHtml(storeName)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #71717a;">Rubro</td>
            <td style="padding: 8px 0; font-weight: 600;">${escapeHtml(category)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #71717a;">Nombre y apellido</td>
            <td style="padding: 8px 0; font-weight: 600;">${escapeHtml(fullName)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #71717a;">Teléfono</td>
            <td style="padding: 8px 0; font-weight: 600;">${escapeHtml(phone)}</td>
          </tr>
          ${
            requestId
              ? `<tr><td style="padding: 8px 0; color: #71717a;">Registro</td><td style="padding: 8px 0; font-family: monospace; font-size: 12px;">${escapeHtml(requestId)}</td></tr>`
              : ''
          }
        </table>
      </div>
    </div>
  `;

  const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const emailFrom = (process.env.EMAIL_FROM || '').trim();

  if (resendApiKey) {
    try {
      const rRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: emailFrom || 'NEXO+ Tiendas <onboarding@resend.dev>',
          to: [MASTER_ADMIN_NOTIFY_EMAIL],
          subject,
          text: textBody,
          html: htmlBody,
        }),
      });
      if (rRes.ok) {
        sendJson(res, 200, { ok: true, emailSent: true, provider: 'resend' });
        return;
      }
      console.error('Resend store request notification failed:', rRes.status);
    } catch (err) {
      console.error('Resend store request error:', err);
    }
  }

  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      await transporter.sendMail({
        from: emailFrom || `"NEXO+ Tiendas" <${smtpUser}>`,
        to: MASTER_ADMIN_NOTIFY_EMAIL,
        subject,
        text: textBody,
        html: htmlBody,
      });
      sendJson(res, 200, { ok: true, emailSent: true, provider: 'smtp' });
      return;
    } catch (err) {
      console.error('SMTP store request error:', err);
    }
  }

  sendJson(res, 200, {
    ok: true,
    emailSent: false,
    reason: resendApiKey || (smtpUser && smtpPass) ? 'EMAIL_SEND_FAILED' : 'EMAIL_TRANSPORT_NOT_CONFIGURED',
  });
}
