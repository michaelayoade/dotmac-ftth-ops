/**
 * Authentication Settings Configuration
 * Centralizes all auth-related configuration with environment variable support
 */
import type { SignOptions, Secret } from "jsonwebtoken";

type SameSite = "strict" | "lax" | "none";
type ExpiresInString = Extract<SignOptions["expiresIn"], string>;

const DEFAULT_ACCESS_TOKEN_EXPIRY: ExpiresInString = "15m";
const DEFAULT_REFRESH_TOKEN_EXPIRY: ExpiresInString = "7d";

const EXPIRES_IN_PATTERN =
  /^(\d+)(?:\s*(years?|year|yrs?|yr|y|weeks?|week|w|days?|day|d|hours?|hour|hrs?|hr|h|minutes?|minute|mins?|min|m|seconds?|second|secs?|sec|s|milliseconds?|millisecond|msecs?|msec|ms))?$/i;

const isExpiresInString = (value: string): value is ExpiresInString =>
  EXPIRES_IN_PATTERN.test(value.trim());

const parseExpiresIn = (
  value: string | undefined,
  fallback: SignOptions["expiresIn"],
): SignOptions["expiresIn"] => {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return fallback;
  }

  if (isExpiresInString(trimmed)) {
    return trimmed;
  }

  const numericValue = Number(trimmed);
  if (!Number.isNaN(numericValue)) {
    return numericValue;
  }

  return fallback;
};

const parseSameSite = (value: string | undefined): SameSite => {
  if (value === "lax" || value === "none" || value === "strict") {
    return value;
  }
  return "strict";
};

const normalizeSecret = (secret: Secret): string | undefined =>
  typeof secret === "string" ? secret : undefined;

export interface AuthSecurityConfig {
  // JWT Configuration
  jwtSecret: Secret;
  jwtRefreshSecret: Secret;
  jwtIssuer: string;
  jwtAudience: string;
  accessTokenExpiry: SignOptions["expiresIn"];
  refreshTokenExpiry: SignOptions["expiresIn"];

  // Cookie Configuration
  cookieName: string;
  refreshCookieName: string;
  cookieSecure: boolean;
  cookieHttpOnly: boolean;
  cookieSameSite: SameSite;
  cookieDomain?: string;
  cookieMaxAge: number;

  // CSRF Protection
  csrfEnabled: boolean;
  csrfTokenName: string;
  csrfHeaderName: string;
  csrfCookieName: string;

  // Rate Limiting
  rateLimitEnabled: boolean;
  rateLimitWindow: number;
  rateLimitMaxAttempts: number;
  rateLimitBlockDuration: number;

  // Security Features
  bruteForceProtection: boolean;
  sessionTimeout: number;
  inactivityTimeout: number;
  maxConcurrentSessions: number;
  ipWhitelist?: string[];
  userAgentValidation: boolean;

  // Password Policy
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecialChars: boolean;
  passwordHistory: number;
  passwordExpiry: number;
}

export interface AuthEndpointsConfig {
  login: string;
  logout: string;
  refresh: string;
  profile: string;
  register?: string;
  forgotPassword?: string;
  resetPassword?: string;
  verifyEmail?: string;
  changePassword?: string;
  setupMFA?: string;
  verifyMFA?: string;
  disableMFA?: string;
}

export interface AuthFeaturesConfig {
  enableMFA: boolean;
  enablePasswordReset: boolean;
  enableEmailVerification: boolean;
  enableSocialLogin: boolean;
  enableSSO: boolean;
  enableRememberMe: boolean;
  enableDeviceTracking: boolean;
  enableAuditLogging: boolean;
  enableSecurityNotifications: boolean;
}

export interface AuthStorageConfig {
  storageType: "localStorage" | "sessionStorage" | "secure";
  encryptStorage: boolean;
  storagePrefix: string;
  autoCleanup: boolean;
  cleanupInterval: number;
}

export class AuthSettings {
  private static instance: AuthSettings;
  private settings: {
    security: AuthSecurityConfig;
    endpoints: Record<string, AuthEndpointsConfig>;
    features: Record<string, AuthFeaturesConfig>;
    storage: AuthStorageConfig;
  };

  private constructor() {
    this.settings = this.loadSettings();
  }

  static getInstance(): AuthSettings {
    if (!AuthSettings.instance) {
      AuthSettings.instance = new AuthSettings();
    }
    return AuthSettings.instance;
  }

  private loadSettings() {
    const isProduction = process.env.NODE_ENV === "production";
    const isHTTPS =
      process.env.HTTPS === "true" ||
      process.env.NODE_ENV === "production" ||
      (typeof window !== "undefined" && window.location.protocol === "https:");

    return {
      security: this.getSecurityConfig(isProduction, isHTTPS),
      endpoints: this.getEndpointsConfig(),
      features: this.getFeaturesConfig(),
      storage: this.getStorageConfig(),
    };
  }

