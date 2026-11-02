import React, { useState } from 'react';
import {
  Check,
  Cloud,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  User as UserIcon,
  UserPlus,
  X,
} from 'lucide-react';
import {
  firebaseConfig,
  registerWithEmail,
  sendPasswordReset,
  signInWithEmail,
  signInWithGooglePopup,
  signOutFirebase,
  User,
} from '../firebase';

interface AuthGateProps {
  currentUser: User | null;
  isModalOpen: boolean;
  isFullScreenGate: boolean;
  appName: string;
  slogan: string;
  cloudSyncState: 'idle' | 'syncing' | 'synced' | 'error';
  cloudSyncMessage: string | null;
  onCloseModal: () => void;
  onContinueLocalMode: () => void;
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
    return 'Este correo ya está registrado en Firebase. Cambia a "Iniciar Sesión".';
  }
  if (code.includes('weak-password')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (code.includes('invalid-email')) {
    return 'El formato del correo electrónico no es válido.';
  }
  if (code.includes('operation-not-allowed')) {
    return 'El método de acceso aún no está habilitado en Firebase Console (jardineria-5463b → Authentication → Sign-in method). Habilita "Correo electrónico/contraseña" o "Google".';
  }
  if (code.includes('unauthorized-domain')) {
    return 'Este dominio de vista previa debe agregarse en Firebase Console (jardineria-5463b → Authentication → Settings → Dominios autorizados), o puedes usar el Modo Local.';
  }
  if (code.includes('popup-closed-by-user')) {
    return 'Se cerró la ventana emergente antes de completar el acceso.';
  }
  if (code.includes('popup-blocked')) {
    return 'El navegador bloqueó la ventana emergente. Permite ventanas emergentes o ingresa con correo y contraseña.';
  }
  return (
    message ||
    'No se pudo completar la autenticación con Firebase. Intenta nuevamente.'
  );
}

