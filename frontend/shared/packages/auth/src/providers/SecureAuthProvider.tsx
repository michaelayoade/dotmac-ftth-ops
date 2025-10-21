import * as React from "react";
import { AuthContext } from "../AuthProvider";
import type {
  AuthConfig,
  AuthContextValue,
  LoginCredentials,
  User,
  Permission,
  UserRole,
  AuthTokens,
  PortalType,
} from "../types";

interface SecureAuthProviderProps {
  children: React.ReactNode;
  portal: PortalType;
  config: AuthConfig;
}

interface SecureAuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string;
  loginAttempts: number;
  lockedUntil: number | null;
}

export const SecureAuthProvider: React.FC<SecureAuthProviderProps> = ({
  children,
  portal,
  config,
}) => {
  const [state, setState] = React.useState<SecureAuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    isRefreshing: false,
    error: "",
    loginAttempts: 0,
    lockedUntil: null,
  });

  const sessionTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Initialize auth state from secure storage
  React.useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem(`secure_auth_${portal}_token`);
        const storedUser = localStorage.getItem(`secure_auth_${portal}_user`);

        if (storedToken && storedUser) {
          // Validate session with server
          const isValid = await validateSession(storedToken);
          if (isValid) {
            const user = JSON.parse(storedUser);
            setState((prev) => ({
              ...prev,
              user,
              isAuthenticated: true,
              isLoading: false,
            }));
            setupSessionTimeout();
          } else {
            // Clear invalid session
            localStorage.removeItem(`secure_auth_${portal}_token`);
            localStorage.removeItem(`secure_auth_${portal}_user`);
          }
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
      } finally {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    initializeAuth();

    return () => {
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
    };
  }, [portal, config]);

  // Session timeout management
  const setupSessionTimeout = React.useCallback(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }

    sessionTimeoutRef.current = setTimeout(() => {
      logout();
    }, config.sessionTimeout);
  }, [config.sessionTimeout]);

  const resetSessionTimeout = React.useCallback(() => {
    setupSessionTimeout();
  }, [setupSessionTimeout]);

  // Validate session with server
  const validateSession = React.useCallback(async (token: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/auth/validate", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      return response.ok;
    } catch (error) {
      console.error("Session validation failed:", error);
      return false;
    }
  }, []);

  // Check if account is locked
  const isAccountLocked = React.useCallback((): boolean => {
    if (!state.lockedUntil) return false;
    return Date.now() < state.lockedUntil;
  }, [state.lockedUntil]);

  const login = React.useCallback(
    async (credentials: LoginCredentials): Promise<void> => {
      // Check if account is locked
      if (isAccountLocked()) {
        const remainingTime = Math.ceil((state.lockedUntil! - Date.now()) / 1000);
        throw new Error(`Account is locked. Try again in ${remainingTime} seconds.`);
      }

      setState((prev) => ({ ...prev, isLoading: true, error: "" }));

      try {
        const response = await fetch(config.endpoints.login, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Portal-Type": portal,
          },
          body: JSON.stringify({
            ...credentials,
            portal,
            enableMFA: config.enableMFA,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();

          // Handle login attempt tracking
          setState((prev) => {
            const newAttempts = prev.loginAttempts + 1;
            const shouldLock = newAttempts >= config.maxLoginAttempts;

            return {
              ...prev,
              loginAttempts: newAttempts,
              lockedUntil: shouldLock ? Date.now() + config.lockoutDuration : null,
              isLoading: false,
              error: errorData.message || "Authentication failed",
            };
          });

          throw new Error(errorData.message || "Authentication failed");
        }

        const data = await response.json();

        // Handle MFA requirement
        if (data.requires_2fa && !data.access_token) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: "MFA verification required",
          }));
          return;
        }

        const user: User = {
          ...data.user,
          role: data.user.role as UserRole,
          permissions: data.user.permissions as Permission[],
          lastLoginAt: new Date(),
          createdAt: new Date(data.user.createdAt),
          updatedAt: new Date(data.user.updatedAt),
        };

        // Store tokens securely
        localStorage.setItem(`secure_auth_${portal}_token`, data.access_token);
        localStorage.setItem(`secure_auth_${portal}_user`, JSON.stringify(user));

        setState({
          user,
          isAuthenticated: true,
          isLoading: false,
          isRefreshing: false,
          loginAttempts: 0,
          lockedUntil: null,
          error: "",
        });

        setupSessionTimeout();
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : "Authentication failed",
        }));
        throw error;
      }
    },
    [config, portal, isAccountLocked, state.lockedUntil, setupSessionTimeout],
  );

  const logout = React.useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const token = localStorage.getItem(`secure_auth_${portal}_token`);

      if (token) {
        await fetch(config.endpoints.logout, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }).catch(() => {
          // Ignore logout API errors
        });
      }
    } finally {
      // Clear all auth data
      localStorage.removeItem(`secure_auth_${portal}_token`);
      localStorage.removeItem(`secure_auth_${portal}_user`);

      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }

      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isRefreshing: false,
        loginAttempts: 0,
        lockedUntil: null,
        error: "",
      });
    }
  }, [config.endpoints.logout, portal]);

  const refreshToken = React.useCallback(async (): Promise<void> => {
    const token = localStorage.getItem(`secure_auth_${portal}_token`);
    if (!token) {
      await logout();
      return;
    }

    setState((prev) => ({ ...prev, isRefreshing: true }));

    try {
      const response = await fetch(config.endpoints.refresh, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken: token }),
      });

      if (!response.ok) {
        await logout();
        return;
      }

      const data = await response.json();
      localStorage.setItem(`secure_auth_${portal}_token`, data.access_token);

      setState((prev) => ({ ...prev, isRefreshing: false }));
      resetSessionTimeout();
    } catch (error) {
      console.error("Token refresh failed:", error);
      await logout();
    }
  }, [config.endpoints.refresh, logout, resetSessionTimeout, portal]);

  const updateProfile = React.useCallback(
    async (updates: Partial<User>): Promise<void> => {
      if (!state.user) return;

      const token = localStorage.getItem(`secure_auth_${portal}_token`);
      if (!token) return;

      try {
        const response = await fetch(config.endpoints.profile, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        });

        if (response.ok) {
          const updatedUser = {
            ...state.user,
            ...updates,
            updatedAt: new Date(),
          };
          localStorage.setItem(`secure_auth_${portal}_user`, JSON.stringify(updatedUser));
          setState((prev) => ({ ...prev, user: updatedUser }));
          resetSessionTimeout();
        }
      } catch (error) {
        console.error("Profile update failed:", error);
        throw error;
      }
    },
    [config.endpoints.profile, state.user, resetSessionTimeout, portal],
  );

  // MFA methods (simplified)
  const setupMFA = React.useCallback(async (): Promise<{
    qrCode: string;
    secret: string;
  }> => {
    const token = localStorage.getItem(`secure_auth_${portal}_token`);
    if (!token) throw new Error("Not authenticated");

    try {
      const response = await fetch("/api/auth/mfa/setup", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("MFA setup failed");
      }

      return await response.json();
    } catch (error) {
      console.error("MFA setup failed:", error);
      throw error;
    }
  }, [portal]);

  const verifyMFA = React.useCallback(
    async (code: string): Promise<boolean> => {
      const token = localStorage.getItem(`secure_auth_${portal}_token`);
      if (!token) return false;

      try {
        const response = await fetch("/api/auth/mfa/verify", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code }),
        });

        return response.ok;
      } catch (error) {
        console.error("MFA verification failed:", error);
        return false;
      }
    },
    [portal],
  );

  const disableMFA = React.useCallback(async (): Promise<void> => {
    const token = localStorage.getItem(`secure_auth_${portal}_token`);
    if (!token) return;

    try {
      const response = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok && state.user) {
        setState((prev) => ({
          ...prev,
          user: prev.user
            ? {
                ...prev.user,
                metadata: { ...prev.user.metadata, mfaEnabled: false },
              }
            : null,
        }));
      }
    } catch (error) {
      console.error("MFA disable failed:", error);
      throw error;
    }
  }, [state.user, portal]);

  // Authorization helpers
  const hasPermission = React.useCallback(
    (permission: Permission | Permission[]): boolean => {
      if (!state.user || !config.enablePermissions) return true;

      const permissions = Array.isArray(permission) ? permission : [permission];
      return permissions.some((p) => state.user!.permissions.includes(p));
    },
    [state.user, config.enablePermissions],
  );

  const hasRole = React.useCallback(
    (role: UserRole | UserRole[]): boolean => {
      if (!state.user) return false;

      const roles = Array.isArray(role) ? role : [role];
      return roles.includes(state.user.role);
    },
    [state.user],
  );

  const isSuperAdmin = React.useCallback((): boolean => {
    return state.user?.role === "super_admin";
  }, [state.user]);

  // Session management
  const extendSession = React.useCallback(async (): Promise<void> => {
    if (state.isAuthenticated) {
      resetSessionTimeout();
      // Check if token needs refresh
      const token = localStorage.getItem(`secure_auth_${portal}_token`);
      if (token && shouldRefreshToken(token)) {
        await refreshToken();
      }
    }
  }, [state.isAuthenticated, resetSessionTimeout, refreshToken, portal]);

  const getSessionTimeRemaining = React.useCallback((): number => {
    if (!state.isAuthenticated) return 0;
    return config.sessionTimeout; // Simplified - would track actual expiry in real implementation
  }, [state.isAuthenticated, config.sessionTimeout]);

  // Helper to check if token should be refreshed
  const shouldRefreshToken = (token: string): boolean => {
    // In a real implementation, you'd decode the JWT and check expiry
    // For now, return false as a placeholder
    return false;
  };

  const contextValue: AuthContextValue = {
    // State
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    isRefreshing: state.isRefreshing,

    // Actions
    login,
    logout,
    refreshToken,
    updateProfile,

    // Authorization
    hasPermission,
    hasRole,
    isSuperAdmin,

    // Session Management
    extendSession,
    getSessionTimeRemaining,

    // MFA (conditionally available)
    ...(config.enableMFA && {
      setupMFA,
      verifyMFA,
      disableMFA,
    }),
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};
