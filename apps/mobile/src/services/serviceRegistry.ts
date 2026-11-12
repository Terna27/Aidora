import { mockAuthService, IAuthService } from './mock/mockAuthService';
import { mockEmergencyService, IEmergencyService } from './mock/mockEmergencyService';
import { locationService, ILocationService } from './location/locationService';
import {
  mockResponderAuthService,
  IResponderAuthService,
} from './mock/mockResponderAuthService';
import {
  mockResponderJourneyService,
  IResponderJourneyService,
} from './mock/mockResponderJourneyService';
import { notificationService, INotificationService } from './notification/notificationService';
import { dispatcherService, IDispatcherService } from './dispatcher/dispatcherService';
import {
  ResponderAuthApiService,
  ResponderJourneyApiService,
} from './api/responderApiService';
import {
  AvailabilityStatus,
  EmergencyOffer,
  ResponderProfile,
  ResponderStats,
  VerificationStatus,
} from '../types/responder';
import { EmergencyRequest, EmergencyState } from '../types/emergency';

export type {
  IAuthService,
  IEmergencyService,
  ILocationService,
  IResponderAuthService,
  IResponderJourneyService,
  INotificationService,
  IDispatcherService,
};

// Specialized Domain Service Interfaces
export interface IResponderProfileService {
  getProfile(): Promise<ResponderProfile | null>;
  updateProfile(updates: Partial<ResponderProfile>): Promise<ResponderProfile>;
}

export interface IAvailabilityService {
  getAvailability(responderId: string): Promise<AvailabilityStatus>;
  setAvailability(
    responderId: string,
    status: AvailabilityStatus,
    verificationStatus: VerificationStatus
  ): Promise<AvailabilityStatus>;
}

export interface IEmergencyOfferService {
  getIncomingOffer(responderId: string): Promise<EmergencyOffer | null>;
  acceptOffer(offerId: string, responderId: string): Promise<EmergencyRequest>;
  declineOffer(offerId: string, responderId: string, reason?: string): Promise<void>;
  triggerMockOffer(responderId: string): Promise<EmergencyOffer>;
}

export interface IJourneyService {
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
}

export const IS_MOCK_MODE =
  typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_USE_MOCK === 'false'
    ? false
    : true;

const activeResponderAuthService: IResponderAuthService = IS_MOCK_MODE
  ? mockResponderAuthService
  : new ResponderAuthApiService();

const activeResponderJourneyService: IResponderJourneyService = IS_MOCK_MODE
  ? mockResponderJourneyService
  : new ResponderJourneyApiService();

export interface ServiceRegistry {
  authService: IAuthService;
  emergencyService: IEmergencyService;
  locationService: ILocationService;
  responderAuthService: IResponderAuthService;
  responderJourneyService: IResponderJourneyService;
  responderProfileService: IResponderProfileService;
  availabilityService: IAvailabilityService;
  emergencyOfferService: IEmergencyOfferService;
  journeyService: IJourneyService;
  notificationService: INotificationService;
  dispatcherService: IDispatcherService;
  isMock: boolean;
}

export const serviceRegistry: ServiceRegistry = {
  authService: mockAuthService,
  emergencyService: mockEmergencyService,
  locationService: locationService,
  responderAuthService: activeResponderAuthService,
  responderJourneyService: activeResponderJourneyService,
  dispatcherService: dispatcherService,
  responderProfileService: {
    getProfile: () => activeResponderAuthService.getProfile(),
    updateProfile: (updates) => activeResponderAuthService.updateProfile(updates),
  },
  availabilityService: {
    getAvailability: (id) => activeResponderJourneyService.getAvailability(id),
    setAvailability: (id, st, vs) => activeResponderJourneyService.setAvailability(id, st, vs),
  },
  emergencyOfferService: {
    getIncomingOffer: (id) => activeResponderJourneyService.getIncomingOffer(id),
    acceptOffer: (oid, rid) => activeResponderJourneyService.acceptOffer(oid, rid),
    declineOffer: (oid, rid, r) => activeResponderJourneyService.declineOffer(oid, rid, r),
    triggerMockOffer: (rid) => activeResponderJourneyService.triggerMockOffer(rid),
  },
  journeyService: {
    getActiveJourney: (id) => activeResponderJourneyService.getActiveJourney(id),
    advanceJourneyState: (eid, rid, st) => activeResponderJourneyService.advanceJourneyState(eid, rid, st),
    completeHandover: (eid, rid, n) => activeResponderJourneyService.completeHandover(eid, rid, n),
    getResponderStats: (id) => activeResponderJourneyService.getResponderStats(id),
  },
  notificationService: notificationService,
  isMock: IS_MOCK_MODE,
};
