/**
 * Role-based route protection hook for ISP platform
 */

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { usePermissions } from "./usePermissions";
import { usePortalIdAuth } from "./usePortalIdAuth";

interface RouteConfig {
  path: string;
  requiredRoles?: string[];
  requiredPermissions?: string[];
  requiredFeatures?: string[];
  allowedPortals?: Array<"admin" | "customer" | "reseller">;
  redirectTo?: string;
  exact?: boolean;
}

// ISP-specific route configurations
const ROUTE_CONFIGS: RouteConfig[] = [
  // Admin Portal Routes
  {
    path: "/admin",
    allowedPortals: ["admin"],
    requiredRoles: [
      "super-admin",
      "tenant-admin",
      "network-engineer",
      "billing-manager",
      "support-manager",
    ],
    redirectTo: "/unauthorized",
  },
  {
    path: "/admin/customers",
    allowedPortals: ["admin"],
    requiredPermissions: ["customers:read"],
    requiredRoles: ["tenant-admin", "billing-manager", "support-agent", "customer-service"],
  },
  {
    path: "/admin/customers/create",
    allowedPortals: ["admin"],
    requiredPermissions: ["customers:create"],
    requiredRoles: ["tenant-admin", "billing-manager"],
  },
  {
    path: "/admin/network",
    allowedPortals: ["admin"],
    requiredPermissions: ["network:read"],
    requiredRoles: ["tenant-admin", "network-engineer"],
  },
  {
    path: "/admin/network/devices",
    allowedPortals: ["admin"],
    requiredPermissions: ["network:write", "devices:write"],
    requiredRoles: ["tenant-admin", "network-engineer"],
  },
  {
    path: "/admin/billing",
    allowedPortals: ["admin"],
    requiredPermissions: ["billing:read"],
    requiredRoles: ["tenant-admin", "billing-manager"],
  },
  {
    path: "/admin/billing/invoices",
    allowedPortals: ["admin"],
    requiredPermissions: ["billing:write", "invoices:write"],
    requiredRoles: ["tenant-admin", "billing-manager"],
  },
  {
    path: "/admin/support",
    allowedPortals: ["admin"],
    requiredPermissions: ["support:read"],
    requiredRoles: ["tenant-admin", "support-manager", "support-agent"],
  },
  {
    path: "/admin/analytics",
    allowedPortals: ["admin"],
    requiredPermissions: ["analytics:read"],
    requiredRoles: ["tenant-admin", "network-engineer", "billing-manager", "support-manager"],
  },
  {
    path: "/admin/workflows",
    allowedPortals: ["admin"],
    requiredPermissions: ["workflows:read"],
    requiredRoles: ["tenant-admin"],
  },
  {
    path: "/admin/audit",
    allowedPortals: ["admin"],
    requiredPermissions: ["audit:read"],
    requiredRoles: ["tenant-admin", "super-admin"],
  },
  {
    path: "/admin/security",
    allowedPortals: ["admin"],
    requiredPermissions: ["security:read"],
    requiredRoles: ["tenant-admin", "super-admin"],
  },
  {
    path: "/admin/settings",
    allowedPortals: ["admin"],
    requiredPermissions: ["settings:read"],
    requiredRoles: ["tenant-admin", "super-admin"],
  },

  // Customer Portal Routes
  {
    path: "/services",
    allowedPortals: ["customer"],
    requiredRoles: ["customer"],
    requiredPermissions: ["services:read"],
  },
  {
    path: "/usage",
    allowedPortals: ["customer"],
    requiredRoles: ["customer"],
    requiredPermissions: ["usage:read"],
  },
  {
    path: "/billing",
    allowedPortals: ["customer"],
    requiredRoles: ["customer"],
    requiredPermissions: ["billing:read"],
  },
  {
    path: "/support",
    allowedPortals: ["customer"],
    requiredRoles: ["customer"],
    requiredPermissions: ["support:create", "support:read"],
  },
  {
    path: "/documents",
    allowedPortals: ["customer"],
    requiredRoles: ["customer"],
    requiredPermissions: ["documents:read"],
  },

  // Reseller Portal Routes
  {
    path: "/customers",
    allowedPortals: ["reseller"],
    requiredRoles: ["reseller-admin", "reseller-agent"],
    requiredPermissions: ["customers:read"],
  },
  {
    path: "/onboarding",
    allowedPortals: ["reseller"],
    requiredRoles: ["reseller-admin", "reseller-agent"],
    requiredPermissions: ["customers:create"],
  },
  {
    path: "/commissions",
    allowedPortals: ["reseller"],
    requiredRoles: ["reseller-admin", "reseller-agent"],
    requiredPermissions: ["commissions:read"],
  },
  {
    path: "/analytics",
    allowedPortals: ["reseller"],
    requiredRoles: ["reseller-admin"],
    requiredPermissions: ["analytics:read"],
  },
  {
    path: "/goals",
    allowedPortals: ["reseller"],
    requiredRoles: ["reseller-admin", "reseller-agent"],
    requiredPermissions: ["goals:read"],
  },
  {
    path: "/territory",
    allowedPortals: ["reseller"],
    requiredRoles: ["reseller-admin"],
    requiredPermissions: ["territory:read"],
  },
  {
    path: "/resources",
    allowedPortals: ["reseller"],
    requiredRoles: ["reseller-admin", "reseller-agent"],
    requiredPermissions: ["resources:read"],
  },
  {
    path: "/partner",
    allowedPortals: ["reseller"],
    requiredRoles: ["reseller-admin", "reseller-agent"],
    requiredPermissions: ["partner:read"],
  },
];

