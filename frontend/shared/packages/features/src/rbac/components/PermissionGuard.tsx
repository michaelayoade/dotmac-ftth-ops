/**
 * Permission Guard Components
 * Provides permission-based visibility and access control
 * Shared between ISP Ops and Platform Admin applications.
 */

import { AlertCircle, Lock } from "lucide-react";
import React from "react";

// Note: PermissionCategory and PermissionAction are enums in the RBAC context
// We use string here to allow compatibility with enum values
export type PermissionCategory = string;
export type PermissionAction = string;

export interface RBACContext {
  permissions: any;
  loading: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasRole: (role: string) => boolean;
  canAccess: (category: string, action?: string) => boolean;
}

interface Router {
  push: (path: string) => void;
}

export interface PermissionGuardDependencies {
  useRBAC: () => RBACContext;
  useRouter: () => Router;
}

/**
 * Permission guard for components
 * Hides or shows content based on permissions
 */
export interface PermissionGuardProps {
  children: React.ReactNode;
  permission?: string | string[];
  role?: string;
  category?: PermissionCategory;
  action?: PermissionAction;
  fallback?: React.ReactNode;
  showFallback?: boolean;
}

/**
 * Route guard for pages
 * Redirects to login or shows access denied
 */
export interface RouteGuardProps {
  children: React.ReactNode;
  permission?: string | string[];
  role?: string;
  category?: PermissionCategory;
  action?: PermissionAction;
  redirectTo?: string;
}

/**
 * Can component props
 * Renders children if user has permission
 */
export interface CanProps {
  children: React.ReactNode;
  I: string | string[]; // permission(s)
  fallback?: React.ReactNode;
}

/**
 * Button with permission check props
 */
export interface PermissionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  permission?: string | string[];
  role?: string;
  category?: PermissionCategory;
  action?: PermissionAction;
  hideWhenUnauthorized?: boolean;
  disableWhenUnauthorized?: boolean;
}

/**
 * Menu item with permission check props
 */
export interface PermissionMenuItemProps {
  children: React.ReactNode;
  permission?: string | string[];
  role?: string;
  category?: PermissionCategory;
  action?: PermissionAction;
  onClick?: () => void;
  className?: string;
}

