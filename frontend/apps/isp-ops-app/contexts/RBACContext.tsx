/**
 * RBAC Context Provider
 * Manages roles, permissions, and access control throughout the application
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import { handleError } from "@/lib/utils/error-handler";
import { useToast } from "@dotmac/ui";
import { isAuthBypassEnabled } from "@shared/lib/auth";
import { useTenant } from "@/lib/contexts/tenant-context";
import { useAuth } from "@shared/lib/auth";

// Migrated from sonner to useToast hook
// Note: toast options have changed:
// - sonner: toast.success('msg') -> useToast: toast({ title: 'Success', description: 'msg' })
// - sonner: toast.error('msg') -> useToast: toast({ title: 'Error', description: 'msg', variant: 'destructive' })
// - For complex options, refer to useToast documentation

/**
 * Permission categories matching backend
 */
export enum PermissionCategory {
  USERS = "users",
  BILLING = "billing",
  ANALYTICS = "analytics",
  COMMUNICATIONS = "communications",
  INFRASTRUCTURE = "infrastructure",
  SECRETS = "secrets",
  CUSTOMERS = "customers",
  SETTINGS = "settings",
  SYSTEM = "system",
}

/**
 * Permission actions
 */
export enum PermissionAction {
  CREATE = "create",
  READ = "read",
  UPDATE = "update",
  DELETE = "delete",
  EXECUTE = "execute",
  MANAGE = "manage",
}

/**
 * Types
 */
export interface Permission {
  name: string;
  display_name: string;
  description: string | undefined;
  category: PermissionCategory;
  resource: string | undefined;
  action: string | undefined;
  is_system: boolean;
}

export interface Role {
  name: string;
  display_name: string;
  description: string | undefined;
  parent_role: string | undefined;
  is_system: boolean;
  is_active: boolean;
  permissions: Permission[];
  created_at: string;
  updated_at: string;
}

export interface UserPermissions {
  user_id: string;
  roles: Role[];
  direct_permissions: Permission[];
  effective_permissions: Permission[];
  is_superuser: boolean;
}

export interface RoleCreateRequest {
  name: string;
  display_name: string;
  description: string | undefined;
  parent_role: string | undefined;
  permissions: string[];
}

export interface RoleUpdateRequest {
  display_name: string | undefined;
  description: string | undefined;
  parent_role: string | undefined;
  permissions: string[] | undefined;
  is_active: boolean | undefined;
}

export interface UserRoleAssignment {
  user_id: string;
  role_name: string;
  granted_by: string | undefined;
  expires_at: string | undefined;
}

export interface UserPermissionGrant {
  user_id: string;
  permission_name: string;
  granted_by: string | undefined;
  expires_at: string | undefined;
}

const EMPTY_USER_PERMISSIONS: UserPermissions = {
  user_id: "unknown",
  roles: [],
  direct_permissions: [],
  effective_permissions: [],
  is_superuser: false,
};

/**
 * API functions
 */
