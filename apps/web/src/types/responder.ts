/**
 * Responder Portal Types
 */

import { EmergencyState, EmergencySeverity, EmergencyLocation, Facility } from './emergency';

export type ResponderVerificationStatus = 'PENDING' | 'VERIFIED' | 'UNVERIFIED' | 'SUSPENDED';
export type ResponderAvailability = 'ONLINE' | 'OFFLINE';
export type VehicleType = 'MOTORCYCLE' | 'TAXI' | 'AMBULANCE';

export interface ResponderProfile {
  id: string;
  fullName: string;
  phone: string;
  vehicleType: VehicleType;
  vehicleReg: string;
  communityBase: string;
  verificationStatus: ResponderVerificationStatus;
  availability: ResponderAvailability;
  rating: number;
  completedJourneys: number;
}

export interface IncomingOffer {
  id: string;
  emergencyId: string;
  severity: EmergencySeverity;
  chiefComplaint: string;
  pickupLocation: EmergencyLocation;
  distanceKm: number;
  etaMinutes: number;
  destinationHospital: Facility;
  expiresAt: string;
}

export interface ResponderActiveJourney {
  emergencyId: string;
  state: EmergencyState;
  severity: EmergencySeverity;
  chiefComplaint: string;
  pickupLocation: EmergencyLocation;
  destinationFacility: Facility;
  patientName?: string;
  patientPhone?: string;
  isAwake?: 'Yes' | 'No' | 'Unknown';
  milestones: {
    state: EmergencyState;
    timestamp: string;
  }[];
}
