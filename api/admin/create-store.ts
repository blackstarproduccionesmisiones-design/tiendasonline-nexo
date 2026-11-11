import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  extractBearerToken,
  getFirebaseConfig,
  MASTER_ADMIN_EMAILS,
  readJsonBody,
  sendJson,
  verifyFirebaseIdToken,
} from '../_firebase.js';

function slugifyStoreName(input: string): string {
  const base = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'tienda';
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Método no permitido.' });
    return;
  }

  const token = extractBearerToken(req);
  const caller = await verifyFirebaseIdToken(token);

  if (!caller) {
    sendJson(res, 401, { error: 'UNAUTHORIZED', message: 'Debés iniciar sesión para continuar.' });
    return;
  }

  if (!MASTER_ADMIN_EMAILS.has(caller.email) || !caller.emailVerified) {
    sendJson(res, 403, {
      error: 'FORBIDDEN',
      message:
        'Solo el administrador maestro verificado (nexodigitalposadas@gmail.com) puede dar de alta comercios.',
    });
    return;
  }

  const body = (await readJsonBody(req)) as {
    name?: string;
    slug?: string;
    email?: string;
    whatsapp?: string;
    tempPassword?: string;
  };

  const name = (typeof body.name === 'string' ? body.name : '').trim();
  const requestedSlug = typeof body.slug === 'string' && body.slug ? slugifyStoreName(body.slug) : '';
  const email = (typeof body.email === 'string' ? body.email : '').trim().toLowerCase();
  const whatsapp = (typeof body.whatsapp === 'string' ? body.whatsapp : '').replace(/[^\d]/g, '').trim();
  const tempPassword = typeof body.tempPassword === 'string' ? body.tempPassword : '';

  if (name.length < 2 || name.length > 100) {
    sendJson(res, 400, {
      error: 'INVALID_NAME',
      message: 'El nombre del comercio debe tener entre 2 y 100 caracteres.',
    });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    sendJson(res, 400, {
      error: 'INVALID_EMAIL',
      message: 'Ingresá un correo electrónico válido para el comercio.',
    });
    return;
  }
  if (whatsapp.length < 6 || whatsapp.length > 20) {
    sendJson(res, 400, {
      error: 'INVALID_WHATSAPP',
      message: 'Ingresá un número de WhatsApp válido (ej. 5493764000000).',
    });
    return;
  }
  if (tempPassword.length < 8) {
    sendJson(res, 400, {
      error: 'WEAK_PASSWORD',
      message: 'La contraseña temporal debe tener al menos 8 caracteres.',
    });
    return;
  }

  const config = getFirebaseConfig();

  try {
    const signUpRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(config.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: tempPassword,
          returnSecureToken: true,
        }),
      }
    );

    const signUpData = (await signUpRes.json()) as {
      localId?: string;
      idToken?: string;
      email?: string;
      error?: { message?: string };
    };

    if (!signUpRes.ok || !signUpData.localId) {
      const code = signUpData.error?.message || 'AUTH_CREATE_FAILED';
      if (code.includes('EMAIL_EXISTS')) {
        sendJson(res, 409, {
          error: 'EMAIL_EXISTS',
          message: 'Ya existe una cuenta en Firebase Authentication con ese correo electrónico.',
        });
        return;
      }
      if (code.includes('OPERATION_NOT_ALLOWED')) {
        sendJson(res, 400, {
          error: 'OPERATION_NOT_ALLOWED',
          message:
            'Habilitá el proveedor "Correo electrónico/contraseña" en Firebase Console > Authentication > Sign-in method para el proyecto nexo-tiendas-online.',
        });
        return;
      }
      sendJson(res, 400, {
        error: code,
        message: `No se pudo crear la cuenta del comercio (${code}).`,
      });
      return;
    }

    if (signUpData.idToken) {
      await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${encodeURIComponent(config.apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken: signUpData.idToken,
            displayName: name,
            returnSecureToken: false,
          }),
        }
      ).catch(() => undefined);
    }

    const slug = requestedSlug.length >= 2 ? requestedSlug : slugifyStoreName(name);
    sendJson(res, 200, {
      uid: signUpData.localId,
      email,
      name,
      whatsapp,
      slug,
      storeId: slug,
    });
  } catch (err) {
    sendJson(res, 500, {
      error: 'SERVER_ERROR',
      message: err instanceof Error ? err.message : 'Error interno al crear el comercio.',
    });
  }
}
