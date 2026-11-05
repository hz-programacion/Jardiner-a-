/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Building2,
  Calculator,
  Calendar as CalendarIcon,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
  CloudRain,
  CloudSun,
  Compass,
  CreditCard,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  History,
  Leaf,
  LogOut,
  MapPin,
  MessageCircle,
  Moon,
  Navigation,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Timer,
  Trash2,
  User as UserIcon,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Command,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  BASE_DEPOT,
  INITIAL_EQUIPMENT,
  INITIAL_EXPENSES,
  INITIAL_INVOICES,
  INITIAL_PROPERTIES,
  INITIAL_TODAY_JOBS,
} from './data/seedData';
import {
  BackupPayload,
  BaseLocationConfig,
  BusinessProfileConfig,
  ClientProperty,
  EquipmentItem,
  InvoiceRecord,
  JobPhotoStage,
  OperationalExpense,
  PaymentMethod,
  PaymentProfileConfig,
  ScheduledJob,
  TenantSubscriptionConfig,
} from './types/lawn';
import {
  addTaskAndSurchargeToScheduledJob,
  appendJobPhotosToClientProperty,
  applyBulkPriceIncrease,
  buildGoogleMapsNavUrl,
  buildSafeWhatsAppUrl,
  buildWeekDaysForDate,
  calculateFinancialSummary,
  completeJobAndCreateInvoice,
  computeEndTimeFromStart,
  deleteClientPropertyFromState,
  formatStopwatchSeconds,
  generateGoogleSheetsTsv,
  generateSpreadsheetCsv,
  getClientPriceHistory,
  getTodayIsoLocal,
  getWeatherForDate,
  getWorkOrdersSkeletonDescriptors,
  moveScheduledJobOrder,
  optimizeRouteOrder,
  recalculateJobsFromDynamicBase,
  reschedulePendingJobsForRain,
  sanitizeAndValidateBackupPayload,
  updateEquipmentItemInState,
  updateInvoiceRecordInState,
  updateOperationalExpenseInState,
  updateScheduledJobInState,
  WorkOrderSkeletonReason,
} from './utils/lawnLogic';
import {
  buildSpokenJobSummary,
  buildSpokenRouteBriefing,
  speakTextAloud,
  stopSpeakingAloud,
} from './utils/voiceAccessibility';
import {
  createBlankTenantWorkspace,
  createInitialSubscriptionConfig,
  evaluateSubscriptionStatus,
  getInitialAccessApprovalState,
  getTenantStorageKey,
  isPrimaryAdminEmail,
  normalizeTenantLicenseConfig,
} from './utils/saasLogic';
import { RouteMapPanel } from './components/RouteMapPanel';
import { CalendarAgendaView } from './components/CalendarAgendaView';
import { BotanicalAgronomyView } from './components/BotanicalAgronomyView';
import {
  BackupAndEquipmentView,
  BillingView,
  ClientsView,
  QuoteCalculatorView,
} from './components/SecondaryViews';
import {
  BaseLocationModal,
  BusinessProfileModal,
  ClientFormModal,
  ClientHistoryModal,
  CompleteJobModal,
  ConfirmDeleteModal,
  ConfirmSheetsActionModal,
  EditInvoiceModal,
  EditScheduledJobModal,
  InvoiceReceiptModal,
  OfflineQueueAndAliasModal,
  ScheduleJobModal,
} from './components/Modals';
import {
  AuthenticatedTenantSession,
  AuthGate,
} from './components/AuthGate';
import {
  OnboardingWhiteLabelModal,
  SubscriptionMercadoPagoModal,
} from './components/SaaSCommercialModals';
import {
  AdminControlPanelView,
  PendingApprovalScreen,
} from './components/AdminAccessControl';
import {
  auth,
  getLocalTenantApprovalState,
  loadWorkspaceFromFirestore,
  onAuthStateChanged,
  saveWorkspaceToFirestore,
  signOutFirebase,
  subscribeToWorkspaceFirestore,
  testFirestoreConnection,
  User,
} from './firebase';
import {
  createPastoProSpreadsheet,
  getAccessToken,
  googleSignIn,
  initAuth,
  logoutGoogle,
  syncAllDataToGoogleSheet,
} from './services/googleSheetsService';
import {
  PWAInstallButton,
  useServiceWorkerOfflineQueue,
} from './hooks/usePWAAndOfflineQueue';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { BeforeAfterSlider } from './components/BeforeAfterSlider';
import {
  computeAgronomicCuttingWindow,
  optimizeRouteWith2Opt,
} from './utils/backendEngine';

type ActiveTab =
  | 'ruta'
  | 'agenda'
  | 'clientes'
  | 'jardineria'
  | 'cotizador'
  | 'facturacion'
  | 'respaldo'
  | 'admin';

const DEMO_STORAGE_KEY = 'pastopro_demo_workspace_v2';
const ACTIVE_TENANT_SESSION_KEY = 'pastopro_active_tenant_session_v2';
const SHEETS_META_KEY = 'pastopro_sheets_meta_v6';
const LOCAL_MODE_KEY = 'pastopro_local_mode_v1';
const TODAY_REFERENCE = getTodayIsoLocal();

const DEFAULT_PAYMENT_PROFILE: PaymentProfileConfig = {
  alias: 'pastopro.demo',
  cbu: '0000003100084920114502',
  holderName: 'Cuenta Demo (Muestra)',
  bankName: 'Mercado Pago / Transferencia',
};

const DEFAULT_BUSINESS_PROFILE: BusinessProfileConfig = {
  appName: 'PastoPro',
  slogan: 'Mantenimiento de Césped, Quintas y Jardines',
  ownerName: 'Cuenta Demo Interactiva',
  ownerPhone: '+54 9 3462 55-1234',
  baseRatePerSqm: 65,
  minServicePrice: 15000,
  tallGrassSurchargePct: 30,
  baggingSurchargePct: 15,
  onboardingCompleted: true,
};

