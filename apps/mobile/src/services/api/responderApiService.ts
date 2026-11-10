/**
 * RideRoute Python Backend HTTP API Integration Service
 *
 * Communicates with Developer 2's Python backend through documented HTTP endpoints.
 * Configured via environment variable EXPO_PUBLIC_API_URL (default: http://localhost:8000).
 * Handles standard { success, data, error } envelopes and JWT tokens.
 */

import { API_BASE_URL, API_ENDPOINTS, ApiError, ApiResponse } from './client';
import {
  ResponderProfile,
  ResponderRegisterPayload,
  AvailabilityStatus,
  EmergencyOffer,
  ResponderStats,
  VerificationStatus,
} from '../../types/responder';
import { EmergencyRequest, EmergencyState } from '../../types/emergency';
import { IResponderAuthService } from '../mock/mockResponderAuthService';
import { IResponderJourneyService } from '../mock/mockResponderJourneyService';

class HttpHelper {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      body?: unknown;
      headers?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
    } catch (networkErr: unknown) {
      const msg = networkErr instanceof Error ? networkErr.message : 'Network request failed';
      throw new ApiError(
        `Unable to connect to Python backend dispatch server: ${msg}`,
        'NETWORK_TIMEOUT',
        0
      );
    }

    let json: ApiResponse<T>;
    try {
      json = (await response.json()) as ApiResponse<T>;
    } catch {
      throw new ApiError(
        `Invalid server response (${response.status})`,
        'SERVER_ERROR',
        response.status
      );
    }

    if (!response.ok || !json.success) {
      const code = json.error?.code || `HTTP_${response.status}`;
      const message = json.error?.message || response.statusText || 'Unknown server error';
      throw new ApiError(message, code, response.status, json.error?.details);
    }

    return json.data as T;
  }
}

export const httpHelper = new HttpHelper();

/**
 * Production Responder Authentication & Profile Service for Python Backend
 */
export class ResponderAuthApiService implements IResponderAuthService {
  private currentResponder: ResponderProfile | null = null;

  async login(phoneNumber: string, password?: string): Promise<{ responder: ResponderProfile; token: string }> {
    const data = await httpHelper.request<{ token: string; responder: ResponderProfile }>(
      API_ENDPOINTS.RESPONDER_AUTH_LOGIN,
      {
        method: 'POST',
        body: { phoneNumber, password },
      }
    );
    httpHelper.setToken(data.token);
    this.currentResponder = data.responder;
    return data;
  }

  async loginAsDemo(responderId = 'resp-201'): Promise<{ responder: ResponderProfile; token: string }> {
    // In production against the Python backend, demo login requests sample credentials
    return this.login(responderId === 'resp-202' ? '08024445566' : '08031112233', 'password123');
  }

  async register(payload: ResponderRegisterPayload): Promise<{ responder: ResponderProfile; token: string }> {
    const data = await httpHelper.request<{ token: string; responder: ResponderProfile }>(
      API_ENDPOINTS.RESPONDER_AUTH_REGISTER,
      {
        method: 'POST',
        body: payload,
      }
    );
    httpHelper.setToken(data.token);
    this.currentResponder = data.responder;
    return data;
  }

  async getProfile(): Promise<ResponderProfile | null> {
    if (!httpHelper.getToken()) return null;
    try {
      const responder = await httpHelper.request<ResponderProfile>(
        API_ENDPOINTS.RESPONDER_PROFILE,
        { method: 'GET' }
      );
      this.currentResponder = responder;
      return responder;
    } catch {
      return null;
    }
  }

  async updateProfile(updates: Partial<ResponderProfile>): Promise<ResponderProfile> {
    const responder = await httpHelper.request<ResponderProfile>(
      API_ENDPOINTS.RESPONDER_PROFILE,
      {
        method: 'PUT',
        body: updates,
      }
    );
    this.currentResponder = responder;
    return responder;
  }

