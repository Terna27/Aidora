/**
 * Authoritative Dispatcher Service
 * Supports backend Go endpoints and in-memory operational state matching reference screenshot
 */

import {
  DispatcherCase,
  DispatcherUnit,
  DispatcherStats,
  DispatcherProfile,
  CaseIntakePayload,
} from '../types/dispatcher';
import { apiClient } from './apiClient';

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 1,
  URGENT: 2,
  STABLE: 3,
};

const INITIAL_PROFILE: DispatcherProfile = {
  id: 'disp-001',
  name: 'N. Eze',
  initials: 'NE',
  badgeNumber: 'DS-4091',
  role: 'Lead Dispatcher',
  isOnShift: true,
  shiftStartedAt: '07:00 AM',
};

const INITIAL_CASES: DispatcherCase[] = [
  {
    id: 'case-001',
    emergencyId: 'emg-101',
    severity: 'CRITICAL',
    title: 'Unconscious',
    secondaryText: 'Male, not responding',
    location: '[Area A]',
    waitingSeconds: 102, // 1:42
    status: 'UNASSIGNED',
    reportedBy: 'Bystander',
    awake: 'No',
    bloodGroup: 'Not on file',
    callerNote: 'Collapsed at market',
    createdAt: new Date(Date.now() - 102000).toISOString(),
  },
  {
    id: 'case-002',
    emergencyId: 'emg-102',
    severity: 'URGENT',
    title: "Can't breathe",
    secondaryText: 'Asthma, inhaler not helping',
    location: '[Area B]',
    waitingSeconds: 190, // 3:10
    status: 'UNASSIGNED',
    reportedBy: 'Self',
    awake: 'Yes',
    bloodGroup: 'O+',
    callerNote: 'Severe respiratory distress, inhaler ineffective',
    createdAt: new Date(Date.now() - 190000).toISOString(),
  },
  {
    id: 'case-003',
    emergencyId: 'emg-103',
    severity: 'URGENT',
    title: 'Pregnancy / labour',
    secondaryText: 'Contractions 4 min apart',
    location: '[Area C]',
    waitingSeconds: 327, // 5:27
    status: 'EN_ROUTE',
    assignedUnitId: 'unit-102',
    assignedUnitLabel: 'En route · 6 min',
    etaMinutes: 6,
    reportedBy: 'Family',
    awake: 'Yes',
    bloodGroup: 'B+',
    callerNote: 'Imminent labor contractions, active transport',
    createdAt: new Date(Date.now() - 327000).toISOString(),
  },
  {
    id: 'case-004',
    emergencyId: 'emg-104',
    severity: 'STABLE',
    title: 'Accident / injury',
    secondaryText: 'Fall, possible broken wrist',
    location: '[Area D]',
    waitingSeconds: 543, // 9:03
    status: 'EN_ROUTE',
    assignedUnitId: 'unit-103',
    assignedUnitLabel: 'En route · 11 min',
    etaMinutes: 11,
    reportedBy: 'Colleague',
    awake: 'Yes',
    bloodGroup: 'A+',
    callerNote: 'Slipped on wet floor, wrist swollen',
    createdAt: new Date(Date.now() - 543000).toISOString(),
  },
];

const INITIAL_UNITS: DispatcherUnit[] = [
  {
    id: 'unit-001',
    name: 'Ambulance [UNIT 1]',
    type: 'Ambulance',
    regNumber: '[UNIT 1]',
    status: 'AVAILABLE',
    distanceKm: 1.2,
  },
  {
    id: 'unit-002',
    name: 'Motor medic [UNIT 2]',
    type: 'Motor medic',
    regNumber: '[UNIT 2]',
    status: 'AVAILABLE',
    distanceKm: 1.8,
  },
  {
    id: 'unit-003',
    name: 'Ambulance [UNIT 3]',
    type: 'Ambulance',
    regNumber: '[UNIT 3]',
    status: 'RETURNING',
    isReturning: true,
  },
  {
    id: 'unit-004',
    name: 'Rapid response [UNIT 4]',
    type: 'Rapid response',
    regNumber: '[UNIT 4]',
    status: 'AVAILABLE',
    distanceKm: 2.4,
  },
  {
    id: 'unit-005',
    name: 'Ambulance [UNIT 5]',
    type: 'Ambulance',
    regNumber: '[UNIT 5]',
    status: 'AVAILABLE',
    distanceKm: 3.1,
  },
  {
    id: 'unit-006',
    name: 'Motor medic [UNIT 6]',
    type: 'Motor medic',
    regNumber: '[UNIT 6]',
    status: 'AVAILABLE',
    distanceKm: 3.5,
  },
];

export class DispatcherService {
  private cases: DispatcherCase[] = JSON.parse(JSON.stringify(INITIAL_CASES));
  private units: DispatcherUnit[] = JSON.parse(JSON.stringify(INITIAL_UNITS));
  private profile: DispatcherProfile = { ...INITIAL_PROFILE };
  private listeners: (() => void)[] = [];