export default function App() {
  const [adminGardenerPreviewMode, setAdminGardenerPreviewMode] =
    useState<boolean>(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] =
    useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('ruta');
  const [routeLayoutMode, setRouteLayoutMode] = useState<'bento' | 'tabla'>(
    'bento'
  );
  const [activeDate, setActiveDate] = useState<string>(TODAY_REFERENCE);
  const [mobileRouteSubView, setMobileRouteSubView] = useState<'list' | 'map'>(
    'list'
  );
  const [routeStatusFilter, setRouteStatusFilter] = useState<
    'todos' | 'pendientes' | 'completados'
  >('todos');
  const [routeSearchQuery, setRouteSearchQuery] = useState<string>('');
  const [isDailyJobsTransitioning, setIsDailyJobsTransitioning] =
    useState<boolean>(false);
  const [dailyJobsTransitionReason, setDailyJobsTransitionReason] =
    useState<WorkOrderSkeletonReason>('filter');
  const [dailyJobsRenderBatch, setDailyJobsRenderBatch] = useState<number>(0);
  const dailyJobsTransitionTimerRef = useRef<number | null>(null);

  const triggerDailyJobsTransition = useCallback(
    (reason: WorkOrderSkeletonReason = 'filter', durationMs = 360) => {
      if (dailyJobsTransitionTimerRef.current !== null) {
        window.clearTimeout(dailyJobsTransitionTimerRef.current);
      }
      setDailyJobsTransitionReason(reason);
      setIsDailyJobsTransitioning(true);
      dailyJobsTransitionTimerRef.current = window.setTimeout(() => {
        setIsDailyJobsTransitioning(false);
        setDailyJobsRenderBatch((prev) => prev + 1);
        dailyJobsTransitionTimerRef.current = null;
      }, Math.max(320, durationMs));
    },
    []
  );

  useEffect(() => {
    return () => {
      if (dailyJobsTransitionTimerRef.current !== null) {
        window.clearTimeout(dailyJobsTransitionTimerRef.current);
      }
    };
  }, []);

  // Firebase Authentication & Multi-Tenant Session State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [activeTenantSession, setActiveTenantSession] =
    useState<AuthenticatedTenantSession | null>(() => {
      try {
        localStorage.removeItem('pastopro_active_tenant_session_v1');
        const raw = localStorage.getItem(ACTIVE_TENANT_SESSION_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.uid && parsed.email) {
            // Security: Never trust a localStorage session claiming admin email or role
            // without live Firebase Authentication verification via onAuthStateChanged.
            if (
              isPrimaryAdminEmail(parsed.email) ||
              parsed.role === 'admin' ||
              String(parsed.uid).startsWith('local-')
            ) {
              localStorage.removeItem(ACTIVE_TENANT_SESSION_KEY);
              return null;
            }
            return parsed;
          }
        }
      } catch {
        // ignore
      }
      return null;
    });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [localModeAccepted, setLocalModeAccepted] = useState<boolean>(() => {
    try {
      localStorage.removeItem(LOCAL_MODE_KEY);
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('autostart') === '1') return true;
      }
    } catch {
      // ignore
    }
    return false;
  });
  const [cloudSyncState, setCloudSyncState] = useState<
    'idle' | 'syncing' | 'synced' | 'error'
  >('idle');
  const [cloudSyncMessage, setCloudSyncMessage] = useState<string | null>(null);
  const [isCheckingApprovalStatus, setIsCheckingApprovalStatus] =
    useState(false);
  const hasHydratedFromCloudRef = useRef<string | null>(null);

  // Active storage key isolated per tenant (or demo workspace)
  const activeTenantUid = activeTenantSession?.uid || firebaseUser?.uid || null;
  const activeUserEmail =
    firebaseUser?.email || activeTenantSession?.email || null;
  // Security: Admin privileges strictly require a verified live Firebase Auth user matching hz.mdiego@gmail.com
  const isAdminUser = Boolean(
    firebaseUser && isPrimaryAdminEmail(firebaseUser.email)
  );
  const currentStorageKey = useMemo(
    () => getTenantStorageKey(activeTenantUid, !activeTenantUid),
    [activeTenantUid]
  );

  // Dark Mode State (persisted in localStorage)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('parquizaciones_dark_mode_v1') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      document.documentElement.classList.toggle('dark', isDarkMode);
      localStorage.setItem('parquizaciones_dark_mode_v1', String(isDarkMode));
    } catch {
      // ignore
    }
  }, [isDarkMode]);

  // Optional Voice & Pictogram Accessibility Mode (OFF by default, user-activated only)
  const [isEasyAccessMode, setIsEasyAccessMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('parquizaciones_easy_access_v1') === 'true';
    } catch {
      return false;
    }
  });
  const [isSpeakingAudio, setIsSpeakingAudio] = useState<boolean>(false);

  const handleToggleEasyAccessMode = useCallback(() => {
    setIsEasyAccessMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('parquizaciones_easy_access_v1', String(next));
      } catch {
        // ignore
      }
      if (!next) {
        stopSpeakingAloud();
        setIsSpeakingAudio(false);
      } else {
        setIsSpeakingAudio(true);
        speakTextAloud(
          'Modo fácil con voz activado. Tocá cualquier botón amarillo con parlante para escuchar los datos en voz alta.',
          () => setIsSpeakingAudio(false)
        );
      }
      return next;
    });
  }, []);

  // White-Label & SaaS Subscription Modal states
  const [isWhiteLabelModalOpen, setIsWhiteLabelModalOpen] = useState(false);
  const [isFirstTimeWhiteLabelSetup, setIsFirstTimeWhiteLabelSetup] =
    useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);

  const [subscription, setSubscription] = useState<TenantSubscriptionConfig>(
    () => {
      try {
        const saved = localStorage.getItem(currentStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.subscription) {
            return normalizeTenantLicenseConfig(parsed.subscription);
          }
        }
      } catch {
        // ignore
      }
      return createInitialSubscriptionConfig();
    }
  );

  // Editable Business & App Identity Profile
  const [businessProfile, setBusinessProfile] = useState<BusinessProfileConfig>(
    () => {
      try {
        const saved = localStorage.getItem(currentStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.businessProfile && parsed.businessProfile.appName) {
            return {
              ...DEFAULT_BUSINESS_PROFILE,
              ...parsed.businessProfile,
            };
          }
        }
      } catch {
        // ignore
      }
      return DEFAULT_BUSINESS_PROFILE;
    }
  );
  const [isBusinessProfileModalOpen, setIsBusinessProfileModalOpen] =
    useState(false);

  // Dynamic Base Location / GPS Starting Point
  const [baseLocation, setBaseLocation] = useState<BaseLocationConfig>(() => {
    try {
      const saved = localStorage.getItem(currentStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.baseLocation && parsed.baseLocation.coordinates) {
          return parsed.baseLocation;
        }
      }
    } catch {
      // ignore
    }
    return BASE_DEPOT;
  });
  const [isBaseModalOpen, setIsBaseModalOpen] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);

  // Payment Alias / CBU configuration
  const [paymentProfile, setPaymentProfile] = useState<PaymentProfileConfig>(
    () => {
      try {
        const saved = localStorage.getItem(currentStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.paymentProfile && parsed.paymentProfile.alias) {
            return parsed.paymentProfile;
          }
        }
      } catch {
        // ignore
      }
      return DEFAULT_PAYMENT_PROFILE;
    }
  );
  const [isOfflineAndAliasModalOpen, setIsOfflineAndAliasModalOpen] =
    useState(false);

  const [properties, setProperties] = useState<ClientProperty[]>(() => {
    try {
      const saved = localStorage.getItem(currentStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.properties)) return parsed.properties;
      }
    } catch {
      // ignore
    }
    return INITIAL_PROPERTIES;
  });

  const [scheduledJobs, setScheduledJobs] = useState<ScheduledJob[]>(() => {
    try {
      const saved = localStorage.getItem(currentStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.todayJobs)) return parsed.todayJobs;
      }
    } catch {
      // ignore
    }
    return recalculateJobsFromDynamicBase(
      BASE_DEPOT.coordinates,
      INITIAL_TODAY_JOBS
    );
  });

  const [invoices, setInvoices] = useState<InvoiceRecord[]>(() => {
    try {
      const saved = localStorage.getItem(currentStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.invoices)) return parsed.invoices;
      }
    } catch {
      // ignore
    }
    return INITIAL_INVOICES;
  });

  const [expenses, setExpenses] = useState<OperationalExpense[]>(() => {
    try {
      const saved = localStorage.getItem(currentStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.expenses)) return parsed.expenses;
      }
    } catch {
      // ignore
    }
    return INITIAL_EXPENSES;
  });

  const [equipment, setEquipment] = useState<EquipmentItem[]>(() => {
    try {
      const saved = localStorage.getItem(currentStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.equipment)) return parsed.equipment;
      }
    } catch {
      // ignore
    }
    return INITIAL_EQUIPMENT;
  });

  // Google Sheets OAuth & spreadsheet state
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [connectedSpreadsheetId, setConnectedSpreadsheetId] = useState<string>(
    () => {
      try {
        const saved = localStorage.getItem(SHEETS_META_KEY);
        if (saved) return JSON.parse(saved).spreadsheetId || '';
      } catch {
        // ignore
      }
      return '';
    }
  );
  const [connectedSpreadsheetUrl, setConnectedSpreadsheetUrl] =
    useState<string>(() => {
      try {
        const saved = localStorage.getItem(SHEETS_META_KEY);
        if (saved) return JSON.parse(saved).spreadsheetUrl || '';
      } catch {
        // ignore
      }
      return '';
    });
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(SHEETS_META_KEY);
      if (saved) return JSON.parse(saved).lastSyncedAt || null;
    } catch {
      // ignore
    }
    return null;
  });
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [sheetsConfirmDialog, setSheetsConfirmDialog] = useState<{
    isOpen: boolean;
    actionType: 'create' | 'sync';
  }>({ isOpen: false, actionType: 'sync' });

  const activeDateJobs = useMemo(
    () =>
      scheduledJobs
        .filter((j) => j.scheduledDate === activeDate)
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [scheduledJobs, activeDate]
  );

  const [selectedJobId, setSelectedJobId] = useState<string | null>(
    INITIAL_TODAY_JOBS[1]?.id || INITIAL_TODAY_JOBS[0]?.id || null
  );
  const [jobToComplete, setJobToComplete] = useState<ScheduledJob | null>(null);
  const [editingScheduledJob, setEditingScheduledJob] =
    useState<ScheduledJob | null>(null);
  const [historyClientModal, setHistoryClientModal] =
    useState<ClientProperty | null>(null);

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientProperty | null>(
    null
  );
  const [prefillClientData, setPrefillClientData] =
    useState<Partial<ClientProperty> | null>(null);
  const [modalDefaultDate, setModalDefaultDate] =
    useState<string>(TODAY_REFERENCE);
  const [modalDefaultTime, setModalDefaultTime] = useState<string>('08:30');

  const [scheduleModalState, setScheduleModalState] = useState<{
    isOpen: boolean;
    preselectedPropertyId: string | null;
    defaultDate: string;
    defaultTime: string;
  }>({
    isOpen: false,
    preselectedPropertyId: null,
    defaultDate: TODAY_REFERENCE,
    defaultTime: '08:30',
  });

  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmLabel: 'Sí, Eliminar',
    onConfirm: () => {},
  });

  const [selectedInvoiceReceipt, setSelectedInvoiceReceipt] =
    useState<InvoiceRecord | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRecord | null>(
    null
  );
  const [routeNotice, setRouteNotice] = useState<string | null>(null);

  // Live Mowing Stopwatch State (Control de tiempo real de corte)
  const [activeCutTimer, setActiveCutTimer] = useState<{
    jobId: string;
    clientName: string;
    elapsedSeconds: number;
    isRunning: boolean;
  } | null>(null);

  useEffect(() => {
    if (!activeCutTimer?.isRunning) return;
    const interval = window.setInterval(() => {
      setActiveCutTimer((prev) =>
        prev && prev.isRunning
          ? { ...prev, elapsedSeconds: prev.elapsedSeconds + 1 }
          : prev
      );
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeCutTimer?.isRunning]);

  const showBanner = useCallback((msg: string) => {
    setRouteNotice(msg);
    setTimeout(() => setRouteNotice(null), 5500);
  }, []);

  const {
    isOnline,
    simulatedOffline,
    setSimulatedOffline,
    swReady,
    offlineQueue,
    pendingCount: offlinePendingCount,
    recordAction,
    flushPendingActions,
    clearSyncedHistory,
  } = useServiceWorkerOfflineQueue((flushedCount) => {
    showBanner(
      `¡Conexión restablecida! El Service Worker sincronizó automáticamente ${flushedCount} ${
        flushedCount === 1 ? 'acción guardada' : 'acciones guardadas'
      } en la cola offline.`
    );
  });

  const activeDayWeather = useMemo(
    () => getWeatherForDate(activeDate, baseLocation.city),
    [activeDate, baseLocation.city]
  );

  // Hydrate or initialize an isolated tenant workspace (never leaking demo data into real accounts)
  const hydrateTenantWorkspace = useCallback(
    async (session: AuthenticatedTenantSession) => {
      const tenantKey = getTenantStorageKey(session.uid, false);
      const initialApproval = getInitialAccessApprovalState(session.email);
      const localApproval = getLocalTenantApprovalState(
        session.uid,
        session.email
      );

      setCloudSyncState('syncing');
      const loadedCloud = await loadWorkspaceFromFirestore(session.uid);
      if (loadedCloud.data) {
        const d = loadedCloud.data;
        const resolvedApproved = isPrimaryAdminEmail(session.email)
          ? true
          : typeof d.isApproved === 'boolean'
          ? d.isApproved
          : localApproval.isApproved;
        const resolvedStatus = isPrimaryAdminEmail(session.email)
          ? 'approved'
          : d.approvalStatus || localApproval.approvalStatus;

        const updatedSession: AuthenticatedTenantSession = {
          ...session,
          isApproved: resolvedApproved,
          approvalStatus: resolvedStatus,
          role: isPrimaryAdminEmail(session.email) ? 'admin' : 'user',
        };
        setActiveTenantSession(updatedSession);
        try {
          localStorage.setItem(
            ACTIVE_TENANT_SESSION_KEY,
            JSON.stringify(updatedSession)
          );
        } catch {
          // ignore
        }

        if (d.businessProfile?.appName) setBusinessProfile(d.businessProfile);
        if (d.baseLocation?.coordinates) setBaseLocation(d.baseLocation);
        if (d.paymentProfile?.alias) setPaymentProfile(d.paymentProfile);
        if (d.subscription)
          setSubscription(
            normalizeTenantLicenseConfig(
              d.subscription as unknown as Partial<TenantSubscriptionConfig> &
                Record<string, unknown>
            )
          );
        setProperties(Array.isArray(d.properties) ? d.properties : []);
        setScheduledJobs(Array.isArray(d.todayJobs) ? d.todayJobs : []);
        setInvoices(Array.isArray(d.invoices) ? d.invoices : []);
        setExpenses(Array.isArray(d.expenses) ? d.expenses : []);
        if (Array.isArray(d.equipment)) setEquipment(d.equipment);
        hasHydratedFromCloudRef.current = session.uid;
        setCloudSyncState('synced');
        setCloudSyncMessage('Espacio privado sincronizado en la nube.');
        if (isPrimaryAdminEmail(session.email)) {
          setActiveTab('admin');
        }
        return;
      }

      // Check isolated local tenant storage next
      try {
        const localRaw = localStorage.getItem(tenantKey);
        if (localRaw && !session.isNewRegistration) {
          const parsed = JSON.parse(localRaw);
          const resolvedApproved = isPrimaryAdminEmail(session.email)
            ? true
            : typeof parsed.isApproved === 'boolean'
            ? parsed.isApproved
            : localApproval.isApproved;
          const resolvedStatus = isPrimaryAdminEmail(session.email)
            ? 'approved'
            : parsed.approvalStatus || localApproval.approvalStatus;

          const updatedSession: AuthenticatedTenantSession = {
            ...session,
            isApproved: resolvedApproved,
            approvalStatus: resolvedStatus,
            role: isPrimaryAdminEmail(session.email) ? 'admin' : 'user',
          };
          setActiveTenantSession(updatedSession);
          localStorage.setItem(
            ACTIVE_TENANT_SESSION_KEY,
            JSON.stringify(updatedSession)
          );

          if (parsed.businessProfile?.appName)
            setBusinessProfile(parsed.businessProfile);
          if (parsed.baseLocation?.coordinates)
            setBaseLocation(parsed.baseLocation);
          if (parsed.paymentProfile?.alias)
            setPaymentProfile(parsed.paymentProfile);
          if (parsed.subscription)
            setSubscription(normalizeTenantLicenseConfig(parsed.subscription));
          setProperties(
            Array.isArray(parsed.properties) ? parsed.properties : []
          );
          setScheduledJobs(
            Array.isArray(parsed.todayJobs) ? parsed.todayJobs : []
          );
          setInvoices(Array.isArray(parsed.invoices) ? parsed.invoices : []);
          setExpenses(Array.isArray(parsed.expenses) ? parsed.expenses : []);
          if (Array.isArray(parsed.equipment)) setEquipment(parsed.equipment);
          hasHydratedFromCloudRef.current = session.uid;
          setCloudSyncState('synced');
          setCloudSyncMessage(`Cuenta aislada activa (${session.email}).`);
          if (isPrimaryAdminEmail(session.email)) {
            setActiveTab('admin');
          }
          return;
        }
      } catch {
        // ignore
      }

      // Brand-new tenant registration: create a 100% clean workspace (0 clients from Diego)
      // Default state for non-admin accounts: isApproved = false, approvalStatus = 'pending'
      const blank = createBlankTenantWorkspace({
        uid: session.uid,
        email: session.email,
        displayName: session.displayName,
        businessName: session.businessName,
        cityPresetKey: session.cityPresetKey,
      });

      const newSession: AuthenticatedTenantSession = {
        ...session,
        isApproved: initialApproval.isApproved,
        approvalStatus: initialApproval.approvalStatus,
        role: initialApproval.role,
      };
      setActiveTenantSession(newSession);
      try {
        localStorage.setItem(
          ACTIVE_TENANT_SESSION_KEY,
          JSON.stringify(newSession)
        );
      } catch {
        // ignore
      }

      const isAdminAccount = isPrimaryAdminEmail(session.email);
      const initialProperties = isAdminAccount ? INITIAL_PROPERTIES : blank.properties;
      const initialJobs = isAdminAccount
        ? recalculateJobsFromDynamicBase(
            blank.baseLocation.coordinates,
            INITIAL_TODAY_JOBS
          )
        : blank.todayJobs;
      const initialInvoices = isAdminAccount ? INITIAL_INVOICES : blank.invoices;
      const initialExpenses = isAdminAccount ? INITIAL_EXPENSES : blank.expenses;
      const initialEquipment = isAdminAccount ? INITIAL_EQUIPMENT : blank.equipment;

      setBusinessProfile(blank.businessProfile);
      setBaseLocation(blank.baseLocation);
      setPaymentProfile(blank.paymentProfile);
      setSubscription(blank.subscription);
      setProperties(initialProperties);
      setScheduledJobs(initialJobs);
      setInvoices(initialInvoices);
      setExpenses(initialExpenses);
      setEquipment(initialEquipment);
      setSelectedJobId(initialJobs[0]?.id || null);

      const workspacePayload = {
        ...blank,
        properties: initialProperties,
        todayJobs: initialJobs,
        invoices: initialInvoices,
        expenses: initialExpenses,
        equipment: initialEquipment,
      };

      try {
        localStorage.setItem(tenantKey, JSON.stringify(workspacePayload));
      } catch {
        // ignore
      }

      hasHydratedFromCloudRef.current = session.uid;
      const saved = await saveWorkspaceToFirestore(session.uid, {
        ...workspacePayload,
        ownerEmail: session.email,
      });
      setCloudSyncState(saved.ok ? 'synced' : 'idle');
      setCloudSyncMessage(
        saved.ok
          ? 'Cuenta aislada inicializada y sincronizada en la nube.'
          : `Espacio privado inicializado para ${blank.businessProfile.appName} (${blank.baseLocation.city}).`
      );

      if (isAdminAccount) {
        setActiveTab('admin');
      } else if (initialApproval.isApproved) {
        setIsFirstTimeWhiteLabelSetup(true);
        setIsWhiteLabelModalOpen(true);
      }
    },
    []
  );

  // Full Logout Handler — signs out of Firebase, clears active session, and returns to AuthGate
  const handleFullLogout = useCallback(async () => {
    try {
      await signOutFirebase().catch(() => {});
      localStorage.removeItem(ACTIVE_TENANT_SESSION_KEY);
      localStorage.removeItem(LOCAL_MODE_KEY);
    } catch {
      // ignore
    }
    hasHydratedFromCloudRef.current = null;
    setFirebaseUser(null);
    setActiveTenantSession(null);
    setLocalModeAccepted(false);
    setIsAuthModalOpen(false);
    setIsWhiteLabelModalOpen(false);
    setIsSubscriptionModalOpen(false);
    setCloudSyncState('idle');
    setCloudSyncMessage(null);
  }, []);

  // Test Firestore connection at boot & subscribe to Firebase Auth state
  useEffect(() => {
    testFirestoreConnection().catch(() => {});

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        setGoogleUserEmail(user.email || 'Usuario conectado');
        if (hasHydratedFromCloudRef.current !== user.uid) {
          await hydrateTenantWorkspace({
            uid: user.uid,
            email: user.email || 'usuario@pastopro.app',
            displayName: user.displayName || 'Titular',
            isNewRegistration: false,
          });
        }
      } else {
        // Purge any unauthenticated session claiming admin privileges
        setActiveTenantSession((prev) => {
          if (
            prev &&
            (isPrimaryAdminEmail(prev.email) || prev.role === 'admin')
          ) {
            try {
              localStorage.removeItem(ACTIVE_TENANT_SESSION_KEY);
            } catch {
              // ignore
            }
            return null;
          }
          return prev;
        });
      }
    });

    const unsubSheets = initAuth(
      (user) => {
        setGoogleUserEmail(user.email || 'Usuario conectado');
      },
      () => {
        if (!auth.currentUser) {
          setGoogleUserEmail(null);
        }
      }
    );

    return () => {
      unsubAuth();
      unsubSheets();
    };
  }, [hydrateTenantWorkspace]);

  // Real-time subscription to Firestore workspace approval status so admin approvals reflect immediately
  useEffect(() => {
    const uid = activeTenantUid;
    if (!uid || !firebaseUser) return;
    const unsub = subscribeToWorkspaceFirestore(uid, (cloudData) => {
      if (!cloudData) return;
      if (typeof cloudData.isApproved === 'boolean') {
        setActiveTenantSession((prev) => {
          if (!prev) return prev;
          const nextApproved = isPrimaryAdminEmail(prev.email)
            ? true
            : cloudData.isApproved!;
          const nextStatus = isPrimaryAdminEmail(prev.email)
            ? 'approved'
            : cloudData.approvalStatus || (nextApproved ? 'approved' : 'pending');
          if (
            prev.isApproved === nextApproved &&
            prev.approvalStatus === nextStatus
          ) {
            return prev;
          }
          const updated: AuthenticatedTenantSession = {
            ...prev,
            isApproved: nextApproved,
            approvalStatus: nextStatus,
          };
          try {
            localStorage.setItem(
              ACTIVE_TENANT_SESSION_KEY,
              JSON.stringify(updated)
            );
          } catch {
            // ignore
          }
          return updated;
        });
      }
    });
    return () => unsub();
  }, [activeTenantUid, firebaseUser]);

  const handleRefreshApprovalStatus = useCallback(async () => {
    if (!activeTenantSession && !firebaseUser) return;
    setIsCheckingApprovalStatus(true);
    const uid = activeTenantSession?.uid || firebaseUser?.uid || '';
    const email = activeTenantSession?.email || firebaseUser?.email || '';
    try {
      const cloud = await loadWorkspaceFromFirestore(uid);
      const localState = getLocalTenantApprovalState(uid, email);
      const nextApproved = isPrimaryAdminEmail(email)
        ? true
        : typeof cloud.data?.isApproved === 'boolean'
        ? cloud.data.isApproved
        : localState.isApproved;
      const nextStatus = isPrimaryAdminEmail(email)
        ? 'approved'
        : cloud.data?.approvalStatus || localState.approvalStatus;

      if (activeTenantSession) {
        const updated: AuthenticatedTenantSession = {
          ...activeTenantSession,
          isApproved: nextApproved,
          approvalStatus: nextStatus,
        };
        setActiveTenantSession(updated);
        localStorage.setItem(
          ACTIVE_TENANT_SESSION_KEY,
          JSON.stringify(updated)
        );
      }
      if (nextApproved) {
        showBanner(
          '¡Tu licencia de pago único fue aprobada por el administrador! Bienvenido a PastoPro.'
        );
      } else {
        showBanner(
          'Tu cuenta continúa pendiente de validación de pago por el administrador.'
        );
      }
    } finally {
      setIsCheckingApprovalStatus(false);
    }
  }, [activeTenantSession, firebaseUser, showBanner]);

  // Automatically sync changes to Firestore when user is logged in
  useEffect(() => {
    const uid = activeTenantUid;
    if (!uid || hasHydratedFromCloudRef.current !== uid) {
      return;
    }
    const timer = window.setTimeout(async () => {
      if (firebaseUser) {
        setCloudSyncState('syncing');
        const res = await saveWorkspaceToFirestore(uid, {
          businessProfile,
          baseLocation,
          paymentProfile,
          subscription,
          properties,
          todayJobs: scheduledJobs,
          invoices,
          expenses,
          equipment,
          ownerEmail: firebaseUser.email || activeTenantSession?.email,
        });
        setCloudSyncState(res.ok ? 'synced' : 'idle');
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    activeTenantUid,
    firebaseUser,
    activeTenantSession,
    businessProfile,
    baseLocation,
    paymentProfile,
    subscription,
    properties,
    scheduledJobs,
    invoices,
    expenses,
    equipment,
  ]);

  const handleForceCloudSync = async () => {
    const uid = activeTenantUid;
    if (!uid) {
      setIsAuthModalOpen(true);
      return;
    }
    setCloudSyncState('syncing');
    const res = await saveWorkspaceToFirestore(uid, {
      businessProfile,
      baseLocation,
      paymentProfile,
      subscription,
      properties,
      todayJobs: scheduledJobs,
      invoices,
      expenses,
      equipment,
      ownerEmail: firebaseUser?.email || activeTenantSession?.email,
    });
    if (res.ok) {
      setCloudSyncState('synced');
      const nowStr = new Date().toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setCloudSyncMessage(
        `Sincronizado en la nube a las ${nowStr}.`
      );
      showBanner('Datos respaldados en la nube.');
    } else {
      setCloudSyncState('idle');
      setCloudSyncMessage(
        `Datos guardados en tu cuenta aislada (${uid.slice(0, 12)}).`
      );
      showBanner('Datos respaldados en tu espacio aislado.');
    }
  };

  // Close active modal when pressing Escape & toggle Command Palette with Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }
      if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setIsAuthModalOpen(false);
        setIsBaseModalOpen(false);
        setIsBusinessProfileModalOpen(false);
        setIsWhiteLabelModalOpen(false);
        setIsSubscriptionModalOpen(false);
        setIsOfflineAndAliasModalOpen(false);
        setJobToComplete(null);
        setEditingScheduledJob(null);
        setEditingInvoice(null);
        setHistoryClientModal(null);
        setIsClientModalOpen(false);
        setEditingClient(null);
        setScheduleModalState((prev) => ({ ...prev, isOpen: false }));
        setDeleteDialog((prev) => ({ ...prev, isOpen: false }));
        setSelectedInvoiceReceipt(null);
        setSheetsConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = `${businessProfile.appName} — Gestión de Césped (${baseLocation.city})`;
    }
  }, [businessProfile.appName, baseLocation.city]);

  // Persist operational state automatically to the isolated tenant localStorage key
  useEffect(() => {
    try {
      localStorage.setItem(
        currentStorageKey,
        JSON.stringify({
          businessProfile,
          baseLocation,
          paymentProfile,
          subscription,
          properties,
          todayJobs: scheduledJobs,
          invoices,
          expenses,
          equipment,
        })
      );
    } catch {
      // ignore quota errors
    }
  }, [
    currentStorageKey,
    businessProfile,
    baseLocation,
    paymentProfile,
    subscription,
    properties,
    scheduledJobs,
    invoices,
    expenses,
    equipment,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem(
        SHEETS_META_KEY,
        JSON.stringify({
          spreadsheetId: connectedSpreadsheetId,
          spreadsheetUrl: connectedSpreadsheetUrl,
          lastSyncedAt,
        })
      );
    } catch {
      // ignore
    }
  }, [connectedSpreadsheetId, connectedSpreadsheetUrl, lastSyncedAt]);

  const handleUpdateBaseLocation = (newBase: BaseLocationConfig) => {
    triggerDailyJobsTransition('reload', 280);
    setBaseLocation(newBase);
    setScheduledJobs((prev) =>
      recalculateJobsFromDynamicBase(newBase.coordinates, prev)
    );
    showBanner(
      `Punto de partida actualizado: ${newBase.city} (${newBase.address}). Distancias y tiempos de ruta recalculados.`
    );
  };

  const handleUseCurrentGps = () => {
    if (!navigator.geolocation) {
      showBanner('Tu navegador no soporta geolocalización GPS directa.');
      return;
    }
    setIsLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingGps(false);
        const lat = Math.round(pos.coords.latitude * 10000) / 10000;
        const lng = Math.round(pos.coords.longitude * 10000) / 10000;
        const nowStr = new Date().toLocaleTimeString('es-AR', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const newGpsBase: BaseLocationConfig = {
          name: 'Ubicación Actual GPS en Calle',
          city: baseLocation.city || 'Mi Ubicación GPS',
          address: `Coordenadas GPS (${lat}, ${lng})`,
          coordinates: { lat, lng },
          source: 'gps',
          updatedAt: nowStr,
        };
        handleUpdateBaseLocation(newGpsBase);
      },
      () => {
        setIsLocatingGps(false);
        setIsBaseModalOpen(true);
        showBanner(
          'Permiso de GPS bloqueado en este navegador. Selecciona o escribe tu calle/ciudad de partida aquí.'
        );
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const shiftActiveDate = (daysDelta: number) => {
    const base = new Date(`${activeDate}T12:00:00Z`);
    if (Number.isNaN(base.getTime())) return;
    base.setUTCDate(base.getUTCDate() + daysDelta);
    triggerDailyJobsTransition('date', 280);
    setActiveDate(base.toISOString().slice(0, 10));
  };

  const handleSetSpreadsheetIdInput = (idOrUrl: string) => {
    const match = idOrUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      setConnectedSpreadsheetId(match[1]);
      setConnectedSpreadsheetUrl(
        `https://docs.google.com/spreadsheets/d/${match[1]}/edit`
      );
    } else {
      setConnectedSpreadsheetId(idOrUrl.trim());
      if (idOrUrl.trim().length > 15) {
        setConnectedSpreadsheetUrl(
          `https://docs.google.com/spreadsheets/d/${idOrUrl.trim()}/edit`
        );
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUserEmail(result.user.email || 'Cuenta Google Conectada');
        showBanner(
          `Conectado a Google Sheets como ${result.user.email || 'usuario'}.`
        );
      }
    } catch {
      showBanner(
        'No se completó el inicio de sesión con Google. Intenta de nuevo.'
      );
    }
  };

  const handleGoogleLogout = async () => {
    await logoutGoogle();
    setGoogleUserEmail(null);
    showBanner('Sesión de Google cerrada.');
  };

  const executeCreateAndSyncSheet = async () => {
    setIsSyncingSheets(true);
    try {
      let token = await getAccessToken();
      if (!token) {
        const loginRes = await googleSignIn();
        token = loginRes?.accessToken || null;
        if (loginRes?.user) {
          setGoogleUserEmail(loginRes.user.email || 'Conectado');
        }
      }
      if (!token) {
        showBanner(
          'Conecta primero tu cuenta de Google para crear la planilla.'
        );
        return;
      }

      const created = await createPastoProSpreadsheet(
        token,
        `${businessProfile.appName} — Control ${baseLocation.city} y Zona`
      );
      setConnectedSpreadsheetId(created.spreadsheetId);
      setConnectedSpreadsheetUrl(created.spreadsheetUrl);

      await syncAllDataToGoogleSheet(token, created.spreadsheetId, {
        properties,
        invoices,
        expenses,
      });

      const nowStr = new Date().toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setLastSyncedAt(`Hoy a las ${nowStr}`);
      showBanner('¡Planilla creada y sincronizada en tu Google Sheets!');
    } catch (err: any) {
      showBanner(
        err?.message || 'Error al crear la planilla en Google Sheets.'
      );
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const executeSyncExistingSheet = async () => {
    if (!connectedSpreadsheetId.trim()) {
      setActiveTab('respaldo');
      setSheetsConfirmDialog({ isOpen: true, actionType: 'create' });
      return;
    }

    setIsSyncingSheets(true);
    try {
      let token = await getAccessToken();
      if (!token) {
        const loginRes = await googleSignIn();
        token = loginRes?.accessToken || null;
        if (loginRes?.user) {
          setGoogleUserEmail(loginRes.user.email || 'Conectado');
        }
      }
      if (!token) {
        showBanner('Inicia sesión con Google para actualizar la planilla.');
        return;
      }

      const res = await syncAllDataToGoogleSheet(
        token,
        connectedSpreadsheetId.trim(),
        {
          properties,
          invoices,
          expenses,
        }
      );
      setConnectedSpreadsheetUrl(res.spreadsheetUrl);
      const nowStr = new Date().toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setLastSyncedAt(`Hoy a las ${nowStr}`);
      showBanner(
        `¡Planilla de Google Sheets actualizada (${res.updatedCells} celdas)!`
      );
    } catch (err: any) {
      showBanner(err?.message || 'Error al sincronizar con Google Sheets.');
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const routeMetrics = useMemo(() => {
    let dist = 0;
    let driveMin = 0;
    let workMin = 0;
    for (const j of activeDateJobs) {
      dist += j.legDistanceKm || 2.1;
      driveMin += j.legDurationMin || 6;
      workMin += j.estimatedMinutes;
    }
    return {
      totalDistanceKm: Math.round(dist * 10) / 10,
      totalDriveMinutes: driveMin,
      totalWorkMinutes: workMin,
      completedCount: activeDateJobs.filter((j) => j.status === 'Completado')
        .length,
      pendingCount: activeDateJobs.filter((j) => j.status !== 'Completado')
        .length,
      expectedRevenueToday: activeDateJobs.reduce((acc, j) => acc + j.price, 0),
    };
  }, [activeDateJobs]);

  const agronomicAdvisory = useMemo(
    () =>
      computeAgronomicCuttingWindow(
        activeDate,
        baseLocation.city,
        activeDayWeather.tempMax,
        activeDayWeather.condition
      ),
    [
      activeDate,
      baseLocation.city,
      activeDayWeather.tempMax,
      activeDayWeather.condition,
    ]
  );

  const handleOptimizeRoute = async () => {
    triggerDailyJobsTransition('optimize', 300);
    let result = optimizeRouteWith2Opt(
      baseLocation.coordinates,
      activeDateJobs
    );
    try {
      const response = await fetch('/api/route/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseCoords: baseLocation.coordinates,
          jobs: activeDateJobs,
        }),
      });
      if (response.ok) {
        const apiData = await response.json();
        if (apiData?.ok && Array.isArray(apiData.optimizedJobs)) {
          result = apiData;
        }
      }
    } catch {
      // Fallback transparently to local 2-Opt solver when offline
    }

    setScheduledJobs((prev) => {
      const otherDays = prev.filter((j) => j.scheduledDate !== activeDate);
      return [...otherDays, ...result.optimizedJobs];
    });
    const savingsNote =
      result.distanceSavedKm > 0
        ? ` · Ahorro 2-Opt: ${result.distanceSavedKm} km (${result.estimatedMinutesSaved} min · ${result.fuelSavedMl} ml mezcla)`
        : '';
    showBanner(
      `Ruta 2-Opt optimizada desde ${baseLocation.city}: ${result.optimizedJobs.length} paradas (${result.optimizedDistanceKm} km estimados${savingsNote}).`
    );
  };

  const handleRainDelayForDate = (targetDateStr = activeDate) => {
    triggerDailyJobsTransition('reload', 280);
    setScheduledJobs((prev) =>
      reschedulePendingJobsForRain(prev, 1, targetDateStr)
    );
    showBanner(
      `Paradas pendientes del ${targetDateStr} reprogramadas +24 hs en el calendario por alerta de lluvia / barro.`
    );
  };

  const handleRainDelay = () => handleRainDelayForDate(activeDate);

  const handleBulkUpdatePrices = (percent: number, onlyOutdated: boolean) => {
    const { updatedProperties, updatedJobs, updatedCount } =
      applyBulkPriceIncrease(
        properties,
        scheduledJobs,
        percent,
        onlyOutdated,
        TODAY_REFERENCE
      );
    setProperties(updatedProperties);
    setScheduledJobs(updatedJobs);
    const { queuedOffline } = recordAction(
      'BULK_PRICE_UPDATE',
      `Actualización de tarifas (+${percent}%)`,
      `${updatedCount} clientes actualizados`
    );
    showBanner(
      `Tarifas actualizadas +${percent}% en ${updatedCount} clientes (redondeado a $500).${
        queuedOffline ? ' Guardado en cola offline del Service Worker.' : ''
      }`
    );
  };

  const handleStartJob = (jobId: string, forceTimerToggle = false) => {
    const targetJob = scheduledJobs.find((j) => j.id === jobId);
    const nowTime = new Date().toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (forceTimerToggle) {
      setScheduledJobs((prev) =>
        prev.map((j) =>
          j.id === jobId && j.status === 'Pendiente'
            ? { ...j, status: 'En Curso', startedAt: j.startedAt || nowTime }
            : j
        )
      );
      if (targetJob) {
        setActiveCutTimer((prev) => {
          if (prev?.jobId === jobId) {
            return { ...prev, isRunning: !prev.isRunning };
          }
          return {
            jobId,
            clientName: targetJob.clientName,
            elapsedSeconds: 0,
            isRunning: true,
          };
        });
      }
      setSelectedJobId(jobId);
      return;
    }

    const willBeInProgress = targetJob?.status !== 'En Curso';

    setScheduledJobs((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? {
              ...j,
              status: j.status === 'En Curso' ? 'Pendiente' : 'En Curso',
              startedAt: j.status === 'En Curso' ? undefined : nowTime,
            }
          : j
      )
    );

    if (targetJob) {
      setActiveCutTimer((prev) => {
        if (prev?.jobId === jobId) {
          return { ...prev, isRunning: willBeInProgress };
        }
        return {
          jobId,
          clientName: targetJob.clientName,
          elapsedSeconds: 0,
          isRunning: willBeInProgress,
        };
      });
    }
    setSelectedJobId(jobId);
  };

  const handleMoveJobOrder = (jobId: string, direction: 'up' | 'down') => {
    setScheduledJobs((prev) =>
      moveScheduledJobOrder(baseLocation.coordinates, prev, jobId, direction)
    );
  };

  const handleUndoCompletedJob = (jobId: string) => {
    setScheduledJobs((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? { ...j, status: 'Pendiente', completedAt: undefined }
          : j
      )
    );
    showBanner('Corte reabierto como Pendiente.');
  };

  const handleRemoveStopFromSchedule = (jobId: string, clientName: string) => {
    setScheduledJobs((prev) => prev.filter((j) => j.id !== jobId));
    showBanner(`Se quitó el corte programado de "${clientName}" de la agenda.`);
  };

  const handleUpdateScheduledJob = (
    updatedJob: ScheduledJob,
    alsoUpdateClientProperty: boolean
  ) => {
    const { updatedJobs, updatedProperties } = updateScheduledJobInState(
      baseLocation.coordinates,
      scheduledJobs,
      properties,
      updatedJob,
      alsoUpdateClientProperty
    );
    setScheduledJobs(updatedJobs);
    setProperties(updatedProperties);
    setActiveDate(updatedJob.scheduledDate);
    setSelectedJobId(updatedJob.id);

    const { queuedOffline } = recordAction(
      'UPDATE_SCHEDULED_JOB',
      `Cita modificada: ${updatedJob.clientName}`,
      `${updatedJob.scheduledDate} a las ${updatedJob.scheduledTime} hs · $${updatedJob.price.toLocaleString('es-AR')}`
    );

    showBanner(
      `Cita de "${updatedJob.clientName}" actualizada para el ${updatedJob.scheduledDate} a las ${updatedJob.scheduledTime} hs ($${updatedJob.price.toLocaleString('es-AR')}).${
        queuedOffline ? ' Guardado en cola offline.' : ''
      }`
    );
  };

  const handleConfirmCompleteJob = (
    jobId: string,
    paidNow: boolean,
    paymentMethod: PaymentMethod,
    finalPrice: number,
    updateClientBasePrice: boolean,
    photoUrl?: string,
    actualDurationMinutes?: number,
    customNextVisitDate?: string | null,
    beforePhotos?: string[],
    afterPhotos?: string[]
  ) => {
    const targetJob = scheduledJobs.find((j) => j.id === jobId);
    if (!targetJob) return;

    const resolvedDuration =
      typeof actualDurationMinutes === 'number' && actualDurationMinutes > 0
        ? Math.round(actualDurationMinutes)
        : activeCutTimer?.jobId === jobId && activeCutTimer.elapsedSeconds > 0
        ? Math.max(1, Math.round(activeCutTimer.elapsedSeconds / 60))
        : targetJob.actualDurationMinutes || targetJob.estimatedMinutes;

    const adjustedJob: ScheduledJob = {
      ...targetJob,
      price: finalPrice,
      photoUrl: photoUrl || targetJob.photoUrl,
      beforePhotos: beforePhotos ?? targetJob.beforePhotos,
      afterPhotos: afterPhotos ?? targetJob.afterPhotos,
      actualDurationMinutes: resolvedDuration,
    };
    const sequenceNumber = invoices.length + 1;
    const { updatedJob, invoice } = completeJobAndCreateInvoice(
      adjustedJob,
      paidNow,
      paymentMethod,
      targetJob.scheduledDate,
      sequenceNumber,
      photoUrl,
      resolvedDuration,
      beforePhotos,
      afterPhotos
    );

    if (customNextVisitDate !== undefined) {
      invoice.nextScheduledDate =
        customNextVisitDate || 'Servicio puntual / A coordinar';
    }

    setScheduledJobs((prev) =>
      prev.map((j) => (j.id === jobId ? updatedJob : j))
    );
    setInvoices((prev) => [invoice, ...prev]);

    setProperties((prev) =>
      prev.map((prop) => {
        if (prop.id !== targetJob.propertyId) return prop;
        const baseUpdated: ClientProperty = {
          ...prop,
          basePrice: updateClientBasePrice ? finalPrice : prop.basePrice,
          lastCutDate: targetJob.scheduledDate,
          nextCutDate: invoice.nextScheduledDate,
        };
        return appendJobPhotosToClientProperty(
          baseUpdated,
          invoice,
          beforePhotos || [],
          afterPhotos || []
        );
      })
    );

    if (activeCutTimer?.jobId === jobId) {
      setActiveCutTimer(null);
    }

    const totalSavedPhotos =
      (beforePhotos?.length || 0) + (afterPhotos?.length || 0);

    const { queuedOffline } = recordAction(
      'COMPLETE_JOB',
      `Corte completado: ${targetJob.clientName}`,
      `${invoice.invoiceNumber} · $${finalPrice.toLocaleString('es-AR')} · ${resolvedDuration} min${
        totalSavedPhotos > 0 ? ` · ${totalSavedPhotos} fotos Antes/Después` : ''
      } (${paidNow ? paymentMethod : 'Cuenta Cte.'})`
    );

    setJobToComplete(null);
    setSelectedInvoiceReceipt(invoice);
    showBanner(
      `Corte finalizado en ${targetJob.clientName} (${resolvedDuration} min${
        totalSavedPhotos > 0 ? `, ${totalSavedPhotos} fotos guardadas en ficha y facturación` : ''
      }). Recibo ${invoice.invoiceNumber} emitido por $${finalPrice.toLocaleString('es-AR')}.${
        queuedOffline
          ? ' Guardado en cola offline para sincronizar al recuperar señal.'
          : ''
      }`
    );
  };

  const handleAddClientPhotos = (
    propertyId: string,
    stage: JobPhotoStage,
    photoUrls: string[]
  ) => {
    if (!photoUrls || photoUrls.length === 0) return;
    setProperties((prev) =>
      prev.map((prop) => {
        if (prop.id !== propertyId) return prop;
        const newItems = photoUrls.map((url, idx) => ({
          id: `ph-manual-${propertyId}-${stage}-${Date.now()}-${idx}`,
          stage,
          url,
          caption: `${stage === 'antes' ? 'Antes' : 'Después'} · ${prop.clientName}`,
          takenAt: activeDate,
          propertyId: prop.id,
          clientName: prop.clientName,
          address: prop.address,
          neighborhood: prop.neighborhood,
          areaSqm: prop.areaSqm,
          amount: prop.basePrice,
        }));
        const updatedProp: ClientProperty = {
          ...prop,
          photoGallery: [...newItems, ...(prop.photoGallery || [])],
        };
        if (historyClientModal?.id === propertyId) {
          setHistoryClientModal(updatedProp);
        }
        return updatedProp;
      })
    );
    showBanner(
      `${photoUrls.length} ${photoUrls.length === 1 ? 'foto agregada' : 'fotos agregadas'} (${
        stage === 'antes' ? 'Antes' : 'Después'
      }) en la ficha del cliente.`
    );
  };

  const handleSaveClient = (
    savedProp: ClientProperty,
    scheduleOptions: {
      shouldSchedule: boolean;
      scheduledDate: string;
      scheduledTime: string;
    },
    isEditing: boolean
  ) => {
    if (isEditing) {
      setProperties((prev) =>
        prev.map((p) => (p.id === savedProp.id ? savedProp : p))
      );
      setScheduledJobs((prev) =>
        prev.map((j) =>
          j.propertyId === savedProp.id
            ? {
                ...j,
                clientName: savedProp.clientName,
                phone: savedProp.phone,
                address: savedProp.address,
                neighborhood: savedProp.neighborhood,
                propertyType: savedProp.propertyType,
                areaSqm: savedProp.areaSqm,
                frequency: savedProp.frequency,
                price: savedProp.basePrice,
                accessNotes: savedProp.accessNotes,
                estimatedMinutes: savedProp.estimatedMinutes,
              }
            : j
        )
      );
      recordAction(
        'UPDATE_CLIENT',
        `Cliente editado: ${savedProp.clientName}`,
        `${savedProp.address} · $${savedProp.basePrice.toLocaleString('es-AR')}`
      );
      if (scheduleOptions.shouldSchedule) {
        handleConfirmScheduleJob(
          savedProp,
          scheduleOptions.scheduledDate,
          scheduleOptions.scheduledTime,
          savedProp.basePrice
        );
      } else {
        showBanner(`Datos de "${savedProp.clientName}" actualizados.`);
      }
      return;
    }

    setProperties((prev) => [savedProp, ...prev]);

    const { queuedOffline } = recordAction(
      'CREATE_CLIENT',
      `Nuevo cliente creado: ${savedProp.clientName}`,
      `${savedProp.neighborhood} · $${savedProp.basePrice.toLocaleString('es-AR')}`
    );

    if (scheduleOptions.shouldSchedule) {
      const targetDate = scheduleOptions.scheduledDate || activeDate;
      const targetTime = scheduleOptions.scheduledTime || '08:30';
      const newJob: ScheduledJob = {
        id: `job-${Date.now()}`,
        propertyId: savedProp.id,
        clientName: savedProp.clientName,
        phone: savedProp.phone,
        address: savedProp.address,
        neighborhood: savedProp.neighborhood,
        propertyType: savedProp.propertyType,
        areaSqm: savedProp.areaSqm,
        frequency: savedProp.frequency,
        scheduledDate: targetDate,
        scheduledTime: targetTime,
        orderIndex:
          scheduledJobs.filter((j) => j.scheduledDate === targetDate).length +
          1,
        status: 'Pendiente',
        tasks: savedProp.defaultTasks,
        price: savedProp.basePrice,
        accessNotes: savedProp.accessNotes,
        coordinates: savedProp.coordinates,
        estimatedMinutes: savedProp.estimatedMinutes,
      };

      setScheduledJobs((prev) =>
        recalculateJobsFromDynamicBase(baseLocation.coordinates, [
          ...prev,
          newJob,
        ])
      );
      setActiveDate(targetDate);
      setSelectedJobId(newJob.id);
      showBanner(
        `Cliente "${savedProp.clientName}" guardado y agendado para el ${targetDate} a las ${targetTime} hs.${
          queuedOffline ? ' (En cola local offline)' : ''
        }`
      );
    } else {
      showBanner(
        `Cliente "${savedProp.clientName}" guardado en la cartera.${
          queuedOffline ? ' (En cola local offline)' : ''
        }`
      );
    }
  };

  const handleConfirmScheduleJob = (
    property: ClientProperty,
    scheduledDate: string,
    scheduledTime: string,
    customPrice: number
  ) => {
    const newJob: ScheduledJob = {
      id: `job-${Date.now()}`,
      propertyId: property.id,
      clientName: property.clientName,
      phone: property.phone,
      address: property.address,
      neighborhood: property.neighborhood,
      propertyType: property.propertyType,
      areaSqm: property.areaSqm,
      frequency: property.frequency,
      scheduledDate,
      scheduledTime,
      orderIndex:
        scheduledJobs.filter((j) => j.scheduledDate === scheduledDate).length +
        1,
      status: 'Pendiente',
      tasks: property.defaultTasks,
      price: customPrice,
      accessNotes: property.accessNotes,
      coordinates: property.coordinates,
      estimatedMinutes: property.estimatedMinutes,
    };

    setScheduledJobs((prev) =>
      recalculateJobsFromDynamicBase(baseLocation.coordinates, [
        ...prev,
        newJob,
      ])
    );
    setProperties((prev) =>
      prev.map((p) =>
        p.id === property.id ? { ...p, nextCutDate: scheduledDate } : p
      )
    );
    recordAction(
      'SCHEDULE_JOB',
      `Corte agendado: ${property.clientName}`,
      `${scheduledDate} a las ${scheduledTime} hs · $${customPrice.toLocaleString('es-AR')}`
    );
    setActiveDate(scheduledDate);
    setSelectedJobId(newJob.id);
    showBanner(
      `Corte agendado: ${property.clientName} el ${scheduledDate} a las ${scheduledTime} hs.`
    );
  };

  const handleRequestDeleteClient = (property: ClientProperty) => {
    setDeleteDialog({
      isOpen: true,
      title: `¿Eliminar a ${property.clientName}?`,
      description: `Se eliminará la propiedad en ${property.address} (${property.neighborhood}) de la cartera y sus cortes pendientes. El historial de recibos en Caja se conservará.`,
      confirmLabel: 'Sí, Eliminar Cliente',
      onConfirm: () => {
        const { remainingProperties, remainingJobs } =
          deleteClientPropertyFromState(properties, scheduledJobs, property.id);
        setProperties(remainingProperties);
        setScheduledJobs(remainingJobs);
        showBanner(`Cliente "${property.clientName}" eliminado de la cartera.`);
      },
    });
  };

  const handleAddPropertyToToday = (property: ClientProperty) => {
    if (
      activeDateJobs.some(
        (j) => j.propertyId === property.id && j.scheduledDate === activeDate
      )
    ) {
      return;
    }
    handleConfirmScheduleJob(property, activeDate, '09:30', property.basePrice);
    setActiveTab('ruta');
  };

  const handleSaveBusinessAndPayment = (
    updatedBusiness: BusinessProfileConfig,
    updatedPayment: PaymentProfileConfig
  ) => {
    setBusinessProfile(updatedBusiness);
    setPaymentProfile(updatedPayment);
    recordAction(
      'UPDATE_BUSINESS_PROFILE',
      `Emprendimiento actualizado: ${updatedBusiness.appName}`,
      `Tarifa base $${updatedBusiness.baseRatePerSqm}/m² · Mín. $${updatedBusiness.minServicePrice.toLocaleString('es-AR')} · Alias ${updatedPayment.alias}`
    );
    showBanner(
      `Identidad actualizada: "${updatedBusiness.appName}" ($${updatedBusiness.baseRatePerSqm}/m², mín. $${updatedBusiness.minServicePrice.toLocaleString('es-AR')}).`
    );
  };

  const handleUpdateInvoice = (
    updatedInvoice: InvoiceRecord,
    syncClientBasePrice: boolean
  ) => {
    const { updatedInvoices, updatedJobs, updatedProperties } =
      updateInvoiceRecordInState(
        invoices,
        scheduledJobs,
        properties,
        updatedInvoice,
        syncClientBasePrice
      );
    setInvoices(updatedInvoices);
    setScheduledJobs(updatedJobs);
    setProperties(updatedProperties);
    if (selectedInvoiceReceipt?.id === updatedInvoice.id) {
      setSelectedInvoiceReceipt(updatedInvoice);
    }
    recordAction(
      'UPDATE_INVOICE',
      `Recibo editado: ${updatedInvoice.invoiceNumber}`,
      `${updatedInvoice.clientName} · $${updatedInvoice.amount.toLocaleString('es-AR')} (${updatedInvoice.status})`
    );
    showBanner(
      `Recibo ${updatedInvoice.invoiceNumber} de "${updatedInvoice.clientName}" actualizado ($${updatedInvoice.amount.toLocaleString('es-AR')}).`
    );
  };

  const handleToggleInvoicePaid = (invoiceId: string) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId) return inv;
        const nextPaid = inv.status === 'Pendiente';
        return {
          ...inv,
          status: nextPaid ? 'Pagado' : 'Pendiente',
          paymentMethod: nextPaid ? 'Transferencia' : undefined,
          paidAt: nextPaid ? activeDate : undefined,
        };
      })
    );
  };

  const handleDeleteInvoice = (invoiceId: string) => {
    setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
    showBanner('Comprobante eliminado del registro.');
  };

  const handleAddExpense = (exp: Omit<OperationalExpense, 'id'>) => {
    setExpenses((prev) => [{ ...exp, id: `exp-${Date.now()}` }, ...prev]);
    showBanner(
      `Gasto de $${exp.amount.toLocaleString('es-AR')} registrado en Caja.`
    );
  };

  const handleUpdateExpense = (updatedExp: OperationalExpense) => {
    setExpenses((prev) => updateOperationalExpenseInState(prev, updatedExp));
    recordAction(
      'UPDATE_EXPENSE',
      `Gasto editado: ${updatedExp.category}`,
      `${updatedExp.description} · $${updatedExp.amount.toLocaleString('es-AR')}`
    );
    showBanner(
      `Gasto "${updatedExp.description}" actualizado ($${updatedExp.amount.toLocaleString('es-AR')}).`
    );
  };

  const handleDeleteExpense = (expenseId: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
    showBanner('Gasto eliminado de Caja.');
  };

  const handleLogEquipmentHours = (equipmentId: string, hours: number) => {
    setEquipment((prev) =>
      prev.map((item) =>
        item.id === equipmentId
          ? {
              ...item,
              hoursUsed: Math.round((item.hoursUsed + hours) * 10) / 10,
            }
          : item
      )
    );
  };

  const handleResetEquipmentService = (equipmentId: string) => {
    setEquipment((prev) =>
      prev.map((item) =>
        item.id === equipmentId
          ? { ...item, hoursUsed: 0, lastServiceDate: activeDate }
          : item
      )
    );
    showBanner('Service de máquina registrado (contador reiniciado a 0 hs).');
  };

  const handleAddEquipment = (item: Omit<EquipmentItem, 'id'>) => {
    setEquipment((prev) => [...prev, { ...item, id: `eq-${Date.now()}` }]);
    showBanner(`Máquina "${item.name}" sumada al control de horas.`);
  };

  const handleUpdateEquipment = (updatedItem: EquipmentItem) => {
    setEquipment((prev) => updateEquipmentItemInState(prev, updatedItem));
    recordAction(
      'UPDATE_EQUIPMENT',
      `Máquina editada: ${updatedItem.name}`,
      `${updatedItem.hoursUsed}/${updatedItem.serviceLimitHours} hs · ${updatedItem.nextTask}`
    );
    showBanner(`Datos de máquina "${updatedItem.name}" actualizados.`);
  };

  const handleDeleteEquipment = (equipmentId: string) => {
    setEquipment((prev) => prev.filter((e) => e.id !== equipmentId));
    showBanner('Máquina eliminada de la lista.');
  };

  const handleExportCsv = () => {
    const csvContent = generateSpreadsheetCsv(properties, invoices, expenses);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${businessProfile.appName.replace(/\s+/g, '')}_${baseLocation.city.replace(/\s+/g, '')}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showBanner('Planilla .CSV descargada.');
  };

  const handleCopyGoogleSheetsTsv = () => {
    const tsv = generateGoogleSheetsTsv(properties, invoices);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(tsv).catch(() => {});
    }
    showBanner('¡Tabla copiada! Abre Google Sheets y toca "Pegar".');
  };

  const handleExportJsonBackup = () => {
    const payload: BackupPayload = {
      version: '6.0',
      exportedAt: new Date().toISOString(),
      businessProfile,
      baseLocation,
      properties,
      todayJobs: scheduledJobs,
      invoices,
      expenses,
      equipment,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${businessProfile.appName.replace(/\s+/g, '')}_Respaldo_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showBanner('Copia de seguridad .JSON descargada.');
  };

  const handleImportJsonBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rawParsed = JSON.parse(String(reader.result));
        const safeBackup = sanitizeAndValidateBackupPayload(rawParsed);
        if (!safeBackup) {
          showBanner('Archivo .json inválido o sin datos compatibles.');
          return;
        }
        if (safeBackup.businessProfile && safeBackup.businessProfile.appName) {
          setBusinessProfile({
            ...DEFAULT_BUSINESS_PROFILE,
            ...safeBackup.businessProfile,
          });
        }
        if (safeBackup.baseLocation) setBaseLocation(safeBackup.baseLocation);
        if (Array.isArray(safeBackup.properties))
          setProperties(safeBackup.properties);
        if (Array.isArray(safeBackup.todayJobs))
          setScheduledJobs(safeBackup.todayJobs);
        if (Array.isArray(safeBackup.invoices))
          setInvoices(safeBackup.invoices);
        if (Array.isArray(safeBackup.expenses))
          setExpenses(safeBackup.expenses);
        if (Array.isArray(safeBackup.equipment))
          setEquipment(safeBackup.equipment);
        showBanner('¡Copia de seguridad validada y restaurada con éxito!');
      } catch {
        showBanner('No se pudo leer el archivo .json.');
      }
    };
    reader.readAsText(file);
  };

  const handleRequestClearAllData = () => {
    setDeleteDialog({
      isOpen: true,
      title: '¿Vaciar datos de prueba para empezar de cero?',
      description:
        'Se borrarán todos los clientes, paradas y recibos de demostración para que carguen únicamente sus clientes reales.',
      confirmLabel: 'Sí, Empezar de Cero',
      onConfirm: () => {
        setProperties([]);
        setScheduledJobs([]);
        setInvoices([]);
        setExpenses([]);
        showBanner('Aplicación en cero lista para tus clientes reales.');
      },
    });
  };

  const handleRestoreDemoData = () => {
    triggerDailyJobsTransition('reload', 300);
    setBaseLocation(BASE_DEPOT);
    setProperties(INITIAL_PROPERTIES);
    setScheduledJobs(
      recalculateJobsFromDynamicBase(BASE_DEPOT.coordinates, INITIAL_TODAY_JOBS)
    );
    setInvoices(INITIAL_INVOICES);
    setExpenses(INITIAL_EXPENSES);
    setEquipment(INITIAL_EQUIPMENT);
    setActiveDate(TODAY_REFERENCE);
    showBanner('Datos de demostración restaurados.');
  };

  const handleReloadDailyRouteData = () => {
    triggerDailyJobsTransition('reload', 280);
    setScheduledJobs((prev) =>
      recalculateJobsFromDynamicBase(baseLocation.coordinates, prev)
    );
  };

  const handleAddTaskToJob = (
    jobId: string,
    taskText: string,
    extraAmountArs: number
  ) => {
    setScheduledJobs((prev) =>
      addTaskAndSurchargeToScheduledJob(prev, jobId, taskText, extraAmountArs)
    );
  };

  const fullRouteGoogleMapsUrl = useMemo(() => {
    const pendingStops = activeDateJobs.filter(
      (j) => j.status !== 'Completado'
    );
    if (pendingStops.length === 0) {
      return buildGoogleMapsNavUrl(baseLocation.coordinates);
    }
    const lastStop = pendingStops[pendingStops.length - 1];
    const waypoints = pendingStops.slice(0, -1).map((s) => s.coordinates);
    return buildGoogleMapsNavUrl(lastStop.coordinates, waypoints);
  }, [activeDateJobs, baseLocation]);

  const isMoreSectionActive =
    activeTab === 'facturacion' ||
    activeTab === 'cotizador' ||
    activeTab === 'respaldo';

  const filteredActiveDateJobs = useMemo(() => {
    return activeDateJobs.filter((j) => {
      if (routeStatusFilter === 'pendientes' && j.status === 'Completado') {
        return false;
      }
      if (routeStatusFilter === 'completados' && j.status !== 'Completado') {
        return false;
      }
      if (routeSearchQuery.trim()) {
        const q = routeSearchQuery.toLowerCase().trim();
        const matches =
          j.clientName.toLowerCase().includes(q) ||
          j.address.toLowerCase().includes(q) ||
          j.neighborhood.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [activeDateJobs, routeStatusFilter, routeSearchQuery]);

  const dailyJobsSkeletonState = useMemo(
    () =>
      getWorkOrdersSkeletonDescriptors(
        filteredActiveDateJobs.length || activeDateJobs.length || 3,
        dailyJobsTransitionReason
      ),
    [
      filteredActiveDateJobs.length,
      activeDateJobs.length,
      dailyJobsTransitionReason,
    ]
  );

  const completionRatio =
    activeDateJobs.length > 0
      ? Math.round((routeMetrics.completedCount / activeDateJobs.length) * 100)
      : 0;

  const activeWeekDays = useMemo(
    () => buildWeekDaysForDate(activeDate, scheduledJobs, TODAY_REFERENCE),
    [activeDate, scheduledJobs]
  );

  const subscriptionEval = useMemo(
    () => evaluateSubscriptionStatus(subscription, activeDate),
    [subscription, activeDate]
  );

  const isAccountApproved = useMemo(() => {
    if (localModeAccepted && !activeTenantSession && !firebaseUser) {
      return true;
    }
    if (firebaseUser && isPrimaryAdminEmail(firebaseUser.email)) {
      return true;
    }
    const email = activeTenantSession?.email || firebaseUser?.email || '';
    if (isPrimaryAdminEmail(email) && !firebaseUser) {
      return false;
    }
    if (activeTenantSession && typeof activeTenantSession.isApproved === 'boolean') {
      return activeTenantSession.isApproved;
    }
    if (activeTenantUid) {
      return getLocalTenantApprovalState(activeTenantUid, email).isApproved;
    }
    return false;
  }, [localModeAccepted, activeTenantSession, firebaseUser, activeTenantUid]);

  const handleTilePointerMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  };

  // Pick a featured Before/After pair from invoices or properties for the live Bento showcase tile
  const featuredBeforeAfter = useMemo(() => {
    for (const inv of invoices) {
      if (inv.beforePhotos?.length && inv.afterPhotos?.length) {
        return {
          beforeUrl: inv.beforePhotos[0],
          afterUrl: inv.afterPhotos[0],
          clientName: inv.clientName,
          dateStr: inv.date,
        };
      }
    }
    return {
      beforeUrl:
        'https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&w=900&q=80',
      afterUrl:
        'https://images.unsplash.com/photo-1592417817098-8f3d691a4bf5?auto=format&fit=crop&w=900&q=80',
      clientName: 'Quinta Los Aromos · Corte y Desmalezado',
      dateStr: activeDate,
    };
  }, [invoices, activeDate]);

  // 1. Show the Login Gate whenever there is no active authenticated session or active Demo session.
  // Once logged in, the user stays inside the app until they click "Cerrar Sesión" from inside the app.
  const isWorkspaceUnlocked = Boolean(
    firebaseUser || activeTenantSession || localModeAccepted
  );

  if (!isWorkspaceUnlocked) {
    return (
      <AuthGate
        currentUser={firebaseUser}
        activeTenantSession={activeTenantSession}
        isModalOpen={true}
        isFullScreenGate={true}
        appName={businessProfile.appName}
        slogan={businessProfile.slogan}
        cloudSyncState={cloudSyncState}
        cloudSyncMessage={cloudSyncMessage}
        onCloseModal={() => {}}
        onContinueLocalMode={() => {
          setBusinessProfile(DEFAULT_BUSINESS_PROFILE);
          setBaseLocation(BASE_DEPOT);
          setPaymentProfile(DEFAULT_PAYMENT_PROFILE);
          setProperties(INITIAL_PROPERTIES);
          setScheduledJobs(
            recalculateJobsFromDynamicBase(
              BASE_DEPOT.coordinates,
              INITIAL_TODAY_JOBS
            )
          );
          setInvoices(INITIAL_INVOICES);
          setExpenses(INITIAL_EXPENSES);
          setEquipment(INITIAL_EQUIPMENT);
          setLocalModeAccepted(true);
        }}
        onTenantAuthenticated={async (session) => {
          await hydrateTenantWorkspace(session);
          setLocalModeAccepted(true);
          if (
            auth.currentUser &&
            isPrimaryAdminEmail(auth.currentUser.email) &&
            isPrimaryAdminEmail(session.email)
          ) {
            setActiveTab('admin');
          }
        }}
        onLogoutSession={handleFullLogout}
        onOpenWhiteLabelWizard={() => {
          setIsFirstTimeWhiteLabelSetup(false);
          setIsWhiteLabelModalOpen(true);
        }}
        onOpenSubscriptionModal={() => setIsSubscriptionModalOpen(true)}
        onOpenAdminPanel={() => {
          if (auth.currentUser && isPrimaryAdminEmail(auth.currentUser.email)) {
            setActiveTab('admin');
          }
        }}
        onForceCloudSync={handleForceCloudSync}
        onAuthSuccessBanner={showBanner}
      />
    );
  }

  // 2. Mandatory Administrator Approval Gate: block unapproved authenticated accounts from viewing the main menu
  if ((firebaseUser || activeTenantSession) && !isAccountApproved) {
    return (
      <PendingApprovalScreen
        userUid={activeTenantSession?.uid || firebaseUser?.uid || 'pending-uid'}
        userEmail={
          activeTenantSession?.email ||
          firebaseUser?.email ||
          'usuario@pastopro.app'
        }
        userName={
          activeTenantSession?.displayName ||
          businessProfile.ownerName ||
          'Titular'
        }
        businessName={businessProfile.appName}
        city={baseLocation.city}
        approvalStatus={activeTenantSession?.approvalStatus || 'pending'}
        subscription={subscription}
        onRefreshApprovalStatus={handleRefreshApprovalStatus}
        onSignOut={handleFullLogout}
      />
    );
  }

  const activeSectionMeta = (() => {
    switch (activeTab) {
      case 'ruta':
        return {
          category: 'Operaciones de Campo',
          title: 'Hoja de Ruta GPS y Despacho',
        };
      case 'agenda':
        return {
          category: 'Planificación Operativa',
          title: 'Agenda y Calendario',
        };
      case 'clientes':
        return {
          category: 'CRM y Propiedades',
          title: 'Cartera de Clientes y Lotes',
        };
      case 'jardineria':
        return {
          category: 'Agronomía y Terreno',
          title: 'Manual de Césped y Servicios Extra',
        };
      case 'facturacion':
        return {
          category: 'Finanzas y Tesorería',
          title: 'Flujo de Caja, Cobros y Recibos',
        };
      case 'cotizador':
        return {
          category: 'Ingeniería Comercial',
          title: 'Cotizador Técnico por Superficie',
        };
      case 'respaldo':
        return {
          category: 'Activos y Sincronización',
          title: 'Flota de Equipos y Google Sheets',
        };
      case 'admin':
        return {
          category: 'Gobierno de Plataforma',
          title: 'Consola de Licencias y Aprobaciones',
        };
      default:
        return {
          category: 'Operaciones',
          title: businessProfile.appName,
        };
    }
  })();

  return (
    <div className="min-h-screen architectural-grid-canvas text-slate-900 flex flex-col pb-20 md:pb-6 overflow-x-hidden">
      {/* Skip-to-Content Link */}
      <a
        href="#main-workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2.5 focus:rounded-xl focus:bg-slate-900 focus:text-white focus:font-bold focus:text-sm focus:shadow-lg"
      >
        Saltar al contenido principal
      </a>

      {/* ====================================================================
          TWO-TIER ARCHITECTURAL HEADER & MODULE NAVIGATION
          Row 1: Brand, City, Admin Quick-Switch, Actions & Visible Logout (Zero Overflow)
          Row 2: Dedicated Module Navigation Bar across all screen widths
          ==================================================================== */}
      <div className="sticky top-0 z-30 select-none bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
        {/* TIER 1: EXECUTIVE IDENTITY, ADMIN ACCESS & ACCOUNT BAR */}
        <header
          aria-label="Cabecera y Navegación Principal de PastoPro"
          className="max-w-[1600px] mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2 min-w-0"
        >
          {/* ZONE 1 (LEFT): Brand Identity + Active City + Admin Role Badge */}
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <a
              href="#ruta"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab(isAdminUser ? 'admin' : 'ruta');
              }}
              className="flex items-center gap-2 shrink-0 group"
            >
              {businessProfile.logoUrl ? (
                <img
                  src={businessProfile.logoUrl}
                  alt={businessProfile.appName}
                  className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shrink-0 shadow-2xs">
                  <Leaf className="w-4 h-4 text-emerald-400" />
                </div>
              )}
              <span className="font-display font-bold text-sm sm:text-base tracking-tight text-slate-900 truncate max-w-[96px] sm:max-w-[160px]">
                {businessProfile.appName === 'Consola Central de Licencias'
                  ? 'PastoPro'
                  : businessProfile.appName}
              </span>
            </a>

            <button
              type="button"
              onClick={() => setIsBaseModalOpen(true)}
              title={`Punto de partida: ${baseLocation.city}`}
              className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/70 text-xs text-slate-700 font-medium transition-colors cursor-pointer max-w-[140px]"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">{baseLocation.city.split(',')[0]}</span>
            </button>

            {isAdminUser && (
              <span className="hidden xl:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider text-emerald-800 shrink-0">
                <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                Administrador
              </span>
            )}
          </div>

          {/* ZONE 2 (RIGHT): Global Actions + Admin Access Control + Always-Visible Logout */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {isAdminUser && (
              <button
                type="button"
                data-testid="nav-admin-panel-btn"
                onClick={() => setActiveTab('admin')}
                title="Controlar solicitudes de acceso, dar permisos y chatear con usuarios"
                className={`min-h-[34px] inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
                  activeTab === 'admin'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-200'
                }`}
              >
                <ShieldCheck
                  className={`w-3.5 h-3.5 shrink-0 ${
                    activeTab === 'admin' ? 'text-white' : 'text-emerald-600'
                  }`}
                />
                <span className="hidden md:inline">Control de Accesos</span>
                <span className="md:hidden">Accesos</span>
              </button>
            )}

            <button
              type="button"
              data-testid="open-command-palette-btn"
              onClick={() => setIsCommandPaletteOpen(true)}
              title="Buscador rápido (⌘K)"
              className="hidden sm:inline-flex min-h-[34px] px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/70 text-xs text-slate-700 items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="hidden xl:inline font-medium">Buscar</span>
              <kbd className="hidden lg:inline px-1 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono font-semibold text-slate-500">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingClient(null);
                setPrefillClientData(null);
                setModalDefaultDate(activeDate);
                setModalDefaultTime('08:30');
                setIsClientModalOpen(true);
              }}
              title="Programar nuevo corte o registrar cliente"
              className="min-h-[34px] inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5] shrink-0" />
              <span className="hidden sm:inline">Nuevo</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsFirstTimeWhiteLabelSetup(false);
                setIsWhiteLabelModalOpen(true);
              }}
              data-testid="open-whitelabel-btn"
              title="Personalizar marca, ciudad, tarifa $/m² y alias"
              className="hidden sm:inline-flex min-h-[34px] items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-xs text-slate-700 font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="hidden lg:inline">Mi Negocio</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              data-testid="open-firebase-auth-btn"
              title="Cuenta y sincronización"
              className="min-h-[34px] inline-flex items-center justify-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer shrink-0"
            >
              <UserIcon className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span className="hidden xl:inline">Cuenta</span>
            </button>

            <button
              type="button"
              onClick={handleFullLogout}
              data-testid="logout-btn"
              title="Cerrar sesión activa y volver al inicio de sesión"
              className="min-h-[34px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-rose-50/70 hover:bg-rose-100 text-rose-700 border border-rose-200 inline-flex items-center justify-center gap-1.5 text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>Salir</span>
            </button>
          </div>
        </header>

        {/* TIER 2: DEDICATED MODULE NAVIGATION BAR (All Screen Sizes — Clean & Never Clipped) */}
        <nav
          aria-label="Módulos principales"
          className="max-w-[1600px] mx-auto flex items-center gap-1 px-3 sm:px-6 h-11 bg-slate-50/90 border-t border-slate-200/80 overflow-x-auto no-scrollbar"
        >
          {isAdminUser && (
            <button
              type="button"
              data-testid="sidebar-nav-admin"
              onClick={() => setActiveTab('admin')}
              className={`min-h-[32px] inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'admin'
                  ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                  : 'bg-emerald-50/80 text-emerald-900 hover:bg-emerald-100 font-semibold border border-emerald-200/80'
              }`}
            >
              <ShieldCheck
                className={`w-3.5 h-3.5 shrink-0 ${
                  activeTab === 'admin' ? 'text-emerald-400' : 'text-emerald-600'
                }`}
              />
              <span>Solicitudes y Accesos</span>
              <span
                className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded ${
                  activeTab === 'admin'
                    ? 'bg-emerald-500/25 text-emerald-300 font-bold'
                    : 'bg-emerald-200/70 text-emerald-900 font-bold'
                }`}
              >
                Admin
              </span>
            </button>
          )}

          {(
            [
              {
                id: 'ruta',
                label: 'Hoy / Ruta',
                icon: Compass,
                count: `${routeMetrics.completedCount}/${activeDateJobs.length}`,
              },
              {
                id: 'agenda',
                label: 'Agenda',
                icon: CalendarIcon,
                count: null,
              },
              {
                id: 'clientes',
                label: 'Clientes',
                icon: Users,
                count: String(properties.length),
              },
              {
                id: 'cotizador',
                label: 'Cotizador',
                icon: Calculator,
                count: null,
              },
              {
                id: 'facturacion',
                label: 'Finanzas',
                icon: BarChart3,
                count: null,
              },
              {
                id: 'respaldo',
                label: 'Equipos',
                icon: FileSpreadsheet,
                count: null,
              },
            ] as const
          ).map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`sidebar-nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`min-h-[32px] inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white font-medium'
                }`}
              >
                <IconComponent
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isActive ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                />
                <span>{item.label}</span>
                {item.count && (
                  <span
                    className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded ${
                      isActive
                        ? 'bg-white/15 text-white font-bold'
                        : 'bg-slate-200/80 text-slate-700'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ====================================================================
          MAIN WORKSPACE (Generous Negative Space & Strategic Bento Architecture)
          ==================================================================== */}
      <div className="flex-1 min-w-0 flex flex-col">
        <main
          id="main-workspace"
          className="flex-1 min-w-0 max-w-[1540px] w-full mx-auto px-4 sm:px-8 lg:px-10 py-6 sm:py-8 space-y-8"
        >
        {routeNotice && (
          <div
            role="status"
            aria-live="polite"
            className="bg-emerald-50 text-slate-900 text-xs sm:text-sm font-medium px-4 py-3 rounded-xl border border-emerald-200 flex items-center justify-between gap-3 shadow-2xs"
          >
            <span className="break-words min-w-0">{routeNotice}</span>
            <button
              type="button"
              onClick={() => setRouteNotice(null)}
              className="text-emerald-700 hover:text-slate-950 text-xs font-semibold underline shrink-0 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Cronómetro de Corte en Vivo */}
        {activeCutTimer && (
          <div
            data-testid="active-cut-timer-banner"
            className="bg-white text-slate-900 border border-slate-300 rounded-xl p-3.5 sm:px-5 flex flex-wrap items-center justify-between gap-3 shadow-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                <Timer className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 font-bold">
                  {activeCutTimer.isRunning
                    ? 'SERVICIO EN CURSO'
                    : 'CRONÓMETRO EN PAUSA'}
                </div>
                <div className="text-sm font-bold text-slate-900 truncate">
                  {activeCutTimer.clientName}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                data-testid="active-cut-timer-display"
                className="font-mono text-base sm:text-lg font-bold text-slate-900 tabular-nums px-3 py-1 rounded-lg bg-slate-100 border border-slate-200"
              >
                {formatStopwatchSeconds(activeCutTimer.elapsedSeconds)}
              </div>

              <button
                type="button"
                data-testid="toggle-cut-timer-btn"
                onClick={() =>
                  setActiveCutTimer((prev) =>
                    prev ? { ...prev, isRunning: !prev.isRunning } : null
                  )
                }
                className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                {activeCutTimer.isRunning ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Reanudar</span>
                  </>
                )}
              </button>

              <button
                type="button"
                data-testid="finish-cut-timer-btn"
                onClick={() => {
                  const job = scheduledJobs.find(
                    (j) => j.id === activeCutTimer.jobId
                  );
                  if (job) {
                    setActiveCutTimer((prev) =>
                      prev ? { ...prev, isRunning: false } : null
                    );
                    setJobToComplete(job);
                  }
                }}
                className="min-h-[34px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                <span>Finalizar y Cobrar</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================
            TAB 1: HOY / MI RUTA — STREAMLINED ARCHITECTURAL WORKSPACE
            ================================================================== */}
        {activeTab === 'ruta' && (
          <div className="space-y-6" data-testid="ruta-split-cockpit">
            {/* 1. STRATEGIC BENTO SUMMARY & DISPATCH BAR (Generous Negative Space) */}
            <section
              data-testid="compact-route-telemetry-bar"
              className="bento-tile text-slate-900 rounded-2xl overflow-hidden"
            >
              {/* Top Row: 3 Focused Operational KPIs + Active Date & Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 border-b border-slate-100">
                {/* KPI 1: Ingresos del Día */}
                <div className="px-6 py-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                      Facturación del Día
                    </div>
                    <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums tracking-tight mt-1">
                      ${routeMetrics.expectedRevenueToday.toLocaleString('es-AR')}
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-mono font-semibold">
                    {activeDateJobs.length} paradas
                  </span>
                </div>

                {/* KPI 2: Progreso de la Jornada */}
                <div className="px-6 py-5 flex flex-col justify-center">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                      Avance de Visitas
                    </span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {routeMetrics.completedCount} de {activeDateJobs.length} listas ({completionRatio}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2.5">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${completionRatio}%` }}
                    />
                  </div>
                </div>

                {/* KPI 3: Recorrido y Tiempo Estimado */}
                <div className="px-6 py-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                      Recorrido GPS ({baseLocation.city})
                    </div>
                    <div className="font-display text-xl sm:text-2xl font-bold text-slate-900 tabular-nums mt-1">
                      {routeMetrics.totalDistanceKm} km{' '}
                      <span className="text-xs font-sans font-normal text-slate-500">
                        (~{Math.round((routeMetrics.totalWorkMinutes / 60) * 10) / 10} hs)
                      </span>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium">
                    <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>{activeDayWeather.tempMax}°C</span>
                  </div>
                </div>
              </div>

              {/* Bottom Toolbar: Single Clean Row with Date Picker, Status Filter & Primary Actions */}
              <div className="px-6 py-3.5 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
                {/* Left: Date Selector + Status Filter */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="inline-flex items-center bg-white rounded-xl p-0.5 border border-slate-200 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => shiftActiveDate(-1)}
                      aria-label="Día anterior"
                      className="min-h-[30px] min-w-[28px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (activeDate !== TODAY_REFERENCE) {
                          triggerDailyJobsTransition('date', 240);
                          setActiveDate(TODAY_REFERENCE);
                        }
                      }}
                      className={`min-h-[30px] px-2.5 py-0.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        activeDate === TODAY_REFERENCE
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Hoy
                    </button>
                    <input
                      type="date"
                      aria-label="Fecha de jornada activa"
                      value={activeDate}
                      onChange={(e) => {
                        const nextDate = e.target.value || TODAY_REFERENCE;
                        triggerDailyJobsTransition('date', 240);
                        setActiveDate(nextDate);
                      }}
                      className="bg-transparent text-xs font-mono font-semibold text-slate-900 px-2 py-0.5 focus:outline-none w-[116px] sm:w-auto"
                    />
                    <button
                      type="button"
                      onClick={() => shiftActiveDate(1)}
                      aria-label="Día siguiente"
                      className="min-h-[30px] min-w-[28px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div
                    role="group"
                    aria-label="Filtrar paradas del día"
                    className="inline-flex items-center p-0.5 bg-white border border-slate-200 rounded-xl shadow-2xs"
                  >
                    {(
                      [
                        {
                          id: 'todos',
                          label: `Todas (${activeDateJobs.length})`,
                        },
                        {
                          id: 'pendientes',
                          label: `Pendientes (${routeMetrics.pendingCount})`,
                        },
                        {
                          id: 'completados',
                          label: `Listas (${routeMetrics.completedCount})`,
                        },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          triggerDailyJobsTransition('filter', 220);
                          setRouteStatusFilter(tab.id);
                        }}
                        className={`min-h-[30px] px-2.5 py-0.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                          routeStatusFilter === tab.id
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right: 2 Clear Route Actions */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleOptimizeRoute}
                    title="Ordenar paradas por menor distancia con algoritmo 2-Opt TSP"
                    className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer whitespace-nowrap shadow-2xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Optimizar Ruta</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setScheduleModalState({
                        isOpen: true,
                        preselectedPropertyId: null,
                        defaultDate: activeDate,
                        defaultTime: '08:30',
                      })
                    }
                    className="min-h-[34px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl cursor-pointer whitespace-nowrap shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                    <span>Agendar Lote</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Selector Móvil: Órdenes vs Mapa GPS */}
            <div className="grid grid-cols-2 gap-1.5 lg:hidden bg-white border border-slate-200 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setMobileRouteSubView('list')}
                className={`min-h-[34px] rounded-lg text-xs font-semibold transition-all ${
                  mobileRouteSubView === 'list'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Órdenes del Día ({activeDateJobs.length})
              </button>
              <button
                type="button"
                onClick={() => setMobileRouteSubView('map')}
                className={`min-h-[34px] rounded-lg text-xs font-semibold transition-all ${
                  mobileRouteSubView === 'map'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Mapa GPS ({activeDateJobs.length})
              </button>
            </div>

            {/* ASYMMETRIC 7:5 WORKSPACE:
                LEFT (7 COLS) = CLEAN, HIGH-DENSITY CSS GRID WORK ORDER CARDS
                RIGHT (5 COLS) = STICKY INTERACTIVE GPS MAP */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT COLUMN: WORK ORDERS */}
              <div
                data-testid="daily-jobs-primary-column"
                className={`lg:col-span-7 space-y-3 min-w-0 ${
                  mobileRouteSubView === 'map' ? 'hidden lg:block' : 'block'
                }`}
              >
                {filteredActiveDateJobs.length === 0 ? (
                  <div className="bento-tile rounded-2xl p-8 text-center space-y-3">
                    <p className="font-display text-base sm:text-lg font-bold text-slate-900">
                      {activeDateJobs.length === 0
                        ? `Sin órdenes programadas para el ${activeDate}`
                        : 'No hay órdenes que coincidan con ese filtro'}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                      {activeDateJobs.length === 0
                        ? 'Asigná un lote existente a esta fecha o consultá la agenda semanal.'
                        : 'Cambiá el filtro a "Todas" para ver la hoja de ruta completa.'}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      {activeDateJobs.length === 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setScheduleModalState({
                              isOpen: true,
                              preselectedPropertyId: null,
                              defaultDate: activeDate,
                              defaultTime: '08:30',
                            })
                          }
                          className="min-h-[36px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 rounded-xl hover:bg-slate-800 cursor-pointer"
                        >
                          <Plus className="w-4 h-4 text-emerald-400" />
                          <span>Programar Corte</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setRouteStatusFilter('todos');
                            setRouteSearchQuery('');
                          }}
                          className="min-h-[34px] px-4 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 rounded-xl hover:bg-slate-200 cursor-pointer"
                        >
                          Mostrar todas las órdenes ({activeDateJobs.length})
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    key={`work-orders-batch-${dailyJobsRenderBatch}`}
                    className="space-y-2.5"
                    data-testid="work-orders-list"
                    aria-busy="false"
                  >
                    {filteredActiveDateJobs.map((job) => {
                      const isSelected = job.id === selectedJobId;
                      const isCompleted = job.status === 'Completado';
                      const isInProgress = job.status === 'En Curso';
                      const navUrl = buildGoogleMapsNavUrl(job.coordinates);
                      const whatsappEtaUrl = buildSafeWhatsAppUrl(
                        job.phone,
                        `Hola ${job.clientName}, te aviso que estoy en camino hacia ${job.address} para realizar el servicio de mantenimiento de césped.`
                      );
                      const matchingInvoice = invoices.find(
                        (inv) => inv.id === job.invoiceId
                      );
                      const matchingProperty = properties.find(
                        (p) => p.id === job.propertyId
                      );
                      const formattedIndex = String(job.orderIndex).padStart(
                        2,
                        '0'
                      );

                      return (
                        <article
                          key={job.id}
                          data-testid="daily-job-card"
                          onClick={() => setSelectedJobId(job.id)}
                          className={`bento-tile bento-tile-interactive rounded-xl overflow-hidden cursor-pointer min-w-0 grid grid-cols-1 md:grid-cols-[58px_minmax(0,1fr)_188px] items-stretch transition-all ${
                            isSelected
                              ? 'ring-2 ring-slate-900/15 border-slate-900'
                              : ''
                          }`}
                        >
                          {/* GRID CELL 1: CLEAN STOP NUMBER & TIME */}
                          <div
                            className={`px-3 py-2 md:p-2.5 flex md:flex-col items-center justify-between md:justify-center gap-1 border-b md:border-b-0 md:border-r ${
                              isCompleted
                                ? 'bg-emerald-50/70 text-emerald-800 border-emerald-200'
                                : isSelected
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-slate-50 text-slate-900 border-slate-200'
                            }`}
                          >
                            <span
                              className={`font-display text-lg md:text-xl font-bold tabular-nums leading-none ${
                                isSelected
                                  ? 'text-white'
                                  : isCompleted
                                  ? 'text-emerald-700'
                                  : 'text-slate-900'
                              }`}
                            >
                              #{formattedIndex}
                            </span>
                            <span
                              className={`font-mono text-[11px] font-semibold tabular-nums ${
                                isSelected
                                  ? 'text-emerald-400'
                                  : isCompleted
                                  ? 'text-emerald-700'
                                  : 'text-slate-500'
                              }`}
                            >
                              {job.scheduledTime || '08:00'}
                            </span>
                          </div>

                          {/* GRID CELL 2: CLIENT, ADDRESS & CONCISE TASKS */}
                          <div className="p-3 sm:px-4 sm:py-3 bg-white min-w-0 flex flex-col justify-between gap-2">
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <h3 className="font-display text-sm sm:text-[15px] font-bold text-slate-900 leading-tight truncate">
                                    {job.clientName}
                                  </h3>
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ${
                                      isCompleted
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : isInProgress
                                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {isCompleted
                                      ? 'Completado'
                                      : isInProgress
                                      ? 'En curso'
                                      : 'Pendiente'}
                                  </span>
                                </div>

                                <span className="text-xs font-mono text-slate-500 tabular-nums shrink-0">
                                  {job.propertyType} · {job.areaSqm} m²
                                </span>
                              </div>

                              <p className="text-xs text-slate-500 flex items-center gap-1.5 truncate">
                                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="font-medium text-slate-700 truncate">
                                  {job.address}
                                </span>
                                <span className="text-slate-300">·</span>
                                <span className="truncate">{job.neighborhood}</span>
                              </p>
                            </div>

                            {/* Concise Tasks Row */}
                            <div
                              data-testid="job-card-main-tasks"
                              className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600"
                            >
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                                {(job.tasks.length > 0
                                  ? job.tasks.slice(0, 2)
                                  : ['Corte general y bordeado']
                                ).map((taskItem, tIdx) => (
                                  <span
                                    key={`${job.id}-task-${tIdx}`}
                                    className="inline-flex items-center gap-1"
                                  >
                                    <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span className="truncate">{taskItem}</span>
                                  </span>
                                ))}
                              </div>

                              {job.accessNotes && (
                                <span className="text-[11px] text-slate-400 truncate max-w-[220px]" title={job.accessNotes}>
                                  Nota: {job.accessNotes}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* GRID CELL 3: PRICE & FOCUSED ACTIONS */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="p-3 bg-slate-50/60 border-t md:border-t-0 md:border-l border-slate-200 flex flex-col justify-between gap-2"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingScheduledJob(job)}
                                  title="Editar orden"
                                  className="p-1.5 rounded-lg hover:bg-slate-200/70 text-slate-500 hover:text-slate-900 cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                {matchingProperty && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setHistoryClientModal(matchingProperty)
                                    }
                                    title="Ver ficha e historial del cliente"
                                    className="p-1.5 rounded-lg hover:bg-slate-200/70 text-slate-500 hover:text-slate-900 cursor-pointer"
                                  >
                                    <History className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              <div
                                data-testid={`job-card-price-${job.orderIndex}`}
                                className={`font-display text-base sm:text-lg font-bold tabular-nums tracking-tight ${
                                  isCompleted ? 'text-emerald-600' : 'text-slate-900'
                                }`}
                              >
                                ${job.price.toLocaleString('es-AR')}
                              </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                              {!isCompleted ? (
                                <button
                                  type="button"
                                  onClick={() => setJobToComplete(job)}
                                  className="w-full min-h-[30px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg cursor-pointer shadow-2xs"
                                >
                                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span>Cobrar</span>
                                </button>
                              ) : matchingInvoice ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedInvoiceReceipt(matchingInvoice)
                                  }
                                  className="w-full min-h-[30px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span>Ver Recibo</span>
                                </button>
                              ) : null}

                              <div className="grid grid-cols-2 gap-1">
                                <a
                                  href={navUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="min-h-[28px] inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                  <Navigation className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>Mapa</span>
                                </a>
                                <a
                                  href={whatsappEtaUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="min-h-[28px] inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                  <MessageCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>Avisar</span>
                                </a>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN (5 COLS): CLEAN STICKY GOOGLE MAPS PANEL */}
              <div
                className={`lg:col-span-5 lg:sticky lg:top-20 min-w-0 ${
                  mobileRouteSubView === 'list' ? 'hidden lg:block' : 'block'
                }`}
              >
                <RouteMapPanel
                  baseLocation={baseLocation}
                  activeDate={activeDate}
                  jobs={activeDateJobs}
                  selectedJobId={selectedJobId}
                  isLocatingGps={isLocatingGps}
                  onSelectJob={(id) => setSelectedJobId(id)}
                  onStartQuickComplete={(job) => setJobToComplete(job)}
                  onOpenBaseModal={() => setIsBaseModalOpen(true)}
                  onUseCurrentGps={handleUseCurrentGps}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AGENDA & CALENDARIO (Día, Semana, Mes) */}
        {activeTab === 'agenda' && (
          <CalendarAgendaView
            selectedDate={activeDate}
            todayStr={TODAY_REFERENCE}
            baseCity={baseLocation.city}
            allJobs={scheduledJobs}
            properties={properties}
            invoices={invoices}
            onSelectDate={(dateStr) => setActiveDate(dateStr)}
            onOpenRouteForDate={(dateStr) => {
              setActiveDate(dateStr);
              setActiveTab('ruta');
            }}
            onOpenScheduleModal={(dateStr, timeStr) =>
              setScheduleModalState({
                isOpen: true,
                preselectedPropertyId: null,
                defaultDate: dateStr,
                defaultTime: timeStr || '08:30',
              })
            }
            onOpenNewClientForDate={(dateStr, timeStr) => {
              setEditingClient(null);
              setPrefillClientData(null);
              setModalDefaultDate(dateStr);
              setModalDefaultTime(timeStr || '09:00');
              setIsClientModalOpen(true);
            }}
            onStartCompleteJob={(job) => setJobToComplete(job)}
            onEditScheduledJob={(job) => setEditingScheduledJob(job)}
            onRemoveScheduledJob={handleRemoveStopFromSchedule}
            onRainDelayDate={handleRainDelayForDate}
          />
        )}

        {/* TAB 3: CLIENTES Y LOTES */}
        {activeTab === 'clientes' && (
          <ClientsView
            properties={properties}
            todayJobs={activeDateJobs}
            invoices={invoices}
            paymentAlias={paymentProfile.alias}
            isEasyAccessMode={isEasyAccessMode}
            onOpenNewClient={() => {
              setEditingClient(null);
              setPrefillClientData(null);
              setModalDefaultDate(activeDate);
              setModalDefaultTime('08:30');
              setIsClientModalOpen(true);
            }}
            onEditClient={(client) => {
              setEditingClient(client);
              setPrefillClientData(null);
              setIsClientModalOpen(true);
            }}
            onViewClientHistory={(client) => setHistoryClientModal(client)}
            onRequestDeleteClient={handleRequestDeleteClient}
            onAddPropertyToToday={handleAddPropertyToToday}
            onScheduleClient={(client) =>
              setScheduleModalState({
                isOpen: true,
                preselectedPropertyId: client.id,
                defaultDate: activeDate,
                defaultTime: '08:30',
              })
            }
            onBulkUpdatePrices={handleBulkUpdatePrices}
            onOpenAliasModal={() => setIsOfflineAndAliasModalOpen(true)}
            onSettleClientPendingInvoices={(clientPropertyId) => {
              setInvoices((prev) =>
                prev.map((inv) =>
                  inv.propertyId === clientPropertyId &&
                  inv.status === 'Pendiente'
                    ? {
                        ...inv,
                        status: 'Pagado',
                        paymentMethod: 'Transferencia',
                        paidAt: activeDate,
                      }
                    : inv
                )
              );
              showBanner('Saldo pendiente del cliente registrado como Pagado.');
            }}
          />
        )}

        {/* TAB 3.5: JARDINERÍA Y CÉSPED (Manual Agronómico, Checklist de Salida y Servicios Adicionales) */}
        {activeTab === 'jardineria' && (
          <BotanicalAgronomyView
            activeDate={activeDate}
            todayJobs={activeDateJobs}
            properties={properties}
            onAddTaskToJob={handleAddTaskToJob}
            onNavigateToRoute={() => setActiveTab('ruta')}
          />
        )}

        {/* TAB 4: COTIZADOR RÁPIDO */}
        {activeTab === 'cotizador' && (
          <QuoteCalculatorView
            activeCity={baseLocation.city}
            existingProperties={properties}
            businessProfile={businessProfile}
            onOpenBusinessProfile={() => setIsBusinessProfileModalOpen(true)}
            onConvertQuoteToClient={(prefill) => {
              setEditingClient(null);
              setPrefillClientData(prefill);
              setModalDefaultDate(activeDate);
              setModalDefaultTime('09:00');
              setIsClientModalOpen(true);
            }}
          />
        )}

        {/* TAB 5: ESTADÍSTICAS Y CAJA */}
        {activeTab === 'facturacion' && (
          <BillingView
            activeDate={activeDate}
            isEasyAccessMode={isEasyAccessMode}
            properties={properties}
            invoices={invoices}
            expenses={expenses}
            onToggleInvoicePaid={handleToggleInvoicePaid}
            onSelectInvoiceReceipt={(inv) => setSelectedInvoiceReceipt(inv)}
            onEditInvoice={(inv) => setEditingInvoice(inv)}
            onDeleteInvoice={handleDeleteInvoice}
            onAddExpense={handleAddExpense}
            onUpdateExpense={handleUpdateExpense}
            onDeleteExpense={handleDeleteExpense}
            onViewClientHistory={(client) => setHistoryClientModal(client)}
          />
        )}

        {/* TAB 6: GOOGLE SHEETS EN VIVO, RESPALDO Y EQUIPOS */}
        {activeTab === 'respaldo' && (
          <BackupAndEquipmentView
            properties={properties}
            invoices={invoices}
            expenses={expenses}
            equipment={equipment}
            googleUserEmail={googleUserEmail}
            connectedSpreadsheetId={connectedSpreadsheetId}
            connectedSpreadsheetUrl={connectedSpreadsheetUrl}
            isSyncingSheets={isSyncingSheets}
            lastSyncedAt={lastSyncedAt}
            onGoogleLogin={handleGoogleLogin}
            onGoogleLogout={handleGoogleLogout}
            onSetSpreadsheetIdInput={handleSetSpreadsheetIdInput}
            onRequestCreateGoogleSheet={() =>
              setSheetsConfirmDialog({ isOpen: true, actionType: 'create' })
            }
            onRequestSyncGoogleSheet={() =>
              setSheetsConfirmDialog({ isOpen: true, actionType: 'sync' })
            }
            onExportCsv={handleExportCsv}
            onCopyGoogleSheetsTsv={handleCopyGoogleSheetsTsv}
            onExportJsonBackup={handleExportJsonBackup}
            onImportJsonBackup={handleImportJsonBackup}
            onRequestClearAllData={handleRequestClearAllData}
            onRestoreDemoData={handleRestoreDemoData}
            onLogEquipmentHours={handleLogEquipmentHours}
            onResetEquipmentService={handleResetEquipmentService}
            onAddEquipment={handleAddEquipment}
            onUpdateEquipment={handleUpdateEquipment}
            onDeleteEquipment={handleDeleteEquipment}
          />
        )}

        {/* TAB 7: PANEL EXCLUSIVO DE ADMINISTRADOR (CONTROL DE ACCESO MANUAL Y SOLICITUDES) */}
        {activeTab === 'admin' && isAdminUser && (
          <AdminControlPanelView
            currentUserEmail={activeUserEmail || 'hz.mdiego@gmail.com'}
            onShowToast={showBanner}
            onNavigateToApp={() => setActiveTab('ruta')}
          />
        )}
        </main>
      </div>

      {/* Architectural Slate Mobile Bottom Navigation Dock */}
      <nav
        aria-label="Navegación móvil"
        className={`md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_16px_rgba(15,23,42,0.05)] grid ${
          isAdminUser && !adminGardenerPreviewMode ? 'grid-cols-3' : 'grid-cols-4'
        } h-14 px-2`}
      >
        {isAdminUser && !adminGardenerPreviewMode ? (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold rounded-xl my-1 transition-all ${
                activeTab === 'admin'
                  ? 'bg-slate-900 text-white font-bold shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              <ShieldCheck className={`w-4 h-4 ${activeTab === 'admin' ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span>Accesos</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSubscriptionModalOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold rounded-xl my-1 text-slate-600 hover:text-slate-900"
            >
              <CreditCard className="w-4 h-4 text-slate-500" />
              <span>Licencia</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAdminGardenerPreviewMode(true);
                setActiveTab('ruta');
              }}
              className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold rounded-xl my-1 text-emerald-700 bg-emerald-50"
            >
              <Compass className="w-4 h-4 text-emerald-600" />
              <span>Modo Demo</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('ruta')}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold rounded-xl my-1 transition-all ${
                activeTab === 'ruta'
                  ? 'bg-slate-900 text-white font-bold shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              <Compass className={`w-4 h-4 ${activeTab === 'ruta' ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span>Hoy / Ruta</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('agenda')}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold rounded-xl my-1 transition-all ${
                activeTab === 'agenda'
                  ? 'bg-slate-900 text-white font-bold shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              <CalendarIcon className={`w-4 h-4 ${activeTab === 'agenda' ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span>Agenda</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('clientes')}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold rounded-xl my-1 transition-all ${
                activeTab === 'clientes'
                  ? 'bg-slate-900 text-white font-bold shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              <Users className={`w-4 h-4 ${activeTab === 'clientes' ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span>Clientes</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('facturacion')}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold rounded-xl my-1 transition-all ${
                isMoreSectionActive
                  ? 'bg-slate-900 text-white font-bold shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              <BarChart3 className={`w-4 h-4 ${isMoreSectionActive ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span>Finanzas</span>
            </button>
          </>
        )}
      </nav>

      {/* Firebase Authentication & Multi-Tenant Account Modal */}
      <AuthGate
        currentUser={firebaseUser}
        activeTenantSession={activeTenantSession}
        isModalOpen={isAuthModalOpen}
        isFullScreenGate={false}
        appName={businessProfile.appName}
        slogan={businessProfile.slogan}
        cloudSyncState={cloudSyncState}
        cloudSyncMessage={cloudSyncMessage}
        onCloseModal={() => setIsAuthModalOpen(false)}
        onContinueLocalMode={() => {
          setLocalModeAccepted(true);
          setIsAuthModalOpen(false);
        }}
        onTenantAuthenticated={hydrateTenantWorkspace}
        onLogoutSession={handleFullLogout}
        onOpenWhiteLabelWizard={() => {
          setIsFirstTimeWhiteLabelSetup(false);
          setIsWhiteLabelModalOpen(true);
        }}
        onOpenSubscriptionModal={() => setIsSubscriptionModalOpen(true)}
        onOpenAdminPanel={() => setActiveTab('admin')}
        onForceCloudSync={handleForceCloudSync}
        onAuthSuccessBanner={showBanner}
      />

      {/* White-Label Brand, Logo, City & Base Pricing Wizard Modal */}
      <OnboardingWhiteLabelModal
        isOpen={isWhiteLabelModalOpen}
        isFirstTimeSetup={isFirstTimeWhiteLabelSetup}
        businessProfile={businessProfile}
        baseLocation={baseLocation}
        paymentProfile={paymentProfile}
        userEmail={activeTenantSession?.email || firebaseUser?.email}
        onClose={() => {
          setIsWhiteLabelModalOpen(false);
          setIsFirstTimeWhiteLabelSetup(false);
        }}
        onSaveCompleteConfiguration={({
          businessProfile: updatedBusiness,
          baseLocation: updatedBase,
          paymentProfile: updatedPayment,
        }) => {
          setBusinessProfile(updatedBusiness);
          setBaseLocation(updatedBase);
          setPaymentProfile(updatedPayment);
          setScheduledJobs((prev) =>
            recalculateJobsFromDynamicBase(updatedBase.coordinates, prev)
          );
          showBanner(
            `Marca Blanca actualizada: "${updatedBusiness.appName}" · ${updatedBase.city} · $${updatedBusiness.baseRatePerSqm}/m² · Alias: ${updatedPayment.alias}`
          );
        }}
      />

      {/* Mercado Pago SaaS Subscription & Billing Modal */}
      <SubscriptionMercadoPagoModal
        isOpen={isSubscriptionModalOpen}
        subscription={subscription}
        businessName={businessProfile.appName}
        userEmail={activeTenantSession?.email || firebaseUser?.email}
        activeDateStr={activeDate}
        onClose={() => setIsSubscriptionModalOpen(false)}
        onUpdateSubscription={(updatedSub) => setSubscription(updatedSub)}
        onShowBanner={showBanner}
      />

      {/* Operational Modals */}
      <CompleteJobModal
        job={jobToComplete}
        invoices={invoices}
        paymentProfile={paymentProfile}
        isOnline={isOnline}
        initialDurationMinutes={
          jobToComplete && activeCutTimer?.jobId === jobToComplete.id && activeCutTimer.elapsedSeconds > 0
            ? Math.max(1, Math.round(activeCutTimer.elapsedSeconds / 60))
            : jobToComplete?.actualDurationMinutes ?? jobToComplete?.estimatedMinutes ?? null
        }
        onClose={() => setJobToComplete(null)}
        onConfirmComplete={handleConfirmCompleteJob}
      />

      <ClientHistoryModal
        client={
          historyClientModal
            ? properties.find((p) => p.id === historyClientModal.id) ||
              historyClientModal
            : null
        }
        invoices={invoices}
        jobs={scheduledJobs}
        onClose={() => setHistoryClientModal(null)}
        onEditClient={(client) => {
          setEditingClient(client);
          setPrefillClientData(null);
          setIsClientModalOpen(true);
        }}
        onSelectInvoiceReceipt={(inv) => setSelectedInvoiceReceipt(inv)}
        onAddClientPhotos={handleAddClientPhotos}
      />

      <ClientFormModal
        isOpen={isClientModalOpen}
        editingClient={editingClient}
        prefillData={prefillClientData}
        defaultDate={modalDefaultDate}
        defaultTime={modalDefaultTime}
        baseLocation={baseLocation}
        businessProfile={businessProfile}
        existingProperties={properties}
        onClose={() => {
          setIsClientModalOpen(false);
          setEditingClient(null);
          setPrefillClientData(null);
        }}
        onSaveClient={handleSaveClient}
      />

      <EditScheduledJobModal
        job={editingScheduledJob}
        baseLocation={baseLocation}
        existingProperties={properties}
        invoices={invoices}
        onClose={() => setEditingScheduledJob(null)}
        onSaveScheduledJob={handleUpdateScheduledJob}
        onDeleteScheduledJob={handleRemoveStopFromSchedule}
      />

      <ScheduleJobModal
        isOpen={scheduleModalState.isOpen}
        properties={properties}
        invoices={invoices}
        preselectedPropertyId={scheduleModalState.preselectedPropertyId}
        defaultDate={scheduleModalState.defaultDate}
        defaultTime={scheduleModalState.defaultTime}
        onClose={() =>
          setScheduleModalState((prev) => ({ ...prev, isOpen: false }))
        }
        onConfirmSchedule={handleConfirmScheduleJob}
        onSwitchToNewClient={(dateStr, timeStr) => {
          setEditingClient(null);
          setPrefillClientData(null);
          setModalDefaultDate(dateStr);
          setModalDefaultTime(timeStr);
          setIsClientModalOpen(true);
        }}
      />

      <BaseLocationModal
        isOpen={isBaseModalOpen}
        currentBase={baseLocation}
        isLocatingGps={isLocatingGps}
        onClose={() => setIsBaseModalOpen(false)}
        onSaveBaseLocation={handleUpdateBaseLocation}
        onTriggerLiveGps={handleUseCurrentGps}
      />

      <ConfirmDeleteModal
        isOpen={deleteDialog.isOpen}
        title={deleteDialog.title}
        description={deleteDialog.description}
        confirmLabel={deleteDialog.confirmLabel}
        onCancel={() =>
          setDeleteDialog((prev) => ({ ...prev, isOpen: false }))
        }
        onConfirm={deleteDialog.onConfirm}
      />

      <ConfirmSheetsActionModal
        isOpen={sheetsConfirmDialog.isOpen}
        actionType={sheetsConfirmDialog.actionType}
        spreadsheetTitle={`${businessProfile.appName} — Control ${baseLocation.city} y Zona`}
        clientsCount={properties.length}
        invoicesCount={invoices.length}
        expensesCount={expenses.length}
        onCancel={() =>
          setSheetsConfirmDialog((prev) => ({ ...prev, isOpen: false }))
        }
        onConfirm={() => {
          if (sheetsConfirmDialog.actionType === 'create') {
            executeCreateAndSyncSheet();
          } else {
            executeSyncExistingSheet();
          }
        }}
      />

      <InvoiceReceiptModal
        invoice={selectedInvoiceReceipt}
        paymentProfile={paymentProfile}
        businessProfile={businessProfile}
        onClose={() => setSelectedInvoiceReceipt(null)}
        onEditInvoice={(inv) => setEditingInvoice(inv)}
      />

      <EditInvoiceModal
        invoice={editingInvoice}
        onClose={() => setEditingInvoice(null)}
        onSaveInvoice={handleUpdateInvoice}
      />

      <BusinessProfileModal
        isOpen={isBusinessProfileModalOpen}
        businessProfile={businessProfile}
        paymentProfile={paymentProfile}
        onClose={() => setIsBusinessProfileModalOpen(false)}
        onSaveBusinessAndPayment={handleSaveBusinessAndPayment}
      />

      <OfflineQueueAndAliasModal
        isOpen={isOfflineAndAliasModalOpen}
        isOnline={isOnline}
        simulatedOffline={simulatedOffline}
        swReady={swReady}
        offlineQueue={offlineQueue}
        pendingCount={offlinePendingCount}
        paymentProfile={paymentProfile}
        onToggleSimulatedOffline={setSimulatedOffline}
        onFlushQueue={flushPendingActions}
        onClearSyncedHistory={clearSyncedHistory}
        onSavePaymentProfile={(profile) => {
          setPaymentProfile(profile);
          showBanner(
            `Alias de cobro "${profile.alias}" guardado para los recibos de WhatsApp.`
          );
        }}
        onClose={() => setIsOfflineAndAliasModalOpen(false)}
      />

      {/* Global Command Palette (⌘K / Ctrl+K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        todayJobs={activeDateJobs}
        properties={properties}
        isDarkMode={isDarkMode}
        isEasyAccessMode={isEasyAccessMode}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigateTab={(tab) => setActiveTab(tab)}
        onSelectJobOnRoute={(jobId) => {
          setActiveTab('ruta');
          setSelectedJobId(jobId);
        }}
        onOpenClientHistory={(prop) => setHistoryClientModal(prop)}
        onOpenNewCutModal={() => {
          setEditingClient(null);
          setPrefillClientData(null);
          setModalDefaultDate(activeDate);
          setModalDefaultTime('08:30');
          setIsClientModalOpen(true);
        }}
        onOptimizeRoute2Opt={handleOptimizeRoute}
        onRainDelay={handleRainDelay}
        onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
        onToggleVoiceMode={handleToggleEasyAccessMode}
      />
    </div>
  );
}
