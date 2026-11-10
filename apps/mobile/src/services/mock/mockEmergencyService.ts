import {
  EmergencyRequest,
  EmergencyState,
  LocationData,
  EMERGENCY_STATE_METADATA,
} from '../../types/emergency';
import {
  MOCK_RESPONDERS,
  MOCK_FACILITIES,
  INITIAL_MOCK_HISTORY,
} from './mockData';
import { ApiError } from '../api/client';

export interface IEmergencyService {
  submitEmergency(
    patientId: string,
    patientName: string,
    patientPhone: string,
    location: LocationData,
    notes?: string
  ): Promise<EmergencyRequest>;
  getActiveEmergency(patientId: string): Promise<EmergencyRequest | null>;
  simulateNextState(emergencyId: string): Promise<EmergencyRequest>;
  simulateState(emergencyId: string, targetState: EmergencyState): Promise<EmergencyRequest>;
  cancelEmergency(emergencyId: string, reason?: string): Promise<EmergencyRequest>;
  dismissEmergency(emergencyId: string): Promise<void>;
  getEmergencyHistory(patientId: string): Promise<EmergencyRequest[]>;
}

export class MockEmergencyService implements IEmergencyService {
  private activeEmergency: EmergencyRequest | null = null;
  private history: EmergencyRequest[] = [...INITIAL_MOCK_HISTORY];
  private shouldFailNextSubmission = false;

  /**
   * Submit an emergency transportation request.
   * Prevents duplicate submissions if a non-terminal emergency is already in progress.
   * Creates initial CREATED state and moves to DISPATCHING.
   */
  async submitEmergency(
    patientId: string,
    patientName: string,
    patientPhone: string,
    location: LocationData,
    notes?: string
  ): Promise<EmergencyRequest> {
    await new Promise((r) => setTimeout(r, 600));

    if (this.shouldFailNextSubmission) {
      this.shouldFailNextSubmission = false;
      throw new ApiError(
        'Server dispatch service unreachable. Please retry or call the emergency hotline directly.',
        'NETWORK_TIMEOUT',
        503
      );
    }

    // PREVENT DUPLICATE ACTIVE EMERGENCIES
    if (this.activeEmergency && this.activeEmergency.patientId === patientId) {
      const meta = EMERGENCY_STATE_METADATA[this.activeEmergency.status];
      if (!meta.isTerminal) {
        throw new ApiError(
          `You already have an active emergency request in progress (${meta.label}).`,
          'ACTIVE_EMERGENCY_EXISTS',
          409,
          { activeEmergencyId: this.activeEmergency.id, status: this.activeEmergency.status }
        );
      }
    }

    if (!location.villageCommunity && !location.landmark && !location.coords) {
      throw new ApiError(
        'Location details required. Please specify a community or landmark.',
        'MISSING_LOCATION',
        400
      );
    }

    const now = new Date().toISOString();
    const emergency: EmergencyRequest = {
      id: `em-${Date.now().toString().slice(-6)}`,
      patientId,
      patientName,
      patientPhone,
      status: 'CREATED',
      location,
      notes,
      createdAt: now,
      updatedAt: now,
      history: [{ state: 'CREATED', timestamp: now, note: 'Request received by system' }],
    };

    // Auto-advance from CREATED to DISPATCHING to simulate server dispatch engine acknowledgement
    emergency.status = 'DISPATCHING';
    emergency.history.push({
      state: 'DISPATCHING',
      timestamp: new Date().toISOString(),
      note: 'Alerting verified local drivers in vicinity',
    });

    this.activeEmergency = emergency;
    return emergency;
  }

  async getActiveEmergency(patientId: string): Promise<EmergencyRequest | null> {
    if (this.activeEmergency && this.activeEmergency.patientId === patientId) {
      return this.activeEmergency;
    }
    return null;
  }

