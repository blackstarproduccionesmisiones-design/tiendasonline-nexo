import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import multer from 'multer';
import {
  extractBearerToken,
  getCloudinaryServerEnv,
  sendJson,
  verifyFirebaseIdToken,
} from './_firebase.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

interface MulterRequest extends IncomingMessage {
  file?: {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
  };
  body?: Record<string, unknown>;
}

function runMulter(req: MulterRequest, res: ServerResponse): Promise<void> {
  return new Promise((resolve, reject) => {
    uploadMiddleware.single('file')(req as never, res as never, (err: unknown) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export default async function handler(req: MulterRequest, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Método no permitido.' });
    return;
  }

  const token = extractBearerToken(req);
  const user = await verifyFirebaseIdToken(token);
  if (!user) {
    sendJson(res, 401, { error: 'UNAUTHORIZED', message: 'Sesión inválida o expirada.' });
    return;
  }

  const { cloudName, uploadPreset, apiKey, apiSecret } = getCloudinaryServerEnv();
  if (!cloudName || (!uploadPreset && !(apiKey && apiSecret))) {
    sendJson(res, 503, {
      error: 'CLOUDINARY_NOT_CONFIGURED',
      message:
        'Cloudinary no está configurado en el servidor. Configurá CLOUDINARY_CLOUD_NAME y CLOUDINARY_UPLOAD_PRESET (o API Key/Secret), o guardalos desde Panel maestro NEXO+.',
    });
    return;
  }

  try {
    await runMulter(req, res);
  } catch (err) {
    sendJson(res, 400, {
      error: 'INVALID_UPLOAD',
      message: err instanceof Error ? err.message : 'Error al procesar el archivo.',
    });
    return;
  }

  if (!req.file) {
    sendJson(res, 400, { error: 'NO_FILE', message: 'No se recibió ningún archivo de imagen.' });
    return;
  }

  const rawFolder = typeof req.body?.folder === 'string' ? req.body.folder : 'catalogos';
  const safeFolder = rawFolder.replace(/[^a-zA-Z0-9_\-/]/g, '').slice(0, 80) || 'catalogos';
  const fullFolder = `nexo-tiendas/${safeFolder}`;

  try {
    const mimeType = req.file.mimetype || 'image/jpeg';
    const base64 = req.file.buffer.toString('base64');
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
      sendJson(res, 502, {
        error: 'CLOUDINARY_UPLOAD_FAILED',
        message: cloudData.error?.message || 'Error al subir la imagen a Cloudinary.',
      });
      return;
    }

    sendJson(res, 200, {
      secureUrl: cloudData.secure_url,
      publicId: cloudData.public_id || '',
      width: cloudData.width || null,
      height: cloudData.height || null,
    });
  } catch (err) {
    sendJson(res, 500, {
      error: 'UPLOAD_ERROR',
      message: err instanceof Error ? err.message : 'Error interno al procesar la imagen.',
    });
  }
}
