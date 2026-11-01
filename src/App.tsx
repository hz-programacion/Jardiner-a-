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
  CloudRain,
  CloudSun,
  Compass,
  Crosshair,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  History,
  MapPin,
  MessageCircle,
  Navigation,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Sun,
  Trash2,
  Users,
  Volume2,
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
  AccessibilityPreferences,
  BackupPayload,
  BaseLocationConfig,
  BusinessProfileConfig,
  ClientProperty,
  EquipmentItem,
  InvoiceRecord,
  OperationalExpense,
  ParsedVoiceCommand,
  PaymentMethod,
  PaymentProfileConfig,
  ScheduledJob,
} from './types/lawn';
import {
  applyBulkPriceIncrease,
  buildDailyRouteSpeechText,
  buildGoogleMapsNavUrl,
  buildSafeWhatsAppUrl,
  buildStopSpeechText,
  buildWeekDaysForDate,
  calculateFinancialSummary,
  completeJobAndCreateInvoice,
  computeEndTimeFromStart,
  deleteClientPropertyFromState,
  generateGoogleSheetsTsv,
  generateSpreadsheetCsv,
  getClientPriceHistory,
  getWeatherForDate,
  moveScheduledJobOrder,
  optimizeRouteOrder,
  parseVoiceCommand,
  recalculateJobsFromDynamicBase,
  reschedulePendingJobsForRain,
  sanitizeAndValidateBackupPayload,
  updateEquipmentItemInState,
  updateInvoiceRecordInState,
  updateOperationalExpenseInState,
  updateScheduledJobInState,
} from './utils/lawnLogic';
import { VoiceAccessibilityPanel } from './components/VoiceAccessibilityPanel';
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
  | 'respaldo';

const STORAGE_KEY = 'pastopro_venado_v6';
const SHEETS_META_KEY = 'pastopro_sheets_meta_v6';
const TODAY_REFERENCE = '2026-11-01';

const DEFAULT_PAYMENT_PROFILE: PaymentProfileConfig = {
  alias: 'pastopro.venado',
  cbu: '0000003100084920114502',
  holderName: 'Diego Hernández',
  bankName: 'Banco Santa Fe / MercadoPago',
};

