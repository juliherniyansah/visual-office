// API client with JWT token injection and error handling

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

export interface LoginResponse {
  token: string;
  user: {
    email: string;
    role: string;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface User {
  email: string;
  role: string;
}

export interface SetupStatusResponse {
  setupComplete: boolean;
}

export interface SetupResponse {
  token: string;
  user: User;
}

export interface CreateSuperAdminRequest {
  email: string;
  password: string;
  confirmPassword: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
  }

  private clearToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('auth_token');
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    if (response.status === 401) {
      this.clearToken();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:logout'));
      }
    }

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || data.message || 'Request failed',
      };
    }

    // Backend already wraps payloads as { success, data }; unwrap to avoid double nesting.
    const payload = data !== null && typeof data === 'object' && 'data' in data ? data.data : data;
    return {
      success: true,
      data: payload as T,
    };
  }

  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    const token = this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    const token = this.getToken();
    const headers: HeadersInit = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers,
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  async login(email: string, password: string): Promise<ApiResponse<LoginResponse>> {
    return this.post<LoginResponse>('/auth/login', { email, password });
  }

  async checkSetupStatus(): Promise<ApiResponse<SetupStatusResponse>> {
    return this.get<SetupStatusResponse>('/auth/setup-status');
  }

  async createSuperAdmin(data: CreateSuperAdminRequest): Promise<ApiResponse<SetupResponse>> {
    return this.post<SetupResponse>('/auth/setup', data);
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
