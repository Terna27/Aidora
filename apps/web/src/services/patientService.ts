/**
 * Patient Service
 * Manages patient emergencies, safety rules, contacts and health records
 */

import {
  EmergencyRecord,
  EmergencyState,
  EmergencyLocation,
  Facility,
} from '../types/emergency';
import { PatientProfile, EmergencyContact, TriggerSOSPayload } from '../types/patient';
import { apiClient } from './apiClient';

const INITIAL_PATIENT: PatientProfile = {
  id: 'pat-1001',
  fullName: 'Amina Bello',
  phone: '+234 803 123 4567',
  bloodGroup: 'O+',
  gestationalAgeWeeks: 34,
  allergies: ['Penicillin'],
  medicalNotes: 'High-risk pregnancy, 3rd trimester. Prior mild hypertension.',
  emergencyContacts: [
    {
      id: 'cnt-1',
      name: 'Ibrahim Bello',
      relationship: 'Husband',
      phone: '+234 802 987 6543',
      isPrimary: true,
    },
    {
      id: 'cnt-2',
      name: 'Dr. Fatima Aliyu',
      relationship: 'Primary Midwife',
      phone: '+234 805 111 2233',
      isPrimary: false,
    },
  ],
};

const DEFAULT_FACILITY: Facility = {
  id: 'fac-central',
  name: 'General Hospital Apex',
  type: 'HOSPITAL',
  address: 'Hospital Road, Central District',
  landmark: 'Near City Gate',
  totalBeds: 120,
  availableBeds: 14,
  specialties: ['Obstetrics', 'Trauma', 'Emergency Surgery'],
  contactPhone: '+234 800 999 0001',
  coords: { lat: 9.0578, lng: 7.4951 },
};

export class PatientService {
  private profile: PatientProfile = JSON.parse(JSON.stringify(INITIAL_PATIENT));
  private activeEmergency: EmergencyRecord | null = null;
  private history: EmergencyRecord[] = [];
  private listeners: (() => void)[] = [];

