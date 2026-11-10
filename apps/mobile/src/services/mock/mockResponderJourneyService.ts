import {
  EmergencyRequest,
  EmergencyState,
  EMERGENCY_STATE_METADATA,
} from '../../types/emergency';
import {
  AvailabilityStatus,
  EmergencyOffer,
  ResponderStats,
  VerificationStatus,
} from '../../types/responder';
import {
  MOCK_FACILITIES,
  SAMPLE_EMERGENCY_OFFER,
  MOCK_RESPONDER_PROFILES,
} from './mockData';
import { ApiError } from '../api/client';

export interface IResponderJourneyService {
  getAvailability(responderId: string): Promise<AvailabilityStatus>;
  setAvailability(
    responderId: string,
    status: AvailabilityStatus,
    verificationStatus: VerificationStatus
  ): Promise<AvailabilityStatus>;
  getIncomingOffer(responderId: string): Promise<EmergencyOffer | null>;
  acceptOffer(offerId: string, responderId: string): Promise<EmergencyRequest>;
  declineOffer(offerId: string, responderId: string, reason?: string): Promise<void>;
  getActiveJourney(responderId: string): Promise<EmergencyRequest | null>;
  advanceJourneyState(
    emergencyId: string,
    responderId: string,
    targetState: EmergencyState
  ): Promise<EmergencyRequest>;
  completeHandover(
    emergencyId: string,
    responderId: string,
    handoverNotes?: string
  ): Promise<EmergencyRequest>;
  getResponderStats(responderId: string): Promise<ResponderStats>;
  triggerMockOffer(responderId: string): Promise<EmergencyOffer>;
  reset(): void;
}

export class MockResponderJourneyService implements IResponderJourneyService {
  private availability: Record<string, AvailabilityStatus> = {
    'resp-201': 'ONLINE',
    'resp-202': 'OFFLINE',
    'resp-203': 'OFFLINE',
  };

  private currentOffers: Record<string, EmergencyOffer | null> = {
    'resp-201': { ...SAMPLE_EMERGENCY_OFFER },
  };

  private activeJourneys: Record<string, EmergencyRequest | null> = {};
  private completedTripsTodayCount: Record<string, number> = {
    'resp-201': 3,
    'resp-202': 5,
    'resp-203': 0,
  };

  async getAvailability(responderId: string): Promise<AvailabilityStatus> {
    return this.availability[responderId] || 'OFFLINE';
  }

  async setAvailability(
    responderId: string,
    status: AvailabilityStatus,
    verificationStatus: VerificationStatus
  ): Promise<AvailabilityStatus> {
    await new Promise((r) => setTimeout(r, 200));

    // VERIFICATION GUARD: Only verified responders can go online
    if (status === 'ONLINE' && verificationStatus !== 'VERIFIED') {
      throw new ApiError(
        'Your documents are pending review. Only verified responders can receive emergency requests.',
        'VERIFICATION_REQUIRED',
        403
      );
    }

    this.availability[responderId] = status;

    // If going online and no active offer exists, seed a mock offer
    if (status === 'ONLINE' && !this.currentOffers[responderId] && !this.activeJourneys[responderId]) {
      this.currentOffers[responderId] = {
        ...SAMPLE_EMERGENCY_OFFER,
        id: `offer-${Date.now().toString().slice(-4)}`,
        requestedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      };
    }

    return status;
  }

  async getIncomingOffer(responderId: string): Promise<EmergencyOffer | null> {
    if (this.availability[responderId] !== 'ONLINE') {
      return null;
    }
    return this.currentOffers[responderId] || null;
  }

