/**
 * Aidora Identity & Session Domain Types
 * Defines roles, organization models, registration payloads, and session state.
 */

export type UserRole =
  | 'PATIENT'
  | 'RESPONDER'
  | 'HOSPITAL_ADMIN'
  | 'HOSPITAL_STAFF'
  | 'DISPATCHER'
  | 'PLATFORM_ADMIN';

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'UNVERIFIED' | 'SUSPENDED';

export type OrganizationApprovalStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED';

export type OrganizationType = 'HOSPITAL' | 'DISPATCH_AGENCY';

export type VehicleCategory = 'MOTORCYCLE' | 'TRICYCLE' | 'TAXI';

export interface OrganizationMembership {
  organizationId: string;
  organizationName: string;
  organizationType: OrganizationType;
  membershipRole: string; // e.g., 'Chief Medical Officer', 'Triage Nurse', 'Senior Dispatcher'
  approvalStatus: OrganizationApprovalStatus;
  licenseNumber?: string;
  lga?: string;
  state?: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  role: UserRole;
  communityOrVillage?: string;
  verificationStatus: VerificationStatus;
  organization?: OrganizationMembership;
  // Specific role metadata
  responderVehicleType?: VehicleCategory;
  responderVehicleReg?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  user: UserProfile | null;
  token: string | null;
  tokenExpiry: string | null; // ISO timestamp
  isAuthenticated: boolean;
  isMock: boolean;
}

// ----------------------------------------------------------------------
// Registration Payloads
// ----------------------------------------------------------------------

export interface PatientRegisterPayload {
  fullName: string;
  phoneNumber: string;
  email?: string;
  password: string;
  confirmPassword: string;
  communityOrVillage: string;
  agreedToTerms: boolean;
}

export interface ResponderRegisterPayload {
  fullName: string;
  phoneNumber: string;
  email?: string;
  password: string;
  confirmPassword: string;
  communityBase: string;
  vehicleType: VehicleCategory;
  vehicleMakeModel: string;
  licensePlate: string;
  vehicleColor: string;
  driverLicenseNumber: string;
  documentReference?: string;
  agreedToTerms: boolean; // Operational agreement: transport role only, NOT medical
}

export interface HospitalRegisterPayload {
  hospitalName: string;
  licenseNumber: string;
  address: string;
  community: string;
  lga: string;
  state: string;
  contactPhone: string;
  officialEmail: string;
  coords?: { lat: number; lng: number };
  capabilities: string[];
  adminFullName: string;
  adminPhone: string;
  adminEmail: string;
  password: string;
  confirmPassword: string;
  agreedToTerms: boolean;
}

export interface InvitationValidationResult {
  valid: boolean;
  token: string;
  organizationId: string;
  organizationName: string;
  organizationType: OrganizationType;
  assignedRole: string;
  invitedEmail?: string;
  invitedPhone?: string;
  expiresAt: string;
  error?: string;
}

export interface AcceptInvitationPayload {
  token: string;
  fullName: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  agreedToTerms: boolean;
}

export interface DispatcherRegisterPayload {
  authorizationToken: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  password: string;
  confirmPassword: string;
  dispatchRegion: string;
  agreedToTerms: boolean;
}

// ----------------------------------------------------------------------
// Auth Action Payloads
// ----------------------------------------------------------------------

export interface LoginPayload {
  identifier: string; // Phone or Email
  password: string;
  targetRole?: UserRole;
}

export interface ForgotPasswordPayload {
  identifier: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
  confirmPassword: string;
}
