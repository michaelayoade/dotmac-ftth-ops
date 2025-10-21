/**
 * Role-based permissions hook and utilities
 */

import { useMemo } from "react";

import { useAuthStore } from "../stores/authStore";
import { useTenantStore } from "../stores/tenantStore";

export interface PermissionRule {
  resource: string;
  action: string;
  conditions?: Array<{
    field: string;
    operator: "equals" | "not_equals" | "in" | "not_in" | "contains";
    value: unknown;
  }>;
}

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  inherits?: string[]; // Inherit from other roles
  restrictions?: {
    timeWindows?: Array<{
      start: string;
      end: string;
      days: number[];
    }>;
    ipWhitelist?: string[];
    maxSessions?: number;
  };
}

// Standard ISP roles
export const STANDARD_ROLES: Record<string, RoleDefinition> = {
  "super-admin": {
    id: "super-admin",
    name: "Super Administrator",
    description: "Full platform access across all tenants",
    permissions: ["*"], // Wildcard for all permissions
  },

  "tenant-admin": {
    id: "tenant-admin",
    name: "Tenant Administrator",
    description: "Full access within tenant",
    permissions: [
      "users:*",
      "billing:*",
      "network:*",
      "support:*",
      "analytics:read",
      "settings:*",
      "audit:read",
    ],
  },

  "network-engineer": {
    id: "network-engineer",
    name: "Network Engineer",
    description: "Network infrastructure management",
    permissions: [
      "network:*",
      "devices:*",
      "monitoring:*",
      "alerts:*",
      "users:read",
      "analytics:read",
    ],
  },

  "billing-manager": {
    id: "billing-manager",
    name: "Billing Manager",
    description: "Billing and financial operations",
    permissions: [
      "billing:*",
      "invoices:*",
      "payments:*",
      "customers:read",
      "customers:update",
      "analytics:read",
      "reports:read",
    ],
  },

  "support-agent": {
    id: "support-agent",
    name: "Support Agent",
    description: "Customer support operations",
    permissions: [
      "support:*",
      "tickets:*",
      "customers:read",
      "customers:update",
      "network:read",
      "billing:read",
      "chat:*",
    ],
  },

  "support-manager": {
    id: "support-manager",
    name: "Support Manager",
    description: "Support team management",
    inherits: ["support-agent"],
    permissions: ["support:manage", "users:read", "analytics:read", "reports:read"],
  },

  "customer-service": {
    id: "customer-service",
    name: "Customer Service",
    description: "Customer account management",
    permissions: [
      "customers:read",
      "customers:update",
      "billing:read",
      "support:read",
      "support:create",
      "network:read",
    ],
  },

  viewer: {
    id: "viewer",
    name: "Viewer",
    description: "Read-only access",
    permissions: [
      "dashboard:read",
      "analytics:read",
      "network:read",
      "customers:read",
      "billing:read",
    ],
  },

  "reseller-admin": {
    id: "reseller-admin",
    name: "Reseller Administrator",
    description: "Reseller portal administration",
    permissions: [
      "reseller:*",
      "customers:*",
      "billing:read",
      "support:read",
      "analytics:read",
      "commissions:read",
    ],
  },

  "reseller-agent": {
    id: "reseller-agent",
    name: "Reseller Agent",
    description: "Reseller sales agent",
    permissions: [
      "customers:create",
      "customers:read",
      "customers:update",
      "billing:read",
      "support:read",
      "commissions:read",
    ],
  },
};

// Permission utilities
export class PermissionEngine {
  static expandPermissions(
    permissions: string[],
    _roles: Record<string, RoleDefinition> = STANDARD_ROLES,
  ): string[] {
    const expanded = new Set<string>();

    const processPermissions = (perms: string[], _processedRoles = new Set<string>()) => {
      for (const perm of perms) {
        if (perm === "*") {
          // Wildcard permission
          expanded.add("*");
          continue;
        }

        if (perm.endsWith(":*")) {
          // Resource wildcard
          expanded.add(perm);
          continue;
        }

        expanded.add(perm);
      }
    };

    processPermissions(permissions);
    return Array.from(expanded);
  }

  static checkPermission(userPermissions: string[], requiredPermission: string): boolean {
    // Check for wildcard permission
    if (userPermissions.includes("*")) {
      return true;
    }

    // Check for exact match
    if (userPermissions.includes(requiredPermission)) {
      return true;
    }

    // Check for resource wildcard
    const [resource] = requiredPermission.split(":");
    if (userPermissions.includes(`${resource}:*`)) {
      return true;
    }

    return false;
  }

  static evaluateConditions(
    conditions: PermissionRule["conditions"],
    context: Record<string, unknown>,
  ): boolean {
    if (!conditions || conditions.length === 0) {
      return true;
    }

    return conditions.every((condition) => {
      const contextValue = context[condition.field];

      switch (condition.operator) {
        case "equals":
          return contextValue === condition.value;
        case "not_equals":
          return contextValue !== condition.value;
        case "in":
          return Array.isArray(condition.value) && condition.value.includes(contextValue);
        case "not_in":
          return Array.isArray(condition.value) && !condition.value.includes(contextValue);
        case "contains":
          return String(contextValue).includes(String(condition.value));
        default:
          return false;
      }
    });
  }
}

