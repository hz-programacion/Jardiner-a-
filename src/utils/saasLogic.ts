import { ARGENTINA_CITIES_CATALOG, CITY_PRESETS } from '../data/seedData';
import {
  ApprovalStatus,
  BaseLocationConfig,
  BusinessProfileConfig,
  ClientProperty,
  EquipmentItem,
  InvoiceRecord,
  OperationalExpense,
  PaymentProfileConfig,
  ScheduledJob,
  SubscriptionPlanId,
  TenantSubscriptionConfig,
  UserRole,
} from '../types/lawn';
import { getTodayIsoLocal, normalizeSearchText } from './lawnLogic';

/**
 * Primary Administrator Email protected across Auth, UI, and Cloud Firestore Security Rules.
 */
export const PRIMARY_ADMIN_EMAIL = 'hz.mdiego@gmail.com';

/**
 * Mandatory blocking message shown to authenticated users whose account has not yet been approved by the Administrator.
 */
export const PENDING_APPROVAL_BLOCK_MESSAGE =
  'Cuenta pendiente de validación de pago. Por favor, comunícate con el administrador para activar tu licencia de acceso único.';

export function isPrimaryAdminEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  return email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase();
}

export function getInitialAccessApprovalState(email?: string | null): {
  isApproved: boolean;
  approvalStatus: ApprovalStatus;
  role: UserRole;
} {
  if (isPrimaryAdminEmail(email)) {
    return {
      isApproved: true,
      approvalStatus: 'approved',
      role: 'admin',
    };
  }
  return {
    isApproved: false,
    approvalStatus: 'pending',
    role: 'user',
  };
}

export interface TenantWorkspaceBundle {
  businessProfile: BusinessProfileConfig;
  baseLocation: BaseLocationConfig;
  paymentProfile: PaymentProfileConfig;
  subscription: TenantSubscriptionConfig;
  isApproved: boolean;
  approvalStatus: ApprovalStatus;
  role: UserRole;
  registeredAt: string;
  properties: ClientProperty[];
  todayJobs: ScheduledJob[];
  invoices: InvoiceRecord[];
  expenses: OperationalExpense[];
  equipment: EquipmentItem[];
}

export const DEFAULT_SINGLE_LICENSE_CONFIG = {
  singleLicensePriceArs: 85000,
  defaultMpCheckoutUrl: '',
  sellerAlias: 'pastopro.licencia.mp',
  sellerCbu: '0000003100084920114502',
  sellerHolder: 'Diego Hernández — PastoPro Argentina',
  sellerBank: 'Mercado Pago / Transferencia Inmediata',
  sellerWhatsapp: '+54 9 3462 458910',
  mercadoPagoWebUrl: 'https://www.mercadopago.com.ar/home',
};

const LEGACY_PLACEHOLDER_MP_URLS = new Set([
  'https://mpago.la/2xPastoProLicenciaUnica',
  'https://mpago.la/pastopro',
  'https://www.mercadopago.com.ar/home',
]);

/**
 * Checks whether the tenant/admin has configured a real, non-placeholder Mercado Pago checkout link.
 * Prevents redirecting users to example/placeholder shortlinks that show "Algo salió mal" on Mercado Pago.
 */
export function hasValidCustomMercadoPagoLink(url?: string | null): boolean {
  const clean = (url || '').trim();
  if (!clean) return false;
  for (const legacy of LEGACY_PLACEHOLDER_MP_URLS) {
    if (clean.toLowerCase().startsWith(legacy.toLowerCase())) {
      return false;
    }
  }
  return (
    clean.startsWith('https://mpago.la/') ||
    clean.startsWith('https://www.mercadopago.com') ||
    clean.startsWith('https://mercadopago.com')
  );
}

/**
 * Generates an isolated localStorage key per authenticated user (multi-tenant)
 * so different accounts on the same browser or new accounts never bleed data.
 */
export function getTenantStorageKey(
  uid: string | null | undefined,
  isDemoMode = false
): string {
  if (uid && uid.trim().length > 0 && !isDemoMode) {
    const safeUid = uid.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    return `pastopro_tenant_v1_${safeUid}`;
  }
  return 'pastopro_demo_workspace_v2';
}

/**
 * Builds a default evaluation period configuration for a new tenant
 * before activating their One-Time Payment License (Licencia de Pago Único).
 */
