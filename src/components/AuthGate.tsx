import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Cloud,
  Compass,
  CreditCard,
  KeyRound,
  Leaf,
  LogIn,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  auth,
  registerWithEmail,
  sendPasswordReset,
  signInWithEmail,
  signInWithGooglePopup,
  upsertLocalTenantSummary,
  User,
} from '../firebase';
import { CityAutocomplete } from './StreetAddressAutocomplete';
import {
  getInitialAccessApprovalState,
  isPrimaryAdminEmail,
} from '../utils/saasLogic';
import { ApprovalStatus, UserRole } from '../types/lawn';

export interface AuthenticatedTenantSession {
  uid: string;
  email: string;
  displayName: string;
  businessName?: string;
  cityPresetKey?: string;
  isNewRegistration: boolean;
  role?: UserRole;
  isApproved?: boolean;
  approvalStatus?: ApprovalStatus;
  photoURL?: string | null;
}

interface AuthGateProps {
  currentUser: User | null;
  activeTenantSession: AuthenticatedTenantSession | null;
  isModalOpen: boolean;
  isFullScreenGate?: boolean;
  appName: string;
  slogan: string;
  cloudSyncState: 'idle' | 'syncing' | 'synced' | 'error' | 'offline-local';
  cloudSyncMessage: string | null;
  onCloseModal: () => void;
  onContinueLocalMode: () => void;
  onTenantAuthenticated: (
    session: AuthenticatedTenantSession
  ) => Promise<void> | void;
  onLogoutSession?: () => Promise<void> | void;
  onOpenWhiteLabelWizard?: () => void;
  onOpenSubscriptionModal?: () => void;
  onOpenAdminPanel?: () => void;
  onForceCloudSync?: () => Promise<void> | void;
  onAuthSuccessBanner: (msg: string) => void;
}

