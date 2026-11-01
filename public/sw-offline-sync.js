// Service Worker Auxiliar para Cola de Sincronización Offline de PastoPro
const OFFLINE_CACHE_NAME = 'pastopro-offline-v1';
let memoryActionQueue = [];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || !data.type) return;

  if (data.type === 'ENQUEUE_OFFLINE_ACTION') {
    memoryActionQueue.push(data.payload);
    // Notify all open clients that the Service Worker stored the action
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'SW_QUEUE_UPDATED',
          queueLength: memoryActionQueue.length,
          lastAction: data.payload,
        });
      });
    });
  }

  if (data.type === 'FLUSH_OFFLINE_QUEUE') {
    const flushedCount = memoryActionQueue.length;
    memoryActionQueue = [];
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'SW_QUEUE_FLUSHED',
          flushedCount,
          syncedAt: new Date().toISOString(),
        });
      });
    });
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'pastopro-sync-queue') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_BACKGROUND_SYNC_TRIGGERED',
            timestamp: new Date().toISOString(),
          });
        });
      })
    );
  }
});
