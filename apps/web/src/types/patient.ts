/**
 * Patient Portal Types
 */

import { EmergencyState, EmergencySeverity, EmergencyLocation, Facility } from './emergency';

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  isPrimary?: boolean;
}

export interface PatientProfile {
  id: string;
  fullName: string;
  phone: string;
  bloodGroup: string;
  gestationalAgeWeeks?: number;
  allergies?: string[];
  medicalNotes?: string;
  emergencyContacts: EmergencyContact[];
}

export interface PatientActiveEmergency {
  id: string;
  state: EmergencyState;
  severity: EmergencySeverity;
  chiefComplaint: string;
  location: EmergencyLocation;
  assignedResponder?: {
    name: string;
    vehicleType: string;
    vehicleReg: string;
    phone: string;
    etaMinutes: number;
  };
  destinationFacility?: Facility;
  createdAt: string;
}

export interface TriggerSOSPayload {
  chiefComplaint: string;
  severity?: EmergencySeverity;
  location: EmergencyLocation;
  notes?: string;
}
