export type PropertyType = 'Casa' | 'Terreno' | 'Quinta';
export type CutFrequency = 'Semanal' | 'Quincenal' | 'Mensual' | 'Única vez';
export type GrassCondition = 'Regular' | 'Alto' | 'Maleza Pesada';
export type JobStatus = 'Pendiente' | 'En Curso' | 'Completado';
export type PaymentStatus = 'Pagado' | 'Pendiente';
export type PaymentMethod = 'Efectivo' | 'Transferencia' | 'MercadoPago';
export type CalendarViewMode = 'dia' | 'semana' | 'mes';
export type PeriodFilter =
  | 'hoy'
  | 'semana'
  | 'mes_actual'
  | 'mes_anterior'
  | 'trimestre'
  | 'anio'
  | 'personalizado';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface BaseLocationConfig {
  name: string;
  city: string;
  address: string;
  coordinates: LatLng;
  source: 'manual' | 'gps';
  updatedAt?: string;
}

export interface ClientProperty {
  id: string;
  clientName: string;
  phone: string;
  address: string;
  neighborhood: string;
  propertyType: PropertyType;
  areaSqm: number;
  grassCondition?: GrassCondition;
  includesBagging?: boolean;
  frequency: CutFrequency;
  basePrice: number;
  defaultTasks: string[];
  accessNotes: string;
  coordinates: LatLng;
  lastCutDate: string;
  nextCutDate: string;
  estimatedMinutes: number;
  active: boolean;
}

export interface ScheduledJob {
  id: string;
  propertyId: string;
  clientName: string;
  phone: string;
  address: string;
  neighborhood: string;
  propertyType: PropertyType;
  areaSqm: number;
  frequency: CutFrequency;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:mm (e.g., "08:00", "10:30")
  orderIndex: number;
  status: JobStatus;
  tasks: string[];
  price: number;
  accessNotes: string;
  coordinates: LatLng;
  estimatedMinutes: number;
  startedAt?: string;
  completedAt?: string;
  invoiceId?: string;
  legDistanceKm?: number;
  legDurationMin?: number;
  photoUrl?: string;
}

export interface CalendarDayCell {
  dateStr: string; // YYYY-MM-DD
  dayOfMonth: number;
  weekdayShort: string;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  jobs: ScheduledJob[];
  totalRevenue: number;
  totalMinutes: number;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  jobId: string;
  propertyId: string;
  clientName: string;
  phone: string;
  address: string;
  neighborhood?: string;
  propertyType: PropertyType;
  areaSqm: number;
  date: string; // YYYY-MM-DD
  amount: number;
  tasksCompleted: string[];
  status: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paidAt?: string;
  nextScheduledDate: string;
  photoUrl?: string;
}

export interface PaymentProfileConfig {
  alias: string;
  cbu: string;
  holderName: string;
  bankName: string;
  cuit?: string;
  mpPaymentLink?: string;
}

export interface BusinessProfileConfig {
  appName: string;
  slogan: string;
  ownerName: string;
  ownerPhone: string;
  baseRatePerSqm: number;
  minServicePrice: number;
  tallGrassSurchargePct?: number;
  baggingSurchargePct?: number;
  logoUrl?: string;
  brandColor?: string;
  onboardingCompleted?: boolean;
}

export type SubscriptionPlanId =
  | 'evaluation'
  | 'single_payment_license';

export type SubscriptionStatus = 'trialing' | 'active' | 'expired';

export interface SubscriptionPaymentRecord {
  id: string;
  date: string;
  planId: SubscriptionPlanId;
  planLabel: string;
  amountArs: number;
  method: 'Mercado Pago Pago Único' | 'Transferencia / Clave de Licencia';
  referenceCode: string;
  status: 'Aprobado' | 'Pendiente';
}

export interface TenantSubscriptionConfig {
  planId: SubscriptionPlanId;
  status: SubscriptionStatus;
  trialStartedAt: string;
  trialEndsAt: string;
  activatedAt?: string;
  mpCheckoutUrl?: string;
  sellerWhatsapp?: string;
  singleLicensePriceArs: number;
  licenseKey?: string;
  paymentHistory: SubscriptionPaymentRecord[];
}

