/**
 * Unified Authentication Types
 * Consolidates all auth-related types across portals
 */

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  tenantId?: string;
  avatar?: string;
  lastLogin?: string;
  mfaEnabled?: boolean;
  tempPassword?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  csrfToken?: string;
}

export interface AuthSession {
  sessionId: string;
  user: User;
  tokens: AuthTokens;
  portal: PortalConfig;
  lastActivity: number;
  deviceFingerprint?: DeviceFingerprint;
}

export interface LoginCredentials {
  email?: string;
  username?: string;
  password: string;
  portalId?: string;
  accountNumber?: string;
  partnerCode?: string;
  mfaCode?: string;
  rememberDevice?: boolean;
  portal?: string;
}

export interface PortalConfig {
  id: string;
  name: string;
  type: "admin" | "customer" | "reseller" | "technician" | "management";
  tenantId: string;
  loginMethods: string[];
  features: {
    mfaRequired: boolean;
    allowPortalIdLogin: boolean;
    allowAccountNumberLogin: boolean;
    ssoEnabled: boolean;
    rememberDevice: boolean;
    sessionTimeout: number;
  };
  branding: {
    logo: string;
    companyName: string;
    primaryColor: string;
    secondaryColor: string;
    favicon?: string;
  };
  security: {
    enforceStrongPasswords: boolean;
    maxFailedAttempts: number;
    lockoutDuration: number;
    requireDeviceVerification: boolean;
  };
}

export interface DeviceFingerprint {
  screen_resolution: string;
  timezone: string;
  language: string;
  platform: string;
  user_agent_hash: string;
  canvas_fingerprint: string;
}

export interface AuthError {
  code: string;
  message: string;
  details?: any;
  requires_2fa?: boolean;
  account_locked?: boolean;
  locked_until?: string;
  password_expired?: boolean;
  retryAfter?: number;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  session: AuthSession | null;
  portal: PortalConfig | null;
  error: AuthError | null;
  mfaRequired: boolean;
  requiresPasswordChange: boolean;
  lastActivity: number;
  sessionValid: boolean;
}

export interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  validateSession: () => Promise<boolean>;
  updateUser: (updates: Partial<User>) => void;
  updatePassword: (current: string, newPassword: string) => Promise<boolean>;
  setupMfa: (secret: string, code: string) => Promise<boolean>;
  clearError: () => void;
  updateActivity: () => void;
}

export interface AuthProviderConfig {
  portal: PortalConfig;
  autoRefresh?: boolean;
  refreshThreshold?: number;
  sessionTimeout?: number;
  redirectOnLogout?: string;
  secureStorage?: boolean;
  rateLimiting?: boolean;
}

export type AuthStore = AuthState & AuthActions;
