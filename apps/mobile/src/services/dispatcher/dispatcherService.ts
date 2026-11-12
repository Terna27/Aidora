import {
  DispatcherCase,
  DispatcherUnit,
  DispatcherStats,
  DispatcherProfile,
  NewCasePayload,
  EmergencySeverity,
} from '../../types/dispatcher';
import { ApiError } from '../api/client';

export interface IDispatcherService {
  getCases(searchQuery?: string): Promise<DispatcherCase[]>;
  getCaseById(id: string): Promise<DispatcherCase | null>;
  getNearestUnits(limit?: number): Promise<DispatcherUnit[]>;
  getStats(): Promise<DispatcherStats>;
  getProfile(): Promise<DispatcherProfile>;
  assignNearestUnit(caseId: string): Promise<{ case: DispatcherCase; unit: DispatcherUnit }>;
  assignSpecificUnit(caseId: string, unitId: string): Promise<{ case: DispatcherCase; unit: DispatcherUnit }>;
  createNewCase(payload: NewCasePayload): Promise<DispatcherCase>;
  resetToDefault(): void;
}

const SEVERITY_ORDER: Record<EmergencySeverity, number> = {
  CRITICAL: 1,
  URGENT: 2,
  STABLE: 3,
};

const DEFAULT_PROFILE: DispatcherProfile = {
  id: 'disp-401',
  name: 'N. Eze',
  initials: 'NE',
  role: 'Lead Emergency Dispatcher',
  shiftStatus: 'On shift',
};

const INITIAL_CASES: DispatcherCase[] = [
  {
    id: 'case-001',
    severity: 'CRITICAL',
    emergencyTitle: 'Unconscious',
    emergencyDescription: 'Male, not responding',
    locationArea: '[Area A]',
    landmark: 'Market Square Junction, Sector 1',
    coords: { latitude: 9.0765, longitude: 7.3986 },
    reportedAt: new Date(Date.now() - 102 * 1000).toISOString(),
    elapsedSeconds: 102,
    status: 'UNASSIGNED',
    reportedBy: 'Bystander',
    isAwake: false,
    bloodGroup: 'Not on file',
    callerNote: 'Collapsed at market',
  },
  {
    id: 'case-002',
    severity: 'URGENT',
    emergencyTitle: "Can't breathe",
    emergencyDescription: 'Asthma, inhaler not helping',
    locationArea: '[Area B]',
    landmark: 'Behind Community Secondary School',
    coords: { latitude: 9.0821, longitude: 7.4012 },
    reportedAt: new Date(Date.now() - 190 * 1000).toISOString(),
    elapsedSeconds: 190,
    status: 'UNASSIGNED',
    reportedBy: 'Relative',
    isAwake: true,
    bloodGroup: 'A+',
    callerNote: 'Severe wheezing, inhaler empty',
  },
  {
    id: 'case-003',
    severity: 'URGENT',
    emergencyTitle: 'Pregnancy / labour',
    emergencyDescription: 'Contractions 4 min apart',
    locationArea: '[Area C]',
    landmark: 'Near Water Borehole Station',
    coords: { latitude: 9.0694, longitude: 7.412 },
    reportedAt: new Date(Date.now() - 327 * 1000).toISOString(),
    elapsedSeconds: 327,
    status: 'EN_ROUTE',
    statusLabel: 'En route · 6 min',
    assignedUnitId: 'UNIT 4',
    assignedUnitEtaMinutes: 6,
    reportedBy: 'Patient',
    isAwake: true,
    bloodGroup: 'O+',
    callerNote: 'Contractions accelerating, second child',
  },
  {
    id: 'case-004',
    severity: 'STABLE',
    emergencyTitle: 'Accident / injury',
    emergencyDescription: 'Fall, possible broken wrist',
    locationArea: '[Area D]',
    landmark: 'Expressway Motor Park Exit',
    coords: { latitude: 9.0911, longitude: 7.3892 },
    reportedAt: new Date(Date.now() - 543 * 1000).toISOString(),
    elapsedSeconds: 543,
    status: 'EN_ROUTE',
    statusLabel: 'En route · 11 min',
    assignedUnitId: 'UNIT 5',
    assignedUnitEtaMinutes: 11,
    reportedBy: 'Self',
    isAwake: true,
    bloodGroup: 'B+',
    callerNote: 'Fall, possible broken wrist',
  },
];