// Permissions hook
export function usePermissions() {
  const { user } = useAuthStore();
  const { currentTenant, hasPermission, hasAnyPermission, hasAllPermissions, hasFeature } =
    useTenantStore();

  const userRoles = useMemo(() => {
    return user?.roles || [];
  }, [user?.roles]);

  const expandedPermissions = useMemo(() => {
    if (!user) {
      return [];
    }
    return PermissionEngine.expandPermissions(user.permissions || []);
  }, [user]);

  const checkPermission = (permission: string, _context?: Record<string, unknown>) => {
    if (!user || !currentTenant) {
      return false;
    }

    // Check tenant-level permission first
    if (hasPermission(permission)) {
      return true;
    }

    // Check user-level permission
    return PermissionEngine.checkPermission(expandedPermissions, permission);
  };

  const checkRole = (roleId: string) => {
    return userRoles.includes(roleId);
  };

  const checkAnyRole = (roleIds: string[]) => {
    return roleIds.some((roleId) => userRoles.includes(roleId));
  };

  const checkAllRoles = (roleIds: string[]) => {
    return roleIds.every((roleId) => userRoles.includes(roleId));
  };

  const canAccessResource = (
    resource: string,
    action: string = "read",
    context?: Record<string, unknown>,
  ) => {
    const permission = `${resource}:${action}`;
    return checkPermission(permission, context);
  };

  const canAccessPage = (page: string) => {
    // Map pages to required permissions
    const pagePermissions: Record<string, string[]> = {
      "/admin/users": ["users:read"],
      "/admin/billing": ["billing:read"],
      "/admin/network": ["network:read"],
      "/admin/support": ["support:read"],
      "/admin/analytics": ["analytics:read"],
      "/admin/settings": ["settings:read"],
      "/customer/dashboard": ["dashboard:read"],
      "/customer/billing": ["billing:read"],
      "/customer/support": ["support:read"],
      "/reseller/dashboard": ["reseller:read"],
      "/reseller/customers": ["customers:read"],
    };

    const requiredPermissions = pagePermissions[page];
    if (!requiredPermissions) {
      return true; // No specific permissions required
    }

    return hasAnyPermission(requiredPermissions);
  };

  const getAccessibleMenuItems = (
    menuItems: Array<{
      id: string;
      requiredPermissions?: string[];
      requiredRoles?: string[];
      requiredFeatures?: string[];
    }>,
  ) => {
    return menuItems.filter((item) => {
      if (item.requiredPermissions && !hasAnyPermission(item.requiredPermissions)) {
        return false;
      }

      if (item.requiredRoles && !checkAnyRole(item.requiredRoles)) {
        return false;
      }

      if (item.requiredFeatures && !item.requiredFeatures.every((feature) => hasFeature(feature))) {
        return false;
      }

      return true;
    });
  };

  const isAdmin = () => {
    return checkRole("super-admin") || checkRole("tenant-admin");
  };

  const isSuperAdmin = () => {
    return checkRole("super-admin");
  };

  const canImpersonate = () => {
    return checkPermission("users:impersonate") || isSuperAdmin();
  };

  return {
    // Permission checks
    checkPermission,
    hasPermission: checkPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessResource,
    canAccessPage,

    // Role checks
    checkRole,
    checkAnyRole,
    checkAllRoles,
    userRoles,

    // Feature checks
    hasFeature,

    // Utility methods
    getAccessibleMenuItems,
    isAdmin,
    isSuperAdmin,
    canImpersonate,

    // Context
    user,
    currentTenant,
    expandedPermissions,
  };
}

// React component for conditional rendering based on permissions
export interface PermissionGateProps {
  children: React.ReactNode;
  permission?: string;
  permissions?: string[];
  role?: string;
  roles?: string[];
  feature?: string;
  features?: string[];
  requireAll?: boolean; // If true, requires ALL permissions/roles/features
  fallback?: React.ReactNode;
  context?: Record<string, unknown>;
}

export function PermissionGate({
  children,
  permission,
  permissions = [],
  role,
  roles = [],
  feature,
  features = [],
  requireAll = false,
  fallback = null,
  context,
}: PermissionGateProps) {
  const {
    checkPermission,
    hasAnyPermission,
    hasAllPermissions,
    checkRole,
    checkAnyRole,
    checkAllRoles,
    hasFeature,
  } = usePermissions();

  // Helper to check permissions
  const checkPermissions = (): boolean => {
    if (permission) {
      return checkPermission(permission, context);
    }
    if (permissions.length > 0) {
      return requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);
    }
    return true;
  };

  // Helper to check roles
  const checkRoles = (): boolean => {
    if (role) {
      return checkRole(role);
    }
    if (roles.length > 0) {
      return requireAll ? checkAllRoles(roles) : checkAnyRole(roles);
    }
    return true;
  };

  // Helper to check features
  const checkFeatures = (): boolean => {
    if (feature) {
      return hasFeature(feature);
    }
    if (features.length > 0) {
      return requireAll
        ? features.every((f) => hasFeature(f))
        : features.some((f) => hasFeature(f));
    }
    return true;
  };

  const hasAccess = checkPermissions() && checkRoles() && checkFeatures();

  return hasAccess ? children : fallback;
}
