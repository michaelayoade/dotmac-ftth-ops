/**
 * @fileoverview RBAC (Role-Based Access Control) package for DotMac platform
 * Provides React components and hooks for permission-based UI rendering.
 *
 * This implementation fetches permissions/roles from the backend RBAC endpoints:
 * - GET /api/v1/auth/rbac/my-permissions
 * - POST /api/v1/auth/rbac/check (optional for server-side checks)
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// Inline runtime config snapshot accessor (avoids external path dependency)
// The config is set by the app via window.__DOTMAC_RUNTIME_CONFIG__
type RuntimeConfigSnapshot = {
  api?: {
    restPath?: string;
  };
} | null;

const getRuntimeConfigSnapshot = (): RuntimeConfigSnapshot => {
  if (typeof window === "undefined") return null;
  return (window as any).__DOTMAC_RUNTIME_CONFIG__ ?? null;
};

// Export types
export interface Role {
  id: string;
  name: string;
  permissions: string[];
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
}

export interface User {
  id: string;
  roles: Role[];
  permissions: string[] | undefined;
}

export interface RBACState {
  permissions: string[];
  roles: string[];
  isSuperuser: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const RBACContext = createContext<RBACState | null>(null);

const hasWildcardMatch = (permission: string, candidate: string): boolean => {
  if (candidate === "*" || candidate === permission) return true;

  // Support dot or colon namespace wildcards (foo.* or foo:*)
  if (candidate.endsWith(".*") || candidate.endsWith(":*")) {
    const prefix = candidate.slice(0, -2);
    const separator = candidate.endsWith(".*") ? "." : ":";
    return permission === prefix || permission.startsWith(`${prefix}${separator}`);
  }

  // Treat "*:*" as a global wildcard as well
  if (candidate === "*:*") return true;

  return false;
};

const resolveDefaultEndpoint = () => {
  const portalType = process.env["NEXT_PUBLIC_PORTAL_TYPE"] ?? "";
  const runtimeConfig = getRuntimeConfigSnapshot();
  const restPath = runtimeConfig?.api?.restPath;
  const fallbackRestPath = portalType === "isp" ? "/api/isp/v1/admin" : "/api/platform/v1/admin";

  const safeRestPath =
    restPath && !(portalType === "isp" && restPath.startsWith("/api/platform/"))
      ? restPath
      : fallbackRestPath;

  const normalized = safeRestPath?.endsWith("/")
    ? safeRestPath.slice(0, -1)
    : safeRestPath || "";

  return `${normalized || "/api/v1"}/auth/rbac/my-permissions`;
};

export const RBACProvider = ({
  children,
  endpoint = resolveDefaultEndpoint(),
  initialPermissions,
  initialRoles,
  isSuperuser: initialIsSuperuser = false,
}: {
  children: React.ReactNode;
  endpoint?: string;
  initialPermissions?: string[];
  initialRoles?: string[];
  isSuperuser?: boolean;
}) => {
  const [permissions, setPermissions] = useState<string[]>(initialPermissions ?? []);
  const [roles, setRoles] = useState<string[]>(initialRoles ?? []);
  const [isSuperuser, setIsSuperuser] = useState<boolean>(initialIsSuperuser);
  const [loading, setLoading] = useState<boolean>(!initialPermissions);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`RBAC fetch failed: ${res.status}`);
      }
      const data = await res.json();
      setPermissions((data?.effective_permissions ?? data?.permissions ?? []) as string[]);
      setRoles((data?.roles ?? []).map((r: any) => r?.name ?? r).filter(Boolean));
      setIsSuperuser(Boolean(data?.is_superuser));
    } catch (err: any) {
      setError(err?.message ?? "Failed to load permissions");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (initialPermissions) return;
    void fetchPermissions();
  }, [fetchPermissions, initialPermissions]);

  const refresh = useCallback(() => {
    void fetchPermissions();
  }, [fetchPermissions]);

  const value = useMemo<RBACState>(
    () => ({
      permissions,
      roles,
      isSuperuser,
      loading,
      error,
      refresh,
    }),
    [permissions, roles, isSuperuser, loading, error, refresh],
  );

  return <RBACContext.Provider value={value}>{children}</RBACContext.Provider>;
};

const useRBACContext = (): RBACState => {
  const ctx = useContext(RBACContext);
  if (!ctx) {
    throw new Error("useRBAC must be used within an RBACProvider");
  }
  return ctx;
};

export const usePermissions = () => {
  const { permissions, roles, isSuperuser, loading, error, refresh } = useRBACContext();

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (isSuperuser) return true;
      return permissions.some((perm) => hasWildcardMatch(permission, perm));
    },
    [isSuperuser, permissions],
  );

  const hasAnyPermission = useCallback(
    (permList: string[]): boolean => permList.some((p) => hasPermission(p)),
    [hasPermission],
  );

  const hasAllPermissions = useCallback(
    (permList: string[]): boolean => permList.every((p) => hasPermission(p)),
    [hasPermission],
  );

  const hasRole = useCallback(
    (role: string): boolean => (isSuperuser ? true : roles.includes(role)),
    [isSuperuser, roles],
  );

  return {
    permissions,
    roles,
    isSuperuser,
    loading,
    error,
    refresh,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
  };
};

export const useRBAC = () => {
  const perms = usePermissions();

  const canAccess = useCallback(
    (resource: string, action: string): boolean => {
      const permission = `${resource}:${action}`;
      return perms.hasPermission(permission);
    },
    [perms],
  );

  return useMemo(() => ({ ...perms, canAccess }), [perms, canAccess]);
};

// Utility functions
export const checkPermission = (user: User, permission: string): boolean => {
  if (!user?.permissions) return false;
  return user.permissions.some((perm) => hasWildcardMatch(permission, perm));
};

// Default export
const RBAC = {
  RBACProvider,
  usePermissions,
  useRBAC,
  checkPermission,
};

export default RBAC;