  async acceptOffer(offerId: string, responderId: string): Promise<EmergencyRequest> {
    await new Promise((r) => setTimeout(r, 500));

    const offer = this.currentOffers[responderId];
    if (!offer || offer.id !== offerId) {
      throw new ApiError(
        'Emergency request offer is no longer available or was accepted by another responder.',
        'OFFER_UNAVAILABLE',
        404
      );
    }

    // Check expiration
    if (new Date(offer.expiresAt).getTime() < Date.now()) {
      this.currentOffers[responderId] = null;
      throw new ApiError(
        'This emergency transportation offer has expired.',
        'OFFER_EXPIRED',
        410
      );
    }

    // DUPLICATE ACCEPTANCE GUARD: Responder cannot have two active journeys
    if (this.activeJourneys[responderId]) {
      throw new ApiError(
        'You already have an active emergency journey in progress.',
        'ACTIVE_JOURNEY_EXISTS',
        409
      );
    }

    const profile = MOCK_RESPONDER_PROFILES[responderId] || {
      id: responderId,
      fullName: 'Verified Responder',
      phoneNumber: '08031112233',
      roleDescription: 'Verified Transportation Responder' as const,
      vehicle: {
        vehicleType: 'MOTORCYCLE' as const,
        makeModel: 'Motorcycle',
        licensePlate: 'KJA-482-XA',
        color: 'Black',
        insuranceValid: true,
      },
      rating: 4.9,
    };

    const now = new Date().toISOString();
    const journey: EmergencyRequest = {
      id: offer.emergencyId,
      patientId: offer.patientId,
      patientName: 'Fatima Bello',
      patientPhone: '08012345678',
      status: 'ACCEPTED',
      location: offer.pickupLocation,
      destinationFacility: offer.destinationFacility || MOCK_FACILITIES[0],
      assignedResponder: {
        id: profile.id,
        fullName: profile.fullName,
        phoneNumber: profile.phoneNumber,
        roleDescription: 'Verified Transportation Responder',
        vehicleType: profile.vehicle.vehicleType,
        vehicleModel: profile.vehicle.makeModel,
        licensePlate: profile.vehicle.licensePlate,
        rating: profile.rating,
        etaMinutes: offer.estimatedPickupMins || 6,
      },
      createdAt: offer.requestedAt,
      updatedAt: now,
      history: [
        { state: 'CREATED', timestamp: offer.requestedAt },
        { state: 'DISPATCHING', timestamp: offer.requestedAt },
        {
          state: 'ACCEPTED',
          timestamp: now,
          note: `Accepted by responder ${profile.fullName} (${profile.vehicle.makeModel})`,
        },
      ],
    };

    this.activeJourneys[responderId] = journey;
    this.currentOffers[responderId] = null;
    return journey;
  }

  async declineOffer(offerId: string, responderId: string, reason = 'Responder unavailable'): Promise<void> {
    await new Promise((r) => setTimeout(r, 200));
    if (this.currentOffers[responderId]?.id === offerId) {
      this.currentOffers[responderId] = null;
    }
  }

  async getActiveJourney(responderId: string): Promise<EmergencyRequest | null> {
    return this.activeJourneys[responderId] || null;
  }

  /**
   * Advance journey state strictly enforcing the domain state machine:
   * ACCEPTED -> PICKUP_ARRIVED -> PATIENT_ONBOARD -> (HOSPITAL_SELECTED) -> IN_TRANSIT -> ARRIVED -> COMPLETED
   */
  async advanceJourneyState(
    emergencyId: string,
    responderId: string,
    targetState: EmergencyState
  ): Promise<EmergencyRequest> {
    await new Promise((r) => setTimeout(r, 400));
    const journey = this.activeJourneys[responderId];

    if (!journey || journey.id !== emergencyId) {
      throw new ApiError('Active emergency journey not found', 'NOT_FOUND', 404);
    }

    const current = journey.status;

    if (targetState === 'COMPLETED') {
      throw new ApiError(
        'Direct transition to COMPLETED via milestone progression is forbidden. Explicit facility handover via completeHandover() is required.',
        'INVALID_STATE_TRANSITION',
        400
      );
    }

    // VALID STATE TRANSITION RULES:
    const validTransitions: Record<EmergencyState, EmergencyState[]> = {
      CREATED: ['DISPATCHING'],
      DISPATCHING: ['ACCEPTED'],
      ACCEPTED: ['PICKUP_ARRIVED'],
      PICKUP_ARRIVED: ['PATIENT_ONBOARD'],
      PATIENT_ONBOARD: ['HOSPITAL_SELECTED', 'IN_TRANSIT'],
      HOSPITAL_SELECTED: ['IN_TRANSIT'],
      IN_TRANSIT: ['ARRIVED'],
      ARRIVED: [], // COMPLETED requires explicit completeHandover()
      COMPLETED: [],
      CANCELLED: [],
      EXPIRED: [],
      ESCALATED: [],
      REASSIGNING: [],
      FAILED_CONTACT: [],
    };

    const allowed = validTransitions[current] || [];
    if (!allowed.includes(targetState)) {
      throw new ApiError(
        `Cannot transition from '${current}' to '${targetState}'. Valid next states: [${allowed.join(', ')}]`,
        'INVALID_STATE_TRANSITION',
        400
      );
    }

    const now = new Date().toISOString();
    journey.status = targetState;
    journey.updatedAt = now;
    journey.history.push({
      state: targetState,
      timestamp: now,
      note: EMERGENCY_STATE_METADATA[targetState].description,
    });

    return journey;
  }

