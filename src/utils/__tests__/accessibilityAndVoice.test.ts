import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSpokenPesos,
  formatSpokenTime,
  buildJobCardSpeech,
  buildDailySummarySpeech,
  buildClientSpeech,
  buildFinanceSummarySpeech,
  buildReceiptSpeech,
  VISUAL_TASK_PRESETS,
  VISUAL_EXPENSE_PRESETS,
  DEFAULT_ACCESSIBILITY_SETTINGS,
} from '../accessibilityAndVoice';
import { ClientProperty, InvoiceRecord, ScheduledJob } from '../../types/lawn';

describe('accessibilityAndVoice pure logic', () => {
  it('formats spoken Argentine pesos clearly without dot-decimal misreading', () => {
    assert.equal(formatSpokenPesos(0), 'cero pesos');
    assert.equal(formatSpokenPesos(38000), '38 mil pesos');
    assert.equal(formatSpokenPesos(15000), '15 mil pesos');
    assert.equal(formatSpokenPesos(12500), '12500 pesos');
  });

  it('formats 24h time strings into natural spoken Argentine Spanish', () => {
    assert.equal(formatSpokenTime('08:00'), '8 en punto de la mañana');
    assert.equal(formatSpokenTime('09:30'), '9 y 30 de la mañana');
    assert.equal(formatSpokenTime('14:15'), '2 y 15 de la tarde');
    assert.equal(formatSpokenTime('21:00'), '9 en punto de la noche');
  });

  it('builds a complete spoken summary for a scheduled job card', () => {
    const sampleJob: ScheduledJob = {
      id: 'job-1',
      propertyId: 'prop-1',
      clientName: 'Familia Rossi',
      phone: '+5493462551122',
      address: 'Av. Casey 450',
      neighborhood: 'Centro',
      propertyType: 'Casa',
      areaSqm: 320,
      frequency: 'Quincenal',
      scheduledDate: '2026-11-01',
      scheduledTime: '08:30',
      orderIndex: 1,
      estimatedMinutes: 60,
      price: 28000,
      status: 'Pendiente',
      tasks: ['Corte general de pasto', 'Bordeado de vereda'],
      accessNotes: 'Portón negro al costado',
      coordinates: { lat: -33.745, lng: -61.968 },
    };

    const speech = buildJobCardSpeech(sampleJob, 1);
    assert.ok(speech.includes('Parada número 1.'));
    assert.ok(speech.includes('Trabajo pendiente por hacer.'));
    assert.ok(speech.includes('Familia Rossi'));
    assert.ok(speech.includes('Av. Casey 450'));
    assert.ok(speech.includes('8 y 30 de la mañana'));
    assert.ok(speech.includes('28 mil pesos'));
    assert.ok(speech.includes('Portón negro al costado'));
  });

  it('builds a daily route summary speech for empty and populated routes', () => {
    const emptySpeech = buildDailySummarySpeech([], 'Venado Tuerto');
    assert.ok(emptySpeech.includes('Hoy no tenés ningún corte anotado'));

    const jobs: ScheduledJob[] = [
      {
        id: 'job-1',
        propertyId: 'prop-1',
        clientName: 'Marta Gómez',
        phone: '+5493462445566',
        address: 'Belgrano 820',
        neighborhood: 'Centro',
        propertyType: 'Casa',
        areaSqm: 250,
        frequency: 'Quincenal',
        scheduledDate: '2026-11-01',
        scheduledTime: '09:00',
        orderIndex: 1,
        estimatedMinutes: 60,
        price: 25000,
        status: 'Completado',
        tasks: ['Corte general'],
        accessNotes: '',
        coordinates: { lat: -33.746, lng: -61.965 },
      },
      {
        id: 'job-2',
        propertyId: 'prop-2',
        clientName: 'Club Jorge Newbery',
        phone: '+5493462449900',
        address: 'Av. Santa Fe 1400',
        neighborhood: 'San Vicente',
        propertyType: 'Quinta',
        areaSqm: 900,
        frequency: 'Semanal',
        scheduledDate: '2026-11-01',
        scheduledTime: '10:30',
        orderIndex: 2,
        estimatedMinutes: 90,
        price: 45000,
        status: 'Pendiente',
        tasks: ['Corte tractor'],
        accessNotes: '',
        coordinates: { lat: -33.75, lng: -61.95 },
      },
    ];

    const summary = buildDailySummarySpeech(jobs, 'Venado Tuerto');
    assert.ok(summary.includes('2 cortes anotados'));
    assert.ok(summary.includes('70 mil pesos'));
    assert.ok(summary.includes('Ya terminaste 1 y te quedan 1 por hacer'));
    assert.ok(summary.includes('Club Jorge Newbery'));
  });

  it('builds client, finance, and receipt spoken texts accurately', () => {
    const client: ClientProperty = {
      id: 'prop-1',
      clientName: 'Carlos Alvear',
      phone: '3462555111',
      address: 'Mitre 720',
      neighborhood: 'Centro',
      propertyType: 'Quinta',
      areaSqm: 350,
      grassCondition: 'Regular',
      frequency: 'Quincenal',
      basePrice: 30000,
      defaultTasks: ['Corte de pasto'],
      lastCutDate: '2026-10-18',
      nextCutDate: '2026-11-01',
      estimatedMinutes: 55,
      accessNotes: 'Cuidado con el perro ovejero',
      coordinates: { lat: -33.745, lng: -61.96 },
      active: true,
    };

    const clientSpeech = buildClientSpeech(client, 15000);
    assert.ok(clientSpeech.includes('Carlos Alvear'));
    assert.ok(clientSpeech.includes('30 mil pesos'));
    assert.ok(clientSpeech.includes('deuda sin pagar de 15 mil pesos'));

    const financeSpeech = buildFinanceSummarySpeech({
      collected: 120000,
      expenses: 20000,
      netProfit: 100000,
      pendingDebt: 15000,
      completedCount: 4,
    });
    assert.ok(financeSpeech.includes('4 cortes cobrados'));
    assert.ok(financeSpeech.includes('100 mil pesos'));

    const invoice: InvoiceRecord = {
      id: 'inv-1',
      invoiceNumber: 'REC-001',
      jobId: 'job-1',
      propertyId: 'prop-1',
      clientName: 'Carlos Alvear',
      phone: '3462555111',
      address: 'Mitre 720',
      propertyType: 'Quinta',
      areaSqm: 350,
      date: '2026-11-01',
      amount: 30000,
      status: 'Pagado',
      paymentMethod: 'Efectivo',
      tasksCompleted: ['Corte general'],
      nextScheduledDate: '2026-11-15',
    };
    const receiptSpeech = buildReceiptSpeech(invoice);
    assert.ok(receiptSpeech.includes('30 mil pesos'));
    assert.ok(receiptSpeech.includes('Efectivo'));
  });

  it('provides complete pictographic presets for tasks and expenses', () => {
    assert.equal(VISUAL_TASK_PRESETS.length, 6);
    assert.equal(VISUAL_EXPENSE_PRESETS.length, 5);
    assert.equal(DEFAULT_ACCESSIBILITY_SETTINGS.easyMode, false);
  });
});
