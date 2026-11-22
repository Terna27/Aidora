
import {
  EmergencyRecord,
  EmergencyState,
  EmergencyLocation,
  BackendCreateEmergencyResponse,
} from '../types/emergency';
import {
  PatientProfile,
  EmergencyContact,
  TriggerSOSPayload,
} from '../types/patient';
import { authService } from './auth/authService';
import { apiClient } from './apiClient';

type PendingSOS = {
  patientId: string;
  key: string;
  body: string;
  createdAt: number;
};

type SOSResult = {
  success: boolean;
  emergency?: EmergencyRecord;
  error?: string;
};

const PENDING_KEY = 'aidora_pending_sos_v2';
const CONFIRMED_KEY = 'aidora_confirmed_sos_v1';
const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

const clone = <T,>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T;

export class PatientService {
  private profile: PatientProfile = {
    id: '',
    fullName: '',
    phone: '',
    bloodGroup: '',
    emergencyContacts: [],
  };

  private activeEmergency: EmergencyRecord | null = null;
  private history: EmergencyRecord[] = [];
  private listeners: (() => void)[] = [];

  private pendingSOS: PendingSOS | null = null;

  constructor() {
    this.loadPendingSOS();
  }

  private currentPatientId(): string | null {
    const session = authService.getCurrentSession();

    if (!session.isAuthenticated || !session.user?.id) {
      return null;
    }

    return session.user.id;
  }

  private generateSOSKey(): string {
    return crypto.randomUUID();
  }

