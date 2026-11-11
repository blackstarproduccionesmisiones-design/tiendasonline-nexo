import type { IncomingMessage, ServerResponse } from 'node:http';
import { getFirebaseConfig, sendJson } from './_firebase.js';

export default async function handler(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const config = getFirebaseConfig();
  sendJson(res, 200, { ok: true, projectId: config.projectId });
}
