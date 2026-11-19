import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(
    app,
    { experimentalAutoDetectLongPolling: true },
    firebaseConfig.firestoreDatabaseId,
  );
} catch {
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreInstance;
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as const;

export type OperationTypeValue = (typeof OperationType)[keyof typeof OperationType];

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationTypeValue;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function classifyFirestoreError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const lower = rawMessage.toLowerCase();
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code).toLowerCase()
      : '';

  if (code === 'permission-denied' || lower.includes('missing or insufficient permissions')) {
    return 'Permission denied by Firestore security rules. Ensure Google Sign-In is connected with an authorized Admin or HOD account.';
  }
  if (
    code === 'unavailable' ||
    lower.includes('the client is offline') ||
    lower.includes('network-request-failed') ||
    lower.includes('failed to fetch')
  ) {
    return 'Network or Firestore transport unavailable. Verify internet connectivity and retry.';
  }
  if (code === 'not-found' || lower.includes('no document to update')) {
    return 'Requested Firestore document or database ID was not found.';
  }
  if (code === 'invalid-argument' || lower.includes('invalid data')) {
    return 'Invalid Firestore document payload or configuration parameter.';
  }
  if (code === 'unauthenticated' || lower.includes('unauthenticated')) {
    return 'Firebase authentication required. Connect Google Sign-In in Settings first.';
  }
  if (code === 'deadline-exceeded' || lower.includes('timeout')) {
    return 'Firestore request timed out. Please retry the operation.';
  }
  if (lower.includes('quota exceeded')) {
    return 'Firestore daily quota exceeded. Try again after quota reset or upgrade the Firebase plan.';
  }
  return rawMessage || 'Unexpected Firestore error.';
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationTypeValue,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: classifyFirestoreError(error),
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
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface FirebaseConnectionStatus {
  configured: boolean;
  checking: boolean;
  projectId: string;
  databaseId: string;
  reachable: boolean;
  diagnosticMessage: string;
}

const isConfigured = Boolean(
  firebaseConfig.projectId &&
    firebaseConfig.apiKey &&
    firebaseConfig.firestoreDatabaseId &&
    firebaseConfig.projectId !== 'remixed-project-id',
);

let lastStatus: FirebaseConnectionStatus = {
  configured: isConfigured,
  checking: isConfigured,
  projectId: firebaseConfig.projectId,
  databaseId: firebaseConfig.firestoreDatabaseId,
  reachable: false,
  diagnosticMessage: isConfigured
    ? 'Checking Cloud Firestore connectivity...'
    : 'Firebase configuration missing in firebase-applet-config.json.',
};

export function getFirebaseConnectionStatus(): FirebaseConnectionStatus {
  return lastStatus;
}

function isOfflineTransportError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code).toLowerCase()
      : '';
  return (
    msg.includes('the client is offline') ||
    msg.includes('network-request-failed') ||
    code === 'unavailable' ||
    code === 'deadline-exceeded'
  );
}

export async function testConnection(): Promise<FirebaseConnectionStatus> {
  if (!isConfigured) {
    lastStatus = {
      ...lastStatus,
      configured: false,
      checking: false,
      reachable: false,
      diagnosticMessage: 'Firebase configuration missing in firebase-applet-config.json.',
    };
    return lastStatus;
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
      lastStatus = {
        ...lastStatus,
        checking: false,
        reachable: true,
        diagnosticMessage: 'Cloud Firestore endpoint reachable.',
      };
      return lastStatus;
    } catch (error) {
      if (isOfflineTransportError(error)) {
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 750));
          continue;
        }
        console.error('Please check your Firebase configuration.');
        lastStatus = {
          ...lastStatus,
          checking: false,
          reachable: false,
          diagnosticMessage: classifyFirestoreError(error),
        };
        return lastStatus;
      }

      // Permission denied or unauthenticated response on /test/connection confirms live Firestore server reachability
      lastStatus = {
        ...lastStatus,
        checking: false,
        reachable: true,
        diagnosticMessage: 'Cloud Firestore endpoint online and secured by rules.',
      };
      return lastStatus;
    }
  }
  return lastStatus;
}

void testConnection();

export async function linkGoogleFirebaseAuth(): Promise<User> {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export async function unlinkGoogleFirebaseAuth(): Promise<void> {
  await signOut(auth);
}
