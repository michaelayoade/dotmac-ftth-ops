/**
 * Tenant Permissions Management Hook
 * Handles permission checking and feature access
 */

import { useMemo, useCallback } from "react";
import type { TenantPermissions, TenantSession } from "../../types/tenant";

export interface UseTenantPermissionsReturn {
  hasPermission: (permission: keyof TenantPermissions) => boolean;
  hasAnyPermission: (permissions: (keyof TenantPermissions)[]) => boolean;
  hasAllPermissions: (permissions: (keyof TenantPermissions)[]) => boolean;
  hasFeature: (feature: string) => boolean;
  hasModule: (module: string) => boolean;
  getEffectivePermissions: () => TenantPermissions | null;
}

export function useTenantPermissions(session: TenantSession | null): UseTenantPermissionsReturn {
  const permissionsList = useMemo(() => session?.permissions ?? [], [session?.permissions]);

  const hasPermission = useCallback(
    (permission: keyof TenantPermissions): boolean => {
      return permissionsList.includes(permission as string);
    },
    [permissionsList],
  );

  const hasAnyPermission = useCallback(
    (permissions: (keyof TenantPermissions)[]): boolean => {
      return permissions.some((permission) => permissionsList.includes(permission as string));
    },
    [permissionsList],
  );

  const hasAllPermissions = useCallback(
    (permissions: (keyof TenantPermissions)[]): boolean => {
      return permissions.every((permission) => permissionsList.includes(permission as string));
    },
    [permissionsList],
  );

  const hasFeature = useCallback(
    (feature: string): boolean => {
      const featureMap = session?.tenant?.features as Record<string, boolean> | undefined;
      return Boolean(featureMap?.[feature]);
    },
    [session?.tenant?.features],
  );

  const hasModule = useCallback(
    (module: string): boolean => {
      const featureMap = session?.tenant?.features as Record<string, boolean> | undefined;
      return Boolean(featureMap?.[module]);
    },
    [session?.tenant?.features],
  );

  const getEffectivePermissions = useCallback((): TenantPermissions | null => {
    return null;
  }, []);

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasFeature,
    hasModule,
    getEffectivePermissions,
  };
}
