import assert from 'node:assert/strict';
import { test, describe, beforeEach } from 'node:test';

import { MockAuthService } from '../src/services/mock/mockAuthService.ts';
import { MockEmergencyService } from '../src/services/mock/mockEmergencyService.ts';
import { LocationService, IGpsProvider } from '../src/services/location/locationService.ts';
import { EMERGENCY_STATE_METADATA } from '../src/types/emergency.ts';

describe('RideRoute Patient Mobile Journey — Quality Audit & Regression Suite', () => {
  let authService: MockAuthService;
  let emergencyService: MockEmergencyService;
  let locationService: LocationService;
  let patientId: string;

  beforeEach(() => {
    authService = new MockAuthService();
    emergencyService = new MockEmergencyService();
    locationService = new LocationService();
  });

  // 1. Patient Registration (Success)
  test('1. Patient registers successfully with valid details and emergency contact', async () => {
    const res = await authService.register({
      fullName: 'Aisha Garba',
      phoneNumber: '08023456789',
      communityOrVillage: 'Nyanya Gwandara',
      emergencyContactName: 'Musa Garba',
      emergencyContactPhone: '08099887766',
      emergencyContactRelationship: 'Husband',
      password: 'password123',
    });

    assert.ok(res.patient.id);
    assert.equal(res.patient.fullName, 'Aisha Garba');
    assert.equal(res.patient.phoneNumber, '08023456789');
    assert.equal(res.patient.emergencyContacts.length, 1);
    assert.equal(res.patient.emergencyContacts[0].name, 'Musa Garba');
    assert.ok(res.token);

    patientId = res.patient.id;
  });

  // 2. Patient Registration Validation
  test('2. Registration fails with typed errors on invalid name or phone', async () => {
    await assert.rejects(
      async () => {
        await authService.register({ fullName: 'A', phoneNumber: '08012345678' });
      },
      (err: any) => {
        assert.equal(err.code, 'INVALID_NAME');
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await authService.register({ fullName: 'Aisha Garba', phoneNumber: '123' });
      },
      (err: any) => {
        assert.equal(err.code, 'INVALID_PHONE');
        return true;
      }
    );
  });

  // 3. Patient Login & Demo Fast-Track
  test('3. Patient logs in successfully via phone and one-tap demo account', async () => {
    const regularLogin = await authService.login({ phoneNumber: '08023456789' });
    assert.ok(regularLogin.patient);
    assert.equal(regularLogin.patient.phoneNumber, '08023456789');

    const demoLogin = await authService.loginAsDemo();
    assert.ok(demoLogin.patient);
    assert.equal(demoLogin.patient.fullName, 'Fatima Bello');
    assert.equal(demoLogin.patient.phoneNumber, '08012345678');
  });

  // 4. Dashboard State & Unauthenticated Cold Start
  test('4. Dashboard checks profile and confirms no active emergency initially', async () => {
    await authService.loginAsDemo();
    const profile = await authService.getProfile();
    assert.ok(profile);

    const activeEmergency = await emergencyService.getActiveEmergency(profile.id);
    assert.equal(activeEmergency, null, 'No emergency should be active initially');
  });

  // 5. GPS Acquisition (Permission Granted)
  test('5. Location permission granted acquires position with accuracy calculation', async () => {
    const mockGpsProviderGranted: IGpsProvider = {
      requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
      hasServicesEnabledAsync: async () => true,
      getCurrentPositionAsync: async () => ({
        coords: {
          latitude: 9.0765,
          longitude: 7.3986,
          accuracy: 12,
        },
      }),
      reverseGeocodeAsync: async () => [{ city: 'Abuja', district: 'Karu', subregion: 'FCT' }],
    };

    locationService.setProvider(mockGpsProviderGranted);
    const result = await locationService.acquireGpsLocation();

    assert.equal(result.success, true);
    assert.ok(result.location);
    assert.equal(result.location.source, 'GPS');
    assert.equal(result.location.accuracyLevel, 'HIGH');
    assert.equal(result.location.coords?.latitude, 9.0765);
    assert.equal(result.location.coords?.longitude, 7.3986);
  });

  // 6. GPS Acquisition (Permission Denied)
  test('6. Location permission denied returns structured error prompting manual entry', async () => {
    const mockGpsProviderDenied: IGpsProvider = {
      requestForegroundPermissionsAsync: async () => ({ status: 'denied' }),
      hasServicesEnabledAsync: async () => true,
      getCurrentPositionAsync: async () => { throw new Error('Permission denied'); },
    };

    locationService.setProvider(mockGpsProviderDenied);
    const result = await locationService.acquireGpsLocation();

    assert.equal(result.success, false);
    assert.equal(result.error?.code, 'PERMISSION_DENIED');
  });

  // 7. GPS Hardware Disabled
  test('7. GPS hardware turned off returns LOCATION_UNAVAILABLE', async () => {
    const mockGpsProviderDisabled: IGpsProvider = {
      requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
      hasServicesEnabledAsync: async () => false,
      getCurrentPositionAsync: async () => { throw new Error('Location disabled'); },
    };

    locationService.setProvider(mockGpsProviderDisabled);
    const result = await locationService.acquireGpsLocation();

    assert.equal(result.success, false);
    assert.equal(result.error?.code, 'LOCATION_UNAVAILABLE');
  });

  // 8. GPS Timeout Handling
  test('8. GPS satellite search timeout (exceeding limit) returns TIMEOUT code safely', async () => {
    const mockGpsProviderHanging: IGpsProvider = {
      requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
      hasServicesEnabledAsync: async () => true,
      getCurrentPositionAsync: () => new Promise(() => {}), // Never resolves (simulating dead GPS in tunnel)
    };

    locationService.setProvider(mockGpsProviderHanging);
    // Test with 50ms timeout
    const result = await locationService.acquireGpsLocation(50);

    assert.equal(result.success, false);
    assert.equal(result.error?.code, 'TIMEOUT');
    assert.ok(result.error?.message.includes('timed out'));
  });

  // 9. Manual Village / Landmark Entry (Zero Fabricated Coordinates)
  test('9. Manual location entry strictly leaves coords undefined and formats correctly', () => {
    const manualLoc = locationService.createManualLocation(
      'Karu Village',
      'Opposite Central Mosque Water Pump',
      'Street 4',
      'Near blue gate'
    );

    assert.equal(manualLoc.source, 'MANUAL');
    assert.equal(manualLoc.coords, undefined, 'Coordinates MUST remain undefined');
    assert.equal(manualLoc.accuracyLevel, 'APPROXIMATE');
    assert.equal(manualLoc.villageCommunity, 'Karu Village');
    assert.equal(manualLoc.landmark, 'Opposite Central Mosque Water Pump');

    const formatted = locationService.formatLocation(manualLoc);
    assert.ok(formatted.includes('Karu Village'));
    assert.ok(formatted.includes('Near: Opposite Central Mosque Water Pump'));
    assert.ok(!formatted.includes('GPS:'), 'Must not display fake GPS coordinates');
  });

  // 10. Emergency Submission (Starts at CREATED -> DISPATCHING)
  test('10. Emergency submission moves from CREATED to DISPATCHING with audit history', async () => {
    const loc = locationService.createManualLocation('Nyanya Phase 2', 'Near Primary School');
    const em = await emergencyService.submitEmergency('pat-1001', 'Fatima Bello', '08012345678', loc);

    assert.ok(em.id);
    assert.equal(em.status, 'DISPATCHING');
    assert.equal(em.history[0].state, 'CREATED');
    assert.equal(em.history[1].state, 'DISPATCHING');
  });

  // 11. Prevent Duplicate Emergency Submissions
  test('11. Submitting a second SOS while one is active throws ACTIVE_EMERGENCY_EXISTS', async () => {
    const loc = locationService.createManualLocation('Nyanya Phase 2', 'Near Primary School');
    await emergencyService.submitEmergency('pat-1001', 'Fatima Bello', '08012345678', loc);

    // Attempt second submission
    await assert.rejects(
      async () => {
        await emergencyService.submitEmergency('pat-1001', 'Fatima Bello', '08012345678', loc);
      },
      (err: any) => {
        assert.equal(err.code, 'ACTIVE_EMERGENCY_EXISTS');
        assert.equal(err.statusCode, 409);
        return true;
      }
    );
  });

  // 12. Missing Location Validation
  test('12. Submitting with empty location details fails with MISSING_LOCATION', async () => {
    const emptyLoc = locationService.createManualLocation('', '');
    await assert.rejects(
      async () => {
        await emergencyService.submitEmergency('pat-999', 'Test Patient', '08012345678', emptyLoc);
      },
      (err: any) => {
        assert.equal(err.code, 'MISSING_LOCATION');
        return true;
      }
    );
  });

  // 13. Network Failure & Retry
  test('13. Network failure during SOS submission throws NETWORK_TIMEOUT and allows retry', async () => {
    emergencyService.setSimulateFailureNext(true);
    const loc = locationService.createManualLocation('Test Village', 'Test Landmark');

    await assert.rejects(
      async () => {
        await emergencyService.submitEmergency('pat-999', 'Test Patient', '08012345678', loc);
      },
      (err: any) => {
        assert.equal(err.code, 'NETWORK_TIMEOUT');
        return true;
      }
    );

    // Immediate retry should succeed
    const retry = await emergencyService.submitEmergency('pat-999', 'Test Patient', '08012345678', loc);
    assert.equal(retry.status, 'DISPATCHING');
  });

  // 14. Complete State Lifecycle (CREATED -> COMPLETED)
  test('14. Full journey progresses through all milestones to COMPLETED', async () => {
    const loc = locationService.createManualLocation('Nyanya Phase 2', 'Near Primary School');
    const em = await emergencyService.submitEmergency('pat-1001', 'Fatima Bello', '08012345678', loc);

    // DISPATCHING -> ACCEPTED
    let updated = await emergencyService.simulateNextState(em.id);
    assert.equal(updated.status, 'ACCEPTED');
    assert.ok(updated.assignedResponder, 'Responder must be assigned upon acceptance');

    // ACCEPTED -> PICKUP_ARRIVED
    updated = await emergencyService.simulateNextState(em.id);
    assert.equal(updated.status, 'PICKUP_ARRIVED');

    // PICKUP_ARRIVED -> PATIENT_ONBOARD
    updated = await emergencyService.simulateNextState(em.id);
    assert.equal(updated.status, 'PATIENT_ONBOARD');

    // PATIENT_ONBOARD -> HOSPITAL_SELECTED
    updated = await emergencyService.simulateNextState(em.id);
    assert.equal(updated.status, 'HOSPITAL_SELECTED');
    assert.ok(updated.destinationFacility, 'Destination facility must be selected');

    // HOSPITAL_SELECTED -> IN_TRANSIT
    updated = await emergencyService.simulateNextState(em.id);
    assert.equal(updated.status, 'IN_TRANSIT');

    // IN_TRANSIT -> ARRIVED
    updated = await emergencyService.simulateNextState(em.id);
    assert.equal(updated.status, 'ARRIVED');

    // ARRIVED -> COMPLETED
    updated = await emergencyService.simulateNextState(em.id);
    assert.equal(updated.status, 'COMPLETED');

    // Emergency remains accessible until dismissed
    const active = await emergencyService.getActiveEmergency('pat-1001');
    assert.ok(active);
    assert.equal(active.status, 'COMPLETED');

    // Explicit dismissal archives and clears active
    await emergencyService.dismissEmergency(em.id);
    const afterDismiss = await emergencyService.getActiveEmergency('pat-1001');
    assert.equal(afterDismiss, null);
  });

  // 15. Responder Information Authorization
  test('15. Responder information is only displayed with transport details, not medical claims', async () => {
    const loc = locationService.createManualLocation('Nyanya Phase 2', 'Market');
    const em = await emergencyService.submitEmergency('pat-1001', 'Fatima Bello', '08012345678', loc);

    const accepted = await emergencyService.simulateNextState(em.id);
    const responder = accepted.assignedResponder;
    assert.ok(responder);
    assert.equal(responder.roleDescription, 'Verified Transportation Responder');
    assert.ok(['MOTORCYCLE', 'TAXI'].includes(responder.vehicleType));
    assert.ok(responder.licensePlate);
    assert.ok(responder.phoneNumber);
  });

  // 16. Cancellation Allowed in ACCEPTED
  test('16. Emergency cancellation is permitted before patient onboard', async () => {
    const loc = locationService.createManualLocation('Nyanya Phase 2', 'Market');
    const em = await emergencyService.submitEmergency('pat-1001', 'Fatima Bello', '08012345678', loc);
    await emergencyService.simulateNextState(em.id); // moves to ACCEPTED

    const cancelled = await emergencyService.cancelEmergency(em.id, 'Alternative family transport arranged');
    assert.equal(cancelled.status, 'CANCELLED');
    assert.equal(cancelled.cancellationReason, 'Alternative family transport arranged');
  });

  // 17. Cancellation Forbidden in PATIENT_ONBOARD / IN_TRANSIT
  test('17. Emergency cancellation is rejected with CANCELLATION_FORBIDDEN once patient is onboard', async () => {
    const loc = locationService.createManualLocation('Nyanya Phase 2', 'Market');
    const em = await emergencyService.submitEmergency('pat-1001', 'Fatima Bello', '08012345678', loc);
    await emergencyService.simulateNextState(em.id); // ACCEPTED
    await emergencyService.simulateNextState(em.id); // PICKUP_ARRIVED
    await emergencyService.simulateNextState(em.id); // PATIENT_ONBOARD

    await assert.rejects(
      async () => {
        await emergencyService.cancelEmergency(em.id, 'Trying to cancel in transit');
      },
      (err: any) => {
        assert.equal(err.code, 'CANCELLATION_FORBIDDEN');
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  // 18. Emergency History Review
  test('18. Emergency history retains completed and cancelled records with milestones', async () => {
    // Submit and complete one request
    const loc1 = locationService.createManualLocation('Nyanya Phase 2', 'Market');
    const em1 = await emergencyService.submitEmergency('pat-1001', 'Fatima Bello', '08012345678', loc1);
    await emergencyService.simulateNextState(em1.id); // ACCEPTED
    await emergencyService.simulateNextState(em1.id); // PICKUP_ARRIVED
    await emergencyService.simulateNextState(em1.id); // PATIENT_ONBOARD
    await emergencyService.simulateNextState(em1.id); // HOSPITAL_SELECTED
    await emergencyService.simulateNextState(em1.id); // IN_TRANSIT
    await emergencyService.simulateNextState(em1.id); // ARRIVED
    await emergencyService.simulateNextState(em1.id); // COMPLETED
    await emergencyService.dismissEmergency(em1.id);

    // Submit and cancel another request
    const loc2 = locationService.createManualLocation('Karu Zone 1', 'Clinic');
    const em2 = await emergencyService.submitEmergency('pat-1001', 'Fatima Bello', '08012345678', loc2);
    await emergencyService.cancelEmergency(em2.id, 'Ride cancelled by patient');

    const records = await emergencyService.getEmergencyHistory('pat-1001');
    assert.ok(records.length >= 2, 'History must contain at least 2 records');

    const completed = records.find((r) => r.status === 'COMPLETED');
    const cancelled = records.find((r) => r.status === 'CANCELLED');

    assert.ok(completed, 'History contains completed journey');
    assert.ok(cancelled, 'History contains cancelled journey');
    assert.ok(completed.destinationFacility, 'Completed journey has destination facility');
  });

  // 19. Emergency Contact Management (Add & Remove)
  test('19. Emergency contacts can be added and removed from patient profile', async () => {
    await authService.loginAsDemo();
    let profile = await authService.getProfile();
    const initialCount = profile?.emergencyContacts.length || 0;

    profile = await authService.addEmergencyContact({
      name: 'Dr. Danladi (Family Doctor)',
      phoneNumber: '08055556666',
      relationship: 'Doctor',
      isPrimary: false,
    });
    assert.equal(profile.emergencyContacts.length, initialCount + 1);

    const added = profile.emergencyContacts.find((c) => c.name === 'Dr. Danladi (Family Doctor)');
    assert.ok(added);

    profile = await authService.removeEmergencyContact(added.id);
    assert.equal(profile.emergencyContacts.length, initialCount);
  });

  // 20. Profile Updates
  test('20. Updating gestational age, blood group and medical notes persists', async () => {
    await authService.loginAsDemo();
    const updated = await authService.updateProfile({
      gestationalAgeWeeks: 36,
      bloodGroup: 'B+',
      allergiesOrNotes: 'Scheduled C-section candidate',
    });

    assert.equal(updated.gestationalAgeWeeks, 36);
    assert.equal(updated.bloodGroup, 'B+');
    assert.equal(updated.allergiesOrNotes, 'Scheduled C-section candidate');
  });
});