export interface RouteProtectionResult {
  isAllowed: boolean;
  isLoading: boolean;
  redirectPath?: string;
  reason?:
    | "portal_mismatch"
    | "insufficient_role"
    | "insufficient_permissions"
    | "missing_features"
    | "unauthenticated";
}

// Composition helpers for route protection
const RouteMatchers = {
  findExactMatch: (path: string, configs: RouteConfig[]) =>
    configs.find((config) => config.exact !== false && config.path === path),

  findPrefixMatch: (path: string, configs: RouteConfig[]) =>
    configs
      .filter((config) => config.exact !== true)
      .find((config) => path.startsWith(config.path)),

  findRouteConfig: (path: string): RouteConfig | null => {
    const exactMatch = RouteMatchers.findExactMatch(path, ROUTE_CONFIGS);
    if (exactMatch) {
      return exactMatch;
    }
    return RouteMatchers.findPrefixMatch(path, ROUTE_CONFIGS) || null;
  },
};

const AccessValidators = {
  checkAuthentication: (user: unknown): RouteProtectionResult | null => {
    if (!user) {
      return {
        isAllowed: false,
        isLoading: false,
        redirectPath: "/",
        reason: "unauthenticated",
      };
    }
    return null;
  },

  checkPortalAccess: (
    config: RouteConfig,
    currentPortal: { type: "admin" | "customer" | "reseller" } | null,
  ): RouteProtectionResult | null => {
    if (config.allowedPortals && currentPortal) {
      if (!config.allowedPortals.includes(currentPortal.type)) {
        return {
          isAllowed: false,
          isLoading: false,
          redirectPath: RouteHelpers.getPortalDefaultRoute(currentPortal.type),
          reason: "portal_mismatch",
        };
      }
    }
    return null;
  },

  checkRoleAccess: (
    config: RouteConfig,
    checkAnyRole: (roles: string[]) => boolean,
    currentPortal: { type: "admin" | "customer" | "reseller" } | null,
  ): RouteProtectionResult | null => {
    if (config.requiredRoles && config.requiredRoles.length > 0) {
      if (!checkAnyRole(config.requiredRoles)) {
        return {
          isAllowed: false,
          isLoading: false,
          redirectPath:
            config.redirectTo || RouteHelpers.getPortalDefaultRoute(currentPortal?.type),
          reason: "insufficient_role",
        };
      }
    }
    return null;
  },

  checkPermissionAccess: (
    config: RouteConfig,
    hasAnyPermission: (permissions: string[]) => boolean,
    currentPortal: { type: "admin" | "customer" | "reseller" } | null,
  ): RouteProtectionResult | null => {
    if (config.requiredPermissions && config.requiredPermissions.length > 0) {
      if (!hasAnyPermission(config.requiredPermissions)) {
        return {
          isAllowed: false,
          isLoading: false,
          redirectPath:
            config.redirectTo || RouteHelpers.getPortalDefaultRoute(currentPortal?.type),
          reason: "insufficient_permissions",
        };
      }
    }
    return null;
  },

  checkFeatureAccess: (
    config: RouteConfig,
    hasFeature: (feature: string) => boolean,
    currentPortal: { type: "admin" | "customer" | "reseller" } | null,
  ): RouteProtectionResult | null => {
    if (config.requiredFeatures && config.requiredFeatures.length > 0) {
      const hasRequiredFeatures = config.requiredFeatures.every((feature) => hasFeature(feature));
      if (!hasRequiredFeatures) {
        return {
          isAllowed: false,
          isLoading: false,
          redirectPath:
            config.redirectTo || RouteHelpers.getPortalDefaultRoute(currentPortal?.type),
          reason: "missing_features",
        };
      }
    }
    return null;
  },
};

