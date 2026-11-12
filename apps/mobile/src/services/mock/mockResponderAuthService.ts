import {
  ResponderProfile,
  ResponderRegisterPayload,
} from '../../types/responder';
import { MOCK_RESPONDER_PROFILES } from './mockData';
import { ApiError } from '../api/client';

export interface IResponderAuthService {
  login(phoneNumber: string, password?: string): Promise<{ responder: ResponderProfile; token: string }>;
  loginAsDemo(responderId?: string): Promise<{ responder: ResponderProfile; token: string }>;
  register(payload: ResponderRegisterPayload): Promise<{ responder: ResponderProfile; token: string }>;
  getProfile(): Promise<ResponderProfile | null>;
  updateProfile(updates: Partial<ResponderProfile>): Promise<ResponderProfile>;
  forgotPassword(phoneNumber: string): Promise<{ success: boolean; message: string }>;
  logout(): Promise<void>;
  reset(): void;
}

export class MockResponderAuthService implements IResponderAuthService {
  private currentResponder: ResponderProfile | null = null;
  private token: string | null = null;
  private profiles: Record<string, ResponderProfile> = { ...MOCK_RESPONDER_PROFILES };

  async login(phoneNumber: string, password?: string): Promise<{ responder: ResponderProfile; token: string }> {
    await new Promise((r) => setTimeout(r, 400));
    const cleanPhone = phoneNumber.replace(/[\s-]/g, '');

    if (!cleanPhone || cleanPhone.length < 8) {
      throw new ApiError('Please enter a valid phone number (at least 8 digits)', 'INVALID_PHONE', 400);
    }

    if (password !== undefined && password.length < 6) {
      throw new ApiError('Password must be at least 6 characters', 'INVALID_CREDENTIALS', 400);
    }

    // Match existing profile
    const existing = Object.values(this.profiles).find(
      (p) => p.phoneNumber.replace(/[\s-]/g, '') === cleanPhone
    );

    if (existing) {
      this.currentResponder = { ...existing };
      this.token = `mock-token-${existing.id}`;
      return { responder: this.currentResponder, token: this.token };
    }

    // Default registration as PENDING verification if phone unknown
    const newResponder: ResponderProfile = {
      id: `resp-${Date.now().toString().slice(-4)}`,
      fullName: 'Responder ' + cleanPhone.slice(-4),
      phoneNumber: cleanPhone,
      role: 'RESPONDER',
      roleDescription: 'Verified Transportation Responder',
      vehicle: {
        vehicleType: 'MOTORCYCLE',
        makeModel: 'Bajaj Boxer 150',
        licensePlate: 'ABC-' + cleanPhone.slice(-3),
        color: 'Black',
        insuranceValid: true,
      },
      driverLicenseNumber: 'DL-' + cleanPhone.slice(-6),
      verificationStatus: 'PENDING',
      rating: 5.0,
      completedTripsCount: 0,
      communityBase: 'Local Community',
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.profiles[newResponder.id] = newResponder;
    this.currentResponder = newResponder;
    this.token = `mock-token-${newResponder.id}`;
    return { responder: newResponder, token: this.token };
  }

  async loginAsDemo(responderId = 'resp-201'): Promise<{ responder: ResponderProfile; token: string }> {
    const profile = this.profiles[responderId] || MOCK_RESPONDER_PROFILES['resp-201'];
    this.currentResponder = { ...profile };
    this.token = `mock-token-${profile.id}`;
    return { responder: this.currentResponder, token: this.token };
  }

  async register(payload: ResponderRegisterPayload): Promise<{ responder: ResponderProfile; token: string }> {
    await new Promise((r) => setTimeout(r, 500));

    if (!payload.fullName || payload.fullName.trim().length < 2) {
      throw new ApiError('Full legal name is required for verification', 'INVALID_NAME', 400);
    }

    const cleanPhone = payload.phoneNumber.replace(/[\s-]/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      throw new ApiError('Valid mobile phone number required', 'INVALID_PHONE', 400);
    }

    if (!payload.licensePlate || payload.licensePlate.trim().length < 3) {
      throw new ApiError('Valid vehicle license plate number required', 'INVALID_PLATE', 400);
    }

    if (!payload.driverLicenseNumber || payload.driverLicenseNumber.trim().length < 3) {
      throw new ApiError('Valid driver license number required', 'INVALID_LICENSE', 400);
    }

    if (payload.password && payload.confirmPassword && payload.password !== payload.confirmPassword) {
      throw new ApiError('Passwords do not match', 'PASSWORD_MISMATCH', 400);
    }

    if (!payload.agreedToTerms) {
      throw new ApiError(
        'You must acknowledge that you provide transportation, not medical care',
        'TERMS_REQUIRED',
        400
      );
    }

    const newResponder: ResponderProfile = {
      id: `resp-${Date.now().toString().slice(-4)}`,
      fullName: payload.fullName.trim(),
      phoneNumber: cleanPhone,
      role: 'RESPONDER',
      roleDescription: 'Verified Transportation Responder',
      vehicle: {
        vehicleType: payload.vehicleType,
        makeModel: payload.vehicleMakeModel.trim(),
        licensePlate: payload.licensePlate.trim().toUpperCase(),
        color: payload.vehicleColor.trim(),
        insuranceValid: true,
      },
      driverLicenseNumber: payload.driverLicenseNumber.trim().toUpperCase(),
      verificationStatus: 'PENDING', // New registrations always start as PENDING review
      rating: 5.0,
      completedTripsCount: 0,
      communityBase: payload.communityBase?.trim() || 'Central Zone',
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.profiles[newResponder.id] = newResponder;
    this.currentResponder = newResponder;
    this.token = `mock-token-${newResponder.id}`;
    return { responder: newResponder, token: this.token };
  }

  async getProfile(): Promise<ResponderProfile | null> {
    return this.currentResponder;
  }

  async updateProfile(updates: Partial<ResponderProfile>): Promise<ResponderProfile> {
    if (!this.currentResponder) {
      throw new ApiError('No authenticated responder profile found', 'UNAUTHENTICATED', 401);
    }

    this.currentResponder = {
      ...this.currentResponder,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.profiles[this.currentResponder.id] = this.currentResponder;
    return this.currentResponder;
  }

  async forgotPassword(phoneNumber: string): Promise<{ success: boolean; message: string }> {
    await new Promise((r) => setTimeout(r, 400));
    const clean = phoneNumber.replace(/[\s-]/g, '');
    if (!clean || clean.length < 8) {
      throw new ApiError('Please enter a valid phone number', 'INVALID_PHONE', 400);
    }
    return {
      success: true,
      message: 'Password recovery verification code sent via SMS.',
    };
  }

  async logout(): Promise<void> {
    this.currentResponder = null;
    this.token = null;
  }

  reset(): void {
    this.currentResponder = null;
    this.token = null;
    this.profiles = { ...MOCK_RESPONDER_PROFILES };
  }
}

export const mockResponderAuthService = new MockResponderAuthService();
