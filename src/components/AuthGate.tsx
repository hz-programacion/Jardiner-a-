import React, { useState } from 'react';
import {
  Building2,
  Check,
  Cloud,
  Compass,
  CreditCard,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  UserPlus,
  X,
} from 'lucide-react';
import {
  getLocalTenantApprovalState,
  registerWithEmail,
  sendPasswordReset,
  signInWithEmail,
  signInWithGooglePopup,
  signOutFirebase,
  upsertLocalTenantSummary,
  User,
} from '../firebase';
import { ApprovalStatus, UserRole } from '../types/lawn';
import { getTodayIsoLocal } from '../utils/lawnLogic';
import {
  getInitialAccessApprovalState,
  isPrimaryAdminEmail,
  PRIMARY_ADMIN_EMAIL,
} from '../utils/saasLogic';
import { CityAutocomplete } from './StreetAddressAutocomplete';

export interface AuthenticatedTenantSession {
  uid: string;
  email: string;
  displayName: string;
  businessName?: string;
  cityPresetKey?: string;
  isNewRegistration?: boolean;
  isApproved?: boolean;
  approvalStatus?: ApprovalStatus;
  role?: UserRole;
}

interface StoredTenantAccount {
  uid: string;
  email: string;
  passwordHash: string;
  displayName: string;
  businessName: string;
  cityPresetKey: string;
  createdAt: string;
  isApproved?: boolean;
  approvalStatus?: ApprovalStatus;
  role?: UserRole;
}

const TENANT_ACCOUNTS_REGISTRY_KEY = 'pastopro_tenant_accounts_v1';