const rbacApi = {
  // Permissions
  fetchPermissions: async (category?: PermissionCategory): Promise<Permission[]> => {
    const params = category ? `?category=${category}` : "";
    try {
      const response = await apiClient.get(`/auth/rbac/permissions${params}`);
      return response.data as Permission[];
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        logger.warn("Permissions list returned 403. Returning empty permissions array.");
        return [];
      }
      throw error;
    }
  },

  fetchPermission: async (name: string): Promise<Permission> => {
    try {
      const response = await apiClient.get(`/auth/rbac/permissions/${name}`);
      return response.data as Permission;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        logger.warn("Single permission fetch returned 403. Returning minimal permission record.", {
          permission: name,
        });
        return {
          name,
          display_name: name,
          category: PermissionCategory.SYSTEM,
          is_system: false,
          description: "Permission unavailable due to insufficient access.",
        } as Permission;
      }
      throw error;
    }
  },

  // Roles
  fetchRoles: async (activeOnly = true): Promise<Role[]> => {
    try {
      const response = await apiClient.get(`/auth/rbac/roles?active_only=${activeOnly}`);
      return response.data as Role[];
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        logger.warn("Roles endpoint returned 403. Returning empty roles array.");
        return [];
      }
      throw error;
    }
  },

  createRole: async (data: RoleCreateRequest): Promise<Role> => {
    const response = await apiClient.post("/auth/rbac/roles", data);
    return response.data as Role;
  },

  updateRole: async (name: string, data: RoleUpdateRequest): Promise<Role> => {
    const response = await apiClient.patch(`/auth/rbac/roles/${name}`, data);
    return response.data as Role;
  },

  deleteRole: async (name: string): Promise<void> => {
    await apiClient.delete(`/auth/rbac/roles/${name}`);
  },

  // User permissions
  fetchMyPermissions: async (): Promise<UserPermissions> => {
    try {
      const response = await apiClient.get("/auth/rbac/my-permissions");
      return response.data as UserPermissions;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        logger.warn("My permissions endpoint returned 403. Defaulting to safe permissions.");
        return EMPTY_USER_PERMISSIONS;
      }
      throw error;
    }
  },

  fetchUserPermissions: async (userId: string): Promise<UserPermissions> => {
    try {
      const response = await apiClient.get(`/auth/rbac/users/${userId}/permissions`);
      return response.data as UserPermissions;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        logger.warn("User permissions endpoint returned 403. Defaulting to safe permissions.", {
          userId,
        });
        return { ...EMPTY_USER_PERMISSIONS, user_id: userId };
      }
      throw error;
    }
  },

  assignRoleToUser: async (data: UserRoleAssignment): Promise<void> => {
    await apiClient.post("/auth/rbac/users/assign-role", data);
  },

  revokeRoleFromUser: async (data: UserRoleAssignment): Promise<void> => {
    await apiClient.post("/auth/rbac/users/revoke-role", data);
  },

  grantPermissionToUser: async (data: UserPermissionGrant): Promise<void> => {
    await apiClient.post("/auth/rbac/users/grant-permission", data);
  },
};

/**
 * RBAC Context
 */
interface RBACContextValue {
  // Current user permissions
  permissions: UserPermissions | null;
  loading: boolean;
  error: Error | null;

  // Permission checks
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  hasRole: (role: string) => boolean;
  canAccess: (category: string, action?: string) => boolean;

  // Role management
  roles: Role[];
  createRole: (data: RoleCreateRequest) => Promise<void>;
  updateRole: (name: string, data: RoleUpdateRequest) => Promise<void>;
  deleteRole: (name: string) => Promise<void>;

  // User role/permission management
  assignRole: (userId: string, roleName: string) => Promise<void>;
  revokeRole: (userId: string, roleName: string) => Promise<void>;
  grantPermission: (userId: string, permissionName: string) => Promise<void>;

  // Utilities
  refreshPermissions: () => void;
  getAllPermissions: () => Promise<Permission[]>;
}

const RBACContext = createContext<RBACContextValue | undefined>(undefined);

/**
 * RBAC Provider Component
 */
