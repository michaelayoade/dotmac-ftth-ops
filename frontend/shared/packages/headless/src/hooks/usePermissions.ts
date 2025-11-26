/**
 * Unified Permissions Hook
 * Consolidated permission checking across all portals
 */

import { useMemo, useCallback } from "react";
import { useAuth } from "../auth/context";
import { useApiClient } from "../api";

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
  scope?: "global" | "tenant" | "customer" | "reseller";
  inherited?: boolean;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  portal: string;
}

export interface PermissionCheck {
  resource: string;
  action: string;
  context?: Record<string, any>;
}

export interface PermissionContext {
  tenantId?: string;
  customerId?: string;
  resellerId?: string;
  resourceId?: string;
  [key: string]: any;
}

// Pre-defined permission patterns for common operations
export const COMMON_PERMISSIONS = {
  // User management
  USERS_VIEW: { resource: "users", action: "read" },
  USERS_CREATE: { resource: "users", action: "create" },
  USERS_UPDATE: { resource: "users", action: "update" },
  USERS_DELETE: { resource: "users", action: "delete" },

  // Billing operations
  BILLING_VIEW: { resource: "billing", action: "read" },
  BILLING_MANAGE: { resource: "billing", action: "write" },
  BILLING_REPORTS: { resource: "billing", action: "report" },
  PAYMENTS_PROCESS: { resource: "payments", action: "process" },
  INVOICES_CREATE: { resource: "invoices", action: "create" },
  INVOICES_SEND: { resource: "invoices", action: "send" },

  // Customer management
  CUSTOMERS_VIEW: { resource: "customers", action: "read" },
  CUSTOMERS_CREATE: { resource: "customers", action: "create" },
  CUSTOMERS_UPDATE: { resource: "customers", action: "update" },
  CUSTOMERS_DELETE: { resource: "customers", action: "delete" },

  // Network operations
  NETWORK_VIEW: { resource: "network", action: "read" },
  NETWORK_CONFIGURE: { resource: "network", action: "configure" },
  NETWORK_MONITOR: { resource: "network", action: "monitor" },
  DEVICES_MANAGE: { resource: "devices", action: "manage" },

  // Analytics and reporting
  ANALYTICS_VIEW: { resource: "analytics", action: "read" },
  REPORTS_VIEW: { resource: "reports", action: "read" },
  REPORTS_EXPORT: { resource: "reports", action: "export" },

  // System administration
  SYSTEM_CONFIG: { resource: "system", action: "configure" },
  SYSTEM_LOGS: { resource: "logs", action: "read" },
  SYSTEM_BACKUP: { resource: "system", action: "backup" },

  // Reseller operations
  TERRITORIES_MANAGE: { resource: "territories", action: "manage" },
  COMMISSIONS_VIEW: { resource: "commissions", action: "read" },
  PARTNERS_MANAGE: { resource: "partners", action: "manage" },

  // Support operations
  TICKETS_VIEW: { resource: "tickets", action: "read" },
  TICKETS_CREATE: { resource: "tickets", action: "create" },
  TICKETS_ASSIGN: { resource: "tickets", action: "assign" },
  TICKETS_RESOLVE: { resource: "tickets", action: "resolve" },
} as const;

// Portal-specific permission contexts
export const PORTAL_CONTEXTS = {
  admin: {
    scope: "global",
    defaultPermissions: [
      COMMON_PERMISSIONS.SYSTEM_CONFIG,
      COMMON_PERMISSIONS.USERS_VIEW,
      COMMON_PERMISSIONS.BILLING_REPORTS,
      COMMON_PERMISSIONS.ANALYTICS_VIEW,
      COMMON_PERMISSIONS.SYSTEM_LOGS,
    ],
  },
  customer: {
    scope: "customer",
    defaultPermissions: [
      COMMON_PERMISSIONS.BILLING_VIEW,
      { resource: "profile", action: "update" },
      { resource: "services", action: "read" },
      COMMON_PERMISSIONS.TICKETS_CREATE,
    ],
  },
  reseller: {
    scope: "reseller",
    defaultPermissions: [
      COMMON_PERMISSIONS.CUSTOMERS_VIEW,
      COMMON_PERMISSIONS.CUSTOMERS_CREATE,
      COMMON_PERMISSIONS.TERRITORIES_MANAGE,
      COMMON_PERMISSIONS.COMMISSIONS_VIEW,
      COMMON_PERMISSIONS.BILLING_VIEW,
    ],
  },
  technician: {
    scope: "tenant",
    defaultPermissions: [
      COMMON_PERMISSIONS.TICKETS_VIEW,
      COMMON_PERMISSIONS.TICKETS_ASSIGN,
      COMMON_PERMISSIONS.TICKETS_RESOLVE,
      COMMON_PERMISSIONS.NETWORK_VIEW,
      COMMON_PERMISSIONS.DEVICES_MANAGE,
    ],
  },
  management: {
    scope: "global",
    defaultPermissions: [
      COMMON_PERMISSIONS.USERS_VIEW,
      COMMON_PERMISSIONS.BILLING_REPORTS,
      COMMON_PERMISSIONS.ANALYTICS_VIEW,
      COMMON_PERMISSIONS.REPORTS_VIEW,
      COMMON_PERMISSIONS.PARTNERS_MANAGE,
    ],
  },
} as const;

