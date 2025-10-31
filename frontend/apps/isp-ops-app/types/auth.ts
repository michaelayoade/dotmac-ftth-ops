// Authentication and authorization types
import { BaseEntity, DateString, UserID, TenantID } from "./common";

// User types
export interface User extends BaseEntity {
  id: UserID;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatar?: string;
  status: UserStatus;
  emailVerified: boolean;
  phoneNumber?: string;
  phoneVerified?: boolean;

  // Auth details
  roles: Role[];
  permissions?: Permission[];
  tenantId?: TenantID;
  lastLogin?: DateString;
  passwordChangedAt?: DateString;

  // Settings
  preferences?: UserPreferences;
  twoFactorEnabled?: boolean;
}

export const UserStatuses = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  SUSPENDED: "suspended",
  PENDING: "pending",
  DELETED: "deleted",
} as const;
export type UserStatus = (typeof UserStatuses)[keyof typeof UserStatuses];

// Role-based access control
export interface Role {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  permissions: Permission[];
  isSystem?: boolean;
}

export interface Permission {
  id: string;
  resource: string;
  action: PermissionAction;
  scope?: PermissionScope;
  conditions?: Record<string, unknown>;
}

export const PermissionActions = {
  CREATE: "create",
  READ: "read",
  UPDATE: "update",
  DELETE: "delete",
  EXECUTE: "execute",
  MANAGE: "manage",
} as const;
export type PermissionAction = (typeof PermissionActions)[keyof typeof PermissionActions];

export type PermissionScope = "own" | "team" | "tenant" | "global";

// Authentication
export interface AuthCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
  mfaCode?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
  requiresMfa?: boolean;
  mfaChallenge?: MfaChallenge;
}

// Multi-factor authentication
export interface MfaChallenge {
  challengeId: string;
  type: MfaType;
  expiresAt: DateString;
}

export type MfaType = "totp" | "sms" | "email" | "backup_code";

export interface MfaSetup {
  type: MfaType;
  secret?: string;
  qrCode?: string;
  backupCodes?: string[];
  verified: boolean;
}

// Session management
export interface Session {
  id: string;
  userId: UserID;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: DateString;
  expiresAt: DateString;
  lastActivity: DateString;
  isActive: boolean;
}

// User preferences
export interface UserPreferences {
  theme?: "light" | "dark" | "system";
  language?: string;
  timezone?: string;
  notifications?: NotificationPreferences;
  privacy?: PrivacySettings;
}

export interface NotificationPreferences {
  email: {
    enabled: boolean;
    frequency?: "immediate" | "daily" | "weekly";
    categories?: string[];
  };
  push: {
    enabled: boolean;
    categories?: string[];
  };
  sms: {
    enabled: boolean;
    categories?: string[];
  };
}

export interface PrivacySettings {
  profileVisibility?: "public" | "private" | "team";
  activityTracking?: boolean;
  dataSharing?: boolean;
}

// Registration and profile updates
export interface UserRegistration {
  email: string;
  password: string;
  confirmPassword: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  acceptTerms: boolean;
  marketingOptIn?: boolean;
}

export interface UserProfileUpdate {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phoneNumber?: string;
  avatar?: string;
  preferences?: UserPreferences;
}

// Password management
export interface PasswordResetRequest {
  email: string;
}

export interface PasswordReset {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface PasswordChange {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// API key management
export interface ApiKey extends BaseEntity {
  id: string;
  name: string;
  key: string; // Only returned on creation
  keyHint: string; // Last 4 characters
  userId: UserID;
  scopes: string[];
  expiresAt?: DateString;
  lastUsedAt?: DateString;
  isActive: boolean;
}

export interface ApiKeyCreateInput {
  name: string;
  scopes: string[];
  expiresIn?: number; // Days
}

// OAuth providers
export interface OAuthProvider {
  provider: OAuthProviderType;
  clientId: string;
  enabled: boolean;
  scopes?: string[];
}

export type OAuthProviderType = "google" | "github" | "microsoft" | "apple" | "facebook";

// Security events
export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  userId: UserID;
  timestamp: DateString;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  severity: "low" | "medium" | "high" | "critical";
}

export type SecurityEventType =
  | "login_success"
  | "login_failure"
  | "logout"
  | "password_changed"
  | "password_reset"
  | "mfa_enabled"
  | "mfa_disabled"
  | "suspicious_activity"
  | "account_locked"
  | "api_key_created"
  | "api_key_revoked";

// Type guards and utilities
export function hasPermission(user: User, resource: string, action: PermissionAction): boolean {
  const allPermissions = [
    ...(user.permissions || []),
    ...user.roles.flatMap((role) => role.permissions),
  ];

  return allPermissions.some(
    (p) =>
      p.resource === resource && (p.action === action || p.action === PermissionActions.MANAGE),
  );
}

export function hasRole(user: User, roleName: string): boolean {
  return user.roles.some((role) => role.name === roleName);
}

export function isAdmin(user: User): boolean {
  return hasRole(user, "admin") || hasRole(user, "super_admin");
}
