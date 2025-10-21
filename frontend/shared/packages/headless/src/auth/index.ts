/**
 * Unified Authentication System
 * Central export for all auth functionality
 */

// Core auth components
export { useAuth } from "./useAuth";
export { createAuthStore } from "./store";
export {
  SecureStorage,
  secureStorage,
  sessionStorage,
  cookieStorage,
  memoryStorage,
} from "./storage";
export { TokenManager } from "./tokenManager";
export { CSRFProtection } from "./csrfProtection";
export { RateLimiter } from "./rateLimiter";

// Types
export type {
  User,
  AuthTokens,
  AuthSession,
  LoginCredentials,
  PortalConfig,
  DeviceFingerprint,
  AuthError,
  AuthState,
  AuthActions,
  AuthProviderConfig,
  AuthStore,
} from "./types";

export type { StorageBackend, SecureStorageOptions } from "./storage";

// Portal configurations for common use cases
export const PORTAL_CONFIGS = {
  admin: {
    type: "admin" as const,
    loginMethods: ["email"],
    features: {
      mfaRequired: true,
      allowPortalIdLogin: false,
      allowAccountNumberLogin: false,
      ssoEnabled: true,
      rememberDevice: true,
      sessionTimeout: 60 * 60 * 1000, // 1 hour
    },
    security: {
      enforceStrongPasswords: true,
      maxFailedAttempts: 3,
      lockoutDuration: 30 * 60 * 1000, // 30 minutes
      requireDeviceVerification: true,
    },
  },

  customer: {
    type: "customer" as const,
    loginMethods: ["email", "portalId", "accountNumber"],
    features: {
      mfaRequired: false,
      allowPortalIdLogin: true,
      allowAccountNumberLogin: true,
      ssoEnabled: false,
      rememberDevice: true,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
    },
    security: {
      enforceStrongPasswords: false,
      maxFailedAttempts: 5,
      lockoutDuration: 15 * 60 * 1000, // 15 minutes
      requireDeviceVerification: false,
    },
  },

  reseller: {
    type: "reseller" as const,
    loginMethods: ["email", "partnerCode"],
    features: {
      mfaRequired: true,
      allowPortalIdLogin: false,
      allowAccountNumberLogin: false,
      ssoEnabled: true,
      rememberDevice: true,
      sessionTimeout: 45 * 60 * 1000, // 45 minutes
    },
    security: {
      enforceStrongPasswords: true,
      maxFailedAttempts: 3,
      lockoutDuration: 60 * 60 * 1000, // 1 hour
      requireDeviceVerification: true,
    },
  },

  technician: {
    type: "technician" as const,
    loginMethods: ["email"],
    features: {
      mfaRequired: false,
      allowPortalIdLogin: false,
      allowAccountNumberLogin: false,
      ssoEnabled: false,
      rememberDevice: true,
      sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours (long work sessions)
    },
    security: {
      enforceStrongPasswords: true,
      maxFailedAttempts: 5,
      lockoutDuration: 15 * 60 * 1000, // 15 minutes
      requireDeviceVerification: false,
    },
  },

  management: {
    type: "management" as const,
    loginMethods: ["email"],
    features: {
      mfaRequired: true,
      allowPortalIdLogin: false,
      allowAccountNumberLogin: false,
      ssoEnabled: true,
      rememberDevice: true,
      sessionTimeout: 2 * 60 * 60 * 1000, // 2 hours
    },
    security: {
      enforceStrongPasswords: true,
      maxFailedAttempts: 3,
      lockoutDuration: 60 * 60 * 1000, // 1 hour
      requireDeviceVerification: true,
    },
  },
} as const;

// Utility functions
export function createPortalConfig(
  type: keyof typeof PORTAL_CONFIGS,
  overrides: Partial<PortalConfig>,
): PortalConfig {
  const baseConfig = PORTAL_CONFIGS[type];

  return {
    id: `${type}-portal`,
    name: `${type.charAt(0).toUpperCase() + type.slice(1)} Portal`,
    tenantId: "default",
    branding: {
      logo: "",
      companyName: "DotMac Framework",
      primaryColor: "#3B82F6",
      secondaryColor: "#1E40AF",
    },
    ...baseConfig,
    ...overrides,
  };
}

// Portal detection utilities
export function detectPortalFromURL(): keyof typeof PORTAL_CONFIGS {
  if (typeof window === "undefined") return "customer";

  const { hostname, port } = window.location;

  // Development port detection
  const devPortMap: Record<string, keyof typeof PORTAL_CONFIGS> = {
    "3000": "admin",
    "3001": "management",
    "3002": "customer",
    "3003": "reseller",
    "3004": "technician",
  };

  if (devPortMap[port]) {
    return devPortMap[port];
  }

  // Production subdomain detection
  const subdomain = hostname.split(".")[0];
  const subdomainMap: Record<string, keyof typeof PORTAL_CONFIGS> = {
    admin: "admin",
    manage: "management",
    management: "management",
    my: "customer",
    customer: "customer",
    partner: "reseller",
    reseller: "reseller",
    tech: "technician",
    technician: "technician",
  };

  return subdomainMap[subdomain] || "customer";
}

// Create auth hook with portal auto-detection
export function usePortalAuth(overrides?: Partial<AuthProviderConfig>) {
  const portalType = detectPortalFromURL();
  const portal = createPortalConfig(portalType, overrides?.portal || {});

  return useAuth({
    portal,
    autoRefresh: true,
    secureStorage: true,
    rateLimiting: true,
    ...overrides,
  });
}
