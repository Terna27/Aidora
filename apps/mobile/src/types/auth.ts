/**
 * RideRoute Authentication & Patient Profile Types
 */

export type UserRole = 'PATIENT' | 'RESPONDER' | 'HOSPITAL' | 'ADMIN';

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phoneNumber: string;
  isPrimary: boolean;
}

export interface PatientProfile {
  id: string;
  fullName: string;
  phoneNumber: string;
  role: 'PATIENT';
  communityOrVillage?: string;
  gestationalAgeWeeks?: number;
  bloodGroup?: string;
  allergiesOrNotes?: string;
  emergencyContacts: EmergencyContact[];
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  phoneNumber: string;
  password?: string;
}

export interface RegisterPayload {
  fullName: string;
  phoneNumber: string;
  password?: string;
  communityOrVillage?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
}

export interface AuthSession {
  user: PatientProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isMock: boolean;
}
