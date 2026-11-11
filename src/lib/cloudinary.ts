import { doc, getDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError } from './firebase';
import { OperationType } from '../types';

export interface CloudinaryStatus {
  configured: boolean;
  mode: 'signed' | 'unsigned' | 'none';
}

export interface DirectCloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
}

export async function getDirectCloudinaryConfig(): Promise<DirectCloudinaryConfig | null> {
  const envCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() || '';
  const envUploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim() || '';
  if (envCloudName && envUploadPreset) {
    return { cloudName: envCloudName, uploadPreset: envUploadPreset };
  }

  if (!auth.currentUser) {
    return null;
  }

  const path = 'platformConfig/cloudinary';
  try {
    const snap = await getDoc(doc(db, 'platformConfig', 'cloudinary'));
    if (!snap.exists()) return null;
    const data = snap.data() as { cloudName?: string; uploadPreset?: string };
    const cloudName = (data.cloudName || '').trim();
    const uploadPreset = (data.uploadPreset || '').trim();
    if (cloudName && uploadPreset) {
      return { cloudName, uploadPreset };
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
}

export async function getCloudinaryStatus(): Promise<CloudinaryStatus> {
  try {
    const res = await fetch('/api/cloudinary/status');
    if (res.ok) {
      const text = await res.text();
      const parsed = text ? (JSON.parse(text) as CloudinaryStatus) : null;
      if (parsed?.configured) return parsed;
    }
  } catch {
    // Fall back to direct client config check
  }

  const direct = await getDirectCloudinaryConfig().catch(() => null);
  if (direct) {
    return { configured: true, mode: 'unsigned' };
  }
  return { configured: false, mode: 'none' };
}

async function prepareImageBlob(file: File, squareSize?: number): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      if (squareSize) {
        const canvas = document.createElement('canvas');
        canvas.width = squareSize;
        canvas.height = squareSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, squareSize, squareSize);
        canvas.toBlob(
          (blob) => resolve(blob || file),
          'image/png',
          0.95
        );
        return;
      }

      const maxDim = 1600;
      if (img.width <= maxDim && img.height <= maxDim && file.size <= 1.5 * 1024 * 1024) {
        resolve(file);
        return;
      }

      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(
        (blob) => resolve(blob || file),
        outType,
        0.88
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

async function uploadDirectToCloudinary(
  blob: Blob,
  fileName: string,
  folder: string,
  config: DirectCloudinaryConfig
): Promise<string> {
  const safeFolder = folder.replace(/[^a-zA-Z0-9_\-/]/g, '').slice(0, 80) || 'catalogos';
  const fullFolder = `nexo-tiendas/${safeFolder}`;
  const cleanCloudName = config.cloudName.trim().replace(/^['"]+|['"]+$/g, '');
  const cleanPreset = config.uploadPreset.trim().replace(/^['"]+|['"]+$/g, '');

  const formData = new FormData();
  formData.append('file', blob, fileName);
  formData.append('upload_preset', cleanPreset);
  formData.append('folder', fullFolder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cleanCloudName)}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  const rawText = await res.text();
  let data: {
    secure_url?: string;
    error?: { message?: string };
  } = {};

  try {
    data = rawText ? (JSON.parse(rawText) as typeof data) : {};
  } catch {
    throw new Error(
      `Cloudinary devolvió una respuesta inesperada (HTTP ${res.status}). Verificá el Cloud Name configurado.`
    );
  }

  if (!res.ok || !data.secure_url) {
    throw new Error(
      data.error?.message ||
        'Cloudinary rechazó la subida directa. Verificá que el Upload Preset esté en modo Unsigned.'
    );
  }

  return data.secure_url;
}

export async function uploadImageToCloudinary(
  file: File,
  folder: string,
  options?: { squareSize?: number }
): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Debés iniciar sesión para subir imágenes.');
  }

  const token = await currentUser.getIdToken();
  const processedBlob = await prepareImageBlob(file, options?.squareSize);
  const fileName = options?.squareSize ? 'app-icon.png' : file.name || 'image.jpg';

  const formData = new FormData();
  formData.append('folder', folder);
  formData.append('file', processedBlob, fileName);

  let serverErrorMsg: string | null = null;

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const rawText = await res.text();
    type UploadApiResponse = {
      secureUrl?: string;
      message?: string;
      error?: string;
    };
    let data: UploadApiResponse | null = null;

    try {
      data = rawText ? (JSON.parse(rawText) as UploadApiResponse) : null;
    } catch {
      data = null;
    }

    if (res.ok && data?.secureUrl) {
      return data.secureUrl;
    }

    if (res.status === 401) {
      throw new Error(data?.message || 'Tu sesión expiró. Volvé a iniciar sesión.');
    }

    if (data?.message) {
      serverErrorMsg = data.message;
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('expiró')) {
      throw err;
    }
  }

  // Fallback: direct unsigned upload to Cloudinary from the browser
  const directConfig = await getDirectCloudinaryConfig().catch(() => null);
  if (directConfig) {
    return uploadDirectToCloudinary(processedBlob, fileName, folder, directConfig);
  }

  throw new Error(
    serverErrorMsg ||
      'Todavía no está configurado Cloudinary para subir archivos desde el dispositivo. El administrador maestro debe cargar el Cloud Name y Upload Preset (unsigned) en Panel maestro NEXO+ → Configuración de Cloudinary (o en las variables de entorno de Vercel). Mientras tanto, podés usar la pestaña "Pegar URL".'
  );
}
