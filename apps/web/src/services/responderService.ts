/**
 * Responder Service
 * Manages responder verification rules, online availability, offers and active journeys
 */

import { EmergencyState, Facility } from '../types/emergency';
import {
  ResponderProfile,
  IncomingOffer,
  ResponderActiveJourney,
  ResponderAvailability,
} from '../types/responder';

const INITIAL_RESPONDER: ResponderProfile = {
  id: 'resp-2001',
  fullName: 'Chidi Okafor',
  phone: '+234 802 555 7890',
  vehicleType: 'MOTORCYCLE',
  vehicleReg: 'ABJ-882-MK',
  communityBase: 'Garki Central',
  verificationStatus: 'VERIFIED',
  availability: 'ONLINE',
  rating: 4.95,
  completedJourneys: 42,
};

const DEFAULT_HOSPITAL: Facility = {
  id: 'fac-central',
  name: 'General Hospital Apex',
  type: 'HOSPITAL',
  address: 'Hospital Road, Central District',
  landmark: 'Near City Gate',
  totalBeds: 120,
  availableBeds: 14,
  specialties: ['Obstetrics', 'Trauma', 'Emergency Surgery'],
  contactPhone: '+234 800 999 0001',
};

const INITIAL_OFFER: IncomingOffer = {
  id: 'off-501',
  emergencyId: 'emg-101',
  severity: 'CRITICAL',
  chiefComplaint: 'Unconscious / Male, not responding',
  pickupLocation: {
    address: 'Area 1 Market, Garki',
    landmark: 'Opposite Main Fruit Stalls',
    type: 'MANUAL',
  },
  distanceKm: 1.4,
  etaMinutes: 4,
  destinationHospital: DEFAULT_HOSPITAL,
  expiresAt: new Date(Date.now() + 180000).toISOString(),
};

