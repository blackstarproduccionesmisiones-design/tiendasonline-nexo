import { getFirebaseConfig, jsonResponse } from './_firebase';

export async function GET(): Promise<Response> {
  const config = getFirebaseConfig();
  return jsonResponse({ ok: true, projectId: config.projectId });
}