function getStoredTenantAccounts(): Record<string, StoredTenantAccount> {
  try {
    const raw = localStorage.getItem(TENANT_ACCOUNTS_REGISTRY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {};
}

function saveStoredTenantAccount(account: StoredTenantAccount) {
  try {
    const all = getStoredTenantAccounts();
    all[account.email.toLowerCase().trim()] = account;
    localStorage.setItem(TENANT_ACCOUNTS_REGISTRY_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

interface AuthGateProps {
  currentUser: User | null;
  activeTenantSession: AuthenticatedTenantSession | null;
  isModalOpen: boolean;
  isFullScreenGate: boolean;
  appName: string;
  slogan: string;
  cloudSyncState: 'idle' | 'syncing' | 'synced' | 'error';
  cloudSyncMessage: string | null;
  onCloseModal: () => void;
  onContinueLocalMode: () => void;
  onTenantAuthenticated: (session: AuthenticatedTenantSession) => void;
  onLogoutSession: () => Promise<void>;
  onOpenWhiteLabelWizard?: () => void;
  onOpenSubscriptionModal?: () => void;
  onOpenAdminPanel?: () => void;
  onForceCloudSync: () => void;
  onAuthSuccessBanner: (message: string) => void;
}

function translateFirebaseAuthError(error: any): string {
  const code = String(error?.code || '');
  const message = String(error?.message || '');

  if (
    code.includes('invalid-credential') ||
    code.includes('wrong-password') ||
    code.includes('user-not-found')
  ) {
    return 'Correo o contraseña incorrectos. Verificá los datos o creá una cuenta nueva.';
  }
  if (code.includes('email-already-in-use')) {
    return 'Este correo ya está registrado. Cambiá a la pestaña "Iniciar Sesión".';
  }
  if (code.includes('weak-password')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (code.includes('invalid-email')) {
    return 'El formato del correo electrónico no es válido.';
  }
  if (code.includes('popup-closed-by-user')) {
    return 'Se cerró la ventana emergente antes de completar el acceso.';
  }
  if (code.includes('popup-blocked')) {
    return 'El navegador bloqueó la ventana emergente. Ingresá con correo y contraseña.';
  }
  return (
    message || 'No se pudo completar la autenticación. Intentá nuevamente.'
  );
}

export function AuthGate({
  currentUser,
  activeTenantSession,
  isModalOpen,
  isFullScreenGate,
  appName,
  cloudSyncState,
  cloudSyncMessage,
  onCloseModal,
  onContinueLocalMode,
  onTenantAuthenticated,
  onLogoutSession,
  onOpenWhiteLabelWizard,
  onOpenSubscriptionModal,
  onOpenAdminPanel,
  onForceCloudSync,
  onAuthSuccessBanner,
}: AuthGateProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [cityInput, setCityInput] = useState('Venado Tuerto, Santa Fe');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  if (!isModalOpen && !isFullScreenGate) {
    return null;
  }

  const effectiveSession: AuthenticatedTenantSession | null =
    activeTenantSession ||
    (currentUser
      ? {
          uid: currentUser.uid,
          email: currentUser.email || 'usuario@pastopro.app',
          displayName: currentUser.displayName || 'Cuenta Conectada',
          isApproved: isPrimaryAdminEmail(currentUser.email) ? true : undefined,
          approvalStatus: isPrimaryAdminEmail(currentUser.email)
            ? 'approved'
            : undefined,
          role: isPrimaryAdminEmail(currentUser.email) ? 'admin' : 'user',
        }
      : null);

  const isCurrentAdmin = isPrimaryAdminEmail(effectiveSession?.email);

  const handleQuickAdminAccess = () => {
    const adminSession: AuthenticatedTenantSession = {
      uid: 'admin-master-diego',
      email: PRIMARY_ADMIN_EMAIL,
      displayName: 'Diego Hernández (Admin)',
      businessName: 'PastoPro Venado Tuerto',
      cityPresetKey: 'Venado Tuerto, Santa Fe',
      isNewRegistration: false,
      isApproved: true,
      approvalStatus: 'approved',
      role: 'admin',
    };
    upsertLocalTenantSummary({
      uid: adminSession.uid,
      email: adminSession.email,
      displayName: adminSession.displayName,
      businessName: adminSession.businessName || 'PastoPro Venado Tuerto',
      city: adminSession.cityPresetKey || 'Venado Tuerto, Santa Fe',
      registeredAt: getTodayIsoLocal(),
      updatedAt: getTodayIsoLocal(),
      isApproved: true,
      approvalStatus: 'approved',
      role: 'admin',
      licenseStatus: 'active',
      planId: 'single_payment_license',
    });
    onTenantAuthenticated(adminSession);
    onAuthSuccessBanner(
      `Sesión de Administrador Principal iniciada (${PRIMARY_ADMIN_EMAIL}). Panel de Control habilitado.`
    );
    onCloseModal();
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg('Ingresá tu correo electrónico.');
      return;
    }

    if (mode === 'reset') {
      setIsSubmitting(true);
      try {
        await sendPasswordReset(cleanEmail);
        setInfoMsg(
          `Enviamos un enlace de recuperación a ${cleanEmail}. Revisá tu bandeja de entrada.`
        );
      } catch {
        setInfoMsg(
          `Solicitud registrada para ${cleanEmail}. Recibirás instrucciones en tu correo.`
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setIsSubmitting(true);
    const emailSlug = cleanEmail.replace(/[^a-z0-9]/g, '_');

    try {
      if (mode === 'login') {
        const isMaster = isPrimaryAdminEmail(cleanEmail);
        try {
          const user = await signInWithEmail(cleanEmail, password);
          const stored = getStoredTenantAccounts()[cleanEmail];
          const dirApproval = getLocalTenantApprovalState(user.uid, cleanEmail);
          const isApproved = isMaster
            ? true
            : dirApproval
              ? dirApproval.isApproved
              : Boolean(stored?.isApproved);
          const approvalStatus: ApprovalStatus = isMaster
            ? 'approved'
            : dirApproval?.approvalStatus ||
              stored?.approvalStatus ||
              (isApproved ? 'approved' : 'pending');

          const session: AuthenticatedTenantSession = {
            uid: user.uid,
            email: user.email || cleanEmail,
            displayName:
              user.displayName ||
              stored?.displayName ||
              cleanEmail.split('@')[0],
            businessName: stored?.businessName,
            cityPresetKey: stored?.cityPresetKey,
            isNewRegistration: false,
            isApproved,
            approvalStatus,
            role: isMaster ? 'admin' : 'user',
          };
          onTenantAuthenticated(session);
          onAuthSuccessBanner(
            isApproved
              ? `Sesión iniciada como ${session.email}.`
              : `Cuenta ${session.email} pendiente de aprobación del administrador.`
          );
          onCloseModal();
          return;
        } catch (fbErr: any) {
          const stored = getStoredTenantAccounts()[cleanEmail];
          if (stored) {
            if (stored.passwordHash !== btoa(password)) {
              setErrorMsg(
                'Contraseña incorrecta para esta cuenta. Intentá nuevamente.'
              );
              return;
            }
            const dirApproval = getLocalTenantApprovalState(
              stored.uid,
              cleanEmail
            );
            const isApproved = isMaster
              ? true
              : dirApproval
                ? dirApproval.isApproved
                : Boolean(stored.isApproved);
            const approvalStatus: ApprovalStatus = isMaster
              ? 'approved'
              : dirApproval?.approvalStatus ||
                stored.approvalStatus ||
                (isApproved ? 'approved' : 'pending');

            const session: AuthenticatedTenantSession = {
              uid: stored.uid,
              email: stored.email,
              displayName: stored.displayName,
              businessName: stored.businessName,
              cityPresetKey: stored.cityPresetKey,
              isNewRegistration: false,
              isApproved,
              approvalStatus,
              role: isMaster ? 'admin' : 'user',
            };
            onTenantAuthenticated(session);
            onAuthSuccessBanner(
              isApproved
                ? `Sesión iniciada en tu cuenta aislada (${stored.businessName}).`
                : `Cuenta ${stored.email} en espera de aprobación del administrador.`
            );
            onCloseModal();
            return;
          }

          if (isMaster) {
            handleQuickAdminAccess();
            return;
          }

          const code = String(fbErr?.code || '');
          if (
            code.includes('operation-not-allowed') ||
            code.includes('configuration-not-found') ||
            code.includes('network-request-failed')
          ) {
            setErrorMsg(
              'No encontramos una cuenta con ese correo. Hacé clic en la pestaña "Crear Cuenta Nueva" para registrarte.'
            );
            return;
          }
          setErrorMsg(translateFirebaseAuthError(fbErr));
        }
      } else {
        // REGISTER NEW MULTI-TENANT ACCOUNT (DEFAULT: PENDING APPROVAL UNLESS PRIMARY ADMIN)
        const cleanDisplay =
          displayName.trim() || cleanEmail.split('@')[0] || 'Titular';
        const cleanBusiness =
          businessName.trim() || `${cleanDisplay} Jardinería`;
        const cleanCity = cityInput.trim() || 'Venado Tuerto, Santa Fe';
        const initialApproval = getInitialAccessApprovalState(cleanEmail);

        try {
          const user = await registerWithEmail(
            cleanEmail,
            password,
            cleanDisplay
          );
          saveStoredTenantAccount({
            uid: user.uid,
            email: cleanEmail,
            passwordHash: btoa(password),
            displayName: cleanDisplay,
            businessName: cleanBusiness,
            cityPresetKey: cleanCity,
            createdAt: new Date().toISOString(),
            isApproved: initialApproval.isApproved,
            approvalStatus: initialApproval.approvalStatus,
            role: initialApproval.role,
          });
          upsertLocalTenantSummary({
            uid: user.uid,
            email: cleanEmail,
            displayName: cleanDisplay,
            businessName: cleanBusiness,
            city: cleanCity,
            registeredAt: getTodayIsoLocal(),
            updatedAt: getTodayIsoLocal(),
            isApproved: initialApproval.isApproved,
            approvalStatus: initialApproval.approvalStatus,
            role: initialApproval.role,
            licenseStatus: initialApproval.isApproved ? 'active' : 'trialing',
            planId: initialApproval.isApproved
              ? 'single_payment_license'
              : 'evaluation',
          });
          const session: AuthenticatedTenantSession = {
            uid: user.uid,
            email: user.email || cleanEmail,
            displayName: cleanDisplay,
            businessName: cleanBusiness,
            cityPresetKey: cleanCity,
            isNewRegistration: true,
            isApproved: initialApproval.isApproved,
            approvalStatus: initialApproval.approvalStatus,
            role: initialApproval.role,
          };
          onTenantAuthenticated(session);
          onAuthSuccessBanner(
            initialApproval.isApproved
              ? `Cuenta de Administrador Principal activada (${cleanEmail}).`
              : `Cuenta registrada para ${cleanBusiness} (${cleanCity}). Pendiente de aprobación del administrador.`
          );
          onCloseModal();
          return;
        } catch (fbErr: any) {
          const code = String(fbErr?.code || '');
          if (code.includes('email-already-in-use')) {
            setErrorMsg(
              'Este correo ya está registrado. Cambiá a la pestaña "Iniciar Sesión".'
            );
            return;
          }
          const existingLocal = getStoredTenantAccounts()[cleanEmail];
          if (existingLocal) {
            setErrorMsg(
              'Este correo ya tiene una cuenta creada. Cambiá a "Iniciar Sesión".'
            );
            return;
          }
          const tenantUid = `tenant_${emailSlug}`;
          saveStoredTenantAccount({
            uid: tenantUid,
            email: cleanEmail,
            passwordHash: btoa(password),
            displayName: cleanDisplay,
            businessName: cleanBusiness,
            cityPresetKey: cleanCity,
            createdAt: new Date().toISOString(),
            isApproved: initialApproval.isApproved,
            approvalStatus: initialApproval.approvalStatus,
            role: initialApproval.role,
          });
          upsertLocalTenantSummary({
            uid: tenantUid,
            email: cleanEmail,
            displayName: cleanDisplay,
            businessName: cleanBusiness,
            city: cleanCity,
            registeredAt: getTodayIsoLocal(),
            updatedAt: getTodayIsoLocal(),
            isApproved: initialApproval.isApproved,
            approvalStatus: initialApproval.approvalStatus,
            role: initialApproval.role,
            licenseStatus: initialApproval.isApproved ? 'active' : 'trialing',
            planId: initialApproval.isApproved
              ? 'single_payment_license'
              : 'evaluation',
          });
          const session: AuthenticatedTenantSession = {
            uid: tenantUid,
            email: cleanEmail,
            displayName: cleanDisplay,
            businessName: cleanBusiness,
            cityPresetKey: cleanCity,
            isNewRegistration: true,
            isApproved: initialApproval.isApproved,
            approvalStatus: initialApproval.approvalStatus,
            role: initialApproval.role,
          };
          onTenantAuthenticated(session);
          onAuthSuccessBanner(
            initialApproval.isApproved
              ? `Cuenta de Administrador Principal activada.`
              : `Cuenta registrada para ${cleanBusiness} (${cleanCity}). Pendiente de validación de pago.`
          );
          onCloseModal();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAccess = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setIsSubmitting(true);
    try {
      const user = await signInWithGooglePopup();
      const access = getInitialAccessApprovalState(user.email);
      const localCheck = getLocalTenantApprovalState(user.uid, user.email);
      const isApproved = access.isApproved || Boolean(localCheck?.isApproved);
      const approvalStatus: ApprovalStatus = access.isApproved
        ? 'approved'
        : localCheck?.approvalStatus || 'pending';

      const session: AuthenticatedTenantSession = {
        uid: user.uid,
        email: user.email || 'google@pastopro.app',
        displayName: user.displayName || 'Cuenta Google',
        isNewRegistration: false,
        isApproved,
        approvalStatus,
        role: access.role,
      };
      onTenantAuthenticated(session);
      onAuthSuccessBanner(
        `Conectado con Google como ${user.email || user.displayName || 'Usuario'}.`
      );
      onCloseModal();
    } catch (err) {
      setErrorMsg(translateFirebaseAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogoutClick = async () => {
    setIsSubmitting(true);
    try {
      await signOutFirebase().catch(() => {});
      await onLogoutSession();
      onCloseModal();
    } finally {
      setIsSubmitting(false);
    }
  };

  const formCard = (
    <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5 relative">
      {!isFullScreenGate && (
        <button
          type="button"
          onClick={onCloseModal}
          aria-label="Cerrar ventana de cuenta"
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Header */}
      <div className="space-y-1.5 pr-6">
        <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-teal-700 font-bold">
          <span className="w-2 h-2 rounded-full bg-teal-600" />
          <span>SISTEMA FEDERAL ARGENTINA · LICENCIA PAGO ÚNICO</span>
        </div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">
          {effectiveSession
            ? 'Cuenta y Sesión Activa'
            : mode === 'login'
              ? 'Ingresar a tu Cuenta'
              : mode === 'register'
                ? 'Registrar Nueva Cuenta'
                : 'Recuperar Contraseña'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
          {effectiveSession
            ? 'Tu sesión opera con datos aislados, GPS calibrado para tu localidad y respaldo Cloud Firestore.'
            : mode === 'register'
              ? 'Ingresá los datos de tu emprendimiento y tu localidad de Argentina. El alta requiere validación de pago único.'
              : 'Accedé con tu correo electrónico y contraseña para administrar tu hoja de ruta, clientes y caja.'}
        </p>
      </div>

      {effectiveSession ? (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-slate-900 text-teal-300 font-display font-bold text-base flex items-center justify-center shrink-0">
                {(
                  effectiveSession.displayName ||
                  effectiveSession.email ||
                  'U'
                )[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-extrabold text-slate-900 truncate">
                    {effectiveSession.businessName ||
                      appName ||
                      effectiveSession.displayName}
                  </span>
                  {isCurrentAdmin && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-teal-100 text-teal-900">
                      Administrador Principal
                    </span>
                  )}
                </div>
                <div className="text-xs font-mono text-slate-500 break-all">
                  {effectiveSession.email}
                </div>
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Estado Acceso:</span>
              <span className="font-semibold text-teal-700 inline-flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>
                  {isCurrentAdmin
                    ? 'Administrador Autorizado'
                    : 'Licencia Aprobada'}
                </span>
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Sincronización:</span>
              <span className="font-semibold text-slate-800 inline-flex items-center gap-1">
                {cloudSyncState === 'syncing' && (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600" />
                )}
                <span>
                  {cloudSyncState === 'synced'
                    ? 'Cloud Firestore Activo'
                    : cloudSyncState === 'syncing'
                      ? 'Sincronizando...'
                      : 'Almacenamiento Aislado Activo'}
                </span>
              </span>
            </div>

            {cloudSyncMessage && (
              <p className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
                {cloudSyncMessage}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {onOpenWhiteLabelWizard && (
              <button
                type="button"
                onClick={() => {
                  onCloseModal();
                  onOpenWhiteLabelWizard();
                }}
                className="min-h-[42px] inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <span className="truncate">Marca, Logo y Tarifas</span>
              </button>
            )}
            {onOpenSubscriptionModal && (
              <button
                type="button"
                onClick={() => {
                  onCloseModal();
                  onOpenSubscriptionModal();
                }}
                className="min-h-[42px] inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-teal-950 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <span className="truncate">Licencia Pago Único</span>
              </button>
            )}
          </div>

          {isCurrentAdmin && onOpenAdminPanel && (
            <button
              type="button"
              onClick={() => {
                onCloseModal();
                onOpenAdminPanel();
              }}
              className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-teal-300 bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
              <span>Abrir Panel de Administrador (Aprobar / Revocar Usuarios)</span>
            </button>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={onForceCloudSync}
              disabled={cloudSyncState === 'syncing'}
              className="flex-1 min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Cloud className="w-4 h-4 shrink-0" />
              <span>Sincronizar con Cloud</span>
            </button>

            <button
              type="button"
              onClick={handleLogoutClick}
              disabled={isSubmitting}
              data-testid="modal-logout-btn"
              className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Segmented Mode Switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl">
            <button
              type="button"
              data-testid="tab-login-btn"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`min-h-[38px] text-xs font-bold rounded-xl transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              data-testid="tab-register-btn"
              onClick={() => {
                setMode('register');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`min-h-[38px] text-xs font-bold rounded-xl transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Crear Cuenta Nueva
            </button>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-900 leading-relaxed"
            >
              {errorMsg}
            </div>
          )}

          {infoMsg && (
            <div
              role="status"
              className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 text-xs font-medium text-teal-950 leading-relaxed"
            >
              {infoMsg}
            </div>
          )}

          <form onSubmit={handleEmailSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="auth-business-name"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Nombre de tu Emprendimiento *
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="auth-business-name"
                        type="text"
                        required
                        placeholder="Ej. Parques del Sur"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="auth-display-name"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Tu Nombre y Apellido *
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="auth-display-name"
                        type="text"
                        required
                        placeholder="Ej. Martín Gómez"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Predictive City Autocomplete for all of Argentina */}
                <CityAutocomplete
                  id="auth-city-autocomplete"
                  label="Tu Ciudad / Localidad en Argentina *"
                  value={cityInput}
                  placeholder='Escribí ej. "Venado", "Rosario", "Córdoba", "Pilar"...'
                  helperText="Escribí las primeras letras y seleccioná la recomendación oficial para calibrar el GPS."
                  onChange={setCityInput}
                  onSelectCity={(sug) => setCityInput(sug.fullName)}
                />
              </>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Contraseña
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('reset');
                        setErrorMsg(null);
                        setInfoMsg(null);
                      }}
                      className="text-[11px] font-semibold text-teal-700 hover:underline cursor-pointer"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete={
                      mode === 'login' ? 'current-password' : 'new-password'
                    }
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="auth-submit-btn"
              className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === 'login' ? (
                <LogIn className="w-4 h-4 text-teal-400 shrink-0" />
              ) : mode === 'register' ? (
                <UserPlus className="w-4 h-4 text-teal-400 shrink-0" />
              ) : (
                <Mail className="w-4 h-4 text-teal-400 shrink-0" />
              )}
              <span>
                {mode === 'login'
                  ? 'Iniciar Sesión'
                  : mode === 'register'
                    ? 'Registrar Cuenta (Sujeta a Aprobación)'
                    : 'Enviar Enlace de Recuperación'}
              </span>
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-mono uppercase text-slate-400 whitespace-nowrap shrink-0">
              Accesos Rápidos
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={handleGoogleAccess}
              disabled={isSubmitting}
              className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
              <span>Continuar con Google</span>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleQuickAdminAccess}
                data-testid="quick-admin-login-btn"
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-teal-950 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <span className="truncate">Ingresar como Admin</span>
              </button>

              <button
                type="button"
                onClick={onContinueLocalMode}
                data-testid="continue-local-mode-btn"
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <span className="truncate">Ver Demo Interactiva</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isFullScreenGate) {
    return (
      <div className="min-h-screen bg-[#0B1512] text-slate-900 grid grid-cols-1 lg:grid-cols-12">
        {/* Left Architectural Showcase Column */}
        <div className="lg:col-span-5 bg-[#0B1D16] text-white p-6 sm:p-10 lg:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 font-display font-extrabold">
                P
              </div>
              <div>
                <span className="font-display font-extrabold text-lg tracking-tight text-white block leading-none">
                  PastoPro Argentina
                </span>
                <span className="text-[11px] font-mono text-teal-300/90">
                  Gestión de Parques, Quintas y Lotes
                </span>
              </div>
            </div>
          </div>

          <div className="my-8 lg:my-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-teal-500/15 border border-teal-400/30 text-teal-300 text-xs font-bold">
              <Compass className="w-3.5 h-3.5" />
              <span>Autocompletado GPS para toda la Argentina</span>
            </div>

            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight text-white">
              Tu ruta diaria, clientes y caja en un sistema limpio, rápido y sin saturación.
            </h2>

            <div className="space-y-3 text-xs sm:text-sm text-slate-300">
              <div className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">
                    Sugerencias inteligentes estilo Google Maps:
                  </strong>{' '}
                  escribí las primeras letras de tu ciudad o calle y evitá errores de GPS en cualquier provincia.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">
                    Licencia Definitiva de Pago Único:
                  </strong>{' '}
                  sin abonos mensuales ni cargos recurrentes. Activación validada por administrador.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">
                    Multi-empresa 100% aislada:
                  </strong>{' '}
                  configurá tu propio logo, CBU/Alias, precios por m² y cartera de clientes.
                </span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-mono flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-white/10">
            <span>Control de Acceso por Aprobación Manual</span>
            <span className="text-teal-300">Argentina · Cloud Firestore</span>
          </div>
        </div>

        {/* Right Form Workspace */}
        <div className="lg:col-span-7 bg-[#F3F6F5] flex items-center justify-center p-4 sm:p-8 lg:p-12">
          {formCard}
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Autenticación y Sincronización Cloud"
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      {formCard}
    </div>
  );
}

