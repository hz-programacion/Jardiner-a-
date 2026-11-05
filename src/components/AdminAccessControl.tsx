import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  KeyRound,
  Lock,
  LogOut,
  MapPin,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from 'lucide-react';
import {
  ApprovalStatus,
  RegisteredTenantSummary,
  TenantSubscriptionConfig,
} from '../types/lawn';
import { buildSafeWhatsAppUrl, getTodayIsoLocal } from '../utils/lawnLogic';
import {
  buildMercadoPagoSinglePaymentUrl,
  DEFAULT_SINGLE_LICENSE_CONFIG,
  hasValidCustomMercadoPagoLink,
  isPrimaryAdminEmail,
  PENDING_APPROVAL_BLOCK_MESSAGE,
  PRIMARY_ADMIN_EMAIL,
} from '../utils/saasLogic';
import {
  auth,
  listAllWorkspacesForAdmin,
  updateUserApprovalByAdmin,
  upsertLocalTenantSummary,
} from '../firebase';
import { CityAutocomplete } from './StreetAddressAutocomplete';

interface PendingApprovalScreenProps {
  userUid: string;
  userEmail: string;
  userName: string;
  businessName: string;
  city: string;
  approvalStatus: ApprovalStatus;
  subscription: TenantSubscriptionConfig;
  onRefreshApprovalStatus: () => Promise<void>;
  onSignOut: () => void;
}