const RouteHelpers = {
  getPortalDefaultRoute: (portalType?: "admin" | "customer" | "reseller"): string => {
    switch (portalType) {
      case "admin":
      case "customer":
      case "reseller":
        return "/";
      default:
        return "/unauthorized";
    }
  },
};

export function useRouteProtection(): RouteProtectionResult {
  const router = useRouter();
  const pathname = usePathname();
  const { user, currentPortal, isLoading: authLoading } = usePortalIdAuth();
  const { checkAnyRole, hasAnyPermission, _hasFeature } = usePermissions();

  const [protectionResult, setProtectionResult] = useState<RouteProtectionResult>({
    isAllowed: false,
    isLoading: true,
  });

  // Find matching route configuration
  const findRouteConfig = RouteMatchers.findRouteConfig;

  // Helper functions using composition
  const checkAuthentication = useCallback(
    (): RouteProtectionResult | null => AccessValidators.checkAuthentication(user),
    [user],
  );

  const checkPortalAccess = useCallback(
    (config: RouteConfig): RouteProtectionResult | null =>
      AccessValidators.checkPortalAccess(config, currentPortal),
    [currentPortal],
  );

  const checkRoleAccess = useCallback(
    (config: RouteConfig): RouteProtectionResult | null =>
      AccessValidators.checkRoleAccess(config, checkAnyRole, currentPortal),
    [checkAnyRole, currentPortal],
  );

  const checkPermissionAccess = useCallback(
    (config: RouteConfig): RouteProtectionResult | null =>
      AccessValidators.checkPermissionAccess(config, hasAnyPermission, currentPortal),
    [hasAnyPermission, currentPortal],
  );

  const checkFeatureAccess = useCallback(
    (config: RouteConfig): RouteProtectionResult | null =>
      AccessValidators.checkFeatureAccess(config, _hasFeature, currentPortal),
    [_hasFeature, currentPortal],
  );

  // Check if user has access to route
  const checkRouteAccess = useCallback(
    (config: RouteConfig): RouteProtectionResult => {
      // Check authentication
      const authResult = checkAuthentication();
      if (authResult) {
        return authResult;
      }

      // Check portal access
      const portalResult = checkPortalAccess(config);
      if (portalResult) {
        return portalResult;
      }

      // Check role access
      const roleResult = checkRoleAccess(config);
      if (roleResult) {
        return roleResult;
      }

      // Check permission access
      const permissionResult = checkPermissionAccess(config);
      if (permissionResult) {
        return permissionResult;
      }

      // Check feature access
      const featureResult = checkFeatureAccess(config);
      if (featureResult) {
        return featureResult;
      }

      return {
        isAllowed: true,
        isLoading: false,
      };
    },
    [
      checkAuthentication,
      checkPortalAccess,
      checkRoleAccess,
      checkPermissionAccess,
      checkFeatureAccess,
    ],
  );

  // Check route protection whenever pathname, user, or portal changes
  useEffect(() => {
    if (authLoading) {
      setProtectionResult({ isAllowed: false, isLoading: true });
      return;
    }

    const routeConfig = findRouteConfig(pathname);

    // If no route config, allow access (public route)
    if (!routeConfig) {
      setProtectionResult({ isAllowed: true, isLoading: false });
      return;
    }

    const result = checkRouteAccess(routeConfig);
    setProtectionResult(result);

    // Redirect if access is denied
    if (!result.isAllowed && result.redirectPath && !result.isLoading) {
      router.push(result.redirectPath);
    }
  }, [pathname, authLoading, router, checkRouteAccess, findRouteConfig]);

  return protectionResult;
}