  async completeHandover(
    emergencyId: string,
    responderId: string,
    handoverNotes?: string
  ): Promise<EmergencyRequest> {
    const journey = this.activeJourneys[responderId];
    if (!journey || journey.id !== emergencyId) {
      throw new ApiError('Active journey not found', 'NOT_FOUND', 404);
    }

    if (journey.status !== 'ARRIVED') {
      throw new ApiError(
        'Patient must be marked ARRIVED at facility before completing handover',
        'INVALID_STATE_TRANSITION',
        400
      );
    }

    const now = new Date().toISOString();
    journey.status = 'COMPLETED';
    journey.updatedAt = now;
    journey.history.push({
      state: 'COMPLETED',
      timestamp: now,
      note: handoverNotes || 'Patient safely received by authorized facility representative.',
    });

    // Update stats
    this.completedTripsTodayCount[responderId] = (this.completedTripsTodayCount[responderId] || 0) + 1;
    this.activeJourneys[responderId] = null;
    return journey;
  }

  async getResponderStats(responderId: string): Promise<ResponderStats> {
    const profile = MOCK_RESPONDER_PROFILES[responderId];
    const today = this.completedTripsTodayCount[responderId] || 0;
    const total = (profile?.completedTripsCount || 0) + today;

    return {
      completedTripsToday: today,
      totalCompletedTrips: total,
      averageRating: profile?.rating || 4.9,
      hoursOnlineToday: 4.5,
      acceptanceRatePercent: 96,
    };
  }

  async triggerMockOffer(responderId: string): Promise<EmergencyOffer> {
    const offer: EmergencyOffer = {
      id: `offer-${Date.now().toString().slice(-4)}`,
      emergencyId: `em-${Date.now().toString().slice(-5)}`,
      patientId: 'pat-1001',
      pickupLocation: {
        source: 'GPS',
        coords: { latitude: 9.0765, longitude: 7.3986 },
        accuracyMeters: 10,
        accuracyLevel: 'HIGH',
        villageCommunity: 'Karu Sector 2',
        landmark: 'Opposite Central Market, near primary school',
        capturedAt: new Date().toISOString(),
      },
      destinationFacility: MOCK_FACILITIES[0],
      urgencyLabel: 'Urgent Maternal Transport',
      requestedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      estimatedDistanceKm: 2.1,
      estimatedPickupMins: 5,
      status: 'PENDING',
    };

    this.currentOffers[responderId] = offer;
    return offer;
  }

  reset(): void {
    this.availability = {
      'resp-201': 'ONLINE',
      'resp-202': 'OFFLINE',
      'resp-203': 'OFFLINE',
    };
    this.currentOffers = {
      'resp-201': { ...SAMPLE_EMERGENCY_OFFER },
    };
    this.activeJourneys = {};
  }
}

export const mockResponderJourneyService = new MockResponderJourneyService();
