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
  collection,
  doc,
  getDoc,
  getDocs,
  getDocFromServer,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ApprovalStatus,
  BaseLocationConfig,
  BusinessProfileConfig,
  ClientProperty,
  EquipmentItem,
  InvoiceRecord,
  OperationalExpense,
  PaymentProfileConfig,
  RegisteredTenantSummary,
  ScheduledJob,
  TenantSubscriptionConfig,
  UserRole,
} from './types/lawn';
import {
  getInitialAccessApprovalState,
  getTenantStorageKey,
  isPrimaryAdminEmail,
  PRIMARY_ADMIN_EMAIL,
} from './utils/saasLogic';
import { getTodayIsoLocal } from './utils/lawnLogic';

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
  isApproved?: boolean;
  approvalStatus?: ApprovalStatus;
  role?: UserRole;
  registeredAt?: string;
  properties: ClientProperty[];
  todayJobs: ScheduledJob[];
  invoices: InvoiceRecord[];
  expenses: OperationalExpense[];
  equipment: EquipmentItem[];
  updatedAtIso?: string;
  ownerUid?: string;
  ownerEmail?: string | null;
}

const LOCAL_TENANTS_DIRECTORY_KEY = 'pastopro_registered_tenants_directory_v1';

const DEFAULT_SAMPLE_TENANTS: RegisteredTenantSummary[] = [
  {
    uid: 'admin-master-diego',
    email: PRIMARY_ADMIN_EMAIL,
    displayName: 'Diego Hernández',
    businessName: 'PastoPro Venado Tuerto',
    city: 'Venado Tuerto, Santa Fe',
    registeredAt: getTodayIsoLocal(),
    updatedAt: getTodayIsoLocal(),
    isApproved: true,
    approvalStatus: 'approved',
    role: 'admin',
    licenseStatus: 'active',
    planId: 'single_payment_license',
  },
  {
    uid: 'tenant-rosario-01',
    email: 'martin.parques.rosario@gmail.com',
    displayName: 'Martín Gómez',
    businessName: 'Parques del Sur Rosario',
    city: 'Rosario, Santa Fe',
    registeredAt: getTodayIsoLocal(),
    updatedAt: getTodayIsoLocal(),
    isApproved: false,
    approvalStatus: 'pending',
    role: 'user',
    licenseStatus: 'trialing',
    planId: 'evaluation',
  },
  {
    uid: 'tenant-cordoba-02',
    email: 'lucas.jardineria.cba@gmail.com',
    displayName: 'Lucas Ferreyra',
    businessName: 'Verdes Sierras Córdoba',
    city: 'Córdoba Capital, Córdoba',
    registeredAt: getTodayIsoLocal(),
    updatedAt: getTodayIsoLocal(),
    isApproved: true,
    approvalStatus: 'approved',
    role: 'user',
    licenseStatus: 'active',
    planId: 'single_payment_license',
  },
];

export function getLocalTenantDirectory(): RegisteredTenantSummary[] {
  if (typeof window === 'undefined') return DEFAULT_SAMPLE_TENANTS;
  try {
    const raw = window.localStorage.getItem(LOCAL_TENANTS_DIRECTORY_KEY);
    if (!raw) {
      window.localStorage.setItem(
        LOCAL_TENANTS_DIRECTORY_KEY,
        JSON.stringify(DEFAULT_SAMPLE_TENANTS)
      );
      return DEFAULT_SAMPLE_TENANTS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_SAMPLE_TENANTS;
    }
    return parsed;
  } catch {
    return DEFAULT_SAMPLE_TENANTS;
  }
}

export function upsertLocalTenantSummary(
  summary: RegisteredTenantSummary
): RegisteredTenantSummary[] {
  if (typeof window === 'undefined') return [];
  const current = getLocalTenantDirectory();
  const normalizedEmail = (summary.email || '').trim().toLowerCase();
  const existingIdx = current.findIndex(
    (item) =>
      item.uid === summary.uid ||
      (normalizedEmail && item.email.trim().toLowerCase() === normalizedEmail)
  );

  let nextList: RegisteredTenantSummary[];
  if (existingIdx >= 0) {
    nextList = [...current];
    nextList[existingIdx] = {
      ...nextList[existingIdx],
      ...summary,
    };
  } else {
    nextList = [summary, ...current];
  }

  try {
    window.localStorage.setItem(
      LOCAL_TENANTS_DIRECTORY_KEY,
      JSON.stringify(nextList)
    );
  } catch {
    // Ignore storage quota warnings
  }
  return nextList;
}

export function getLocalTenantApprovalState(
  uid: string,
  email?: string | null
): { isApproved: boolean; approvalStatus: ApprovalStatus; role: UserRole } {
  if (isPrimaryAdminEmail(email)) {
    return { isApproved: true, approvalStatus: 'approved', role: 'admin' };
  }
  const dir = getLocalTenantDirectory();
  const normEmail = (email || '').trim().toLowerCase();
  const found = dir.find(
    (item) =>
      item.uid === uid ||
      (normEmail && item.email.trim().toLowerCase() === normEmail)
  );
  if (!found) {
    return { isApproved: false, approvalStatus: 'pending', role: 'user' };
  }
  return {
    isApproved: Boolean(found.isApproved),
    approvalStatus:
      found.approvalStatus || (found.isApproved ? 'approved' : 'pending'),
    role: found.role || 'user',
  };
}

