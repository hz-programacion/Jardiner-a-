// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, Analytics } from 'firebase/analytics';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  Firestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import {
  BaseLocationConfig,
  BusinessProfileConfig,
  ClientProperty,
  EquipmentItem,
  InvoiceRecord,
  OperationalExpense,
  PaymentProfileConfig,
  ScheduledJob,
  TenantSubscriptionConfig,
} from './types/lawn';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: 'AIzaSyCNt9bVGVLhRwackGNWaTWiL0zAm267RTg',
  authDomain: 'jardineria-5463b.firebaseapp.com',
  projectId: 'jardineria-5463b',
  storageBucket: 'jardineria-5463b.firebasestorage.app',
  messagingSenderId: '209681668219',
  appId: '1:209681668219:web:0274751c818de2c098eade',
  measurementId: 'G-LY20LP9JRB',
};

// Initialize Firebase
export const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Analytics safely for browser environments
export let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch {
    analytics = null;
  }
}

// Initialize Firebase Authentication and Cloud Firestore
export const auth = getAuth(app);

let firestoreInstance: Firestore | null = null;
try {
  firestoreInstance = getFirestore(app);
} catch {
  firestoreInstance = null;
}
export const db = firestoreInstance as Firestore;

export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Diagnostic:', JSON.stringify(errInfo));
  return errInfo;
}

// Validate connection to Firestore at boot
export async function testFirestoreConnection(): Promise<boolean> {
  if (!firestoreInstance) return false;
  try {
    await getDocFromServer(doc(firestoreInstance, 'test', 'connection'));
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.warn(
        'Please check your Firebase configuration. The client appears offline.'
      );
      return false;
    }
    return true;
  }
}

export interface CloudWorkspacePayload {
  businessProfile: BusinessProfileConfig;
  baseLocation: BaseLocationConfig;
  paymentProfile: PaymentProfileConfig;
  subscription?: TenantSubscriptionConfig;
  properties: ClientProperty[];
  todayJobs: ScheduledJob[];
  invoices: InvoiceRecord[];
  expenses: OperationalExpense[];
  equipment: EquipmentItem[];
  updatedAtIso?: string;
  ownerEmail?: string | null;
}

/**
 * Saves the authenticated user's operational workspace to Cloud Firestore
 * under `workspaces/{uid}`.
 */
export async function saveWorkspaceToFirestore(
  uid: string,
  payload: CloudWorkspacePayload
): Promise<{ ok: boolean; errorMessage?: string }> {
  const path = `workspaces/${uid}`;
  if (!firestoreInstance) {
    return {
      ok: false,
      errorMessage: 'Servicio Firestore en inicialización local.',
    };
  }
  try {
    await setDoc(
      doc(firestoreInstance, 'workspaces', uid),
      {
        ...payload,
        ownerUid: uid,
        ownerEmail: auth.currentUser?.email || payload.ownerEmail || null,
        updatedAtIso: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return { ok: true };
  } catch (error) {
    const info = handleFirestoreError(error, OperationType.WRITE, path);
    return { ok: false, errorMessage: info.error };
  }
}

/**
 * Loads the authenticated user's operational workspace from Cloud Firestore
 * under `workspaces/{uid}`.
 */
export async function loadWorkspaceFromFirestore(
  uid: string
): Promise<{ data: CloudWorkspacePayload | null; errorMessage?: string }> {
  const path = `workspaces/${uid}`;
  if (!firestoreInstance) {
    return { data: null };
  }
  try {
    const snap = await getDoc(doc(firestoreInstance, 'workspaces', uid));
    if (!snap.exists()) {
      return { data: null };
    }
    return { data: snap.data() as CloudWorkspacePayload };
  } catch (error) {
    const info = handleFirestoreError(error, OperationType.GET, path);
    return { data: null, errorMessage: info.error };
  }
}

/**
 * Subscribes to real-time updates on `workspaces/{uid}`.
 */
export function subscribeToWorkspaceFirestore(
  uid: string,
  onData: (data: CloudWorkspacePayload) => void,
  onError?: (errInfo: FirestoreErrorInfo) => void
) {
  const path = `workspaces/${uid}`;
  if (!firestoreInstance) {
    return () => {};
  }
  return onSnapshot(
    doc(firestoreInstance, 'workspaces', uid),
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as CloudWorkspacePayload);
      }
    },
    (error) => {
      const info = handleFirestoreError(error, OperationType.GET, path);
      if (onError) onError(info);
    }
  );
}

// Authentication helpers
export async function signInWithGooglePopup(): Promise<User> {
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  const res = await signInWithPopup(auth, googleProvider);
  return res.user;
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<User> {
  const res = await signInWithEmailAndPassword(auth, email.trim(), password);
  return res.user;
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const res = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
  if (displayName.trim()) {
    await updateProfile(res.user, { displayName: displayName.trim() });
  }
  return res.user;
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged };
export type { User };
