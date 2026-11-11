import firebaseConfigJson from '../firebase-applet-config.json';

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

export const MASTER_ADMIN_EMAILS = new Set(['nexodigitalposadas@gmail.com']);

export function getFirebaseConfig(): FirebaseAppletConfig {
  return firebaseConfigJson as FirebaseAppletConfig;
}

export function extractBearerToken(request: Request): string {
  const header = request.headers.get('authorization') || '';
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

export interface ServerCloudinaryEnv {
  cloudName: string;
  uploadPreset: string;
  apiKey: string;
  apiSecret: string;
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

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
