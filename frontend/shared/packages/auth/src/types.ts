// Define PortalType locally since @dotmac/ui may not be available
export type PortalType = "admin" | "customer" | "reseller" | "technician" | "management";

export type AuthVariant = "simple" | "secure" | "enterprise";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  permissions: Permission[];
  tenantId: string;
  portalId?: string;
  metadata?: Record<string, any>;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  SUPER_ADMIN = "super_admin",
  MASTER_ADMIN = "master_admin",
  TENANT_ADMIN = "tenant_admin",
  MANAGER = "manager",
  AGENT = "agent",
  CUSTOMER = "customer",
  RESELLER = "reseller",
  TECHNICIAN = "technician",
  READONLY = "readonly",
}

export enum Permission {
  // User Management
  USERS_READ = "users:read",
  USERS_CREATE = "users:create",
  USERS_UPDATE = "users:update",
  USERS_DELETE = "users:delete",

  // Customer Management
  CUSTOMERS_READ = "customers:read",
  CUSTOMERS_CREATE = "customers:create",
  CUSTOMERS_UPDATE = "customers:update",
  CUSTOMERS_DELETE = "customers:delete",

  // Billing Management
  BILLING_READ = "billing:read",
  BILLING_CREATE = "billing:create",
  BILLING_UPDATE = "billing:update",
  BILLING_DELETE = "billing:delete",

  // Network Management
  NETWORK_READ = "network:read",
  NETWORK_CREATE = "network:create",
  NETWORK_UPDATE = "network:update",
  NETWORK_DELETE = "network:delete",

  // System Administration
  SYSTEM_ADMIN = "system:admin",
  SYSTEM_CONFIG = "system:config",
  SYSTEM_MONITOR = "system:monitor",

  // Reports & Analytics
  REPORTS_READ = "reports:read",
  REPORTS_CREATE = "reports:create",
  ANALYTICS_READ = "analytics:read",

  // Support & Tickets
  TICKETS_READ = "tickets:read",
  TICKETS_CREATE = "tickets:create",
  TICKETS_UPDATE = "tickets:update",
  TICKETS_DELETE = "tickets:delete",
}

export interface LoginCredentials {
  email?: string;
  username?: string;
  password: string;
  portal: PortalType;
  mfaCode?: string;
  rememberMe?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType?: string;
}

export interface AuthConfig {
  sessionTimeout: number;
  enableMFA: boolean;
  enablePermissions: boolean;
  requirePasswordComplexity: boolean;
  maxLoginAttempts: number;
  lockoutDuration: number;
  enableAuditLog: boolean;
  tokenRefreshThreshold: number;
  endpoints: {
    login: string;
    logout: string;
    refresh: string;
    profile: string;
  };
}

export interface PartialAuthConfig {
  sessionTimeout?: number;
  enableMFA?: boolean;
  enablePermissions?: boolean;
  requirePasswordComplexity?: boolean;
  maxLoginAttempts?: number;
  lockoutDuration?: number;
  enableAuditLog?: boolean;
  tokenRefreshThreshold?: number;
  endpoints?: {
    login: string;
    logout: string;
    refresh: string;
    profile: string;
  };
}

export interface AuthContextValue {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRefreshing: boolean;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;

  // Authorization
  hasPermission: (permission: Permission | Permission[]) => boolean;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  isSuperAdmin: () => boolean;

  // Session Management
  extendSession: () => Promise<void>;
  getSessionTimeRemaining: () => number;

  // MFA (if enabled)
  setupMFA?: () => Promise<{ qrCode: string; secret: string }>;
  verifyMFA?: (code: string) => Promise<boolean>;
  disableMFA?: () => Promise<void>;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  loginAttempts: number;
  lockedUntil: number | null;
  lastActivity: number;
  sessionWarningShown: boolean;
}

