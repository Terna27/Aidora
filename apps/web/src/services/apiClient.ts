
/**
 * Unified API Client for Aidora Web Application
 * Connects to the Go backend with network error handling.
 */

const getApiBaseUrl = (): string => {
  try {
    // Vite environment
    if (import.meta.env?.VITE_API_BASE_URL) {
      return import.meta.env.VITE_API_BASE_URL;
    }
  } catch {
    // Fall through to other configuration
  }

  try {
    if (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) {
      return process.env.VITE_API_BASE_URL;
    }
  } catch {
    // Fall through
  }

  return 'http://localhost:8080/api/v1';
};

const API_BASE_URL = getApiBaseUrl().replace(/\/+$/, '');

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  source: 'BACKEND' | 'NETWORK_ERROR';
}

interface BackendError {
  code?: string;
  message?: string;
}

class ApiClient {
  private baseUrl: string;
  private isOnline: boolean | null = null;
  private token: string | null = null;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  public setToken(token: string | null): void {
    this.token = token;
  }

  public getToken(): string | null {
    return this.token;
  }

  public async checkBackendHealth(): Promise<boolean> {
    try {
      const healthUrl = `${new URL(this.baseUrl).origin}/health`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(healthUrl, {
          signal: controller.signal,
        });

        this.isOnline = response.ok;
        return response.ok;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {
      this.isOnline = false;
      return false;
    }
  }

  public getBackendStatus(): boolean | null {
    return this.isOnline;
  }

  public async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');

    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      const responseText = await response.text();

      let parsed: unknown = undefined;

      if (responseText.trim()) {
        try {
          parsed = JSON.parse(responseText);
        } catch {
          parsed = responseText;
        }
      }

      if (!response.ok) {
        const errorPayload = parsed as
          | { error?: string | BackendError; message?: string }
          | undefined;

        const backendError = errorPayload?.error;

        let errorMessage = `Request failed (${response.status})`;
        let errorCode: string | undefined;

        if (typeof backendError === 'string') {
          errorMessage = backendError;
        } else if (backendError && typeof backendError === 'object') {
          errorMessage = backendError.message || errorMessage;
          errorCode = backendError.code;
        } else if (errorPayload?.message) {
          errorMessage = errorPayload.message;
        }

        this.isOnline = true;

        return {
          success: false,
          error: errorMessage,
          errorCode,
          source: 'BACKEND',
        };
      }

      this.isOnline = true;

      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !('success' in parsed) ||
        typeof parsed.success !== 'boolean'
      ) {
        return {
          success: false,
          error: 'Invalid response received from the backend.',
          source: 'BACKEND',
        };
      }

      const envelope = parsed as {
        success: boolean;
        data?: T;
        error?: BackendError;
      };

      if (!envelope.success) {
        return {
          success: false,
          error: envelope.error?.message || 'Backend request failed.',
          errorCode: envelope.error?.code,
          source: 'BACKEND',
        };
      }

      return {
        success: true,
        data: envelope.data,
        source: 'BACKEND',
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.name === 'AbortError'
            ? 'The request timed out. Please try again.'
            : err.message
          : 'Network error. Please check your connection.';

      this.isOnline = false;

      return {
        success: false,
        error: message,
        source: 'NETWORK_ERROR',
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const apiClient = new ApiClient();