/**
 * Saves the authenticated user's operational workspace to Cloud Firestore
 * under `workspaces/{uid}`.
 * Enforces strict separation so non-admin users cannot escalate `isApproved` or `role`.
 */
export async function saveWorkspaceToFirestore(
  uid: string,
  payload: CloudWorkspacePayload
): Promise<{ ok: boolean; errorMessage?: string }> {
  const path = `workspaces/${uid}`;
  const resolvedEmail = auth.currentUser?.email || payload.ownerEmail || '';
  const isAdminUser = isPrimaryAdminEmail(resolvedEmail);

  const localApproval = getLocalTenantApprovalState(uid, resolvedEmail);
  const effectiveApproved = isAdminUser
    ? true
    : payload.isApproved !== undefined
      ? payload.isApproved
      : localApproval
        ? localApproval.isApproved
        : false;
  const effectiveStatus: ApprovalStatus = isAdminUser
    ? 'approved'
    : payload.approvalStatus ||
      (localApproval ? localApproval.approvalStatus : effectiveApproved ? 'approved' : 'pending');
  const effectiveRole: UserRole = isAdminUser ? 'admin' : 'user';

  upsertLocalTenantSummary({
    uid,
    email: resolvedEmail || `${uid}@pastopro.local`,
    displayName: payload.businessProfile?.ownerName || 'Titular',
    businessName: payload.businessProfile?.appName || 'Empresa de Jardinería',
    city: payload.baseLocation?.city || 'Argentina',
    registeredAt: payload.registeredAt || getTodayIsoLocal(),
    updatedAt: getTodayIsoLocal(),
    isApproved: effectiveApproved,
    approvalStatus: effectiveStatus,
    role: effectiveRole,
    licenseStatus: payload.subscription?.status,
    planId: payload.subscription?.planId,
  });

  if (!firestoreInstance) {
    return {
      ok: false,
      errorMessage: 'Servicio Firestore en inicialización local.',
    };
  }

  try {
    const docRef = doc(firestoreInstance, 'workspaces', uid);
    const existingSnap = await getDoc(docRef);

    const writeData: Record<string, unknown> = {
      ...payload,
      ownerUid: uid,
      ownerEmail: resolvedEmail || null,
      updatedAtIso: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    };

    if (!existingSnap.exists()) {
      // Initial creation: set default unapproved for regular users, approved for primary admin
      const initAccess = getInitialAccessApprovalState(resolvedEmail);
      writeData.isApproved = initAccess.isApproved;
      writeData.approvalStatus = initAccess.approvalStatus;
      writeData.role = initAccess.role;
      writeData.registeredAt = payload.registeredAt || new Date().toISOString();
    } else if (!isAdminUser) {
      // Existing document updated by non-admin owner: preserve existing approval fields untouched
      const existingData = existingSnap.data();
      writeData.isApproved = existingData.isApproved ?? false;
      writeData.approvalStatus = existingData.approvalStatus ?? 'pending';
      writeData.role = existingData.role ?? 'user';
    } else {
      writeData.isApproved = true;
      writeData.approvalStatus = 'approved';
      writeData.role = 'admin';
    }

    await setDoc(docRef, writeData, { merge: true });
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
    const data = snap.data() as CloudWorkspacePayload;
    if (data) {
      upsertLocalTenantSummary({
        uid,
        email: data.ownerEmail || `${uid}@pastopro.local`,
        displayName: data.businessProfile?.ownerName || 'Titular',
        businessName: data.businessProfile?.appName || 'Empresa de Jardinería',
        city: data.baseLocation?.city || 'Argentina',
        registeredAt: (data.registeredAt || getTodayIsoLocal()).slice(0, 10),
        updatedAt: (data.updatedAtIso || getTodayIsoLocal()).slice(0, 10),
        isApproved: isPrimaryAdminEmail(data.ownerEmail)
          ? true
          : Boolean(data.isApproved),
        approvalStatus: isPrimaryAdminEmail(data.ownerEmail)
          ? 'approved'
          : data.approvalStatus || (data.isApproved ? 'approved' : 'pending'),
        role: isPrimaryAdminEmail(data.ownerEmail) ? 'admin' : 'user',
        licenseStatus: data.subscription?.status,
        planId: data.subscription?.planId,
      });
    }
    return { data };
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

/**
 * Exclusive Administrator query: lists all registered user accounts from Cloud Firestore
 * and merges with local registry so the primary admin sees every account and its status.
 */
export async function listAllWorkspacesForAdmin(): Promise<
  RegisteredTenantSummary[]
> {
  const mergedMap = new Map<string, RegisteredTenantSummary>();

  for (const localItem of getLocalTenantDirectory()) {
    mergedMap.set(localItem.uid, localItem);
  }

  if (firestoreInstance) {
    try {
      const snap = await getDocs(collection(firestoreInstance, 'workspaces'));
      snap.forEach((docSnap) => {
        const d = docSnap.data() as CloudWorkspacePayload;
        const uid = docSnap.id;
        const email = d.ownerEmail || `${uid}@pastopro.local`;
        const isAdminAcc = isPrimaryAdminEmail(email);
        const isApproved = isAdminAcc ? true : Boolean(d.isApproved);
        const approvalStatus: ApprovalStatus = isAdminAcc
          ? 'approved'
          : d.approvalStatus || (isApproved ? 'approved' : 'pending');

        const summary: RegisteredTenantSummary = {
          uid,
          email,
          displayName: d.businessProfile?.ownerName || email.split('@')[0],
          businessName: d.businessProfile?.appName || 'Servicio de Jardinería',
          city: d.baseLocation?.city || 'Argentina',
          registeredAt: (d.registeredAt || d.updatedAtIso || getTodayIsoLocal()).slice(0, 10),
          updatedAt: (d.updatedAtIso || getTodayIsoLocal()).slice(0, 10),
          isApproved,
          approvalStatus,
          role: isAdminAcc ? 'admin' : 'user',
          licenseStatus: d.subscription?.status,
          planId: d.subscription?.planId,
        };
        mergedMap.set(uid, summary);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'workspaces');
    }
  }

  const all = Array.from(mergedMap.values()).sort((a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (b.role === 'admin' && a.role !== 'admin') return 1;
    if (a.approvalStatus === 'pending' && b.approvalStatus !== 'pending') return -1;
    if (b.approvalStatus === 'pending' && a.approvalStatus !== 'pending') return 1;
    return (b.registeredAt || '').localeCompare(a.registeredAt || '');
  });

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        LOCAL_TENANTS_DIRECTORY_KEY,
        JSON.stringify(all)
      );
    } catch {
      // Ignore
    }
  }

  return all;
}