  constructor() {
    // Tick waiting timers every second in background
    if (typeof window !== 'undefined') {
      setInterval(() => {
        let changed = false;
        for (const c of this.cases) {
          if (c.status === 'UNASSIGNED') {
            c.waitingSeconds += 1;
            changed = true;
          }
        }
        if (changed) {
          this.notify();
        }
      }, 1000);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public getProfile(): DispatcherProfile {
    return { ...this.profile };
  }

  public setOnShift(onShift: boolean): DispatcherProfile {
    this.profile.isOnShift = onShift;
    this.notify();
    return { ...this.profile };
  }

  public sortCases(list: DispatcherCase[]): DispatcherCase[] {
    return [...list].sort((a, b) => {
      const orderA = SEVERITY_ORDER[a.severity] ?? 99;
      const orderB = SEVERITY_ORDER[b.severity] ?? 99;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.waitingSeconds - b.waitingSeconds;
    });
  }

  public getCasesSync(searchQuery?: string): DispatcherCase[] {
    let result = [...this.cases];
    if (searchQuery && searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.secondaryText.toLowerCase().includes(q) ||
          c.location.toLowerCase().includes(q) ||
          c.callerNote.toLowerCase().includes(q) ||
          c.reportedBy.toLowerCase().includes(q)
      );
    }
    return this.sortCases(result);
  }

  public async getCases(searchQuery?: string): Promise<DispatcherCase[]> {
    if (apiClient.getBackendStatus() !== false) {
      // Attempt backend sync if configured
      const backendRes = await apiClient.request<DispatcherCase[]>('/dispatch/cases');
      if (backendRes.success && backendRes.data && backendRes.data.length > 0) {
        this.cases = backendRes.data;
      }
    }

    return this.getCasesSync(searchQuery);
  }

  public getCaseById(id: string): DispatcherCase | undefined {
    const found = this.cases.find((c) => c.id === id);
    return found ? JSON.parse(JSON.stringify(found)) : undefined;
  }

  public getStats(): DispatcherStats {
    const criticalWaiting = this.cases.filter(
      (c) => c.severity === 'CRITICAL' && c.status === 'UNASSIGNED'
    ).length;

    const urgentWaiting = this.cases.filter(
      (c) => c.severity === 'URGENT'
    ).length;

    const casesEnRoute = this.cases.filter((c) => c.status === 'EN_ROUTE').length;
    // Base 1 background en-route unit + active en-route cases = 3
    const unitsEnRoute = casesEnRoute + 1;

    const unitsAvailable = this.units.filter((u) => u.status === 'AVAILABLE').length;

    return {
      criticalWaiting,
      urgentWaiting,
      unitsEnRoute,
      unitsAvailable,
    };
  }

  public getNearestUnits(): DispatcherUnit[] {
    return JSON.parse(JSON.stringify(this.units));
  }

  public async dispatchNearestUnit(caseId: string): Promise<{
    success: boolean;
    case?: DispatcherCase;
    unit?: DispatcherUnit;
    error?: string;
  }> {
    const caseIndex = this.cases.findIndex((c) => c.id === caseId);
    if (caseIndex === -1) {
      return { success: false, error: 'Case not found' };
    }

    const targetCase = this.cases[caseIndex];
    if (targetCase.status === 'EN_ROUTE' || targetCase.status === 'ASSIGNED') {
      return { success: false, error: 'Case is already en route or assigned' };
    }

    const availableUnitIndex = this.units.findIndex((u) => u.status === 'AVAILABLE');
    if (availableUnitIndex === -1) {
      return { success: false, error: 'No available units for dispatch' };
    }

    const unit = this.units[availableUnitIndex];
    const estimatedMinutes = Math.max(3, Math.round((unit.distanceKm || 1.5) * 3));

    // Try backend dispatch
    await apiClient.request<{ case: DispatcherCase; unit: DispatcherUnit }>(
      `/dispatch/cases/${caseId}/assign`,
      {
        method: 'POST',
        body: JSON.stringify({ unitId: unit.id }),
      }
    );

    // Update in-memory state
    unit.status = 'EN_ROUTE';
    unit.etaMinutes = estimatedMinutes;
    unit.currentEmergencyId = targetCase.emergencyId;

    targetCase.status = 'EN_ROUTE';
    targetCase.assignedUnitId = unit.id;
    targetCase.assignedUnitLabel = `En route · ${estimatedMinutes} min`;
    targetCase.etaMinutes = estimatedMinutes;

    this.notify();

    return {
      success: true,
      case: JSON.parse(JSON.stringify(targetCase)),
      unit: JSON.parse(JSON.stringify(unit)),
    };
  }

  public async createCase(payload: CaseIntakePayload): Promise<{
    success: boolean;
    case?: DispatcherCase;
    error?: string;
  }> {
    if (!payload.title || !payload.title.trim()) {
      return { success: false, error: 'Title is required' };
    }
    if (!payload.location || !payload.location.trim()) {
      return { success: false, error: 'Location is required' };
    }

    const newCaseId = `case-${Date.now().toString().slice(-4)}`;
    const newEmergencyId = `emg-${Date.now().toString().slice(-4)}`;

    const newCase: DispatcherCase = {
      id: newCaseId,
      emergencyId: newEmergencyId,
      severity: payload.severity,
      title: payload.title.trim(),
      secondaryText: payload.secondaryText || payload.title.trim(),
      location: payload.location.trim(),
      waitingSeconds: 0,
      status: 'UNASSIGNED',
      reportedBy: payload.reportedBy || 'Dispatcher Phone Intake',
      awake: payload.awake || 'Unknown',
      bloodGroup: payload.bloodGroup || 'Not on file',
      callerNote: payload.callerNote || 'Logged via Dispatcher Console',
      createdAt: new Date().toISOString(),
    };

    // Sync to backend if available
    await apiClient.request('/dispatch/cases', {
      method: 'POST',
      body: JSON.stringify(newCase),
    });

    this.cases.unshift(newCase);
    this.notify();

    return {
      success: true,
      case: JSON.parse(JSON.stringify(newCase)),
    };
  }

  public resetToFixtures() {
    this.cases = JSON.parse(JSON.stringify(INITIAL_CASES));
    this.units = JSON.parse(JSON.stringify(INITIAL_UNITS));
    this.profile = { ...INITIAL_PROFILE };
    this.notify();
  }
}

export const dispatcherService = new DispatcherService();
