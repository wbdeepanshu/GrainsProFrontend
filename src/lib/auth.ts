// Authentication utilities and API calls
import { stopLiveTrackingSession } from "@/lib/liveTrackingSession";
import { clearAdminSettings, fetchAndStoreAdminSettings } from "@/lib/adminSettings";
import { clearOrgInfo, fetchOrgInfo } from "@/lib/orgInfo";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
export interface LoginRequest {
  mobile: string;
  password: string;
  source?: string;
}

export interface LoginResponse {
  status: number;
  message: string;
  data: {
    user_id: string;
    name: string;
    mobile: string;
    role_id: number;
    role: string;
    access_token: string;
    token_type: string;
    last_login: string;
    is_tally_enabled?: boolean;
    is_ep_user?: boolean;
  };
}

export interface AuthUser {
  user_id: string;
  name: string;
  mobile: string;
  role_id: number;
  role: string;
  access_token: string;
  token_type: string;
  last_login: string;
  is_tally_enabled?: boolean;
  is_ep_user?: boolean;
}

// Storage keys
const ACCESS_TOKEN_KEY = 'cp_manager_access_token';
const USER_DATA_KEY = 'cp_manager_user_data';

export class AuthService {
  static async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const data: LoginResponse = await response.json();
    
    if (data.status === 200) {
      const resolvedIsEpUser =
        (data as any)?.data?.is_ep_user ??
        (data as any)?.data?.isEpUser ??
        (data as any)?.data?.IsEPUser ??
        (data as any)?.is_ep_user ??
        (data as any)?.isEpUser ??
        (data as any)?.IsEPUser ??
        false;

      // Store authentication data
      this.setAccessToken(data.data.access_token);
      this.setUserData({
        ...data.data,
        is_ep_user: Boolean(resolvedIsEpUser),
      });

      if (import.meta.env.DEV) {
        // Debug: verify EP flag makes it into storage on login
        // eslint-disable-next-line no-console
        console.log("LOGIN response is_ep_user:", (data as any)?.data?.is_ep_user, "resolved:", resolvedIsEpUser);
        // eslint-disable-next-line no-console
        console.log("cp_manager_user_data stored:", localStorage.getItem(USER_DATA_KEY));
      }

      try {
        await fetchAndStoreAdminSettings(data.data.access_token);
      } catch (error) {
        console.error("Error loading admin settings after login:", error);
      }

      try {
        await fetchOrgInfo(API_BASE_URL, data.data.access_token);
      } catch (error) {
        console.error("Error loading organization info after login:", error);
      }
    }
    
    return data;
  }

  static async logout(): Promise<void> {
    const token = this.getAccessToken();
    
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/api/auth/logout/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        console.error('Logout API call failed:', error);
      }
    }
    
    // Clear local storage regardless of API call result
    stopLiveTrackingSession();
    this.clearAuthData();
    
    // Clear permissions cache on logout
    try {
      const { clearPermissions } = await import('./permissionUtils');
      clearPermissions();
    } catch (error) {
      console.error('Error clearing permissions:', error);
    }

    clearAdminSettings();
    clearOrgInfo();
    
    // Clear React Query cache - we'll call this from the components
    // that import the queryClient since auth shouldn't import queryClient directly
  }

  static setAccessToken(token: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  }

  static getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  static setUserData(userData: AuthUser): void {
    const resolvedIsEpUser =
      (userData as any)?.is_ep_user ??
      (userData as any)?.isEpUser ??
      (userData as any)?.IsEPUser ??
      false;
    localStorage.setItem(
      USER_DATA_KEY,
      JSON.stringify({
        ...userData,
        is_ep_user: Boolean(resolvedIsEpUser),
      })
    );
  }

  static getUserData(): AuthUser | null {
    const userData = localStorage.getItem(USER_DATA_KEY);
    return userData ? JSON.parse(userData) : null;
  }

  static isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  static clearAuthData(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_DATA_KEY);
    
    // Clear any other localStorage keys that might contain user-specific data
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('cp_manager_') || key.includes('user_') || key.includes('auth_'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  static getAuthHeaders(): Record<string, string> {
    const token = this.getAccessToken();
    return token ? {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    } : {
      'Content-Type': 'application/json',
    };
  }

  static async resendVerificationCode(mobile: string): Promise<{ status: number; message: string; data?: any }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/resend-code/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mobile }),
    });

    const data = await response.json();
    return data;
  }

  static async forceLogout(mobile: string, otp: string): Promise<{ status: number; message: string; access_token?: string; data?: any }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/force-logout/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mobile, otp }),
    });

    const data = await response.json();
    
    if (data.status === 200 && data.access_token) {
      // Store authentication data after force logout
      this.setAccessToken(data.access_token);
      if (data.data) {
        // Map the response data to match the AuthUser interface
        const userData: AuthUser = {
          user_id: data.data.user_id,
          name: data.data.name,
          mobile: data.data.mobile,
          role_id: data.data.role_id,
          role: data.data.role || '',
          access_token: data.access_token,
          token_type: 'Bearer',
          last_login: data.data.last_login || '',
          is_tally_enabled: data.data.is_tally_enabled,
          is_ep_user: data.data.is_ep_user,
        };
        this.setUserData(userData);
      }

      try {
        await fetchAndStoreAdminSettings(data.access_token);
      } catch (error) {
        console.error("Error loading admin settings after force logout:", error);
      }

      try {
        await fetchOrgInfo(API_BASE_URL, data.access_token);
      } catch (error) {
        console.error("Error loading organization info after force logout:", error);
      }
    }
    
    return data;
  }
}

