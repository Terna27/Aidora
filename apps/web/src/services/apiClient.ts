/**
 * Unified API Client for Aidline Web Application
 * Connects to Go backend (VITE_API_BASE_URL) with robust mock/offline fallback
 */

const getApiBaseUrl = (): string => {
  try {
    // Vite browser injection
    // @ts-expect-error import.meta.env may not be typed in all test runners
    if (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_BASE_URL) {
      // @ts-expect-error import.meta.env
      return import.meta.env.VITE_API_BASE_URL;
    }
  } catch {
    // fall through
  }

  try {
    if (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) {
      return process.env.VITE_API_BASE_URL;
    }
  } catch {
    // fall through
  }

  return 'http://localhost:8080/api/v1';
};

const API_BASE_URL = getApiBaseUrl();

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  source: 'BACKEND' | 'FIXTURE';
}

class ApiClient {
  private baseUrl: string;
  private isOnline: boolean | null = null;
  private token: string | null = null;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  public setToken(token: string | null) {
    this.token = token;
  }

  public getToken(): string | null {
    return this.token;
  }

  public async checkBackendHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 800);
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      this.isOnline = res.ok;
      return res.ok;
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
    // If backend is known to be offline, return immediately without blocking UI
    if (this.isOnline === false) {
      return { success: false, error: 'Backend offline', source: 'FIXTURE' };
    }

    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = `Server error (${response.status})`;
        try {
          const parsed = JSON.parse(errorText);
          errorMsg = parsed.error || parsed.message || errorMsg;
        } catch {
          // not JSON
        }
        return { success: false, error: errorMsg, source: 'BACKEND' };
      }

      const data = (await response.json()) as T;
      this.isOnline = true;
      return { success: true, data, source: 'BACKEND' };
    } catch (err: unknown) {
      this.isOnline = false;
      const message = err instanceof Error ? err.message : 'Network error';
      return { success: false, error: message, source: 'FIXTURE' };
    }
  }
}

export const apiClient = new ApiClient();