  /**
   * Helper to simulate the next state in the happy-path journey:
   * CREATED -> DISPATCHING -> ACCEPTED -> PICKUP_ARRIVED -> PATIENT_ONBOARD
   * -> HOSPITAL_SELECTED -> IN_TRANSIT -> ARRIVED -> COMPLETED
   */
  async simulateNextState(emergencyId: string): Promise<EmergencyRequest> {
    if (!this.activeEmergency || this.activeEmergency.id !== emergencyId) {
      throw new ApiError('Active emergency not found', 'NOT_FOUND', 404);
    }

    const current = this.activeEmergency.status;
    let nextState: EmergencyState = current;

    switch (current) {
      case 'CREATED':
        nextState = 'DISPATCHING';
        break;
      case 'DISPATCHING':
      case 'REASSIGNING':
        nextState = 'ACCEPTED';
        this.activeEmergency.assignedResponder = MOCK_RESPONDERS[0];
        break;
      case 'ACCEPTED':
        nextState = 'PICKUP_ARRIVED';
        break;
      case 'PICKUP_ARRIVED':
        nextState = 'PATIENT_ONBOARD';
        break;
      case 'PATIENT_ONBOARD':
        nextState = 'HOSPITAL_SELECTED';
        this.activeEmergency.destinationFacility = MOCK_FACILITIES[0];
        break;
      case 'HOSPITAL_SELECTED':
        nextState = 'IN_TRANSIT';
        break;
      case 'IN_TRANSIT':
        nextState = 'ARRIVED';
        break;
      case 'ARRIVED':
        nextState = 'COMPLETED';
        break;
      default:
        return this.activeEmergency;
    }

    const now = new Date().toISOString();
    this.activeEmergency.status = nextState;
    this.activeEmergency.updatedAt = now;
    this.activeEmergency.history.push({
      state: nextState,
      timestamp: now,
      note: EMERGENCY_STATE_METADATA[nextState].description,
    });

    // When reaching COMPLETED, archive to history but DO NOT wipe activeEmergency yet,
    // so the patient sees the completion card until dismissed.
    if (nextState === 'COMPLETED') {
      // Avoid duplicate in history if already present
      if (!this.history.find((h) => h.id === this.activeEmergency?.id)) {
        this.history.unshift({ ...this.activeEmergency });
      }
    }

    return this.activeEmergency;
  }

  /**
   * Simulate alternative states (EXPIRED, ESCALATED, REASSIGNING, FAILED_CONTACT)
   */
  async simulateState(emergencyId: string, targetState: EmergencyState): Promise<EmergencyRequest> {
    if (!this.activeEmergency || this.activeEmergency.id !== emergencyId) {
      throw new ApiError('Active emergency not found', 'NOT_FOUND', 404);
    }

    const now = new Date().toISOString();
    this.activeEmergency.status = targetState;
    this.activeEmergency.updatedAt = now;
    this.activeEmergency.history.push({
      state: targetState,
      timestamp: now,
      note: EMERGENCY_STATE_METADATA[targetState].description,
    });

    if (targetState === 'EXPIRED' || targetState === 'FAILED_CONTACT') {
      if (!this.history.find((h) => h.id === this.activeEmergency?.id)) {
        this.history.unshift({ ...this.activeEmergency });
      }
    }

    return this.activeEmergency;
  }

  async cancelEmergency(emergencyId: string, reason = 'Patient requested cancellation'): Promise<EmergencyRequest> {
    if (!this.activeEmergency || this.activeEmergency.id !== emergencyId) {
      throw new ApiError('Active emergency not found', 'NOT_FOUND', 404);
    }

    const meta = EMERGENCY_STATE_METADATA[this.activeEmergency.status];
    if (!meta.canCancel) {
      throw new ApiError(
        `Cannot cancel emergency once in state '${meta.label}'. Please contact facility or dispatcher directly.`,
        'CANCELLATION_FORBIDDEN',
        400
      );
    }

    const now = new Date().toISOString();
    this.activeEmergency.status = 'CANCELLED';
    this.activeEmergency.cancellationReason = reason;
    this.activeEmergency.updatedAt = now;
    this.activeEmergency.history.push({
      state: 'CANCELLED',
      timestamp: now,
      note: `Cancelled: ${reason}`,
    });

    this.history.unshift({ ...this.activeEmergency });
    const cancelled = this.activeEmergency;
    this.activeEmergency = null;
    return cancelled;
  }

  /**
   * Explicitly dismiss/clear an emergency that has concluded (COMPLETED, EXPIRED, etc.)
   */
  async dismissEmergency(emergencyId: string): Promise<void> {
    if (this.activeEmergency && this.activeEmergency.id === emergencyId) {
      this.activeEmergency = null;
    }
  }

  async getEmergencyHistory(patientId: string): Promise<EmergencyRequest[]> {
    return this.history.filter((h) => h.patientId === patientId);
  }

  // Developer testing utility
  setSimulateFailureNext(fail: boolean) {
    this.shouldFailNextSubmission = fail;
  }

  reset() {
    this.activeEmergency = null;
    this.history = [...INITIAL_MOCK_HISTORY];
    this.shouldFailNextSubmission = false;
  }
}

export const mockEmergencyService = new MockEmergencyService();
