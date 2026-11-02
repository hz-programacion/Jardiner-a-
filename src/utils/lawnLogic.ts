import {
  BackupPayload,
  CalendarDayCell,
  ClientProperty,
  ClientPriceHistorySummary,
  ClientRankingRow,
  CutFrequency,
  EquipmentItem,
  GrassCondition,
  InvoiceRecord,
  LatLng,
  LocalityBreakdownRow,
  MonthlyBreakdownRow,
  OfflineActionType,
  OfflineSyncAction,
  OperationalExpense,
  ParsedVoiceCommand,
  PaymentMethod,
  PeriodFilter,
  PropertyType,
  ScheduledJob,
  StreetSuggestionItem,
  WeatherForecastDay,
} from '../types/lawn';
import { STREET_CATALOG } from '../data/seedData';

/**
 * Calculates Haversine distance in kilometers between two LatLng coordinates.
 */
export function calculateHaversineDistanceKm(a: LatLng, b: LatLng): number {
  const R = 6371; // Earth radius in km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  // Multiply by 1.28 road factor to approximate urban/rural driving distance
  return Math.round(R * c * 1.28 * 100) / 100;
}

/**
 * Computes end time HH:mm from a start time HH:mm and duration in minutes.
 */
export function computeEndTimeFromStart(
  startTime: string,
  durationMinutes: number
): string {
  const [hh, mm] = (startTime || '08:00').split(':').map(Number);
  const totalMin =
    (Number.isFinite(hh) ? hh : 8) * 60 +
    (Number.isFinite(mm) ? mm : 0) +
    Math.max(15, durationMinutes || 45);
  const endH = Math.floor((totalMin % 1440) / 60);
  const endM = totalMin % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

/**
 * Recalculates leg distances and travel minutes from a dynamic starting base location
 * while preserving the current order of jobs.
 */
export function recalculateJobsFromDynamicBase(
  baseLocation: LatLng,
  jobs: ScheduledJob[]
): ScheduledJob[] {
  let prevCoord = baseLocation;
  return jobs.map((job, idx) => {
    const legKm = calculateHaversineDistanceKm(prevCoord, job.coordinates);
    const legMin = Math.max(4, Math.round((legKm / 34) * 60));
    prevCoord = job.coordinates;
    return {
      ...job,
      orderIndex: idx + 1,
      legDistanceKm: Math.round(legKm * 10) / 10,
      legDurationMin: legMin,
    };
  });
}

/**
 * Optimizes the route order of scheduled jobs starting from a dynamic base location
 * using Nearest-Neighbor initialization followed by 2-opt local search refinement.
 * Also assigns sequential scheduledTime slots starting from 08:00 if reordered.
 */
export function optimizeRouteOrder(
  baseLocation: LatLng,
  jobs: ScheduledJob[]
): {
  orderedJobs: ScheduledJob[];
  totalDistanceKm: number;
  totalDriveMinutes: number;
  totalWorkMinutes: number;
} {
  if (jobs.length === 0) {
    return {
      orderedJobs: [],
      totalDistanceKm: 0,
      totalDriveMinutes: 0,
      totalWorkMinutes: 0,
    };
  }

  const completed = jobs.filter((j) => j.status === 'Completado');
  const remaining = jobs.filter((j) => j.status !== 'Completado');

  const unvisited = [...remaining];
  const orderedPending: ScheduledJob[] = [];
  let currentPos: LatLng =
    completed.length > 0
      ? completed[completed.length - 1].coordinates
      : baseLocation;

  while (unvisited.length > 0) {
    let bestIdx = 0;
    let bestDist = calculateHaversineDistanceKm(
      currentPos,
      unvisited[0].coordinates
    );

    for (let i = 1; i < unvisited.length; i++) {
      const d = calculateHaversineDistanceKm(
        currentPos,
        unvisited[i].coordinates
      );
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    const nextJob = unvisited.splice(bestIdx, 1)[0];
    orderedPending.push(nextJob);
    currentPos = nextJob.coordinates;
  }

  if (orderedPending.length >= 3) {
    const startOrigin =
      completed.length > 0
        ? completed[completed.length - 1].coordinates
        : baseLocation;

    const routeCost = (seq: ScheduledJob[]): number => {
      let cost = calculateHaversineDistanceKm(startOrigin, seq[0].coordinates);
      for (let i = 0; i < seq.length - 1; i++) {
        cost += calculateHaversineDistanceKm(
          seq[i].coordinates,
          seq[i + 1].coordinates
        );
      }
      return cost;
    };

    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < orderedPending.length - 1; i++) {
        for (let k = i + 1; k < orderedPending.length; k++) {
          const candidate = [
            ...orderedPending.slice(0, i),
            ...orderedPending.slice(i, k + 1).reverse(),
            ...orderedPending.slice(k + 1),
          ];
          if (routeCost(candidate) + 0.01 < routeCost(orderedPending)) {
            orderedPending.splice(0, orderedPending.length, ...candidate);
            improved = true;
          }
        }
      }
    }
  }

  const combined = [...completed, ...orderedPending];
  let totalDistanceKm = 0;
  let totalDriveMinutes = 0;
  let totalWorkMinutes = 0;
  let prevCoord = baseLocation;

  const finalJobs = combined.map((job, idx) => {
    const legKm = calculateHaversineDistanceKm(prevCoord, job.coordinates);
    const legMin = Math.max(4, Math.round((legKm / 34) * 60));
    totalDistanceKm += legKm;
    totalDriveMinutes += legMin;
    totalWorkMinutes += job.estimatedMinutes;
    prevCoord = job.coordinates;

    return {
      ...job,
      scheduledTime: job.scheduledTime || '08:30',
      orderIndex: idx + 1,
      legDistanceKm: Math.round(legKm * 10) / 10,
      legDurationMin: legMin,
    };
  });

  return {
    orderedJobs: finalJobs,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    totalDriveMinutes,
    totalWorkMinutes,
  };
}

const WEEKDAY_SHORT_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/**
 * Builds the 7-day week (Monday to Sunday) containing `selectedDateStr`.
 */
export function buildWeekDaysForDate(
  selectedDateStr: string,
  allJobs: ScheduledJob[],
  todayDateStr = '2026-11-01'
): CalendarDayCell[] {
  const [yr, mo, dy] = selectedDateStr.split('-').map(Number);
  const selectedUtc = new Date(
    Date.UTC(yr || 2026, (mo || 11) - 1, dy || 1)
  );
  // Convert Sunday (0) -> 6, Monday (1) -> 0
  const dayOfWeekMonday0 = (selectedUtc.getUTCDay() + 6) % 7;

  const mondayUtc = new Date(selectedUtc.getTime());
  mondayUtc.setUTCDate(selectedUtc.getUTCDate() - dayOfWeekMonday0);

  const cells: CalendarDayCell[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mondayUtc.getTime());
    d.setUTCDate(mondayUtc.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayJobs = allJobs
      .filter((j) => j.scheduledDate === dateStr)
      .sort((a, b) =>
        (a.scheduledTime || '08:00').localeCompare(b.scheduledTime || '08:00')
      );

    cells.push({
      dateStr,
      dayOfMonth: d.getUTCDate(),
      weekdayShort: WEEKDAY_SHORT_ES[d.getUTCDay()],
      isCurrentMonth: d.getUTCMonth() === selectedUtc.getUTCMonth(),
      isSelected: dateStr === selectedDateStr,
      isToday: dateStr === todayDateStr,
      jobs: dayJobs,
      totalRevenue: dayJobs.reduce((acc, j) => acc + (j.price || 0), 0),
      totalMinutes: dayJobs.reduce(
        (acc, j) => acc + (j.estimatedMinutes || 0),
        0
      ),
    });
  }

  return cells;
}

/**
 * Builds a complete Monday-anchored monthly calendar grid (35 or 42 cells)
 * for `year` and `monthIndex0` (0 = Jan, 10 = Nov).
 */