const INITIAL_UNITS: DispatcherUnit[] = [
  {
    id: 'unit-1',
    name: 'Ambulance [UNIT 1]',
    unitType: 'Ambulance',
    operationalStatus: 'AVAILABLE',
    distanceLabel: '[x] km',
    distanceKm: 2.3,
  },
  {
    id: 'unit-2',
    name: 'Motor medic [UNIT 2]',
    unitType: 'Motor medic',
    operationalStatus: 'AVAILABLE',
    distanceLabel: '[x] km',
    distanceKm: 3.1,
  },
  {
    id: 'unit-3',
    name: 'Ambulance [UNIT 3]',
    unitType: 'Ambulance',
    operationalStatus: 'RETURNING',
    distanceLabel: 'Returning',
  },
  {
    id: 'unit-4',
    name: 'Ambulance [UNIT 4]',
    unitType: 'Ambulance',
    operationalStatus: 'BUSY',
    distanceLabel: 'En route · 6 min',
    etaMinutes: 6,
  },
  {
    id: 'unit-5',
    name: 'Motor medic [UNIT 5]',
    unitType: 'Motor medic',
    operationalStatus: 'BUSY',
    distanceLabel: 'En route · 11 min',
    etaMinutes: 11,
  },
  {
    id: 'unit-6',
    name: 'Ambulance [UNIT 6]',
    unitType: 'Ambulance',
    operationalStatus: 'AVAILABLE',
    distanceLabel: '[x] km',
    distanceKm: 4.5,
  },
  {
    id: 'unit-7',
    name: 'Motor medic [UNIT 7]',
    unitType: 'Motor medic',
    operationalStatus: 'AVAILABLE',
    distanceLabel: '[x] km',
    distanceKm: 5.2,
  },
  {
    id: 'unit-8',
    name: 'Taxi [UNIT 8]',
    unitType: 'Taxi',
    operationalStatus: 'AVAILABLE',
    distanceLabel: '[x] km',
    distanceKm: 5.8,
  },
  {
    id: 'unit-9',
    name: 'Taxi [UNIT 9]',
    unitType: 'Taxi',
    operationalStatus: 'BUSY',
    distanceLabel: 'En route · 14 min',
    etaMinutes: 14,
  },
];

export class DispatcherService implements IDispatcherService {
  private cases: DispatcherCase[] = JSON.parse(JSON.stringify(INITIAL_CASES));
  private units: DispatcherUnit[] = JSON.parse(JSON.stringify(INITIAL_UNITS));
  private profile: DispatcherProfile = { ...DEFAULT_PROFILE };

  async getCases(searchQuery?: string): Promise<DispatcherCase[]> {
    let result = [...this.cases];
    if (searchQuery && searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.emergencyTitle.toLowerCase().includes(q) ||
          c.emergencyDescription.toLowerCase().includes(q) ||
          c.locationArea.toLowerCase().includes(q) ||
          c.severity.toLowerCase().includes(q) ||
          c.reportedBy.toLowerCase().includes(q)
      );
    }