  async forgotPassword(phoneNumber: string): Promise<{ success: boolean; message: string }> {
    return await httpHelper.request<{ success: boolean; message: string }>(
      API_ENDPOINTS.RESPONDER_AUTH_FORGOT_PASSWORD,
      {
        method: 'POST',
        body: { phoneNumber },
      }
    );
  }

  async logout(): Promise<void> {
    httpHelper.setToken(null);
    this.currentResponder = null;
  }

  reset(): void {
    httpHelper.setToken(null);
    this.currentResponder = null;
  }
}

/**
 * Production Responder Journey & Dispatch Service for Python Backend
 */
export class ResponderJourneyApiService implements IResponderJourneyService {
  async getAvailability(responderId: string): Promise<AvailabilityStatus> {
    const data = await httpHelper.request<{ status: AvailabilityStatus }>(
      API_ENDPOINTS.RESPONDER_AVAILABILITY,
      { method: 'GET' }
    );
    return data.status;
  }

  async setAvailability(
    responderId: string,
    status: AvailabilityStatus,
    verificationStatus: VerificationStatus
  ): Promise<AvailabilityStatus> {
    if (status === 'ONLINE' && verificationStatus !== 'VERIFIED') {
      throw new ApiError(
        'Your documents are pending review. Only verified responders can receive emergency requests.',
        'VERIFICATION_REQUIRED',
        403
      );
    }

    const data = await httpHelper.request<{ status: AvailabilityStatus }>(
      API_ENDPOINTS.RESPONDER_AVAILABILITY,
      {
        method: 'POST',
        body: { status },
      }
    );
    return data.status;
  }

  async getIncomingOffer(responderId: string): Promise<EmergencyOffer | null> {
    try {
      return await httpHelper.request<EmergencyOffer>(
        API_ENDPOINTS.RESPONDER_OFFERS_ACTIVE,
        { method: 'GET' }
      );
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  async acceptOffer(offerId: string, responderId: string): Promise<EmergencyRequest> {
    return await httpHelper.request<EmergencyRequest>(
      API_ENDPOINTS.RESPONDER_OFFER_ACCEPT(offerId),
      { method: 'POST' }
    );
  }

  async declineOffer(offerId: string, responderId: string, reason?: string): Promise<void> {
    await httpHelper.request<{ success: boolean }>(
      API_ENDPOINTS.RESPONDER_OFFER_DECLINE(offerId),
      {
        method: 'POST',
        body: { reason },
      }
    );
  }

  async getActiveJourney(responderId: string): Promise<EmergencyRequest | null> {
    try {
      return await httpHelper.request<EmergencyRequest>(
        API_ENDPOINTS.RESPONDER_JOURNEY_ACTIVE,
        { method: 'GET' }
      );
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  async advanceJourneyState(
    emergencyId: string,
    responderId: string,
    targetState: EmergencyState
  ): Promise<EmergencyRequest> {
    return await httpHelper.request<EmergencyRequest>(
      API_ENDPOINTS.RESPONDER_JOURNEY_MILESTONE(emergencyId),
      {
        method: 'POST',
        body: { targetState },
      }
    );
  }

  async completeHandover(
    emergencyId: string,
    responderId: string,
    handoverNotes?: string
  ): Promise<EmergencyRequest> {
    return await httpHelper.request<EmergencyRequest>(
      API_ENDPOINTS.RESPONDER_JOURNEY_HANDOVER(emergencyId),
      {
        method: 'POST',
        body: { handoverNotes },
      }
    );
  }

  async getResponderStats(responderId: string): Promise<ResponderStats> {
    return await httpHelper.request<ResponderStats>(
      API_ENDPOINTS.RESPONDER_STATS,
      { method: 'GET' }
    );
  }

  async triggerMockOffer(responderId: string): Promise<EmergencyOffer> {
    // Only available in mock or testing environment
    throw new ApiError(
      'triggerMockOffer is not permitted in production mode. Offers originate from Python dispatch engine.',
      'METHOD_NOT_ALLOWED',
      405
    );
  }

  reset(): void {
    // No-op for production stateless service
  }
}
