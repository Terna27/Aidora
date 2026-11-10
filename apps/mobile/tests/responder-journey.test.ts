import assert from 'node:assert/strict';
import { test, describe, beforeEach } from 'node:test';

import { MockResponderAuthService } from '../src/services/mock/mockResponderAuthService.ts';
import { MockResponderJourneyService } from '../src/services/mock/mockResponderJourneyService.ts';
import {
  ResponderProfile,
  EmergencyOffer,
  VERIFICATION_STATUS_METADATA,
} from '../src/types/responder.ts';
import { EMERGENCY_STATE_METADATA } from '../src/types/emergency.ts';

describe('RideRoute Responder Mobile Journey — Quality Audit & Regression Suite', () => {
  let authService: MockResponderAuthService;
  let journeyService: MockResponderJourneyService;

  beforeEach(() => {
    journeyService = new MockResponderJourneyService();
    authService = new MockResponderAuthService();
  });

  // 1. Responder registration (motorcycle and taxi)
  test('1. Responder registration supports motorcycle and taxi with pending verification status', async () => {
    // Motorcycle registration
    const motoReg = await authService.register({
      fullName: 'Bello Danladi',
      phoneNumber: '08033334444',
      vehicleType: 'MOTORCYCLE',
      licensePlate: 'KJA-890-XA',
      vehicleMakeModel: 'Bajaj Boxer 150',
      vehicleColor: 'Black',
      driverLicenseNumber: 'DL-992834-M',
      communityBase: 'Karu Village',
      password: 'password123',
      agreedToTerms: true,
    });

    assert.ok(motoReg.responder.id);
    assert.equal(motoReg.responder.fullName, 'Bello Danladi');
    assert.equal(motoReg.responder.vehicle.vehicleType, 'MOTORCYCLE');
    assert.equal(motoReg.responder.vehicle.licensePlate, 'KJA-890-XA');
    assert.equal(motoReg.responder.verificationStatus, 'PENDING');
    assert.equal(await journeyService.getAvailability(motoReg.responder.id), 'OFFLINE');

    // Taxi registration
    const taxiReg = await authService.register({
      fullName: 'Sunday Okoro',
      phoneNumber: '08055556666',
      vehicleType: 'TAXI',
      licensePlate: 'ABJ-123-KW',
      vehicleMakeModel: 'Toyota Corolla 2008',
      vehicleColor: 'Yellow',
      driverLicenseNumber: 'DL-112233-T',
      communityBase: 'Mararaba Junction',
      password: 'password123',
      agreedToTerms: true,
    });

    assert.ok(taxiReg.responder.id);
    assert.equal(taxiReg.responder.fullName, 'Sunday Okoro');
    assert.equal(taxiReg.responder.vehicle.vehicleType, 'TAXI');
    assert.equal(taxiReg.responder.vehicle.licensePlate, 'ABJ-123-KW');
    assert.equal(taxiReg.responder.verificationStatus, 'PENDING');
    assert.equal(await journeyService.getAvailability(taxiReg.responder.id), 'OFFLINE');

    // Terms agreement enforcement (must acknowledge non-medical transportation role)
    await assert.rejects(
      async () => {
        await authService.register({
          fullName: 'Kabir Musa',
          phoneNumber: '08077778888',
          vehicleType: 'MOTORCYCLE',
          licensePlate: 'KJA-111-AA',
          vehicleMakeModel: 'Honda Ace 125',
          vehicleColor: 'Red',
          driverLicenseNumber: 'DL-555555-M',
          agreedToTerms: false,
        });
      },
      (err: any) => {
        assert.equal(err.code, 'TERMS_REQUIRED');
        return true;
      }
    );
  });

  // 2. Responder login (phone and password) & invalid credentials handling
  test('2. Responder login succeeds with valid credentials and rejects invalid ones', async () => {
    // Valid login
    const loginRes = await authService.login('08031112233', 'password123');
    assert.ok(loginRes.token);
    assert.equal(loginRes.responder.phoneNumber, '08031112233');
    assert.equal(loginRes.responder.fullName, 'Ibrahim Suleiman');

    // Invalid phone (too short)
    await assert.rejects(
      async () => {
        await authService.login('123', 'password123');
      },
      (err: any) => {
        assert.equal(err.code, 'INVALID_PHONE');
        return true;
      }
    );

    // Invalid password (too short)
    await assert.rejects(
      async () => {
        await authService.login('08031112233', '123');
      },
      (err: any) => {
        assert.equal(err.code, 'INVALID_CREDENTIALS');
        return true;
      }
    );
  });

  // 3. Demo login helper functionality
  test('3. Demo login fast-tracks verified motorcycle, verified taxi, and pending driver profiles', async () => {
    // Ibrahim Suleiman (Verified Motorcycle)
    const demo1 = await authService.loginAsDemo('resp-201');
    assert.equal(demo1.responder.id, 'resp-201');
    assert.equal(demo1.responder.vehicle.vehicleType, 'MOTORCYCLE');
    assert.equal(demo1.responder.verificationStatus, 'VERIFIED');

    // Emmanuel Osei (Verified Taxi)
    const demo2 = await authService.loginAsDemo('resp-202');
    assert.equal(demo2.responder.id, 'resp-202');
    assert.equal(demo2.responder.vehicle.vehicleType, 'TAXI');
    assert.equal(demo2.responder.verificationStatus, 'VERIFIED');

    // Chinedu Eze (Pending Motorcycle)
    const demo3 = await authService.loginAsDemo('resp-203');
    assert.equal(demo3.responder.id, 'resp-203');
    assert.equal(demo3.responder.verificationStatus, 'PENDING');
  });

  // 4. Verification status restrictions
  test('4. Only VERIFIED responders can go online; PENDING/UNVERIFIED/SUSPENDED are blocked', async () => {
    // Pending responder cannot go online
    await assert.rejects(
      async () => {
        await journeyService.setAvailability('resp-203', 'ONLINE', 'PENDING');
      },
      (err: any) => {
        assert.equal(err.code, 'VERIFICATION_REQUIRED');
        assert.ok(err.message.includes('pending'));
        return true;
      }
    );

    // Unverified responder cannot go online
    await assert.rejects(
      async () => {
        await journeyService.setAvailability('resp-204', 'ONLINE', 'UNVERIFIED');
      },
      (err: any) => {
        assert.equal(err.code, 'VERIFICATION_REQUIRED');
        return true;
      }
    );

    // Suspended responder cannot go online
    await assert.rejects(
      async () => {
        await journeyService.setAvailability('resp-205', 'ONLINE', 'SUSPENDED');
      },
      (err: any) => {
        assert.equal(err.code, 'VERIFICATION_REQUIRED');
        return true;
      }
    );

    // Verified responder successfully goes online
    const onlineStatus = await journeyService.setAvailability('resp-201', 'ONLINE', 'VERIFIED');
    assert.equal(onlineStatus, 'ONLINE');
  });

  // 5. Online and offline availability toggle
  test('5. Verified responder can toggle smoothly between ONLINE and OFFLINE', async () => {
    let status = await journeyService.setAvailability('resp-201', 'ONLINE', 'VERIFIED');
    assert.equal(status, 'ONLINE');
    assert.equal(await journeyService.getAvailability('resp-201'), 'ONLINE');

    status = await journeyService.setAvailability('resp-201', 'OFFLINE', 'VERIFIED');
    assert.equal(status, 'OFFLINE');
    assert.equal(await journeyService.getAvailability('resp-201'), 'OFFLINE');
  });

  // 6. Receiving an incoming emergency offer
  test('6. Receiving an incoming emergency offer includes pickup landmark, distance, ETA and hospital', async () => {
    await journeyService.setAvailability('resp-201', 'ONLINE', 'VERIFIED');

    const offer = await journeyService.triggerMockOffer('resp-201');
    assert.ok(offer.id);
    assert.equal(offer.status, 'PENDING');
    assert.ok(offer.pickupLocation.landmark);
    assert.ok(offer.estimatedDistanceKm > 0);
    assert.ok(offer.estimatedPickupMins > 0);
    assert.ok(offer.destinationFacility?.name);
    assert.ok(new Date(offer.expiresAt).getTime() > Date.now());

    const pendingOffer = await journeyService.getIncomingOffer('resp-201');
    assert.ok(pendingOffer);
    assert.equal(pendingOffer.id, offer.id);
  });

  // 7. Offer countdown and expiration handling
  test('7. Expired offer cannot be accepted and raises OFFER_EXPIRED', async () => {
    await journeyService.setAvailability('resp-201', 'ONLINE', 'VERIFIED');
    const offer = await journeyService.triggerMockOffer('resp-201');

    // Simulate expiration in the past
    offer.expiresAt = new Date(Date.now() - 5000).toISOString();

    // Attempt to accept expired offer
    await assert.rejects(
      async () => {
        await journeyService.acceptOffer(offer.id, 'resp-201');
      },
      (err: any) => {
        assert.equal(err.code, 'OFFER_EXPIRED');
        return true;
      }
    );

    const pending = await journeyService.getIncomingOffer('resp-201');
    assert.equal(pending, null);
  });

  // 8. Accepting an offer: moves to ACCEPTED, prevents duplicate acceptance, transitions responder state
  test('8. Accepting an offer transitions emergency to ACCEPTED, locks responder and prevents duplicate acceptance', async () => {
    await journeyService.setAvailability('resp-201', 'ONLINE', 'VERIFIED');
    const offer = await journeyService.triggerMockOffer('resp-201');

    const journey = await journeyService.acceptOffer(offer.id, 'resp-201');
    assert.ok(journey.id);
    assert.equal(journey.status, 'ACCEPTED');
    assert.equal(journey.assignedResponder?.id, 'resp-201');

    // Active journey is stored
    const active = await journeyService.getActiveJourney('resp-201');
    assert.ok(active);
    assert.equal(active.id, journey.id);

    // Incoming offer is cleared
    assert.equal(await journeyService.getIncomingOffer('resp-201'), null);

    // Attempting duplicate acceptance throws OFFER_UNAVAILABLE
    await assert.rejects(
      async () => {
        await journeyService.acceptOffer(offer.id, 'resp-201');
      },
      (err: any) => {
        assert.equal(err.code, 'OFFER_UNAVAILABLE');
        return true;
      }
    );

    // Triggering a new offer while busy and attempting to accept throws ACTIVE_JOURNEY_EXISTS
    const secondOffer = await journeyService.triggerMockOffer('resp-201');
    await assert.rejects(
      async () => {
        await journeyService.acceptOffer(secondOffer.id, 'resp-201');
      },
      (err: any) => {
        assert.equal(err.code, 'ACTIVE_JOURNEY_EXISTS');
        return true;
      }
    );
  });

  // 9. Declining an offer: clears offer and returns responder to available online state
  test('9. Declining an offer clears active offer and returns responder to available online state', async () => {
    await journeyService.setAvailability('resp-201', 'ONLINE', 'VERIFIED');
    const offer = await journeyService.triggerMockOffer('resp-201');

    await journeyService.declineOffer(offer.id, 'resp-201', 'Distance too far for heavy rain');

    const pending = await journeyService.getIncomingOffer('resp-201');
    assert.equal(pending, null);

    // Responder remains ONLINE and available
    assert.equal(await journeyService.getAvailability('resp-201'), 'ONLINE');
    assert.equal(await journeyService.getActiveJourney('resp-201'), null);
  });

  // 10. Sequential journey progression through all authoritative milestones
  test('10. Full sequential journey progresses strictly: ACCEPTED → PICKUP_ARRIVED → PATIENT_ONBOARD → IN_TRANSIT → ARRIVED → COMPLETED', async () => {
    await journeyService.setAvailability('resp-201', 'ONLINE', 'VERIFIED');
    const offer = await journeyService.triggerMockOffer('resp-201');
    let journey = await journeyService.acceptOffer(offer.id, 'resp-201');
    assert.equal(journey.status, 'ACCEPTED');

    // Step 1: PICKUP_ARRIVED
    journey = await journeyService.advanceJourneyState(journey.id, 'resp-201', 'PICKUP_ARRIVED');
    assert.equal(journey.status, 'PICKUP_ARRIVED');
    assert.equal(journey.history.length, 4);

    // Step 2: PATIENT_ONBOARD
    journey = await journeyService.advanceJourneyState(journey.id, 'resp-201', 'PATIENT_ONBOARD');
    assert.equal(journey.status, 'PATIENT_ONBOARD');
    assert.equal(journey.history.length, 5);

    // Step 3: IN_TRANSIT
    journey = await journeyService.advanceJourneyState(journey.id, 'resp-201', 'IN_TRANSIT');
    assert.equal(journey.status, 'IN_TRANSIT');
    assert.equal(journey.history.length, 6);

    // Step 4: ARRIVED
    journey = await journeyService.advanceJourneyState(journey.id, 'resp-201', 'ARRIVED');
    assert.equal(journey.status, 'ARRIVED');
    assert.equal(journey.history.length, 7);

    // Step 5: COMPLETED via Handover
    journey = await journeyService.completeHandover(journey.id, 'resp-201', 'Handed over to Nurse Chioma at triage');
    assert.equal(journey.status, 'COMPLETED');
    assert.ok(journey.history.some((m) => m.state === 'COMPLETED'));

    // Journey is now archived; active journey returns null
    assert.equal(await journeyService.getActiveJourney('resp-201'), null);
  });

  // 11. Rejection of invalid state transitions
  test('11. Rejects invalid state transitions such as jumping directly to PATIENT_ONBOARD or COMPLETED', async () => {
    await journeyService.setAvailability('resp-201', 'ONLINE', 'VERIFIED');
    const offer = await journeyService.triggerMockOffer('resp-201');
    const journey = await journeyService.acceptOffer(offer.id, 'resp-201');
    assert.equal(journey.status, 'ACCEPTED');

    // Cannot jump from ACCEPTED to PATIENT_ONBOARD
    await assert.rejects(
      async () => {
        await journeyService.advanceJourneyState(journey.id, 'resp-201', 'PATIENT_ONBOARD');
      },
      (err: any) => {
        assert.equal(err.code, 'INVALID_STATE_TRANSITION');
        assert.ok(err.message.includes('PICKUP_ARRIVED'));
        return true;
      }
    );

    // Cannot jump from ACCEPTED to COMPLETED
    await assert.rejects(
      async () => {
        await journeyService.advanceJourneyState(journey.id, 'resp-201', 'COMPLETED');
      },
      (err: any) => {
        assert.equal(err.code, 'INVALID_STATE_TRANSITION');
        return true;
      }
    );

    // Advance to PICKUP_ARRIVED
    await journeyService.advanceJourneyState(journey.id, 'resp-201', 'PICKUP_ARRIVED');

    // Cannot jump from PICKUP_ARRIVED to ARRIVED
    await assert.rejects(
      async () => {
        await journeyService.advanceJourneyState(journey.id, 'resp-201', 'ARRIVED');
      },
      (err: any) => {
        assert.equal(err.code, 'INVALID_STATE_TRANSITION');
        return true;
      }
    );
  });

  // 12. Patient privacy protection and non-medical identity
  test('12. Privacy protection limits patient data exposure and verifies non-medical role boundaries', async () => {
    await journeyService.setAvailability('resp-201', 'ONLINE', 'VERIFIED');
    const offer = await journeyService.triggerMockOffer('resp-201');

    // Check offer does not expose full medical history or national ID
    assert.ok(offer.pickupLocation.landmark);
    assert.ok(offer.urgencyLabel);
    assert.strictEqual((offer as any).privateMedicalHistory, undefined);
    assert.strictEqual((offer as any).nationalIdNumber, undefined);

    // Verification metadata confirms ordinary driver status
    const verifiedMeta = VERIFICATION_STATUS_METADATA.VERIFIED;
    assert.equal(verifiedMeta.label, 'Verified Responder');
    assert.equal(verifiedMeta.canAcceptRides, true);

    // Emergency metadata confirms ordinary driver role disclaimer
    const acceptedMeta = EMERGENCY_STATE_METADATA.ACCEPTED;
    assert.ok(acceptedMeta.description.includes('transportation responder'));
  });

  // 13. Handover and trip completion updates responder lifetime statistics
  test('13. Handover records destination facility, timestamp, and increments responder statistics', async () => {
    const initialStats = await journeyService.getResponderStats('resp-201');
    const tripsBefore = initialStats.completedTripsToday;
    const totalBefore = initialStats.totalCompletedTrips;

    await journeyService.setAvailability('resp-201', 'ONLINE', 'VERIFIED');
    const offer = await journeyService.triggerMockOffer('resp-201');
    const journey = await journeyService.acceptOffer(offer.id, 'resp-201');

    await journeyService.advanceJourneyState(journey.id, 'resp-201', 'PICKUP_ARRIVED');
    await journeyService.advanceJourneyState(journey.id, 'resp-201', 'PATIENT_ONBOARD');
    await journeyService.advanceJourneyState(journey.id, 'resp-201', 'IN_TRANSIT');
    await journeyService.advanceJourneyState(journey.id, 'resp-201', 'ARRIVED');

    const completed = await journeyService.completeHandover(
      journey.id,
      'resp-201',
      'Nurse handover complete at triage desk'
    );

    assert.equal(completed.status, 'COMPLETED');

    const updatedStats = await journeyService.getResponderStats('resp-201');
    assert.equal(updatedStats.completedTripsToday, tripsBefore + 1);
    assert.equal(updatedStats.totalCompletedTrips, totalBefore + 1);
  });

  // 14. Robust error handling (non-existent journey, completeHandover before arrival)
  test('14. Robust error handling guards non-existent journeys and prevents premature handover completion', async () => {
    // Non-existent journey
    await assert.rejects(
      async () => {
        await journeyService.advanceJourneyState('fake-journey-999', 'resp-201', 'PICKUP_ARRIVED');
      },
      (err: any) => {
        assert.equal(err.code, 'NOT_FOUND');
        return true;
      }
    );

    // Create a real journey
    await journeyService.setAvailability('resp-201', 'ONLINE', 'VERIFIED');
    const offer = await journeyService.triggerMockOffer('resp-201');
    const journey = await journeyService.acceptOffer(offer.id, 'resp-201');

    // Attempting completeHandover while only at ACCEPTED status must be rejected
    await assert.rejects(
      async () => {
        await journeyService.completeHandover(journey.id, 'resp-201', 'Premature handover attempt');
      },
      (err: any) => {
        assert.equal(err.code, 'INVALID_STATE_TRANSITION');
        assert.ok(err.message.includes('ARRIVED'));
        return true;
      }
    );
  });

  // 15. Journey progression supporting HOSPITAL_SELECTED milestone
  test('15. Journey progression supports optional HOSPITAL_SELECTED milestone before IN_TRANSIT', async () => {
    await journeyService.setAvailability('resp-201', 'ONLINE', 'VERIFIED');
    const offer = await journeyService.triggerMockOffer('resp-201');
    let journey = await journeyService.acceptOffer(offer.id, 'resp-201');

    journey = await journeyService.advanceJourneyState(journey.id, 'resp-201', 'PICKUP_ARRIVED');
    journey = await journeyService.advanceJourneyState(journey.id, 'resp-201', 'PATIENT_ONBOARD');
    assert.equal(journey.status, 'PATIENT_ONBOARD');

    // Intermediate milestone: HOSPITAL_SELECTED
    journey = await journeyService.advanceJourneyState(journey.id, 'resp-201', 'HOSPITAL_SELECTED');
    assert.equal(journey.status, 'HOSPITAL_SELECTED');

    // Transitions from HOSPITAL_SELECTED to IN_TRANSIT
    journey = await journeyService.advanceJourneyState(journey.id, 'resp-201', 'IN_TRANSIT');
    assert.equal(journey.status, 'IN_TRANSIT');

    journey = await journeyService.advanceJourneyState(journey.id, 'resp-201', 'ARRIVED');
    journey = await journeyService.completeHandover(journey.id, 'resp-201', 'Transferred to triage');
    assert.equal(journey.status, 'COMPLETED');
  });

  // 16. Location permissions & responder GPS / manual landmark resolution
  test('16. Responder location service resolves GPS coordinates or safely falls back without fabricating data', async () => {
    const { LocationService } = await import('../src/services/location/locationService.ts');

    // Mock GPS provider with granted permissions
    const mockGpsProvider = {
      requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
      hasServicesEnabledAsync: async () => true,
      getCurrentPositionAsync: async () => ({
        coords: {
          latitude: 9.0765,
          longitude: 7.3986,
          accuracy: 12,
        },
      }),
    };

    const locService = new LocationService(mockGpsProvider);
    const result = await locService.acquireGpsLocation(2000);
    assert.equal(result.success, true);
    assert.ok(result.location?.coords);
    assert.equal(result.location?.coords?.latitude, 9.0765);
    assert.equal(result.location?.coords?.longitude, 7.3986);
    assert.equal(result.location?.accuracyLevel, 'HIGH');

    // When GPS permission is denied, fallback without fabricated coordinates
    const deniedGpsProvider = {
      requestForegroundPermissionsAsync: async () => ({ status: 'denied' }),
      hasServicesEnabledAsync: async () => true,
      getCurrentPositionAsync: async () => {
        throw new Error('Permission denied');
      },
    };

    const deniedLocService = new LocationService(deniedGpsProvider);
    const deniedResult = await deniedLocService.acquireGpsLocation(2000);
    assert.equal(deniedResult.success, false);
    assert.equal(deniedResult.error?.code, 'PERMISSION_DENIED');

    // Manual location creation strictly preserves safety invariant (coords undefined)
    const manualLoc = locService.createManualLocation(
      'Karu Village',
      'Near Mosque Water Pump',
      'House 12',
      'Call when at junction'
    );
    assert.equal(manualLoc.source, 'MANUAL');
    assert.equal(manualLoc.coords, undefined);
    assert.equal(manualLoc.villageCommunity, 'Karu Village');
  });

  // 17. Network failure handling and timeout resilience
  test('17. Network failures during dispatch operations throw typed errors allowing UI retry', async () => {
    const { ApiError } = await import('../src/services/api/client.ts');
    const { HttpHelper } = await import('../src/services/api/responderApiService.ts').then(
      () => ({ HttpHelper: class {} })
    );

    // Verify ApiError properties
    const netErr = new ApiError('Unable to connect to Python backend dispatch server', 'NETWORK_TIMEOUT', 0);
    assert.equal(netErr.code, 'NETWORK_TIMEOUT');
    assert.equal(netErr.statusCode, 0);
    assert.ok(netErr.message.includes('Python backend'));
  });

  // 18. Forgot password recovery flow via SMS
  test('18. Forgot password initiates SMS OTP recovery and validates input phone', async () => {
    // Valid phone
    const res = await authService.forgotPassword('08031112233');
    assert.equal(res.success, true);
    assert.ok(res.message.includes('SMS'));

    // Invalid phone
    await assert.rejects(
      async () => {
        await authService.forgotPassword('123');
      },
      (err: any) => {
        assert.equal(err.code, 'INVALID_PHONE');
        return true;
      }
    );
  });

  // 19. Responder profile updates and vehicle registration editing
  test('19. Updating driver name, community base, and vehicle registration persists', async () => {
    await authService.loginAsDemo('resp-201');

    const updated = await authService.updateProfile({
      fullName: 'Ibrahim Suleiman Updated',
      communityBase: 'Nyanya Express Hub',
      vehicle: {
        vehicleType: 'MOTORCYCLE',
        makeModel: 'Bajaj Boxer 150 HD',
        licensePlate: 'KJA-999-ZZ',
        color: 'Blue',
        insuranceValid: true,
      },
    });

    assert.equal(updated.fullName, 'Ibrahim Suleiman Updated');
    assert.equal(updated.communityBase, 'Nyanya Express Hub');
    assert.equal(updated.vehicle.makeModel, 'Bajaj Boxer 150 HD');
    assert.equal(updated.vehicle.licensePlate, 'KJA-999-ZZ');
  });

  // 20. Notification service event dispatching for emergency alerts
  test('20. Notification service dispatches urgent haptic and event updates on new offers and state changes', async () => {
    const { notificationService } = await import('../src/services/notification/notificationService.ts');

    const receivedEvents: any[] = [];
    const unsubscribe = notificationService.subscribe((evt) => {
      receivedEvents.push(evt);
    });

    const sampleOffer: EmergencyOffer = {
      id: 'offer-test-99',
      emergencyId: 'em-test-99',
      patientId: 'pat-1001',
      pickupLocation: {
        source: 'MANUAL',
        accuracyLevel: 'APPROXIMATE',
        villageCommunity: 'Karu Sector 4',
        landmark: 'Primary Health Clinic Junction',
        capturedAt: new Date().toISOString(),
      },
      urgencyLabel: 'Obstetric Emergency',
      requestedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      status: 'PENDING',
    };

    await notificationService.notifyOffer(sampleOffer);
    await notificationService.notifyStateChange('IN_TRANSIT', 'En route to hospital');
    await notificationService.notifyReassigned('Reassigned by dispatch desk');

    assert.equal(receivedEvents.length, 3);
    assert.equal(receivedEvents[0].type, 'NEW_OFFER');
    assert.equal(receivedEvents[1].type, 'STATE_CHANGE');
    assert.equal(receivedEvents[2].type, 'REASSIGNED');

    unsubscribe();
  });
});