export function AuthGate({
  currentUser,
  activeTenantSession,
  isModalOpen,
  isFullScreenGate = false,
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
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('Venado Tuerto, Santa Fe');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  if (!isFullScreenGate && !isModalOpen) {
    return null;
  }

  const activeEmail = activeTenantSession?.email || currentUser?.email || null;
  const activeName =
    activeTenantSession?.displayName ||
    currentUser?.displayName ||
    activeEmail ||
    'Cuenta Demo';
  const isAdmin = isPrimaryAdminEmail(activeEmail);

  const buildSessionFromUser = (
    user: User,
    isNew: boolean
  ): AuthenticatedTenantSession => {
    const userEmail = user.email || email.trim() || 'usuario@pastopro.app';
    const initialApproval = getInitialAccessApprovalState(userEmail);
    return {
      uid: user.uid,
      email: userEmail,
      displayName:
        user.displayName ||
        fullName.trim() ||
        businessName.trim() ||
        userEmail.split('@')[0],
      businessName: businessName.trim() || undefined,
      cityPresetKey: city.trim() || 'Venado Tuerto, Santa Fe',
      isNewRegistration: isNew,
      role: initialApproval.role,
      isApproved: initialApproval.isApproved,
      approvalStatus: initialApproval.approvalStatus,
      photoURL: user.photoURL,
    };
  };

  const handleGoogleAccess = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setIsSubmitting(true);
    try {
      const user = await signInWithGooglePopup();
      const isNew = Boolean(
        user.metadata?.creationTime &&
          user.metadata?.lastSignInTime &&
          Math.abs(
            new Date(user.metadata.creationTime).getTime() -
              new Date(user.metadata.lastSignInTime).getTime()
          ) < 10000
      );

      const session = buildSessionFromUser(user, isNew);
      if (isNew) {
        const todayIso = new Date().toISOString().slice(0, 10);
        upsertLocalTenantSummary({
          uid: user.uid,
          email: session.email,
          displayName: session.displayName,
          businessName: session.businessName || 'Empresa de Servicios',
          city: city.trim() || 'Argentina',
          registeredAt: todayIso,
          updatedAt: todayIso,
          role: session.role || 'user',
          isApproved: Boolean(session.isApproved),
          approvalStatus: session.approvalStatus || 'pending',
        });
      }

      await onTenantAuthenticated(session);
      onAuthSuccessBanner(`Bienvenido, ${session.displayName}.`);
      if (!isFullScreenGate) onCloseModal();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setErrorMsg(
          'Se cerró la ventana antes de completar el inicio con Google.'
        );
      } else if (code === 'auth/unauthorized-domain') {
        setErrorMsg(
          'Dominio pendiente de autorización en Firebase. Podés ingresar con correo y contraseña o usar el Modo Demo.'
        );
      } else {
        setErrorMsg(
          'No se pudo iniciar con Google en este navegador. Probá con correo y contraseña o ingresá al Modo Demo.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg('Ingresá un correo electrónico válido.');
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
        setErrorMsg(
          'No pudimos enviar el correo de recuperación. Verificá que la dirección esté registrada.'
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
    try {
      if (mode === 'register') {
        const display =
          fullName.trim() || businessName.trim() || cleanEmail.split('@')[0];
        const user = await registerWithEmail(cleanEmail, password, display);
        const session = buildSessionFromUser(user, true);
        const todayIso = new Date().toISOString().slice(0, 10);
        upsertLocalTenantSummary({
          uid: user.uid,
          email: cleanEmail,
          displayName: display,
          businessName: businessName.trim() || display,
          city: city.trim() || 'Argentina',
          registeredAt: todayIso,
          updatedAt: todayIso,
          role: session.role || 'user',
          isApproved: Boolean(session.isApproved),
          approvalStatus: session.approvalStatus || 'pending',
        });
        await onTenantAuthenticated(session);
        onAuthSuccessBanner(`Cuenta registrada para ${display}.`);
        if (!isFullScreenGate) onCloseModal();
      } else {
        const user = await signInWithEmail(cleanEmail, password);
        const session = buildSessionFromUser(user, false);
        await onTenantAuthenticated(session);
        onAuthSuccessBanner(`Sesión iniciada (${cleanEmail}).`);
        if (!isFullScreenGate) onCloseModal();
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (isPrimaryAdminEmail(cleanEmail)) {
        setErrorMsg(
          'Acceso denegado: la cuenta de Administrador Principal requiere autenticación verificada con tu contraseña real o inicio de sesión oficial con Google.'
        );
        return;
      }
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password'
      ) {
        setErrorMsg(
          'Correo o contraseña incorrectos. Si todavía no tenés cuenta, seleccioná "Crear Cuenta".'
        );
      } else if (code === 'auth/email-already-in-use') {
        setErrorMsg(
          'Ese correo ya está registrado. Cambiá a "Iniciar Sesión" para entrar.'
        );
      } else {
        const fallbackUid = `local-${cleanEmail.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const fallbackSession: AuthenticatedTenantSession = {
          uid: fallbackUid,
          email: cleanEmail,
          displayName:
            fullName.trim() || businessName.trim() || cleanEmail.split('@')[0],
          businessName: businessName.trim() || undefined,
          cityPresetKey: city.trim() || 'Venado Tuerto, Santa Fe',
          isNewRegistration: mode === 'register',
          role: 'user',
          isApproved: false,
          approvalStatus: 'pending',
        };
        await onTenantAuthenticated(fallbackSession);
        onAuthSuccessBanner(
          `Espacio activado para ${fallbackSession.displayName}.`
        );
        if (!isFullScreenGate) onCloseModal();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // In-app Account & Cloud Sync modal while already inside the workspace
  if (!isFullScreenGate && isModalOpen && (currentUser || activeTenantSession)) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cuenta y Sincronización Cloud"
        className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
      >
        <div className="bg-white text-slate-900 border border-slate-200 rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
            <div className="min-w-0">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-emerald-600 block">
                Cuenta Activa · {appName}
              </span>
              <h2 className="font-display text-lg font-bold text-slate-900 mt-0.5 truncate">
                {activeName}
              </h2>
              <p className="text-xs text-slate-500 font-mono truncate">
                {activeEmail}
              </p>
            </div>
            <button
              type="button"
              onClick={onCloseModal}
              aria-label="Cerrar ventana de cuenta"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-emerald-600" />
                <span>Respaldo en la Nube</span>
              </span>
              <span className="font-mono font-bold text-emerald-600">
                {cloudSyncState === 'syncing' ? 'Sincronizando...' : 'Activo'}
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              {cloudSyncMessage ||
                'Tus clientes, hoja de ruta y comprobantes están guardados en tu espacio privado.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {onForceCloudSync && (
              <button
                type="button"
                onClick={() => onForceCloudSync()}
                className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                <span>Sincronizar Ahora</span>
              </button>
            )}

            {onOpenWhiteLabelWizard && (
              <button
                type="button"
                onClick={() => {
                  onCloseModal();
                  onOpenWhiteLabelWizard();
                }}
                className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold cursor-pointer transition-colors"
              >
                <Building2 className="w-3.5 h-3.5 text-slate-600" />
                <span>Marca y Tarifas</span>
              </button>
            )}

            {onOpenSubscriptionModal && (
              <button
                type="button"
                onClick={() => {
                  onCloseModal();
                  onOpenSubscriptionModal();
                }}
                className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold cursor-pointer transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5 text-slate-600" />
                <span>Estado de Licencia</span>
              </button>
            )}

            {isAdmin && onOpenAdminPanel && (
              <button
                type="button"
                onClick={() => {
                  onCloseModal();
                  onOpenAdminPanel();
                }}
                className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs cursor-pointer transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Consola Admin</span>
              </button>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onCloseModal}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
            >
              Cerrar ventana
            </button>

            {onLogoutSession && (
              <button
                type="button"
                onClick={() => {
                  onCloseModal();
                  onLogoutSession();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold cursor-pointer transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar Sesión</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        isFullScreenGate
          ? 'min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#F8FAFC] text-slate-900 flex flex-col justify-between items-center px-3 py-4 sm:px-6 sm:py-6 relative'
          : 'fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto'
      }
      data-testid={isFullScreenGate ? 'single-column-login-screen' : undefined}
    >
      {/* ====================================================================
          CLEAN ARCHITECTURAL SLATE GRID & SUBTLE AMBIENT GLOW
          Zero cartoon hills or clashing colors; crisp enterprise SaaS backdrop
          ==================================================================== */}
      {isFullScreenGate && (
        <div
          data-testid="login-artistic-gardening-bg"
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
        >
          <div
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                'radial-gradient(#CBD5E1 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(55% 45% at 50% 0%, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.02) 55%, transparent 100%)',
            }}
          />
        </div>
      )}

      {/* ====================================================================
          TOP BRAND HEADER BAR (No duplicate Demo button)
          ==================================================================== */}
      {isFullScreenGate && (
        <div className="w-full max-w-[1120px] mx-auto relative z-10 flex items-center justify-between gap-2 pb-3 border-b border-slate-200/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-2xs shrink-0">
              <Leaf className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <span className="font-display font-bold text-base tracking-tight text-slate-900 block leading-none">
                PastoPro
              </span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Sistema Operativo de Rutas GPS, Clientes y Finanzas
              </span>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-mono text-slate-600 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Plataforma Multi-Empresa</span>
          </div>
        </div>
      )}

      {/* ====================================================================
          CENTER ARCHITECTURAL LOGIN CARD (Single Demo Option, Zero Saved-Session Box)
          ==================================================================== */}
      <div className="w-full flex flex-col items-center justify-center relative z-10 my-auto py-4">
        <div
          data-testid="login-form-card"
          className="w-full max-w-[430px] bg-white rounded-2xl border border-slate-200 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.08)] overflow-hidden relative z-10 text-slate-900"
        >
          {/* Card Header */}
          <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-emerald-600">
                Acceso a tu Cuenta
              </span>

              {!isFullScreenGate && (
                <button
                  type="button"
                  onClick={onCloseModal}
                  aria-label="Cerrar"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <h1 className="font-display text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              {mode === 'login' && 'Iniciar Sesión en PastoPro'}
              {mode === 'register' && 'Crear Cuenta de Empresa'}
              {mode === 'reset' && 'Recuperar Contraseña'}
            </h1>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {mode === 'login' &&
                'Ingresá a tu panel para gestionar hojas de ruta GPS, clientes, presupuestos y cobros.'}
              {mode === 'register' &&
                'Configurá tu ciudad operativa, tarifas por m² y cartera de clientes.'}
              {mode === 'reset' &&
                'Ingresá tu correo electrónico para recibir un enlace de recuperación.'}
            </p>
          </div>

          {/* Card Body */}
          <div className="p-5 sm:p-6 space-y-4">
            {mode !== 'reset' && (
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/70">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    mode === 'login'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
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
                  className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    mode === 'register'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Crear Cuenta
                </button>
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium break-words">
                  {errorMsg}
                </span>
              </div>
            )}

            {infoMsg && (
              <div
                role="status"
                className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium break-words">
                  {infoMsg}
                </span>
              </div>
            )}

            <form onSubmit={handleEmailSubmit} className="space-y-3">
              {mode === 'register' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="auth-fullname"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Nombre y Apellido
                      </label>
                      <input
                        id="auth-fullname"
                        type="text"
                        required
                        placeholder="Ej. Martín Gómez"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="auth-business"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Empresa / Marca
                      </label>
                      <div className="relative">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id="auth-business"
                          type="text"
                          required
                          placeholder="Ej. Parques del Sur"
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <CityAutocomplete
                      id="auth-city"
                      label="Ciudad o Localidad Operativa"
                      value={city}
                      onChange={setCity}
                      onSelectCity={(sug) => {
                        setCity(sug.fullName);
                      }}
                      helperText="Escribí tu ciudad (ej. 'Venado', 'Rosario', 'Pilar') para centrar el mapa."
                    />
                  </div>
                </>
              )}

              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-xs font-semibold text-slate-700 mb-1"
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
                    placeholder="nombre@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              {mode !== 'reset' && (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
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
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                      >
                        ¿Olvidaste tu clave?
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
                        mode === 'register'
                          ? 'new-password'
                          : 'current-password'
                      }
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="magnetic-cta w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                {mode === 'login' && (
                  <>
                    <LogIn className="w-4 h-4 text-emerald-400" />
                    <span>
                      {isSubmitting ? 'Verificando...' : 'Ingresar a mi Cuenta'}
                    </span>
                  </>
                )}
                {mode === 'register' && (
                  <>
                    <UserPlus className="w-4 h-4 text-emerald-400" />
                    <span>
                      {isSubmitting ? 'Creando cuenta...' : 'Crear Cuenta'}
                    </span>
                  </>
                )}
                {mode === 'reset' && (
                  <>
                    <span>
                      {isSubmitting
                        ? 'Enviando enlace...'
                        : 'Enviar enlace de recuperación'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {mode === 'reset' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  className="w-full py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Volver a Iniciar Sesión
                </button>
              )}
            </form>

            {mode !== 'reset' && (
              <div>
                <button
                  type="button"
                  onClick={handleGoogleAccess}
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    className="w-4 h-4 shrink-0"
                    aria-hidden="true"
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>Continuar con Google</span>
                </button>
              </div>
            )}

            {/* Single, Clean Secondary Demo Option at the Bottom */}
            <div className="pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onContinueLocalMode}
                data-testid="continue-local-mode-btn"
                className="w-full py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 font-semibold text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors group"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Compass className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">
                    Explorar Modo Demo Interactivo
                  </span>
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            </div>

            {!auth.currentUser && (
              <div className="hidden" aria-hidden="true">
                Firebase Auth Ready
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ====================================================================
          LOWER HORIZON FOOTER
          ==================================================================== */}
      {isFullScreenGate && (
        <div className="w-full max-w-[1120px] mx-auto relative z-10 pt-2.5 flex flex-wrap items-center justify-center sm:justify-between gap-2 text-[11px] text-slate-500 font-medium text-center">
          <span>Hoja de Ruta GPS · Evidencia Antes y Después · Recibos PDF</span>
          <span className="hidden sm:inline text-slate-400">
            PastoPro · Sistema de Gestión Operativa
          </span>
        </div>
      )}
    </div>
  );
}
