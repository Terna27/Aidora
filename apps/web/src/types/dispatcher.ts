/**
 * Dispatcher Portal Types
 * Matches the reference screenshot operational data model
 */

import { EmergencySeverity, EmergencyLocation } from './emergency';

export type DispatchCaseStatus = 'UNASSIGNED' | 'ASSIGNED' | 'EN_ROUTE' | 'RESOLVED';

export interface DispatcherCase {
  id: string;
  emergencyId: string;
  severity: EmergencySeverity;
  title: string;
  secondaryText: string;
  location: string;
  emergencyLocation?: EmergencyLocation;
  waitingSeconds: number;
  status: DispatchCaseStatus;
  assignedUnitId?: string;
  assignedUnitLabel?: string;
  etaMinutes?: number;
  reportedBy: string;
  awake: 'Yes' | 'No' | 'Unknown';
  bloodGroup: string;
  callerNote: string;
  createdAt: string;
}

export type UnitType = 'Ambulance' | 'Motor medic' | 'Rapid response';
export type UnitStatus = 'AVAILABLE' | 'EN_ROUTE' | 'BUSY' | 'RETURNING' | 'OFFLINE';

export interface DispatcherUnit {
  id: string;
  name: string;
  type: UnitType;
  regNumber: string;
  status: UnitStatus;
  distanceKm?: number;
  isReturning?: boolean;
  etaMinutes?: number;
  currentEmergencyId?: string;
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
  badgeNumber: string;
  role: string;
  isOnShift: boolean;
  shiftStartedAt: string;
}

export interface CaseIntakePayload {
  severity: EmergencySeverity;
  title: string;
  secondaryText: string;
  location: string;
  reportedBy: string;
  awake: 'Yes' | 'No' | 'Unknown';
  bloodGroup?: string;
  callerNote: string;
}
