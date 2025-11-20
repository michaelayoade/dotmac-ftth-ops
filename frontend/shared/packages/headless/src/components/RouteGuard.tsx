/**
 * Route guard component for protecting pages and components
 */

import type { ReactNode } from "react";

import { useCustomRouteProtection } from "../hooks/useRouteProtection";

interface RouteGuardProps {
  children: ReactNode;
  requiredRoles?: string[];
  requiredPermissions?: string[];
  requiredFeatures?: string[];
  allowedPortals?: Array<"admin" | "customer" | "reseller">;
  fallback?: ReactNode;
  loadingComponent?: ReactNode;
  unauthorizedComponent?: ReactNode;
}

export function RouteGuard({
  children,
  requiredRoles,
  requiredPermissions,
  requiredFeatures,
  allowedPortals,
  fallback,
  loadingComponent,
  unauthorizedComponent,
}: RouteGuardProps) {
  const protection = useCustomRouteProtection({
    requiredRoles: requiredRoles ?? [],
    requiredPermissions: requiredPermissions ?? [],
    requiredFeatures: requiredFeatures ?? [],
    allowedPortals: allowedPortals ?? [],
  });

  if (protection.isLoading) {
    return (
      loadingComponent || (
        <div className="flex items-center justify-center p-8">
          <div className="h-6 w-6 animate-spin rounded-full border-blue-600 border-b-2" />
          <span className="ml-2 text-gray-600 text-sm">Checking permissions...</span>
        </div>
      )
    );
  }

  if (!protection.isAllowed) {
    if (unauthorizedComponent) {
      return <>{unauthorizedComponent}</>;
    }

    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="p-8 text-center">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg
            aria-label="icon"
            className="h-6 w-6 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <title>Icon</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h3 className="mb-2 font-medium text-gray-900 text-lg">Access Restricted</h3>
        <p className="text-gray-600 text-sm">{getAccessDeniedMessage(protection.reason)}</p>
      </div>
    );
  }

  return <>{children}</>;
}

// Specific guard components for common use cases
export function AdminOnlyGuard({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <RouteGuard
      allowedPortals={["admin"]}
      requiredRoles={["super-admin", "tenant-admin"]}
      fallback={fallback}
    >
      {children}
    </RouteGuard>
  );
}

export function CustomerOnlyGuard({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <RouteGuard allowedPortals={["customer"]} requiredRoles={["customer"]} fallback={fallback}>
      {children}
    </RouteGuard>
  );
}

export function ResellerOnlyGuard({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <RouteGuard
      allowedPortals={["reseller"]}
      requiredRoles={["reseller-admin", "reseller-agent"]}
      fallback={fallback}
    >
      {children}
    </RouteGuard>
  );
}

export function NetworkEngineerGuard({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <RouteGuard
      allowedPortals={["admin"]}
      requiredRoles={["tenant-admin", "network-engineer"]}
      requiredPermissions={["network:read"]}
      fallback={fallback}
    >
      {children}
    </RouteGuard>
  );
}

export function BillingManagerGuard({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <RouteGuard
      allowedPortals={["admin"]}
      requiredRoles={["tenant-admin", "billing-manager"]}
      requiredPermissions={["billing:read"]}
      fallback={fallback}
    >
      {children}
    </RouteGuard>
  );
}

export function SupportAgentGuard({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <RouteGuard
      allowedPortals={["admin"]}
      requiredRoles={["tenant-admin", "support-manager", "support-agent"]}
      requiredPermissions={["support:read"]}
      fallback={fallback}
    >
      {children}
    </RouteGuard>
  );
}

// Permission-based guards
export function PermissionGuard({
  children,
  permissions,
  requireAll = false,
  fallback,
}: {
  children: ReactNode;
  permissions: string[];
  requireAll?: boolean;
  fallback?: ReactNode;
}) {
  return (
    <RouteGuard requiredPermissions={permissions} fallback={fallback}>
      {children}
    </RouteGuard>
  );
}

// Feature-based guards
export function FeatureGuard({
  children,
  features,
  fallback,
}: {
  children: ReactNode;
  features: string[];
  fallback?: ReactNode;
}) {
  return (
    <RouteGuard requiredFeatures={features} fallback={fallback}>
      {children}
    </RouteGuard>
  );
}

function getAccessDeniedMessage(reason?: string): string {
  switch (reason) {
    case "unauthenticated":
      return "Please sign in to view this content.";
    case "portal_mismatch":
      return "This content is not available in your current portal.";
    case "insufficient_role":
      return "Your role does not have access to this content.";
    case "insufficient_permissions":
      return "You do not have the required permissions to view this content.";
    case "missing_features":
      return "This feature is not available in your current plan.";
    default:
      return "You do not have permission to view this content.";
  }
}