export function PendingApprovalScreen({
  userUid,
  userEmail,
  userName,
  businessName,
  city,
  approvalStatus,
  subscription,
  onRefreshApprovalStatus,
  onSignOut,
}: PendingApprovalScreenProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckMsg, setLastCheckMsg] = useState('');
  const [copiedAlias, setCopiedAlias] = useState(false);

  const licensePrice =
    subscription?.singleLicensePriceArs ||
    DEFAULT_SINGLE_LICENSE_CONFIG.singleLicensePriceArs;
  const hasCustomMp = hasValidCustomMercadoPagoLink(subscription?.mpCheckoutUrl);
  const mpUrl = buildMercadoPagoSinglePaymentUrl(subscription, userEmail);
  const adminPhone =
    subscription?.sellerWhatsapp || DEFAULT_SINGLE_LICENSE_CONFIG.sellerWhatsapp;
  const activeAlias =
    subscription?.sellerAlias || DEFAULT_SINGLE_LICENSE_CONFIG.sellerAlias;
  const activeCbu =
    subscription?.sellerCbu || DEFAULT_SINGLE_LICENSE_CONFIG.sellerCbu;

  const whatsappActivationUrl = buildSafeWhatsAppUrl(
    adminPhone,
    `Hola Administrador (${PRIMARY_ADMIN_EMAIL}), registré mi cuenta en PastoPro y solicito la activación de mi Licencia de Acceso Único ($${licensePrice.toLocaleString('es-AR')} ARS al alias ${activeAlias}).\n\n• Correo: ${userEmail}\n• Empresa: ${businessName}\n• Localidad: ${city}\n• ID Cuenta: ${userUid}`
  );

  const handleCopyAlias = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(activeAlias);
      }
    } catch {
      // ignore
    }
    setCopiedAlias(true);
    setLastCheckMsg(
      `✓ Alias "${activeAlias}" copiado. Abrí Mercado Pago, elegí "Transferir", pegá el alias y luego enviá el comprobante por WhatsApp.`
    );
    setTimeout(() => setCopiedAlias(false), 3500);
  };

  const handleManualCheck = async () => {
    setIsChecking(true);
    setLastCheckMsg('');
    try {
      await onRefreshApprovalStatus();
      setLastCheckMsg(
        'Estado consultado. Tu cuenta aún figura pendiente de aprobación por el administrador.'
      );
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-architectural-grid text-slate-900 flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden">
      <div className="fixed top-0 inset-x-0 h-1 bg-slate-900 z-20" />

      {/* Top Bar */}
      <header className="relative z-10 max-w-4xl w-full mx-auto flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-bold">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs uppercase tracking-widest text-blue-600 font-bold block">
              Control de Acceso · Licencia de Pago Único
            </span>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              PastoPro Argentina
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-xs font-semibold text-slate-700 hover:text-rose-700 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Cerrar Sesión</span>
        </button>
      </header>

      {/* Main Gate Card */}
      <main className="relative z-10 max-w-2xl w-full mx-auto my-auto py-6">
        <div className="bg-white text-slate-900 rounded-2xl shadow-lg border border-slate-200/90 overflow-hidden break-words">
          <div
            className={`px-5 sm:px-6 py-5 border-b flex items-center justify-between gap-3 ${
              approvalStatus === 'revoked'
                ? 'bg-rose-50 text-rose-950 border-rose-200'
                : 'bg-slate-50 text-slate-900 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  approvalStatus === 'revoked'
                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                    : 'bg-amber-100 text-amber-700 border border-amber-200'
                }`}
              >
                {approvalStatus === 'revoked' ? (
                  <ShieldAlert className="w-6 h-6" />
                ) : (
                  <Clock className="w-6 h-6" />
                )}
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
                  {approvalStatus === 'revoked'
                    ? 'Estado: Acceso Revocado'
                    : 'Estado: Pendiente de Aprobación'}
                </span>
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 break-words">
                  Validación de Licencia Requerida
                </h2>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-8 space-y-6">
            {/* Mandatory exact blocking alert */}
            <div
              role="alert"
              data-testid="pending-approval-alert"
              className="p-4 sm:p-5 rounded-2xl bg-amber-50 border-2 border-amber-300/90 text-amber-950 flex items-start gap-3.5"
            >
              <AlertTriangle className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <p className="text-sm sm:text-base font-extrabold leading-snug text-amber-950 break-words">
                  {PENDING_APPROVAL_BLOCK_MESSAGE}
                </p>
                <p className="text-xs text-amber-900/80 leading-relaxed">
                  Tu cuenta fue registrada correctamente y tus datos están aislados de forma segura, pero el acceso al menú operativo requiere la aprobación del administrador tras validar tu pago único.
                </p>
              </div>
            </div>

            {/* User Account & Official Mercado Pago Alias Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
              <div className="min-w-0">
                <span className="text-slate-500 font-medium block">
                  Correo de la Cuenta
                </span>
                <span className="font-bold text-slate-900 break-all">
                  {userEmail}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-slate-500 font-medium block">
                  Titular / Empresa
                </span>
                <span className="font-bold text-slate-900 break-words">
                  {userName} · {businessName}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-slate-500 font-medium block">
                  Alias Mercado Pago Oficial
                </span>
                <span className="font-mono font-extrabold text-teal-800 break-all">
                  {activeAlias} (CVU: {activeCbu})
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-slate-500 font-medium block">
                  Valor Licencia Definitiva (Pago Único)
                </span>
                <span className="font-mono font-extrabold text-teal-800">
                  ${licensePrice.toLocaleString('es-AR')} ARS
                </span>
              </div>
            </div>

            {/* Step-by-step activation actions */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Pasos para habilitar tu cuenta ahora
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {hasCustomMp ? (
                  <a
                    href={mpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold shadow-sm transition-colors text-center break-words"
                  >
                    <ExternalLink className="w-4 h-4 shrink-0 text-teal-400" />
                    <span>1. Abonar Pago Único (Mercado Pago)</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={handleCopyAlias}
                    className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold shadow-sm transition-colors text-center cursor-pointer break-words"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-teal-400" />
                    <span>
                      {copiedAlias
                        ? `✓ Alias ${activeAlias} Copiado`
                        : `1. Copiar Alias MP (${activeAlias})`}
                    </span>
                  </button>
                )}

                <a
                  href={whatsappActivationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-bold shadow-sm transition-colors text-center break-words"
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span>2. Enviar Comprobante al Admin</span>
                </a>
              </div>

              <button
                type="button"
                onClick={handleManualCheck}
                disabled={isChecking}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs sm:text-sm font-bold transition-colors cursor-pointer disabled:opacity-60 text-center break-words"
              >
                <RefreshCw
                  className={`w-4 h-4 shrink-0 ${isChecking ? 'animate-spin' : ''}`}
                />
                <span>
                  {isChecking
                    ? 'Verificando autorización en Cloud Firestore...'
                    : 'Ya me aprobaron · Verificar estado de mi cuenta'}
                </span>
              </button>

              {lastCheckMsg && (
                <p className="text-xs font-semibold text-center text-slate-700 bg-teal-50 border border-teal-200 py-2.5 px-3 rounded-xl break-words">
                  {lastCheckMsg}
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 max-w-4xl w-full mx-auto text-center text-xs text-slate-500 pt-4 border-t border-slate-200">
        Soporte de Activación de Licencias · Administrador Principal:{' '}
        <span className="text-slate-900 font-mono font-semibold">{PRIMARY_ADMIN_EMAIL}</span>
      </footer>
    </div>
  );
}

interface AdminControlPanelViewProps {
  currentUserEmail: string | null | undefined;
  onShowToast?: (msg: string) => void;
  onNavigateToApp?: () => void;
}

export function AdminControlPanelView({
  currentUserEmail,
  onShowToast,
  onNavigateToApp,
}: AdminControlPanelViewProps) {
  const isAdmin = Boolean(
    auth.currentUser &&
      isPrimaryAdminEmail(auth.currentUser.email) &&
      isPrimaryAdminEmail(currentUserEmail)
  );
  const [users, setUsers] = useState<RegisteredTenantSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingUid, setProcessingUid] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending' | 'approved' | 'revoked'
  >('all');

  // Active user conversation / request drawer state
  const [activeChatUid, setActiveChatUid] = useState<string | null>(null);
  const [chatMessageDraft, setChatMessageDraft] = useState('');
  const [adminNoteDraft, setAdminNoteDraft] = useState('');
  const [userPhoneDraft, setUserPhoneDraft] = useState('');

  // Form to pre-register or add a client account manually
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newBusiness, setNewBusiness] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRequestMsg, setNewRequestMsg] = useState('');
  const [newCity, setNewCity] = useState('Rosario, Santa Fe');
  const [newPreApprove, setNewPreApprove] = useState(false);

  const loadAllUsers = async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    try {
      const list = await listAllWorkspacesForAdmin();
      setUsers(list);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllUsers();
  }, [isAdmin]);

  const handleOpenChatForUser = (u: RegisteredTenantSummary) => {
    if (activeChatUid === u.uid) {
      setActiveChatUid(null);
      return;
    }
    setActiveChatUid(u.uid);
    setAdminNoteDraft(u.adminNotes || '');
    setUserPhoneDraft(u.phone || '');
    const defaultReply =
      u.approvalStatus === 'pending'
        ? `Hola ${u.displayName}! Vi tu solicitud de acceso en PastoPro para "${u.businessName}" (${u.city}). Te escribo para coordinar la activación de tu licencia y darte permiso de uso.`
        : u.approvalStatus === 'approved'
        ? `Hola ${u.displayName}! Tu cuenta de PastoPro para "${u.businessName}" ya tiene el permiso aprobado y activo. Avisame cualquier consulta.`
        : `Hola ${u.displayName}, te contacto desde la administración de PastoPro por el estado de tu cuenta (${u.email}).`;
    setChatMessageDraft(defaultReply);
  };

  const handleSaveUserNotesAndPhone = (target: RegisteredTenantSummary) => {
    const updated: RegisteredTenantSummary = {
      ...target,
      phone: userPhoneDraft.trim(),
      adminNotes: adminNoteDraft.trim(),
      updatedAt: getTodayIsoLocal(),
    };
    const nextList = upsertLocalTenantSummary(updated);
    setUsers(nextList);
    if (onShowToast) {
      onShowToast(`Datos de seguimiento guardados para ${target.displayName}.`);
    }
  };

  const handleToggleApproval = async (
    target: RegisteredTenantSummary,
    approve: boolean
  ) => {
    if (!isAdmin) return;
    if (isPrimaryAdminEmail(target.email)) {
      if (onShowToast) {
        onShowToast('La cuenta del Administrador Principal no puede revocarse.');
      }
      return;
    }

    setProcessingUid(target.uid);
    try {
      const res = await updateUserApprovalByAdmin(
        target.uid,
        approve,
        target.email
      );
      if (res.ok) {
        const refreshed = await listAllWorkspacesForAdmin();
        setUsers(refreshed);
        if (onShowToast) {
          onShowToast(
            approve
              ? `Permiso de uso APROBADO para ${target.displayName} (${target.email})`
              : `Permiso de uso REVOCADO para ${target.displayName} (${target.email})`
          );
        }
      }
    } finally {
      setProcessingUid(null);
    }
  };

  const handleCreateManualAccountRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) return;

    const uid = `user-${cleanEmail.replace(/[^a-z0-9]/g, '').slice(0, 14)}-${Date.now().toString().slice(-4)}`;
    const summary: RegisteredTenantSummary = {
      uid,
      email: cleanEmail,
      displayName: newName.trim() || cleanEmail.split('@')[0],
      businessName: newBusiness.trim() || 'Servicio de Jardinería',
      city: newCity.trim() || 'Venado Tuerto, Santa Fe',
      phone: newPhone.trim(),
      requestMessage:
        newRequestMsg.trim() ||
        'Solicitud cargada manualmente por el administrador.',
      registeredAt: getTodayIsoLocal(),
      updatedAt: getTodayIsoLocal(),
      isApproved: newPreApprove,
      approvalStatus: newPreApprove ? 'approved' : 'pending',
      role: isPrimaryAdminEmail(cleanEmail) ? 'admin' : 'user',
      licenseStatus: newPreApprove ? 'active' : 'trialing',
      planId: newPreApprove ? 'single_payment_license' : 'evaluation',
    };

    upsertLocalTenantSummary(summary);
    await updateUserApprovalByAdmin(uid, newPreApprove, cleanEmail);
    const refreshed = await listAllWorkspacesForAdmin();
    setUsers(refreshed);

    setNewEmail('');
    setNewName('');
    setNewBusiness('');
    setNewPhone('');
    setNewRequestMsg('');
    setShowAddForm(false);
    if (onShowToast) {
      onShowToast(
        `Cuenta ${cleanEmail} registrada (${newPreApprove ? 'Permiso Aprobado' : 'Pendiente de Permiso'}).`
      );
    }
  };

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter === 'pending' && u.approvalStatus !== 'pending') {
        return false;
      }
      if (statusFilter === 'approved' && u.approvalStatus !== 'approved') {
        return false;
      }
      if (statusFilter === 'revoked' && u.approvalStatus !== 'revoked') {
        return false;
      }
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        u.businessName.toLowerCase().includes(q) ||
        u.city.toLowerCase().includes(q) ||
        (u.phone && u.phone.toLowerCase().includes(q))
      );
    });
  }, [users, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = users.length;
    const pending = users.filter((u) => u.approvalStatus === 'pending').length;
    const approved = users.filter(
      (u) => u.approvalStatus === 'approved'
    ).length;
    const revoked = users.filter((u) => u.approvalStatus === 'revoked').length;
    return { total, pending, approved, revoked };
  }, [users]);

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-xl border border-rose-200 p-8 text-center my-6">
        <ShieldAlert className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">
          Acceso Restringido al Administrador Principal
        </h2>
        <p className="text-xs text-slate-600 mt-1">
          Esta sección está protegida exclusivamente para la cuenta{' '}
          <span className="font-mono font-bold">{PRIMARY_ADMIN_EMAIL}</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="admin-control-panel">
      {/* Cabecera Unificada de Control de Accesos, Solicitudes y Permisos */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Gobierno de Plataforma · Control de Usuarios</span>
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900">
              Solicitudes de Uso, Permisos y Contacto con Usuarios
            </h2>
            <p className="text-xs text-slate-500 max-w-2xl">
              Revisá las solicitudes entrantes, charlá directamente por WhatsApp o correo con cada interesado y aprobá o revocá su permiso de acceso en tiempo real.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAddForm((prev) => !prev)}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
              <span>+ Cargar / Pre-autorizar Usuario</span>
            </button>

            <button
              type="button"
              onClick={loadAllUsers}
              disabled={isLoading}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
              />
              <span>Actualizar</span>
            </button>

            {onNavigateToApp && (
              <button
                type="button"
                onClick={onNavigateToApp}
                className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Ir a Hoja de Ruta</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 KPIs Limpios */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/50">
          <div className="p-3.5 sm:px-5">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-amber-700">
              <span>Solicitudes Pendientes</span>
              <Clock className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <p className="font-display text-2xl font-bold font-mono text-amber-700 mt-1">
              {stats.pending}
            </p>
            <span className="text-[11px] text-slate-500">
              Esperando tu permiso de uso
            </span>
          </div>

          <div className="p-3.5 sm:px-5">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
              <span>Permisos Aprobados</span>
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="font-display text-2xl font-bold font-mono text-emerald-700 mt-1">
              {stats.approved}
            </p>
            <span className="text-[11px] text-slate-500">
              Cuentas con acceso activo
            </span>
          </div>

          <div className="p-3.5 sm:px-5">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-rose-700">
              <span>Accesos Revocados</span>
              <UserX className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <p className="font-display text-2xl font-bold font-mono text-rose-700 mt-1">
              {stats.revoked}
            </p>
            <span className="text-[11px] text-slate-500">
              Sin acceso al sistema
            </span>
          </div>

          <div className="p-3.5 sm:px-5">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <span>Total Registrados</span>
              <Users className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <p className="font-display text-2xl font-bold font-mono text-slate-900 mt-1">
              {stats.total}
            </p>
            <span className="text-[11px] text-slate-500">
              Empresas en la plataforma
            </span>
          </div>
        </div>

        {/* Barra de Búsqueda y Filtros de Estado */}
        <div className="px-4 sm:px-5 py-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, correo, WhatsApp, empresa o ciudad..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
            {(
              [
                { id: 'all', label: `Todos (${stats.total})` },
                { id: 'pending', label: `Solicitudes Pendientes (${stats.pending})` },
                { id: 'approved', label: `Con Permiso (${stats.approved})` },
                { id: 'revoked', label: `Revocados (${stats.revoked})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Formulario Desplegable para Pre-autorizar o Cargar Solicitud */}
      {showAddForm && (
        <form
          onSubmit={handleCreateManualAccountRecord}
          className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Registrar o Pre-Autorizar Usuario Manualmente
              </h3>
              <p className="text-xs text-slate-500">
                Cargá los datos de un cliente interesado y definí si entra con permiso activo o en revisión.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Cerrar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Correo Electrónico *
              </label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="cliente@ejemplo.com"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre del Titular
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej. Carlos Gómez"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                WhatsApp de Contacto
              </label>
              <input
                type="text"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Ej. +54 9 341 555-1234"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre del Negocio
              </label>
              <input
                type="text"
                value={newBusiness}
                onChange={(e) => setNewBusiness(e.target.value)}
                placeholder="Ej. Parques del Litoral"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <div>
              <CityAutocomplete
                id="admin-new-user-city"
                label="Ciudad / Localidad"
                value={newCity}
                onChange={setNewCity}
                onSelectCity={(sug) => setNewCity(sug.fullName)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nota o Motivo de Solicitud
              </label>
              <input
                type="text"
                value={newRequestMsg}
                onChange={(e) => setNewRequestMsg(e.target.value)}
                placeholder="Ej. Consultó por Instagram, quiere probar"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={newPreApprove}
                onChange={(e) => setNewPreApprove(e.target.checked)}
                className="rounded border-slate-300 text-slate-900"
              />
              <span>Habilitar con permiso aprobado inmediatamente</span>
            </label>

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Guardar Usuario</span>
            </button>
          </div>
        </form>
      )}

      {/* Listado de Usuarios, Solicitudes de Uso y Conversación Directa */}
      <div className="space-y-3">
        {filteredUsers.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
            No se encontraron solicitudes ni usuarios con ese filtro.
          </div>
        ) : (
          filteredUsers.map((userItem) => {
            const isMasterAdmin = isPrimaryAdminEmail(userItem.email);
            const isBusy = processingUid === userItem.uid;
            const isChatOpen = activeChatUid === userItem.uid;

            const directWaText =
              userItem.approvalStatus === 'pending'
                ? `Hola ${userItem.displayName}! Soy el administrador de PastoPro. Recibí tu solicitud de acceso para "${userItem.businessName}" (${userItem.city}). ¿Cómo estás?`
                : `Hola ${userItem.displayName}! Te escribo desde PastoPro por tu cuenta activa de "${userItem.businessName}".`;

            const directWaUrl = buildSafeWhatsAppUrl(
              userItem.phone || '5493462551234',
              directWaText
            );

            return (
              <div
                key={userItem.uid}
                data-testid="admin-user-request-card"
                className={`bg-white rounded-xl border transition-all shadow-2xs overflow-hidden ${
                  userItem.approvalStatus === 'pending'
                    ? 'border-amber-300/90'
                    : 'border-slate-200'
                }`}
              >
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Columna Izquierda: Identidad + Solicitud de Uso */}
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm sm:text-base font-bold text-slate-900">
                        {userItem.displayName}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        · {userItem.businessName}
                      </span>

                      {isMasterAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900 text-emerald-400">
                          <KeyRound className="w-3 h-3" />
                          <span>Administrador Principal</span>
                        </span>
                      ) : userItem.isApproved &&
                        userItem.approvalStatus === 'approved' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Permiso Aprobado</span>
                        </span>
                      ) : userItem.approvalStatus === 'revoked' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <UserX className="w-3 h-3 text-rose-600" />
                          <span>Permiso Revocado</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Solicitud Pendiente de Permiso</span>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span className="font-mono text-slate-800 font-medium break-all">
                        {userItem.email}
                      </span>
                      {userItem.phone && (
                        <span className="font-mono text-emerald-700 font-semibold">
                          WA: {userItem.phone}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{userItem.city}</span>
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        Alta: {userItem.registeredAt}
                      </span>
                    </div>

                    {/* Mensaje de Solicitud de Uso */}
                    {!isMasterAdmin && (
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-700 flex flex-col gap-1">
                        <div>
                          <span className="font-semibold text-slate-900">
                            Solicitud de uso:{' '}
                          </span>
                          <span>
                            {userItem.requestMessage ||
                              'Solicita activación de permiso para utilizar PastoPro en su empresa.'}
                          </span>
                        </div>
                        {userItem.adminNotes && (
                          <div className="text-[11px] text-emerald-800 font-medium pt-1 border-t border-slate-200/60">
                            <strong>Nota Admin:</strong> {userItem.adminNotes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Columna Derecha: Botones para Charlar Solicitud y Dar/Revocar Permiso */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {isMasterAdmin ? (
                      <span className="text-xs font-semibold text-slate-500 px-3 py-1.5 bg-slate-100 rounded-lg">
                        Cuenta Maestra Activa
                      </span>
                    ) : (
                      <>
                        {/* 1. Charlar por WhatsApp directo */}
                        <a
                          href={directWaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid={`whatsapp-user-${userItem.uid}`}
                          className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Charlar por WhatsApp</span>
                        </a>

                        {/* 2. Abrir panel de Respuesta / Notas */}
                        <button
                          type="button"
                          onClick={() => handleOpenChatForUser(userItem)}
                          data-testid={`open-chat-drawer-${userItem.uid}`}
                          className={`min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                            isChatOpen
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span>{isChatOpen ? 'Cerrar Chat' : 'Responder / Notas'}</span>
                        </button>

                        {/* 3. Dar Permiso (Aprobar Acceso) */}
                        <button
                          type="button"
                          data-testid={`approve-user-${userItem.uid}`}
                          disabled={
                            isBusy ||
                            (userItem.isApproved &&
                              userItem.approvalStatus === 'approved')
                          }
                          onClick={() => handleToggleApproval(userItem, true)}
                          className={`min-h-[34px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            userItem.isApproved &&
                            userItem.approvalStatus === 'approved'
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-slate-900 hover:bg-slate-800 text-white shadow-2xs'
                          }`}
                        >
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Dar Permiso</span>
                        </button>

                        {/* 4. Revocar Permiso */}
                        <button
                          type="button"
                          data-testid={`revoke-user-${userItem.uid}`}
                          disabled={
                            isBusy ||
                            (!userItem.isApproved &&
                              userItem.approvalStatus === 'revoked')
                          }
                          onClick={() => handleToggleApproval(userItem, false)}
                          className={`min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            !userItem.isApproved &&
                            userItem.approvalStatus === 'revoked'
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>Revocar</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Panel Desplegable para Charlar la Solicitud de Uso y Guardar Seguimiento */}
                {isChatOpen && !isMasterAdmin && (
                  <div
                    data-testid="admin-request-conversation-panel"
                    className="px-4 sm:px-5 py-4 bg-slate-50 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-12 gap-4"
                  >
                    <div className="lg:col-span-7 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          Mensaje para charlar solicitud con {userItem.displayName}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setChatMessageDraft(
                                `Hola ${userItem.displayName}! Recibí tu solicitud en PastoPro para "${userItem.businessName}". El valor de la licencia única es de $${DEFAULT_SINGLE_LICENSE_CONFIG.singleLicensePriceArs.toLocaleString('es-AR')} ARS (Alias MP: ${DEFAULT_SINGLE_LICENSE_CONFIG.sellerAlias}). En cuanto me pases el comprobante te habilito el permiso en el acto!`
                              )
                            }
                            className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            Pasar Alias MP
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setChatMessageDraft(
                                `Hola ${userItem.displayName}! Ya te di el permiso de acceso en PastoPro para tu cuenta (${userItem.email}). Ya podés entrar y configurar tu negocio!`
                              )
                            }
                            className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                          >
                            Confirmar Permiso
                          </button>
                        </div>
                      </div>

                      <textarea
                        rows={3}
                        value={chatMessageDraft}
                        onChange={(e) => setChatMessageDraft(e.target.value)}
                        className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />

                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={buildSafeWhatsAppUrl(
                            userPhoneDraft || userItem.phone || '5493462551234',
                            chatMessageDraft
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[34px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Enviar por WhatsApp</span>
                        </a>

                        <a
                          href={`mailto:${userItem.email}?subject=${encodeURIComponent(
                            `Solicitud de Acceso PastoPro — ${userItem.businessName}`
                          )}&body=${encodeURIComponent(chatMessageDraft)}`}
                          className="min-h-[34px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold"
                        >
                          <span>Enviar por Correo ({userItem.email})</span>
                        </a>
                      </div>
                    </div>

                    <div className="lg:col-span-5 space-y-2.5 lg:border-l lg:border-slate-200 lg:pl-4">
                      <span className="text-xs font-bold text-slate-900 block">
                        Teléfono y Nota Interna del Administrador
                      </span>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
                          WhatsApp del usuario
                        </label>
                        <input
                          type="text"
                          value={userPhoneDraft}
                          onChange={(e) => setUserPhoneDraft(e.target.value)}
                          placeholder="+54 9 341 ..."
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
                          Nota de seguimiento (acuerdos, pago, fecha)
                        </label>
                        <input
                          type="text"
                          value={adminNoteDraft}
                          onChange={(e) => setAdminNoteDraft(e.target.value)}
                          placeholder="Ej. Prometió transferir hoy a la tarde..."
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSaveUserNotesAndPhone(userItem)}
                        className="min-h-[32px] w-full inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                      >
                        Guardar Teléfono y Nota
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
