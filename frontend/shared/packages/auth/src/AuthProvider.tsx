import * as React from "react";
import type { PortalType } from "./types";
import { SimpleAuthProvider } from "./providers/SimpleAuthProvider";
import { SecureAuthProvider } from "./providers/SecureAuthProvider";
import { EnterpriseAuthProvider } from "./providers/EnterpriseAuthProvider";
import type { AuthVariant, AuthConfig, PartialAuthConfig, AuthContextValue } from "./types";

interface AuthProviderProps {
  children: React.ReactNode;
  variant: AuthVariant;
  portal: PortalType;
  config?: PartialAuthConfig;
}

/**
 * Unified Authentication Provider
 *
 * Selects the appropriate authentication implementation based on variant.
 * Provides consistent API across all portals while allowing different
 * security levels and features.
 */
export function AuthProvider({ children, variant, portal, config = {} }: AuthProviderProps) {
  const providerProps = {
    children,
    portal,
    config: getPortalAuthConfig(portal, config),
  };

  switch (variant) {
    case "simple":
      return <SimpleAuthProvider {...providerProps} />;

    case "secure":
      return <SecureAuthProvider {...providerProps} />;

    case "enterprise":
      return <EnterpriseAuthProvider {...providerProps} />;

    default:
      console.warn(`Unknown auth variant: ${variant}. Falling back to 'secure'.`);
      return <SecureAuthProvider {...providerProps} />;
  }
}

/**
 * Portal-specific authentication configuration
 */
function getPortalAuthConfig(portal: PortalType, overrides: PartialAuthConfig): AuthConfig {
  const baseConfigs: Record<PortalType, AuthConfig> = {
    admin: {
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      enableMFA: true,
      enablePermissions: true,
      requirePasswordComplexity: true,
      maxLoginAttempts: 3,
      lockoutDuration: 15 * 60 * 1000, // 15 minutes
      enableAuditLog: true,
      tokenRefreshThreshold: 5 * 60 * 1000, // 5 minutes
      endpoints: {
        login: "/api/admin/auth/login",
        logout: "/api/admin/auth/logout",
        refresh: "/api/admin/auth/refresh",
        profile: "/api/admin/auth/profile",
      },
    },

    customer: {
      sessionTimeout: 15 * 60 * 1000, // 15 minutes
      enableMFA: false,
      enablePermissions: false,
      requirePasswordComplexity: false,
      maxLoginAttempts: 5,
      lockoutDuration: 10 * 60 * 1000, // 10 minutes
      enableAuditLog: false,
      tokenRefreshThreshold: 2 * 60 * 1000, // 2 minutes
      endpoints: {
        login: "/api/customer/auth/login",
        logout: "/api/customer/auth/logout",
        refresh: "/api/customer/auth/refresh",
        profile: "/api/customer/auth/profile",
      },
    },

    reseller: {
      sessionTimeout: 45 * 60 * 1000, // 45 minutes
      enableMFA: true,
      enablePermissions: true,
      requirePasswordComplexity: true,
      maxLoginAttempts: 3,
      lockoutDuration: 30 * 60 * 1000, // 30 minutes
      enableAuditLog: true,
      tokenRefreshThreshold: 10 * 60 * 1000, // 10 minutes
      endpoints: {
        login: "/api/reseller/auth/login",
        logout: "/api/reseller/auth/logout",
        refresh: "/api/reseller/auth/refresh",
        profile: "/api/reseller/auth/profile",
      },
    },

    technician: {
      sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours (field work)
      enableMFA: false,
      enablePermissions: true,
      requirePasswordComplexity: false,
      maxLoginAttempts: 5,
      lockoutDuration: 5 * 60 * 1000, // 5 minutes
      enableAuditLog: true,
      tokenRefreshThreshold: 30 * 60 * 1000, // 30 minutes
      endpoints: {
        login: "/api/technician/auth/login",
        logout: "/api/technician/auth/logout",
        refresh: "/api/technician/auth/refresh",
        profile: "/api/technician/auth/profile",
      },
    },

    management: {
      sessionTimeout: 60 * 60 * 1000, // 60 minutes
      enableMFA: true,
      enablePermissions: true,
      requirePasswordComplexity: true,
      maxLoginAttempts: 2,
      lockoutDuration: 60 * 60 * 1000, // 60 minutes
      enableAuditLog: true,
      tokenRefreshThreshold: 15 * 60 * 1000, // 15 minutes
      endpoints: {
        login: "/api/management/auth/login",
        logout: "/api/management/auth/logout",
        refresh: "/api/management/auth/refresh",
        profile: "/api/management/auth/profile",
      },
    },
  };

  return {
    ...baseConfigs[portal],
    ...overrides,
  };
}

/**
 * Hook to access authentication context
 * Must be used within an AuthProvider
 */
export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Create context (will be provided by specific auth providers)
export const AuthContext = React.createContext<AuthContextValue | null>(null);
