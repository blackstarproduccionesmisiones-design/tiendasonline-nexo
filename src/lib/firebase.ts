import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { OperationType, type FirestoreErrorInfo } from '../types';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(
  app,
  { experimentalAutoDetectLongPolling: true },
  firebaseConfig.firestoreDatabaseId
);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const firebaseApiKey = firebaseConfig.apiKey;

export const MASTER_ADMIN_EMAILS = [
  'nexodigitalposadas@gmail.com',
];

export function isMasterAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return MASTER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();
