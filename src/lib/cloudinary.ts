import { auth } from './firebase';

export interface CloudinaryStatus {
  configured: boolean;
  mode: 'signed' | 'unsigned' | 'none';
}

export async function getCloudinaryStatus(): Promise<CloudinaryStatus> {
  try {
    const res = await fetch('/api/cloudinary/status');
    if (!res.ok) return { configured: false, mode: 'none' };
    return (await res.json()) as CloudinaryStatus;
  } catch {
    return { configured: false, mode: 'none' };
  }
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

  const formData = new FormData();
  formData.append('folder', folder);
  formData.append(
    'file',
    processedBlob,
    options?.squareSize ? 'app-icon.png' : file.name || 'image.jpg'
  );

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const rawText = await res.text();
  let data: {
    secureUrl?: string;
    message?: string;
    error?: string;
  } = {};

  try {
    data = rawText ? (JSON.parse(rawText) as typeof data) : {};
  } catch {
    throw new Error(
      `El servidor de imágenes respondió con un formato inesperado (HTTP ${res.status}). Podés pegar una URL de imagen directamente mientras se verifica el endpoint.`
    );
  }

  if (!res.ok || !data.secureUrl) {
    throw new Error(data.message || 'No se pudo subir la imagen a Cloudinary.');
  }

  return data.secureUrl;
}
