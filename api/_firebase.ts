import { createRequire } from 'node:module';
import type { IncomingMessage, ServerResponse } from 'node:http';

const require = createRequire(import.meta.url);

export interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

export interface VerifiedTokenUser {
  localId: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
}

export interface ServerCloudinaryEnv {
  cloudName: string;
  uploadPreset: string;
  apiKey: string;
  apiSecret: string;
}

export const MASTER_ADMIN_EMAILS = new Set(['nexodigitalposadas@gmail.com']);

const FALLBACK_CONFIG: FirebaseAppletConfig = {
  projectId: 'nexo-tiendas-online',
  appId: '1:228926552125:web:4899e7d596c77971d05254',
  apiKey: 'AIzaSyAml-v3v1-B9KMOodq6G5tSK1Vt6T3b43Q',
  authDomain: 'nexo-tiendas-online.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-c85e03bc-eb1b-4fa2-9592-5fe6949c6ff1',
};

export function getFirebaseConfig(): FirebaseAppletConfig {
  try {
    return require('../firebase-applet-config.json') as FirebaseAppletConfig;
  } catch {
    return FALLBACK_CONFIG;
  }
}

export function extractBearerToken(req: IncomingMessage): string {
  const raw = req.headers.authorization;
  const header = Array.isArray(raw) ? raw[0] || '' : raw || '';
  if (!header.startsWith('Bearer ')) return '';
  return header.slice(7).trim();
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedTokenUser | null> {
  const config = getFirebaseConfig();
  if (!idToken || !config.apiKey) return null;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(config.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      users?: Array<{
        localId: string;
        email?: string;
        emailVerified?: boolean;
        displayName?: string;
      }>;
    };
    const user = data.users?.[0];
    if (!user?.localId || !user.email) return null;
    return {
      localId: user.localId,
      email: user.email.toLowerCase(),
      emailVerified: Boolean(user.emailVerified),
      displayName: user.displayName,
    };
  } catch {
    return null;
  }
}

export function getCloudinaryServerEnv(): ServerCloudinaryEnv {
  return {
    cloudName:
      process.env.CLOUDINARY_CLOUD_NAME?.trim() ||
      process.env.NOMBRE_DE_LA_NUBE_CLOUDINARY?.trim() ||
      process.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() ||
      '',
    uploadPreset:
      process.env.CLOUDINARY_UPLOAD_PRESET?.trim() ||
      process.env.PREAJUSTE_DE_SUBIDA_CLOUDINARY?.trim() ||
      process.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim() ||
      '',
    apiKey:
      process.env.CLOUDINARY_API_KEY?.trim() ||
      process.env.CLAVE_API_DE_CLOUDINARY?.trim() ||
      '',
    apiSecret:
      process.env.CLOUDINARY_API_SECRET?.trim() ||
      process.env.SECRETO_API_DE_CLOUDINARY?.trim() ||
      '',
  };
}

export function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export async function readJsonBody(req: IncomingMessage & { body?: unknown }): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString('utf-8').trim();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}
