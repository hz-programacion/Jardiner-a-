import { CITY_PRESETS } from '../data/seedData';
import {
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
} from '../types/lawn';

export interface TenantWorkspaceBundle {
  businessProfile: BusinessProfileConfig;
  baseLocation: BaseLocationConfig;
  paymentProfile: PaymentProfileConfig;
  subscription: TenantSubscriptionConfig;
  properties: ClientProperty[];
  todayJobs: ScheduledJob[];
  invoices: InvoiceRecord[];
  expenses: OperationalExpense[];
  equipment: EquipmentItem[];
}

export const DEFAULT_SAAS_SUBSCRIPTION_PRICES = {
  monthlyPriceArs: 18500,
  annualPriceArs: 185000,
  installedLicensePriceArs: 240000,
};

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
 * Builds a default 14-day free trial subscription configuration for a new tenant.
 */
export function createInitialSubscriptionConfig(
  nowIso = '2026-11-01T12:00:00.000Z'
): TenantSubscriptionConfig {
  const startDate = new Date(nowIso);
  const safeStart = Number.isNaN(startDate.getTime())
    ? new Date('2026-11-01T12:00:00.000Z')
    : startDate;
  const trialEnd = new Date(safeStart.getTime() + 14 * 24 * 60 * 60 * 1000);

  return {
    planId: 'trial',
    status: 'trialing',
    trialStartedAt: safeStart.toISOString().slice(0, 10),
    trialEndsAt: trialEnd.toISOString().slice(0, 10),
    mpPreapprovalPlanId: '2c9380848e9b1d4a018ea2f9c020014b',
    mpCheckoutUrl: '',
    sellerWhatsapp: '+54 9 3462 55-1234',
    monthlyPriceArs: DEFAULT_SAAS_SUBSCRIPTION_PRICES.monthlyPriceArs,
    annualPriceArs: DEFAULT_SAAS_SUBSCRIPTION_PRICES.annualPriceArs,
    installedLicensePriceArs:
      DEFAULT_SAAS_SUBSCRIPTION_PRICES.installedLicensePriceArs,
    paymentHistory: [],
  };
}

/**
 * Creates a 100% clean, isolated workspace for a newly registered tenant
 * (e.g. a gardener in Rosario, Córdoba, or Buenos Aires) with zero clients
 * from the demo/creator account and their own city & brand defaults.
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
    rawBusiness ||
    (rawName ? `${rawName}` : 'Mi Empresa de Jardinería');

  const resolvedCityPreset =
    (params.cityPresetKey && CITY_PRESETS[params.cityPresetKey]) ||
    CITY_PRESETS['Rosario, Santa Fe'] || {
      name: 'Mi Base Operativa',
      city: params.cityPresetKey || 'Rosario, Santa Fe',
      address: 'Centro',
      coordinates: { lat: -32.9442, lng: -60.6505 },
      source: 'manual',
    };

  const slugAlias = resolvedAppName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 20);

  const defaultEquipment: EquipmentItem[] = [
    {
      id: `eq-${params.uid.slice(0, 6)}-1`,
      name: 'Cortadora Principal',
      model: 'Autopropulsada / Naftera',
      type: 'Cortadora Autopropulsada',
      hoursUsed: 0,
      serviceLimitHours: 25,
      nextTask: 'Cambio de aceite y afilado de cuchilla',
      lastServiceDate: (params.nowIso || '2026-11-01').slice(0, 10),
    },
    {
      id: `eq-${params.uid.slice(0, 6)}-2`,
      name: 'Desmalezadora / Bordeadora',
      model: '2 Tiempos',
      type: 'Desmalezadora / Bordeadora',
      hoursUsed: 0,
      serviceLimitHours: 30,
      nextTask: 'Limpieza de filtro y engrase de cabezal',
      lastServiceDate: (params.nowIso || '2026-11-01').slice(0, 10),
    },
  ];

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
    subscription: createInitialSubscriptionConfig(params.nowIso),
    properties: [],
    todayJobs: [],
    invoices: [],
    expenses: [],
    equipment: defaultEquipment,
  };
}

/**
 * Evaluates subscription status, days remaining in trial, and human-readable badge text.
 */
