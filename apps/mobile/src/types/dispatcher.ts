import { LocationCoordinates } from './emergency';

export type EmergencySeverity = 'CRITICAL' | 'URGENT' | 'STABLE';

export type DispatchCaseStatus = 'UNASSIGNED' | 'ASSIGNED' | 'EN_ROUTE' | 'RESOLVED';

export type UnitType = 'Ambulance' | 'Motor medic' | 'Taxi' | 'Motorcycle';

export type UnitOperationalStatus = 'AVAILABLE' | 'RETURNING' | 'BUSY' | 'OFFLINE';

export interface DispatcherCase {
  id: string;
  severity: EmergencySeverity;
  emergencyTitle: string;
  emergencyDescription: string;
  locationArea: string;
  landmark?: string;
  coords?: LocationCoordinates;
  reportedAt: string;
  elapsedSeconds: number;
  status: DispatchCaseStatus;
  statusLabel?: string;
  assignedUnitId?: string;
  assignedUnitEtaMinutes?: number;
  reportedBy: string;
  isAwake: boolean;
  bloodGroup: string;
  callerNote: string;
}

export interface DispatcherUnit {
  id: string;
  name: string;
  unitType: UnitType;
  operationalStatus: UnitOperationalStatus;
  distanceKm?: number;
  distanceLabel: string;
  currentCoords?: LocationCoordinates;
  etaMinutes?: number;
}

export interface DispatcherStats {
  criticalWaiting: number;
  urgentWaiting: number;
  unitsEnRoute: number;
  unitsAvailable: number;
}

export interface DispatcherProfile {
  id: string;
  name: string;
  initials: string;
  role: string;
  shiftStatus: 'On shift' | 'Off shift';
}

export interface NewCasePayload {
  severity: EmergencySeverity;
  emergencyTitle: string;
  emergencyDescription: string;
  locationArea: string;
  reportedBy: string;
  isAwake: boolean;
  bloodGroup?: string;
  callerNote?: string;
}
