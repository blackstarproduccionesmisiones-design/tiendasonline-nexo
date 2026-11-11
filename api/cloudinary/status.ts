import type { IncomingMessage, ServerResponse } from 'node:http';
import { getCloudinaryServerEnv, sendJson } from '../_firebase.js';

export default async function handler(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { cloudName, uploadPreset, apiKey, apiSecret } = getCloudinaryServerEnv();
  const isSigned = Boolean(cloudName && apiKey && apiSecret);
  const isUnsigned = Boolean(cloudName && uploadPreset);

  sendJson(res, 200, {
    configured: isSigned || isUnsigned,
    mode: isSigned ? 'signed' : isUnsigned ? 'unsigned' : 'none',
  });
}
