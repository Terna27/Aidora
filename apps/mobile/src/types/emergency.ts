/**
 * RideRoute Emergency Domain Types & State Machine
 *
 * Enforces the 14 backend emergency states agreed with Developer 2.
 * Coordinates emergency transportation for maternal healthcare.
 * Drivers are ordinary verified drivers, NEVER represented as medical staff.
 */

export type EmergencyState =
  | 'CREATED'
  | 'DISPATCHING'
  | 'ACCEPTED'
  | 'PICKUP_ARRIVED'
  | 'PATIENT_ONBOARD'
  | 'HOSPITAL_SELECTED'
  | 'IN_TRANSIT'
  | 'ARRIVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'ESCALATED'
  | 'REASSIGNING'
  | 'FAILED_CONTACT';

export type LocationSource = 'GPS' | 'MANUAL';

export type AccuracyLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'APPROXIMATE' | 'UNKNOWN';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface LocationData {
  source: LocationSource;
  coords?: LocationCoordinates;
  accuracyMeters?: number;
  accuracyLevel: AccuracyLevel;
  villageCommunity: string;
  landmark: string;
  streetAddress?: string;
  directionsNotes?: string;
  capturedAt: string;
}

export type VehicleType = 'MOTORCYCLE' | 'TAXI';

export interface ResponderInfo {
  id: string;
  fullName: string;
  phoneNumber: string;
  roleDescription: 'Verified Transportation Responder';
  vehicleType: VehicleType;
  vehicleModel: string;
  licensePlate: string;
  photoUrl?: string;
  rating?: number;
  completedTripsCount?: number;
  currentCoords?: LocationCoordinates;
  etaMinutes?: number;
}

export interface HealthcareFacility {
  id: string;
  name: string;
  facilityType: 'General Hospital' | 'Maternity Clinic' | 'Primary Health Center';
  address: string;
  community: string;
  emergencyPhone: string;
  maternalServicesAvailable: boolean;
}

export interface EmergencyStatusTransition {
  state: EmergencyState;
  timestamp: string;
  note?: string;
}

export interface EmergencyRequest {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  status: EmergencyState;
  location: LocationData;
  assignedResponder?: ResponderInfo;
  destinationFacility?: HealthcareFacility;
  createdAt: string;
  updatedAt: string;
  history: EmergencyStatusTransition[];
  cancellationReason?: string;
  notes?: string;
}

export interface StateDisplayInfo {
  state: EmergencyState;
  label: string;
  description: string;
  stepIndex: number;
  isTerminal: boolean;
  canCancel: boolean;
  themeColor: string;
}

export const EMERGENCY_STATE_METADATA: Record<EmergencyState, StateDisplayInfo> = {
  CREATED: {
    state: 'CREATED',
    label: 'Request Submitted',
    description: 'Your request has been sent. Waiting for server confirmation.',
    stepIndex: 0,
    isTerminal: false,
    canCancel: true,
    themeColor: '#D97706',
  },
  DISPATCHING: {
    state: 'DISPATCHING',
    label: 'Finding Responder',
    description: 'Alerting verified motorcycle and taxi drivers in your community.',
    stepIndex: 1,
    isTerminal: false,
    canCancel: true,
    themeColor: '#D97706',
  },
  ACCEPTED: {
    state: 'ACCEPTED',
    label: 'Driver Assigned',
    description: 'A verified transportation responder has accepted and is heading to you.',
    stepIndex: 2,
    isTerminal: false,
    canCancel: true,
    themeColor: '#2563EB',
  },
  PICKUP_ARRIVED: {
    state: 'PICKUP_ARRIVED',
    label: 'Driver Arrived at Pickup',
    description: 'Your responder has arrived at your pickup location.',
    stepIndex: 3,
    isTerminal: false,
    canCancel: true,
    themeColor: '#2563EB',
  },
  PATIENT_ONBOARD: {
    state: 'PATIENT_ONBOARD',
    label: 'Patient Onboard',
    description: 'You are now with your responder preparing for departure.',
    stepIndex: 4,
    isTerminal: false,
    canCancel: false,
    themeColor: '#7C3AED',
  },
  HOSPITAL_SELECTED: {
    state: 'HOSPITAL_SELECTED',
    label: 'Hospital Confirmed',
    description: 'Destination healthcare facility selected and notified of your arrival.',
    stepIndex: 5,
    isTerminal: false,
    canCancel: false,
    themeColor: '#7C3AED',
  },
  IN_TRANSIT: {
    state: 'IN_TRANSIT',
    label: 'En Route to Hospital',
    description: 'Traveling safely toward the healthcare facility.',
    stepIndex: 6,
    isTerminal: false,
    canCancel: false,
    themeColor: '#0E7090',
  },
  ARRIVED: {
    state: 'ARRIVED',
    label: 'Arrived at Facility',
    description: 'You have safely arrived at the healthcare facility.',
    stepIndex: 7,
    isTerminal: false,
    canCancel: false,
    themeColor: '#059669',
  },
  COMPLETED: {
    state: 'COMPLETED',
    label: 'Journey Completed',
    description: 'Emergency transportation finished. Patient handed over to facility staff.',
    stepIndex: 8,
    isTerminal: true,
    canCancel: false,
    themeColor: '#059669',
  },
  CANCELLED: {
    state: 'CANCELLED',
    label: 'Emergency Cancelled',
    description: 'The emergency transportation request was cancelled.',
    stepIndex: -1,
    isTerminal: true,
    canCancel: false,
    themeColor: '#475569',
  },
  EXPIRED: {
    state: 'EXPIRED',
    label: 'Request Timed Out',
    description: 'No responder was available within the response window. Escalating to dispatch.',
    stepIndex: -1,
    isTerminal: true,
    canCancel: false,
    themeColor: '#DC2626',
  },
  ESCALATED: {
    state: 'ESCALATED',
    label: 'Escalated to Dispatch',
    description: 'A human dispatch operator has taken manual control of this emergency.',
    stepIndex: -1,
    isTerminal: false,
    canCancel: true,
    themeColor: '#DC2626',
  },
  REASSIGNING: {
    state: 'REASSIGNING',
    label: 'Reassigning Responder',
    description: 'Searching for an alternative responder in your vicinity.',
    stepIndex: 1,
    isTerminal: false,
    canCancel: true,
    themeColor: '#D97706',
  },
  FAILED_CONTACT: {
    state: 'FAILED_CONTACT',
    label: 'Unable to Reach',
    description: 'Could not establish connection with patient or responder. Operator alerted.',
    stepIndex: -1,
    isTerminal: true,
    canCancel: false,
    themeColor: '#DC2626',
  },
};
