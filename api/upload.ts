import crypto from 'node:crypto';
import {
  extractBearerToken,
  getCloudinaryServerEnv,
  jsonResponse,
  verifyFirebaseIdToken,
} from './_firebase';

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  const token = extractBearerToken(request);
  const user = await verifyFirebaseIdToken(token);
  if (!user) {
    return jsonResponse({ error: 'UNAUTHORIZED', message: 'Sesión inválida o expirada.' }, 401);
  }

  const { cloudName, uploadPreset, apiKey, apiSecret } = getCloudinaryServerEnv();

  if (!cloudName || (!uploadPreset && !(apiKey && apiSecret))) {
    return jsonResponse(
      {
        error: 'CLOUDINARY_NOT_CONFIGURED',
        message:
          'Cloudinary no está configurado en el servidor. Configurá CLOUDINARY_CLOUD_NAME y CLOUDINARY_UPLOAD_PRESET (o API Key/Secret), o guardalos desde Panel maestro NEXO+.',
      },
      503
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse(
      { error: 'INVALID_FORM', message: 'El formato de la solicitud de imagen no es válido.' },
      400
    );
  }

  const fileEntry = formData.get('file');
  if (!fileEntry || typeof fileEntry === 'string') {
    return jsonResponse({ error: 'NO_FILE', message: 'No se recibió ningún archivo de imagen.' }, 400);
  }

  const arrayBuffer = await fileEntry.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    return jsonResponse({ error: 'EMPTY_FILE', message: 'El archivo de imagen está vacío.' }, 400);
  }
  if (arrayBuffer.byteLength > MAX_FILE_BYTES) {
    return jsonResponse(
      { error: 'FILE_TOO_LARGE', message: 'La imagen supera el límite permitido de 8 MB.' },
      413
    );
  }

  const rawFolderEntry = formData.get('folder');
  const rawFolder = typeof rawFolderEntry === 'string' ? rawFolderEntry : 'catalogos';
  const safeFolder = rawFolder.replace(/[^a-zA-Z0-9_\-/]/g, '').slice(0, 80) || 'catalogos';
  const fullFolder = `nexo-tiendas/${safeFolder}`;

  try {
    const mimeType = fileEntry.type || 'image/jpeg';
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUri = `data:${mimeType};base64,${base64}`;
    const form = new URLSearchParams();
    form.append('file', dataUri);
    form.append('folder', fullFolder);

    if (apiKey && apiSecret) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const paramsToSign = `folder=${fullFolder}&timestamp=${timestamp}${apiSecret}`;
      const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');
      form.append('api_key', apiKey);
      form.append('timestamp', timestamp);
      form.append('signature', signature);
    } else {
      form.append('upload_preset', uploadPreset);
    }

    const cloudRes = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      }
    );

    const cloudData = (await cloudRes.json()) as {
      secure_url?: string;
      public_id?: string;
      width?: number;
      height?: number;
      error?: { message?: string };
    };

    if (!cloudRes.ok || !cloudData.secure_url) {
      return jsonResponse(
        {
          error: 'CLOUDINARY_UPLOAD_FAILED',
          message: cloudData.error?.message || 'Error al subir la imagen a Cloudinary.',
        },
        502
      );
    }

    return jsonResponse({
      secureUrl: cloudData.secure_url,
      publicId: cloudData.public_id || '',
      width: cloudData.width || null,
      height: cloudData.height || null,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'UPLOAD_ERROR',
        message: err instanceof Error ? err.message : 'Error interno al procesar la imagen.',
      },
      500
    );
  }
}
