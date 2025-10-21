/**
 * Universal authentication hook that combines portal-aware and standard authentication
 * Provides a unified interface for all portal types while maintaining backwards compatibility
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { getApiClient } from "@dotmac/headless/api";
import { useAuthRateLimit } from "../middleware/rateLimiting";
import { useAuthStore, useTenantStore } from "../stores";
import type { LoginCredentials, LoginFlow, PortalConfig, User } from "../types";
import { csrfProtection } from "../utils/csrfProtection";
import { tokenManager } from "../utils/tokenManager";

export interface UniversalAuthOptions {
  redirectOnLogout?: string;
  autoRefresh?: boolean;
  refreshThreshold?: number;
  autoDetectPortal?: boolean;
}

export interface UniversalAuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  permissions: string[];
  role: string | null;
  tenantId: string | null;
  currentPortal: PortalConfig | null;
  loginFlow: LoginFlow;
  isDetectingPortal: boolean;
}

export interface UniversalAuthResult extends UniversalAuthState {
  // Authentication actions
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;

  // Permission helpers
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  isRole: (role: string) => boolean;

  // User management
  updateUser: (updates: Partial<User>) => void;

  // Portal management
  detectPortal: () => Promise<PortalConfig | null>;
  getRequiredFields: () => string[];
  getLoginMethods: () => string[];
  isMfaRequired: () => boolean;
  getPortalBranding: () => any;

  // Legacy compatibility
  loginWithPortal: (credentials: LoginCredentials) => Promise<boolean>;
}

export function useUniversalAuth(options: UniversalAuthOptions = {}): UniversalAuthResult {
  const {
    redirectOnLogout = "/login",
    autoRefresh = true,
    refreshThreshold = 5,
    autoDetectPortal = true,
  } = options;

  const rateLimit = useAuthRateLimit();
  const queryClient = useQueryClient();
  const apiClient = getApiClient();

  const {
    user,
    isAuthenticated,
    setAuth,
    clearAuth,
    updateUser,
    getValidToken,
    refreshTokens,
    isSessionValid,
  } = useAuthStore();

  const { setCurrentTenant } = useTenantStore();

  // Portal state
  const [currentPortal, setCurrentPortal] = useState<PortalConfig | null>(null);
  const [loginFlow, setLoginFlow] = useState<LoginFlow>({
    step: "portal_detection",
    availableLoginMethods: [],
    requiredFields: [],
    mfaRequired: false,
  });
  const [isDetectingPortal, setIsDetectingPortal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Portal detection helpers
  const getPortalTypeFromURL = useCallback((): string => {
    const { hostname, port } = window.location;

    // Development port detection
    const devPortMap: Record<string, string> = {
      "3000": "admin",
      "3001": "management",
      "3002": "customer",
      "3003": "reseller",
      "3004": "technician",
    };

    if (devPortMap[port]) {
      return devPortMap[port];
    }

    // Production subdomain detection
    const subdomain = hostname.split(".")[0];
    const subdomainMap: Record<string, string> = {
      admin: "admin",
      manage: "management",
      management: "management",
      my: "customer",
      customer: "customer",
      partner: "reseller",
      reseller: "reseller",
      tech: "technician",
      technician: "technician",
    };

    return subdomainMap[subdomain] || "customer";
  }, []);

  const fetchPortalConfig = useCallback(
    async (portalType: string): Promise<PortalConfig | null> => {
      try {
        const response = await apiClient.request(`/api/v1/portals/${portalType}/config`, {
          method: "GET",
        });
        return response.data;
      } catch (_error) {
        // Return a default config if portal config is not available
        return {
          id: `default-${portalType}`,
          name: `${portalType.charAt(0).toUpperCase() + portalType.slice(1)} Portal`,
          type: portalType as any,
          tenantId: "default",
          loginMethods: ["email"],
          features: {
            mfaRequired: false,
            allowPortalIdLogin: false,
            allowAccountNumberLogin: false,
            ssoEnabled: false,
          },
          branding: {
            logo: "",
            companyName: `${portalType.charAt(0).toUpperCase() + portalType.slice(1)} Portal`,
            primaryColor: "#3B82F6",
            secondaryColor: "#1E40AF",
          },
        };
      }
    },
    [apiClient],
  );

  // Get required fields based on portal configuration
  const getRequiredFields = useCallback((portal: PortalConfig): string[] => {
    const fields = ["password"];

    if (portal.loginMethods.includes("email")) {
      fields.push("email");
    }
    if (portal.features.allowPortalIdLogin) {
      // Portal ID is optional for customer portal
    }
    if (portal.features.allowAccountNumberLogin) {
      // Account number is optional for customer portal
    }
    if (portal.loginMethods.includes("partner_code")) {
      fields.push("partnerCode");
    }
    if (portal.features.mfaRequired) {
      fields.push("mfaCode");
    }

    return fields;
  }, []);

  // Detect portal from URL/subdomain
  const detectPortal = useCallback(async (): Promise<PortalConfig | null> => {
    if (!autoDetectPortal) return null;

    setIsDetectingPortal(true);

    try {
      const portalType = getPortalTypeFromURL();
      const portal = await fetchPortalConfig(portalType);

      if (portal) {
        setCurrentPortal(portal);
        setLoginFlow({
          step: "credential_entry",
          portalType: portal.type,
          availableLoginMethods: portal.loginMethods,
          requiredFields: getRequiredFields(portal),
          mfaRequired: portal.features.mfaRequired,
          tenantId: portal.tenantId,
        });
        return portal;
      }

      return null;
    } catch (_error) {
      return null;
    } finally {
      setIsDetectingPortal(false);
    }
  }, [autoDetectPortal, getPortalTypeFromURL, fetchPortalConfig, getRequiredFields]);

  // Query current user data
  const { data: userData, isLoading: isUserLoading } = useQuery({
    queryKey: ["auth", "user"],
    queryFn: async () => {
      const validToken = await getValidToken();
      if (!validToken) {
        throw new Error("No valid authentication token");
      }

      const response = await apiClient.getCurrentUser();
      return response.data;
    },
    enabled: isAuthenticated && isSessionValid(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      if (error instanceof Error && error.message.includes("Unauthorized")) {
        return false;
      }
      return failureCount < 2;
    },
  });

  // Login mutation with portal awareness
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      // Check rate limiting before attempting login
      const rateLimitCheck = rateLimit.checkLimit("login");
      if (!rateLimitCheck.allowed) {
        const error = new Error(
          `Too many login attempts. Please try again in ${rateLimitCheck.retryAfter} seconds.`,
        );
        (error as any).code = "RATE_LIMITED";
        (error as any).retryAfter = rateLimitCheck.retryAfter;
        throw error;
      }

      // Initialize CSRF protection before login
      await csrfProtection.initialize();

      // Build login payload with portal awareness
      const loginPayload = {
        username: credentials.username ?? credentials.email?.split("@")[0],
        email: credentials.email,
        password: credentials.password,
        portal: currentPortal?.type || getPortalTypeFromURL(),
        portalId: currentPortal?.id,
        tenantId: currentPortal?.tenantId,
        ...credentials,
      };

      const response = await apiClient.login(loginPayload);
      return response.data;
    },
    onSuccess: async (data) => {
      // Record successful login attempt
      rateLimit.recordAttempt("login", true);

      const tokenPair = {
        accessToken: data.token,
        refreshToken: data.refreshToken,
        expiresAt: Date.now() + (data.expiresIn || 15 * 60) * 1000,
      };

      await setAuth(data.user, tokenPair, data.sessionId, data.csrfToken);

      // Set tenant context based on login response
      if (data.user.tenant) {
        setCurrentTenant(data.user.tenant, data.user);
      }

      setLoginFlow((prev) => ({ ...prev, step: "complete" }));
    },
    onError: async (error: any) => {
      // Record failed login attempt (unless rate limited)
      if (error.code !== "RATE_LIMITED") {
        rateLimit.recordAttempt("login", false);
      }

      await clearAuth();
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      try {
        await apiClient.logout();
      } catch (_error) {
        // Continue with logout even if API call fails
      }
    },
    onSettled: async () => {
      await clearAuth();
      queryClient.clear();

      // Clear portal state
      setCurrentPortal(null);
      setLoginFlow({
        step: "portal_detection",
        availableLoginMethods: [],
        requiredFields: [],
        mfaRequired: false,
      });

      // Clear all client-side data
      localStorage.clear();
      sessionStorage.clear();

      // Redirect to login page
      if (typeof window !== "undefined" && redirectOnLogout) {
        window.location.href = redirectOnLogout;
      }
    },
  });

  // Token refresh mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const success = await refreshTokens(apiClient.refreshToken.bind(apiClient));
      if (!success) {
        throw new Error("Token refresh failed");
      }
      return success;
    },
    onError: async (_error) => {
      await clearAuth();

      if (typeof window !== "undefined" && redirectOnLogout) {
        window.location.href = redirectOnLogout;
      }
    },
  });

  // Auto-refresh setup using token manager
  useEffect(() => {
    if (!autoRefresh || !isAuthenticated) {
      return;
    }

    return tokenManager.setupAutoRefresh(apiClient.refreshToken.bind(apiClient), async () => {
      await clearAuth();

      if (typeof window !== "undefined" && redirectOnLogout) {
        window.location.href = redirectOnLogout;
      }
    });
  }, [autoRefresh, isAuthenticated, apiClient, clearAuth, redirectOnLogout]);

  // Initialize portal detection on mount
  useEffect(() => {
    if (autoDetectPortal) {
      detectPortal();
    }
  }, [detectPortal, autoDetectPortal]);

  // Apply portal branding
  useEffect(() => {
    if (currentPortal) {
      const root = document.documentElement;
      root.style.setProperty("--portal-primary", currentPortal.branding.primaryColor);
      root.style.setProperty("--portal-secondary", currentPortal.branding.secondaryColor);

      document.title = currentPortal.name;

      if (currentPortal.branding.favicon) {
        const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
        if (favicon) {
          favicon.href = currentPortal.branding.favicon;
        }
      }
    }
  }, [currentPortal]);

  // Update user data when fetched
  useEffect(() => {
    if (userData && userData.id !== user?.id) {
      updateUser(userData);
    }
  }, [userData, user?.id, updateUser]);

  // Helper functions
  const hasPermission = useCallback(
    (permission: string): boolean => {
      return user?.permissions?.includes(permission) ?? false;
    },
    [user?.permissions],
  );

  const hasRole = useCallback(
    (role: string): boolean => {
      return user?.role === role;
    },
    [user?.role],
  );

  const hasAnyRole = useCallback(
    (roles: string[]): boolean => {
      return user?.role ? roles.includes(user.role) : false;
    },
    [user?.role],
  );

  const isRole = useCallback(
    (role: string): boolean => {
      return user?.role === role;
    },
    [user?.role],
  );

  const login = useCallback(
    async (credentials: LoginCredentials): Promise<boolean> => {
      setIsLoading(true);
      try {
        await loginMutation.mutateAsync(credentials);
        return true;
      } catch (error) {
        console.error("Login failed:", error);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [loginMutation],
  );

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await logoutMutation.mutateAsync();
    } finally {
      setIsLoading(false);
    }
  }, [logoutMutation]);

  const refreshToken = useCallback(async (): Promise<void> => {
    await refreshMutation.mutateAsync();
  }, [refreshMutation]);

  // Portal utility functions
  const getRequiredFieldsForCurrentPortal = useCallback((): string[] => {
    return currentPortal ? getRequiredFields(currentPortal) : [];
  }, [currentPortal, getRequiredFields]);

  const getLoginMethods = useCallback((): string[] => {
    return currentPortal?.loginMethods || [];
  }, [currentPortal]);

  const isMfaRequired = useCallback((): boolean => {
    return currentPortal?.features.mfaRequired || false;
  }, [currentPortal]);

  const getPortalBranding = useCallback(() => {
    return currentPortal?.branding;
  }, [currentPortal]);

  return {
    // State
    user: userData || user,
    isAuthenticated,
    isLoading:
      isLoading ||
      isUserLoading ||
      loginMutation.isPending ||
      logoutMutation.isPending ||
      isDetectingPortal,
    permissions: user?.permissions || [],
    role: user?.role || null,
    tenantId: user?.tenantId || null,
    currentPortal,
    loginFlow,
    isDetectingPortal,

    // Authentication actions
    login,
    logout,
    refreshToken,

    // Permission helpers
    hasPermission,
    hasRole,
    hasAnyRole,
    isRole,

    // User management
    updateUser,

    // Portal management
    detectPortal,
    getRequiredFields: getRequiredFieldsForCurrentPortal,
    getLoginMethods,
    isMfaRequired,
    getPortalBranding,

    // Legacy compatibility
    loginWithPortal: login, // Alias for backward compatibility
  };
}
