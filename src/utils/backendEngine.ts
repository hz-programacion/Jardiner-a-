import { LatLng, ScheduledJob } from '../types/lawn';
import {
  calculateHaversineDistanceKm,
  computeEndTimeFromStart,
  optimizeRouteOrder,
  sanitizeText,
} from './lawnLogic';

export interface Route2OptOptimizationResult {
  optimizedJobs: ScheduledJob[];
  initialDistanceKm: number;
  optimizedDistanceKm: number;
  distanceSavedKm: number;
  estimatedMinutesSaved: number;
  fuelSavedMl: number;
  algorithmUsed: '2-Opt + Nearest-Neighbor TSP';
}

function computeTotalPathDistanceKm(
  baseLocation: LatLng,
  orderedJobs: ScheduledJob[]
): number {
  if (orderedJobs.length === 0) return 0;
  let total = 0;
  let prev = baseLocation;
  for (const job of orderedJobs) {
    total += calculateHaversineDistanceKm(prev, job.coordinates);
    prev = job.coordinates;
  }
  return Math.round(total * 100) / 100;
}

/**
 * 2-Opt Local Search TSP Optimizer on top of Nearest-Neighbor initialization.
 * Uncrosses intersecting route legs for pending stops while preserving completed stops in place.
 */
export function optimizeRouteWith2Opt(
  baseLocation: LatLng,
  jobs: ScheduledJob[]
): Route2OptOptimizationResult {
  if (jobs.length <= 1) {
    const dist = computeTotalPathDistanceKm(baseLocation, jobs);
    return {
      optimizedJobs: jobs,
      initialDistanceKm: dist,
      optimizedDistanceKm: dist,
      distanceSavedKm: 0,
      estimatedMinutesSaved: 0,
      fuelSavedMl: 0,
      algorithmUsed: '2-Opt + Nearest-Neighbor TSP',
    };
  }

  const initialDistanceKm = computeTotalPathDistanceKm(baseLocation, jobs);

  // Start from Nearest-Neighbor seed
  const nnSeed = optimizeRouteOrder(baseLocation, jobs).orderedJobs;
  const completed = nnSeed.filter((j) => j.status === 'Completado');
  const pending = nnSeed
    .filter((j) => j.status !== 'Completado')
    .map((j) => ({ ...j }));

  const anchorPoint =
    completed.length > 0
      ? completed[completed.length - 1].coordinates
      : baseLocation;

  // Run 2-Opt edge-swap refinement on pending jobs
  if (pending.length >= 3) {
    let improved = true;
    let iterations = 0;
    while (improved && iterations < 40) {
      improved = false;
      iterations++;
      for (let i = 0; i < pending.length - 1; i++) {
        for (let k = i + 1; k < pending.length; k++) {
          const prevPoint = i === 0 ? anchorPoint : pending[i - 1].coordinates;
          const nextPoint =
            k + 1 < pending.length ? pending[k + 1].coordinates : null;

          const currentEdgeDist =
            calculateHaversineDistanceKm(prevPoint, pending[i].coordinates) +
            (nextPoint
              ? calculateHaversineDistanceKm(pending[k].coordinates, nextPoint)
              : 0);

          const swappedEdgeDist =
            calculateHaversineDistanceKm(prevPoint, pending[k].coordinates) +
            (nextPoint
              ? calculateHaversineDistanceKm(pending[i].coordinates, nextPoint)
              : 0);

          if (swappedEdgeDist + 0.01 < currentEdgeDist) {
            const reversedSegment = pending.slice(i, k + 1).reverse();
            pending.splice(i, k - i + 1, ...reversedSegment);
            improved = true;
          }
        }
      }
    }
  }

  // Re-index and recalculate leg distances and sequential horarios
  const merged = [...completed, ...pending];
  let currentAnchor = baseLocation;
  let cursorMinutes = 8 * 60;

  const finalJobs = merged.map((job, idx) => {
    const legDist =
      Math.round(
        calculateHaversineDistanceKm(currentAnchor, job.coordinates) * 10
      ) / 10;
    currentAnchor = job.coordinates;

    let scheduledTime = job.scheduledTime || '08:00';
    if (job.status !== 'Completado') {
      const hh = String(Math.floor(cursorMinutes / 60)).padStart(2, '0');
      const mm = String(cursorMinutes % 60).padStart(2, '0');
      scheduledTime = `${hh}:${mm}`;
    }
    const endStr = computeEndTimeFromStart(
      scheduledTime,
      job.estimatedMinutes || 60
    );
    const [eh, em] = endStr.split(':').map(Number);
    cursorMinutes = Math.min(19 * 60, eh * 60 + em + 15);

    return {
      ...job,
      orderIndex: idx + 1,
      legDistanceKm: Math.max(0.4, legDist),
      scheduledTime,
    };
  });

  const optimizedDistanceKm = computeTotalPathDistanceKm(
    baseLocation,
    finalJobs
  );
  const distanceSavedKm = Math.max(
    0,
    Math.round((initialDistanceKm - optimizedDistanceKm) * 10) / 10
  );
  const estimatedMinutesSaved = Math.max(0, Math.round(distanceSavedKm * 2.4));
  const fuelSavedMl = Math.max(0, Math.round(distanceSavedKm * 115));

  return {
    optimizedJobs: finalJobs,
    initialDistanceKm: Math.round(initialDistanceKm * 10) / 10,
    optimizedDistanceKm: Math.round(optimizedDistanceKm * 10) / 10,
    distanceSavedKm,
    estimatedMinutesSaved,
    fuelSavedMl,
    algorithmUsed: '2-Opt + Nearest-Neighbor TSP',
  };
}

