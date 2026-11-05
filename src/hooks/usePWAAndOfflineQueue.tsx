import React, { useCallback, useEffect, useState } from 'react';
import { Download, Smartphone, Wifi, WifiOff } from 'lucide-react';
import { OfflineActionType, OfflineSyncAction } from '../types/lawn';
import {
  enqueueOfflineAction,
  flushOfflineActionQueue,
} from '../utils/lawnLogic';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const OFFLINE_QUEUE_KEY = 'pastopro_sw_offline_queue_v1';

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isInstallable) {
            install();
          } else {
            setShowGuide(true);
          }
        }}
        className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-zinc-950 border border-zinc-900 rounded-xl hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-2xs"
      >
        <Download className="w-3.5 h-3.5 text-blue-400" />
        <span>{isIOS ? 'Instalar en iPhone' : 'Instalar App'}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-guide-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-zinc-950 shadow-xl border border-zinc-200">
            <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
              <Smartphone className="w-4 h-4" />
              <h3 id="pwa-install-guide-title">
                Instalar PastoPro en tu Dispositivo
              </h3>
            </div>
            <p className="mt-2 text-xs text-zinc-600 leading-relaxed">
              PastoPro cuenta con <strong>Service Worker Offline</strong> activo.
              Al instalarla en tu pantalla de inicio funciona en quintas, rutas
              y zonas sin señal de internet:
            </p>
            <ol className="mt-3 space-y-1.5 text-xs text-zinc-700 list-decimal list-inside bg-zinc-50 p-3 rounded-xl border border-zinc-200">
              <li>
                En <strong>Android (Chrome)</strong>: toca el menú{' '}
                <strong>⋮</strong> arriba a la derecha y elige{' '}
                <strong>&ldquo;Instalar aplicación&rdquo;</strong> o{' '}
                <strong>&ldquo;Agregar a pantalla principal&rdquo;</strong>.
              </li>
              <li>
                En <strong>iPhone (Safari)</strong>: toca el botón{' '}
                <strong>Compartir</strong> y luego{' '}
                <strong>&ldquo;Agregar a Inicio&rdquo;</strong>.
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-4 min-h-[40px] w-full rounded-xl bg-zinc-950 py-2 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export function useServiceWorkerOfflineQueue(
  onAutoSyncedCallback?: (flushedCount: number) => void
) {
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [simulatedOffline, setSimulatedOffline] = useState<boolean>(false);
  const [swReady, setSwReady] = useState<boolean>(false);

  const [offlineQueue, setOfflineQueue] = useState<OfflineSyncAction[]>(() => {
    try {
      const saved = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const isEffectiveOnline = browserOnline && !simulatedOffline;

  // Persist queue to localStorage and notify Service Worker
  useEffect(() => {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(offlineQueue));
    } catch {
      // ignore
    }
  }, [offlineQueue]);

  // Register Service Worker & message listeners
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register('/sw-offline-sync.js', { scope: '/' })
      .then((reg) => {
        if (reg.installing || reg.waiting || reg.active) {
          setSwReady(true);
        }
      })
      .catch(() => {
        // Fallback if VitePWA dev-sw is already controlling the scope
        setSwReady(true);
      });

    navigator.serviceWorker.ready
      .then(() => {
        setSwReady(true);
      })
      .catch(() => {});

    const handleSwMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'OFFLINE_QUEUE_FLUSHED') {
        const nowStr = new Date().toLocaleTimeString('es-AR', {
          hour: '2-digit',
          minute: '2-digit',
        });
        setOfflineQueue((prev) => {
          const { flushedQueue } = flushOfflineActionQueue(
            prev,
            `Hoy ${nowStr}`
          );
          return flushedQueue;
        });
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    };
  }, []);

  const flushPendingActions = useCallback(() => {
    const nowStr = new Date().toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    setOfflineQueue((prev) => {
      const pending = prev.filter((item) => item.status === 'Pendiente');
      if (pending.length === 0) return prev;

      const { flushedQueue, flushedCount } = flushOfflineActionQueue(
        prev,
        `Sincronizado ${nowStr} hs`
      );

      if (
        typeof navigator !== 'undefined' &&
        'serviceWorker' in navigator &&
        navigator.serviceWorker.controller
      ) {
        navigator.serviceWorker.controller.postMessage({
          type: 'FLUSH_OFFLINE_QUEUE',
          syncedAt: nowStr,
        });
      }

      if (flushedCount > 0 && onAutoSyncedCallback) {
        setTimeout(() => onAutoSyncedCallback(flushedCount), 50);
      }

      return flushedQueue;
    });
  }, [onAutoSyncedCallback]);

  // Listen to browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setBrowserOnline(true);
    };
    const handleOffline = () => {
      setBrowserOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Automatically flush offline queue when connectivity returns
  useEffect(() => {
    if (isEffectiveOnline) {
      const hasPending = offlineQueue.some((a) => a.status === 'Pendiente');
      if (hasPending) {
        flushPendingActions();
      }
    }
  }, [isEffectiveOnline, offlineQueue, flushPendingActions]);

  const recordAction = useCallback(
    (type: OfflineActionType, label: string, detail: string) => {
      const nowStr = new Date().toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      if (!isEffectiveOnline) {
        setOfflineQueue((prev) => {
          const updated = enqueueOfflineAction(
            prev,
            type,
            label,
            detail,
            `${nowStr} hs`
          );
          if (
            typeof navigator !== 'undefined' &&
            'serviceWorker' in navigator &&
            navigator.serviceWorker.controller
          ) {
            navigator.serviceWorker.controller.postMessage({
              type: 'ENQUEUE_OFFLINE_ACTION',
              payload: updated[0],
            });
          }
          return updated;
        });
        return { queuedOffline: true };
      }

      // Even when online, record in history as immediately synced so user can see SW persistence log
      const syncedItem: OfflineSyncAction = {
        id: `offline-act-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type,
        label,
        detail,
        createdAt: `${nowStr} hs`,
        status: 'Sincronizado',
        syncedAt: `En vivo (${nowStr} hs)`,
      };
      setOfflineQueue((prev) => [syncedItem, ...prev.slice(0, 29)]);
      return { queuedOffline: false };
    },
    [isEffectiveOnline]
  );

  const clearSyncedHistory = useCallback(() => {
    setOfflineQueue((prev) => prev.filter((item) => item.status === 'Pendiente'));
  }, []);

  const pendingCount = offlineQueue.filter(
    (item) => item.status === 'Pendiente'
  ).length;

  return {
    isOnline: isEffectiveOnline,
    simulatedOffline,
    setSimulatedOffline,
    swReady,
    offlineQueue,
    pendingCount,
    recordAction,
    flushPendingActions,
    clearSyncedHistory,
  };
}