  private getSecurityConfig(isProduction: boolean, isHTTPS: boolean): AuthSecurityConfig {
    return {
      // JWT Configuration
      jwtSecret:
        process.env.JWT_SECRET ||
        (isProduction ? this.throwMissingSecret("JWT_SECRET") : "dev-secret-change-in-production"),
      jwtRefreshSecret:
        process.env.JWT_REFRESH_SECRET ||
        (isProduction ? this.throwMissingSecret("JWT_REFRESH_SECRET") : "dev-refresh-secret"),
      jwtIssuer: process.env.JWT_ISSUER || "dotmac-isp-framework",
      jwtAudience: process.env.JWT_AUDIENCE || "dotmac-portals",
      accessTokenExpiry: parseExpiresIn(process.env.ACCESS_TOKEN_EXPIRY, DEFAULT_ACCESS_TOKEN_EXPIRY),
      refreshTokenExpiry: parseExpiresIn(
        process.env.REFRESH_TOKEN_EXPIRY,
        DEFAULT_REFRESH_TOKEN_EXPIRY,
      ),

      // Cookie Configuration
      cookieName: process.env.AUTH_COOKIE_NAME || "secure-auth-token",
      refreshCookieName: process.env.REFRESH_COOKIE_NAME || "secure-refresh-token",
      cookieSecure: isHTTPS, // Only secure in HTTPS environments
      cookieHttpOnly: true,
      cookieSameSite: parseSameSite(process.env.COOKIE_SAME_SITE),
      cookieDomain: process.env.COOKIE_DOMAIN,
      cookieMaxAge: parseInt(process.env.COOKIE_MAX_AGE || "3600000"), // 1 hour

      // CSRF Protection
      csrfEnabled: process.env.CSRF_ENABLED !== "false",
      csrfTokenName: process.env.CSRF_TOKEN_NAME || "csrf-token",
      csrfHeaderName: process.env.CSRF_HEADER_NAME || "x-csrf-token",
      csrfCookieName: process.env.CSRF_COOKIE_NAME || "csrf-token",

      // Rate Limiting
      rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== "false",
      rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || "900000"), // 15 minutes
      rateLimitMaxAttempts: parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || "5"),
      rateLimitBlockDuration: parseInt(process.env.RATE_LIMIT_BLOCK_DURATION || "1800000"), // 30 minutes