export function usePermissions() {
  const { user, portal, tenantId } = useAuth();
  const portalKey = typeof portal === "string" ? portal : portal?.type;
  const apiClient = useApiClient();

  // Get user's permissions
  const userPermissions = useMemo<Permission[]>(() => {
    if (!user) return [];

    // Combine direct permissions and role-based permissions
    const directPermissions = ((user.permissions || []) as Permission[]).filter(Boolean);
    const rolePermissions = user.roles?.flatMap((role: Role) => role.permissions || []) ?? [];

    // Merge and deduplicate
    const allPermissions: Permission[] = [...directPermissions, ...rolePermissions];
    const uniquePermissions = allPermissions.reduce<Permission[]>((acc, permission) => {
      const key = `${permission.resource}:${permission.action}`;
      if (!acc.some((p) => `${p.resource}:${p.action}` === key)) {
        acc.push(permission);
      }
      return acc;
    }, [] as Permission[]);

    return uniquePermissions;
  }, [user]);

  // Check if user has a specific permission
  const hasPermission = useCallback(
    (check: PermissionCheck, context?: PermissionContext): boolean => {
      if (!user || !userPermissions.length) {
        return false;
      }

      // System admins have all permissions
      if (user.isSuperAdmin || user.roles?.some((role: Role) => role.name === "super_admin")) {
        return true;
      }

      // Find matching permission
      const matchingPermission = userPermissions.find((permission) => {
        // Basic resource and action match
        if (permission.resource !== check.resource || permission.action !== check.action) {
          return false;
        }

        // Check scope restrictions
        if (permission.scope) {
          switch (permission.scope) {
            case "tenant":
              if (!tenantId || (context?.tenantId && context.tenantId !== tenantId)) {
                return false;
              }
              break;
            case "customer":
              if (!context?.customerId || context.customerId !== user.customerId) {
                return false;
              }
              break;
            case "reseller":
              if (!context?.resellerId || context.resellerId !== user.resellerId) {
                return false;
              }
              break;
          }
        }

        // Check conditional permissions
        if (permission.conditions && context) {
          return Object.entries(permission.conditions).every(([key, value]) => {
            const contextValue = context[key];
            if (Array.isArray(value)) {
              return value.includes(contextValue);
            }
            return contextValue === value;
          });
        }

        return true;
      });

      return !!matchingPermission;
    },
    [user, userPermissions, tenantId],
  );

  // Check multiple permissions (AND logic)
  const hasAllPermissions = useCallback(
    (checks: PermissionCheck[], context?: PermissionContext): boolean => {
      return checks.every((check) => hasPermission(check, context));
    },
    [hasPermission],
  );

  // Check multiple permissions (OR logic)
  const hasAnyPermission = useCallback(
    (checks: PermissionCheck[], context?: PermissionContext): boolean => {
      return checks.some((check) => hasPermission(check, context));
    },
    [hasPermission],
  );

  // Get permissions for a specific resource
  const getResourcePermissions = useCallback(
    (resource: string): Permission[] => {
      return userPermissions.filter((permission) => permission.resource === resource);
    },
    [userPermissions],
  );

  // Check if user can perform any action on a resource
  const canAccessResource = useCallback(
    (resource: string, context?: PermissionContext): boolean => {
      return userPermissions.some((permission) => {
        if (permission.resource !== resource) return false;

        return hasPermission(
          {
            resource: permission.resource,
            action: permission.action,
          },
          context,
        );
      });
    },
    [userPermissions, hasPermission],
  );

  // Portal-specific permission helpers
  const portalPermissions = useMemo(() => {
    if (!portalKey || !PORTAL_CONTEXTS[portalKey as keyof typeof PORTAL_CONTEXTS]) {
      return {
        canViewBilling: false,
        canManageUsers: false,
        canAccessReports: false,
        canManageCustomers: false,
        canConfigureSystem: false,
      };
    }

    return {
      // Billing permissions
      canViewBilling: hasPermission(COMMON_PERMISSIONS.BILLING_VIEW),
      canManageBilling: hasPermission(COMMON_PERMISSIONS.BILLING_MANAGE),
      canProcessPayments: hasPermission(COMMON_PERMISSIONS.PAYMENTS_PROCESS),
      canCreateInvoices: hasPermission(COMMON_PERMISSIONS.INVOICES_CREATE),
      canSendInvoices: hasPermission(COMMON_PERMISSIONS.INVOICES_SEND),

      // User management permissions
      canViewUsers: hasPermission(COMMON_PERMISSIONS.USERS_VIEW),
      canManageUsers:
        hasPermission(COMMON_PERMISSIONS.USERS_CREATE) &&
        hasPermission(COMMON_PERMISSIONS.USERS_UPDATE),
      canDeleteUsers: hasPermission(COMMON_PERMISSIONS.USERS_DELETE),

      // Customer management permissions
      canViewCustomers: hasPermission(COMMON_PERMISSIONS.CUSTOMERS_VIEW),
      canManageCustomers:
        hasPermission(COMMON_PERMISSIONS.CUSTOMERS_CREATE) &&
        hasPermission(COMMON_PERMISSIONS.CUSTOMERS_UPDATE),
      canDeleteCustomers: hasPermission(COMMON_PERMISSIONS.CUSTOMERS_DELETE),

      // Analytics and reporting permissions
      canViewAnalytics: hasPermission(COMMON_PERMISSIONS.ANALYTICS_VIEW),
      canAccessReports: hasPermission(COMMON_PERMISSIONS.REPORTS_VIEW),
      canExportReports: hasPermission(COMMON_PERMISSIONS.REPORTS_EXPORT),
      canViewBillingReports: hasPermission(COMMON_PERMISSIONS.BILLING_REPORTS),

      // System administration permissions
      canConfigureSystem: hasPermission(COMMON_PERMISSIONS.SYSTEM_CONFIG),
      canViewLogs: hasPermission(COMMON_PERMISSIONS.SYSTEM_LOGS),
      canManageBackups: hasPermission(COMMON_PERMISSIONS.SYSTEM_BACKUP),

      // Network operations permissions
      canViewNetwork: hasPermission(COMMON_PERMISSIONS.NETWORK_VIEW),
      canConfigureNetwork: hasPermission(COMMON_PERMISSIONS.NETWORK_CONFIGURE),
      canMonitorNetwork: hasPermission(COMMON_PERMISSIONS.NETWORK_MONITOR),
      canManageDevices: hasPermission(COMMON_PERMISSIONS.DEVICES_MANAGE),

      // Reseller permissions
      canManageTerritories: hasPermission(COMMON_PERMISSIONS.TERRITORIES_MANAGE),
      canViewCommissions: hasPermission(COMMON_PERMISSIONS.COMMISSIONS_VIEW),
      canManagePartners: hasPermission(COMMON_PERMISSIONS.PARTNERS_MANAGE),

      // Support permissions
      canViewTickets: hasPermission(COMMON_PERMISSIONS.TICKETS_VIEW),
      canCreateTickets: hasPermission(COMMON_PERMISSIONS.TICKETS_CREATE),
      canAssignTickets: hasPermission(COMMON_PERMISSIONS.TICKETS_ASSIGN),
      canResolveTickets: hasPermission(COMMON_PERMISSIONS.TICKETS_RESOLVE),
    };
  }, [portalKey, hasPermission]);

  // Load user permissions from API
  const refreshPermissions = useCallback(async (): Promise<Permission[]> => {
    try {
      const response = await apiClient.get<{ permissions: Permission[] }>(
        "/auth/permissions",
        { cache: true, cacheTTL: 5 * 60 * 1000 }, // Cache for 5 minutes
      );

      return response?.permissions ?? [];
    } catch (error) {
      console.error("Failed to refresh permissions:", error);
      return [];
    }
  }, [apiClient]);

  // Check permission with API fallback for complex scenarios
  const checkPermissionWithAPI = useCallback(
    async (check: PermissionCheck, context?: PermissionContext): Promise<boolean> => {
      // First try local check
      const localResult = hasPermission(check, context);
      if (localResult) return true;

      // If local check fails, try API for complex permission scenarios
      try {
        const response = await apiClient.post<{ allowed: boolean }>("/auth/check-permission", {
          resource: check.resource,
          action: check.action,
          context: context || {},
        });

        return response?.allowed === true;
      } catch (error) {
        console.error("Permission check API call failed:", error);
        return false;
      }
    },
    [hasPermission, apiClient],
  );

  // Generate permission-aware menu items
  const getPermissionAwareMenuItems = useCallback(
    (
      menuItems: Array<{
        key: string;
        label: string;
        permission?: PermissionCheck;
        permissions?: PermissionCheck[];
        requireAll?: boolean;
        path?: string;
        children?: any[];
      }>,
    ) => {
      return menuItems.filter((item) => {
        if (!item.permission && !item.permissions) return true;

        if (item.permission) {
          return hasPermission(item.permission);
        }

        if (item.permissions) {
          return item.requireAll
            ? hasAllPermissions(item.permissions)
            : hasAnyPermission(item.permissions);
        }

        return true;
      });
    },
    [hasPermission, hasAllPermissions, hasAnyPermission],
  );

  return {
    // Core data
    permissions: userPermissions,
    roles: user?.roles || [],

    // Permission checking functions
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    canAccessResource,
    getResourcePermissions,

    // Portal-specific permissions
    ...portalPermissions,

    // Async operations
    refreshPermissions,
    checkPermissionWithAPI,

    // Utility functions
    getPermissionAwareMenuItems,

    // Constants for easy access
    PERMISSIONS: COMMON_PERMISSIONS,

    // User context
    isAuthenticated: !!user,
    isSuperAdmin: user?.isSuperAdmin || false,
    currentPortal: portalKey,
    currentTenant: tenantId,
    userId: user?.id,
    userRoles: user?.roles?.map((role) => role.name) || [],
  };
}

export default usePermissions;
