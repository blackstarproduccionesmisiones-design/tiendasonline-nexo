import { getCloudinaryServerEnv, jsonResponse } from '../_firebase';

export async function GET(): Promise<Response> {
  const { cloudName, uploadPreset, apiKey, apiSecret } = getCloudinaryServerEnv();

  const isSigned = Boolean(cloudName && apiKey && apiSecret);
  const isUnsigned = Boolean(cloudName && uploadPreset);

  return jsonResponse({
    configured: isSigned || isUnsigned,
    mode: isSigned ? 'signed' : isUnsigned ? 'unsigned' : 'none',
  });
}
