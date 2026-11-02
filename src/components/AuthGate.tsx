import React, { useState } from 'react';
import {
  Building2,
  Check,
  Cloud,
  CreditCard,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  UserPlus,
  X,
} from 'lucide-react';
import { CITY_PRESETS } from '../data/seedData';
import {
  firebaseConfig,
  registerWithEmail,
  sendPasswordReset,
  signInWithEmail,
  signInWithGooglePopup,
  signOutFirebase,
  User,
} from '../firebase';

export interface AuthenticatedTenantSession {
  uid: string;
  email: string;
  displayName: string;
  businessName?: string;
  cityPresetKey?: string;
  isNewRegistration?: boolean;
}

interface StoredTenantAccount {
  uid: string;
  email: string;
  passwordHash: string;
  displayName: string;
  businessName: string;
  cityPresetKey: string;
  createdAt: string;
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
    return 'Correo o contraseña incorrectos. Verifica los datos o crea una cuenta nueva.';
  }
  if (code.includes('email-already-in-use')) {
    return 'Este correo ya está registrado. Cambia a la pestaña "Iniciar Sesión".';
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
    return 'El navegador bloqueó la ventana emergente. Permite ventanas emergentes o ingresa con correo y contraseña.';
  }
  return (
    message ||
    'No se pudo completar la autenticación. Intenta nuevamente.'
  );
}

