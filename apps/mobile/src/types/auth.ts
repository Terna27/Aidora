/**
 * RideRoute / Aidora Authentication & Profile Types
 * Shared across mobile and web domain boundaries
 */

export type UserRole =
  | 'PATIENT'
  | 'RESPONDER'
  | 'HOSPITAL'
  | 'HOSPITAL_ADMIN'
  | 'HOSPITAL_STAFF'
  | 'DISPATCHER'
  | 'ADMIN';

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'UNVERIFIED' | 'SUSPENDED';

export type OrganizationApprovalStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED';

export interface OrganizationMembership {
  organizationId: string;
  organizationName: string;
  organizationType: 'HOSPITAL' | 'DISPATCH_AGENCY';
  membershipRole: string;
  approvalStatus: OrganizationApprovalStatus;
  licenseNumber?: string;
}

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
  email?: string;
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
  role?: UserRole;
}

export interface RegisterPayload {
  fullName: string;
  phoneNumber: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  communityOrVillage?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  agreedToTerms?: boolean;
}

export interface AuthSession {
  user: PatientProfile | null;
  token: string | null;
  tokenExpiry?: string | null;
  isAuthenticated: boolean;
  isMock: boolean;
}