  constructor() {
    // Populate an initial completed history entry
    this.history.push({
      id: 'emg-hist-01',
      state: 'COMPLETED',
      severity: 'URGENT',
      chiefComplaint: 'Acute prenatal pain',
      reportedBy: 'PATIENT',
      location: {
        address: 'Block 4, Garki District',
        landmark: 'Near Post Office',
        type: 'MANUAL',
      },
      destinationFacility: DEFAULT_FACILITY,
      assignedResponderName: 'S. Musa',
      assignedVehicleType: 'Ambulance',
      assignedVehicleReg: 'ABJ-342-XY',
      milestones: [
        { state: 'CREATED', timestamp: '2026-10-14T08:00:00Z' },
        { state: 'DISPATCHING', timestamp: '2026-10-14T08:01:00Z' },
        { state: 'ACCEPTED', timestamp: '2026-10-14T08:03:00Z' },
        { state: 'PICKUP_ARRIVED', timestamp: '2026-10-14T08:14:00Z' },
        { state: 'PATIENT_ONBOARD', timestamp: '2026-10-14T08:18:00Z' },
        { state: 'IN_TRANSIT', timestamp: '2026-10-14T08:20:00Z' },
        { state: 'ARRIVED', timestamp: '2026-10-14T08:32:00Z' },
        { state: 'COMPLETED', timestamp: '2026-10-14T08:35:00Z', note: 'Handed over to triage lead' },
      ],
      createdAt: '2026-10-14T08:00:00Z',
      updatedAt: '2026-10-14T08:35:00Z',
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    for (const l of this.listeners) {
      l();
    }
  }

  public getProfile(): PatientProfile {
    return JSON.parse(JSON.stringify(this.profile));
  }

  public updateProfile(updates: Partial<PatientProfile>): PatientProfile {
    this.profile = { ...this.profile, ...updates };
    this.notify();
    return this.getProfile();
  }

  public addContact(contact: Omit<EmergencyContact, 'id'>): EmergencyContact {
    const newContact: EmergencyContact = {
      ...contact,
      id: `cnt-${Date.now().toString().slice(-4)}`,
    };
    this.profile.emergencyContacts.push(newContact);
    this.notify();
    return newContact;
  }

  public removeContact(contactId: string): boolean {
    const prevLen = this.profile.emergencyContacts.length;
    this.profile.emergencyContacts = this.profile.emergencyContacts.filter(
      (c) => c.id !== contactId
    );
    this.notify();
    return this.profile.emergencyContacts.length < prevLen;
  }

  public getActiveEmergency(): EmergencyRecord | null {
    return this.activeEmergency ? JSON.parse(JSON.stringify(this.activeEmergency)) : null;
  }

  public getHistory(): EmergencyRecord[] {
    return JSON.parse(JSON.stringify(this.history));
  }

  public async triggerSOS(payload: TriggerSOSPayload): Promise<{
    success: boolean;
    emergency?: EmergencyRecord;
    error?: string;
  }> {
    if (this.activeEmergency) {
      return {
        success: false,
        error: 'ACTIVE_EMERGENCY_EXISTS: An active emergency request is already in progress',
      };
    }

    if (!payload.location || !payload.location.address.trim()) {
      return {
        success: false,
        error: 'MISSING_LOCATION: Accurate pickup location is required',
      };
    }

    // Safety rule: if MANUAL, ensure no fake coords
    const location: EmergencyLocation = {
      address: payload.location.address.trim(),
      landmark: payload.location.landmark?.trim(),
      type: payload.location.type,
      coords: payload.location.type === 'GPS' ? payload.location.coords : undefined,
    };

    const emergencyId = `emg-${Date.now().toString().slice(-5)}`;
    const now = new Date().toISOString();

    const emergency: EmergencyRecord = {
      id: emergencyId,
      state: 'DISPATCHING', // CREATED -> DISPATCHING immediately upon submission
      severity: payload.severity || 'CRITICAL',
      chiefComplaint: payload.chiefComplaint || 'Emergency SOS Alert',
      reportedBy: 'PATIENT',
      patientName: this.profile.fullName,
      bloodGroup: this.profile.bloodGroup,
      isAwake: 'Yes',
      callerNote: payload.notes || 'Emergency SOS triggered via Patient Web Portal',
      location,
      destinationFacility: DEFAULT_FACILITY,
      milestones: [
        { state: 'CREATED', timestamp: now },
        { state: 'DISPATCHING', timestamp: now, note: 'Broadcasting to nearest verified units' },
      ],
      createdAt: now,
      updatedAt: now,
    };

    // Try backend
    await apiClient.request('/emergencies', {
      method: 'POST',
      body: JSON.stringify(emergency),
    });

    this.activeEmergency = emergency;
    this.notify();

    return {
      success: true,
      emergency: JSON.parse(JSON.stringify(emergency)),
    };
  }

  public async advanceState(nextState: EmergencyState, note?: string): Promise<{
    success: boolean;
    emergency?: EmergencyRecord;
    error?: string;
  }> {
    if (!this.activeEmergency) {
      return { success: false, error: 'No active emergency' };
    }

    const now = new Date().toISOString();
    this.activeEmergency.state = nextState;
    this.activeEmergency.updatedAt = now;
    this.activeEmergency.milestones.push({
      state: nextState,
      timestamp: now,
      note,
    });

    if (nextState === 'ACCEPTED' && !this.activeEmergency.assignedResponderName) {
      this.activeEmergency.assignedResponderName = 'T. Adeleke';
      this.activeEmergency.assignedVehicleType = 'Ambulance';
      this.activeEmergency.assignedVehicleReg = 'ABJ-901-EK';
      this.activeEmergency.etaMinutes = 7;
    }

    if (nextState === 'COMPLETED' || nextState === 'CANCELLED') {
      this.history.unshift(JSON.parse(JSON.stringify(this.activeEmergency)));
      this.activeEmergency = null;
    }

    this.notify();
    return {
      success: true,
      emergency: this.activeEmergency ? JSON.parse(JSON.stringify(this.activeEmergency)) : undefined,
    };
  }

  public async cancelEmergency(reason: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    if (!this.activeEmergency) {
      return { success: false, error: 'No active emergency to cancel' };
    }

    // Cancellation permitted only before patient is onboard
    const allowedStates: EmergencyState[] = ['CREATED', 'DISPATCHING', 'ACCEPTED', 'PICKUP_ARRIVED'];
    if (!allowedStates.includes(this.activeEmergency.state)) {
      return {
        success: false,
        error: 'CANCELLATION_FORBIDDEN: Emergency cannot be cancelled once patient is onboard or journey has progressed to transit',
      };
    }

    return this.advanceState('CANCELLED', reason || 'Cancelled by patient');
  }

  public resetToFixtures() {
    this.profile = JSON.parse(JSON.stringify(INITIAL_PATIENT));
    this.activeEmergency = null;
    this.notify();
  }
}

export const patientService = new PatientService();