  private loadPendingSOS(): void {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return;

      const parsed: unknown = JSON.parse(raw);

      if (!parsed || typeof parsed !== 'object') return;

      const value = parsed as Partial<PendingSOS>;

      if (
        typeof value.patientId !== 'string' ||
        !value.patientId ||
        typeof value.key !== 'string' ||
        !value.key ||
        typeof value.body !== 'string' ||
        !value.body ||
        typeof value.createdAt !== 'number' ||
        !Number.isFinite(value.createdAt)
      ) {
        return;
      }

      this.pendingSOS = value as PendingSOS;
    } catch {
      // Storage is unavailable or invalid.
    }
  }

  private savePendingSOS(): void {
    if (!this.pendingSOS) return;

    sessionStorage.setItem(
      PENDING_KEY,
      JSON.stringify(this.pendingSOS)
    );
  }

  private clearPendingSOS(): void {
    this.pendingSOS = null;

    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {
      // No action required.
    }
  }

  private restoreConfirmedEmergency(patientId: string): void {
    try {
      const raw = sessionStorage.getItem(CONFIRMED_KEY);
      if (!raw) return;

      const stored = JSON.parse(raw) as {
        patientId?: string;
        emergency?: EmergencyRecord;
      };

      if (
        stored.patientId === patientId &&
        stored.emergency?.id
      ) {
        this.activeEmergency = stored.emergency;
      }
    } catch {
      // Do not manufacture emergency state.
    }
  }

  private saveConfirmedEmergency(
    patientId: string,
    emergency: EmergencyRecord
  ): void {
    try {
      sessionStorage.setItem(
        CONFIRMED_KEY,
        JSON.stringify({ patientId, emergency })
      );
    } catch {
      // Backend confirmation remains valid even if
      // browser storage is unavailable.
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);

    return () => {
      this.listeners = this.listeners.filter(
        (item) => item !== listener
      );
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public getProfile(): PatientProfile {
    const user = authService.getCurrentSession().user;

    if (!user) {
      return {
        id: '',
        fullName: '',
        phone: '',
        bloodGroup: '',
        emergencyContacts: [],
      };
    }

    if (this.profile.id !== user.id) {
      this.profile = {
        id: user.id,
        fullName: user.fullName,
        phone: user.phoneNumber ?? '',
        bloodGroup: '',
        emergencyContacts: [],
      };
    }

    return clone(this.profile);
  }

  public updateProfile(
    updates: Partial<PatientProfile>
  ): PatientProfile {
    const current = this.getProfile();

    this.profile = {
      ...current,
      ...updates,
      id: current.id,
    };

    this.notify();
    return this.getProfile();
  }

  public addContact(
    contact: Omit<EmergencyContact, 'id'>
  ): EmergencyContact {
    this.getProfile();

    const newContact: EmergencyContact = {
      ...contact,
      id: crypto.randomUUID(),
    };

    this.profile.emergencyContacts.push(newContact);
    this.notify();

    return clone(newContact);
  }

  public removeContact(contactId: string): boolean {
    this.getProfile();

    const previousLength =
      this.profile.emergencyContacts.length;

    this.profile.emergencyContacts =
      this.profile.emergencyContacts.filter(
        (contact) => contact.id !== contactId
      );

    const removed =
      this.profile.emergencyContacts.length <
      previousLength;

    if (removed) this.notify();

    return removed;
  }

  public getActiveEmergency(): EmergencyRecord | null {
    const patientId = this.currentPatientId();

    if (!patientId) return null;

    if (
      this.activeEmergency &&
      this.activeEmergency.reportedBy === 'PATIENT'
    ) {
      // The active record is scoped to the user
      // through the confirmed emergency storage below.
      const raw = (() => {
        try {
          return sessionStorage.getItem(CONFIRMED_KEY);
        } catch {
          return null;
        }
      })();

      if (!raw) return null;

      try {
        const stored = JSON.parse(raw) as {
          patientId?: string;
        };

        if (stored.patientId !== patientId) {
          return null;
        }
      } catch {
        return null;
      }

      return clone(this.activeEmergency);
    }

    this.restoreConfirmedEmergency(patientId);

    return this.activeEmergency
      ? clone(this.activeEmergency)
      : null;
  }

  public getHistory(): EmergencyRecord[] {
    return clone(this.history);
  }

  public async triggerSOS(
    payload: TriggerSOSPayload
  ): Promise<SOSResult> {
    const patientId = this.currentPatientId();

    if (!patientId) {
      return {
        success: false,
        error: 'Sign in before submitting an SOS.',
      };
    }

    if (this.getActiveEmergency()) {
      return {
        success: false,
        error:
          'An emergency has already been confirmed. ' +
          'Check its status before submitting another.',
      };
    }

    const input = payload.location;

    if (!input || !['GPS', 'MANUAL'].includes(input.type)) {
      return {
        success: false,
        error: 'A valid emergency location is required.',
      };
    }

    const location: EmergencyLocation = {
      address: input.address?.trim() ?? '',
      landmark: input.landmark?.trim(),
      communityBase: input.communityBase?.trim(),
      type: input.type,
      coords: input.type === 'GPS' ? input.coords : undefined,
    };

    if (location.type === 'GPS') {
      const lat = location.coords?.lat;
      const lng = location.coords?.lng;

      if (
        typeof lat !== 'number' ||
        typeof lng !== 'number' ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        return {
          success: false,
          error: 'Valid GPS coordinates are required.',
        };
      }
    } else if (
      !location.address &&
      !location.landmark &&
      !location.communityBase
    ) {
      return {
        success: false,
        error:
          'Enter a street address, landmark, or community.',
      };
    }

    const requestBody = JSON.stringify({
      source: location.type,
      ...(location.type === 'GPS'
        ? {
          latitude: location.coords!.lat,
          longitude: location.coords!.lng,
        }
        : {
          streetAddress: location.address || undefined,
          landmark: location.landmark || undefined,
          villageCommunity:
            location.communityBase || undefined,
        }),
      notes: [
        payload.chiefComplaint,
        payload.notes,
      ]
        .filter(Boolean)
        .join(' - '),
    });

    if (this.pendingSOS) {
      if (this.pendingSOS.patientId !== patientId) {
        return {
          success: false,
          error:
            'An unresolved SOS request belongs to another ' +
            'signed-in patient in this browser tab. ' +
            'Its outcome must be resolved first.',
        };
      }

      if (this.pendingSOS.body !== requestBody) {
        return {
          success: false,
          error:
            'A previous SOS request may already have reached ' +
            'the backend. Keep the original details until ' +
            'its outcome is confirmed.',
        };
      }

      const age = Date.now() - this.pendingSOS.createdAt;

      if (
        age < 0 ||
        age >= IDEMPOTENCY_WINDOW_MS
      ) {
        return {
          success: false,
          error:
            'The pending SOS request is outside the safe ' +
            'retry window. Its status must be checked ' +
            'before creating another request.',
        };
      }
    } else {
      this.pendingSOS = {
        patientId,
        key: this.generateSOSKey(),
        body: requestBody,
        createdAt: Date.now(),
      };

      try {
        this.savePendingSOS();
      } catch {
        this.pendingSOS = null;

        return {
          success: false,
          error:
            'Unable to preserve the SOS request safely. ' +
            'Check browser storage and try again.',
        };
      }
    }

    const pending = this.pendingSOS;

    if (!pending) {
      return {
        success: false,
        error: 'Unable to prepare the SOS request.',
      };
    }

    try {
      const response =
        await apiClient.request<BackendCreateEmergencyResponse>(
          '/emergencies',
          {
            method: 'POST',
            headers: {
              'Idempotency-Key': pending.key,
            },
            body: pending.body,
          }
        );

      if (!response.success) {
        return {
          success: false,
          error:
            response.error ||
            'SOS was not confirmed. Please check the request status.',
        };
      }

      if (!response.data) {
        return {
          success: false,
          error:
            'The backend response did not contain emergency details. ' +
            'The request outcome must be verified before retrying.',
        };
      }

      const data = response.data;

      if (
        typeof data.id !== 'string' ||
        !data.id ||
        !['CREATED', 'DISPATCHING'].includes(data.state) ||
        data.locationSource !== location.type ||
        typeof data.createdAt !== 'string' ||
        !Number.isFinite(Date.parse(data.createdAt))
      ) {
        return {
          success: false,
          error:
            'The backend returned an unexpected emergency ' +
            'response. Its outcome must be verified.',
        };
      }

      const emergency: EmergencyRecord = {
        id: data.id,
        state: data.state,
        severity: payload.severity ?? 'CRITICAL',
        chiefComplaint:
          payload.chiefComplaint || 'Emergency SOS',
        reportedBy: 'PATIENT',
        patientName:
          authService.getCurrentSession().user?.fullName,
        callerNote: payload.notes,
        location,
        milestones: [
          {
            state: data.state,
            timestamp: data.createdAt,
          },
        ],
        createdAt: data.createdAt,
        updatedAt: data.createdAt,
      };

      this.activeEmergency = emergency;
      this.saveConfirmedEmergency(patientId, emergency);
      this.clearPendingSOS();
      this.notify();

      return {
        success: true,
        emergency: clone(emergency),
      };
    } catch {
      return {
        success: false,
        error:
          'SOS confirmation could not be obtained. ' +
          'The request may have reached the backend. ' +
          'Retry only with the original request details.',
      };
    }
  }

  public async advanceState(
    _nextState: EmergencyState,
    _note?: string
  ): Promise<SOSResult> {
    return {
      success: false,
      error:
        'Emergency state changes must be confirmed by ' +
        'the backend. Local simulation is disabled.',
    };
  }

  public async cancelEmergency(
    _reason: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    return {
      success: false,
      error:
        'Emergency cancellation is not connected to ' +
        'the backend yet. Contact emergency support ' +
        'rather than assuming cancellation succeeded.',
    };
  }

  public resetToFixtures(): void {
    // Legacy compatibility for existing tests.
    // No fictional patient or emergency data is loaded.
    this.activeEmergency = null;
    this.history = [];
    this.notify();
  }
}

export const patientService = new PatientService();