export function RBACProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { tenantId } = useTenant();

  const queryClient = useQueryClient();

  // Check if in E2E test mode
  const authBypassEnabled = isAuthBypassEnabled();
  const isE2ETest =
    (typeof window !== "undefined" && (window as any).__e2e_test__) || authBypassEnabled;
  const allowTestSuperuser = isE2ETest && process.env["NODE_ENV"] !== "production";

  const initialPermissions = useMemo<UserPermissions | undefined>(() => {
    if (!user?.permissions?.length) {
      return undefined;
    }

    const toPermission = (name: string): Permission => {
      const [maybeCategory, maybeAction] = name.split(".", 2);
      const category = Object.values(PermissionCategory).includes(
        maybeCategory as PermissionCategory,
      )
        ? (maybeCategory as PermissionCategory)
        : PermissionCategory.SYSTEM;
      return {
        name,
        display_name: name,
        description: undefined,
        category,
        resource: undefined,
        action: maybeAction ?? undefined,
        is_system: false,
      };
    };

    const isSuperuserPerm =
      user.permissions.includes("*") || (user.roles || []).some((r) => r === "super_admin");

    return {
      user_id: user.id ?? "unknown",
      roles: [],
      direct_permissions: [],
      effective_permissions: user.permissions.map(toPermission),
      is_superuser: isSuperuserPerm,
    };
  }, [user]);

  // Fetch current user permissions (skip in E2E test mode)
  const {
    data: permissions,
    isLoading: loading,
    error,
    refetch: refreshPermissions,
  } = useQuery({
    queryKey: ["rbac", "my-permissions", tenantId ?? "none"],
    queryFn: allowTestSuperuser
      ? async () => ({
          user_id: "e2e-test-user",
          roles: [],
          direct_permissions: [],
          effective_permissions: [],
          is_superuser: true,
        })
      : rbacApi.fetchMyPermissions,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    enabled: !authLoading && Boolean(isAuthenticated || allowTestSuperuser),
    initialData: initialPermissions,
    initialDataUpdatedAt: () => (initialPermissions ? Date.now() : undefined),
  });

  // Fetch all roles (skip in E2E test mode)
  const { data: roles = [] } = useQuery({
    queryKey: ["rbac", "roles", tenantId ?? "none"],
    queryFn: allowTestSuperuser ? async () => [] : () => rbacApi.fetchRoles(true),
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !authLoading && Boolean(isAuthenticated || allowTestSuperuser),
  });

  // Permission check functions
  const effectivePermissions = useMemo(
    () => permissions?.effective_permissions ?? [],
    [permissions],
  );
  const assignedRoles = useMemo(() => permissions?.roles ?? [], [permissions]);
  const isSuperuser = permissions?.is_superuser ?? false;
  const userId = permissions?.user_id;

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!permissions) return false;
      if (isSuperuser) return true;

      const requested = permission.trim();

      return effectivePermissions.some((p) => {
        const name = p.name?.trim();
        if (!name) return false;
        if (name === "*" || name === requested) return true;
        if (name.endsWith(".*")) {
          const prefix = name.slice(0, -2);
          return requested === prefix || requested.startsWith(`${prefix}.`);
        }
        return false;
      });
    },
    [permissions, effectivePermissions, isSuperuser],
  );

  const hasAnyPermission = useCallback(
    (perms: string[]): boolean => {
      if (!permissions) return false;
      if (isSuperuser) return true;

      return perms.some((perm) => hasPermission(perm));
    },
    [permissions, hasPermission, isSuperuser],
  );

  const hasAllPermissions = useCallback(
    (perms: string[]): boolean => {
      if (!permissions) return false;
      if (isSuperuser) return true;

      return perms.every((perm) => hasPermission(perm));
    },
    [permissions, hasPermission, isSuperuser],
  );

  const hasRole = useCallback(
    (role: string): boolean => {
      if (!permissions) return false;
      if (isSuperuser) return true;

      return assignedRoles.some((r) => r.name === role);
    },
    [permissions, assignedRoles, isSuperuser],
  );

  const canAccess = useCallback(
    (category: string, action?: string): boolean => {
      if (!permissions) return false;
      if (isSuperuser) return true;

      const permissionName = action ? `${category}.${action}` : `${category}.*`;

      return effectivePermissions.some((p) => {
        // Exact match
        if (p.name === permissionName) return true;

        // Wildcard match (e.g., users.* matches users.read)
        if (p.name === `${category}.*`) return true;

        // System wildcard
        if (p.name === "*") return true;

        // Category and action match (convert enum to string for comparison)
        if (String(p.category) === category && (!action || String(p.action) === action))
          return true;

        return false;
      });
    },
    [permissions, isSuperuser, effectivePermissions],
  );

  // Role management mutations
  const createRoleMutation = useMutation({
    mutationFn: rbacApi.createRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rbac", "roles"] });
      toast({ title: "Success", description: "Role created successfully" });
    },
    onError: (error) => {
      handleError(error, "Failed to create role", true);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ name, data }: { name: string; data: RoleUpdateRequest }) =>
      rbacApi.updateRole(name, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rbac", "roles"] });
      toast({ title: "Success", description: "Role updated successfully" });
    },
    onError: (error) => {
      handleError(error, "Failed to update role", true);
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: rbacApi.deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rbac", "roles"] });
      toast({ title: "Success", description: "Role deleted successfully" });
    },
    onError: (error) => {
      handleError(error, "Failed to delete role", true);
    },
  });

  // User role/permission mutations
  const assignRoleMutation = useMutation({
    mutationFn: rbacApi.assignRoleToUser,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["rbac", "users", variables.user_id],
      });
      toast({ title: "Success", description: "Role assigned successfully" });
    },
    onError: (error) => {
      handleError(error, "Failed to assign role", true);
    },
  });

  const revokeRoleMutation = useMutation({
    mutationFn: rbacApi.revokeRoleFromUser,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["rbac", "users", variables.user_id],
      });
      toast({ title: "Success", description: "Role revoked successfully" });
    },
    onError: (error) => {
      handleError(error, "Failed to revoke role", true);
    },
  });

  const grantPermissionMutation = useMutation({
    mutationFn: rbacApi.grantPermissionToUser,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["rbac", "users", variables.user_id],
      });
      toast({
        title: "Success",
        description: "Permission granted successfully",
      });
    },
    onError: (error) => {
      handleError(error, "Failed to grant permission", true);
    },
  });

  // Context value
  const contextValue: RBACContextValue = {
    permissions: permissions || null,
    loading,
    error: error as Error | null,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    canAccess,
    roles,
    createRole: async (data) => {
      await createRoleMutation.mutateAsync(data);
    },
    updateRole: async (name, data) => {
      await updateRoleMutation.mutateAsync({ name, data });
    },
    deleteRole: async (name) => {
      await deleteRoleMutation.mutateAsync(name);
    },
    assignRole: async (userId, roleName) => {
      await assignRoleMutation.mutateAsync({
        user_id: userId,
        role_name: roleName,
        granted_by: undefined,
        expires_at: undefined,
      });
    },
    revokeRole: async (userId, roleName) => {
      await revokeRoleMutation.mutateAsync({
        user_id: userId,
        role_name: roleName,
        granted_by: undefined,
        expires_at: undefined,
      });
    },
    grantPermission: async (userId, permissionName) => {
      await grantPermissionMutation.mutateAsync({
        user_id: userId,
        permission_name: permissionName,
        granted_by: undefined,
        expires_at: undefined,
      });
    },
    refreshPermissions: () => refreshPermissions(),
    getAllPermissions: () => rbacApi.fetchPermissions(),
  };

  // Log permission changes in development
  useEffect(() => {
    if (permissions && process.env["NODE_ENV"] === "development") {
      logger.info("User permissions loaded", {
        userId: permissions.user_id,
        roles: permissions.roles.map((r) => r.name),
        permissionCount: permissions.effective_permissions.length,
        isSuperuser: permissions.is_superuser,
      });
    }
  }, [permissions]);

  useEffect(() => {
    if (!loading && error && !allowTestSuperuser) {
      toast({
        title: "Permissions unavailable",
        description: "We could not load your access permissions. Some features may be hidden.",
        variant: "destructive",
      });
    }
  }, [loading, error, allowTestSuperuser, toast]);

  useEffect(() => {
    if (!authLoading) {
      refreshPermissions();
      queryClient.invalidateQueries({ queryKey: ["rbac", "roles"] });
    }
  }, [authLoading, userId, refreshPermissions, queryClient]);

  return <RBACContext.Provider value={contextValue}>{children}</RBACContext.Provider>;
}

/**
 * Hook to use RBAC context
 */
export function useRBAC() {
  const context = useContext(RBACContext);
  if (!context) {
    throw new Error("useRBAC must be used within RBACProvider");
  }
  return context;
}

/**
 * Hook for permission checks
 */
export function usePermission(permission: string | string[]): boolean {
  const { hasPermission, hasAnyPermission } = useRBAC();

  if (Array.isArray(permission)) {
    return hasAnyPermission(permission);
  }

  return hasPermission(permission);
}

/**
 * Hook for role checks
 */
export function useRole(role: string): boolean {
  const { hasRole } = useRBAC();
  return hasRole(role);
}

/**
 * Hook for category access
 */
export function useCategoryAccess(category: string, action?: string): boolean {
  const { canAccess } = useRBAC();
  return canAccess(category, action);
}
