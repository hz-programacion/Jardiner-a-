import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activateTenantSingleLicense,
  buildMercadoPagoSinglePaymentUrl,
  createBlankTenantWorkspace,
  createInitialSubscriptionConfig,
  evaluateSubscriptionStatus,
  getTenantStorageKey,
} from '../saasLogic';
import { calculateSuggestedPrice } from '../lawnLogic';

test('getTenantStorageKey isolates each authenticated user into their own storage key', () => {
  const keyUserA = getTenantStorageKey('user_rosario_123', false);
  const keyUserB = getTenantStorageKey('user_cordoba_456', false);
  const keyDemo = getTenantStorageKey(null, true);

  assert.notEqual(keyUserA, keyUserB);
  assert.notEqual(keyUserA, keyDemo);
  assert.equal(keyUserA, 'pastopro_tenant_v1_user_rosario_123');
  assert.equal(keyDemo, 'pastopro_demo_workspace_v2');
});

test('createBlankTenantWorkspace creates a 100% clean workspace without Diego or Venado Tuerto data', () => {
  const workspace = createBlankTenantWorkspace({
    uid: 'uid_gardener_rosario',
    email: 'lucas@parquesrosario.com.ar',
    displayName: 'Lucas Fernández',
    businessName: 'Parques Rosario Sur',
    cityPresetKey: 'Rosario, Santa Fe',
    nowIso: '2026-11-01T10:00:00Z',
  });

  // Must start with zero clients, jobs, invoices, and expenses from any other user
  assert.equal(workspace.properties.length, 0);
  assert.equal(workspace.todayJobs.length, 0);
  assert.equal(workspace.invoices.length, 0);
  assert.equal(workspace.expenses.length, 0);

  // Must reflect the new user's identity & city
  assert.equal(workspace.businessProfile.appName, 'Parques Rosario Sur');
  assert.equal(workspace.businessProfile.ownerName, 'Lucas Fernández');
  assert.equal(workspace.businessProfile.onboardingCompleted, false);
  assert.equal(workspace.baseLocation.city, 'Rosario, Santa Fe');
  assert.equal(workspace.paymentProfile.holderName, 'Lucas Fernández');
  assert.equal(workspace.paymentProfile.cbu, '');
  assert.notEqual(workspace.paymentProfile.alias, 'pastopro.venado');

  // Must start on a 14-day evaluation before activating one-time license
  assert.equal(workspace.subscription.planId, 'evaluation');
  assert.equal(workspace.subscription.status, 'trialing');
  assert.equal(workspace.subscription.trialEndsAt, '2026-11-15');
});

test('evaluateSubscriptionStatus and activateTenantSingleLicense manage One-Time Payment License lifecycle', () => {
  const initialSub = createInitialSubscriptionConfig('2026-11-01T12:00:00Z');
  const trialStatus = evaluateSubscriptionStatus(initialSub, '2026-11-05');

  assert.equal(trialStatus.status, 'trialing');
  assert.equal(trialStatus.daysRemaining, 10);
  assert.equal(trialStatus.isProActive, false);

  const expiredStatus = evaluateSubscriptionStatus(initialSub, '2026-11-20');
  assert.equal(expiredStatus.status, 'expired');
  assert.equal(expiredStatus.daysRemaining, 0);

  const activatedSub = activateTenantSingleLicense(
    initialSub,
    'Mercado Pago Pago Único',
    'MP-998877',
    '2026-11-05'
  );
  const activeStatus = evaluateSubscriptionStatus(activatedSub, '2026-11-10');
  assert.equal(activeStatus.status, 'active');
  assert.equal(activeStatus.isProActive, true);
  assert.equal(activatedSub.planId, 'single_payment_license');
  assert.equal(activatedSub.licenseKey, 'MP-998877');
  assert.equal(activatedSub.paymentHistory.length, 1);
  assert.equal(activatedSub.paymentHistory[0].referenceCode, 'MP-998877');

  const mpUrl = buildMercadoPagoSinglePaymentUrl(
    activatedSub,
    'lucas@parquesrosario.com.ar'
  );
  assert.ok(mpUrl.includes('mpago.la/'));
  assert.ok(mpUrl.includes('payer_email='));
});

test('calculateSuggestedPrice respects tenant white-label base pricing and surcharges', () => {
  const defaultQuote = calculateSuggestedPrice(
    400,
    'Casa',
    'Quincenal',
    0,
    'Alto',
    true,
    {
      baseRatePerSqm: 50,
      minServicePrice: 12000,
      tallGrassSurchargePct: 20,
      baggingSurchargePct: 10,
    }
  );

  const premiumTenantQuote = calculateSuggestedPrice(
    400,
    'Casa',
    'Quincenal',
    0,
    'Alto',
    true,
    {
      baseRatePerSqm: 100,
      minServicePrice: 25000,
      tallGrassSurchargePct: 40,
      baggingSurchargePct: 20,
    }
  );

  assert.ok(premiumTenantQuote.suggestedPrice > defaultQuote.suggestedPrice);
  assert.equal(defaultQuote.suggestedPrice, 26000);
  assert.equal(premiumTenantQuote.suggestedPrice, 64000);
});