export interface WeatherForecastDay {
  dateStr: string;
  condition: 'Soleado' | 'Parcialmente Nublado' | 'Alerta Lluvia';
  tempMax: number;
  tempMin: number;
  rainProb: number;
  windKmh: number;
  cuttingWindowLabel: string;
  isRainRisk: boolean;
}

export type OfflineActionType =
  | 'COMPLETE_JOB'
  | 'CREATE_CLIENT'
  | 'UPDATE_CLIENT'
  | 'SCHEDULE_JOB'
  | 'UPDATE_SCHEDULED_JOB'
  | 'BULK_PRICE_UPDATE'
  | 'ADD_EXPENSE'
  | 'UPDATE_EXPENSE'
  | 'UPDATE_INVOICE'
  | 'UPDATE_EQUIPMENT'
  | 'UPDATE_BUSINESS_PROFILE';

export type ApprovalStatus = 'pending' | 'approved' | 'revoked';
export type UserRole = 'admin' | 'user';

export interface ArgentinaCitySuggestion {
  id: string;
  city: string;
  province: string;
  fullName: string; // e.g., "Venado Tuerto, Santa Fe"
  defaultAddress: string;
  coordinates: LatLng;
}

export interface RegisteredTenantSummary {
  uid: string;
  email: string;
  displayName: string;
  businessName: string;
  city: string;
  registeredAt: string;
  updatedAt?: string;
  isApproved: boolean;
  approvalStatus: ApprovalStatus;
  role: UserRole;
  licenseStatus?: SubscriptionStatus;
  planId?: SubscriptionPlanId;
}

export interface StreetSuggestionItem {
  id: string;
  streetAddress: string;
  neighborhood: string;
  city: string;
  coordinates: LatLng;
  source: 'local_catalog' | 'google_places';
}

export interface OfflineSyncAction {
  id: string;
  type: OfflineActionType;
  label: string;
  detail: string;
  createdAt: string;
  status: 'Pendiente' | 'Sincronizado';
  syncedAt?: string;
}

export interface OperationalExpense {
  id: string;
  date: string;
  category:
    | 'Combustible y Aceite 2T'
    | 'Tanza y Cuchillas'
    | 'Mantenimiento Equipos'
    | 'Traslado / Peajes'
    | 'Ayudante / Jornal';
  description: string;
  amount: number;
}

export interface EquipmentItem {
  id: string;
  name: string;
  model: string;
  type:
    | 'Cortadora Autopropulsada'
    | 'Desmalezadora / Bordeadora'
    | 'Tractor Cortacésped'
    | 'Sopladora';
  hoursUsed: number;
  serviceLimitHours: number;
  nextTask: string;
  lastServiceDate: string;
}

export interface ClientPriceHistorySummary {
  records: InvoiceRecord[];
  lastAmount: number | null;
  lastDate: string | null;
  previousAmount: number | null;
  previousDate: string | null;
  variationPercent: number | null;
  totalCutsCount: number;
  totalBilled: number;
  pendingBalance: number;
}

export interface MonthlyBreakdownRow {
  monthKey: string; // YYYY-MM
  monthLabel: string;
  facturado: number;
  cobrado: number;
  gastos: number;
  gananciaNeta: number;
  cutsCount: number;
  totalSqm: number;
}

export interface LocalityBreakdownRow {
  locality: string;
  cutsCount: number;
  totalBilled: number;
  totalSqm: number;
}

export interface ClientRankingRow {
  propertyId: string;
  clientName: string;
  locality: string;
  cutsCount: number;
  totalBilled: number;
  lastAmount: number;
  lastDate: string;
}

export interface BackupPayload {
  version: string;
  exportedAt: string;
  businessProfile?: BusinessProfileConfig;
  baseLocation?: BaseLocationConfig;
  paymentProfile?: PaymentProfileConfig;
  subscription?: TenantSubscriptionConfig;
  isApproved?: boolean;
  approvalStatus?: ApprovalStatus;
  role?: UserRole;
  properties: ClientProperty[];
  todayJobs: ScheduledJob[];
  invoices: InvoiceRecord[];
  expenses: OperationalExpense[];
  equipment: EquipmentItem[];
}