export function buildMonthCalendarGrid(
  year: number,
  monthIndex0: number,
  allJobs: ScheduledJob[],
  selectedDateStr: string,
  todayDateStr = '2026-11-01'
): CalendarDayCell[] {
  const firstOfMonth = new Date(Date.UTC(year, monthIndex0, 1));
  const startOffset = (firstOfMonth.getUTCDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
  const totalCells = startOffset + daysInMonth > 35 ? 42 : 35;

  const startUtc = new Date(firstOfMonth.getTime());
  startUtc.setUTCDate(1 - startOffset);

  const cells: CalendarDayCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(startUtc.getTime());
    d.setUTCDate(startUtc.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayJobs = allJobs
      .filter((j) => j.scheduledDate === dateStr)
      .sort((a, b) =>
        (a.scheduledTime || '08:00').localeCompare(b.scheduledTime || '08:00')
      );

    cells.push({
      dateStr,
      dayOfMonth: d.getUTCDate(),
      weekdayShort: WEEKDAY_SHORT_ES[d.getUTCDay()],
      isCurrentMonth: d.getUTCMonth() === monthIndex0,
      isSelected: dateStr === selectedDateStr,
      isToday: dateStr === todayDateStr,
      jobs: dayJobs,
      totalRevenue: dayJobs.reduce((acc, j) => acc + (j.price || 0), 0),
      totalMinutes: dayJobs.reduce(
        (acc, j) => acc + (j.estimatedMinutes || 0),
        0
      ),
    });
  }

  return cells;
}

/**
 * Calculates a suggested service price, estimated work time, and estimated fuel usage
 * based on m², property type, frequency, grass condition, and bagging.
 */
export function calculateSuggestedPrice(
  areaSqm: number,
  propertyType: PropertyType,
  frequency: CutFrequency,
  extraTasksCount = 0,
  grassCondition: GrassCondition = 'Regular',
  includesBagging = true,
  customRates?: {
    baseRatePerSqm?: number;
    minServicePrice?: number;
    tallGrassSurchargePct?: number;
    baggingSurchargePct?: number;
  }
): {
  suggestedPrice: number;
  estimatedMinutes: number;
  estimatedFuelLiters: number;
} {
  const cleanArea = Math.max(20, Number.isFinite(areaSqm) ? areaSqm : 100);
  const customCasaRate =
    customRates?.baseRatePerSqm && customRates.baseRatePerSqm > 0
      ? customRates.baseRatePerSqm
      : 65;
  const rateScale = customCasaRate / 65;

  const ratePerSqm: Record<PropertyType, number> = {
    Casa: customCasaRate,
    Terreno: Math.round(80 * rateScale),
    Quinta: Math.round(55 * rateScale),
  };

  const customMinCasa =
    customRates?.minServicePrice && customRates.minServicePrice > 0
      ? customRates.minServicePrice
      : 18000;
  const minScale = customMinCasa / 18000;

  const baseMinimum: Record<PropertyType, number> = {
    Casa: customMinCasa,
    Terreno: Math.round((25000 * minScale) / 500) * 500,
    Quinta: Math.round((32000 * minScale) / 500) * 500,
  };

  let rawPrice = Math.max(
    baseMinimum[propertyType],
    cleanArea * ratePerSqm[propertyType]
  );

  const freqMultiplier: Record<CutFrequency, number> = {
    Semanal: 0.9,
    Quincenal: 1.0,
    Mensual: 1.25,
    'Única vez': 1.35,
  };

  const tallPct =
    customRates?.tallGrassSurchargePct !== undefined &&
    customRates.tallGrassSurchargePct >= 0
      ? customRates.tallGrassSurchargePct / 100
      : 0.3;

  const conditionMultiplier: Record<GrassCondition, number> = {
    Regular: 1.0,
    Alto: 1 + tallPct,
    'Maleza Pesada': 1 + Math.max(0.5, tallPct * 2),
  };

  const baggingAddon = includesBagging
    ? customRates?.baggingSurchargePct !== undefined &&
      customRates.baggingSurchargePct >= 0
      ? Math.round(rawPrice * (customRates.baggingSurchargePct / 100))
      : Math.round(cleanArea * 12)
    : 0;

  rawPrice =
    rawPrice * freqMultiplier[frequency] * conditionMultiplier[grassCondition] +
    extraTasksCount * 4500 +
    baggingAddon;

  const suggestedPrice = Math.round(rawPrice / 500) * 500;

  const baseSqmPerMin =
    propertyType === 'Terreno' ? 6.5 : propertyType === 'Quinta' ? 9.5 : 7.5;
  const speedPenalty =
    grassCondition === 'Maleza Pesada'
      ? 0.6
      : grassCondition === 'Alto'
      ? 0.8
      : 1.0;

  const estimatedMinutes = Math.max(
    25,
    Math.round(
      (cleanArea / (baseSqmPerMin * speedPenalty) +
        15 +
        extraTasksCount * 10 +
        (includesBagging ? 15 : 0)) /
        5
    ) * 5
  );

  const estimatedFuelLiters =
    Math.round(((estimatedMinutes / 60) * 0.95) * 10) / 10;

  return { suggestedPrice, estimatedMinutes, estimatedFuelLiters };
}

/**
 * Computes the next scheduled cut date (YYYY-MM-DD) from a completion date and frequency.
 */
export function computeNextCutDate(
  fromDateStr: string,
  frequency: CutFrequency
): string {
  const parts = fromDateStr.split('-').map(Number);
  const date = new Date(
    Date.UTC(parts[0] || 2026, (parts[1] || 1) - 1, parts[2] || 1)
  );

  const daysMap: Record<CutFrequency, number> = {
    Semanal: 7,
    Quincenal: 14,
    Mensual: 30,
    'Única vez': 0,
  };

  const days = daysMap[frequency];
  if (days === 0) {
    return 'Sin reprogramar';
  }

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Transitions a job to Completado and creates an automatic InvoiceRecord.
 */
export function completeJobAndCreateInvoice(
  job: ScheduledJob,
  paidNow: boolean,
  paymentMethod: PaymentMethod,
  completionDate: string,
  sequenceNumber: number,
  photoUrl?: string
): {
  updatedJob: ScheduledJob;
  invoice: InvoiceRecord;
} {
  const nextScheduledDate = computeNextCutDate(completionDate, job.frequency);
  const invoiceId = `inv-${job.id}-${sequenceNumber}`;
  const paddedSeq = String(sequenceNumber).padStart(4, '0');
  const finalPhoto = photoUrl || job.photoUrl;

  const invoice: InvoiceRecord = {
    id: invoiceId,
    invoiceNumber: `REC-2026-${paddedSeq}`,
    jobId: job.id,
    propertyId: job.propertyId,
    clientName: job.clientName,
    phone: job.phone,
    address: job.address,
    neighborhood: job.neighborhood,
    propertyType: job.propertyType,
    areaSqm: job.areaSqm,
    date: completionDate,
    amount: job.price,
    tasksCompleted: [...job.tasks],
    status: paidNow ? 'Pagado' : 'Pendiente',
    paymentMethod: paidNow ? paymentMethod : undefined,
    paidAt: paidNow ? completionDate : undefined,
    nextScheduledDate,
    photoUrl: finalPhoto,
  };

  const updatedJob: ScheduledJob = {
    ...job,
    status: 'Completado',
    completedAt: 'Recién completado',
    invoiceId,
    photoUrl: finalPhoto,
  };

  return { updatedJob, invoice };
}

/**
 * Shifts all pending jobs on `targetDate` (or all pending jobs if `targetDate` omitted)
 * forward by `daysToAdd` days (e.g. rain delay).
 */
export function reschedulePendingJobsForRain(
  jobs: ScheduledJob[],
  daysToAdd: number,
  targetDate?: string
): ScheduledJob[] {
  return jobs.map((job) => {
    if (job.status === 'Completado') return job;
    if (targetDate && job.scheduledDate !== targetDate) return job;
    const parts = job.scheduledDate.split('-').map(Number);
    const d = new Date(
      Date.UTC(parts[0] || 2026, (parts[1] || 1) - 1, parts[2] || 1)
    );
    d.setUTCDate(d.getUTCDate() + daysToAdd);
    return {
      ...job,
      scheduledDate: d.toISOString().slice(0, 10),
    };
  });
}

/**
 * Computes financial metrics across invoices and operational expenses.
 */
export function calculateFinancialSummary(
  invoices: InvoiceRecord[],
  expenses: OperationalExpense[]
): {
  totalFacturado: number;
  totalCobrado: number;
  porCobrar: number;
  totalGastos: number;
  gananciaNeta: number;
  margenPorcentaje: number;
  totalSqmCut: number;
  averageTicket: number;
} {
  const totalFacturado = invoices.reduce((acc, inv) => acc + inv.amount, 0);
  const totalCobrado = invoices
    .filter((inv) => inv.status === 'Pagado')
    .reduce((acc, inv) => acc + inv.amount, 0);
  const porCobrar = invoices
    .filter((inv) => inv.status === 'Pendiente')
    .reduce((acc, inv) => acc + inv.amount, 0);
  const totalGastos = expenses.reduce((acc, exp) => acc + exp.amount, 0);
  const gananciaNeta = totalCobrado - totalGastos;
  const margenPorcentaje =
    totalCobrado > 0 ? Math.round((gananciaNeta / totalCobrado) * 100) : 0;
  const totalSqmCut = invoices.reduce(
    (acc, inv) => acc + (inv.areaSqm || 0),
    0
  );
  const averageTicket =
    invoices.length > 0 ? Math.round(totalFacturado / invoices.length) : 0;

  return {
    totalFacturado,
    totalCobrado,
    porCobrar,
    totalGastos,
    gananciaNeta,
    margenPorcentaje,
    totalSqmCut,
    averageTicket,
  };
}

/**
 * Retrieves the complete historical billing and price evolution for a specific client/property.
 */
export function getClientPriceHistory(
  propertyId: string,
  clientName: string,
  invoices: InvoiceRecord[]
): ClientPriceHistorySummary {
  const normalizedName = clientName.trim().toLowerCase();
  const records = invoices
    .filter(
      (inv) =>
        inv.propertyId === propertyId ||
        inv.clientName.trim().toLowerCase() === normalizedName
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  const lastRecord = records[0] || null;
  const prevRecord = records[1] || null;

  let variationPercent: number | null = null;
  if (lastRecord && prevRecord && prevRecord.amount > 0) {
    variationPercent = Math.round(
      ((lastRecord.amount - prevRecord.amount) / prevRecord.amount) * 100
    );
  }

  const totalBilled = records.reduce((acc, r) => acc + r.amount, 0);
  const pendingBalance = records
    .filter((r) => r.status === 'Pendiente')
    .reduce((acc, r) => acc + r.amount, 0);

  return {
    records,
    lastAmount: lastRecord ? lastRecord.amount : null,
    lastDate: lastRecord ? lastRecord.date : null,
    previousAmount: prevRecord ? prevRecord.amount : null,
    previousDate: prevRecord ? prevRecord.date : null,
    variationPercent,
    totalCutsCount: records.length,
    totalBilled,
    pendingBalance,
  };
}

/**
 * Filters invoices and expenses according to the selected PeriodFilter.
 */
export function filterRecordsByPeriod(
  invoices: InvoiceRecord[],
  expenses: OperationalExpense[],
  period: PeriodFilter,
  referenceDateStr = '2026-11-01',
  customRange?: { from: string; to: string }
): {
  filteredInvoices: InvoiceRecord[];
  filteredExpenses: OperationalExpense[];
  periodLabel: string;
} {
  const refParts = referenceDateStr.split('-').map(Number);
  const refDate = new Date(
    Date.UTC(refParts[0] || 2026, (refParts[1] || 11) - 1, refParts[2] || 1)
  );

  const subtractDays = (days: number): string => {
    const d = new Date(refDate.getTime());
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
  };

  let startDate = '2000-01-01';
  let endDate = '2099-12-31';
  let periodLabel = 'Histórico Completo';

  if (period === 'hoy') {
    startDate = referenceDateStr;
    endDate = referenceDateStr;
    periodLabel = `Hoy (${referenceDateStr})`;
  } else if (period === 'semana') {
    startDate = subtractDays(7);
    endDate = referenceDateStr;
    periodLabel = `Últimos 7 Días (${startDate} a ${endDate})`;
  } else if (period === 'mes_actual') {
    startDate = subtractDays(30);
    endDate = referenceDateStr;
    periodLabel = `Últimos 30 Días (${startDate} a ${endDate})`;
  } else if (period === 'mes_anterior') {
    startDate = '2026-09-01';
    endDate = '2026-09-30';
    periodLabel = 'Septiembre 2026 (Mes Anterior)';
  } else if (period === 'trimestre') {
    startDate = subtractDays(90);
    endDate = referenceDateStr;
    periodLabel = `Últimos 3 Meses (${startDate} a ${endDate})`;
  } else if (period === 'personalizado' && customRange) {
    startDate = customRange.from || '2000-01-01';
    endDate = customRange.to || '2099-12-31';
    periodLabel = `Personalizado (${startDate} a ${endDate})`;
  }

  const filteredInvoices = invoices.filter(
    (inv) => inv.date >= startDate && inv.date <= endDate
  );
  const filteredExpenses = expenses.filter(
    (exp) => exp.date >= startDate && exp.date <= endDate
  );

  return {
    filteredInvoices,
    filteredExpenses,
    periodLabel,
  };
}

const MONTH_NAMES: Record<string, string> = {
  '01': 'Enero',
  '02': 'Febrero',
  '03': 'Marzo',
  '04': 'Abril',
  '05': 'Mayo',
  '06': 'Junio',
  '07': 'Julio',
  '08': 'Agosto',
  '09': 'Septiembre',
  '10': 'Octubre',
  '11': 'Noviembre',
  '12': 'Diciembre',
};

/**
 * Computes monthly evolution, locality breakdown, and top clients.
 */
export function computeDetailedAnalytics(
  invoices: InvoiceRecord[],
  expenses: OperationalExpense[],
  properties: ClientProperty[]
): {
  monthlyBreakdown: MonthlyBreakdownRow[];
  localityBreakdown: LocalityBreakdownRow[];
  clientRanking: ClientRankingRow[];
  expensesByCategory: { category: string; amount: number; percentage: number }[];
} {
  const monthKeys = new Set<string>();
  invoices.forEach((inv) => monthKeys.add(inv.date.slice(0, 7)));
  expenses.forEach((exp) => monthKeys.add(exp.date.slice(0, 7)));

  const sortedMonths = Array.from(monthKeys).sort((a, b) => b.localeCompare(a));

  const monthlyBreakdown: MonthlyBreakdownRow[] = sortedMonths.map((mKey) => {
    const [yr, mo] = mKey.split('-');
    const mInvoices = invoices.filter((i) => i.date.startsWith(mKey));
    const mExpenses = expenses.filter((e) => e.date.startsWith(mKey));

    const facturado = mInvoices.reduce((acc, i) => acc + i.amount, 0);
    const cobrado = mInvoices
      .filter((i) => i.status === 'Pagado')
      .reduce((acc, i) => acc + i.amount, 0);
    const gastos = mExpenses.reduce((acc, e) => acc + e.amount, 0);
    const gananciaNeta = cobrado - gastos;
    const totalSqm = mInvoices.reduce((acc, i) => acc + (i.areaSqm || 0), 0);

    return {
      monthKey: mKey,
      monthLabel: `${MONTH_NAMES[mo] || mo} ${yr}`,
      facturado,
      cobrado,
      gastos,
      gananciaNeta,
      cutsCount: mInvoices.length,
      totalSqm,
    };
  });

  const localityMap = new Map<
    string,
    { cutsCount: number; totalBilled: number; totalSqm: number }
  >();
  for (const inv of invoices) {
    const prop = properties.find((p) => p.id === inv.propertyId);
    const loc =
      prop?.neighborhood || inv.neighborhood || 'Venado Tuerto - Centro';
    const current = localityMap.get(loc) || {
      cutsCount: 0,
      totalBilled: 0,
      totalSqm: 0,
    };
    current.cutsCount += 1;
    current.totalBilled += inv.amount;
    current.totalSqm += inv.areaSqm || 0;
    localityMap.set(loc, current);
  }

  const localityBreakdown: LocalityBreakdownRow[] = Array.from(
    localityMap.entries()
  )
    .map(([locality, stats]) => ({
      locality,
      ...stats,
    }))
    .sort((a, b) => b.totalBilled - a.totalBilled);

  const clientMap = new Map<string, ClientRankingRow>();
  for (const inv of invoices) {
    const prop = properties.find((p) => p.id === inv.propertyId);
    const key = inv.propertyId || inv.clientName;
    const existing = clientMap.get(key);
    if (!existing) {
      clientMap.set(key, {
        propertyId: inv.propertyId,
        clientName: inv.clientName,
        locality: prop?.neighborhood || inv.neighborhood || 'Venado Tuerto',
        cutsCount: 1,
        totalBilled: inv.amount,
        lastAmount: inv.amount,
        lastDate: inv.date,
      });
    } else {
      existing.cutsCount += 1;
      existing.totalBilled += inv.amount;
      if (inv.date >= existing.lastDate) {
        existing.lastDate = inv.date;
        existing.lastAmount = inv.amount;
      }
    }
  }

  const clientRanking = Array.from(clientMap.values()).sort(
    (a, b) => b.totalBilled - a.totalBilled
  );

  const totalExp = expenses.reduce((acc, e) => acc + e.amount, 0);
  const expCatMap = new Map<string, number>();
  for (const e of expenses) {
    expCatMap.set(e.category, (expCatMap.get(e.category) || 0) + e.amount);
  }
  const expensesByCategory = Array.from(expCatMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExp > 0 ? Math.round((amount / totalExp) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    monthlyBreakdown,
    localityBreakdown,
    clientRanking,
    expensesByCategory,
  };
}

/**
 * Removes a client property and cleans up any uncompleted jobs for that property.
 */
export function deleteClientPropertyFromState(
  properties: ClientProperty[],
  todayJobs: ScheduledJob[],
  propertyIdToDelete: string
): {
  remainingProperties: ClientProperty[];
  remainingJobs: ScheduledJob[];
} {
  const remainingProperties = properties.filter(
    (p) => p.id !== propertyIdToDelete
  );
  const remainingJobs = todayJobs
    .filter((j) => j.propertyId !== propertyIdToDelete)
    .map((j, idx) => ({ ...j, orderIndex: idx + 1 }));
  return { remainingProperties, remainingJobs };
}

/**
 * Generates a CSV string (UTF-8 with BOM for Excel/Google Sheets compatibility).
 */
export function generateSpreadsheetCsv(
  properties: ClientProperty[],
  invoices: InvoiceRecord[],
  expenses: OperationalExpense[]
): string {
  const escapeCell = (val: unknown) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const lines: string[] = [];
  lines.push('=== CARTERA DE CLIENTES Y TERRENOS ===');
  lines.push(
    [
      'ID',
      'Cliente',
      'Telefono',
      'Direccion',
      'Localidad / Barrio',
      'Tipo',
      'Superficie m2',
      'Frecuencia',
      'Tarifa Actual',
      'Ultimo Cobro',
      'Ultimo Corte',
      'Proximo Corte',
      'Notas de Acceso',
    ]
      .map(escapeCell)
      .join(',')
  );

  for (const p of properties) {
    const history = getClientPriceHistory(p.id, p.clientName, invoices);
    lines.push(
      [
        p.id,
        p.clientName,
        p.phone,
        p.address,
        p.neighborhood,
        p.propertyType,
        p.areaSqm,
        p.frequency,
        p.basePrice,
        history.lastAmount ?? p.basePrice,
        p.lastCutDate,
        p.nextCutDate,
        p.accessNotes,
      ]
        .map(escapeCell)
        .join(',')
    );
  }

  lines.push('');
  lines.push('=== HISTORIAL DE FACTURACION Y COBROS ===');
  lines.push(
    [
      'Nro Recibo',
      'Fecha',
      'Cliente',
      'Direccion',
      'Localidad',
      'Tipo',
      'm2',
      'Monto Cobrado',
      'Estado',
      'Medio de Pago',
      'Proximo Corte',
    ]
      .map(escapeCell)
      .join(',')
  );

  for (const inv of invoices) {
    lines.push(
      [
        inv.invoiceNumber,
        inv.date,
        inv.clientName,
        inv.address,
        inv.neighborhood || 'Venado Tuerto',
        inv.propertyType,
        inv.areaSqm,
        inv.amount,
        inv.status,
        inv.paymentMethod || 'Pendiente',
        inv.nextScheduledDate,
      ]
        .map(escapeCell)
        .join(',')
    );
  }

  lines.push('');
  lines.push('=== GASTOS OPERATIVOS (NAFTA, TANZA, EQUIPOS) ===');
  lines.push(
    ['Fecha', 'Categoria', 'Detalle', 'Monto'].map(escapeCell).join(',')
  );
  for (const exp of expenses) {
    lines.push(
      [exp.date, exp.category, exp.description, exp.amount]
        .map(escapeCell)
        .join(',')
    );
  }

  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Generates Tab-Separated Values (TSV) formatted for 1-click pasting directly
 * into a Google Sheets spreadsheet on mobile or desktop.
 */
export function generateGoogleSheetsTsv(
  properties: ClientProperty[],
  invoices: InvoiceRecord[]
): string {
  const rows: string[][] = [
    [
      'Cliente',
      'Teléfono',
      'Dirección',
      'Localidad / Pueblo',
      'Tipo Lote',
      'm²',
      'Frecuencia',
      'Tarifa Actual ($)',
      'Último Cobro ($)',
      'Fecha Último Cobro',
      'Próximo Corte',
      'Saldo Pendiente ($)',
      'Notas de Acceso',
    ],
  ];

  for (const p of properties) {
    const history = getClientPriceHistory(p.id, p.clientName, invoices);

    rows.push([
      p.clientName,
      p.phone,
      p.address,
      p.neighborhood,
      p.propertyType,
      String(p.areaSqm),
      p.frequency,
      String(p.basePrice),
      String(history.lastAmount ?? p.basePrice),
      history.lastDate || p.lastCutDate,
      p.nextCutDate,
      String(history.pendingBalance),
      p.accessNotes,
    ]);
  }

  return rows.map((r) => r.join('\t')).join('\n');
}

/**
 * Builds a direct Google Maps turn-by-turn navigation URL.
 */
export function buildGoogleMapsNavUrl(
  destination: LatLng,
  waypoints?: LatLng[]
): string {
  const destStr = `${destination.lat},${destination.lng}`;
  if (!waypoints || waypoints.length === 0) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destStr)}&travelmode=driving`;
  }
  const wpStr = waypoints.map((w) => `${w.lat},${w.lng}`).join('|');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destStr)}&waypoints=${encodeURIComponent(wpStr)}&travelmode=driving`;
}

/**
 * Applies a 1-click percentage tariff adjustment (e.g. +10%, +15%, +20%) rounded to the nearest $500
 * to either all client properties or only outdated ones (last cut > 20 days before referenceDate).
 */
export function applyBulkPriceIncrease(
  properties: ClientProperty[],
  scheduledJobs: ScheduledJob[],
  percentIncrease: number,
  onlyOutdated = false,
  referenceDateStr = '2026-11-01'
): {
  updatedProperties: ClientProperty[];
  updatedJobs: ScheduledJob[];
  updatedCount: number;
} {
  const multiplier = 1 + percentIncrease / 100;
  const refParts = referenceDateStr.split('-').map(Number);
  const refUtc = new Date(
    Date.UTC(refParts[0] || 2026, (refParts[1] || 11) - 1, refParts[2] || 1)
  );
  const cutoffUtc = new Date(refUtc.getTime());
  cutoffUtc.setUTCDate(cutoffUtc.getUTCDate() - 20);
  const cutoffStr = cutoffUtc.toISOString().slice(0, 10);

  const updatedIds = new Map<string, number>();

  const updatedProperties = properties.map((prop) => {
    const isOutdated =
      !prop.lastCutDate ||
      prop.lastCutDate === 'Nuevo' ||
      prop.lastCutDate <= cutoffStr;

    if (onlyOutdated && !isOutdated) {
      return prop;
    }

    const newBasePrice = Math.max(
      1000,
      Math.round((prop.basePrice * multiplier) / 500) * 500
    );
    updatedIds.set(prop.id, newBasePrice);
    return {
      ...prop,
      basePrice: newBasePrice,
    };
  });

  const updatedJobs = scheduledJobs.map((job) => {
    if (job.status === 'Completado') return job;
    const newPrice = updatedIds.get(job.propertyId);
    if (newPrice !== undefined) {
      return {
        ...job,
        price: newPrice,
      };
    }
    return job;
  });

  return {
    updatedProperties,
    updatedJobs,
    updatedCount: updatedIds.size,
  };
}

/**
 * Generates a deterministic lawn-care weather forecast and cutting window for any YYYY-MM-DD date.
 */
export function getWeatherForDate(
  dateStr: string,
  _city = 'Venado Tuerto'
): WeatherForecastDay {
  const parts = (dateStr || '2026-11-01').split('-').map(Number);
  const dayNum = parts[2] || 1;
  const monthNum = parts[1] || 11;
  const hash = (dayNum * 7 + monthNum * 13) % 10;

  // Deterministic pattern: Nov 3 (day 3) or hash === 4 or 8 has rain alert so the gardener can test/see rain warnings
  if (dayNum === 3 || hash === 4) {
    return {
      dateStr,
      condition: 'Alerta Lluvia',
      tempMax: 21,
      tempMin: 14,
      rainProb: 75,
      windKmh: 28,
      cuttingWindowLabel: 'Pasto húmedo / barro · Reprogramar (+1d)',
      isRainRisk: true,
    };
  }

  if (dayNum === 2 || hash === 2 || hash === 6) {
    return {
      dateStr,
      condition: 'Parcialmente Nublado',
      tempMax: 25,
      tempMin: 13,
      rainProb: 20,
      windKmh: 16,
      cuttingWindowLabel: 'Ventana ideal 08:00–17:30 hs',
      isRainRisk: false,
    };
  }

  return {
    dateStr,
    condition: 'Soleado',
    tempMax: 28,
    tempMin: 15,
    rainProb: 5,
    windKmh: 12,
    cuttingWindowLabel: 'Pasto seco · Óptimo 07:30–18:30 hs',
    isRainRisk: false,
  };
}

/**
 * Appends an action to the local Service Worker offline persistence queue.
 */
export function enqueueOfflineAction(
  currentQueue: OfflineSyncAction[],
  type: OfflineActionType,
  label: string,
  detail: string,
  nowTimestamp = '10:15 hs'
): OfflineSyncAction[] {
  const newItem: OfflineSyncAction = {
    id: `offline-act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    label,
    detail,
    createdAt: nowTimestamp,
    status: 'Pendiente',
  };
  return [newItem, ...currentQueue];
}

/**
 * Flushes all pending actions in the offline queue when connectivity returns.
 */
export function flushOfflineActionQueue(
  currentQueue: OfflineSyncAction[],
  syncedTimestamp = 'Recién sincronizado'
): {
  flushedQueue: OfflineSyncAction[];
  flushedCount: number;
} {
  let flushedCount = 0;
  const flushedQueue = currentQueue.map((item) => {
    if (item.status === 'Pendiente') {
      flushedCount += 1;
      return {
        ...item,
        status: 'Sincronizado' as const,
        syncedAt: syncedTimestamp,
      };
    }
    return item;
  });
  return { flushedQueue, flushedCount };
}

/**
 * Normalizes a string by removing accents/diacritics and converting to lowercase.
 */
function normalizeSearchText(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Generates instant, typo-resistant street and address suggestions for the active city and region.
 * Preserves any user-typed street number (e.g. "Casey 850" -> "Av. Casey 850") and interpolates coordinates.
 */
export function getStreetAddressSuggestions(
  query: string,
  activeCity = 'Venado Tuerto, Santa Fe',
  existingProperties: ClientProperty[] = []
): StreetSuggestionItem[] {
  const raw = (query || '').trim();
  const normalizedQuery = normalizeSearchText(raw);

  // Extract trailing street number if user typed one (e.g. "chacabuco 1240" -> streetPart="chacabuco", numPart="1240")
  const numberMatch = raw.match(/^(.*?)\s+(\d{1,5}[a-zA-Z]?)$/);
  const streetSearchPart = numberMatch
    ? normalizeSearchText(numberMatch[1])
    : normalizedQuery;
  const typedHouseNumber = numberMatch ? numberMatch[2] : '';

  const normalizedActiveCity = normalizeSearchText(activeCity.split(',')[0]);

  const results: StreetSuggestionItem[] = [];
  const seenAddresses = new Set<string>();

  // 1. Match against STREET_CATALOG
  for (let i = 0; i < STREET_CATALOG.length; i++) {
    const entry = STREET_CATALOG[i];
    const normStreet = normalizeSearchText(entry.streetName);
    const normHood = normalizeSearchText(entry.neighborhood);
    const normCity = normalizeSearchText(entry.city);

    const matchesQuery =
      !normalizedQuery ||
      normStreet.includes(streetSearchPart) ||
      normHood.includes(normalizedQuery) ||
      normCity.includes(normalizedQuery);

    if (!matchesQuery) continue;

    // Determine house number to suggest
    const displayNumber = typedHouseNumber || entry.sampleNumber;
    const fullStreetAddress = displayNumber
      ? `${entry.streetName} ${displayNumber}`
      : entry.streetName;

    const dedupeKey = `${fullStreetAddress.toLowerCase()}|${entry.neighborhood.toLowerCase()}`;
    if (seenAddresses.has(dedupeKey)) continue;
    seenAddresses.add(dedupeKey);

    // Slight coordinate interpolation when user enters a custom street number
    const numericHouse = Number(typedHouseNumber.replace(/\D/g, '')) || 0;
    const latOffset = numericHouse ? ((numericHouse % 1500) - 750) * 0.000004 : 0;
    const lngOffset = numericHouse ? ((numericHouse % 1200) - 600) * 0.000004 : 0;

    results.push({
      id: `cat-${i}-${displayNumber || 'base'}`,
      streetAddress: fullStreetAddress,
      neighborhood: entry.neighborhood,
      city: entry.city,
      coordinates: {
        lat: Math.round((entry.coordinates.lat + latOffset) * 10000) / 10000,
        lng: Math.round((entry.coordinates.lng + lngOffset) * 10000) / 10000,
      },
      source: 'local_catalog',
    });
  }

  // 2. Also include existing client addresses that match the query
  for (const prop of existingProperties) {
    const normAddr = normalizeSearchText(prop.address);
    const normHood = normalizeSearchText(prop.neighborhood);
    if (
      normalizedQuery &&
      (normAddr.includes(normalizedQuery) || normHood.includes(normalizedQuery))
    ) {
      const dedupeKey = `${prop.address.toLowerCase()}|${prop.neighborhood.toLowerCase()}`;
      if (!seenAddresses.has(dedupeKey)) {
        seenAddresses.add(dedupeKey);
        results.push({
          id: `prop-addr-${prop.id}`,
          streetAddress: prop.address,
          neighborhood: prop.neighborhood,
          city: prop.neighborhood.split('-')[0].trim(),
          coordinates: prop.coordinates,
          source: 'local_catalog',
        });
      }
    }
  }

  // Sort: prioritize active city first, then prefix matches on street name
  results.sort((a, b) => {
    const aInCity = normalizeSearchText(a.city).includes(normalizedActiveCity)
      ? 1
      : 0;
    const bInCity = normalizeSearchText(b.city).includes(normalizedActiveCity)
      ? 1
      : 0;
    if (aInCity !== bInCity) return bInCity - aInCity;

    const aStarts = normalizeSearchText(a.streetAddress).startsWith(
      streetSearchPart
    )
      ? 1
      : 0;
    const bStarts = normalizeSearchText(b.streetAddress).startsWith(
      streetSearchPart
    )
      ? 1
      : 0;
    return bStarts - aStarts;
  });

  // If user typed a custom street name with >= 3 chars that had 0 catalog matches, offer a formatted suggestion in active city
  if (raw.length >= 3 && results.length === 0) {
    const formattedCustom =
      raw.charAt(0).toUpperCase() +
      raw.slice(1) +
      (/\d/.test(raw) ? '' : ' 450');
    results.push({
      id: `custom-sug-${raw}`,
      streetAddress: formattedCustom,
      neighborhood: `${activeCity.split(',')[0].trim()} - Centro`,
      city: activeCity,
      coordinates: { lat: -33.7456, lng: -61.9688 },
      source: 'local_catalog',
    });
  }

  return results.slice(0, 7);
}

/**
 * Updates an existing scheduled job (cita) in state (changing date, time, price, address, tasks, notes, or status),
 * re-indexes stops by time on affected dates, and recalculates leg distances from baseCoordinates.
 */
export function updateScheduledJobInState(
  baseCoordinates: LatLng,
  scheduledJobs: ScheduledJob[],
  properties: ClientProperty[],
  updatedJob: ScheduledJob,
  alsoUpdateClientProperty = false
): {
  updatedJobs: ScheduledJob[];
  updatedProperties: ClientProperty[];
} {
  const replacedJobs = scheduledJobs.map((job) =>
    job.id === updatedJob.id ? { ...updatedJob } : job
  );

  // Group by date so orderIndex follows chronological scheduledTime on each day
  const byDate = new Map<string, ScheduledJob[]>();
  for (const j of replacedJobs) {
    const list = byDate.get(j.scheduledDate) || [];
    list.push(j);
    byDate.set(j.scheduledDate, list);
  }

  const recalculatedJobs: ScheduledJob[] = [];
  for (const [, dayList] of byDate.entries()) {
    dayList.sort((a, b) =>
      (a.scheduledTime || '08:00').localeCompare(b.scheduledTime || '08:00')
    );
    const recalculatedDay = recalculateJobsFromDynamicBase(
      baseCoordinates,
      dayList
    );
    recalculatedJobs.push(...recalculatedDay);
  }

  const updatedProperties = alsoUpdateClientProperty
    ? properties.map((prop) =>
        prop.id === updatedJob.propertyId
          ? {
              ...prop,
              address: updatedJob.address,
              neighborhood: updatedJob.neighborhood,
              basePrice: updatedJob.price,
              accessNotes: updatedJob.accessNotes,
              coordinates: updatedJob.coordinates,
              nextCutDate: updatedJob.scheduledDate,
            }
          : prop
      )
    : properties.map((prop) =>
        prop.id === updatedJob.propertyId
          ? {
              ...prop,
              nextCutDate: updatedJob.scheduledDate,
            }
          : prop
      );

  return {
    updatedJobs: recalculatedJobs,
    updatedProperties,
  };
}

/**
 * Moves a scheduled job up (-1) or down (+1) in the route sequence for its scheduledDate,
 * and recalculates orderIndex, legDistanceKm, and legDurationMin from baseCoordinates.
 */
export function moveScheduledJobOrder(
  baseCoordinates: LatLng,
  allJobs: ScheduledJob[],
  jobId: string,
  direction: 'up' | 'down'
): ScheduledJob[] {
  const targetJob = allJobs.find((j) => j.id === jobId);
  if (!targetJob) return allJobs;

  const targetDate = targetJob.scheduledDate;
  const dayJobs = allJobs
    .filter((j) => j.scheduledDate === targetDate)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const currentIdx = dayJobs.findIndex((j) => j.id === jobId);
  if (currentIdx === -1) return allJobs;

  const swapIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
  if (swapIdx < 0 || swapIdx >= dayJobs.length) return allJobs;

  const reorderedDay = [...dayJobs];
  const temp = reorderedDay[currentIdx];
  reorderedDay[currentIdx] = reorderedDay[swapIdx];
  reorderedDay[swapIdx] = temp;

  const recalculatedDay = recalculateJobsFromDynamicBase(
    baseCoordinates,
    reorderedDay
  );

  const otherDays = allJobs.filter((j) => j.scheduledDate !== targetDate);
  return [...otherDays, ...recalculatedDay];
}

/**
 * Shifts an ISO date string YYYY-MM-DD by deltaDays using UTC arithmetic.
 */
function addDaysToIsoDate(dateStr: string, deltaDays: number): string {
  const base = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(base.getTime())) return dateStr;
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
}

/**
 * Parses a natural-language Spanish voice command transcript (from Web Speech API SpeechRecognition)
 * into a structured action intent with target entities and a spoken confirmation message.
 */
export function parseVoiceCommand(
  transcript: string,
  activeDateStr: string,
  activeDateJobs: ScheduledJob[],
  todayReferenceStr = '2026-11-01'
): ParsedVoiceCommand {
  const rawTranscript = (transcript || '').trim();
  const norm = normalizeSearchText(rawTranscript);

  if (!norm) {
    return {
      intent: 'UNKNOWN',
      rawTranscript,
      normalizedTranscript: norm,
      spokenResponse:
        'No se escuchó ningún comando. Prueba diciendo: agregar cliente, completar corte, cambiar fecha o leer ruta.',
    };
  }

  // 1. ADD_CLIENT ("agregar cliente", "nuevo cliente", "nuevo corte", "cargar cliente", "crear cliente")
  if (
    norm.includes('agregar cliente') ||
    norm.includes('nuevo cliente') ||
    norm.includes('nuevo corte') ||
    norm.includes('agregar corte') ||
    norm.includes('cargar cliente') ||
    norm.includes('crear cliente')
  ) {
    // Extract optional client name spoken after the trigger keyword
    let extractedName = '';
    const nameMatch = rawTranscript.match(
      /(?:agregar cliente|nuevo cliente|cargar cliente|crear cliente)\s+(.+)$/i
    );
    if (nameMatch && nameMatch[1]) {
      extractedName = nameMatch[1].trim();
    }

    return {
      intent: 'ADD_CLIENT',
      rawTranscript,
      normalizedTranscript: norm,
      ...(extractedName ? { targetClientName: extractedName } : {}),
      spokenResponse: extractedName
        ? `Abriendo formulario para agregar al cliente ${extractedName}.`
        : 'Abriendo formulario para agregar un nuevo cliente o corte programado.',
    };
  }

  // 2. COMPLETE_JOB ("completar corte", "terminar corte", "cobrar corte", "corte terminado", "finalizar corte")
  if (
    norm.includes('completar corte') ||
    norm.includes('terminar corte') ||
    norm.includes('cobrar corte') ||
    norm.includes('finalizar corte') ||
    norm.includes('corte completado') ||
    norm.includes('corte terminado') ||
    norm.startsWith('cobrar a ') ||
    norm.startsWith('completar ')
  ) {
    const pendingOrActive = [...activeDateJobs]
      .filter((j) => j.status !== 'Completado')
      .sort((a, b) => a.orderIndex - b.orderIndex);

    // Check if the user mentioned a specific client name or street
    const matchedByName = pendingOrActive.find((j) => {
      const clientTokens = normalizeSearchText(j.clientName)
        .split(/\s+/)
        .filter((t) => t.length >= 3);
      const addrTokens = normalizeSearchText(j.address)
        .split(/\s+/)
        .filter((t) => t.length >= 3);
      return (
        clientTokens.some((t) => norm.includes(t)) ||
        addrTokens.some((t) => norm.includes(t))
      );
    });

    // Otherwise prefer an 'En Curso' job first, then the first 'Pendiente' job
    const inProgressJob = pendingOrActive.find((j) => j.status === 'En Curso');
    const chosenJob = matchedByName || inProgressJob || pendingOrActive[0];

    if (!chosenJob) {
      return {
        intent: 'COMPLETE_JOB',
        rawTranscript,
        normalizedTranscript: norm,
        spokenResponse:
          'Todos los cortes de esta fecha ya figuran completados.',
      };
    }

    return {
      intent: 'COMPLETE_JOB',
      rawTranscript,
      normalizedTranscript: norm,
      targetJobId: chosenJob.id,
      targetClientName: chosenJob.clientName,
      spokenResponse: `Abriendo cobro y comprobante para completar el corte de ${chosenJob.clientName}, importe ${chosenJob.price.toLocaleString('es-AR')} pesos.`,
    };
  }

  // 3. START_JOB ("iniciar corte", "empezar corte", "arrancar corte")
  if (
    norm.includes('iniciar corte') ||
    norm.includes('empezar corte') ||
    norm.includes('arrancar corte') ||
    norm.includes('comenzar corte')
  ) {
    const pendingJobs = [...activeDateJobs]
      .filter((j) => j.status === 'Pendiente')
      .sort((a, b) => a.orderIndex - b.orderIndex);

    const matchedByName = pendingJobs.find((j) =>
      normalizeSearchText(j.clientName)
        .split(/\s+/)
        .filter((t) => t.length >= 3)
        .some((t) => norm.includes(t))
    );
    const chosenJob = matchedByName || pendingJobs[0];

    if (!chosenJob) {
      return {
        intent: 'START_JOB',
        rawTranscript,
        normalizedTranscript: norm,
        spokenResponse: 'No hay cortes pendientes para iniciar en esta fecha.',
      };
    }

    return {
      intent: 'START_JOB',
      rawTranscript,
      normalizedTranscript: norm,
      targetJobId: chosenJob.id,
      targetClientName: chosenJob.clientName,
      spokenResponse: `Corte iniciado en lo de ${chosenJob.clientName}, dirección ${chosenJob.address}.`,
    };
  }

  // 4. CHANGE_DATE ("cambiar fecha", "ir a manana", "dia siguiente", "ir a ayer", "ir a hoy", etc.)
  if (
    norm.includes('cambiar fecha') ||
    norm.includes('ir a manana') ||
    norm.includes('pasar a manana') ||
    norm.includes('fecha manana') ||
    norm.includes('dia siguiente') ||
    norm.includes('proximo dia') ||
    norm.includes('ir a ayer') ||
    norm.includes('dia anterior') ||
    norm.includes('ir a hoy') ||
    norm.includes('volver a hoy') ||
    norm.includes('fecha de hoy')
  ) {
    let targetDateStr = addDaysToIsoDate(activeDateStr, 1);
    let label = ' el día siguiente';

    if (norm.includes('ayer') || norm.includes('anterior')) {
      targetDateStr = addDaysToIsoDate(activeDateStr, -1);
      label = ' el día anterior';
    } else if (norm.includes('hoy')) {
      targetDateStr = todayReferenceStr;
      label = ' hoy';
    } else if (norm.includes('manana')) {
      targetDateStr = addDaysToIsoDate(todayReferenceStr, 1);
      label = ' mañana';
    } else {
      // Check if an explicit day of month was spoken (e.g., "cambiar fecha al 5" or "cambiar fecha al 15 de noviembre")
      const dayNumberMatch = norm.match(/\b(?:al|dia|fecha)\s+(\d{1,2})\b/);
      if (dayNumberMatch) {
        const dayNum = Math.min(30, Math.max(1, Number(dayNumberMatch[1])));
        const yearMonth = activeDateStr.slice(0, 7) || '2026-11';
        targetDateStr = `${yearMonth}-${String(dayNum).padStart(2, '0')}`;
        label = ` el ${targetDateStr}`;
      }
    }

    return {
      intent: 'CHANGE_DATE',
      rawTranscript,
      normalizedTranscript: norm,
      targetDateStr,
      spokenResponse: `Cambiando agenda a${label} (${targetDateStr}).`,
    };
  }

  // 5. READ_ROUTE ("leer ruta", "escuchar ruta", "que tengo hoy", "resumen del dia", "leer agenda")
  if (
    norm.includes('leer ruta') ||
    norm.includes('escuchar ruta') ||
    norm.includes('que tengo hoy') ||
    norm.includes('resumen del dia') ||
    norm.includes('leer agenda') ||
    norm.includes('leer paradas') ||
    norm.includes('leer trabajos')
  ) {
    return {
      intent: 'READ_ROUTE',
      rawTranscript,
      normalizedTranscript: norm,
      spokenResponse: 'Leyendo en voz alta la hoja de ruta del día.',
    };
  }

  // 6. OPTIMIZE_ROUTE ("optimizar ruta", "ordenar ruta", "ordenar por cercania")
  if (
    norm.includes('optimizar ruta') ||
    norm.includes('ordenar ruta') ||
    norm.includes('ordenar por cercania')
  ) {
    return {
      intent: 'OPTIMIZE_ROUTE',
      rawTranscript,
      normalizedTranscript: norm,
      spokenResponse:
        'Optimizando el orden de la ruta por cercanía GPS desde tu punto de salida.',
    };
  }

  // 7. RAIN_DELAY ("llovio", "posponer por lluvia", "reprogramar lluvia")
  if (
    norm.includes('llovio') ||
    norm.includes('posponer por lluvia') ||
    norm.includes('reprogramar por lluvia') ||
    norm.includes('alerta lluvia')
  ) {
    return {
      intent: 'RAIN_DELAY',
      rawTranscript,
      normalizedTranscript: norm,
      spokenResponse:
        'Reprogramando los cortes pendientes un día hacia adelante por lluvia.',
    };
  }

  // 8. NAVIGATE_VIEW ("ir a agenda", "ir a clientes", "ir a mi plata", "ir a ruta")
  if (
    norm.includes('agenda') ||
    norm.includes('calendario')
  ) {
    return {
      intent: 'NAVIGATE_VIEW',
      rawTranscript,
      normalizedTranscript: norm,
      targetView: 'agenda',
      spokenResponse: 'Abriendo la agenda y calendario de cortes.',
    };
  }
  if (norm.includes('clientes') || norm.includes('cartera')) {
    return {
      intent: 'NAVIGATE_VIEW',
      rawTranscript,
      normalizedTranscript: norm,
      targetView: 'clientes',
      spokenResponse: 'Abriendo la cartera de clientes de Venado Tuerto y pueblos.',
    };
  }
  if (
    norm.includes('mi plata') ||
    norm.includes('ganancias') ||
    norm.includes('estadisticas') ||
    norm.includes('caja') ||
    norm.includes('cotizador')
  ) {
    return {
      intent: 'NAVIGATE_VIEW',
      rawTranscript,
      normalizedTranscript: norm,
      targetView: 'finanzas',
      spokenResponse: 'Abriendo Mi Plata, estadísticas de ganancias y cotizador.',
    };
  }
  if (norm.includes('ruta') || norm.includes('mapa')) {
    return {
      intent: 'NAVIGATE_VIEW',
      rawTranscript,
      normalizedTranscript: norm,
      targetView: 'hoy',
      spokenResponse: 'Abriendo la hoja de ruta y mapa GPS del día.',
    };
  }

  return {
    intent: 'UNKNOWN',
    rawTranscript,
    normalizedTranscript: norm,
    spokenResponse: `No reconocí el comando "${rawTranscript}". Puedes decir: agregar cliente, completar corte, cambiar fecha, iniciar corte o leer ruta.`,
  };
}

/**
 * Builds a clear, natural Spanish Text-to-Speech summary of the day's route, weather, and next stop.
 */
export function buildDailyRouteSpeechText(
  activeDate: string,
  city: string,
  jobs: ScheduledJob[],
  weather: WeatherForecastDay
): string {
  const shortCity = (city || 'Venado Tuerto').split(',')[0].trim();
  if (jobs.length === 0) {
    return `Hoja de ruta para el ${activeDate} en ${shortCity}. Clima ${weather.condition}, máxima ${weather.tempMax} grados. No tienes cortes programados para esta fecha.`;
  }

  const completed = jobs.filter((j) => j.status === 'Completado').length;
  const pending = jobs.length - completed;
  const totalAmount = jobs.reduce((acc, j) => acc + j.price, 0);
  const nextStop = [...jobs]
    .filter((j) => j.status !== 'Completado')
    .sort((a, b) => a.orderIndex - b.orderIndex)[0];

  const baseIntro = `Resumen de ruta para el ${activeDate} saliendo desde ${shortCity}. Clima ${weather.condition}, ${weather.tempMax} grados, ${weather.cuttingWindowLabel}. Tienes ${jobs.length} cortes en total por ${totalAmount.toLocaleString('es-AR')} pesos: ${completed} completados y ${pending} pendientes.`;

  if (!nextStop) {
    return `${baseIntro} ¡Felicitaciones! Ya completaste todos los cortes del día.`;
  }

  return `${baseIntro} Tu próxima parada es la número ${nextStop.orderIndex}, a las ${nextStop.scheduledTime} horas: ${nextStop.clientName}, en ${nextStop.address}, ${nextStop.neighborhood}. Valor del corte: ${nextStop.price.toLocaleString('es-AR')} pesos. Tareas: ${nextStop.tasks.join(', ')}.`;
}

/**
 * Builds a detailed Spanish Text-to-Speech script for an individual stop card.
 */
export function buildStopSpeechText(
  job: ScheduledJob,
  previousAmount?: number | null
): string {
  const statusPhrase =
    job.status === 'Completado'
      ? 'Corte ya finalizado.'
      : job.status === 'En Curso'
      ? 'Corte actualmente en curso.'
      : `Parada número ${job.orderIndex}, programada a las ${job.scheduledTime} horas.`;

  const prevPhrase = previousAmount
    ? ` En la visita anterior se le cobró ${previousAmount.toLocaleString('es-AR')} pesos.`
    : '';

  const accessPhrase = job.accessNotes
    ? ` Nota de acceso: ${job.accessNotes}`
    : '';

  return `${statusPhrase} Cliente: ${job.clientName}. Dirección: ${job.address}, ${job.neighborhood}. Tipo de lote: ${job.propertyType} de ${job.areaSqm} metros cuadrados. Valor a cobrar: ${job.price.toLocaleString('es-AR')} pesos.${prevPhrase} Tareas a realizar: ${job.tasks.join(', ')}.${accessPhrase}`;
}

/**
 * Pure helper to update an existing InvoiceRecord and synchronize the linked ScheduledJob and ClientProperty if requested.
 */
export function updateInvoiceRecordInState(
  invoices: InvoiceRecord[],
  scheduledJobs: ScheduledJob[],
  properties: ClientProperty[],
  updatedInvoice: InvoiceRecord,
  syncClientBasePrice = false
): {
  updatedInvoices: InvoiceRecord[];
  updatedJobs: ScheduledJob[];
  updatedProperties: ClientProperty[];
} {
  const cleanAmount = Math.max(1000, Number(updatedInvoice.amount) || 1000);
  const normalizedInvoice: InvoiceRecord = {
    ...updatedInvoice,
    amount: cleanAmount,
    paidAt:
      updatedInvoice.status === 'Pagado'
        ? updatedInvoice.paidAt || updatedInvoice.date
        : undefined,
    paymentMethod:
      updatedInvoice.status === 'Pagado'
        ? updatedInvoice.paymentMethod || 'Transferencia'
        : undefined,
  };

  const updatedInvoices = invoices.map((inv) =>
    inv.id === normalizedInvoice.id ? normalizedInvoice : inv
  );

  const updatedJobs = scheduledJobs.map((job) =>
    job.id === normalizedInvoice.jobId || job.invoiceId === normalizedInvoice.id
      ? {
          ...job,
          clientName: normalizedInvoice.clientName,
          address: normalizedInvoice.address,
          neighborhood: normalizedInvoice.neighborhood || job.neighborhood,
          price: cleanAmount,
          tasks:
            normalizedInvoice.tasksCompleted.length > 0
              ? normalizedInvoice.tasksCompleted
              : job.tasks,
        }
      : job
  );

  const updatedProperties = syncClientBasePrice
    ? properties.map((prop) =>
        prop.id === normalizedInvoice.propertyId
          ? {
              ...prop,
              clientName: normalizedInvoice.clientName,
              address: normalizedInvoice.address,
              basePrice: cleanAmount,
            }
          : prop
      )
    : properties;

  return {
    updatedInvoices,
    updatedJobs,
    updatedProperties,
  };
}

/**
 * Pure helper to update an existing OperationalExpense in state.
 */
export function updateOperationalExpenseInState(
  expenses: OperationalExpense[],
  updatedExpense: OperationalExpense
): OperationalExpense[] {
  const cleanAmount = Math.max(100, Number(updatedExpense.amount) || 100);
  return expenses.map((exp) =>
    exp.id === updatedExpense.id
      ? {
          ...updatedExpense,
          description: updatedExpense.description.trim() || exp.description,
          amount: cleanAmount,
        }
      : exp
  );
}

/**
 * Pure helper to update an existing EquipmentItem in state.
 */
export function updateEquipmentItemInState(
  equipment: EquipmentItem[],
  updatedItem: EquipmentItem
): EquipmentItem[] {
  return equipment.map((item) =>
    item.id === updatedItem.id
      ? {
          ...updatedItem,
          name: updatedItem.name.trim() || item.name,
          model: updatedItem.model.trim() || item.model,
          hoursUsed: Math.max(
            0,
            Math.round((Number(updatedItem.hoursUsed) || 0) * 10) / 10
          ),
          serviceLimitHours: Math.max(
            5,
            Math.round(Number(updatedItem.serviceLimitHours) || 25)
          ),
          nextTask: updatedItem.nextTask.trim() || item.nextTask,
        }
      : item
  );
}

/**
 * Strips control characters and unsafe angle-bracket tags, trimming to maxLength.
 */
export function sanitizeText(input: unknown, maxLength = 160): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Builds a safe https://wa.me URL with strictly digits-only phone and URL-encoded text.
 */
export function buildSafeWhatsAppUrl(phone: string, message: string): string {
  const digitsOnly = String(phone || '').replace(/[^\d]/g, '');
  const safeMessage = encodeURIComponent(String(message || '').trim());
  if (!digitsOnly) {
    return `https://wa.me/?text=${safeMessage}`;
  }
  return `https://wa.me/${digitsOnly}?text=${safeMessage}`;
}

/**
 * Validates and sanitizes an imported JSON backup payload to prevent corrupted state,
 * NaN/negative numbers, invalid coordinates, or unsafe URLs.
 */
export function sanitizeAndValidateBackupPayload(
  raw: unknown
): Partial<BackupPayload> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const obj = raw as Record<string, any>;
  const result: Partial<BackupPayload> = {};

  if (obj.businessProfile && typeof obj.businessProfile === 'object') {
    const bp = obj.businessProfile;
    const appName = sanitizeText(bp.appName, 60);
    if (appName) {
      result.businessProfile = {
        appName,
        slogan:
          sanitizeText(bp.slogan, 120) ||
          'Mantenimiento de Césped, Quintas y Jardines',
        ownerName: sanitizeText(bp.ownerName, 80) || 'Titular',
        ownerPhone: sanitizeText(bp.ownerPhone, 40) || '',
        baseRatePerSqm: Math.min(
          10000,
          Math.max(1, Number(bp.baseRatePerSqm) || 58)
        ),
        minServicePrice: Math.min(
          5000000,
          Math.max(500, Number(bp.minServicePrice) || 12000)
        ),
      };
    }
  }

  if (
    obj.baseLocation &&
    typeof obj.baseLocation === 'object' &&
    obj.baseLocation.coordinates &&
    typeof obj.baseLocation.coordinates.lat === 'number' &&
    typeof obj.baseLocation.coordinates.lng === 'number'
  ) {
    const lat = Number(obj.baseLocation.coordinates.lat);
    const lng = Number(obj.baseLocation.coordinates.lng);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      result.baseLocation = {
        name: sanitizeText(obj.baseLocation.name, 80) || 'Base Operativa',
        city: sanitizeText(obj.baseLocation.city, 80) || 'Venado Tuerto',
        address: sanitizeText(obj.baseLocation.address, 120) || 'Centro',
        coordinates: { lat, lng },
        source: obj.baseLocation.source === 'gps' ? 'gps' : 'manual',
        updatedAt: sanitizeText(obj.baseLocation.updatedAt, 40) || undefined,
      };
    }
  }

  const isSafePhotoUrl = (url: unknown): string | undefined => {
    if (typeof url !== 'string' || !url.trim()) return undefined;
    const trimmed = url.trim();
    if (
      trimmed.startsWith('data:image/') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('http://')
    ) {
      return trimmed.slice(0, 500000);
    }
    return undefined;
  };

  if (Array.isArray(obj.properties)) {
    result.properties = obj.properties
      .slice(0, 1000)
      .filter((p) => p && typeof p === 'object' && typeof p.id === 'string')
      .map((p) => ({
        ...p,
        id: sanitizeText(p.id, 60),
        clientName: sanitizeText(p.clientName, 80) || 'Cliente',
        phone: sanitizeText(p.phone, 40),
        address: sanitizeText(p.address, 120) || 'Sin dirección',
        neighborhood: sanitizeText(p.neighborhood, 80) || 'Venado Tuerto',
        areaSqm: Math.max(10, Number(p.areaSqm) || 200),
        basePrice: Math.max(500, Number(p.basePrice) || 15000),
        estimatedMinutes: Math.max(10, Number(p.estimatedMinutes) || 45),
        accessNotes: sanitizeText(p.accessNotes, 200),
      }));
  }

  if (Array.isArray(obj.todayJobs)) {
    result.todayJobs = obj.todayJobs
      .slice(0, 2000)
      .filter((j) => j && typeof j === 'object' && typeof j.id === 'string')
      .map((j) => ({
        ...j,
        id: sanitizeText(j.id, 60),
        clientName: sanitizeText(j.clientName, 80) || 'Cliente',
        address: sanitizeText(j.address, 120) || 'Sin dirección',
        price: Math.max(500, Number(j.price) || 15000),
        photoUrl: isSafePhotoUrl(j.photoUrl),
      }));
  }

  if (Array.isArray(obj.invoices)) {
    result.invoices = obj.invoices
      .slice(0, 3000)
      .filter((inv) => inv && typeof inv === 'object' && typeof inv.id === 'string')
      .map((inv) => ({
        ...inv,
        id: sanitizeText(inv.id, 60),
        clientName: sanitizeText(inv.clientName, 80) || 'Cliente',
        address: sanitizeText(inv.address, 120) || 'Sin dirección',
        amount: Math.max(500, Number(inv.amount) || 15000),
        photoUrl: isSafePhotoUrl(inv.photoUrl),
      }));
  }

  if (Array.isArray(obj.expenses)) {
    result.expenses = obj.expenses
      .slice(0, 3000)
      .filter((e) => e && typeof e === 'object' && typeof e.id === 'string')
      .map((e) => ({
        ...e,
        id: sanitizeText(e.id, 60),
        description: sanitizeText(e.description, 140) || 'Insumo operativo',
        amount: Math.max(10, Number(e.amount) || 1000),
      }));
  }

  if (Array.isArray(obj.equipment)) {
    result.equipment = obj.equipment
      .slice(0, 200)
      .filter((eq) => eq && typeof eq === 'object' && typeof eq.id === 'string')
      .map((eq) => ({
        ...eq,
        id: sanitizeText(eq.id, 60),
        name: sanitizeText(eq.name, 80) || 'Equipo',
        model: sanitizeText(eq.model, 80) || '',
        hoursUsed: Math.max(0, Number(eq.hoursUsed) || 0),
        serviceLimitHours: Math.max(5, Number(eq.serviceLimitHours) || 25),
        nextTask: sanitizeText(eq.nextTask, 120) || 'Control general',
      }));
  }

  if (Object.keys(result).length === 0) {
    return null;
  }

  return result;
}