export function createInitialSubscriptionConfig(
  nowIso = new Date().toISOString()
): TenantSubscriptionConfig {
  const startDate = new Date(nowIso);
  const safeStart = Number.isNaN(startDate.getTime())
    ? new Date()
    : startDate;
  const trialEnd = new Date(safeStart.getTime() + 14 * 24 * 60 * 60 * 1000);

  return {
    planId: 'evaluation',
    status: 'trialing',
    trialStartedAt: safeStart.toISOString().slice(0, 10),
    trialEndsAt: trialEnd.toISOString().slice(0, 10),
    mpCheckoutUrl: DEFAULT_SINGLE_LICENSE_CONFIG.defaultMpCheckoutUrl,
    sellerWhatsapp: DEFAULT_SINGLE_LICENSE_CONFIG.sellerWhatsapp,
    sellerAlias: DEFAULT_SINGLE_LICENSE_CONFIG.sellerAlias,
    sellerCbu: DEFAULT_SINGLE_LICENSE_CONFIG.sellerCbu,
    sellerHolder: DEFAULT_SINGLE_LICENSE_CONFIG.sellerHolder,
    sellerBank: DEFAULT_SINGLE_LICENSE_CONFIG.sellerBank,
    singleLicensePriceArs: DEFAULT_SINGLE_LICENSE_CONFIG.singleLicensePriceArs,
    paymentHistory: [],
  };
}

/**
 * Normalizes any legacy stored license/subscription object into the strict
 * One-Time Payment License structure without recurring plans.
 */
export function normalizeTenantLicenseConfig(
  raw?: Partial<TenantSubscriptionConfig> & Record<string, unknown>
): TenantSubscriptionConfig {
  const base = createInitialSubscriptionConfig();
  if (!raw || typeof raw !== 'object') {
    return base;
  }

  const rawPlan = String(raw.planId || '');
  const isActivated =
    raw.status === 'active' ||
    rawPlan === 'single_payment_license' ||
    rawPlan === 'installed_license' ||
    rawPlan === 'pro_annual' ||
    rawPlan === 'pro_monthly';

  const rawMpUrl =
    typeof raw.mpCheckoutUrl === 'string' ? raw.mpCheckoutUrl.trim() : '';
  const sanitizedMpUrl = hasValidCustomMercadoPagoLink(rawMpUrl) ? rawMpUrl : '';

  return {
    planId: isActivated ? 'single_payment_license' : 'evaluation',
    status: isActivated
      ? 'active'
      : raw.status === 'expired'
        ? 'expired'
        : 'trialing',
    trialStartedAt:
      typeof raw.trialStartedAt === 'string' && raw.trialStartedAt
        ? raw.trialStartedAt
        : base.trialStartedAt,
    trialEndsAt:
      typeof raw.trialEndsAt === 'string' && raw.trialEndsAt
        ? raw.trialEndsAt
        : base.trialEndsAt,
    activatedAt:
      typeof raw.activatedAt === 'string' ? raw.activatedAt : undefined,
    mpCheckoutUrl: sanitizedMpUrl,
    sellerWhatsapp:
      typeof raw.sellerWhatsapp === 'string' && raw.sellerWhatsapp.trim()
        ? raw.sellerWhatsapp.trim()
        : base.sellerWhatsapp,
    sellerAlias:
      typeof raw.sellerAlias === 'string' && raw.sellerAlias.trim()
        ? raw.sellerAlias.trim()
        : base.sellerAlias,
    sellerCbu:
      typeof raw.sellerCbu === 'string' && raw.sellerCbu.trim()
        ? raw.sellerCbu.trim()
        : base.sellerCbu,
    sellerHolder:
      typeof raw.sellerHolder === 'string' && raw.sellerHolder.trim()
        ? raw.sellerHolder.trim()
        : base.sellerHolder,
    sellerBank:
      typeof raw.sellerBank === 'string' && raw.sellerBank.trim()
        ? raw.sellerBank.trim()
        : base.sellerBank,
    singleLicensePriceArs:
      typeof raw.singleLicensePriceArs === 'number' &&
      raw.singleLicensePriceArs > 0
        ? raw.singleLicensePriceArs
        : base.singleLicensePriceArs,
    licenseKey:
      typeof raw.licenseKey === 'string' ? raw.licenseKey : undefined,
    paymentHistory: Array.isArray(raw.paymentHistory)
      ? raw.paymentHistory
      : [],
  };
}

/**
 * Resolves a BaseLocationConfig from any Argentine city name or preset key.
 */
