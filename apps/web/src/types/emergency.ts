/**
 * Aidline Emergency Domain Types
 * Authoritative 14-state machine and location contracts
 */

export type EmergencyState =
  // Normal sequential journey
  | 'CREATED'
  | 'DISPATCHING'
  | 'ACCEPTED' // Frontend display: HEADING_TO_PICKUP
  | 'PICKUP_ARRIVED'
  | 'PATIENT_ONBOARD'
  | 'HOSPITAL_SELECTED' // Optional stage
  | 'IN_TRANSIT'
  | 'ARRIVED'
  | 'COMPLETED'
  // Exceptional states
  | 'CANCELLED'
  | 'EXPIRED'
  | 'ESCALATED'
  | 'REASSIGNING'
  | 'FAILED_CONTACT';

export type EmergencySeverity = 'CRITICAL' | 'URGENT' | 'STABLE';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface EmergencyLocation {
  address: string;
  landmark?: string;
  communityBase?: string;
  type: 'GPS' | 'MANUAL';
  // Manual locations must NEVER have fabricated coordinates
  coords?: GeoPoint;
}

export interface EmergencyMilestone {
  state: EmergencyState;
  timestamp: string;
  note?: string;
  actorId?: string;
}

export interface Facility {
  id: string;
  name: string;
  type: 'HOSPITAL' | 'CLINIC' | 'MATERNITY_CENTER';
  address: string;
  landmark?: string;
  totalBeds: number;
  availableBeds: number;
  specialties: string[];
  contactPhone: string;
  coords?: GeoPoint;
}

export interface EmergencyRecord {
  id: string;
  state: EmergencyState;
  severity: EmergencySeverity;
  chiefComplaint: string;
  details?: string;
  reportedBy: 'PATIENT' | 'BYSTANDER' | 'FAMILY' | 'HEALTH_WORKER';
  patientName?: string;
  isAwake?: 'Yes' | 'No' | 'Unknown';
  bloodGroup?: string;
  callerNote?: string;
  location: EmergencyLocation;
  assignedResponderId?: string;
  assignedResponderName?: string;
  assignedVehicleType?: string;
  assignedVehicleReg?: string;
  etaMinutes?: number;
  destinationFacility?: Facility;
  milestones: EmergencyMilestone[];
  createdAt: string;
  updatedAt: string;
}