const DEFAULT_BUSINESS_PROFILE: BusinessProfileConfig = {
  appName: 'PastoPro',
  slogan: 'Mantenimiento de Césped, Quintas y Jardines',
  ownerName: 'Diego Hernández',
  ownerPhone: '+54 9 3462 55-1234',
  baseRatePerSqm: 58,
  minServicePrice: 12000,
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
  const heroParallaxRef = useRef<HTMLElement | null>(null);

  // Editable Business & App Identity Profile
  const [businessProfile, setBusinessProfile] = useState<BusinessProfileConfig>(
    () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
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

  // Accessibility & Web Speech API state
  const [accessibilityPrefs, setAccessibilityPrefs] =
    useState<AccessibilityPreferences>(() => {
      try {
        const saved = localStorage.getItem('pastopro_accessibility_prefs_v1');
        if (saved) return JSON.parse(saved);
      } catch {
        // ignore
      }
      return {
        fontScale: 'normal',
        highContrastOutdoor: false,
        autoSpeakConfirmations: true,
        speechRate: 1,
      };
    });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastVoiceStatus, setLastVoiceStatus] = useState<string | null>(null);

  // Dynamic Base Location / GPS Starting Point
  const [baseLocation, setBaseLocation] = useState<BaseLocationConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
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

  // Payment Alias / CBU configuration (Option 3)
  const [paymentProfile, setPaymentProfile] = useState<PaymentProfileConfig>(
    () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
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
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.properties)) return parsed.properties;
      }
    } catch {
      // ignore
    }
    return INITIAL_PROPERTIES;
  });

  // All scheduled jobs across dates (supports Day / Week / Month Calendar + Route view)
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledJob[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
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
      const saved = localStorage.getItem(STORAGE_KEY);
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
      const saved = localStorage.getItem(STORAGE_KEY);
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
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.equipment)) return parsed.equipment;
      }
    } catch {
      // ignore
    }
    return INITIAL_EQUIPMENT;
  });

  // Google Sheets OAuth & spreadsheet state (token kept strictly in memory in googleSheetsService)
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

  // Active Date's jobs for Route & Map view
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

  // Client Modal state (Create, Edit, or Convert from Quote with Date/Time)
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientProperty | null>(
    null
  );
  const [prefillClientData, setPrefillClientData] =
    useState<Partial<ClientProperty> | null>(null);
  const [modalDefaultDate, setModalDefaultDate] =
    useState<string>(TODAY_REFERENCE);
  const [modalDefaultTime, setModalDefaultTime] = useState<string>('08:30');

  // Schedule Existing Client Modal state
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

  // Confirmation modal state for deletions
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

  const showBanner = useCallback((msg: string) => {
    setRouteNotice(msg);
    setTimeout(() => setRouteNotice(null), 5500);
  }, []);

  // Service Worker Offline Persistence Queue
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

  // Initialize Firebase Google Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setGoogleUserEmail(user.email || 'Usuario conectado');
      },
      () => {
        setGoogleUserEmail(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Close active modal when pressing Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsBaseModalOpen(false);
        setIsBusinessProfileModalOpen(false);
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

  // Sync browser document title with customizable Business / App Name
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = `${businessProfile.appName} — Gestión de Césped (${baseLocation.city})`;
    }
  }, [businessProfile.appName, baseLocation.city]);

  // Smooth scroll-driven parallax variable update on Hero Command Strip
  useEffect(() => {
    let rafId: number | null = null;
    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        if (heroParallaxRef.current) {
          const y = Math.min(360, Math.max(0, window.scrollY));
          heroParallaxRef.current.style.setProperty('--scroll-y', String(y));
        }
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  // Persist operational state automatically to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          businessProfile,
          baseLocation,
          paymentProfile,
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
    businessProfile,
    baseLocation,
    paymentProfile,
    properties,
    scheduledJobs,
    invoices,
    expenses,
    equipment,
  ]);

  // Persist non-sensitive spreadsheet metadata
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

  // Apply and persist Accessibility Preferences (Font Scale & Sunlight High Contrast)
  useEffect(() => {
    try {
      localStorage.setItem(
        'pastopro_accessibility_prefs_v1',
        JSON.stringify(accessibilityPrefs)
      );
    } catch {
      // ignore
    }
    const root = document.documentElement;
    root.setAttribute('data-font-scale', accessibilityPrefs.fontScale);
    root.setAttribute(
      'data-high-contrast',
      String(accessibilityPrefs.highContrastOutdoor)
    );
  }, [accessibilityPrefs]);

  // Web Speech API Text-to-Speech (Lectura de Voz)
  const stopSpeakingOutLoud = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // ignore
    }
    setIsSpeaking(false);
  }, []);

  const speakTextOutLoud = useCallback(
    (text: string) => {
      setLastVoiceStatus(text);
      try {
        if (
          typeof window !== 'undefined' &&
          'speechSynthesis' in window &&
          typeof SpeechSynthesisUtterance !== 'undefined'
        ) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'es-AR';
          utterance.rate = accessibilityPrefs.speechRate || 1;
          utterance.onstart = () => setIsSpeaking(true);
          utterance.onend = () => setIsSpeaking(false);
          utterance.onerror = () => setIsSpeaking(false);
          setIsSpeaking(true);
          window.speechSynthesis.speak(utterance);
        }
      } catch {
        setIsSpeaking(false);
      }
    },
    [accessibilityPrefs.speechRate]
  );

  // Update Base Location & Recalculate all leg distances dynamically
  const handleUpdateBaseLocation = (newBase: BaseLocationConfig) => {
    setBaseLocation(newBase);
    setScheduledJobs((prev) =>
      recalculateJobsFromDynamicBase(newBase.coordinates, prev)
    );
    showBanner(
      `Punto de partida actualizado: ${newBase.city} (${newBase.address}). Distancias y tiempos de ruta recalculados.`
    );
  };

  // Capture Real-Time GPS Location if gardener is away from home
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
        // If geolocation permission is blocked in iframe/preview, open BaseLocationModal so user can pick their exact spot
        setIsBaseModalOpen(true);
        showBanner(
          'Permiso de GPS bloqueado en este navegador. Selecciona o escribe tu calle/ciudad de partida aquí.'
        );
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  // Shift activeDate by days
  const shiftActiveDate = (daysDelta: number) => {
    const base = new Date(`${activeDate}T12:00:00Z`);
    if (Number.isNaN(base.getTime())) return;
    base.setUTCDate(base.getUTCDate() + daysDelta);
    setActiveDate(base.toISOString().slice(0, 10));
  };

  // Google Sheets handlers
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

  const financialSummary = useMemo(
    () => calculateFinancialSummary(invoices, expenses),
    [invoices, expenses]
  );

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

  const handleStartJob = (jobId: string) => {
    const nowTime = new Date().toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });
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

  // Execute parsed Web Speech API voice command
  const handleExecuteVoiceCommand = (parsed: ParsedVoiceCommand) => {
    setLastVoiceStatus(parsed.spokenResponse);
    showBanner(`Comando de voz («${parsed.rawTranscript}»): ${parsed.spokenResponse}`);

    if (parsed.intent === 'READ_ROUTE') {
      const routeScript = buildDailyRouteSpeechText(
        activeDate,
        baseLocation.city,
        activeDateJobs,
        activeDayWeather
      );
      speakTextOutLoud(routeScript);
      return;
    }

    if (accessibilityPrefs.autoSpeakConfirmations) {
      speakTextOutLoud(parsed.spokenResponse);
    }

    switch (parsed.intent) {
      case 'ADD_CLIENT': {
        setEditingClient(null);
        setPrefillClientData(
          parsed.targetClientName
            ? { clientName: parsed.targetClientName }
            : null
        );
        setModalDefaultDate(activeDate);
        setModalDefaultTime('08:30');
        setIsClientModalOpen(true);
        break;
      }
      case 'COMPLETE_JOB': {
        if (parsed.targetJobId) {
          const found = activeDateJobs.find((j) => j.id === parsed.targetJobId);
          if (found) {
            setSelectedJobId(found.id);
            setJobToComplete(found);
          }
        }
        break;
      }
      case 'START_JOB': {
        if (parsed.targetJobId) {
          handleStartJob(parsed.targetJobId);
        }
        break;
      }
      case 'CHANGE_DATE': {
        if (parsed.targetDateStr) {
          setActiveDate(parsed.targetDateStr);
        }
        break;
      }
      case 'OPTIMIZE_ROUTE': {
        handleOptimizeRoute();
        break;
      }
      case 'RAIN_DELAY': {
        handleRainDelayForDate(activeDate);
        break;
      }
      case 'NAVIGATE_VIEW': {
        if (parsed.targetView === 'agenda') setActiveTab('agenda');
        else if (parsed.targetView === 'clientes') setActiveTab('clientes');
        else if (parsed.targetView === 'finanzas') setActiveTab('facturacion');
        else setActiveTab('ruta');
        break;
      }
      default:
        break;
    }
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
    photoUrl?: string
  ) => {
    const targetJob = scheduledJobs.find((j) => j.id === jobId);
    if (!targetJob) return;

    const adjustedJob: ScheduledJob = {
      ...targetJob,
      price: finalPrice,
      photoUrl: photoUrl || targetJob.photoUrl,
    };
    const sequenceNumber = invoices.length + 1;
    const { updatedJob, invoice } = completeJobAndCreateInvoice(
      adjustedJob,
      paidNow,
      paymentMethod,
      targetJob.scheduledDate,
      sequenceNumber,
      photoUrl
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

    const { queuedOffline } = recordAction(
      'COMPLETE_JOB',
      `Corte completado: ${targetJob.clientName}`,
      `${invoice.invoiceNumber} · $${finalPrice.toLocaleString('es-AR')} (${
        paidNow ? paymentMethod : 'Cuenta Cte.'
      })`
    );

    setJobToComplete(null);
    setSelectedInvoiceReceipt(invoice);
    showBanner(
      `Corte finalizado en ${targetJob.clientName}. Recibo ${invoice.invoiceNumber} emitido por $${finalPrice.toLocaleString('es-AR')}.${
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

  // Respaldo CSV / TSV / JSON
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

  const ringRadius = 22;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset =
    ringCircumference - (completionRatio / 100) * ringCircumference;

  return (
    <div className="min-h-screen bg-[#F6F7F3] text-slate-900 flex flex-col pb-20 md:pb-10">
      {/* Skip-to-Content Link para Accesibilidad por Teclado y Lectores de Pantalla */}
      <a
        href="#main-workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2.5 focus:rounded-xl focus:bg-[#0B2219] focus:text-white focus:font-bold focus:text-sm focus:shadow-lg"
      >
        Saltar al contenido principal
      </a>

      {/* Top Bar — Strict 3-Zone Header Contract: Brand Wordmark | 4 Clean Typographic Nav Links | 1 Primary CTA */}
      <header className="sticky top-0 z-30 h-14 md:h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark (Dynamic Editable Business / App Name) */}
        <a
          href="#ruta"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('ruta');
          }}
          title="Ir a Hoy / Ruta"
          className="font-display text-xl font-extrabold tracking-tight text-[#0B2219] whitespace-nowrap shrink-0"
        >
          {businessProfile.appName}
        </a>

        {/* Zone 2: 4 Primary Navigation Links (Clean Typography with Underline Indicator) */}
        <nav
          aria-label="Navegación principal"
          className="hidden md:flex items-center gap-7 text-sm font-semibold"
        >
          <button
            type="button"
            onClick={() => setActiveTab('ruta')}
            className={`min-h-[40px] py-2 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'ruta'
                ? 'border-emerald-700 text-slate-950 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Hoy / Ruta
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('agenda')}
            className={`min-h-[40px] py-2 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'agenda'
                ? 'border-emerald-700 text-slate-950 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Agenda
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('clientes')}
            className={`min-h-[40px] py-2 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'clientes'
                ? 'border-emerald-700 text-slate-950 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Clientes
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('facturacion')}
            className={`min-h-[40px] py-2 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              isMoreSectionActive
                ? 'border-emerald-700 text-slate-950 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Mi Plata
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action Button */}
        <button
          type="button"
          onClick={() => {
            setEditingClient(null);
            setPrefillClientData(null);
            setModalDefaultDate(activeDate);
            setModalDefaultTime('08:30');
            setIsClientModalOpen(true);
          }}
          className="min-h-[40px] px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-700 rounded-xl hover:bg-emerald-800 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 shadow-xs"
        >
          + Nuevo Corte
        </button>
      </header>

      {/* Main Content Container */}
      <main
        id="main-workspace"
        className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-6 py-4 sm:py-5 space-y-4"
      >
        {/* Barra de Comandos de Voz (Web Speech API), Lectura en Voz Alta y Accesibilidad */}
        <VoiceAccessibilityPanel
          activeDate={activeDate}
          todayReferenceStr={TODAY_REFERENCE}
          baseCity={baseLocation.city}
          activeDateJobs={activeDateJobs}
          activeDayWeather={activeDayWeather}
          preferences={accessibilityPrefs}
          isSpeaking={isSpeaking}
          lastVoiceStatus={lastVoiceStatus}
          onUpdatePreferences={setAccessibilityPrefs}
          onSpeakText={speakTextOutLoud}
          onStopSpeaking={stopSpeakingOutLoud}
          onExecuteVoiceCommand={handleExecuteVoiceCommand}
        />

        {routeNotice && (
          <div
            role="status"
            aria-live="polite"
            className="surface-command text-white text-xs sm:text-sm font-semibold px-4 py-3 rounded-2xl flex items-center justify-between gap-3"
          >
            <span>{routeNotice}</span>
            <button
              type="button"
              onClick={() => setRouteNotice(null)}
              className="text-emerald-300 hover:text-white text-xs font-bold underline shrink-0"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Sub-navegación de "Mi Plata" (Caja / Calculadora / Sheets / Emprendimiento) */}
        {isMoreSectionActive && (
          <section
            aria-label="Secciones de Mi Plata y Herramientas"
            className="surface-card rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('facturacion')}
                className={`min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  activeTab === 'facturacion'
                    ? 'bg-[#0B2219] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Mi Plata (Cobros y Gastos)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('cotizador')}
                className={`min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  activeTab === 'cotizador'
                    ? 'bg-[#0B2219] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Calculator className="w-4 h-4" />
                <span>Cotizador de Lotes</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('respaldo')}
                className={`min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  activeTab === 'respaldo'
                    ? 'bg-[#0B2219] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#0B2219] bg-emerald-50 border border-emerald-300 rounded-xl hover:bg-emerald-100 transition-colors"
              >
                <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>
                  Emprendimiento ({businessProfile.appName}) / Tarifas
                </span>
              </button>
              <button
                type="button"
                onClick={() => setIsOfflineAndAliasModalOpen(true)}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 transition-colors"
              >
                <Wifi className="w-3.5 h-3.5 text-emerald-700" />
                <span>Alias ({paymentProfile.alias}) / Modo Campo</span>
              </button>
              <PWAInstallButton />
            </div>
          </section>
        )}

        {/* TAB 1: HOY / MI RUTA (Centro Operativo de Jornada y Mapa GPS) */}
        {activeTab === 'ruta' && (
          <div className="space-y-4">
            {/* Deep Botanical Forest-Noir 3D Parallax Hero ("Horizon Field Deck") */}
            <section
              ref={heroParallaxRef}
              aria-label="Resumen operativo de la jornada"
              onMouseMove={(e) => {
                const el = heroParallaxRef.current;
                if (!el) return;
                const rect = el.getBoundingClientRect();
                const normX =
                  ((e.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
                const normY =
                  ((e.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
                el.style.setProperty('--px', normX.toFixed(3));
                el.style.setProperty('--py', normY.toFixed(3));
              }}
              onMouseLeave={() => {
                const el = heroParallaxRef.current;
                if (!el) return;
                el.style.setProperty('--px', '0');
                el.style.setProperty('--py', '0');
              }}
              className="parallax-hero-shell rounded-3xl p-4 sm:p-6 space-y-4 text-white"
            >
              {/* Capas Decorativas Parallax (Compositor-Only translate3d, aria-hidden) */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl select-none"
              >
                {/* Capa 1 (Profunda): Líneas Topográficas Agrícolas de la Pampa Húmeda */}
                <svg
                  className="parallax-layer-deep absolute -right-10 -top-12 w-[560px] h-[300px] text-emerald-300/[0.11]"
                  viewBox="0 0 520 280"
                  fill="none"
                >
                  <path
                    d="M-30 55C90 15 190 95 310 55C430 15 490 85 560 45"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M-30 105C100 65 200 145 320 105C440 65 500 135 560 95"
                    stroke="currentColor"
                    strokeWidth="1.75"
                  />
                  <path
                    d="M-30 155C110 115 210 195 330 155C450 115 510 185 560 145"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M-30 205C120 165 220 245 340 205C460 165 520 235 560 195"
                    stroke="currentColor"
                    strokeWidth="1.25"
                  />
                  <circle
                    cx="415"
                    cy="92"
                    r="64"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeDasharray="4 6"
                  />
                  <circle
                    cx="415"
                    cy="92"
                    r="108"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeDasharray="2 8"
                  />
                </svg>

                {/* Capa 2 (Media): Franjas de Corte de Césped Diagonal */}
                <div
                  className="parallax-layer-mid absolute -left-12 -bottom-12 w-80 h-48 opacity-40"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(125deg, rgba(52, 211, 153, 0.14) 0px, rgba(52, 211, 153, 0.14) 14px, transparent 14px, transparent 28px)',
                  }}
                />

                {/* Capa 3 (Frontal): Halo Solar Esmeralda Reactivo */}
                <div className="parallax-layer-glow absolute right-1/4 -top-20 w-72 h-72 rounded-full bg-emerald-400/20 blur-3xl" />
              </div>

              {/* Fila Superior: Contexto Operativo + KPIs con Anillo de Progreso SVG */}
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {/* Selector de Fecha Exacta */}
                    <div className="inline-flex items-center bg-white/10 backdrop-blur-md rounded-xl p-0.5 border border-white/15">
                      <button
                        type="button"
                        onClick={() => shiftActiveDate(-1)}
                        aria-label="Día anterior"
                        className="min-h-[34px] min-w-[32px] flex items-center justify-center rounded-lg text-emerald-100 hover:bg-white/10 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveDate(TODAY_REFERENCE)}
                        className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-extrabold transition-colors ${
                          activeDate === TODAY_REFERENCE
                            ? 'bg-emerald-500 text-slate-950'
                            : 'text-emerald-100 hover:bg-white/10'
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
                        className="bg-transparent text-xs font-mono font-bold text-white px-1.5 py-1 focus:outline-none [color-scheme:dark]"
                      />
                      <button
                        type="button"
                        onClick={() => shiftActiveDate(1)}
                        aria-label="Día siguiente"
                        className="min-h-[34px] min-w-[32px] flex items-center justify-center rounded-lg text-emerald-100 hover:bg-white/10 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Línea de configuración rápida en 1 clic */}
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-emerald-100/90">
                      <button
                        type="button"
                        onClick={() => setIsBaseModalOpen(true)}
                        className="inline-flex items-center gap-1 font-semibold text-white hover:text-emerald-300 transition-colors"
                      >
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Salida: {baseLocation.city}</span>
                        <span className="text-emerald-300 font-bold underline">
                          Cambiar
                        </span>
                      </button>

                      <span aria-hidden="true" className="text-white/30">
                        ·
                      </span>

                      <button
                        type="button"
                        onClick={() => setIsBusinessProfileModalOpen(true)}
                        className="inline-flex items-center gap-1 font-semibold text-white hover:text-emerald-300 transition-colors"
                      >
                        <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>App: {businessProfile.appName}</span>
                        <span className="text-emerald-300 font-bold underline">
                          Editar nombre
                        </span>
                      </button>

                      <span aria-hidden="true" className="text-white/30">
                        ·
                      </span>

                      <button
                        type="button"
                        onClick={() => setIsOfflineAndAliasModalOpen(true)}
                        className={`inline-flex items-center gap-1 font-semibold transition-colors ${
                          !isOnline || offlinePendingCount > 0
                            ? 'px-2 py-0.5 rounded-lg bg-amber-400 text-slate-950 font-bold'
                            : 'text-emerald-100 hover:text-emerald-300'
                        }`}
                      >
                        {!isOnline ? (
                          <WifiOff className="w-3.5 h-3.5" />
                        ) : (
                          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        <span className="underline decoration-white/30">
                          {!isOnline || offlinePendingCount > 0
                            ? `Sin señal (${offlinePendingCount} en cola)`
                            : `Alias: ${paymentProfile.alias}`}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Línea de Clima y Recorrido Estimado */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-100/90">
                    <span className="inline-flex items-center gap-1 font-bold text-white">
                      {activeDayWeather.condition === 'Alerta Lluvia' ? (
                        <CloudRain className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      ) : activeDayWeather.condition ===
                        'Parcialmente Nublado' ? (
                        <CloudSun className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      ) : (
                        <Sun className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      )}
                      <span>
                        {activeDayWeather.tempMax}°C ·{' '}
                        {activeDayWeather.condition}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-white/40">
                      ·
                    </span>
                    <span>{activeDayWeather.cuttingWindowLabel}</span>
                    <span aria-hidden="true" className="text-white/40">
                      ·
                    </span>
                    <span className="font-mono tabular-nums text-emerald-300 font-semibold">
                      {routeMetrics.totalDistanceKm} km (~
                      {Math.round((routeMetrics.totalWorkMinutes / 60) * 10) /
                        10}{' '}
                      hs de corte)
                    </span>
                  </div>
                </div>

                {/* Derecha: Anillo SVG de Avance + Facturación del Día + Sumar Corte */}
                <div className="flex flex-wrap items-center justify-between lg:justify-end gap-5 pt-3 lg:pt-0 border-t lg:border-t-0 border-white/10">
                  <div className="flex items-center gap-5">
                    {/* Indicador Circular SVG de Avance */}
                    <div className="flex items-center gap-3">
                      <div className="relative w-13 h-13 flex items-center justify-center shrink-0">
                        <svg
                          className="w-13 h-13 -rotate-90"
                          viewBox="0 0 52 52"
                          aria-hidden="true"
                        >
                          <circle
                            cx="26"
                            cy="26"
                            r={ringRadius}
                            fill="none"
                            stroke="rgba(255,255,255,0.14)"
                            strokeWidth="4.5"
                          />
                          <circle
                            cx="26"
                            cy="26"
                            r={ringRadius}
                            fill="none"
                            stroke="#34d399"
                            strokeWidth="4.5"
                            strokeLinecap="round"
                            strokeDasharray={ringCircumference}
                            strokeDashoffset={ringDashOffset}
                            className="transition-all duration-300"
                          />
                        </svg>
                        <span className="absolute font-mono text-[11px] font-extrabold text-emerald-300 tabular-nums">
                          {completionRatio}%
                        </span>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-emerald-200/80">
                          Avance del Día
                        </div>
                        <div className="text-xl font-extrabold font-mono text-white tabular-nums">
                          {routeMetrics.completedCount}/{activeDateJobs.length}{' '}
                          <span className="text-xs font-sans font-medium text-emerald-300">
                            cortes
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="h-9 w-px bg-white/15" />

                    <div>
                      <div className="text-[11px] font-semibold text-emerald-200/80">
                        Facturación del Día
                      </div>
                      <div className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-300 tabular-nums">
                        $
                        {routeMetrics.expectedRevenueToday.toLocaleString(
                          'es-AR'
                        )}
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
                    className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-extrabold bg-emerald-500 text-slate-950 rounded-xl hover:bg-emerald-400 active:scale-[0.98] transition-all whitespace-nowrap shadow-sm"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Sumar Corte a Hoy</span>
                  </button>
                </div>
              </div>

              {/* Cinta Horizontal Interactiva de 7 Días (1-Tap Day Switcher sin salir de la Ruta) */}
              <div
                role="group"
                aria-label="Cambiar rápido de día en la semana actual"
                className="relative z-10 flex sm:grid sm:grid-cols-7 gap-1.5 pt-2 border-t border-white/10 overflow-x-auto pb-0.5 sm:pb-0"
              >
                {activeWeekDays.map((dayCell) => {
                  const isSelectedDay = dayCell.dateStr === activeDate;
                  const jobsCount = dayCell.jobs.length;
                  return (
                    <button
                      key={dayCell.dateStr}
                      type="button"
                      onClick={() => setActiveDate(dayCell.dateStr)}
                      className={`min-h-[48px] min-w-[68px] sm:min-w-0 px-2 py-1.5 rounded-xl flex flex-col items-center justify-center shrink-0 transition-all ${
                        isSelectedDay
                          ? 'bg-white text-slate-950 font-extrabold shadow-sm'
                          : 'bg-white/[0.06] text-emerald-100 hover:bg-white/15'
                      }`}
                    >
                      <span className="text-[10px] font-semibold opacity-80 whitespace-nowrap">
                        {dayCell.weekdayShort} {dayCell.dayOfMonth}
                      </span>
                      <span
                        className={`text-[11px] font-mono tabular-nums mt-0.5 whitespace-nowrap ${
                          isSelectedDay
                            ? 'text-emerald-800 font-bold'
                            : jobsCount > 0
                            ? 'text-emerald-300 font-semibold'
                            : 'text-white/40'
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

            {/* Selector Móvil: Lista vs Mapa */}
            <div className="grid grid-cols-2 gap-2 lg:hidden surface-card p-1.5 rounded-2xl">
              <button
                type="button"
                onClick={() => setMobileRouteSubView('list')}
                className={`min-h-[44px] rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                  mobileRouteSubView === 'list'
                    ? 'bg-[#0B2219] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Lista de Cortes ({activeDateJobs.length})
              </button>
              <button
                type="button"
                onClick={() => setMobileRouteSubView('map')}
                className={`min-h-[44px] rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                  mobileRouteSubView === 'map'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Mapa GPS en Vivo
              </button>
            </div>

            {/* Área Principal: Columna Izquierda (Paradas) + Columna Derecha (Mapa GPS) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Columna Izquierda: Controles de Ruta y Tarjetas de Paradas */}
              <div
                className={`lg:col-span-6 space-y-3 ${
                  mobileRouteSubView === 'map' ? 'hidden lg:block' : 'block'
                }`}
              >
                {/* Barra Compacta Unificada de Filtro, Búsqueda y Optimización */}
                <div className="surface-card rounded-2xl p-3 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {/* Filtro por Estado de Parada */}
                    <div
                      role="group"
                      aria-label="Filtrar paradas del día"
                      className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80"
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
                          className={`min-h-[32px] px-2.5 py-1 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                            routeStatusFilter === tab.id
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Acciones Inteligentes de Recorrido */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleOptimizeRoute}
                        className="min-h-[34px] inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-slate-800 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors whitespace-nowrap"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>Ordenar por cercanía</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRainDelay}
                        title="Pasar los cortes pendientes para mañana por lluvia"
                        className="min-h-[34px] inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-sky-900 bg-sky-50 border border-sky-200 rounded-xl hover:bg-sky-100 transition-colors whitespace-nowrap"
                      >
                        <CloudRain className="w-3.5 h-3.5 text-sky-600" />
                        <span>Llovió (+1d)</span>
                      </button>
                    </div>
                  </div>

                  {/* Buscador Rápido dentro de la Ruta + Link a Ruta Completa Google Maps */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Buscar cliente o calle en la ruta..."
                        value={routeSearchQuery}
                        onChange={(e) => setRouteSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>

                    {activeDateJobs.length > 0 && (
                      <a
                        href={fullRouteGoogleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[34px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
                      >
                        <Navigation className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Ruta Completa GPS</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                {filteredActiveDateJobs.length === 0 ? (
                  <div className="surface-card rounded-2xl p-8 text-center space-y-3">
                    <p className="text-base font-extrabold text-slate-900">
                      {activeDateJobs.length === 0
                        ? `No tenés cortes programados para esta fecha (${activeDate})`
                        : 'No hay paradas que coincidan con ese filtro'}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                      {activeDateJobs.length === 0
                        ? 'Agrega un cliente a la hoja de ruta de este día o revisa la agenda semanal y mensual.'
                        : 'Cambia el filtro a "Todos" o limpia el buscador para ver todas las paradas.'}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
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
                            className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-700 rounded-xl hover:bg-emerald-800"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Programar Corte en este Día</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab('agenda')}
                            className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200"
                          >
                            <CalendarIcon className="w-4 h-4" />
                            <span>Ver Agenda Semanal / Mensual</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setRouteStatusFilter('todos');
                            setRouteSearchQuery('');
                          }}
                          className="min-h-[40px] px-4 py-2 text-xs font-bold text-slate-800 bg-slate-100 rounded-xl hover:bg-slate-200"
                        >
                          Mostrar todas las paradas ({activeDateJobs.length})
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
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
                      const endTime = computeEndTimeFromStart(
                        job.scheduledTime || '08:00',
                        job.estimatedMinutes
                      );

                      return (
                        <article
                          key={job.id}
                          onClick={() => setSelectedJobId(job.id)}
                          className={`surface-card card-interactive-lift rounded-2xl p-4 transition-all cursor-pointer border-2 ${
                            isSelected
                              ? 'stop-card-spotlight border-emerald-700 ring-2 ring-emerald-700/10'
                              : isInProgress
                              ? 'border-amber-500/90'
                              : 'border-slate-200/90 hover:border-slate-300'
                          } ${isCompleted ? 'opacity-85 bg-slate-50/90' : ''}`}
                        >
                          {/* Fila Superior Compacta: Orden, Horario/Barrio, Cliente, Dirección y Precio */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="flex flex-col items-center gap-1 shrink-0">
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono text-sm font-extrabold ${
                                    isCompleted
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : isInProgress
                                      ? 'bg-amber-500 text-slate-950'
                                      : 'bg-[#0B2219] text-white'
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
                                        className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-25 rounded"
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
                                        className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-25 rounded"
                                      >
                                        <ArrowDown className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                              </div>

                              <div className="min-w-0">
                                {/* Zero-Pill Static Metadata Line */}
                                <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono text-slate-600 tabular-nums">
                                  <span className="font-bold text-emerald-800">
                                    {job.scheduledTime || '08:00'}–{endTime} hs
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-sans font-semibold text-slate-700">
                                    {job.neighborhood}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span>a {job.legDistanceKm || 1.9} km</span>
                                  {isInProgress && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="font-sans font-bold text-amber-700">
                                        En curso
                                        {job.startedAt
                                          ? ` (${job.startedAt})`
                                          : ''}
                                      </span>
                                    </>
                                  )}
                                </div>

                                <h3 className="font-display text-base sm:text-lg font-bold text-slate-900 mt-0.5 leading-snug">
                                  {job.clientName}
                                </h3>

                                <p className="text-xs sm:text-sm font-medium text-slate-600 mt-0.5 flex items-center gap-1.5">
                                  <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                  <span>{job.address}</span>
                                  <span
                                    aria-hidden="true"
                                    className="text-slate-300"
                                  >
                                    ·
                                  </span>
                                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                                    {job.areaSqm} m²
                                  </span>
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-lg sm:text-xl font-extrabold font-mono text-emerald-800 tabular-nums">
                                ${job.price.toLocaleString('es-AR')}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500 mt-0.5 tabular-nums">
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
                                <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 mt-0.5">
                                  <Camera className="w-3 h-3" />
                                  <span>Evidencia</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Ficha Técnica Desplegable (Solo visible en la parada seleccionada para evitar saturación) */}
                          {isSelected && (
                            <div className="mt-3 pt-2.5 border-t border-emerald-900/10 text-xs sm:text-sm text-slate-700 space-y-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <span className="font-bold text-slate-900">
                                    Tareas:
                                  </span>{' '}
                                  {job.tasks.join(' + ')}
                                </div>
                                <span className="font-mono text-xs text-slate-500 tabular-nums">
                                  {job.propertyType} · {job.areaSqm} m² ·{' '}
                                  {job.frequency}
                                </span>
                              </div>
                              {job.accessNotes && (
                                <div className="text-xs text-slate-600">
                                  <span className="font-semibold text-slate-800">
                                    Acceso:
                                  </span>{' '}
                                  {job.accessNotes}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Botonera Operativa Táctil (Progressive Disclosure) */}
                          <div
                            className="mt-3 pt-2.5 border-t border-slate-100 space-y-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {!isCompleted ? (
                              <div
                                className={`grid gap-2 ${
                                  isSelected
                                    ? 'grid-cols-2 sm:grid-cols-4'
                                    : 'grid-cols-2 sm:grid-cols-3'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => setJobToComplete(job)}
                                  className="col-span-2 sm:col-span-1 min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-extrabold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors shadow-2xs"
                                >
                                  <Check className="w-4 h-4 stroke-[2.5]" />
                                  <span>Terminar y Cobrar</span>
                                </button>

                                {isSelected && (
                                  <button
                                    type="button"
                                    onClick={() => handleStartJob(job.id)}
                                    className={`min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-colors ${
                                      isInProgress
                                        ? 'bg-amber-500 text-slate-950 border-amber-500'
                                        : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                                    }`}
                                  >
                                    <Play className="w-3.5 h-3.5" />
                                    <span>
                                      {isInProgress
                                        ? 'En Curso'
                                        : 'Iniciar Corte'}
                                    </span>
                                  </button>
                                )}

                                <a
                                  href={navUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                                >
                                  <Navigation className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>Ir con GPS</span>
                                </a>

                                <a
                                  href={whatsappEtaUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-xl transition-colors"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>WhatsApp</span>
                                </a>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-800">
                                  <Check className="w-4 h-4" />
                                  <span>
                                    Corte finalizado ({job.completedAt || 'Hoy'}
                                    )
                                  </span>
                                </span>

                                <div className="flex items-center gap-2">
                                  {matchingInvoice && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSelectedInvoiceReceipt(
                                          matchingInvoice
                                        )
                                      }
                                      className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-700 rounded-xl hover:bg-emerald-800"
                                    >
                                      <FileText className="w-4 h-4" />
                                      <span>Comprobante / Imprimir</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUndoCompletedJob(job.id)
                                    }
                                    title="Volver a poner como pendiente"
                                    className="min-h-[40px] inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Reabrir</span>
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Fila Inferior: Completa en Parada Activa, Limpia en las demás */}
                            {isSelected ? (
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-500">
                                <div className="flex flex-wrap items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => setEditingScheduledJob(job)}
                                    className="inline-flex items-center gap-1 font-bold text-emerald-800 hover:text-emerald-950 hover:underline transition-colors"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
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
                                      className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-emerald-800 hover:underline"
                                    >
                                      <History className="w-3.5 h-3.5" />
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
                                      className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900 hover:underline"
                                    >
                                      <span>Ficha cliente</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      speakTextOutLoud(
                                        buildStopSpeechText(
                                          job,
                                          clientHistory.lastAmount
                                        )
                                      )
                                    }
                                    title="Escuchar detalles de esta parada en voz alta"
                                    className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:text-emerald-950 hover:underline"
                                  >
                                    <Volume2 className="w-3.5 h-3.5" />
                                    <span>Escuchar parada</span>
                                  </button>
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
                                    className="inline-flex items-center gap-1 font-semibold text-slate-400 hover:text-red-600"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Quitar</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2 pt-0.5 text-xs text-slate-500">
                                <button
                                  type="button"
                                  onClick={() => setEditingScheduledJob(job)}
                                  className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:underline"
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>Editar cita</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedJobId(job.id)}
                                  className="font-semibold text-slate-500 hover:text-slate-900 hover:underline"
                                >
                                  Detalles y más opciones ▾
                                </button>
                              </div>
                            )}
                          </div>
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
      </main>

      {/* Barra de Navegación Inferior para Celular (Compacta h-14 = 56px para cumplir <15% sticky surface cap) */}
      <nav
        aria-label="Navegación móvil"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-4 h-14 px-2 shadow-lg"
      >
        <button
          type="button"
          onClick={() => setActiveTab('ruta')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold rounded-xl my-1 ${
            activeTab === 'ruta'
              ? 'text-emerald-800 bg-emerald-50/90'
              : 'text-slate-500'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Hoy / Ruta</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('agenda')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold rounded-xl my-1 ${
            activeTab === 'agenda'
              ? 'text-emerald-800 bg-emerald-50/90'
              : 'text-slate-500'
          }`}
        >
          <CalendarIcon className="w-4 h-4" />
          <span>Agenda</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('clientes')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold rounded-xl my-1 ${
            activeTab === 'clientes'
              ? 'text-emerald-800 bg-emerald-50/90'
              : 'text-slate-500'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Clientes</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('facturacion')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold rounded-xl my-1 ${
            isMoreSectionActive
              ? 'text-emerald-800 bg-emerald-50/90'
              : 'text-slate-500'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Mi Plata</span>
        </button>
      </nav>

      {/* Modales Operativos */}
      <CompleteJobModal
        job={jobToComplete}
        invoices={invoices}
        paymentProfile={paymentProfile}
        isOnline={isOnline}
        onClose={() => setJobToComplete(null)}
        onConfirmComplete={handleConfirmCompleteJob}
      />

      <ClientHistoryModal
        client={historyClientModal}
        invoices={invoices}
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
