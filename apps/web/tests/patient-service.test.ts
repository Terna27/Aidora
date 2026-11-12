import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { patientService } from '../src/services/patientService';

describe('Aidline Web — Patient Service & Safety Suite', () => {
  beforeEach(() => {
    patientService.resetToFixtures();
  });

  test('1. Patient profile loads with emergency contacts and clinical summary', () => {
    const profile = patientService.getProfile();
    assert.strictEqual(profile.fullName, 'Amina Bello');
    assert.strictEqual(profile.bloodGroup, 'O+');
    assert.strictEqual(profile.gestationalAgeWeeks, 34);
    assert.strictEqual(profile.emergencyContacts.length, 2);
  });

  test('2. Triggering SOS enters DISPATCHING state with audit milestones', async () => {
    const res = await patientService.triggerSOS({
      chiefComplaint: 'Acute Prenatal Contractions',
      location: {
        address: 'Plot 44, Garki Area 2',
        landmark: 'Near Police Post',
        type: 'MANUAL',
      },
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.emergency);
    assert.strictEqual(res.emergency.state, 'DISPATCHING');
    assert.strictEqual(res.emergency.location.coords, undefined, 'Manual location must not fabricate coords');
    assert.strictEqual(res.emergency.milestones.length, 2);
  });

  test('3. Rejects duplicate SOS when an active emergency is already in progress', async () => {
    await patientService.triggerSOS({
      chiefComplaint: 'Acute Prenatal Contractions',
      location: { address: 'Test Location', type: 'MANUAL' },
    });

    const second = await patientService.triggerSOS({
      chiefComplaint: 'Second call',
      location: { address: 'Test Location', type: 'MANUAL' },
    });

    assert.strictEqual(second.success, false);
    assert.match(second.error || '', /ACTIVE_EMERGENCY_EXISTS/);
  });

  test('4. Rejects SOS when location address is missing', async () => {
    const res = await patientService.triggerSOS({
      chiefComplaint: 'Emergency without location',
      location: { address: '  ', type: 'MANUAL' },
    });

    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /MISSING_LOCATION/);
  });

  test('5. Full sequential journey progresses through all 14 milestone states to COMPLETED', async () => {
    await patientService.triggerSOS({
      chiefComplaint: 'Pregnancy labor',
      location: { address: 'Garki 2', type: 'MANUAL' },
    });

    // Advance to ACCEPTED
    let res = await patientService.advanceState('ACCEPTED');
    assert.strictEqual(res.emergency?.state, 'ACCEPTED');
    assert.ok(res.emergency?.assignedResponderName);

    // Advance to PICKUP_ARRIVED
    res = await patientService.advanceState('PICKUP_ARRIVED');
    assert.strictEqual(res.emergency?.state, 'PICKUP_ARRIVED');

    // Advance to PATIENT_ONBOARD
    res = await patientService.advanceState('PATIENT_ONBOARD');
    assert.strictEqual(res.emergency?.state, 'PATIENT_ONBOARD');

    // Advance to IN_TRANSIT
    res = await patientService.advanceState('IN_TRANSIT');
    assert.strictEqual(res.emergency?.state, 'IN_TRANSIT');

    // Advance to ARRIVED
    res = await patientService.advanceState('ARRIVED');
    assert.strictEqual(res.emergency?.state, 'ARRIVED');

    // Advance to COMPLETED
    res = await patientService.advanceState('COMPLETED');
    assert.strictEqual(patientService.getActiveEmergency(), null, 'Active emergency clears after completion');

    // History should now have the completed emergency
    const history = patientService.getHistory();
    assert.strictEqual(history[0].state, 'COMPLETED');
  });

  test('6. Emergency cancellation is permitted before patient is onboard', async () => {
    await patientService.triggerSOS({
      chiefComplaint: 'False alarm test',
      location: { address: 'Wuse 2', type: 'MANUAL' },
    });

    const res = await patientService.cancelEmergency('False alarm');
    assert.strictEqual(res.success, true);
    assert.strictEqual(patientService.getActiveEmergency(), null);
  });

  test('7. Emergency cancellation is forbidden once patient is onboard', async () => {
    await patientService.triggerSOS({
      chiefComplaint: 'Labor contractions',
      location: { address: 'Wuse 2', type: 'MANUAL' },
    });

    await patientService.advanceState('ACCEPTED');
    await patientService.advanceState('PICKUP_ARRIVED');
    await patientService.advanceState('PATIENT_ONBOARD');

    const res = await patientService.cancelEmergency('Attempted cancel');
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /CANCELLATION_FORBIDDEN/);
  });

  test('8. Emergency contacts can be added and removed', () => {
    const contact = patientService.addContact({
      name: 'Dr. Musa',
      relationship: 'Doctor',
      phone: '+234 800 123 9999',
    });

    assert.ok(contact.id);
    let profile = patientService.getProfile();
    assert.strictEqual(profile.emergencyContacts.length, 3);

    const removed = patientService.removeContact(contact.id);
    assert.strictEqual(removed, true);
    profile = patientService.getProfile();
    assert.strictEqual(profile.emergencyContacts.length, 2);
  });
});
