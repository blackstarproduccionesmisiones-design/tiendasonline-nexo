import { jsonResponse } from '../_firebase';

export async function GET(): Promise<Response> {
  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME?.trim() ||
    process.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() ||
    '';
  const uploadPreset =
    process.env.CLOUDINARY_UPLOAD_PRESET?.trim() ||
    process.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim() ||
    '';
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim() || '';
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim() || '';

  const isSigned = Boolean(cloudName && apiKey && apiSecret);
  const isUnsigned = Boolean(cloudName && uploadPreset);

  return jsonResponse({
    configured: isSigned || isUnsigned,
    mode: isSigned ? 'signed' : isUnsigned ? 'unsigned' : 'none',
  });
}
