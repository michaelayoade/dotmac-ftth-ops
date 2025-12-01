import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// Devtools are optional; avoid hard dependency in library code
const ReactQueryDevtools: React.FC<{ initialIsOpen?: boolean }> = () => null;
// Note: Auth is now handled by @shared/lib/auth - no provider needed here
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeProvider } from "./components/ThemeProvider";
import { NotificationProvider } from "./components/NotificationProvider";
import { FeatureProvider } from "./components/FeatureProvider";
import { TenantProvider } from "./components/TenantProvider";
import { createPortalQueryClient } from "./utils/queryClients";
import { RBACProvider } from "@dotmac/rbac";

// Portal types formerly defined in @dotmac/auth
export type PortalType = "admin" | "customer" | "reseller" | "technician" | "management";

export interface UniversalProviderProps {
  children: React.ReactNode;
  portal: PortalType;
  features?: FeatureFlags;
  // Note: authVariant removed - Auth is handled by AuthProvider at app level
  tenantVariant?: TenantVariant;
  queryClient?: QueryClient;
  enableDevtools?: boolean;
  config?: {
    // Note: auth config removed - Auth handled by AuthProvider
    apiConfig?: {
      baseUrl?: string;
      timeout?: number;
    };
    queryOptions?: {
      staleTime?: number;
      retry?: (failureCount: number, error: unknown) => boolean;
    };
    notificationOptions?: {
      maxNotifications?: number;
      defaultDuration?: number;
    };
    websocketUrl?: string;
    apiKey?: string;
  };
}

export interface FeatureFlags {
  notifications?: boolean;
  realtime?: boolean;
  analytics?: boolean;
  offline?: boolean;
  websocket?: boolean;
  tenantManagement?: boolean;
  errorHandling?: boolean;
  pwa?: boolean;
  toasts?: boolean;
  devtools?: boolean;
}

// Note: AuthVariant removed - Auth is handled by AuthProvider at app level
export type TenantVariant = "single" | "multi" | "isp";

const defaultFeatures: FeatureFlags = {
  notifications: true,
  realtime: false,
  analytics: false,
  offline: false,
};

/**
 * Universal Provider System
 *
 * Provides a standardized provider architecture across all portals.
 * Eliminates the need for custom provider compositions in each app.
 *
 * Usage:
 * ```tsx
 * <UniversalProviders portal="admin" features={{ realtime: true }}>
 *   <App />
 * </UniversalProviders>
 * ```
 */
export function UniversalProviders({
  children,
  portal,
  features = {},
  tenantVariant = "multi",
  queryClient,
  enableDevtools = process.env["NODE_ENV"] === "development",
  config = {},
}: UniversalProviderProps) {
  // Memoize the query client to prevent recreation on re-renders
  const client = React.useMemo(
    () => queryClient || createPortalQueryClient(portal),
    [queryClient, portal],
  );

  // Merge features with defaults
  const mergedFeatures = React.useMemo(
    () => ({
      ...defaultFeatures,
      ...features,
    }),
    [features],
  );

  // Portal-specific configurations
  const portalConfig = React.useMemo(() => getPortalConfig(portal, config), [portal, config]);

  return (
    <ErrorBoundary portal={portal} fallback={portalConfig.errorFallback}>
      <QueryClientProvider client={client}>
        <ThemeProvider portal={portal} theme={portalConfig.theme}>
          {/* Note: AuthProvider is included at app level, not here */}
          <TenantProvider variant={tenantVariant} portal={portal}>
            <RBACProvider>
              <FeatureProvider features={mergedFeatures}>
                {mergedFeatures.notifications && (
                  <NotificationProvider
                    maxNotifications={portalConfig.notifications.max}
                    defaultDuration={portalConfig.notifications.duration}
                    position={portalConfig.notifications.position}
                  />
                )}
                {children}
              </FeatureProvider>
            </RBACProvider>
          </TenantProvider>
        </ThemeProvider>

        {enableDevtools && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

/**
 * Portal-specific configuration
 * Note: Auth configuration removed - Auth is configured at app level via AuthProvider
 */
function getPortalConfig(portal: PortalType, config: any = {}) {
  // Note: baseAuthConfigs are reference only, not used for runtime auth
  // Keeping this structure for reference if needed in the future
  const baseAuthConfigs = {
    admin: {
      sessionTimeout: 60 * 60 * 1000, // 1 hour
      enableMFA: true,
      enablePermissions: true,
      requirePasswordComplexity: true,
      maxLoginAttempts: 3,
      lockoutDuration: 30 * 60 * 1000, // 30 minutes
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
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
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
      sessionTimeout: 2 * 60 * 60 * 1000, // 2 hours
      enableMFA: true,
      enablePermissions: true,
      requirePasswordComplexity: true,
      maxLoginAttempts: 2,
      lockoutDuration: 60 * 60 * 1000, // 1 hour
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

  const configs = {
    admin: {
      theme: "professional",
      auth: { ...baseAuthConfigs.admin, ...config.auth },
      notifications: {
        max: config.notificationOptions?.maxNotifications || 5,
        duration: config.notificationOptions?.defaultDuration || 5000,
        position: "top-right" as const,
      },
      errorFallback: "AdminErrorFallback",
    },
    customer: {
      theme: "friendly",
      auth: { ...baseAuthConfigs.customer, ...config.auth },
      notifications: {
        max: config.notificationOptions?.maxNotifications || 3,
        duration: config.notificationOptions?.defaultDuration || 4000,
        position: "bottom-right" as const,
      },
      errorFallback: "CustomerErrorFallback",
    },
    reseller: {
      theme: "business",
      auth: { ...baseAuthConfigs.reseller, ...config.auth },
      notifications: {
        max: config.notificationOptions?.maxNotifications || 4,
        duration: config.notificationOptions?.defaultDuration || 6000,
        position: "top-right" as const,
      },
      errorFallback: "ResellerErrorFallback",
    },
    technician: {
      theme: "mobile",
      auth: { ...baseAuthConfigs.technician, ...config.auth },
      notifications: {
        max: config.notificationOptions?.maxNotifications || 2,
        duration: config.notificationOptions?.defaultDuration || 8000,
        position: "bottom-center" as const,
      },
      errorFallback: "TechnicianErrorFallback",
    },
    management: {
      theme: "enterprise",
      auth: { ...baseAuthConfigs.management, ...config.auth },
      notifications: {
        max: config.notificationOptions?.maxNotifications || 6,
        duration: config.notificationOptions?.defaultDuration || 7000,
        position: "top-center" as const,
      },
      errorFallback: "ManagementErrorFallback",
    },
  };

  return configs[portal] || configs.admin;
}

// Types are re-exported from index.ts to avoid duplicate exports