      // Security Features
      bruteForceProtection: process.env.BRUTE_FORCE_PROTECTION !== "false",
      sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || "1800000"), // 30 minutes
      inactivityTimeout: parseInt(process.env.INACTIVITY_TIMEOUT || "900000"), // 15 minutes
      maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || "3"),
      ipWhitelist: process.env.IP_WHITELIST ? process.env.IP_WHITELIST.split(",") : undefined,
      userAgentValidation: process.env.USER_AGENT_VALIDATION !== "false",

      // Password Policy
      passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH || "8"),
      passwordRequireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== "false",
      passwordRequireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== "false",
      passwordRequireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS !== "false",
      passwordRequireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL !== "false",
      passwordHistory: parseInt(process.env.PASSWORD_HISTORY || "5"),
      passwordExpiry: parseInt(process.env.PASSWORD_EXPIRY || "7776000000"), // 90 days
    };
  }

  private getEndpointsConfig(): Record<string, AuthEndpointsConfig> {
    const baseEndpoints = {
      login: "/api/auth/login",
      logout: "/api/auth/logout",
      refresh: "/api/auth/refresh",
      profile: "/api/auth/me",
      register: "/api/auth/register",
      forgotPassword: "/api/auth/forgot-password",
      resetPassword: "/api/auth/reset-password",
      verifyEmail: "/api/auth/verify-email",
      changePassword: "/api/auth/change-password",
      setupMFA: "/api/auth/setup-mfa",
      verifyMFA: "/api/auth/verify-mfa",
      disableMFA: "/api/auth/disable-mfa",
    };

    return {
      admin: this.prefixEndpoints(baseEndpoints, "/admin"),
      customer: this.prefixEndpoints(baseEndpoints, "/customer"),
      reseller: this.prefixEndpoints(baseEndpoints, "/reseller"),
      technician: this.prefixEndpoints(baseEndpoints, "/technician"),
      management: this.prefixEndpoints(baseEndpoints, "/management"),
    };
  }

  private prefixEndpoints(endpoints: AuthEndpointsConfig, prefix: string): AuthEndpointsConfig {
    const prefixed: AuthEndpointsConfig = {} as AuthEndpointsConfig;

    Object.entries(endpoints).forEach(([key, value]) => {
      if (value) {
        (prefixed as any)[key] = `${prefix}${value}`;
      }
    });

    return prefixed;
  }

  private getFeaturesConfig(): Record<string, AuthFeaturesConfig> {
    return {
      admin: {
        enableMFA: process.env.ADMIN_MFA_ENABLED !== "false",
        enablePasswordReset: true,
        enableEmailVerification: true,
        enableSocialLogin: false,
        enableSSO: process.env.ADMIN_SSO_ENABLED === "true",
        enableRememberMe: false,
        enableDeviceTracking: true,
        enableAuditLogging: true,
        enableSecurityNotifications: true,
      },
      customer: {
        enableMFA: process.env.CUSTOMER_MFA_ENABLED === "true",
        enablePasswordReset: true,
        enableEmailVerification: process.env.CUSTOMER_EMAIL_VERIFICATION !== "false",
        enableSocialLogin: process.env.CUSTOMER_SOCIAL_LOGIN === "true",
        enableSSO: false,
        enableRememberMe: true,
        enableDeviceTracking: false,
        enableAuditLogging: false,
        enableSecurityNotifications: false,
      },
      reseller: {
        enableMFA: process.env.RESELLER_MFA_ENABLED !== "false",
        enablePasswordReset: true,
        enableEmailVerification: true,
        enableSocialLogin: false,
        enableSSO: process.env.RESELLER_SSO_ENABLED === "true",
        enableRememberMe: true,
        enableDeviceTracking: true,
        enableAuditLogging: true,
        enableSecurityNotifications: true,
      },
      technician: {
        enableMFA: process.env.TECHNICIAN_MFA_ENABLED === "true",
        enablePasswordReset: true,
        enableEmailVerification: false,
        enableSocialLogin: false,
        enableSSO: false,
        enableRememberMe: true,
        enableDeviceTracking: true,
        enableAuditLogging: true,
        enableSecurityNotifications: false,
      },
      management: {
        enableMFA: process.env.MANAGEMENT_MFA_ENABLED !== "false",
        enablePasswordReset: true,
        enableEmailVerification: true,
        enableSocialLogin: false,
        enableSSO: process.env.MANAGEMENT_SSO_ENABLED === "true",
        enableRememberMe: false,
        enableDeviceTracking: true,
        enableAuditLogging: true,
        enableSecurityNotifications: true,
      },
    };
  }

  private getStorageConfig(): AuthStorageConfig {
    return {
      storageType: (process.env.AUTH_STORAGE_TYPE as any) || "localStorage",
      encryptStorage: process.env.AUTH_ENCRYPT_STORAGE === "true",
      storagePrefix: process.env.AUTH_STORAGE_PREFIX || "dotmac_auth",
      autoCleanup: process.env.AUTH_AUTO_CLEANUP !== "false",
      cleanupInterval: parseInt(process.env.AUTH_CLEANUP_INTERVAL || "3600000"), // 1 hour
    };
  }

  private throwMissingSecret(secretName: string): never {
    throw new Error(
      `Missing required environment variable: ${secretName}. ` +
        `This is required for production security.`,
    );
  }

  // Public getters
  getSecurity(): AuthSecurityConfig {
    return { ...this.settings.security };
  }

  getEndpoints(portal: string): AuthEndpointsConfig {
    return { ...this.settings.endpoints[portal] };
  }

  getFeatures(portal: string): AuthFeaturesConfig {
    return { ...this.settings.features[portal] };
  }

  getStorage(): AuthStorageConfig {
    return { ...this.settings.storage };
  }

  // Dynamic configuration updates (for testing)
  updateSecurity(updates: Partial<AuthSecurityConfig>): void {
    this.settings.security = { ...this.settings.security, ...updates };
  }

  // Validation methods
  validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check critical security settings
    const jwtSecretValue = normalizeSecret(this.settings.security.jwtSecret);
    const refreshSecretValue = normalizeSecret(this.settings.security.jwtRefreshSecret);

    if (jwtSecretValue?.includes("dev-") && process.env.NODE_ENV === "production") {
      errors.push("JWT_SECRET must be set in production");
    }

    if (jwtSecretValue && refreshSecretValue && jwtSecretValue === refreshSecretValue) {
      errors.push("JWT_SECRET and JWT_REFRESH_SECRET must be different");
    }

    if (this.settings.security.sessionTimeout < 300000) {
      // 5 minutes minimum
      errors.push("Session timeout must be at least 5 minutes");
    }

    if (this.settings.security.passwordMinLength < 8) {
      errors.push("Minimum password length should be at least 8 characters");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// Singleton instance
export const authSettings = AuthSettings.getInstance();

// Convenience exports
export const getAuthSecurity = () => authSettings.getSecurity();
export const getAuthEndpoints = (portal: string) => authSettings.getEndpoints(portal);
export const getAuthFeatures = (portal: string) => authSettings.getFeatures(portal);
export const getAuthStorage = () => authSettings.getStorage();