export function createPermissionGuard(deps: PermissionGuardDependencies) {
  function PermissionGuard({
    children,
    permission,
    role,
    category,
    action,
    fallback,
    showFallback = false,
  }: PermissionGuardProps) {
    const { hasPermission, hasAnyPermission, hasRole, canAccess } = deps.useRBAC();

    // Check permissions
    let hasAccess = false;

    if (permission) {
      hasAccess = Array.isArray(permission)
        ? hasAnyPermission(permission)
        : hasPermission(permission);
    } else if (role) {
      hasAccess = hasRole(role);
    } else if (category) {
      hasAccess = canAccess(category, action);
    } else {
      // No permission specified, show by default
      hasAccess = true;
    }

    if (hasAccess) {
      return <>{children}</>;
    }

    if (showFallback && fallback) {
      return <>{fallback}</>;
    }

    if (showFallback && !fallback) {
      return <AccessDenied />;
    }

    return null;
  }

  function RouteGuard({
    children,
    permission,
    role,
    category,
    action,
    redirectTo = "/dashboard",
  }: RouteGuardProps) {
    const router = deps.useRouter();
    const { permissions, loading, hasPermission, hasAnyPermission, hasRole, canAccess } =
      deps.useRBAC();

    // Show loading while checking permissions
    if (loading) {
      return <LoadingPermissions />;
    }

    // No user permissions loaded (not authenticated)
    if (!permissions) {
      router.push("/login");
      return <LoadingPermissions />;
    }

    // Check permissions
    let hasAccess = false;

    if (permission) {
      hasAccess = Array.isArray(permission)
        ? hasAnyPermission(permission)
        : hasPermission(permission);
    } else if (role) {
      hasAccess = hasRole(role);
    } else if (category) {
      hasAccess = canAccess(category, action);
    } else {
      // No specific permission required
      hasAccess = true;
    }

    if (!hasAccess) {
      return <AccessDeniedPage redirectTo={redirectTo} router={router} />;
    }

    return <>{children}</>;
  }

  function Can({ children, I, fallback }: CanProps) {
    const { hasPermission, hasAnyPermission } = deps.useRBAC();

    const hasAccess = Array.isArray(I) ? hasAnyPermission(I) : hasPermission(I);

    if (hasAccess) {
      return <>{children}</>;
    }

    return <>{fallback || null}</>;
  }

  /**
   * Cannot component - opposite of Can
   */
  function Cannot({ children, I, fallback }: CanProps) {
    const { hasPermission, hasAnyPermission } = deps.useRBAC();

    const hasAccess = Array.isArray(I) ? hasAnyPermission(I) : hasPermission(I);

    if (!hasAccess) {
      return <>{children}</>;
    }

    return <>{fallback || null}</>;
  }

  /**
   * Higher-order component for permission-based routing
   */
  function withPermission<T extends object>(
    Component: React.ComponentType<T>,
    options: {
      permission?: string | string[];
      role?: string;
      category?: PermissionCategory;
      action?: PermissionAction;
      redirectTo?: string;
    },
  ) {
    return function ProtectedComponent(props: T) {
      return (
        <RouteGuard {...options}>
          <Component {...props} />
        </RouteGuard>
      );
    };
  }

  /**
   * Permission visibility helper
   * Returns visibility props based on permissions
   */
  function usePermissionVisibility(
    permission?: string | string[],
    options?: {
      hideCompletely?: boolean;
      disableOnly?: boolean;
    },
  ) {
    const { hasPermission, hasAnyPermission } = deps.useRBAC();

    const hasAccess = permission
      ? Array.isArray(permission)
        ? hasAnyPermission(permission)
        : hasPermission(permission)
      : true;

    if (options?.hideCompletely && !hasAccess) {
      return { hidden: true, disabled: false };
    }

    if (options?.disableOnly && !hasAccess) {
      return { hidden: false, disabled: true };
    }

    return { hidden: !hasAccess, disabled: !hasAccess };
  }

  function PermissionButton({
    permission,
    role,
    category,
    action,
    hideWhenUnauthorized = false,
    disableWhenUnauthorized = true,
    children,
    ...props
  }: PermissionButtonProps) {
    const { hasPermission, hasAnyPermission, hasRole, canAccess } = deps.useRBAC();

    // Check permissions
    let hasAccess = true;

    if (permission) {
      hasAccess = Array.isArray(permission)
        ? hasAnyPermission(permission)
        : hasPermission(permission);
    } else if (role) {
      hasAccess = hasRole(role);
    } else if (category) {
      hasAccess = canAccess(category, action);
    }

    if (hideWhenUnauthorized && !hasAccess) {
      return null;
    }

    return (
      <button
        {...props}
        disabled={props.disabled || (disableWhenUnauthorized && !hasAccess)}
        title={!hasAccess ? "You do not have permission to perform this action" : props.title}
      >
        {children}
      </button>
    );
  }

  function PermissionMenuItem({
    children,
    permission,
    role,
    category,
    action,
    onClick,
    className,
  }: PermissionMenuItemProps) {
    const { hasPermission, hasAnyPermission, hasRole, canAccess } = deps.useRBAC();

    // Check permissions
    let hasAccess = true;

    if (permission) {
      hasAccess = Array.isArray(permission)
        ? hasAnyPermission(permission)
        : hasPermission(permission);
    } else if (role) {
      hasAccess = hasRole(role);
    } else if (category) {
      hasAccess = canAccess(category, action);
    }

    if (!hasAccess) {
      return null;
    }

    return (
      <div onClick={onClick} className={className}>
        {children}
      </div>
    );
  }

  return {
    PermissionGuard,
    RouteGuard,
    Can,
    Cannot,
    withPermission,
    usePermissionVisibility,
    PermissionButton,
    PermissionMenuItem,
  };
}

/**
 * Loading permissions component
 */
function LoadingPermissions() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin h-12 w-12 border-4 border-sky-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-slate-400">Checking permissions...</p>
      </div>
    </div>
  );
}

/**
 * Access denied component
 */
function AccessDenied() {
  return (
    <div className="bg-red-900/10 border border-red-800 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <Lock className="h-5 w-5 text-red-500" />
        <div>
          <p className="text-red-400 font-medium">Access Denied</p>
          <p className="text-red-400/70 text-sm">
            You don&apos;t have permission to view this content
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Access denied page
 */
function AccessDeniedPage({ redirectTo, router }: { redirectTo: string; router: any }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="max-w-md w-full bg-slate-900 rounded-lg p-8 text-center">
        <div className="h-16 w-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-slate-400 mb-6">
          You don&apos;t have permission to access this page. Please contact your administrator if
          you believe this is an error.
        </p>
        <button
          onClick={() => router.push(redirectTo)}
          className="w-full bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
