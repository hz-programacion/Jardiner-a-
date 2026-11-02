import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBulkPriceIncrease,
  buildMonthCalendarGrid,
  buildWeekDaysForDate,
  calculateFinancialSummary,
  calculateHaversineDistanceKm,
  calculateSuggestedPrice,
  completeJobAndCreateInvoice,
  computeDetailedAnalytics,
  computeEndTimeFromStart,
  deleteClientPropertyFromState,
  enqueueOfflineAction,
  filterRecordsByPeriod,
  flushOfflineActionQueue,
  formatStopwatchSeconds,
  generateGoogleSheetsTsv,
  getArgentinaCitySuggestions,
  getClientCutTimeHistory,
  getClientPriceHistory,
  getStreetAddressSuggestions,
  getTodayIsoLocal,
  getWeatherForDate,
  moveScheduledJobOrder,
  optimizeRouteOrder,
  recalculateJobsFromDynamicBase,
  reschedulePendingJobsForRain,
  resolveCityCoordinates,
  sanitizeAndValidateBackupPayload,
  sanitizeText,
  buildSafeWhatsAppUrl,
  updateEquipmentItemInState,
  updateInvoiceRecordInState,
  updateOperationalExpenseInState,
  updateScheduledJobInState,
} from './lawnLogic';
import {
  createBlankTenantWorkspace,
  getInitialAccessApprovalState,
  hasValidCustomMercadoPagoLink,
  isPrimaryAdminEmail,
  normalizeTenantLicenseConfig,
  PENDING_APPROVAL_BLOCK_MESSAGE,
  PRIMARY_ADMIN_EMAIL,
} from './saasLogic';
import {
  BASE_DEPOT,
  CITY_PRESETS,
  getLocalDateOffset,
  INITIAL_EQUIPMENT,
  INITIAL_EXPENSES,
  INITIAL_INVOICES,
  INITIAL_PROPERTIES,
  INITIAL_TODAY_JOBS,
} from '../data/seedData';

const TODAY_ISO = getTodayIsoLocal();
const TOMORROW_ISO = getLocalDateOffset(1);

