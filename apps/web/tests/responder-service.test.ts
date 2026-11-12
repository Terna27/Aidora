import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { responderService } from '../src/services/responderService';

describe('Aidline Web — Responder Service & Verification Suite', () => {
  beforeEach(() => {
    responderService.resetToFixtures();
  });

  test('1. Responder loads with verified motorcycle profile', () => {
    const profile = responderService.getProfile();
    assert.strictEqual(profile.fullName, 'Chidi Okafor');
    assert.strictEqual(profile.vehicleType, 'MOTORCYCLE');
    assert.strictEqual(profile.verificationStatus, 'VERIFIED');
    assert.strictEqual(profile.availability, 'ONLINE');
  });

  test('2. Only VERIFIED responders can go online; PENDING/UNVERIFIED/SUSPENDED are blocked', () => {
    responderService.setVerificationStatus('PENDING');
    let res = responderService.setAvailability('ONLINE');
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /VERIFICATION_REQUIRED/);

    responderService.setVerificationStatus('SUSPENDED');
    res = responderService.setAvailability('ONLINE');
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /VERIFICATION_REQUIRED/);

    responderService.setVerificationStatus('VERIFIED');
    res = responderService.setAvailability('ONLINE');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.availability, 'ONLINE');
  });

  test('3. Verified responder can toggle smoothly between ONLINE and OFFLINE', () => {
    let res = responderService.setAvailability('OFFLINE');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.availability, 'OFFLINE');

    res = responderService.setAvailability('ONLINE');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.availability, 'ONLINE');
  });

  test('4. Accepting an incoming offer transitions emergency to ACCEPTED and locks journey', () => {
    const offer = responderService.getPendingOffer();
    assert.ok(offer);

    const res = responderService.acceptOffer();
    assert.strictEqual(res.success, true);
    assert.ok(res.journey);
    assert.strictEqual(res.journey.state, 'ACCEPTED');

    // Pending offer is now consumed
    assert.strictEqual(responderService.getPendingOffer(), null);
    assert.strictEqual(responderService.getActiveJourney()?.emergencyId, offer.emergencyId);
  });

  test('5. Declining an offer clears pending offer', () => {
    const res = responderService.declineOffer();
    assert.strictEqual(res.success, true);
    assert.strictEqual(responderService.getPendingOffer(), null);
  });

  test('6. Sequential milestones progress strictly: ACCEPTED → PICKUP_ARRIVED → PATIENT_ONBOARD → IN_TRANSIT → ARRIVED → COMPLETED', () => {
    responderService.acceptOffer();

    // 1. PICKUP_ARRIVED
    let res = responderService.advanceMilestone('PICKUP_ARRIVED');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.journey?.state, 'PICKUP_ARRIVED');

    // 2. PATIENT_ONBOARD
    res = responderService.advanceMilestone('PATIENT_ONBOARD');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.journey?.state, 'PATIENT_ONBOARD');

    // 3. IN_TRANSIT
    res = responderService.advanceMilestone('IN_TRANSIT');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.journey?.state, 'IN_TRANSIT');

    // 4. ARRIVED
    res = responderService.advanceMilestone('ARRIVED');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.journey?.state, 'ARRIVED');

    // 5. Handover requires arrival confirmation
    const handover = responderService.completeHandover('General Hospital Apex', 'Nurse Fatima');
    assert.strictEqual(handover.success, true);
    assert.strictEqual(responderService.getActiveJourney(), null);

    // Completed journey count increments
    assert.strictEqual(responderService.getProfile().completedJourneys, 43);
  });

  test('7. Rejects invalid milestone jump (e.g. ACCEPTED directly to IN_TRANSIT)', () => {
    responderService.acceptOffer();

    const res = responderService.advanceMilestone('IN_TRANSIT');
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /INVALID_TRANSITION/);
  });
});