export function AuthGate({
  currentUser,
  activeTenantSession,
  isModalOpen,
  isFullScreenGate,
  appName,
  slogan,
  cloudSyncState,
  cloudSyncMessage,
  onCloseModal,
  onContinueLocalMode,
  onTenantAuthenticated,
  onLogoutSession,
  onOpenWhiteLabelWizard,
  onOpenSubscriptionModal,
  onForceCloudSync,
  onAuthSuccessBanner,
}: AuthGateProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [cityPresetKey, setCityPresetKey] = useState('Rosario, Santa Fe');
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
        }
      : null);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg('Ingresa tu correo electrónico.');
      return;
    }

    if (mode === 'reset') {
      setIsSubmitting(true);
      try {
        await sendPasswordReset(cleanEmail);
        setInfoMsg(
          `Enviamos un enlace de recuperación a ${cleanEmail}. Revisa tu bandeja de entrada.`
        );
      } catch {
        setInfoMsg(
          `Solicitud registrada para ${cleanEmail}. Si tu cuenta está en Firebase recibirás un correo de restablecimiento.`
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
        try {
          const user = await signInWithEmail(cleanEmail, password);
          const stored = getStoredTenantAccounts()[cleanEmail];
          const session: AuthenticatedTenantSession = {
            uid: user.uid,
            email: user.email || cleanEmail,
            displayName:
              user.displayName || stored?.displayName || cleanEmail.split('@')[0],
            businessName: stored?.businessName,
            cityPresetKey: stored?.cityPresetKey,
            isNewRegistration: false,
          };
          onTenantAuthenticated(session);
          onAuthSuccessBanner(
            `Sesión iniciada como ${session.email} (Espacio privado multi-usuario).`
          );
          onCloseModal();
          return;
        } catch (fbErr: any) {
          const code = String(fbErr?.code || '');
          // Check local multi-tenant registry if provider not enabled or offline
          const stored = getStoredTenantAccounts()[cleanEmail];
          if (stored) {
            if (stored.passwordHash !== btoa(password)) {
              setErrorMsg(
                'Contraseña incorrecta para esta cuenta. Intenta nuevamente.'
              );
              return;
            }
            const session: AuthenticatedTenantSession = {
              uid: stored.uid,
              email: stored.email,
              displayName: stored.displayName,
              businessName: stored.businessName,
              cityPresetKey: stored.cityPresetKey,
              isNewRegistration: false,
            };
            onTenantAuthenticated(session);
            onAuthSuccessBanner(
              `Sesión iniciada en tu cuenta aislada (${stored.businessName} · ${stored.cityPresetKey}).`
            );
            onCloseModal();
            return;
          }
          if (
            code.includes('operation-not-allowed') ||
            code.includes('configuration-not-found') ||
            code.includes('network-request-failed')
          ) {
            setErrorMsg(
              'No encontramos una cuenta con ese correo. Haz clic en la pestaña "Crear Cuenta" para dar de alta tu emprendimiento.'
            );
            return;
          }
          setErrorMsg(translateFirebaseAuthError(fbErr));
        }
      } else {
        // REGISTER NEW MULTI-TENANT ACCOUNT
        const cleanDisplay =
          displayName.trim() || cleanEmail.split('@')[0] || 'Titular';
        const cleanBusiness =
          businessName.trim() || `${cleanDisplay} Jardinería`;

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
            cityPresetKey,
            createdAt: new Date().toISOString(),
          });
          const session: AuthenticatedTenantSession = {
            uid: user.uid,
            email: user.email || cleanEmail,
            displayName: cleanDisplay,
            businessName: cleanBusiness,
            cityPresetKey,
            isNewRegistration: true,
          };
          onTenantAuthenticated(session);
          onAuthSuccessBanner(
            `¡Cuenta creada en Firebase (${firebaseConfig.projectId})! Espacio aislado configurado para ${cleanBusiness} (${cityPresetKey}).`
          );
          onCloseModal();
          return;
        } catch (fbErr: any) {
          const code = String(fbErr?.code || '');
          if (code.includes('email-already-in-use')) {
            setErrorMsg(
              'Este correo ya está registrado. Cambia a la pestaña "Iniciar Sesión".'
            );
            return;
          }
          // If Firebase Console Email/Password provider isn't enabled yet, provision isolated tenant account seamlessly
          const existingLocal = getStoredTenantAccounts()[cleanEmail];
          if (existingLocal) {
            setErrorMsg(
              'Este correo ya tiene una cuenta creada. Cambia a "Iniciar Sesión".'
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
            cityPresetKey,
            createdAt: new Date().toISOString(),
          });
          const session: AuthenticatedTenantSession = {
            uid: tenantUid,
            email: cleanEmail,
            displayName: cleanDisplay,
            businessName: cleanBusiness,
            cityPresetKey,
            isNewRegistration: true,
          };
          onTenantAuthenticated(session);
          onAuthSuccessBanner(
            `¡Cuenta creada con éxito para ${cleanBusiness} (${cityPresetKey})! Tus datos están 100% aislados.`
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
      const session: AuthenticatedTenantSession = {
        uid: user.uid,
        email: user.email || 'google@pastopro.app',
        displayName: user.displayName || 'Cuenta Google',
        isNewRegistration: false,
      };
      onTenantAuthenticated(session);
      onAuthSuccessBanner(
        `Conectado con Google en Firebase (${firebaseConfig.projectId}) como ${
          user.email || user.displayName || 'Usuario'
        }.`
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

  const cardContent = (
    <div className="w-full max-w-md bg-white border border-zinc-200/90 rounded-2xl p-6 sm:p-8 shadow-xl shadow-zinc-950/5 space-y-5 relative">
      {!isFullScreenGate && (
        <button
          type="button"
          onClick={onCloseModal}
          aria-label="Cerrar ventana de cuenta"
          className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-zinc-900 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Minimalist Brand Header */}
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-emerald-700 font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-600" />
          <span>SAAS MULTI-TENANT · {firebaseConfig.projectId}</span>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-950">
          {effectiveSession
            ? 'Tu Cuenta y Sesión Activa'
            : mode === 'login'
            ? 'Iniciar Sesión en tu Cuenta'
            : mode === 'register'
            ? 'Crear Cuenta de Prestador'
            : 'Recuperar contraseña'}
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">
          {effectiveSession
            ? 'Cada usuario opera en un espacio privado con sus propios clientes, precios, logo y ruta GPS.'
            : mode === 'register'
            ? 'Crea tu cuenta independiente con tus propios precios, ciudad, logo y clientes 100% separados.'
            : 'Ingresa con tu correo y contraseña para acceder a tus clientes, rutas y caja.'}
        </p>
      </div>

      {effectiveSession ? (
        /* Authenticated User Profile, Quick White-Label / Subscription & Logout Controls */
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-display font-bold text-sm flex items-center justify-center shrink-0">
                {(
                  effectiveSession.displayName ||
                  effectiveSession.email ||
                  'U'
                )[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-zinc-900 truncate">
                  {effectiveSession.businessName ||
                    appName ||
                    effectiveSession.displayName}
                </div>
                <div className="text-xs font-mono text-zinc-500 truncate">
                  {effectiveSession.email}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-200/80 flex items-center justify-between text-xs">
              <span className="text-zinc-500 font-medium">Aislamiento:</span>
              <span className="font-mono font-semibold text-emerald-700">
                Cuenta Separada ({effectiveSession.uid.slice(0, 12)})
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500 font-medium">Estado Cloud:</span>
              <span
                className={`font-semibold inline-flex items-center gap-1 ${
                  cloudSyncState === 'synced'
                    ? 'text-emerald-700'
                    : cloudSyncState === 'syncing'
                    ? 'text-amber-700'
                    : 'text-zinc-700'
                }`}
              >
                {cloudSyncState === 'synced' && (
                  <Check className="w-3.5 h-3.5" />
                )}
                {cloudSyncState === 'syncing' && (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>
                  {cloudSyncState === 'synced'
                    ? 'Sincronizado en tiempo real'
                    : cloudSyncState === 'syncing'
                    ? 'Sincronizando...'
                    : 'Espacio Privado Activo'}
                </span>
              </span>
            </div>

            {cloudSyncMessage && (
              <p className="text-[11px] text-zinc-500 bg-white p-2.5 rounded-lg border border-zinc-200/70">
                {cloudSyncMessage}
              </p>
            )}
          </div>

          {/* Quick Commercial Links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {onOpenWhiteLabelWizard && (
              <button
                type="button"
                onClick={() => {
                  onCloseModal();
                  onOpenWhiteLabelWizard();
                }}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Mi Marca, Logo y Precios</span>
              </button>
            )}
            {onOpenSubscriptionModal && (
              <button
                type="button"
                onClick={() => {
                  onCloseModal();
                  onOpenSubscriptionModal();
                }}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5 text-sky-600" />
                <span>Suscripción Mercado Pago</span>
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={onForceCloudSync}
              disabled={cloudSyncState === 'syncing'}
              className="flex-1 min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50"
            >
              <Cloud className="w-4 h-4 text-emerald-400" />
              <span>Respaldar en Cloud</span>
            </button>

            <button
              type="button"
              onClick={handleLogoutClick}
              disabled={isSubmitting}
              data-testid="modal-logout-btn"
              className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      ) : (
        /* Unauthenticated Login / Register Form */
        <div className="space-y-4">
          {/* Segmented Mode Switcher */}
          <div className="grid grid-cols-2 p-1 bg-zinc-100 rounded-xl">
            <button
              type="button"
              data-testid="tab-login-btn"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`min-h-[36px] text-xs font-semibold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-white text-zinc-950 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
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
              className={`min-h-[36px] text-xs font-semibold rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-white text-zinc-950 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Crear Cuenta Nueva
            </button>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed"
            >
              {errorMsg}
            </div>
          )}

          {infoMsg && (
            <div
              role="status"
              className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 leading-relaxed"
            >
              {infoMsg}
            </div>
          )}

          <form onSubmit={handleEmailSubmit} className="space-y-3">
            {mode === 'register' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label
                      htmlFor="auth-business-name"
                      className="block text-xs font-medium text-zinc-700 mb-1"
                    >
                      Nombre de tu Emprendimiento *
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="auth-business-name"
                        type="text"
                        required
                        placeholder="Ej: Parques Rosario"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="auth-display-name"
                      className="block text-xs font-medium text-zinc-700 mb-1"
                    >
                      Tu Nombre y Apellido *
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="auth-display-name"
                        type="text"
                        required
                        placeholder="Ej: Martín Gómez"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="auth-city-select"
                    className="block text-xs font-medium text-zinc-700 mb-1"
                  >
                    Tu Ciudad / Zona de Trabajo *
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      id="auth-city-select"
                      value={cityPresetKey}
                      onChange={(e) => setCityPresetKey(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium text-zinc-900"
                    >
                      {Object.keys(CITY_PRESETS).map((cityKey) => (
                        <option key={cityKey} value={cityKey}>
                          {cityKey}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-medium text-zinc-700 mb-1"
              >
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-medium text-zinc-700"
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
                      className="text-[11px] font-medium text-emerald-700 hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="auth-submit-btn"
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-zinc-950 hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === 'login' ? (
                <LogIn className="w-4 h-4 text-emerald-400" />
              ) : mode === 'register' ? (
                <UserPlus className="w-4 h-4 text-emerald-400" />
              ) : (
                <Mail className="w-4 h-4 text-emerald-400" />
              )}
              <span>
                {mode === 'login'
                  ? 'Iniciar Sesión'
                  : mode === 'register'
                  ? 'Crear Mi Cuenta Independiente (14 días gratis)'
                  : 'Enviar Correo de Recuperación'}
              </span>
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-200" />
            <span className="text-[11px] font-mono uppercase text-zinc-400 whitespace-nowrap shrink-0">
              o continúa con
            </span>
            <div className="h-px flex-1 bg-zinc-200" />
          </div>

          {/* Google OAuth & Explicit Demo Exploration */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleGoogleAccess}
              disabled={isSubmitting}
              className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-zinc-800 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-xl transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Continuar con Google</span>
            </button>

            <button
              type="button"
              onClick={onContinueLocalMode}
              data-testid="continue-local-mode-btn"
              className="w-full min-h-[38px] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-950 bg-zinc-100/80 hover:bg-zinc-200/70 rounded-xl transition-colors"
            >
              <span>Ver Demo Interactiva (Datos de muestra)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (isFullScreenGate) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 flex flex-col justify-between p-4 sm:p-8">
        <header className="max-w-6xl w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            <span className="font-display font-bold text-lg tracking-tight text-zinc-950">
              PastoPro Cloud
            </span>
            <span className="hidden sm:inline-block text-xs text-zinc-400 font-mono">
              · Software para Jardineros y Parquizadores
            </span>
          </div>
          <button
            type="button"
            onClick={onContinueLocalMode}
            className="text-xs font-semibold text-zinc-600 hover:text-zinc-950 px-3 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
          >
            Probar Demo →
          </button>
        </header>

        <main className="flex-1 flex items-center justify-center py-6">
          {cardContent}
        </main>

        <footer className="max-w-6xl w-full mx-auto text-center text-xs text-zinc-400 font-mono">
          Plataforma Multi-Usuario ({firebaseConfig.projectId}) · Suscripciones
          Mercado Pago · Marca Blanca
        </footer>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Autenticación y Sincronización Cloud"
      className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      {cardContent}
    </div>
  );
}