export function AuthGate({
  currentUser,
  isModalOpen,
  isFullScreenGate,
  appName,
  slogan,
  cloudSyncState,
  cloudSyncMessage,
  onCloseModal,
  onContinueLocalMode,
  onForceCloudSync,
  onAuthSuccessBanner,
}: AuthGateProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  if (!isModalOpen && !isFullScreenGate) {
    return null;
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!email.trim()) {
      setErrorMsg('Ingresa tu correo electrónico.');
      return;
    }

    if (mode === 'reset') {
      setIsSubmitting(true);
      try {
        await sendPasswordReset(email);
        setInfoMsg(
          `Enviamos un enlace de recuperación a ${email.trim()}. Revisa tu bandeja de entrada.`
        );
      } catch (err) {
        setErrorMsg(translateFirebaseAuthError(err));
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
    try {
      if (mode === 'login') {
        const user = await signInWithEmail(email, password);
        onAuthSuccessBanner(
          `Sesión iniciada en Firebase (${firebaseConfig.projectId}) como ${user.email}.`
        );
        onCloseModal();
      } else {
        const user = await registerWithEmail(email, password, displayName);
        onAuthSuccessBanner(
          `Cuenta creada y conectada a Firebase (${firebaseConfig.projectId}) como ${user.email}.`
        );
        onCloseModal();
      }
    } catch (err) {
      setErrorMsg(translateFirebaseAuthError(err));
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

  const handleLogout = async () => {
    setIsSubmitting(true);
    try {
      await signOutFirebase();
      onAuthSuccessBanner('Sesión de Firebase cerrada.');
      onCloseModal();
    } finally {
      setIsSubmitting(false);
    }
  };

  const cardContent = (
    <div className="w-full max-w-md bg-white border border-zinc-200/90 rounded-2xl p-6 sm:p-8 shadow-xl shadow-zinc-950/5 space-y-6 relative">
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
          <span>FIREBASE CLOUD · {firebaseConfig.projectId}</span>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-950">
          {currentUser
            ? 'Tu Cuenta y Sincronización'
            : mode === 'login'
            ? `Ingresar a ${appName}`
            : mode === 'register'
            ? `Crear cuenta en ${appName}`
            : 'Recuperar contraseña'}
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">
          {currentUser
            ? 'Tus clientes, rutas, cobros y equipos están vinculados con Firebase Auth y Cloud Firestore.'
            : slogan}
        </p>
      </div>

      {currentUser ? (
        /* Authenticated User Profile & Firestore Sync Controls */
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-display font-bold text-sm flex items-center justify-center shrink-0">
                {(
                  currentUser.displayName ||
                  currentUser.email ||
                  'U'
                )[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-zinc-900 truncate">
                  {currentUser.displayName || 'Cuenta Verificada'}
                </div>
                <div className="text-xs font-mono text-zinc-500 truncate">
                  {currentUser.email}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-200/80 flex items-center justify-between text-xs">
              <span className="text-zinc-500 font-medium">Proyecto Cloud:</span>
              <span className="font-mono font-semibold text-zinc-900">
                {firebaseConfig.projectId}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500 font-medium">Estado Firestore:</span>
              <span
                className={`font-semibold inline-flex items-center gap-1 ${
                  cloudSyncState === 'synced'
                    ? 'text-emerald-700'
                    : cloudSyncState === 'syncing'
                    ? 'text-amber-700'
                    : cloudSyncState === 'error'
                    ? 'text-red-600'
                    : 'text-zinc-700'
                }`}
              >
                {cloudSyncState === 'synced' && <Check className="w-3.5 h-3.5" />}
                {cloudSyncState === 'syncing' && (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>
                  {cloudSyncState === 'synced'
                    ? 'Sincronizado en tiempo real'
                    : cloudSyncState === 'syncing'
                    ? 'Sincronizando...'
                    : cloudSyncState === 'error'
                    ? 'Respaldo local activo'
                    : 'Conectado'}
                </span>
              </span>
            </div>

            {cloudSyncMessage && (
              <p className="text-[11px] text-zinc-500 bg-white p-2.5 rounded-lg border border-zinc-200/70">
                {cloudSyncMessage}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={onForceCloudSync}
              disabled={cloudSyncState === 'syncing'}
              className="flex-1 min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50"
            >
              <Cloud className="w-4 h-4 text-emerald-400" />
              <span>Guardar en Firestore Ahora</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isSubmitting}
              className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      ) : (
        /* Unauthenticated Login / Register Form */
        <div className="space-y-5">
          {/* Segmented Mode Switcher */}
          <div className="grid grid-cols-2 p-1 bg-zinc-100 rounded-xl">
            <button
              type="button"
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
              Crear Cuenta
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

          <form onSubmit={handleEmailSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <div>
                <label
                  htmlFor="auth-display-name"
                  className="block text-xs font-medium text-zinc-700 mb-1"
                >
                  Nombre o Emprendimiento
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-display-name"
                    type="text"
                    placeholder="Ej: Diego Hernández · PastoPro"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>
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
                  ? 'Crear Cuenta y Sincronizar'
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

          {/* Google OAuth & Instant Local Workspace Access */}
          <div className="space-y-2.5">
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
              className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-950 bg-zinc-100/80 hover:bg-zinc-200/70 rounded-xl transition-colors"
            >
              <span>Continuar en Modo Local (Sin cuenta)</span>
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
              {appName}
            </span>
          </div>
          <button
            type="button"
            onClick={onContinueLocalMode}
            className="text-xs font-semibold text-zinc-600 hover:text-zinc-950 px-3 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
          >
            Acceso rápido local →
          </button>
        </header>

        <main className="flex-1 flex items-center justify-center py-8">
          {cardContent}
        </main>

        <footer className="max-w-6xl w-full mx-auto text-center text-xs text-zinc-400 font-mono">
          Firebase Project: {firebaseConfig.projectId} · Gestión de rutas, clientes y caja
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