export class ResponderService {
  private profile: ResponderProfile = JSON.parse(JSON.stringify(INITIAL_RESPONDER));
  private pendingOffer: IncomingOffer | null = JSON.parse(JSON.stringify(INITIAL_OFFER));
  private activeJourney: ResponderActiveJourney | null = null;
  private listeners: (() => void)[] = [];

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    for (const l of this.listeners) {
      l();
    }
  }

  public getProfile(): ResponderProfile {
    return JSON.parse(JSON.stringify(this.profile));
  }

  public updateProfile(updates: Partial<ResponderProfile>): ResponderProfile {
    this.profile = { ...this.profile, ...updates };
    this.notify();
    return this.getProfile();
  }

  public setVerificationStatus(status: ResponderProfile['verificationStatus']) {
    this.profile.verificationStatus = status;
    if (status !== 'VERIFIED') {
      this.profile.availability = 'OFFLINE';
    }
    this.notify();
  }

  public setAvailability(availability: ResponderAvailability): {
    success: boolean;
    availability?: ResponderAvailability;
    error?: string;
  } {
    // Critical Domain Rule: Only VERIFIED responders may switch online
    if (availability === 'ONLINE' && this.profile.verificationStatus !== 'VERIFIED') {
      return {
        success: false,
        error: `VERIFICATION_REQUIRED: Responders with '${this.profile.verificationStatus}' verification status cannot go online`,
      };
    }

    this.profile.availability = availability;
    this.notify();
    return { success: true, availability: this.profile.availability };
  }

  public getPendingOffer(): IncomingOffer | null {
    if (!this.pendingOffer) return null;
    if (new Date(this.pendingOffer.expiresAt).getTime() < Date.now()) {
      this.pendingOffer = null;
      return null;
    }
    return JSON.parse(JSON.stringify(this.pendingOffer));
  }

  public setPendingOffer(offer: IncomingOffer | null) {
    this.pendingOffer = offer;
    this.notify();
  }

  public acceptOffer(): {
    success: boolean;
    journey?: ResponderActiveJourney;
    error?: string;
  } {
    if (!this.pendingOffer) {
      return { success: false, error: 'NO_OFFER: No active offer available to accept' };
    }

    if (new Date(this.pendingOffer.expiresAt).getTime() < Date.now()) {
      this.pendingOffer = null;
      return { success: false, error: 'OFFER_EXPIRED: Emergency offer has expired' };
    }

    const offer = this.pendingOffer;
    const now = new Date().toISOString();

    this.activeJourney = {
      emergencyId: offer.emergencyId,
      state: 'ACCEPTED',
      severity: offer.severity,
      chiefComplaint: offer.chiefComplaint,
      pickupLocation: offer.pickupLocation,
      destinationFacility: offer.destinationHospital,
      patientName: 'Confidential Patient',
      isAwake: 'No',
      milestones: [
        { state: 'ACCEPTED', timestamp: now },
      ],
    };

    this.pendingOffer = null;
    this.notify();

    return {
      success: true,
      journey: JSON.parse(JSON.stringify(this.activeJourney)),
    };
  }

  public declineOffer(): { success: boolean } {
    this.pendingOffer = null;
    this.notify();
    return { success: true };
  }

  public getActiveJourney(): ResponderActiveJourney | null {
    return this.activeJourney ? JSON.parse(JSON.stringify(this.activeJourney)) : null;
  }

  public advanceMilestone(targetState: EmergencyState): {
    success: boolean;
    journey?: ResponderActiveJourney;
    error?: string;
  } {
    if (!this.activeJourney) {
      return { success: false, error: 'NO_ACTIVE_JOURNEY: No journey in progress' };
    }

    const currentState = this.activeJourney.state;

    // Strict state order validation
    const validTransitions: Record<EmergencyState, EmergencyState[]> = {
      ACCEPTED: ['PICKUP_ARRIVED', 'CANCELLED'],
      PICKUP_ARRIVED: ['PATIENT_ONBOARD', 'CANCELLED'],
      PATIENT_ONBOARD: ['HOSPITAL_SELECTED', 'IN_TRANSIT'],
      HOSPITAL_SELECTED: ['IN_TRANSIT'],
      IN_TRANSIT: ['ARRIVED'],
      ARRIVED: ['COMPLETED'],
      COMPLETED: [],
      CANCELLED: [],
      EXPIRED: [],
      ESCALATED: [],
      REASSIGNING: [],
      FAILED_CONTACT: [],
      CREATED: ['DISPATCHING'],
      DISPATCHING: ['ACCEPTED'],
    };

    const allowed = validTransitions[currentState] || [];
    if (!allowed.includes(targetState)) {
      return {
        success: false,
        error: `INVALID_TRANSITION: Cannot transition journey from ${currentState} to ${targetState}`,
      };
    }

    const now = new Date().toISOString();
    this.activeJourney.state = targetState;
    this.activeJourney.milestones.push({ state: targetState, timestamp: now });

    if (targetState === 'COMPLETED') {
      this.profile.completedJourneys += 1;
      this.activeJourney = null;
    }

    this.notify();
    return {
      success: true,
      journey: this.activeJourney ? JSON.parse(JSON.stringify(this.activeJourney)) : undefined,
    };
  }

  public completeHandover(_facilityName: string, _staffName: string): {
    success: boolean;
    error?: string;
  } {
    if (!this.activeJourney) {
      return { success: false, error: 'NO_ACTIVE_JOURNEY: No journey in progress' };
    }

    if (this.activeJourney.state !== 'ARRIVED') {
      return {
        success: false,
        error: 'PREMATURE_HANDOVER: Unit must be marked ARRIVED at facility before completing handover',
      };
    }

    return this.advanceMilestone('COMPLETED');
  }

  public resetToFixtures() {
    this.profile = JSON.parse(JSON.stringify(INITIAL_RESPONDER));
    this.pendingOffer = JSON.parse(JSON.stringify(INITIAL_OFFER));
    this.activeJourney = null;
    this.notify();
  }
}

export const responderService = new ResponderService();
