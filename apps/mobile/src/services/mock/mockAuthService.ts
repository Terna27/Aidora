import {
  PatientProfile,
  LoginCredentials,
  RegisterPayload,
  EmergencyContact,
} from '../../types/auth';
import { MOCK_PATIENT } from './mockData';
import { ApiError } from '../api/client';

export interface IAuthService {
  login(credentials: LoginCredentials): Promise<{ patient: PatientProfile; token: string }>;
  loginAsDemo(): Promise<{ patient: PatientProfile; token: string }>;
  register(payload: RegisterPayload): Promise<{ patient: PatientProfile; token: string }>;
  getProfile(): Promise<PatientProfile | null>;
  updateProfile(updates: Partial<PatientProfile>): Promise<PatientProfile>;
  addEmergencyContact(contact: Omit<EmergencyContact, 'id'>): Promise<PatientProfile>;
  removeEmergencyContact(contactId: string): Promise<PatientProfile>;
  forgotPassword(phoneNumber: string): Promise<{ success: boolean; message: string }>;
  logout(): Promise<void>;
}

export class MockAuthService implements IAuthService {
  private currentPatient: PatientProfile | null = null;
  private token: string | null = null;

  async login(credentials: LoginCredentials): Promise<{ patient: PatientProfile; token: string }> {
    await new Promise((r) => setTimeout(r, 400));

    const cleanPhone = credentials.phoneNumber.replace(/[\s-]/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      throw new ApiError('Please enter a valid phone number (at least 8 digits)', 'INVALID_PHONE', 400);
    }

    // Match pre-seeded demo user
    if (cleanPhone === MOCK_PATIENT.phoneNumber.replace(/[\s-]/g, '')) {
      this.currentPatient = { ...MOCK_PATIENT };
      this.token = `mock-token-${this.currentPatient.id}`;
      return { patient: this.currentPatient, token: this.token };
    }

    // Otherwise create or restore session
    const patient: PatientProfile = {
      id: `pat-${cleanPhone.slice(-4)}`,
      fullName: 'Patient ' + cleanPhone.slice(-4),
      phoneNumber: cleanPhone,
      role: 'PATIENT',
      communityOrVillage: 'Community Area',
      emergencyContacts: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.currentPatient = patient;
    this.token = `mock-token-${patient.id}`;
    return { patient, token: this.token };
  }

  async loginAsDemo(): Promise<{ patient: PatientProfile; token: string }> {
    this.currentPatient = { ...MOCK_PATIENT };
    this.token = `mock-token-${this.currentPatient.id}`;
    return { patient: this.currentPatient, token: this.token };
  }

  async register(payload: RegisterPayload): Promise<{ patient: PatientProfile; token: string }> {
    await new Promise((r) => setTimeout(r, 500));

    if (!payload.fullName || payload.fullName.trim().length < 2) {
      throw new ApiError('Please enter your full name', 'INVALID_NAME', 400);
    }

    const cleanPhone = payload.phoneNumber.replace(/[\s-]/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      throw new ApiError('Please enter a valid phone number (at least 8 digits)', 'INVALID_PHONE', 400);
    }

    const contacts: EmergencyContact[] = [];
    if (payload.emergencyContactName && payload.emergencyContactPhone) {
      contacts.push({
        id: `contact-${Date.now()}`,
        name: payload.emergencyContactName.trim(),
        phoneNumber: payload.emergencyContactPhone.trim(),
        relationship: payload.emergencyContactRelationship?.trim() || 'Emergency Contact',
        isPrimary: true,
      });
    }

    const patient: PatientProfile = {
      id: `pat-${Date.now().toString().slice(-4)}`,
      fullName: payload.fullName.trim(),
      phoneNumber: cleanPhone,
      role: 'PATIENT',
      communityOrVillage: payload.communityOrVillage?.trim(),
      emergencyContacts: contacts,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.currentPatient = patient;
    this.token = `mock-token-${patient.id}`;
    return { patient, token: this.token };
  }

  async getProfile(): Promise<PatientProfile | null> {
    return this.currentPatient;
  }

  async updateProfile(updates: Partial<PatientProfile>): Promise<PatientProfile> {
    if (!this.currentPatient) {
      throw new ApiError('No authenticated patient profile found', 'UNAUTHENTICATED', 401);
    }

    this.currentPatient = {
      ...this.currentPatient,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    return this.currentPatient;
  }

  async addEmergencyContact(contact: Omit<EmergencyContact, 'id'>): Promise<PatientProfile> {
    if (!this.currentPatient) {
      throw new ApiError('No authenticated patient', 'UNAUTHENTICATED', 401);
    }

    const newContact: EmergencyContact = {
      ...contact,
      id: `contact-${Date.now()}`,
    };

    let contacts = [...this.currentPatient.emergencyContacts];
    if (newContact.isPrimary) {
      contacts = contacts.map((c) => ({ ...c, isPrimary: false }));
    }

    contacts.push(newContact);

    this.currentPatient = {
      ...this.currentPatient,
      emergencyContacts: contacts,
      updatedAt: new Date().toISOString(),
    };

    return this.currentPatient;
  }

  async removeEmergencyContact(contactId: string): Promise<PatientProfile> {
    if (!this.currentPatient) {
      throw new ApiError('No authenticated patient', 'UNAUTHENTICATED', 401);
    }

    const contacts = this.currentPatient.emergencyContacts.filter((c) => c.id !== contactId);
    this.currentPatient = {
      ...this.currentPatient,
      emergencyContacts: contacts,
      updatedAt: new Date().toISOString(),
    };

    return this.currentPatient;
  }

  async forgotPassword(phoneNumber: string): Promise<{ success: boolean; message: string }> {
    await new Promise((r) => setTimeout(r, 400));
    const cleanPhone = phoneNumber.replace(/[\s-]/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      throw new ApiError('Please enter a valid phone number (at least 8 digits)', 'INVALID_PHONE', 400);
    }
    return {
      success: true,
      message: 'If an account exists for this phone number, an SMS reset code has been sent.',
    };
  }

  async logout(): Promise<void> {
    this.token = null;
    this.currentPatient = null;
  }

  reset() {
    this.token = null;
    this.currentPatient = null;
  }
}

export const mockAuthService = new MockAuthService();
