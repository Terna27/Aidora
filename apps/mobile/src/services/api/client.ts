/**
 * RideRoute API Client Contract
 *
 * Defines the HTTP abstraction for communicating with Developer 2's Python backend.
 * Contains endpoint constants and standardized request/response formatting.
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export const API_BASE_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) || 'http://localhost:8000';

export const API_ENDPOINTS = {
  // Auth (Patient)
  AUTH_REGISTER: '/api/v1/auth/register',
  AUTH_LOGIN: '/api/v1/auth/login',
  AUTH_REFRESH: '/api/v1/auth/refresh',
  AUTH_FORGOT_PASSWORD: '/api/v1/auth/forgot-password',

  // Patient Profile
  PATIENT_PROFILE: '/api/v1/patient/profile',
  PATIENT_CONTACTS: '/api/v1/patient/emergency-contacts',

  // Emergency Lifecycle
  EMERGENCY_CREATE: '/api/v1/emergencies',
  EMERGENCY_ACTIVE: '/api/v1/emergencies/active',
  EMERGENCY_GET: (id: string) => `/api/v1/emergencies/${id}`,
  EMERGENCY_CANCEL: (id: string) => `/api/v1/emergencies/${id}/cancel`,
  EMERGENCY_HISTORY: '/api/v1/emergencies/history',

  // Responder Auth & Profile
  RESPONDER_AUTH_REGISTER: '/api/v1/responder/auth/register',
  RESPONDER_AUTH_LOGIN: '/api/v1/responder/auth/login',
  RESPONDER_AUTH_FORGOT_PASSWORD: '/api/v1/responder/auth/forgot-password',
  RESPONDER_PROFILE: '/api/v1/responder/profile',

  // Responder Availability & Stats
  RESPONDER_AVAILABILITY: '/api/v1/responder/availability',
  RESPONDER_STATS: '/api/v1/responder/stats',

  // Responder Emergency Offers
  RESPONDER_OFFERS_ACTIVE: '/api/v1/responder/offers/active',
  RESPONDER_OFFER_ACCEPT: (id: string) => `/api/v1/responder/offers/${id}/accept`,
  RESPONDER_OFFER_DECLINE: (id: string) => `/api/v1/responder/offers/${id}/decline`,

  // Responder Active Journey & Handover
  RESPONDER_JOURNEY_ACTIVE: '/api/v1/responder/journey/active',
  RESPONDER_JOURNEY_MILESTONE: (id: string) => `/api/v1/responder/journey/${id}/milestone`,
  RESPONDER_JOURNEY_HANDOVER: (id: string) => `/api/v1/responder/journey/${id}/handover`,

  // Facilities
  FACILITIES_NEARBY: '/api/v1/facilities/nearby',
} as const;

export class ApiError extends Error {
  code: string;
  statusCode?: number;
  details?: Record<string, unknown>;

  constructor(message: string, code = 'UNKNOWN_ERROR', statusCode?: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}