export function resolveBaseLocationFromCityInput(
  cityInput?: string
): BaseLocationConfig {
  const clean = (cityInput || '').trim();
  if (clean && CITY_PRESETS[clean]) {
    return CITY_PRESETS[clean];
  }

  const norm = normalizeSearchText(clean);
  if (norm) {
    const matchedCatalog = ARGENTINA_CITIES_CATALOG.find(
      (c) =>
        normalizeSearchText(c.fullName) === norm ||
        normalizeSearchText(c.city) === norm ||
        norm.includes(normalizeSearchText(c.city)) ||
        normalizeSearchText(c.fullName).includes(norm)
    );
    if (matchedCatalog) {
      return {
        name: `Base Operativa (${matchedCatalog.city})`,
        city: matchedCatalog.fullName,
        address: matchedCatalog.defaultAddress,
        coordinates: matchedCatalog.coordinates,
        source: 'manual',
      };
    }
  }

  return {
    name: `Base Operativa (${clean || 'Venado Tuerto, Santa Fe'})`,
    city: clean || 'Venado Tuerto, Santa Fe',
    address: clean ? `Centro, ${clean.split(',')[0].trim()}` : 'Av. Casey 450, Venado Tuerto',
    coordinates: { lat: -33.7456, lng: -61.9688 },
    source: 'manual',
  };
}

/**
 * Creates a 100% clean, isolated workspace for a newly registered tenant
 * with zero clients, zero jobs, zero invoices, zero expenses, and unapproved status by default
 * (unless the user is the primary administrator hz.mdiego@gmail.com).
 */
export function createBlankTenantWorkspace(params: {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  businessName?: string;
  cityPresetKey?: string;
  nowIso?: string;
}): TenantWorkspaceBundle {
  const rawName = (params.displayName || '').trim();
  const rawBusiness = (params.businessName || '').trim();

  const resolvedOwnerName =
    rawName ||
    (params.email ? params.email.split('@')[0].replace(/[._-]/g, ' ') : '') ||
    'Titular del Servicio';

  const resolvedAppName =
    rawBusiness || (rawName ? `${rawName}` : 'Mi Empresa de Jardinería');

  const resolvedCityPreset = resolveBaseLocationFromCityInput(params.cityPresetKey);

  const slugAlias = resolvedAppName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 20);

  const todayIso = (params.nowIso || getTodayIsoLocal()).slice(0, 10);
  const accessState = getInitialAccessApprovalState(params.email);

  const defaultEquipment: EquipmentItem[] = [
    {
      id: `eq-${params.uid.slice(0, 6)}-1`,
      name: 'Cortadora Principal',
      model: 'Autopropulsada / Naftera',
      type: 'Cortadora Autopropulsada',
      hoursUsed: 0,
      serviceLimitHours: 25,
      nextTask: 'Cambio de aceite y afilado de cuchilla',
      lastServiceDate: todayIso,
    },
    {
      id: `eq-${params.uid.slice(0, 6)}-2`,
      name: 'Desmalezadora / Bordeadora',
      model: '2 Tiempos',
      type: 'Desmalezadora / Bordeadora',
      hoursUsed: 0,
      serviceLimitHours: 30,
      nextTask: 'Limpieza de filtro y engrase de cabezal',
      lastServiceDate: todayIso,
    },
  ];

  const baseSub = createInitialSubscriptionConfig(params.nowIso);
  const finalSubscription: TenantSubscriptionConfig = accessState.isApproved
    ? activateTenantSingleLicense(
        baseSub,
        'Transferencia / Clave de Licencia',
        'ADMIN-MASTER-KEY',
        todayIso
      )
    : baseSub;

  return {
    businessProfile: {
      appName: resolvedAppName,
      slogan: 'Mantenimiento de Césped, Parques y Quintas',
      ownerName: resolvedOwnerName,
      ownerPhone: '',
      baseRatePerSqm: 65,
      minServicePrice: 15000,
      tallGrassSurchargePct: 30,
      baggingSurchargePct: 15,
      logoUrl: '',
      brandColor: '#059669',
      onboardingCompleted: false,
    },
    baseLocation: {
      ...resolvedCityPreset,
      name: `Base Operativa (${resolvedCityPreset.city})`,
    },
    paymentProfile: {
      alias: slugAlias ? `${slugAlias}.mp` : 'mi.alias.cobro',
      cbu: '',
      holderName: resolvedOwnerName,
      bankName: 'Mercado Pago / Transferencia Bancaria',
      cuit: '',
      mpPaymentLink: '',
    },
    subscription: finalSubscription,
    isApproved: accessState.isApproved,
    approvalStatus: accessState.approvalStatus,
    role: accessState.role,
    registeredAt: params.nowIso || new Date().toISOString(),
    properties: [],
    todayJobs: [],
    invoices: [],
    expenses: [],
    equipment: defaultEquipment,
  };
}

