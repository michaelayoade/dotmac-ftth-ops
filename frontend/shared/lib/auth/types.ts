/**
 * Auth Types
 *
 * Type definitions for the authentication system.
 */

/**
 * Active organization context for multi-tenant support.
 */
export interface ActiveOrganization {
  id: string;
  name: string | null;
  slug: string | null;
  role: string | null;
  permissions: string[];
}

/**
 * User information returned from /api/isp/v1/auth/me
 */
export interface UserInfo {
  id: string;
  username: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  location?: string | null;
  timezone?: string | null;
  language?: string | null;
  bio?: string | null;
  website?: string | null;
  avatar_url?: string | null;
  roles: string[];
  permissions: string[];
  is_active: boolean;
  is_platform_admin: boolean;
  tenant_id: string | null;
  partner_id?: string | null;
  managed_tenant_ids?: string[] | null;
  mfa_enabled: boolean;
  mfa_backup_codes_remaining?: number;
  activeOrganization: ActiveOrganization | null;
  // Field service / technician support
  technician_id?: string | null;
}

/**
 * Login request payload
 */
export interface LoginRequest {
  username: string; // Can be username or email
  password: string;
}

/**
 * Login response from /api/isp/v1/auth/login
 */
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * 2FA verification request
 */
export interface TwoFactorVerifyRequest {
  user_id: string;
  code: string;
  is_backup_code?: boolean;
}

/**
 * Login result with 2FA support
 */
export interface LoginResult {
  success: boolean;
  user?: UserInfo;
  requires2FA?: boolean;
  userId?: string;
  error?: string;
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * Password reset confirmation
 */
export interface PasswordResetConfirm {
  token: string;
  new_password: string;
}

/**
 * Auth context state
 */
export interface AuthState {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Auth context actions
 */
export interface AuthActions {
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  verify2FA: (userId: string, code: string, isBackupCode?: boolean) => Promise<LoginResult>;
}

/**
 * Combined auth context value
 */
export type AuthContextValue = AuthState & AuthActions;
