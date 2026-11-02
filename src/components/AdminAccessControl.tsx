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
    <div className="min-h-screen bg-[#0B1512] text-slate-100 flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden">
      {/* Subtle architectural background grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(13, 148, 136, 0.28), transparent 45%), radial-gradient(circle at 80% 80%, rgba(5, 150, 105, 0.2), transparent 50%)',
        }}
      />

      {/* Top Bar */}
      <header className="relative z-10 max-w-4xl w-full mx-auto flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-400/30 flex items-center justify-center text-teal-300 font-bold">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs uppercase tracking-widest text-teal-400 font-bold block">
              Control de Acceso · Licencia de Pago Único
            </span>
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
              PastoPro Argentina
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-rose-500/20 border border-white/15 hover:border-rose-400/40 text-xs font-semibold text-white transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Cerrar Sesión</span>
        </button>
      </header>

      {/* Main Gate Card */}
      <main className="relative z-10 max-w-2xl w-full mx-auto my-auto py-6">
        <div className="bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden break-words">
          <div
            className={`px-5 sm:px-6 py-5 border-b flex items-center justify-between gap-3 ${
              approvalStatus === 'revoked'
                ? 'bg-rose-950 text-white border-rose-900'
                : 'bg-slate-900 text-white border-slate-800'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  approvalStatus === 'revoked'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                }`}
              >
                {approvalStatus === 'revoked' ? (
                  <ShieldAlert className="w-6 h-6" />
                ) : (
                  <Clock className="w-6 h-6" />
                )}
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">
                  {approvalStatus === 'revoked'
                    ? 'Estado: Acceso Revocado'
                    : 'Estado: Pendiente de Aprobación'}
                </span>
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight break-words">
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

      <footer className="relative z-10 max-w-4xl w-full mx-auto text-center text-xs text-slate-400 pt-4 border-t border-white/10">
        Soporte de Activación de Licencias · Administrador Principal:{' '}
        <span className="text-teal-300 font-mono">{PRIMARY_ADMIN_EMAIL}</span>
      </footer>
    </div>
  );
}

interface AdminControlPanelViewProps {
  currentUserEmail: string | null | undefined;
  onShowToast?: (msg: string) => void;
}