/**
 * Evaluates One-Time License status, days remaining in initial evaluation, and badge text.
 */
export function evaluateSubscriptionStatus(
  subscription?: TenantSubscriptionConfig | null,
  referenceDateStr = getTodayIsoLocal()
): {
  planId: SubscriptionPlanId;
  planName: string;
  status: 'trialing' | 'active' | 'expired';
  daysRemaining: number;
  badgeText: string;
  isProActive: boolean;
} {
  const sub = normalizeTenantLicenseConfig(
    (subscription || undefined) as
      | (Partial<TenantSubscriptionConfig> & Record<string, unknown>)
      | undefined
  );
  const refTime = new Date(
    `${referenceDateStr.slice(0, 10)}T12:00:00Z`
  ).getTime();

  if (sub.planId === 'single_payment_license' && sub.status === 'active') {
    return {
      planId: 'single_payment_license',
      planName: 'Licencia Definitiva (Pago Único)',
      status: 'active',
      daysRemaining: 9999,
      badgeText: 'Licencia Activa',
      isProActive: true,
    };
  }

  const trialEndTime = new Date(
    `${(sub.trialEndsAt || getTodayIsoLocal()).slice(0, 10)}T12:00:00Z`
  ).getTime();
  const daysLeft = Math.ceil(
    (trialEndTime - refTime) / (1000 * 60 * 60 * 24)
  );

  if (daysLeft <= 0) {
    return {
      planId: 'evaluation',
      planName: 'Licencia de Pago Único',
      status: 'expired',
      daysRemaining: 0,
      badgeText: 'Pendiente de Activación',
      isProActive: false,
    };
  }

  return {
    planId: 'evaluation',
    planName: 'Evaluación Inicial (14 Días)',
    status: 'trialing',
    daysRemaining: daysLeft,
    badgeText: `Evaluación: ${daysLeft}d`,
    isProActive: false,
  };
}

/**
 * Builds the direct Mercado Pago Checkout Pro One-Time Payment URL.
 */
export function buildMercadoPagoSinglePaymentUrl(
  subscription: TenantSubscriptionConfig,
  payerEmail?: string | null
): string {
  const customUrl = (subscription.mpCheckoutUrl || '').trim();
  if (hasValidCustomMercadoPagoLink(customUrl)) {
    if (!payerEmail) return customUrl;
    const separator = customUrl.includes('?') ? '&' : '?';
    return `${customUrl}${separator}payer_email=${encodeURIComponent(payerEmail)}`;
  }

  return DEFAULT_SINGLE_LICENSE_CONFIG.mercadoPagoWebUrl;
}

/**
 * Activates the One-Time Payment License (Licencia de Uso — Pago Único)
 * and records the transaction in the tenant's payment history.
 */
export function activateTenantSingleLicense(
  currentSub: TenantSubscriptionConfig,
  method: 'Mercado Pago Pago Único' | 'Transferencia / Clave de Licencia',
  referenceCode?: string,
  referenceDateStr = getTodayIsoLocal()
): TenantSubscriptionConfig {
  const normalized = normalizeTenantLicenseConfig(
    currentSub as unknown as Partial<TenantSubscriptionConfig> &
      Record<string, unknown>
  );
  const baseDate = new Date(`${referenceDateStr.slice(0, 10)}T12:00:00Z`);
  const safeBase = Number.isNaN(baseDate.getTime())
    ? new Date()
    : baseDate;
  const dateStr = safeBase.toISOString().slice(0, 10);

  const cleanRef =
    (referenceCode || '').trim() ||
    `LIC-${Math.floor(100000 + Math.random() * 900000)}`;

  return {
    ...normalized,
    planId: 'single_payment_license',
    status: 'active',
    activatedAt: dateStr,
    licenseKey: cleanRef,
    paymentHistory: [
      {
        id: `licpay-${Date.now()}`,
        date: dateStr,
        planId: 'single_payment_license',
        planLabel: 'Licencia de Uso Definitiva — Pago Único',
        amountArs:
          normalized.singleLicensePriceArs ||
          DEFAULT_SINGLE_LICENSE_CONFIG.singleLicensePriceArs,
        method,
        referenceCode: cleanRef,
        status: 'Aprobado',
      },
      ...(normalized.paymentHistory || []),
    ],
  };
}