/**
 * Exclusive Administrator action: Approves or Revokes a user's single-payment license access
 * in Cloud Firestore (`workspaces/{targetUid}`) and local multi-tenant storage.
 */
export async function updateUserApprovalByAdmin(
  targetUid: string,
  approve: boolean,
  targetEmail?: string
): Promise<{ ok: boolean; updatedSummary?: RegisteredTenantSummary; errorMessage?: string }> {
  if (isPrimaryAdminEmail(targetEmail)) {
    return {
      ok: false,
      errorMessage: 'El administrador principal siempre mantiene acceso total.',
    };
  }

  const newStatus: ApprovalStatus = approve ? 'approved' : 'revoked';
  const todayIso = getTodayIsoLocal();

  // 1. Update local directory
  const directory = getLocalTenantDirectory();
  const existing = directory.find(
    (item) =>
      item.uid === targetUid ||
      (targetEmail && item.email.toLowerCase() === targetEmail.toLowerCase())
  );

  const updatedSummary: RegisteredTenantSummary = existing
    ? {
        ...existing,
        isApproved: approve,
        approvalStatus: newStatus,
        licenseStatus: approve ? 'active' : 'expired',
        planId: approve ? 'single_payment_license' : 'evaluation',
        updatedAt: todayIso,
      }
    : {
        uid: targetUid,
        email: targetEmail || `${targetUid}@pastopro.local`,
        displayName: (targetEmail || 'Usuario').split('@')[0],
        businessName: 'Empresa de Jardinería',
        city: 'Argentina',
        registeredAt: todayIso,
        updatedAt: todayIso,
        isApproved: approve,
        approvalStatus: newStatus,
        role: 'user',
        licenseStatus: approve ? 'active' : 'expired',
        planId: approve ? 'single_payment_license' : 'evaluation',
      };

  upsertLocalTenantSummary(updatedSummary);

  // 2. Also update local tenant workspace storage if on same browser
  if (typeof window !== 'undefined') {
    try {
      const storageKey = getTenantStorageKey(targetUid, false);
      const rawTenant = window.localStorage.getItem(storageKey);
      if (rawTenant) {
        const parsedTenant = JSON.parse(rawTenant);
        parsedTenant.isApproved = approve;
        parsedTenant.approvalStatus = newStatus;
        if (parsedTenant.subscription) {
          parsedTenant.subscription.status = approve ? 'active' : 'expired';
          parsedTenant.subscription.planId = approve
            ? 'single_payment_license'
            : 'evaluation';
          if (approve) {
            parsedTenant.subscription.activatedAt = todayIso;
          }
        }
        window.localStorage.setItem(storageKey, JSON.stringify(parsedTenant));
      }
    } catch {
      // Ignore local storage errors
    }
  }

  // 3. Persist to Cloud Firestore `workspaces/{targetUid}`
  if (firestoreInstance) {
    try {
      await setDoc(
        doc(firestoreInstance, 'workspaces', targetUid),
        {
          isApproved: approve,
          approvalStatus: newStatus,
          updatedAtIso: new Date().toISOString(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      const info = handleFirestoreError(
        error,
        OperationType.UPDATE,
        `workspaces/${targetUid}`
      );
      return { ok: true, updatedSummary, errorMessage: info.error };
    }
  }

  return { ok: true, updatedSummary };
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