export function evaluateSubscriptionStatus(
  subscription?: TenantSubscriptionConfig | null,
  referenceDateStr = '2026-11-01'
): {
  planId: SubscriptionPlanId;
  planName: string;
  status: 'trialing' | 'active' | 'past_due' | 'expired';
  daysRemaining: number;
  badgeText: string;
  isProActive: boolean;
} {
  const sub = subscription || createInitialSubscriptionConfig();
  const refTime = new Date(`${referenceDateStr.slice(0, 10)}T12:00:00Z`).getTime();

  const planNames: Record<SubscriptionPlanId, string> = {
    trial: 'Prueba Gratis 14 Días',
    pro_monthly: 'Plan Pro Mensual (Mercado Pago)',
    pro_annual: 'Plan Pro Anual (2 Meses Bonificados)',
    installed_license: 'Licencia Comercial Instalada',
  };

  if (
    sub.planId === 'pro_monthly' ||
    sub.planId === 'pro_annual' ||
    sub.planId === 'installed_license'
  ) {
    if (sub.status === 'active') {
      const endStr = sub.currentPeriodEndsAt || '2027-11-01';
      const endTime = new Date(`${endStr.slice(0, 10)}T12:00:00Z`).getTime();
      const diffDays = Math.max(
        0,
        Math.ceil((endTime - refTime) / (1000 * 60 * 60 * 24))
      );
      return {
        planId: sub.planId,
        planName: planNames[sub.planId],
        status: 'active',
        daysRemaining: diffDays,
        badgeText:
          sub.planId === 'installed_license'
            ? 'Licencia Activa'
            : 'Plan Pro Activo',
        isProActive: true,
      };
    }
  }

  const trialEndTime = new Date(
    `${(sub.trialEndsAt || '2026-11-15').slice(0, 10)}T12:00:00Z`
  ).getTime();
  const daysLeft = Math.ceil((trialEndTime - refTime) / (1000 * 60 * 60 * 24));

  if (daysLeft <= 0) {
    return {
      planId: 'trial',
      planName: planNames.trial,
      status: 'expired',
      daysRemaining: 0,
      badgeText: 'Prueba Vencida · Suscribirse',
      isProActive: false,
    };
  }

  return {
    planId: 'trial',
    planName: planNames.trial,
    status: 'trialing',
    daysRemaining: daysLeft,
    badgeText: `Prueba: ${daysLeft}d restantes`,
    isProActive: false,
  };
}

/**
 * Builds the official Mercado Pago Subscription Checkout URL from either a custom
 * checkout link or a Mercado Pago preapproval_plan_id.
 */
export function buildMercadoPagoSubscriptionUrl(
  subscription: TenantSubscriptionConfig,
  planId: SubscriptionPlanId = 'pro_monthly',
  payerEmail?: string | null
): string {
  const customUrl = (subscription.mpCheckoutUrl || '').trim();
  if (
    customUrl.startsWith('https://www.mercadopago.') ||
    customUrl.startsWith('https://mpago.la/')
  ) {
    return customUrl;
  }

  const preapprovalId =
    (subscription.mpPreapprovalPlanId || '').trim() ||
    '2c9380848e9b1d4a018ea2f9c020014b';

  const params = new URLSearchParams({
    preapproval_plan_id: preapprovalId,
    plan_tier: planId,
  });
  if (payerEmail) {
    params.set('payer_email', payerEmail);
  }
  return `https://www.mercadopago.com.ar/subscriptions/checkout?${params.toString()}`;
}

/**
 * Activates a paid subscription plan (monthly, annual, or installed license)
 * and records the transaction in the tenant's billing history.
 */
export function activateTenantSubscriptionPlan(
  currentSub: TenantSubscriptionConfig,
  planId: Exclude<SubscriptionPlanId, 'trial'>,
  method: 'Mercado Pago Suscripción' | 'Transferencia / Licencia',
  referenceCode?: string,
  referenceDateStr = '2026-11-01'
): TenantSubscriptionConfig {
  const baseDate = new Date(`${referenceDateStr.slice(0, 10)}T12:00:00Z`);
  const safeBase = Number.isNaN(baseDate.getTime())
    ? new Date('2026-11-01T12:00:00Z')
    : baseDate;

  const daysToAdd =
    planId === 'pro_monthly' ? 30 : planId === 'pro_annual' ? 365 : 3650;
  const nextEnd = new Date(
    safeBase.getTime() + daysToAdd * 24 * 60 * 60 * 1000
  );

  const amountByPlan: Record<Exclude<SubscriptionPlanId, 'trial'>, number> = {
    pro_monthly:
      currentSub.monthlyPriceArs ||
      DEFAULT_SAAS_SUBSCRIPTION_PRICES.monthlyPriceArs,
    pro_annual:
      currentSub.annualPriceArs ||
      DEFAULT_SAAS_SUBSCRIPTION_PRICES.annualPriceArs,
    installed_license:
      currentSub.installedLicensePriceArs ||
      DEFAULT_SAAS_SUBSCRIPTION_PRICES.installedLicensePriceArs,
  };

  const labelByPlan: Record<Exclude<SubscriptionPlanId, 'trial'>, string> = {
    pro_monthly: 'Suscripción Mensual PastoPro Cloud',
    pro_annual: 'Suscripción Anual PastoPro Cloud (12 meses)',
    installed_license: 'Licencia Comercial Instalada White-Label',
  };

  const cleanRef =
    (referenceCode || '').trim() ||
    `MP-${Math.floor(100000 + Math.random() * 900000)}`;

  return {
    ...currentSub,
    planId,
    status: 'active',
    currentPeriodEndsAt: nextEnd.toISOString().slice(0, 10),
    licenseKey:
      planId === 'installed_license' ? cleanRef : currentSub.licenseKey,
    paymentHistory: [
      {
        id: `subpay-${Date.now()}`,
        date: safeBase.toISOString().slice(0, 10),
        planId,
        planLabel: labelByPlan[planId],
        amountArs: amountByPlan[planId],
        method,
        referenceCode: cleanRef,
        status: 'Aprobado',
      },
      ...(currentSub.paymentHistory || []),
    ],
  };
}
