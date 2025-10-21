import * as React from "react";
import { AuthContext } from "../AuthProvider";
import type {
  AuthConfig,
  AuthContextValue,
  LoginCredentials,
  User,
  Permission,
  UserRole,
  PortalType,
} from "../types";

interface EnterpriseAuthProviderProps {
  children: React.ReactNode;
  portal: PortalType;
  config: AuthConfig;
}

interface EnterpriseAuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string;
  loginAttempts: number;
  lockedUntil: number | null;
  deviceTrusted: boolean;
}

export const EnterpriseAuthProvider: React.FC<EnterpriseAuthProviderProps> = ({
  children,
  portal,
  config,
}) => {
  const [state, setState] = React.useState<EnterpriseAuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    isRefreshing: false,
    error: "",
    loginAttempts: 0,
    lockedUntil: null,
    deviceTrusted: false,
  });

  const sessionTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const activityTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Initialize enterprise security features
  React.useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem(`enterprise_auth_${portal}_token`);
        const storedUser = localStorage.getItem(`enterprise_auth_${portal}_user`);

        if (storedToken && storedUser) {
          const isValid = await validateSession(storedToken);
          if (isValid) {
            const user = JSON.parse(storedUser);
            setState((prev) => ({
              ...prev,
              user,
              isAuthenticated: true,
              deviceTrusted:
                localStorage.getItem(`enterprise_auth_${portal}_device_trusted`) === "true",
            }));
            setupSecurityMonitoring();
          } else {
            await clearAuthData();
          }
        }
      } catch (error) {
        console.error("Enterprise auth initialization failed:", error);
        await clearAuthData();
      } finally {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    initializeAuth();

    // Setup activity monitoring
    const handleActivity = () => {
      if (state.isAuthenticated) {
        resetActivityTimeout();
      }
    };

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity, true);
      });

      if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current);
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
    };
  }, [portal, config, state.isAuthenticated]);

  // Security monitoring setup
  const setupSecurityMonitoring = () => {
    // Session timeout
    if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current);
    sessionTimeoutRef.current = setTimeout(() => {
      logout();
    }, config.sessionTimeout);

    // Activity timeout (shorter than session timeout)
    resetActivityTimeout();
  };

  const resetActivityTimeout = () => {
    if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);

    const activityTimeout = config.sessionTimeout * 0.8; // 80% of session timeout
    activityTimeoutRef.current = setTimeout(() => {
      // Could show warning modal here
      console.warn("User inactive - session will expire soon");
    }, activityTimeout);
  };

  // Enhanced session validation
  const validateSession = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/auth/validate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          portal,
          deviceFingerprint: generateDeviceFingerprint(),
        }),
      });

      return response.ok;
    } catch (error) {
      console.error("Session validation failed:", error);
      return false;
    }
  };

  // Generate device fingerprint for security
  const generateDeviceFingerprint = () => {
    return {
      userAgent: navigator.userAgent,
      screen: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
    };
  };

  // Clear all auth data
  const clearAuthData = async () => {
    localStorage.removeItem(`enterprise_auth_${portal}_token`);
    localStorage.removeItem(`enterprise_auth_${portal}_user`);
    localStorage.removeItem(`enterprise_auth_${portal}_device_trusted`);

    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isRefreshing: false,
      error: "",
      loginAttempts: 0,
      lockedUntil: null,
      deviceTrusted: false,
    });
  };

  // Enhanced login with enterprise features
  const login = async (credentials: LoginCredentials): Promise<void> => {
    // Check account lockout
    if (state.lockedUntil && Date.now() < state.lockedUntil) {
      const remainingTime = Math.ceil((state.lockedUntil - Date.now()) / 1000);
      throw new Error(`Account is locked. Try again in ${remainingTime} seconds.`);
    }

    setState((prev) => ({ ...prev, isLoading: true, error: "" }));

    try {
      const loginPayload = {
        ...credentials,
        portal,
        deviceFingerprint: generateDeviceFingerprint(),
        requireMFA: config.enableMFA,
      };

      const response = await fetch(config.endpoints.login, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Portal-Type": portal,
        },
        body: JSON.stringify(loginPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Enhanced attempt tracking
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
      await handleSuccessfulLogin(data);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      }));
      throw error;
    }
  };

  // Handle successful login response
  const handleSuccessfulLogin = async (data: any) => {
    const user: User = {
      ...data.user,
      role: data.user.role as UserRole,
      permissions: data.user.permissions as Permission[],
      lastLoginAt: new Date(),
      createdAt: new Date(data.user.createdAt),
      updatedAt: new Date(data.user.updatedAt),
    };

    // Store auth data
    localStorage.setItem(`enterprise_auth_${portal}_token`, data.access_token);
    localStorage.setItem(`enterprise_auth_${portal}_user`, JSON.stringify(user));
    localStorage.setItem(
      `enterprise_auth_${portal}_device_trusted`,
      data.deviceTrusted?.toString() || "false",
    );

    setState({
      user,
      isAuthenticated: true,
      isLoading: false,
      isRefreshing: false,
      loginAttempts: 0,
      lockedUntil: null,
      deviceTrusted: data.deviceTrusted || false,
      error: "",
    });

    setupSecurityMonitoring();
  };

  // Enhanced logout with audit trail
  const logout = async (): Promise<void> => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const token = localStorage.getItem(`enterprise_auth_${portal}_token`);

      if (token) {
        await fetch(config.endpoints.logout, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deviceFingerprint: generateDeviceFingerprint(),
            portal,
          }),
        }).catch(() => {
          // Ignore logout API errors
        });
      }
    } finally {
      // Clear all auth data
      await clearAuthData();

      if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current);
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
    }
  };

  // Enhanced token refresh
  const refreshToken = async (): Promise<void> => {
    const token = localStorage.getItem(`enterprise_auth_${portal}_token`);
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
        body: JSON.stringify({
          refreshToken: token,
          deviceFingerprint: generateDeviceFingerprint(),
          portal,
        }),
      });

      if (!response.ok) {
        await logout();
        return;
      }

      const data = await response.json();
      localStorage.setItem(`enterprise_auth_${portal}_token`, data.access_token);

      setState((prev) => ({ ...prev, isRefreshing: false }));

      // Reset security monitoring
      setupSecurityMonitoring();
    } catch (error) {
      console.error("Token refresh failed:", error);
      await logout();
    }
  };

  const updateProfile = async (updates: Partial<User>): Promise<void> => {
    if (!state.user) return;

    const token = localStorage.getItem(`enterprise_auth_${portal}_token`);
    if (!token) return;

    try {
      const response = await fetch(config.endpoints.profile, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...updates,
          deviceFingerprint: generateDeviceFingerprint(),
        }),
      });

      if (response.ok) {
        const updatedUser = {
          ...state.user,
          ...updates,
          updatedAt: new Date(),
        };
        localStorage.setItem(`enterprise_auth_${portal}_user`, JSON.stringify(updatedUser));
        setState((prev) => ({ ...prev, user: updatedUser }));
        setupSecurityMonitoring(); // Reset timeouts
      }
    } catch (error) {
      console.error("Profile update failed:", error);
      throw error;
    }
  };

  // Authorization helpers with audit
  const hasPermission = React.useCallback(
    (permission: Permission | Permission[]): boolean => {
      const result =
        !state.user ||
        !config.enablePermissions ||
        (Array.isArray(permission) ? permission : [permission]).some((p) =>
          state.user!.permissions.includes(p),
        );

      if (!result && config.enableAuditLog) {
        console.warn("Permission denied:", permission);
      }

      return result;
    },
    [state.user, config.enablePermissions, config.enableAuditLog],
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

  // Enhanced session management
  const extendSession = async (): Promise<void> => {
    if (state.isAuthenticated) {
      setupSecurityMonitoring();

      // Refresh token if needed
      const token = localStorage.getItem(`enterprise_auth_${portal}_token`);
      if (token && shouldRefreshToken()) {
        await refreshToken();
      }
    }
  };

  const getSessionTimeRemaining = (): number => {
    if (!state.isAuthenticated) return 0;
    return config.sessionTimeout; // Simplified
  };

  const shouldRefreshToken = (): boolean => {
    // Simplified - in real implementation would check JWT expiry
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

    // MFA methods (simplified stubs)
    setupMFA: async () => ({ qrCode: "", secret: "" }),
    verifyMFA: async () => false,
    disableMFA: async () => {},
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};