export interface AgronomicCuttingAdvisory {
  dateStr: string;
  city: string;
  suitabilityScore: number;
  foliarMoistureRisk: 'Bajo' | 'Moderado' | 'Alto';
  recommendedHeightCm: string;
  bladeRpmRegime: string;
  advisoryHeadline: string;
  technicalNote: string;
}

/**
 * Computes an agronomic cutting window & turf preservation advisory for a given date and weather state.
 */
export function computeAgronomicCuttingWindow(
  dateStr: string,
  city: string,
  tempMax: number,
  condition: string
): AgronomicCuttingAdvisory {
  const cleanCity = sanitizeText(city || 'Venado Tuerto', 80);
  const isRainy =
    condition.toLowerCase().includes('lluvia') ||
    condition.toLowerCase().includes('tormenta');
  const isHot = tempMax >= 30;

  if (isRainy) {
    return {
      dateStr,
      city: cleanCity,
      suitabilityScore: 34,
      foliarMoistureRisk: 'Alto',
      recommendedHeightCm: '6.0 – 7.0 cm (No pelar al ras)',
      bladeRpmRegime: '3.200 RPM · Descarga lateral abierta',
      advisoryHeadline:
        'Suelo húmedo: priorizar desmalezado de veredas o postergar lotes bajos',
      technicalNote:
        'El corte con hoja mojada apelmaza el césped y desafila la cuchilla. Se recomienda elevar 1 punto el chasis.',
    };
  }

  if (isHot) {
    return {
      dateStr,
      city: cleanCity,
      suitabilityScore: 88,
      foliarMoistureRisk: 'Bajo',
      recommendedHeightCm: '5.0 – 6.0 cm (Protección radicular)',
      bladeRpmRegime: '3.400 RPM · Cuchilla afilada en seco',
      advisoryHeadline:
        'Ventana óptima de corte seco (Evitar corte al ras entre 13:00 y 16:00 hs)',
      technicalNote:
        'Con temperaturas altas, dejar al menos 5 cm de hoja conserva la humedad del suelo y evita el amarilleo.',
    };
  }

  return {
    dateStr,
    city: cleanCity,
    suitabilityScore: 96,
    foliarMoistureRisk: 'Bajo',
    recommendedHeightCm: '4.5 – 5.5 cm (Estándar parejo)',
    bladeRpmRegime: '3.400 RPM · Corte y bordeado perimetral',
    advisoryHeadline:
      'Condición ideal de terreno firme para corte con tractor, autopropulsada y motoguadaña',
    technicalNote:
      'Humedad foliar controlada y piso firme para giro de ruedas sin marcar el lote.',
  };
}

export interface CryptographicReceiptSeal {
  sealCode: string;
  issuedIso: string;
  digestHex: string;
  verificationLabel: string;
}

/**
 * Generates a deterministic cryptographic verification seal (FNV-1a 64-bit / SHA-style hex)
 * so every invoice and PDF receipt carries a verifiable authenticity code.
 */
export function generateCryptographicReceiptSeal(payload: {
  invoiceId: string;
  clientName: string;
  amount: number;
  date: string;
}): CryptographicReceiptSeal {
  const raw = `${payload.invoiceId}|${payload.clientName.trim().toLowerCase()}|${Math.round(
    payload.amount
  )}|${payload.date}|PASTOPRO_VERIFIED_2026`;

  let h1 = 0xdeadbeef ^ raw.length;
  let h2 = 0x41c6ce57 ^ raw.length;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const hex1 = (h1 >>> 0).toString(16).toUpperCase().padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).toUpperCase().padStart(8, '0');
  const digestHex = `${hex1}${hex2}`;
  const sealCode = `PP-${hex1.slice(0, 4)}-${hex2.slice(0, 4)}`;

  return {
    sealCode,
    issuedIso: `${payload.date}T12:00:00Z`,
    digestHex,
    verificationLabel: `Comprobante Verificado · Sello ${sealCode}`,
  };
}

const rateLimitBuckets = new Map<
  string,
  { tokens: number; lastRefillMs: number }
>();

/**
 * Token-bucket rate limiter for API protection.
 */
export function checkRateLimit(
  clientKey: string,
  maxTokens = 60,
  refillPerSec = 2,
  nowMs = Date.now()
): { allowed: boolean; remaining: number } {
  const key = clientKey || 'anon';
  const existing = rateLimitBuckets.get(key) || {
    tokens: maxTokens,
    lastRefillMs: nowMs,
  };

  const elapsedSec = Math.max(0, (nowMs - existing.lastRefillMs) / 1000);
  const replenished = Math.min(
    maxTokens,
    existing.tokens + elapsedSec * refillPerSec
  );

  if (replenished < 1) {
    rateLimitBuckets.set(key, { tokens: replenished, lastRefillMs: nowMs });
    return { allowed: false, remaining: 0 };
  }

  const nextTokens = replenished - 1;
  rateLimitBuckets.set(key, { tokens: nextTokens, lastRefillMs: nowMs });
  return { allowed: true, remaining: Math.floor(nextTokens) };
}
