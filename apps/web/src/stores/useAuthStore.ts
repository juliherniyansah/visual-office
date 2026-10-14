// Authentication store with JWT token management
import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';
import { apiClient } from '@/lib/api';

interface User {
  email: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => boolean;
}

const TOKEN_KEY = 'auth_token';

const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
};

const setToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
};

const removeToken = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
};

const decodeToken = (token: string): User | null => {
  try {
    const decoded = jwtDecode<{ email: string; role: string }>(token);
    return {
      email: decoded.email,
      role: decoded.role,
    };
  } catch {
    return null;
  }
};

const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwtDecode<{ exp?: number }>(token);
    if (!decoded.exp) return false;
    return decoded.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: getToken(),
  user: getToken() ? decodeToken(getToken()!) : null,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    const response = await apiClient.login(email, password);

    if (!response.success || !response.data) {
      return false;
    }

    const { token } = response.data;
    setToken(token);

    const user = decodeToken(token);
    set({
      token,
      user,
      isAuthenticated: true,
    });

    return true;
  },

  logout: () => {
    removeToken();
    set({
      token: null,
      user: null,
      isAuthenticated: false,
    });
  },

  checkAuth: () => {
    const token = get().token;

    if (!token) {
      set({ isAuthenticated: false });
      return false;
    }

    if (isTokenExpired(token)) {
      get().logout();
      return false;
    }

    set({ isAuthenticated: true });
    return true;
  },
}));

// Auto-logout on token expiry check
if (typeof window !== 'undefined') {
  window.addEventListener('auth:logout', () => {
    useAuthStore.getState().logout();
  });

  // Check token expiry on mount
  const token = getToken();
  if (token && isTokenExpired(token)) {
    useAuthStore.getState().logout();
  }
}
