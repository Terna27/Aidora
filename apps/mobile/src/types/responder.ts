/**
 * RideRoute Responder Domain Types
 *
 * Defines models for verified transportation responders (motorcycle riders & taxi drivers).
 * Responders coordinate emergency transportation; ordinary drivers are NEVER medical personnel.
 */

import { LocationData, HealthcareFacility, EmergencyState } from './emergency';

export type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'SUSPENDED';

export type VehicleType = 'MOTORCYCLE' | 'TAXI';

export interface ResponderVehicle {
  vehicleType: VehicleType;
  makeModel: string;
  licensePlate: string;
  color: string;
  registrationNumber?: string;
  insuranceValid: boolean;
}

export interface ResponderProfile {
  id: string;
  fullName: string;
  phoneNumber: string;
  role: 'RESPONDER';
  roleDescription: 'Verified Transportation Responder';
  vehicle: ResponderVehicle;
  driverLicenseNumber: string;
  verificationStatus: VerificationStatus;
  rating: number;
  completedTripsCount: number;
  photoUrl?: string;
  communityBase?: string;
  registeredAt: string;
  updatedAt: string;
}

export type AvailabilityStatus = 'ONLINE' | 'OFFLINE';

export interface EmergencyOffer {
  id: string;
  emergencyId: string;
  patientId: string;
  pickupLocation: LocationData;
  destinationFacility?: HealthcareFacility;
  urgencyLabel: string;
  requestedAt: string;
  expiresAt: string;
  estimatedDistanceKm?: number;
  estimatedPickupMins?: number;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
}

export interface ResponderStats {
  completedTripsToday: number;
  totalCompletedTrips: number;
  averageRating: number;
  hoursOnlineToday: number;
  acceptanceRatePercent: number;
}

export interface ResponderRegisterPayload {
  fullName: string;
  phoneNumber: string;
  password?: string;
  vehicleType: VehicleType;
  vehicleMakeModel: string;
  licensePlate: string;
  vehicleColor: string;
  driverLicenseNumber: string;
  communityBase?: string;
  agreedToTerms: boolean;
}

export const VERIFICATION_STATUS_METADATA: Record<
  VerificationStatus,
  { label: string; description: string; badgeColor: string; canAcceptRides: boolean }
> = {
  VERIFIED: {
    label: 'Verified Responder',
    description: 'Account and vehicle documents approved. Eligible for emergency dispatches.',
    badgeColor: '#059669',
    canAcceptRides: true,
  },
  PENDING: {
    label: 'Verification Pending',
    description: 'Your license and vehicle documents are under review by dispatch administration.',
    badgeColor: '#D97706',
    canAcceptRides: false,
  },
  UNVERIFIED: {
    label: 'Documents Required',
    description: 'Please submit your driver license and vehicle papers to receive dispatches.',
    badgeColor: '#64748B',
    canAcceptRides: false,
  },
  SUSPENDED: {
    label: 'Account Suspended',
    description: 'Account access has been suspended. Please contact dispatch administration.',
    badgeColor: '#DC2626',
    canAcceptRides: false,
  },
};
