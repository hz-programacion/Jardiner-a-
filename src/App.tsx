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
  LogOut,
  MapPin,
  MessageCircle,
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
  Wifi,
  WifiOff,
} from 'lucide-react';
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
  OperationalExpense,
  PaymentMethod,
  PaymentProfileConfig,
  ScheduledJob,
  TenantSubscriptionConfig,
} from './types/lawn';
import {
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
  getClientCutTimeHistory,
  getClientPriceHistory,
  getTodayIsoLocal,
  getWeatherForDate,
  moveScheduledJobOrder,
  optimizeRouteOrder,
  recalculateJobsFromDynamicBase,
  reschedulePendingJobsForRain,
  sanitizeAndValidateBackupPayload,
  updateEquipmentItemInState,
  updateInvoiceRecordInState,
  updateOperationalExpenseInState,
  updateScheduledJobInState,
} from './utils/lawnLogic';
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

type ActiveTab =
  | 'ruta'
  | 'agenda'
  | 'clientes'
  | 'cotizador'
  | 'facturacion'
  | 'respaldo'
  | 'admin';

const DEMO_STORAGE_KEY = 'pastopro_demo_workspace_v2';
const ACTIVE_TENANT_SESSION_KEY = 'pastopro_active_tenant_session_v1';
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
  const [activeTab, setActiveTab] = useState<ActiveTab>('ruta');
  const [activeDate, setActiveDate] = useState<string>(TODAY_REFERENCE);
  const [mobileRouteSubView, setMobileRouteSubView] = useState<'list' | 'map'>(
    'list'
  );
  const [routeStatusFilter, setRouteStatusFilter] = useState<
    'todos' | 'pendientes' | 'completados'
  >('todos');
  const [routeSearchQuery, setRouteSearchQuery] = useState<string>('');

  // Firebase Authentication & Multi-Tenant Session State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [activeTenantSession, setActiveTenantSession] =
    useState<AuthenticatedTenantSession | null>(() => {
      try {
        const raw = localStorage.getItem(ACTIVE_TENANT_SESSION_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.uid && parsed.email) return parsed;
        }
      } catch {
        // ignore
      }
      return null;
    });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [localModeAccepted, setLocalModeAccepted] = useState<boolean>(() => {
    try {
      // Remove legacy permanent local-mode bypass so unauthenticated launches show Login
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
    activeTenantSession?.email || firebaseUser?.email || null;
  const isAdminUser = isPrimaryAdminEmail(activeUserEmail);
  const currentStorageKey = useMemo(
    () => getTenantStorageKey(activeTenantUid, !activeTenantUid),
    [activeTenantUid]
  );

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
        customCityInput: session.customCityInput,
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

      setBusinessProfile(blank.businessProfile);
      setBaseLocation(blank.baseLocation);
      setPaymentProfile(blank.paymentProfile);
      setSubscription(blank.subscription);
      setProperties(blank.properties);
      setScheduledJobs(blank.todayJobs);
      setInvoices(blank.invoices);
      setExpenses(blank.expenses);
      setEquipment(blank.equipment);
      setSelectedJobId(null);

      try {
        localStorage.setItem(tenantKey, JSON.stringify(blank));
      } catch {
        // ignore
      }

      hasHydratedFromCloudRef.current = session.uid;
      const saved = await saveWorkspaceToFirestore(session.uid, {
        ...blank,
        ownerEmail: session.email,
      });
      setCloudSyncState(saved.ok ? 'synced' : 'idle');
      setCloudSyncMessage(
        saved.ok
          ? 'Cuenta aislada inicializada y sincronizada en la nube.'
          : `Espacio privado inicializado para ${blank.businessProfile.appName} (${blank.baseLocation.city}).`
      );

      // Only open White-Label wizard automatically if the account is already approved (e.g. Admin)
      if (initialApproval.isApproved) {
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

  // Close active modal when pressing Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
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

  const handleOptimizeRoute = () => {
    const result = optimizeRouteOrder(baseLocation.coordinates, activeDateJobs);
    setScheduledJobs((prev) => {
      const otherDays = prev.filter((j) => j.scheduledDate !== activeDate);
      return [...otherDays, ...result.orderedJobs];
    });
    showBanner(
      `Ruta del ${activeDate} optimizada desde ${baseLocation.city}: ${result.orderedJobs.length} paradas (${result.totalDistanceKm} km estimados).`
    );
  };

  const handleRainDelayForDate = (targetDateStr = activeDate) => {
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
    actualDurationMinutes?: number
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
      resolvedDuration
    );

    setScheduledJobs((prev) =>
      prev.map((j) => (j.id === jobId ? updatedJob : j))
    );
    setInvoices((prev) => [invoice, ...prev]);

    setProperties((prev) =>
      prev.map((prop) =>
        prop.id === targetJob.propertyId
          ? {
              ...prop,
              basePrice: updateClientBasePrice ? finalPrice : prop.basePrice,
              lastCutDate: targetJob.scheduledDate,
              nextCutDate: invoice.nextScheduledDate,
            }
          : prop
      )
    );

    if (activeCutTimer?.jobId === jobId) {
      setActiveCutTimer(null);
    }

    const { queuedOffline } = recordAction(
      'COMPLETE_JOB',
      `Corte completado: ${targetJob.clientName}`,
      `${invoice.invoiceNumber} · $${finalPrice.toLocaleString('es-AR')} · ${resolvedDuration} min (${
        paidNow ? paymentMethod : 'Cuenta Cte.'
      })`
    );

    setJobToComplete(null);
    setSelectedInvoiceReceipt(invoice);
    showBanner(
      `Corte finalizado en ${targetJob.clientName} (${resolvedDuration} min). Recibo ${invoice.invoiceNumber} emitido por $${finalPrice.toLocaleString('es-AR')}.${
        queuedOffline
          ? ' Guardado en cola offline para sincronizar al recuperar señal.'
          : ''
      }`
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
    const email = activeTenantSession?.email || firebaseUser?.email || '';
    if (isPrimaryAdminEmail(email)) return true;
    if (activeTenantSession && typeof activeTenantSession.isApproved === 'boolean') {
      return activeTenantSession.isApproved;
    }
    if (activeTenantUid) {
      return getLocalTenantApprovalState(activeTenantUid, email).isApproved;
    }
    return false;
  }, [localModeAccepted, activeTenantSession, firebaseUser, activeTenantUid]);

  // 1. If user is not authenticated and hasn't explicitly entered Demo Mode in this session, show the Login Gate
  if (!firebaseUser && !activeTenantSession && !localModeAccepted) {
    return (
      <AuthGate
        currentUser={null}
        activeTenantSession={null}
        isModalOpen={true}
        isFullScreenGate={true}
        appName={businessProfile.appName}
        slogan={businessProfile.slogan}
        cloudSyncState={cloudSyncState}
        cloudSyncMessage={cloudSyncMessage}
        onCloseModal={() => {}}
        onContinueLocalMode={() => {
          // Load Demo workspace explicitly without persisting permanent auth bypass
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

  return (
    <div className="min-h-screen bg-[#F3F6F5] text-zinc-900 flex flex-col pb-20 md:pb-10">
      {/* Skip-to-Content Link */}
      <a
        href="#main-workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2.5 focus:rounded-xl focus:bg-zinc-950 focus:text-white focus:font-bold focus:text-sm focus:shadow-lg"
      >
        Saltar al contenido principal
      </a>

      {/* Top Bar — Architectural Command Header */}
      <header className="sticky top-0 z-30 min-h-14 md:min-h-16 bg-[#0B1D16] text-white border-b border-emerald-950 px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        {/* Zone 1: Minimalist Brand Wordmark + Custom Uploaded Logo */}
        <a
          href="#ruta"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('ruta');
          }}
          title="Ir a Hoy / Ruta"
          className="flex items-center gap-2.5 font-display text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          {businessProfile.logoUrl ? (
            <img
              src={businessProfile.logoUrl}
              alt={businessProfile.appName}
              className="w-7 h-7 rounded-lg object-cover border border-white/20 shrink-0"
            />
          ) : (
            <span
              style={{
                backgroundColor: businessProfile.brandColor || '#14B8A6',
              }}
              className="w-2.5 h-2.5 rounded-full shrink-0"
            />
          )}
          <span className="truncate max-w-[160px] sm:max-w-[240px]">
            {businessProfile.appName}
          </span>
        </a>

        {/* Zone 2: Clean Typographic Navigation Links */}
        <nav
          aria-label="Navegación principal"
          className="hidden md:flex items-center gap-2 lg:gap-4 text-xs lg:text-sm font-medium"
        >
          <button
            type="button"
            onClick={() => setActiveTab('ruta')}
            className={`min-h-[36px] px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'ruta'
                ? 'bg-teal-500/20 text-teal-300 font-semibold border border-teal-400/30'
                : 'text-emerald-100/75 hover:text-white hover:bg-white/5'
            }`}
          >
            Hoy / Ruta
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('agenda')}
            className={`min-h-[36px] px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'agenda'
                ? 'bg-teal-500/20 text-teal-300 font-semibold border border-teal-400/30'
                : 'text-emerald-100/75 hover:text-white hover:bg-white/5'
            }`}
          >
            Agenda
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('clientes')}
            className={`min-h-[36px] px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'clientes'
                ? 'bg-teal-500/20 text-teal-300 font-semibold border border-teal-400/30'
                : 'text-emerald-100/75 hover:text-white hover:bg-white/5'
            }`}
          >
            Clientes
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('facturacion')}
            className={`min-h-[36px] px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap shrink-0 ${
              isMoreSectionActive
                ? 'bg-teal-500/20 text-teal-300 font-semibold border border-teal-400/30'
                : 'text-emerald-100/75 hover:text-white hover:bg-white/5'
            }`}
          >
            Mi Plata
          </button>

          {isAdminUser && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              data-testid="nav-admin-panel-btn"
              className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'admin'
                  ? 'bg-teal-400 text-[#0B1D16] font-bold'
                  : 'bg-white/10 text-teal-300 hover:bg-white/15 border border-teal-400/30'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Panel Admin</span>
            </button>
          )}
        </nav>

        {/* Zone 3: Primary Action CTA + Commercial/Account Controls + Cerrar Sesión */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {isAdminUser && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className="md:hidden min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-teal-400 text-[#0B1D16] whitespace-nowrap shrink-0"
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Admin</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIsFirstTimeWhiteLabelSetup(false);
              setIsWhiteLabelModalOpen(true);
            }}
            data-testid="open-whitelabel-btn"
            title="Configurar marca propia, logo, ciudad y precios"
            className="hidden lg:inline-flex min-h-[36px] items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-white/10 text-emerald-100 hover:bg-white/15 transition-colors whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-300 shrink-0" />
            <span>Mi Marca</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSubscriptionModalOpen(true)}
            data-testid="open-subscription-btn"
            title="Licencia Comercial de Pago Único"
            className="min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-white/10 text-emerald-100 hover:bg-white/15 transition-colors whitespace-nowrap shrink-0"
          >
            <CreditCard className="w-3.5 h-3.5 text-teal-300 shrink-0" />
            <span className="hidden sm:inline">
              {subscriptionEval.badgeText}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsAuthModalOpen(true)}
            data-testid="open-firebase-auth-btn"
            title="Ver estado de cuenta y respaldo en la nube"
            className="hidden sm:inline-flex min-h-[36px] items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-white/10 text-emerald-100 hover:bg-white/15 transition-colors whitespace-nowrap shrink-0"
          >
            <UserIcon className="w-3.5 h-3.5 text-teal-300 shrink-0" />
            <span className="truncate max-w-[110px]">
              {activeTenantSession?.email ||
                firebaseUser?.email ||
                'Cuenta'}
            </span>
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
            className="min-h-[36px] px-3 sm:px-3.5 py-1.5 text-xs font-bold text-[#0B1D16] bg-teal-400 rounded-xl hover:bg-teal-300 active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
          >
            + Nuevo Corte
          </button>

          <button
            type="button"
            onClick={handleFullLogout}
            data-testid="logout-btn"
            title="Cerrar sesión y volver a la pantalla de acceso"
            className="min-h-[36px] inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:text-white bg-white/10 hover:bg-red-600/80 rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main
        id="main-workspace"
        className="flex-1 max-w-[1400px] w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4"
      >

        {routeNotice && (
          <div
            role="status"
            aria-live="polite"
            className="surface-command text-white text-xs sm:text-sm font-medium px-4 py-3 rounded-xl flex items-center justify-between gap-3"
          >
            <span className="break-words min-w-0">{routeNotice}</span>
            <button
              type="button"
              onClick={() => setRouteNotice(null)}
              className="text-zinc-300 hover:text-white text-xs font-semibold underline shrink-0"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Cronómetro de Corte en Vivo (Flotante cuando se está cortando un lote) */}
        {activeCutTimer && (
          <div
            data-testid="active-cut-timer-banner"
            className="bg-[#0B1D16] text-white border border-teal-500/40 rounded-2xl p-3.5 sm:px-5 flex flex-wrap items-center justify-between gap-3 shadow-md"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`w-3 h-3 rounded-full shrink-0 ${
                  activeCutTimer.isRunning
                    ? 'bg-teal-400 animate-pulse'
                    : 'bg-amber-400'
                }`}
              />
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-teal-300">
                  {activeCutTimer.isRunning
                    ? 'Cronómetro de Corte en Curso'
                    : 'Cronómetro en Pausa'}
                </div>
                <div className="text-sm font-bold text-white truncate">
                  {activeCutTimer.clientName}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div
                data-testid="active-cut-timer-display"
                className="font-mono text-xl sm:text-2xl font-bold text-teal-300 tabular-nums px-3 py-1 rounded-xl bg-white/10 border border-white/10"
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
                className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
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
                className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-[#0B1D16] bg-teal-400 hover:bg-teal-300 rounded-xl transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>
                  Terminar y Guardar (
                  {Math.max(1, Math.round(activeCutTimer.elapsedSeconds / 60))}{' '}
                  min)
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Sub-navegación de "Mi Plata" */}
        {isMoreSectionActive && (
          <section
            aria-label="Secciones de Mi Plata y Herramientas"
            className="surface-card rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('facturacion')}
                className={`min-h-[38px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === 'facturacion'
                    ? 'bg-zinc-950 text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Mi Plata (Cobros y Gastos)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('cotizador')}
                className={`min-h-[38px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === 'cotizador'
                    ? 'bg-zinc-950 text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                <Calculator className="w-4 h-4" />
                <span>Cotizador de Lotes</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('respaldo')}
                className={`min-h-[38px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === 'respaldo'
                    ? 'bg-zinc-950 text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Google Sheets y Máquinas</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsBusinessProfileModalOpen(true)}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors"
              >
                <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>
                  Emprendimiento ({businessProfile.appName}) / Tarifas
                </span>
              </button>
              <button
                type="button"
                onClick={() => setIsOfflineAndAliasModalOpen(true)}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors"
              >
                <Wifi className="w-3.5 h-3.5 text-emerald-700" />
                <span>Alias ({paymentProfile.alias}) / Modo Campo</span>
              </button>
              <PWAInstallButton />
            </div>
          </section>
        )}

        {/* TAB 1: HOY / MI RUTA — Minimalist Architectural Workspace */}
        {activeTab === 'ruta' && (
          <div className="space-y-4">
            {/* Minimalist Executive Daily Summary Card */}
            <section
              aria-label="Resumen operativo de la jornada"
              className="surface-card rounded-2xl p-4 sm:p-5 space-y-4"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Date Selector + Minimalist Context Line */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="inline-flex items-center bg-zinc-100 rounded-xl p-0.5 border border-zinc-200/80">
                      <button
                        type="button"
                        onClick={() => shiftActiveDate(-1)}
                        aria-label="Día anterior"
                        className="min-h-[32px] min-w-[30px] flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-950 hover:bg-white transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveDate(TODAY_REFERENCE)}
                        className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          activeDate === TODAY_REFERENCE
                            ? 'bg-zinc-950 text-white'
                            : 'text-zinc-700 hover:bg-white'
                        }`}
                      >
                        Hoy
                      </button>
                      <input
                        type="date"
                        aria-label="Fecha de jornada activa"
                        value={activeDate}
                        onChange={(e) =>
                          setActiveDate(e.target.value || TODAY_REFERENCE)
                        }
                        className="bg-transparent text-xs font-mono font-semibold text-zinc-900 px-2 py-1 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => shiftActiveDate(1)}
                        aria-label="Día siguiente"
                        className="min-h-[32px] min-w-[30px] flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-950 hover:bg-white transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Weather & Quick Settings Links */}
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-zinc-500">
                      <span className="inline-flex items-center gap-1 font-medium text-zinc-800">
                        {activeDayWeather.condition === 'Alerta Lluvia' ? (
                          <CloudRain className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        ) : activeDayWeather.condition ===
                          'Parcialmente Nublado' ? (
                          <CloudSun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        ) : (
                          <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        )}
                        <span>
                          {activeDayWeather.tempMax}°C ·{' '}
                          {activeDayWeather.condition}
                        </span>
                      </span>

                      <span aria-hidden="true" className="text-zinc-300">
                        ·
                      </span>

                      <button
                        type="button"
                        onClick={() => setIsBaseModalOpen(true)}
                        className="inline-flex items-center gap-1 hover:text-zinc-950 transition-colors"
                      >
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Salida: {baseLocation.city}</span>
                        <span className="underline text-zinc-700 font-medium">
                          Cambiar
                        </span>
                      </button>

                      <span aria-hidden="true" className="text-zinc-300">
                        ·
                      </span>

                      <button
                        type="button"
                        onClick={() => setIsBusinessProfileModalOpen(true)}
                        className="inline-flex items-center gap-1 hover:text-zinc-950 transition-colors"
                      >
                        <span>App: {businessProfile.appName}</span>
                        <span className="underline text-zinc-700 font-medium">
                          Editar nombre
                        </span>
                      </button>

                      <span aria-hidden="true" className="text-zinc-300">
                        ·
                      </span>

                      <button
                        type="button"
                        onClick={() => setIsOfflineAndAliasModalOpen(true)}
                        className="inline-flex items-center gap-1 hover:text-zinc-950 transition-colors"
                      >
                        {!isOnline ? (
                          <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                        ) : (
                          <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span className="underline text-zinc-700 font-medium">
                          {!isOnline || offlinePendingCount > 0
                            ? `Sin señal (${offlinePendingCount})`
                            : `Alias: ${paymentProfile.alias}`}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: 3 Clean Inline Typographic Metrics + Add Stop CTA */}
                <div className="flex flex-wrap items-center justify-between lg:justify-end gap-5 pt-3 lg:pt-0 border-t lg:border-t-0 border-zinc-100">
                  <div className="flex items-center gap-5">
                    <div>
                      <div className="text-[11px] font-medium text-zinc-500">
                        Avance
                      </div>
                      <div className="text-base sm:text-lg font-bold font-mono text-zinc-950 tabular-nums">
                        {routeMetrics.completedCount}/{activeDateJobs.length}{' '}
                        <span className="text-xs font-sans font-normal text-zinc-500">
                          ({completionRatio}%)
                        </span>
                      </div>
                    </div>

                    <div className="h-7 w-px bg-zinc-200" />

                    <div>
                      <div className="text-[11px] font-medium text-zinc-500">
                        Estimado Hoy
                      </div>
                      <div className="text-base sm:text-lg font-bold font-mono text-emerald-700 tabular-nums">
                        $
                        {routeMetrics.expectedRevenueToday.toLocaleString(
                          'es-AR'
                        )}
                      </div>
                    </div>

                    <div className="h-7 w-px bg-zinc-200 hidden sm:block" />

                    <div className="hidden sm:block">
                      <div className="text-[11px] font-medium text-zinc-500">
                        Recorrido
                      </div>
                      <div className="text-base font-bold font-mono text-zinc-900 tabular-nums">
                        {routeMetrics.totalDistanceKm} km
                      </div>
                    </div>
                  </div>

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
                    className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Sumar Corte a Hoy</span>
                  </button>
                </div>
              </div>

              {/* Minimalist 7-Day Week Switcher */}
              <div
                role="group"
                aria-label="Cambiar rápido de día en la semana actual"
                className="flex sm:grid sm:grid-cols-7 gap-1.5 pt-3 border-t border-zinc-100 overflow-x-auto pb-0.5 sm:pb-0"
              >
                {activeWeekDays.map((dayCell) => {
                  const isSelectedDay = dayCell.dateStr === activeDate;
                  const jobsCount = dayCell.jobs.length;
                  return (
                    <button
                      key={dayCell.dateStr}
                      type="button"
                      onClick={() => setActiveDate(dayCell.dateStr)}
                      className={`min-h-[44px] min-w-[68px] sm:min-w-0 px-2.5 py-1.5 rounded-xl flex flex-col items-center justify-center shrink-0 transition-all border ${
                        isSelectedDay
                          ? 'bg-zinc-950 text-white border-zinc-950 font-semibold'
                          : 'bg-zinc-50/80 text-zinc-700 border-zinc-200/60 hover:bg-zinc-100'
                      }`}
                    >
                      <span className="text-[10px] font-medium opacity-80 whitespace-nowrap">
                        {dayCell.weekdayShort} {dayCell.dayOfMonth}
                      </span>
                      <span
                        className={`text-[11px] font-mono tabular-nums mt-0.5 whitespace-nowrap ${
                          isSelectedDay
                            ? 'text-emerald-400 font-semibold'
                            : jobsCount > 0
                            ? 'text-emerald-700 font-medium'
                            : 'text-zinc-400'
                        }`}
                      >
                        {jobsCount === 1
                          ? '1 corte'
                          : jobsCount > 1
                          ? `${jobsCount} cortes`
                          : 'Libre'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Mobile Sub-View Switcher: Lista vs Mapa */}
            <div className="grid grid-cols-2 gap-1.5 lg:hidden surface-card p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setMobileRouteSubView('list')}
                className={`min-h-[40px] rounded-lg text-xs font-semibold transition-all ${
                  mobileRouteSubView === 'list'
                    ? 'bg-zinc-950 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                Lista de Cortes ({activeDateJobs.length})
              </button>
              <button
                type="button"
                onClick={() => setMobileRouteSubView('map')}
                className={`min-h-[40px] rounded-lg text-xs font-semibold transition-all ${
                  mobileRouteSubView === 'map'
                    ? 'bg-zinc-950 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                Mapa GPS en Vivo
              </button>
            </div>

            {/* Two-Column Split: Stop Timeline List (Left) + Interactive GPS Map (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left Column: Minimalist Filter Bar & Stop Cards */}
              <div
                className={`lg:col-span-6 space-y-2.5 ${
                  mobileRouteSubView === 'map' ? 'hidden lg:block' : 'block'
                }`}
              >
                {/* Clean Single-Row Filter, Search & Route Optimization Bar */}
                <div className="surface-card rounded-2xl p-3 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div
                      role="group"
                      aria-label="Filtrar paradas del día"
                      className="inline-flex items-center p-0.5 bg-zinc-100 rounded-xl"
                    >
                      {(
                        [
                          {
                            id: 'todos',
                            label: `Todos (${activeDateJobs.length})`,
                          },
                          {
                            id: 'pendientes',
                            label: `Pendientes (${routeMetrics.pendingCount})`,
                          },
                          {
                            id: 'completados',
                            label: `Listos (${routeMetrics.completedCount})`,
                          },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setRouteStatusFilter(tab.id)}
                          className={`min-h-[30px] px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                            routeStatusFilter === tab.id
                              ? 'bg-white text-zinc-950 shadow-2xs'
                              : 'text-zinc-600 hover:text-zinc-950'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleOptimizeRoute}
                        className="min-h-[32px] inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-700 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors whitespace-nowrap"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Ordenar por cercanía</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRainDelay}
                        title="Pasar los cortes pendientes para mañana por lluvia"
                        className="min-h-[32px] inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-700 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors whitespace-nowrap"
                      >
                        <CloudRain className="w-3.5 h-3.5 text-sky-600" />
                        <span>Llovió (+1d)</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Buscar cliente o calle..."
                        value={routeSearchQuery}
                        onChange={(e) => setRouteSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200/80 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>

                    {activeDateJobs.length > 0 && (
                      <a
                        href={fullRouteGoogleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[32px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
                      >
                        <Navigation className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Ruta GPS</span>
                        <ExternalLink className="w-3 h-3 text-zinc-400" />
                      </a>
                    )}
                  </div>
                </div>

                {filteredActiveDateJobs.length === 0 ? (
                  <div className="surface-card rounded-2xl p-8 text-center space-y-3">
                    <p className="text-base font-bold text-zinc-900">
                      {activeDateJobs.length === 0
                        ? `Sin cortes agendados para el ${activeDate}`
                        : 'No hay paradas que coincidan con ese filtro'}
                    </p>
                    <p className="text-xs sm:text-sm text-zinc-500 max-w-md mx-auto">
                      {activeDateJobs.length === 0
                        ? 'Programa un corte para esta fecha o consulta la agenda semanal y mensual.'
                        : 'Cambia el filtro a "Todos" o limpia el buscador.'}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      {activeDateJobs.length === 0 ? (
                        <>
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
                            className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-zinc-950 rounded-xl hover:bg-zinc-800"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Programar Corte</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab('agenda')}
                            className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-zinc-700 bg-zinc-100 rounded-xl hover:bg-zinc-200"
                          >
                            <CalendarIcon className="w-4 h-4" />
                            <span>Ver Agenda</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setRouteStatusFilter('todos');
                            setRouteSearchQuery('');
                          }}
                          className="min-h-[38px] px-4 py-2 text-xs font-semibold text-zinc-800 bg-zinc-100 rounded-xl hover:bg-zinc-200"
                        >
                          Mostrar todas las paradas ({activeDateJobs.length})
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredActiveDateJobs.map((job) => {
                      const isSelected = job.id === selectedJobId;
                      const isCompleted = job.status === 'Completado';
                      const isInProgress = job.status === 'En Curso';
                      const navUrl = buildGoogleMapsNavUrl(job.coordinates);
                      const whatsappEtaUrl = buildSafeWhatsAppUrl(
                        job.phone,
                        `Hola ${job.clientName}, te aviso que estoy yendo para ${job.address} a cortar el pasto.`
                      );
                      const matchingInvoice = invoices.find(
                        (inv) => inv.id === job.invoiceId
                      );
                      const matchingProperty = properties.find(
                        (p) => p.id === job.propertyId
                      );
                      const clientHistory = getClientPriceHistory(
                        job.propertyId,
                        job.clientName,
                        invoices
                      );
                      const cutTimeSummary = getClientCutTimeHistory(
                        job.propertyId,
                        job.clientName,
                        invoices,
                        scheduledJobs,
                        job.estimatedMinutes,
                        job.areaSqm
                      );
                      const isTimerOnThisJob =
                        activeCutTimer?.jobId === job.id;
                      const recordedDurationMin =
                        job.actualDurationMinutes ||
                        matchingInvoice?.actualDurationMinutes;
                      const endTime = computeEndTimeFromStart(
                        job.scheduledTime || '08:00',
                        job.estimatedMinutes
                      );

                      return (
                        <article
                          key={job.id}
                          onClick={() => setSelectedJobId(job.id)}
                          className={`surface-card card-interactive-lift rounded-2xl p-4 transition-all cursor-pointer min-w-0 break-words ${
                            isSelected
                              ? 'stop-card-spotlight ring-1 ring-emerald-600/20'
                              : ''
                          } ${isCompleted ? 'opacity-75 bg-zinc-50/70' : ''}`}
                        >
                          {/* Clean Minimalist Header Row */}
                          <div className="flex items-start justify-between gap-3 min-w-0">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="flex flex-col items-center gap-1 shrink-0">
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold ${
                                    isCompleted
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : isInProgress
                                      ? 'bg-amber-500 text-zinc-950'
                                      : isSelected
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-zinc-100 text-zinc-800'
                                  }`}
                                >
                                  {isCompleted ? '✓' : job.orderIndex}
                                </div>
                                {isSelected &&
                                  !isCompleted &&
                                  activeDateJobs.length > 1 && (
                                    <div
                                      className="flex items-center gap-0.5"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleMoveJobOrder(job.id, 'up')
                                        }
                                        disabled={job.orderIndex <= 1}
                                        title="Subir parada en el orden"
                                        aria-label={`Subir orden de ${job.clientName}`}
                                        className="p-0.5 text-zinc-400 hover:text-zinc-900 disabled:opacity-25 rounded"
                                      >
                                        <ArrowUp className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleMoveJobOrder(job.id, 'down')
                                        }
                                        disabled={
                                          job.orderIndex >=
                                          activeDateJobs.length
                                        }
                                        title="Bajar parada en el orden"
                                        aria-label={`Bajar orden de ${job.clientName}`}
                                        className="p-0.5 text-zinc-400 hover:text-zinc-900 disabled:opacity-25 rounded"
                                      >
                                        <ArrowDown className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono text-zinc-500 tabular-nums">
                                  <span className="font-semibold text-zinc-800">
                                    {job.scheduledTime || '08:00'}–{endTime}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-sans text-zinc-600">
                                    {job.neighborhood}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span>{job.legDistanceKm || 1.9} km</span>
                                  <span aria-hidden="true">·</span>
                                  <span
                                    data-testid="stop-cut-time-badge"
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200/80 text-[11px] font-semibold"
                                  >
                                    <Clock className="w-3 h-3 shrink-0" />
                                    {isTimerOnThisJob ? (
                                      <span>
                                        {formatStopwatchSeconds(
                                          activeCutTimer.elapsedSeconds
                                        )}
                                      </span>
                                    ) : recordedDurationMin ? (
                                      <span>Real: {recordedDurationMin} min</span>
                                    ) : (
                                      <span>
                                        Prom:{' '}
                                        {cutTimeSummary.averageMinutes ??
                                          job.estimatedMinutes}{' '}
                                        min
                                      </span>
                                    )}
                                  </span>
                                  {isInProgress && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="font-sans font-semibold text-amber-700">
                                        En curso
                                      </span>
                                    </>
                                  )}
                                </div>

                                <h3 className="font-display text-base font-bold text-zinc-950 mt-0.5 leading-snug break-words">
                                  {job.clientName}
                                </h3>

                                <p className="text-xs text-zinc-500 mt-0.5 flex flex-wrap items-center gap-1.5 break-words">
                                  <span>{job.address}</span>
                                  <span
                                    aria-hidden="true"
                                    className="text-zinc-300"
                                  >
                                    ·
                                  </span>
                                  <span className="font-mono tabular-nums">
                                    {job.areaSqm} m²
                                  </span>
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-base sm:text-lg font-bold font-mono text-zinc-950 tabular-nums">
                                ${job.price.toLocaleString('es-AR')}
                              </div>
                              <div className="text-[11px] font-mono text-zinc-400 mt-0.5 tabular-nums">
                                {clientHistory.lastAmount ? (
                                  <span>
                                    Ant: $
                                    {clientHistory.lastAmount.toLocaleString(
                                      'es-AR'
                                    )}
                                  </span>
                                ) : (
                                  <span className="font-sans">1° visita</span>
                                )}
                              </div>
                              {(job.photoUrl || matchingInvoice?.photoUrl) && (
                                <div className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 mt-0.5">
                                  <Camera className="w-3 h-3" />
                                  <span>Foto</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Expanded Details & Full Controls only on Selected Stop */}
                          {isSelected ? (
                            <div
                              className="mt-3.5 pt-3 border-t border-zinc-100 space-y-3"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="text-xs text-zinc-600 space-y-1 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200/60 break-words">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <span className="font-semibold text-zinc-900">
                                      Tareas:
                                    </span>{' '}
                                    {job.tasks.join(' + ')}
                                  </div>
                                  <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                                    {job.propertyType} · {job.frequency}
                                  </span>
                                </div>
                                {job.accessNotes && (
                                  <div className="text-xs text-zinc-500">
                                    <span className="font-medium text-zinc-700">
                                      Nota:
                                    </span>{' '}
                                    {job.accessNotes}
                                  </div>
                                )}
                              </div>

                              {/* Panel de Control de Tiempo e Historial de Corte en la Parada */}
                              <div
                                data-testid="stop-card-time-control"
                                className="p-2.5 rounded-xl bg-teal-50/70 border border-teal-200/80 flex flex-wrap items-center justify-between gap-2 text-xs"
                              >
                                <div className="flex flex-wrap items-center gap-2 min-w-0">
                                  <Timer className="w-4 h-4 text-teal-700 shrink-0" />
                                  <div className="min-w-0">
                                    <span className="font-bold text-teal-950">
                                      Tiempo de corte:
                                    </span>{' '}
                                    {isTimerOnThisJob ? (
                                      <span className="font-mono font-bold text-teal-800">
                                        {formatStopwatchSeconds(
                                          activeCutTimer.elapsedSeconds
                                        )}{' '}
                                        en curso
                                      </span>
                                    ) : recordedDurationMin ? (
                                      <span className="font-mono font-bold text-teal-800">
                                        {recordedDurationMin} min registrados
                                      </span>
                                    ) : (
                                      <span className="font-mono text-teal-900">
                                        Est. {job.estimatedMinutes} min · Prom.
                                        cliente:{' '}
                                        <strong>
                                          {cutTimeSummary.averageMinutes ??
                                            job.estimatedMinutes}{' '}
                                          min
                                        </strong>
                                        {cutTimeSummary.lastDurationMinutes
                                          ? ` (Últ: ${cutTimeSummary.lastDurationMinutes} min)`
                                          : ''}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5">
                                  {!isCompleted && (
                                    <button
                                      type="button"
                                      data-testid="stop-start-timer-btn"
                                      onClick={() =>
                                        handleStartJob(job.id, true)
                                      }
                                      className={`min-h-[30px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                                        isTimerOnThisJob &&
                                        activeCutTimer.isRunning
                                          ? 'bg-amber-500 text-zinc-950'
                                          : 'bg-[#0B1D16] text-teal-300 hover:bg-emerald-950'
                                      }`}
                                    >
                                      {isTimerOnThisJob &&
                                      activeCutTimer.isRunning ? (
                                        <>
                                          <Pause className="w-3 h-3" />
                                          <span>Pausar Reloj</span>
                                        </>
                                      ) : (
                                        <>
                                          <Play className="w-3 h-3" />
                                          <span>
                                            {isTimerOnThisJob
                                              ? 'Reanudar Reloj'
                                              : 'Cronometrar Corte'}
                                          </span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                  {matchingProperty && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setHistoryClientModal(matchingProperty)
                                      }
                                      className="min-h-[30px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-teal-900 bg-white border border-teal-200 hover:bg-teal-100 transition-colors"
                                    >
                                      <History className="w-3 h-3" />
                                      <span>
                                        Historial de tiempos (
                                        {cutTimeSummary.totalTimedCuts})
                                      </span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {!isCompleted ? (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setJobToComplete(job)}
                                    className="col-span-2 sm:col-span-1 min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors"
                                  >
                                    <Check className="w-3.5 h-3.5 shrink-0" />
                                    <span>Terminar y Cobrar</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleStartJob(job.id)}
                                    className={`min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                                      isInProgress
                                        ? 'bg-amber-500 text-zinc-950 border-amber-500'
                                        : 'bg-white text-zinc-800 border-zinc-200 hover:bg-zinc-50'
                                    }`}
                                  >
                                    <Play className="w-3.5 h-3.5 shrink-0" />
                                    <span>
                                      {isInProgress
                                        ? 'En Curso'
                                        : 'Iniciar Corte'}
                                    </span>
                                  </button>

                                  <a
                                    href={navUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors"
                                  >
                                    <Navigation className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>Ir con GPS</span>
                                  </a>

                                  <a
                                    href={whatsappEtaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>WhatsApp</span>
                                  </a>
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                                    <Check className="w-4 h-4 shrink-0" />
                                    <span>
                                      Corte finalizado (
                                      {job.completedAt || 'Hoy'})
                                      {recordedDurationMin
                                        ? ` · ${recordedDurationMin} min`
                                        : ''}
                                    </span>
                                  </span>

                                  <div className="flex flex-wrap items-center gap-2">
                                    {matchingInvoice && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSelectedInvoiceReceipt(
                                            matchingInvoice
                                          )
                                        }
                                        className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-zinc-900 rounded-xl hover:bg-zinc-800"
                                      >
                                        <FileText className="w-3.5 h-3.5 shrink-0" />
                                        <span>Comprobante / Imprimir</span>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUndoCompletedJob(job.id)
                                      }
                                      className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-xl"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                                      <span>Reabrir</span>
                                    </button>
                                  </div>
                                </div>
                              )}

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-zinc-500">
                                <div className="flex flex-wrap items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => setEditingScheduledJob(job)}
                                    className="inline-flex items-center gap-1 font-semibold text-zinc-800 hover:text-emerald-700 hover:underline transition-colors"
                                  >
                                    <Pencil className="w-3 h-3" />
                                    <span>
                                      Modificar cita (Hora / Día / Precio)
                                    </span>
                                  </button>

                                  {matchingProperty && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setHistoryClientModal(matchingProperty)
                                      }
                                      className="inline-flex items-center gap-1 font-medium text-zinc-600 hover:text-zinc-950 hover:underline"
                                    >
                                      <History className="w-3 h-3" />
                                      <span>
                                        Cobros ({clientHistory.totalCutsCount})
                                      </span>
                                    </button>
                                  )}

                                  {matchingProperty && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingClient(matchingProperty);
                                        setPrefillClientData(null);
                                        setIsClientModalOpen(true);
                                      }}
                                      className="inline-flex items-center gap-1 font-medium text-zinc-600 hover:text-zinc-950 hover:underline"
                                    >
                                      <span>Ficha cliente</span>
                                    </button>
                                  )}
                                </div>

                                {!isCompleted && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveStopFromSchedule(
                                        job.id,
                                        job.clientName
                                      )
                                    }
                                    aria-label={`Quitar parada de ${job.clientName}`}
                                    className="inline-flex items-center gap-1 font-medium text-zinc-400 hover:text-red-600"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Quitar</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            /* Minimalist Collapsed Footer Row for Non-Selected Stops */
                            <div
                              className="mt-2.5 pt-2 border-t border-zinc-100 flex items-center justify-between gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center gap-3 text-xs">
                                <button
                                  type="button"
                                  onClick={() => setEditingScheduledJob(job)}
                                  className="inline-flex items-center gap-1 font-medium text-zinc-500 hover:text-zinc-900"
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>Editar cita</span>
                                </button>
                                <a
                                  href={navUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 font-medium text-zinc-500 hover:text-zinc-900"
                                >
                                  <Navigation className="w-3 h-3 text-emerald-600" />
                                  <span>GPS</span>
                                </a>
                              </div>

                              {!isCompleted ? (
                                <button
                                  type="button"
                                  onClick={() => setJobToComplete(job)}
                                  className="min-h-[32px] inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Terminar y Cobrar</span>
                                </button>
                              ) : (
                                matchingInvoice && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedInvoiceReceipt(matchingInvoice)
                                    }
                                    className="min-h-[32px] inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>Comprobante</span>
                                  </button>
                                )
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Interactive Google Map with Dynamic Base */}
              <div
                className={`lg:col-span-6 lg:sticky lg:top-20 ${
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

        {/* TAB 7: PANEL EXCLUSIVO DE ADMINISTRADOR (CONTROL DE ACCESO MANUAL) */}
        {activeTab === 'admin' && isAdminUser && (
          <AdminControlPanelView
            currentUserEmail={activeUserEmail || 'hz.mdiego@gmail.com'}
            onShowToast={showBanner}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Navegación móvil"
        className={`md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-zinc-200 grid ${
          isAdminUser ? 'grid-cols-5' : 'grid-cols-4'
        } h-14 px-2`}
      >
        <button
          type="button"
          onClick={() => setActiveTab('ruta')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold rounded-xl my-1 ${
            activeTab === 'ruta'
              ? 'text-zinc-950 bg-zinc-100'
              : 'text-zinc-500'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Hoy / Ruta</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('agenda')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold rounded-xl my-1 ${
            activeTab === 'agenda'
              ? 'text-zinc-950 bg-zinc-100'
              : 'text-zinc-500'
          }`}
        >
          <CalendarIcon className="w-4 h-4" />
          <span>Agenda</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('clientes')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold rounded-xl my-1 ${
            activeTab === 'clientes'
              ? 'text-zinc-950 bg-zinc-100'
              : 'text-zinc-500'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Clientes</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('facturacion')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold rounded-xl my-1 ${
            isMoreSectionActive
              ? 'text-zinc-950 bg-zinc-100'
              : 'text-zinc-500'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Mi Plata</span>
        </button>

        {isAdminUser && (
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold rounded-xl my-1 ${
              activeTab === 'admin'
                ? 'text-teal-900 bg-teal-100'
                : 'text-teal-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Admin</span>
          </button>
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
        client={historyClientModal}
        invoices={invoices}
        jobs={scheduledJobs}
        onClose={() => setHistoryClientModal(null)}
        onEditClient={(client) => {
          setEditingClient(client);
          setPrefillClientData(null);
          setIsClientModalOpen(true);
        }}
        onSelectInvoiceReceipt={(inv) => setSelectedInvoiceReceipt(inv)}
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
    </div>
  );
}
