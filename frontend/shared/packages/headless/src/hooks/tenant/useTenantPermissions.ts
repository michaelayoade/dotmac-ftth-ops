/**
 * Tenant Permissions Management Hook
 * Handles permission checking and feature access
 */

import { useMemo, useCallback } from "react";
import { TenantPermissions, TenantSession } from "../../types/tenant";

export interface UseTenantPermissionsReturn {
  hasPermission: (permission: keyof TenantPermissions) => boolean;
  hasAnyPermission: (permissions: (keyof TenantPermissions)[]) => boolean;
  hasAllPermissions: (permissions: (keyof TenantPermissions)[]) => boolean;
  hasFeature: (feature: string) => boolean;
  hasModule: (module: string) => boolean;
  getEffectivePermissions: () => TenantPermissions | null;
}

export function useTenantPermissions(session: TenantSession | null): UseTenantPermissionsReturn {
  const effectivePermissions = useMemo(() => {
    if (!session?.tenant?.permissions) return null;
    return session.tenant.permissions;
  }, [session?.tenant?.permissions]);

  const hasPermission = useCallback(
    (permission: keyof TenantPermissions): boolean => {
      if (!effectivePermissions) return false;
      return Boolean(effectivePermissions[permission]);
    },
    [effectivePermissions],
  );

  const hasAnyPermission = useCallback(
    (permissions: (keyof TenantPermissions)[]): boolean => {
      if (!effectivePermissions) return false;
      return permissions.some((permission) => effectivePermissions[permission]);
    },
    [effectivePermissions],
  );

  const hasAllPermissions = useCallback(
    (permissions: (keyof TenantPermissions)[]): boolean => {
      if (!effectivePermissions) return false;
      return permissions.every((permission) => effectivePermissions[permission]);
    },
    [effectivePermissions],
  );

  const hasFeature = useCallback(
    (feature: string): boolean => {
      if (!session?.tenant?.subscription?.features) return false;
      return session.tenant.subscription.features.includes(feature);
    },
    [session?.tenant?.subscription?.features],
  );

  const hasModule = useCallback(
    (module: string): boolean => {
      if (!session?.tenant?.subscription?.modules) return false;
      return session.tenant.subscription.modules.includes(module);
    },
    [session?.tenant?.subscription?.modules],
  );

  const getEffectivePermissions = useCallback((): TenantPermissions | null => {
    return effectivePermissions;
  }, [effectivePermissions]);

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasFeature,
    hasModule,
    getEffectivePermissions,
  };
}