// Hook for protecting specific routes with custom configuration
export function useCustomRouteProtection(config: Omit<RouteConfig, "path">): RouteProtectionResult {
  const pathname = usePathname();
  const { user, currentPortal, isLoading: authLoading } = usePortalIdAuth();
  const { checkAnyRole, hasAnyPermission, _hasFeature } = usePermissions();

  const [protectionResult, setProtectionResult] = useState<RouteProtectionResult>({
    isAllowed: false,
    isLoading: true,
  });

  // Helper to perform all custom route validations
  const validateCustomRoute = useCallback((): RouteProtectionResult => {
    const routeConfig: RouteConfig = { ...config, path: pathname };

    // Use existing validators
    const authResult = AccessValidators.checkAuthentication(user);
    if (authResult) {
      return authResult;
    }

    const portalResult = AccessValidators.checkPortalAccess(routeConfig, currentPortal);
    if (portalResult) {
      return portalResult;
    }

    const roleResult = AccessValidators.checkRoleAccess(routeConfig, checkAnyRole, currentPortal);
    if (roleResult) {
      return roleResult;
    }

    const permissionResult = AccessValidators.checkPermissionAccess(
      routeConfig,
      hasAnyPermission,
      currentPortal,
    );
    if (permissionResult) {
      return permissionResult;
    }

    const featureResult = AccessValidators.checkFeatureAccess(
      routeConfig,
      _hasFeature,
      currentPortal,
    );
    if (featureResult) {
      return featureResult;
    }

    return { isAllowed: true, isLoading: false };
  }, [pathname, config, user, currentPortal, checkAnyRole, hasAnyPermission, _hasFeature]);

  useEffect(() => {
    if (authLoading) {
      setProtectionResult({ isAllowed: false, isLoading: true });
      return;
    }

    const result = validateCustomRoute();
    setProtectionResult(result);
  }, [authLoading, validateCustomRoute]);

  return protectionResult;
}

// Higher-order component for route protection
export function withRouteProtection<P extends object>(
  Component: React.ComponentType<P>,
  config?: Omit<RouteConfig, "path">,
) {
  return function ProtectedComponent(props: P) {
    const protection = config ? useCustomRouteProtection(config) : useRouteProtection();

    if (protection.isLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-blue-600 border-b-2" />
          <span className="ml-2 text-gray-600">Checking permissions...</span>
        </div>
      );
    }

    if (!protection.isAllowed) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center">
          <div className="text-center">
            <h1 className="mb-4 font-bold text-2xl text-gray-900">Access Denied</h1>
            <p className="mb-6 text-gray-600">{getAccessDeniedMessage(protection.reason)}</p>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
}

// Get user-friendly access denied message
function getAccessDeniedMessage(reason?: string): string {
  switch (reason) {
    case "unauthenticated":
      return "Please sign in to access this page.";
    case "portal_mismatch":
      return "This page is not available in your current portal.";
    case "insufficient_role":
      return "Your role does not have access to this page.";
    case "insufficient_permissions":
      return "You do not have the required permissions to access this page.";
    case "missing_features":
      return "This feature is not available in your current plan.";
    default:
      return "You do not have permission to access this page.";
  }
}