export function AdminControlPanelView({
  currentUserEmail,
  onShowToast,
}: AdminControlPanelViewProps) {
  const isAdmin = isPrimaryAdminEmail(currentUserEmail);
  const [users, setUsers] = useState<RegisteredTenantSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingUid, setProcessingUid] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending' | 'approved' | 'revoked'
  >('all');

  // Form to pre-register or add a client account manually
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newBusiness, setNewBusiness] = useState('');
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
              ? `Acceso APROBADO para ${target.email}`
              : `Acceso REVOCADO para ${target.email}`
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
    setShowAddForm(false);
    if (onShowToast) {
      onShowToast(
        `Cuenta ${cleanEmail} registrada (${newPreApprove ? 'Aprobada' : 'Pendiente'}).`
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
        u.city.toLowerCase().includes(q)
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
      <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center my-6">
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
    <div className="space-y-5" data-testid="admin-control-panel">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Panel Exclusivo de Administrador · Licencia Pago Único</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Control de Acceso y Aprobación Manual de Usuarios
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
            Todo nuevo usuario queda bloqueado en estado{' '}
            <strong className="text-amber-300">Pendiente de Aprobación</strong>{' '}
            hasta que valides su pago único y presiones{' '}
            <strong className="text-teal-300">Aprobar Acceso</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowAddForm((prev) => !prev)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Registrar / Pre-autorizar Cuenta</span>
          </button>

          <button
            type="button"
            onClick={loadAllUsers}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/15 text-xs font-semibold transition-colors cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
            />
            <span>Sincronizar Firestore</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Cuentas Registradas</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-extrabold font-mono text-slate-900 mt-1">
            {stats.total}
          </p>
          <span className="text-[11px] text-slate-500">
            Base multi-tenant Argentina
          </span>
        </div>

        <div className="bg-amber-50/70 rounded-2xl p-4 border border-amber-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-amber-900">
            <span>Pendientes de Pago</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-extrabold font-mono text-amber-900 mt-1">
            {stats.pending}
          </p>
          <span className="text-[11px] text-amber-800">
            Requieren aprobación manual
          </span>
        </div>

        <div className="bg-teal-50/70 rounded-2xl p-4 border border-teal-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-teal-900">
            <span>Licencias Aprobadas</span>
            <UserCheck className="w-4 h-4 text-teal-700" />
          </div>
          <p className="text-2xl font-extrabold font-mono text-teal-900 mt-1">
            {stats.approved}
          </p>
          <span className="text-[11px] text-teal-800">
            Acceso único habilitado
          </span>
        </div>

        <div className="bg-rose-50/70 rounded-2xl p-4 border border-rose-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-rose-900">
            <span>Accesos Revocados</span>
            <UserX className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-extrabold font-mono text-rose-900 mt-1">
            {stats.revoked}
          </p>
          <span className="text-[11px] text-rose-800">
            Bloqueados inmediatamente
          </span>
        </div>
      </div>

      {/* Collapsible Manual Registration / Pre-Authorization Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateManualAccountRecord}
          className="bg-white rounded-2xl p-5 border-2 border-teal-600/30 shadow-md space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Registrar o Pre-Autorizar Cliente en el Sistema
              </h3>
              <p className="text-xs text-slate-500">
                Podés cargar el correo de un jardinero comprador y definir si ingresa aprobado o pendiente.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Cerrar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
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
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
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
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
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
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
              />
            </div>

            <div>
              <CityAutocomplete
                id="admin-new-user-city"
                label="Ciudad / Localidad (Argentina)"
                value={newCity}
                onChange={setNewCity}
                onSelectCity={(sug) => setNewCity(sug.fullName)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={newPreApprove}
                onChange={(e) => setNewPreApprove(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span>
                Habilitar con pago validado inmediatamente (Aprobado)
              </span>
            </label>

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Guardar Cuenta en Registro</span>
            </button>
          </div>
        </form>
      )}

      {/* Search & Status Filters */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar usuario por email, nombre, empresa o ciudad de Argentina..."
            className="w-full pl-10 pr-3.5 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: `Todos (${stats.total})` },
              { id: 'pending', label: `Pendientes (${stats.pending})` },
              { id: 'approved', label: `Aprobados (${stats.approved})` },
              { id: 'revoked', label: `Revocados (${stats.revoked})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="divide-y divide-slate-200">
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No se encontraron cuentas con ese criterio de búsqueda.
            </div>
          ) : (
            filteredUsers.map((userItem) => {
              const isMasterAdmin = isPrimaryAdminEmail(userItem.email);
              const isBusy = processingUid === userItem.uid;

              return (
                <div
                  key={userItem.uid}
                  className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm sm:text-base font-extrabold text-slate-900 break-all">
                        {userItem.email}
                      </span>

                      {isMasterAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-900 text-teal-300">
                          <KeyRound className="w-3 h-3" />
                          <span>Administrador Principal</span>
                        </span>
                      ) : userItem.isApproved &&
                        userItem.approvalStatus === 'approved' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-teal-100 text-teal-900 border border-teal-300">
                          <CheckCircle2 className="w-3 h-3 text-teal-700" />
                          <span>Aprobado · Licencia Activa</span>
                        </span>
                      ) : userItem.approvalStatus === 'revoked' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                          <UserX className="w-3 h-3 text-rose-700" />
                          <span>Acceso Revocado</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-950 border border-amber-300">
                          <Clock className="w-3 h-3 text-amber-700" />
                          <span>Pendiente de Aprobación</span>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span>
                        <strong className="text-slate-800">Titular:</strong>{' '}
                        {userItem.displayName}
                      </span>
                      <span>
                        <strong className="text-slate-800">Empresa:</strong>{' '}
                        {userItem.businessName}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-teal-700" />
                        <span>{userItem.city}</span>
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        Alta: {userItem.registeredAt}
                      </span>
                    </div>
                  </div>

                  {/* Quick Action Buttons: Aprobar Acceso & Revocar Acceso */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {isMasterAdmin ? (
                      <span className="text-xs font-semibold text-slate-400 px-3 py-1.5 bg-slate-100 rounded-xl">
                        Cuenta Maestra Protegida
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={
                            isBusy ||
                            (userItem.isApproved &&
                              userItem.approvalStatus === 'approved')
                          }
                          onClick={() => handleToggleApproval(userItem, true)}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            userItem.isApproved &&
                            userItem.approvalStatus === 'approved'
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-teal-700 hover:bg-teal-800 text-white shadow-xs'
                          }`}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Aprobar Acceso</span>
                        </button>

                        <button
                          type="button"
                          disabled={
                            isBusy ||
                            (!userItem.isApproved &&
                              userItem.approvalStatus === 'revoked')
                          }
                          onClick={() => handleToggleApproval(userItem, false)}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            !userItem.isApproved &&
                            userItem.approvalStatus === 'revoked'
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>Revocar Acceso</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