export interface AuthActions {
  setUser: (user: User | null) => void;
  setTokens: (tokens: AuthTokens | null) => void;
  setLoading: (loading: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
  incrementLoginAttempts: () => void;
  resetLoginAttempts: () => void;
  setLockedUntil: (timestamp: number | null) => void;
  updateLastActivity: () => void;
  setSessionWarningShown: (shown: boolean) => void;
  reset: () => void;
}

export interface AuthStore extends AuthState, AuthActions {}

export interface LoginResponse {
  user: User;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type?: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  expires_at: number;
  token_type?: string;
}

export interface MFASetupResponse {
  qrCode: string;
  secret: string;
  backupCodes: string[];
}

export interface SecurityContext {
  timestamp: number;
  userAgent: string;
  sessionId: string;
  device?: {
    type: string;
    os: string;
    browser: string;
  };
  ipAddress?: string;
  location?: {
    region?: string;
  };
}

export interface SecurityEvent {
  type: SecurityEventType;
  timestamp: Date;
  userId?: string;
  portal: PortalType;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export enum SecurityEventType {
  LOGIN_SUCCESS = "login_success",
  LOGIN_FAILURE = "login_failure",
  LOGIN_ATTEMPT = "login_attempt",
  LOGOUT = "logout",
  TOKEN_REFRESH = "token_refresh",
  TOKEN_EXPIRED = "token_expired",
  SESSION_TIMEOUT = "session_timeout",
  ACCOUNT_LOCKED = "account_locked",
  PASSWORD_CHANGED = "password_changed",
  MFA_ENABLED = "mfa_enabled",
  MFA_DISABLED = "mfa_disabled",
  SUSPICIOUS_ACTIVITY = "suspicious_activity",
  PERMISSION_DENIED = "permission_denied",
  // Additional enterprise events
  USER_ACTIVITY = "user_activity",
  SSO_CALLBACK_FAILED = "sso_callback_failed",
  SSO_CALLBACK_ERROR = "sso_callback_error",
  INACTIVITY_WARNING = "inactivity_warning",
  SESSION_VALIDATION_FAILED = "session_validation_failed",
  SESSION_VALIDATION_ERROR = "session_validation_error",
  PROFILE_LOADED = "profile_loaded",
  PROFILE_FETCH_FAILED = "profile_fetch_failed",
  LOGIN_ATTEMPT_WHILE_LOCKED = "login_attempt_while_locked",
  TOKEN_REFRESH_ATTEMPT = "token_refresh_attempt",
  TOKEN_REFRESH_FAILED = "token_refresh_failed",
  TOKEN_REFRESH_SUCCESS = "token_refresh_success",
  TOKEN_REFRESH_ERROR = "token_refresh_error",
  SSO_INITIATED = "sso_initiated",
  SSO_INITIATION_FAILED = "sso_initiation_failed",
  PROFILE_UPDATE_ATTEMPT = "profile_update_attempt",
  PROFILE_UPDATED = "profile_updated",
  PROFILE_UPDATE_FAILED = "profile_update_failed",
  SESSION_EXTENDED = "session_extended",
  LOGOUT_INITIATED = "logout_initiated",
  LOGOUT_COMPLETE = "logout_complete",
}

// Error types
export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor(message = "Invalid credentials") {
    super(message, "INVALID_CREDENTIALS", 401);
  }
}

export class AccountLockedError extends AuthError {
  constructor(
    message = "Account is locked",
    public unlockTime?: number,
  ) {
    super(message, "ACCOUNT_LOCKED", 423);
  }
}

export class SessionExpiredError extends AuthError {
  constructor(message = "Session has expired") {
    super(message, "SESSION_EXPIRED", 401);
  }
}

export class MFARequiredError extends AuthError {
  constructor(message = "MFA verification required") {
    super(message, "MFA_REQUIRED", 428);
  }
}

export class PermissionDeniedError extends AuthError {
  constructor(message = "Permission denied") {
    super(message, "PERMISSION_DENIED", 403);
  }
}