    // Sort by severity (CRITICAL > URGENT > STABLE), then waiting time (ascending matching screenshot 3:10 before 5:27)
    return result.sort((a, b) => {
      const diff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (diff !== 0) return diff;
      return a.elapsedSeconds - b.elapsedSeconds;
    });
  }

  async getCaseById(id: string): Promise<DispatcherCase | null> {
    const item = this.cases.find((c) => c.id === id);
    return item ? { ...item } : null;
  }

  async getNearestUnits(limit = 3): Promise<DispatcherUnit[]> {
    // Return primary operational units matching reference display
    return this.units.slice(0, limit).map((u) => ({ ...u }));
  }

  async getStats(): Promise<DispatcherStats> {
    const criticalWaiting = this.cases.filter(
      (c) => c.severity === 'CRITICAL' && c.status !== 'RESOLVED'
    ).length;

    const urgentWaiting = this.cases.filter(
      (c) => c.severity === 'URGENT' && c.status !== 'RESOLVED'
    ).length;

    const unitsEnRoute = this.units.filter((u) => u.operationalStatus === 'BUSY').length;
    const unitsAvailable = this.units.filter((u) => u.operationalStatus === 'AVAILABLE').length;

    return {
      criticalWaiting,
      urgentWaiting,
      unitsEnRoute,
      unitsAvailable,
    };
  }

  async getProfile(): Promise<DispatcherProfile> {
    return { ...this.profile };
  }

  async assignNearestUnit(caseId: string): Promise<{ case: DispatcherCase; unit: DispatcherUnit }> {
    const targetCase = this.cases.find((c) => c.id === caseId);
    if (!targetCase) {
      throw new ApiError('Case not found', 'NOT_FOUND', 404);
    }
    if (targetCase.status !== 'UNASSIGNED') {
      throw new ApiError(
        `Case is already assigned or en route (${targetCase.statusLabel || targetCase.status}).`,
        'ALREADY_ASSIGNED',
        400
      );
    }

    const availableUnit = this.units.find((u) => u.operationalStatus === 'AVAILABLE');
    if (!availableUnit) {
      throw new ApiError(
        'No units currently available. Please reassign from returning units or escalate.',
        'NO_UNITS_AVAILABLE',
        503
      );
    }

    return this.assignSpecificUnit(caseId, availableUnit.id);
  }

  async assignSpecificUnit(
    caseId: string,
    unitId: string
  ): Promise<{ case: DispatcherCase; unit: DispatcherUnit }> {
    const targetCase = this.cases.find((c) => c.id === caseId);
    if (!targetCase) {
      throw new ApiError('Case not found', 'NOT_FOUND', 404);
    }

    const unit = this.units.find((u) => u.id === unitId);
    if (!unit) {
      throw new ApiError('Unit not found', 'NOT_FOUND', 404);
    }

    const eta = unit.etaMinutes || Math.floor(Math.random() * 5) + 4;
    unit.operationalStatus = 'BUSY';
    unit.distanceLabel = `En route · ${eta} min`;
    unit.etaMinutes = eta;

    targetCase.status = 'EN_ROUTE';
    targetCase.statusLabel = `En route · ${eta} min`;
    targetCase.assignedUnitId = unit.id;
    targetCase.assignedUnitEtaMinutes = eta;

    return {
      case: { ...targetCase },
      unit: { ...unit },
    };
  }

  async createNewCase(payload: NewCasePayload): Promise<DispatcherCase> {
    if (!payload.emergencyTitle || !payload.locationArea) {
      throw new ApiError(
        'Emergency title and location area are required.',
        'VALIDATION_ERROR',
        400
      );
    }

    const newCase: DispatcherCase = {
      id: `case-${Date.now().toString().slice(-4)}`,
      severity: payload.severity,
      emergencyTitle: payload.emergencyTitle,
      emergencyDescription: payload.emergencyDescription,
      locationArea: payload.locationArea,
      reportedAt: new Date().toISOString(),
      elapsedSeconds: 0,
      status: 'UNASSIGNED',
      reportedBy: payload.reportedBy || 'Dispatcher Phone Desk',
      isAwake: payload.isAwake,
      bloodGroup: payload.bloodGroup || 'Not on file',
      callerNote: payload.callerNote || 'Dispatched via operator intake',
    };

    this.cases.unshift(newCase);
    return { ...newCase };
  }

  resetToDefault(): void {
    this.cases = JSON.parse(JSON.stringify(INITIAL_CASES));
    this.units = JSON.parse(JSON.stringify(INITIAL_UNITS));
    this.profile = { ...DEFAULT_PROFILE };
  }
}

export const dispatcherService = new DispatcherService();
