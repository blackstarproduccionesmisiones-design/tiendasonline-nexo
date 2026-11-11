import {
  extractBearerToken,
  getFirebaseConfig,
  jsonResponse,
  MASTER_ADMIN_EMAILS,
  verifyFirebaseIdToken,
} from '../_firebase';

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

export async function POST(request: Request): Promise<Response> {
  const token = extractBearerToken(request);
  const caller = await verifyFirebaseIdToken(token);

  if (!caller) {
    return jsonResponse({ error: 'UNAUTHORIZED', message: 'Debés iniciar sesión para continuar.' }, 401);
  }

  if (!MASTER_ADMIN_EMAILS.has(caller.email) || !caller.emailVerified) {
    return jsonResponse(
      {
        error: 'FORBIDDEN',
        message:
          'Solo el administrador maestro verificado (nexodigitalposadas@gmail.com) puede dar de alta comercios.',
      },
      403
    );
  }

  let body: {
    name?: string;
    slug?: string;
    email?: string;
    whatsapp?: string;
    tempPassword?: string;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const name = (body.name || '').trim();
  const requestedSlug = body.slug ? slugifyStoreName(body.slug) : '';
  const email = (body.email || '').trim().toLowerCase();
  const whatsapp = (body.whatsapp || '').replace(/[^\d]/g, '').trim();
  const tempPassword = body.tempPassword || '';

  if (name.length < 2 || name.length > 100) {
    return jsonResponse(
      { error: 'INVALID_NAME', message: 'El nombre del comercio debe tener entre 2 y 100 caracteres.' },
      400
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse(
      { error: 'INVALID_EMAIL', message: 'Ingresá un correo electrónico válido para el comercio.' },
      400
    );
  }
  if (whatsapp.length < 6 || whatsapp.length > 20) {
    return jsonResponse(
      {
        error: 'INVALID_WHATSAPP',
        message: 'Ingresá un número de WhatsApp válido (ej. 5493764000000).',
      },
      400
    );
  }
  if (tempPassword.length < 8) {
    return jsonResponse(
      { error: 'WEAK_PASSWORD', message: 'La contraseña temporal debe tener al menos 8 caracteres.' },
      400
    );
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
        return jsonResponse(
          {
            error: 'EMAIL_EXISTS',
            message: 'Ya existe una cuenta en Firebase Authentication con ese correo electrónico.',
          },
          409
        );
      }
      if (code.includes('OPERATION_NOT_ALLOWED')) {
        return jsonResponse(
          {
            error: 'OPERATION_NOT_ALLOWED',
            message:
              'Habilitá el proveedor "Correo electrónico/contraseña" en Firebase Console > Authentication > Sign-in method para el proyecto nexo-tiendas-online.',
          },
          400
        );
      }
      return jsonResponse(
        {
          error: code,
          message: `No se pudo crear la cuenta del comercio (${code}).`,
        },
        400
      );
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
    return jsonResponse({
      uid: signUpData.localId,
      email,
      name,
      whatsapp,
      slug,
      storeId: slug,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'SERVER_ERROR',
        message: err instanceof Error ? err.message : 'Error interno al crear el comercio.',
      },
      500
    );
  }
}
