/**
 * Unified Authentication Hook
 * Consolidates all auth functionality from individual portals
 */

import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import type { AuthStore, LoginCredentials, User, PortalConfig, AuthProviderConfig } from "./types";
import { createAuthStore } from "./store";

// Global store instances by portal
const authStores = new Map<string, ReturnType<typeof createAuthStore>>();

export interface UseAuthOptions extends Partial<AuthProviderConfig> {
  portal: PortalConfig;
}

export interface UseAuthResult {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: any;
  permissions: string[];
  role: string | null;
  tenantId: string | null;
  sessionValid: boolean;
  mfaRequired: boolean;
  requiresPasswordChange: boolean;

  // Actions
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  validateSession: () => Promise<boolean>;
  updateUser: (updates: Partial<User>) => void;
  updatePassword: (current: string, newPassword: string) => Promise<boolean>;
  setupMfa: (secret: string, code: string) => Promise<boolean>;
  clearError: () => void;

  // Permission helpers
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;

  // Session helpers
  isSessionExpired: () => boolean;
  getTimeUntilExpiry: () => number;
  updateActivity: () => void;
}

export function useAuth(options: UseAuthOptions): UseAuthResult {
  const {
    portal,
    autoRefresh = true,
    refreshThreshold = 5 * 60 * 1000,
    sessionTimeout = 30 * 60 * 1000,
    redirectOnLogout = "/login",
    secureStorage = true,
    rateLimiting = true,
  } = options;

  const queryClient = useQueryClient();

  // Get or create auth store for this portal
  const authStore = useMemo(() => {
    const storeKey = `${portal.type}_${portal.id}`;

    if (!authStores.has(storeKey)) {
      const config: AuthProviderConfig = {
        portal,
        autoRefresh,
        refreshThreshold,
        sessionTimeout,
        redirectOnLogout,
        secureStorage,
        rateLimiting,
      };
      authStores.set(storeKey, useAuth(config));
    }

    return authStores.get(storeKey)!;
  }, [
    portal.type,
    portal.id,
    autoRefresh,
    refreshThreshold,
    sessionTimeout,
    redirectOnLogout,
    secureStorage,
    rateLimiting,
  ]);

  // Subscribe to auth store
  const authState = authStore((state) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    sessionValid: state.sessionValid,
    mfaRequired: state.mfaRequired,
    requiresPasswordChange: state.requiresPasswordChange,
  }));

  const authActions = authStore((state) => ({
    login: state.login,
    logout: state.logout,
    refreshToken: state.refreshToken,
    validateSession: state.validateSession,
    updateUser: state.updateUser,
    updatePassword: state.updatePassword,
    setupMfa: state.setupMfa,
    clearError: state.clearError,
    updateActivity: state.updateActivity,
  }));

  // Validate session on mount and periodically
  const { data: sessionData } = useQuery({
    queryKey: ["auth", "session", portal.type, portal.id],
    queryFn: authActions.validateSession,
    enabled: authState.isAuthenticated,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: authActions.login,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: authActions.logout,
    onSuccess: () => {
      queryClient.clear();
    },
  });

  // Setup activity tracking
  useEffect(() => {
    if (!authState.isAuthenticated) return;

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"];
    const activityHandler = () => authActions.updateActivity();

    events.forEach((event) => {
      document.addEventListener(event, activityHandler, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, activityHandler);
      });
    };
  }, [authState.isAuthenticated, authActions.updateActivity]);

  // Permission helpers
  const hasPermission = useCallback(
    (permission: string): boolean => {
      return authState.user?.permissions?.includes(permission) ?? false;
    },
    [authState.user?.permissions],
  );

  const hasRole = useCallback(
    (role: string): boolean => {
      return authState.user?.role === role;
    },
    [authState.user?.role],
  );

  const hasAnyRole = useCallback(
    (roles: string[]): boolean => {
      return authState.user?.role ? roles.includes(authState.user.role) : false;
    },
    [authState.user?.role],
  );

  const hasAnyPermission = useCallback(
    (permissions: string[]): boolean => {
      if (!authState.user?.permissions) return false;
      return permissions.some((permission) => authState.user!.permissions.includes(permission));
    },
    [authState.user?.permissions],
  );

  const hasAllPermissions = useCallback(
    (permissions: string[]): boolean => {
      if (!authState.user?.permissions) return false;
      return permissions.every((permission) => authState.user!.permissions.includes(permission));
    },
    [authState.user?.permissions],
  );

  // Session helpers
  const isSessionExpired = useCallback((): boolean => {
    const lastActivity = authStore.getState().lastActivity;
    if (!lastActivity) return true;
    return Date.now() - lastActivity > sessionTimeout;
  }, [sessionTimeout]);

  const getTimeUntilExpiry = useCallback((): number => {
    const lastActivity = authStore.getState().lastActivity;
    if (!lastActivity) return 0;
    return Math.max(0, sessionTimeout - (Date.now() - lastActivity));
  }, [sessionTimeout]);

  return {
    // State
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading || loginMutation.isPending || logoutMutation.isPending,
    error: authState.error,
    permissions: authState.user?.permissions || [],
    role: authState.user?.role || null,
    tenantId: authState.user?.tenantId || null,
    sessionValid: authState.sessionValid,
    mfaRequired: authState.mfaRequired,
    requiresPasswordChange: authState.requiresPasswordChange,

    // Actions
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    refreshToken: authActions.refreshToken,
    validateSession: authActions.validateSession,
    updateUser: authActions.updateUser,
    updatePassword: authActions.updatePassword,
    setupMfa: authActions.setupMfa,
    clearError: authActions.clearError,

    // Permission helpers
    hasPermission,
    hasRole,
    hasAnyRole,
    hasAnyPermission,
    hasAllPermissions,

    // Session helpers
    isSessionExpired,
    getTimeUntilExpiry,
    updateActivity: authActions.updateActivity,
  };
}