test('getTodayIsoLocal returns real-time local date YYYY-MM-DD', () => {
  assert.match(TODAY_ISO, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(TODAY_ISO, getLocalDateOffset(0));
});

test('getArgentinaCitySuggestions anticipates full city name and GPS coordinates when typing partial query like "Venado"', () => {
  const venadoSuggestions = getArgentinaCitySuggestions('Venado');
  assert.ok(venadoSuggestions.length > 0);
  assert.equal(venadoSuggestions[0].fullName, 'Venado Tuerto, Santa Fe');
  assert.equal(venadoSuggestions[0].coordinates.lat, -33.7456);
  assert.equal(venadoSuggestions[0].coordinates.lng, -61.9688);

  const resolved = resolveCityCoordinates('Venado');
  assert.equal(resolved.fullName, 'Venado Tuerto, Santa Fe');

  const cordobaSuggestions = getArgentinaCitySuggestions('Villa Carlos');
  assert.ok(
    cordobaSuggestions.some((c) => c.fullName.includes('Villa Carlos Paz'))
  );
});

test('Administrator Manual Approval Access Control sets pending state for normal users and approved admin role for hz.mdiego@gmail.com', () => {
  assert.equal(isPrimaryAdminEmail(PRIMARY_ADMIN_EMAIL), true);
  assert.equal(isPrimaryAdminEmail('HZ.MDIEGO@GMAIL.COM'), true);
  assert.equal(isPrimaryAdminEmail('cliente@ejemplo.com'), false);

  const normalUserState = getInitialAccessApprovalState('nuevo@jardinero.com');
  assert.equal(normalUserState.isApproved, false);
  assert.equal(normalUserState.approvalStatus, 'pending');
  assert.equal(normalUserState.role, 'user');

  const adminState = getInitialAccessApprovalState('hz.mdiego@gmail.com');
  assert.equal(adminState.isApproved, true);
  assert.equal(adminState.approvalStatus, 'approved');
  assert.equal(adminState.role, 'admin');

  const blankUserWorkspace = createBlankTenantWorkspace({
    uid: 'tenant-123',
    email: 'jardinero@cordoba.com',
    displayName: 'Juan Pérez',
    businessName: 'Parques Córdoba',
    customCityInput: 'Venado',
  });
  assert.equal(blankUserWorkspace.isApproved, false);
  assert.equal(blankUserWorkspace.approvalStatus, 'pending');
  assert.equal(blankUserWorkspace.role, 'user');
  assert.equal(blankUserWorkspace.baseLocation.city, 'Venado Tuerto, Santa Fe');
  assert.equal(
    PENDING_APPROVAL_BLOCK_MESSAGE,
    'Cuenta pendiente de validación de pago. Por favor, comunícate con el administrador para activar tu licencia de acceso único.'
  );
});

test('calculateHaversineDistanceKm returns 0 for identical points and positive for distinct points', () => {
  const same = calculateHaversineDistanceKm(
    BASE_DEPOT.coordinates,
    BASE_DEPOT.coordinates
  );
  assert.equal(same, 0);

  const distToStop = calculateHaversineDistanceKm(
    BASE_DEPOT.coordinates,
    INITIAL_TODAY_JOBS[0].coordinates
  );
  assert.ok(distToStop > 0.2 && distToStop < 80);
});

test('computeEndTimeFromStart calculates end time HH:mm accurately', () => {
  assert.equal(computeEndTimeFromStart('08:00', 75), '09:15');
  assert.equal(computeEndTimeFromStart('09:30', 90), '11:00');
  assert.equal(computeEndTimeFromStart('15:00', 45), '15:45');
});

test('recalculateJobsFromDynamicBase updates leg distances when starting base changes to Murphy or GPS', () => {
  const todayStops = INITIAL_TODAY_JOBS.filter(
    (j) => j.scheduledDate === TODAY_ISO
  );
  const fromVenado = recalculateJobsFromDynamicBase(
    BASE_DEPOT.coordinates,
    todayStops
  );
  const fromMurphy = recalculateJobsFromDynamicBase(
    CITY_PRESETS['Murphy, Santa Fe'].coordinates,
    todayStops
  );

  assert.equal(fromVenado.length, todayStops.length);
  assert.notEqual(fromVenado[0].legDistanceKm, fromMurphy[0].legDistanceKm);
  assert.ok((fromMurphy[0].legDistanceKm || 0) > (fromVenado[0].legDistanceKm || 0));
});

test('buildWeekDaysForDate builds 7 days (Mon-Sun) and groups scheduled jobs by date and time', () => {
  const weekCells = buildWeekDaysForDate(
    TODAY_ISO,
    INITIAL_TODAY_JOBS,
    TODAY_ISO
  );
  assert.equal(weekCells.length, 7);
  const todayCell = weekCells.find((c) => c.dateStr === TODAY_ISO);
  assert.ok(todayCell);
  assert.equal(todayCell.jobs.length, 5);
  assert.equal(todayCell.jobs[0].scheduledTime, '08:00');
  assert.ok(todayCell.totalRevenue > 150000);
});

test('buildMonthCalendarGrid builds full month grid with multi-day scheduled jobs', () => {
  const [yStr, mStr] = TODAY_ISO.split('-');
  const monthCells = buildMonthCalendarGrid(
    Number(yStr),
    Number(mStr) - 1,
    INITIAL_TODAY_JOBS,
    TODAY_ISO,
    TODAY_ISO
  );
  assert.ok(monthCells.length === 35 || monthCells.length === 42);
  const todayCell = monthCells.find((c) => c.dateStr === TODAY_ISO);
  assert.ok(todayCell);
  assert.equal(todayCell.jobs.length, 5);
});

test('optimizeRouteOrder orders stops from base location', () => {
  const todayOnly = INITIAL_TODAY_JOBS.filter(
    (j) => j.scheduledDate === TODAY_ISO
  );
  const scrambled = [...todayOnly].reverse();
  const result = optimizeRouteOrder(BASE_DEPOT.coordinates, scrambled);

  assert.equal(result.orderedJobs.length, todayOnly.length);
  assert.equal(result.orderedJobs[0].orderIndex, 1);
  assert.ok(result.totalDistanceKm > 0);
  assert.ok(result.totalWorkMinutes > 0);
});

test('calculateSuggestedPrice scales with m2, grassCondition and includesBagging', () => {
  const regularCut = calculateSuggestedPrice(
    500,
    'Terreno',
    'Quincenal',
    0,
    'Regular',
    false
  );
  const heavyWeedWithBagging = calculateSuggestedPrice(
    500,
    'Terreno',
    'Quincenal',
    0,
    'Maleza Pesada',
    true
  );

  assert.ok(heavyWeedWithBagging.suggestedPrice > regularCut.suggestedPrice);
  assert.ok(heavyWeedWithBagging.estimatedMinutes > regularCut.estimatedMinutes);
  assert.ok(heavyWeedWithBagging.estimatedFuelLiters > 0);
});

test('getClientPriceHistory returns chronological previous amounts and variation percent', () => {
  const history = getClientPriceHistory(
    'prop-1',
    'Familia Echeverría',
    INITIAL_INVOICES
  );
  assert.ok(history.totalCutsCount >= 3);
  assert.equal(history.lastAmount, 38000);
  assert.equal(history.lastDate, TODAY_ISO);
  assert.equal(history.previousAmount, 38000);
  assert.ok(history.totalBilled > 100000);
});

test('filterRecordsByPeriod filters invoices and expenses by hoy, semana, mes_anterior, and trimestre', () => {
  const hoyResult = filterRecordsByPeriod(
    INITIAL_INVOICES,
    INITIAL_EXPENSES,
    'hoy',
    TODAY_ISO
  );
  assert.equal(hoyResult.filteredInvoices.length, 1);
  assert.equal(hoyResult.filteredInvoices[0].amount, 38000);

  const septResult = filterRecordsByPeriod(
    INITIAL_INVOICES,
    INITIAL_EXPENSES,
    'mes_anterior',
    '2026-11-01'
  );
  assert.ok(septResult.filteredInvoices.length >= 4);
  assert.ok(
    septResult.filteredInvoices.every((i) => i.date.startsWith('2026-09'))
  );
});

test('computeDetailedAnalytics produces monthlyBreakdown, localityBreakdown, and clientRanking', () => {
  const analytics = computeDetailedAnalytics(
    INITIAL_INVOICES,
    INITIAL_EXPENSES,
    INITIAL_PROPERTIES
  );
  assert.ok(analytics.monthlyBreakdown.length >= 3);
  assert.ok(analytics.localityBreakdown.length >= 4);
  assert.ok(analytics.clientRanking.length >= 5);
});

test('deleteClientPropertyFromState removes client and its jobs cleanly', () => {
  const targetId = INITIAL_PROPERTIES[1].id;
  const { remainingProperties, remainingJobs } = deleteClientPropertyFromState(
    INITIAL_PROPERTIES,
    INITIAL_TODAY_JOBS,
    targetId
  );

  assert.equal(remainingProperties.length, INITIAL_PROPERTIES.length - 1);
  assert.equal(
    remainingJobs.some((j) => j.propertyId === targetId),
    false
  );
});

test('generateGoogleSheetsTsv creates tab-separated rows with headers and last charged amounts', () => {
  const tsv = generateGoogleSheetsTsv(INITIAL_PROPERTIES, INITIAL_INVOICES);
  const lines = tsv.split('\n');
  assert.equal(lines.length, INITIAL_PROPERTIES.length + 1);
  assert.ok(lines[0].includes('Último Cobro ($)'));
  assert.ok(lines[1].includes('Familia Echeverría'));
});

test('completeJobAndCreateInvoice transitions job status, attaches photoUrl and creates invoice with nextCutDate', () => {
  const pendingJob = INITIAL_TODAY_JOBS[2];
  const samplePhoto = 'data:image/svg+xml;utf8,<svg></svg>';
  const { updatedJob, invoice } = completeJobAndCreateInvoice(
    pendingJob,
    true,
    'Transferencia',
    '2026-11-01',
    15,
    samplePhoto
  );

  assert.equal(updatedJob.status, 'Completado');
  assert.equal(updatedJob.photoUrl, samplePhoto);
  assert.equal(invoice.status, 'Pagado');
  assert.equal(invoice.photoUrl, samplePhoto);
  assert.equal(invoice.invoiceNumber, 'REC-2026-0015');
  assert.equal(invoice.nextScheduledDate, '2026-11-15');
});

test('reschedulePendingJobsForRain and calculateFinancialSummary work accurately', () => {
  const delayed = reschedulePendingJobsForRain(
    INITIAL_TODAY_JOBS,
    1,
    TODAY_ISO
  );
  assert.equal(delayed[0].scheduledDate, TODAY_ISO);
  assert.equal(delayed[1].scheduledDate, TOMORROW_ISO);

  const summary = calculateFinancialSummary(INITIAL_INVOICES, INITIAL_EXPENSES);
  assert.ok(summary.totalFacturado > 0);
  assert.equal(summary.gananciaNeta, summary.totalCobrado - summary.totalGastos);
});

test('applyBulkPriceIncrease increases client tariffs and pending scheduled jobs rounded to $500', () => {
  const { updatedProperties, updatedJobs, updatedCount } =
    applyBulkPriceIncrease(
      INITIAL_PROPERTIES,
      INITIAL_TODAY_JOBS,
      15,
      false,
      TODAY_ISO
    );

  assert.equal(updatedCount, INITIAL_PROPERTIES.length);
  const expectedFirst =
    Math.round((INITIAL_PROPERTIES[0].basePrice * 1.15) / 500) * 500;
  assert.equal(updatedProperties[0].basePrice, expectedFirst);

  const pendingJobBefore = INITIAL_TODAY_JOBS.find(
    (j) => j.status !== 'Completado'
  )!;
  const pendingJobAfter = updatedJobs.find((j) => j.id === pendingJobBefore.id)!;
  assert.ok(pendingJobAfter.price > pendingJobBefore.price);
});

test('getWeatherForDate returns valid weather forecast with rain alert on rainy dates', () => {
  const nov1 = getWeatherForDate('2026-11-01', 'Venado Tuerto');
  const nov3Rain = getWeatherForDate('2026-11-03', 'Venado Tuerto');

  assert.equal(nov1.isRainRisk, false);
  assert.equal(nov3Rain.condition, 'Alerta Lluvia');
  assert.equal(nov3Rain.isRainRisk, true);
  assert.ok(nov3Rain.rainProb >= 70);
});

test('enqueueOfflineAction and flushOfflineActionQueue manage local Service Worker action queue', () => {
  let queue = enqueueOfflineAction(
    [],
    'COMPLETE_JOB',
    'Cobro registrado offline: Familia Echeverría',
    '$38.000 · Transferencia',
    '10:20 hs'
  );
  queue = enqueueOfflineAction(
    queue,
    'CREATE_CLIENT',
    'Nuevo cliente offline: Quinta Los Robles',
    'Venado Tuerto · $45.000',
    '10:25 hs'
  );

  assert.equal(queue.length, 2);
  assert.equal(queue[0].status, 'Pendiente');

  const { flushedQueue, flushedCount } = flushOfflineActionQueue(
    queue,
    '10:30 hs'
  );
  assert.equal(flushedCount, 2);
  assert.ok(flushedQueue.every((item) => item.status === 'Sincronizado'));
});

test('getStreetAddressSuggestions returns matching streets for any city in Argentina and preserves custom house numbers', () => {
  const suggestions = getStreetAddressSuggestions(
    'Chacabuco 1450',
    'Venado Tuerto, Santa Fe',
    INITIAL_PROPERTIES
  );
  assert.ok(suggestions.length > 0);
  assert.equal(suggestions[0].streetAddress, 'Chacabuco 1450');
  assert.equal(suggestions[0].neighborhood, 'Venado Tuerto - Centro');

  const tandilSuggestions = getStreetAddressSuggestions(
    'San Martín 450',
    'Tandil, Buenos Aires',
    []
  );
  assert.ok(tandilSuggestions.length > 0);
  assert.ok(tandilSuggestions[0].streetAddress.includes('450'));
  assert.equal(tandilSuggestions[0].city, 'Tandil, Buenos Aires');
});

test('updateScheduledJobInState modifies appointment date, time, price, and address and re-indexes stops', () => {
  const targetJob = INITIAL_TODAY_JOBS[1];
  const modifiedJob = {
    ...targetJob,
    scheduledDate: TOMORROW_ISO,
    scheduledTime: '07:30',
    price: 52000,
    address: 'Bv. 25 de Mayo 820',
  };

  const { updatedJobs, updatedProperties } = updateScheduledJobInState(
    BASE_DEPOT.coordinates,
    INITIAL_TODAY_JOBS,
    INITIAL_PROPERTIES,
    modifiedJob,
    true
  );

  const foundJob = updatedJobs.find((j) => j.id === targetJob.id);
  assert.ok(foundJob);
  assert.equal(foundJob.scheduledDate, TOMORROW_ISO);
  assert.equal(foundJob.scheduledTime, '07:30');
  assert.equal(foundJob.price, 52000);
  assert.equal(foundJob.address, 'Bv. 25 de Mayo 820');
  assert.equal(foundJob.orderIndex, 1);

  const foundProp = updatedProperties.find(
    (p) => p.id === targetJob.propertyId
  );
  assert.ok(foundProp);
  assert.equal(foundProp.basePrice, 52000);
  assert.equal(foundProp.address, 'Bv. 25 de Mayo 820');
});

test('moveScheduledJobOrder swaps stop positions on the same day and recalculates leg distances', () => {
  const todayStops = INITIAL_TODAY_JOBS.filter(
    (j) => j.scheduledDate === TODAY_ISO
  ).sort((a, b) => a.orderIndex - b.orderIndex);
  assert.ok(todayStops.length >= 2);

  const firstId = todayStops[0].id;
  const secondId = todayStops[1].id;

  const movedDown = moveScheduledJobOrder(
    BASE_DEPOT.coordinates,
    INITIAL_TODAY_JOBS,
    firstId,
    'down'
  );

  const reorderedToday = movedDown
    .filter((j) => j.scheduledDate === TODAY_ISO)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  assert.equal(reorderedToday[0].id, secondId);
  assert.equal(reorderedToday[0].orderIndex, 1);
  assert.equal(reorderedToday[1].id, firstId);
  assert.equal(reorderedToday[1].orderIndex, 2);
});

test('updateInvoiceRecordInState, updateOperationalExpenseInState, and updateEquipmentItemInState update records and sync state', () => {
  const targetInvoice = INITIAL_INVOICES[0];
  const editedInvoice = {
    ...targetInvoice,
    amount: 49500,
    status: 'Pagado' as const,
    paymentMethod: 'MercadoPago' as const,
  };

  const { updatedInvoices, updatedProperties } = updateInvoiceRecordInState(
    INITIAL_INVOICES,
    INITIAL_TODAY_JOBS,
    INITIAL_PROPERTIES,
    editedInvoice,
    true
  );

  assert.equal(updatedInvoices[0].amount, 49500);
  assert.equal(updatedInvoices[0].paymentMethod, 'MercadoPago');
  const linkedProp = updatedProperties.find(
    (p) => p.id === targetInvoice.propertyId
  );
  assert.equal(linkedProp?.basePrice, 49500);

  // Expense edit
  const targetExp = INITIAL_EXPENSES[0];
  const updatedExpenses = updateOperationalExpenseInState(INITIAL_EXPENSES, {
    ...targetExp,
    description: '15L Nafta Súper YPF + Aceite Stihl',
    amount: 24500,
  });
  assert.equal(updatedExpenses[0].amount, 24500);
  assert.equal(
    updatedExpenses[0].description,
    '15L Nafta Súper YPF + Aceite Stihl'
  );

  // Equipment edit
  const targetEq = INITIAL_EQUIPMENT[0];
  const updatedEq = updateEquipmentItemInState(INITIAL_EQUIPMENT, {
    ...targetEq,
    name: 'Tractor Husqvarna TS 142T',
    hoursUsed: 12.5,
    serviceLimitHours: 40,
  });
  assert.equal(updatedEq[0].name, 'Tractor Husqvarna TS 142T');
  assert.equal(updatedEq[0].hoursUsed, 12.5);
  assert.equal(updatedEq[0].serviceLimitHours, 40);

  // Custom business rates in calculateSuggestedPrice
  const defaultQuote = calculateSuggestedPrice(500, 'Casa', 'Quincenal');
  const higherRateQuote = calculateSuggestedPrice(
    500,
    'Casa',
    'Quincenal',
    0,
    'Regular',
    true,
    { baseRatePerSqm: 100, minServicePrice: 25000 }
  );
  assert.ok(higherRateQuote.suggestedPrice > defaultQuote.suggestedPrice);
});

test('sanitizeText, buildSafeWhatsAppUrl, and sanitizeAndValidateBackupPayload enforce security and data integrity', () => {
  assert.equal(
    sanitizeText('<script>alert(1)</script>Cortes El Trébol\u0000'),
    'alert(1)Cortes El Trébol'
  );

  const waUrl = buildSafeWhatsAppUrl('+54 9 (3462) 55-1234', 'Hola cliente!');
  assert.equal(waUrl, 'https://wa.me/5493462551234?text=Hola%20cliente!');

  assert.equal(sanitizeAndValidateBackupPayload(null), null);
  assert.equal(sanitizeAndValidateBackupPayload([]), null);

  const sanitized = sanitizeAndValidateBackupPayload({
    businessProfile: {
      appName: '<b>Mi Emprendimiento</b>',
      baseRatePerSqm: -50,
      minServicePrice: 18500,
    },
    invoices: [
      {
        id: 'inv-1',
        clientName: 'Carlos',
        address: 'Mitre 400',
        amount: -999,
        photoUrl: 'javascript:alert(1)',
      },
    ],
  });

  assert.ok(sanitized);
  assert.equal(sanitized?.businessProfile?.appName, 'Mi Emprendimiento');
  assert.equal(sanitized?.businessProfile?.baseRatePerSqm, 1);
  assert.equal(sanitized?.invoices?.[0].amount, 500);
  assert.equal(sanitized?.invoices?.[0].photoUrl, undefined);
});

test('formatStopwatchSeconds and getClientCutTimeHistory compute real mowing durations, averages, and hourly productivity', () => {
  assert.equal(formatStopwatchSeconds(0), '00:00');
  assert.equal(formatStopwatchSeconds(95), '01:35');
  assert.equal(formatStopwatchSeconds(3665), '01:01:05');

  const pendingJob = INITIAL_TODAY_JOBS[2];
  const { updatedJob, invoice } = completeJobAndCreateInvoice(
    pendingJob,
    true,
    'Transferencia',
    '2026-11-01',
    25,
    undefined,
    42
  );
  assert.equal(updatedJob.actualDurationMinutes, 42);
  assert.equal(invoice.actualDurationMinutes, 42);

  const summary = getClientCutTimeHistory(
    pendingJob.propertyId,
    pendingJob.clientName,
    [invoice, ...INITIAL_INVOICES],
    [updatedJob, ...INITIAL_TODAY_JOBS],
    pendingJob.estimatedMinutes,
    pendingJob.areaSqm
  );
  assert.ok(summary.totalTimedCuts >= 1);
  assert.equal(summary.lastDurationMinutes, 42);
  assert.ok(summary.averageMinutes !== null && summary.averageMinutes > 0);
  assert.ok(summary.avgSqmPerHour !== null && summary.avgSqmPerHour > 0);
  assert.ok(summary.avgRevenuePerHour !== null && summary.avgRevenuePerHour > 0);
});

test('hasValidCustomMercadoPagoLink and normalizeTenantLicenseConfig prevent broken placeholder mpago.la links', () => {
  assert.equal(
    hasValidCustomMercadoPagoLink('https://mpago.la/2xPastoProLicenciaUnica'),
    false
  );
  assert.equal(
    hasValidCustomMercadoPagoLink('https://www.mercadopago.com.ar/home'),
    false
  );
  assert.equal(
    hasValidCustomMercadoPagoLink('https://mpago.la/1a2b3cRealLink'),
    true
  );

  const normalized = normalizeTenantLicenseConfig({
    mpCheckoutUrl: 'https://mpago.la/2xPastoProLicenciaUnica',
  });
  assert.equal(normalized.mpCheckoutUrl, '');
  assert.equal(normalized.sellerAlias, 'pastopro.licencia.mp');
  assert.equal(normalized.sellerCbu, '0000003100084920114502');
});

