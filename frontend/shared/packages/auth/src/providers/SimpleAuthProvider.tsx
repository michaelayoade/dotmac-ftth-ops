import * as React from "react";
import Cookies from "js-cookie";
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

interface SimpleAuthProviderProps {
  children: React.ReactNode;
  portal: PortalType;
  config: AuthConfig;
}

interface SimpleAuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string;
}

export const SimpleAuthProvider: React.FC<SimpleAuthProviderProps> = ({
  children,
  portal,
  config,
}) => {
  const [state, setState] = React.useState<SimpleAuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    isRefreshing: false,
    error: "",
  });

  // Initialize auth state from storage
  React.useEffect(() => {
    const initializeAuth = () => {
      const storedToken = localStorage.getItem(`simple_auth_${portal}_token`);
      const storedUser = localStorage.getItem(`simple_auth_${portal}_user`);

      if (storedToken && storedUser) {
        try {
          const user = JSON.parse(storedUser);
          setState((prev) => ({
            ...prev,
            user,
            isAuthenticated: true,
            isLoading: false,
          }));
        } catch (error) {
          // Clear corrupted data
          localStorage.removeItem(`simple_auth_${portal}_token`);
          localStorage.removeItem(`simple_auth_${portal}_user`);
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      } else {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    initializeAuth();
  }, [portal]);

  const login = React.useCallback(
    async (credentials: LoginCredentials): Promise<void> => {
      setState((prev) => ({ ...prev, isLoading: true, error: "" }));

      try {
        const response = await fetch(config.endpoints.login, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...credentials,
            portal,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Authentication failed");
        }

        const data = await response.json();
        const user: User = {
          ...data.user,
          role: data.user.role as UserRole,
          permissions: data.user.permissions as Permission[],
          lastLoginAt: new Date(),
          createdAt: new Date(data.user.createdAt),
          updatedAt: new Date(data.user.updatedAt),
        };

        // Store auth data
        localStorage.setItem(`simple_auth_${portal}_token`, data.access_token);
        localStorage.setItem(`simple_auth_${portal}_user`, JSON.stringify(user));

        if (credentials.rememberMe) {
          Cookies.set(`simple_auth_${portal}_remember`, "true", {
            expires: 30,
          });
        }

        setState({
          user,
          isAuthenticated: true,
          isLoading: false,
          isRefreshing: false,
          error: "",
        });
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : "Authentication failed",
        }));
        throw error;
      }
    },
    [config.endpoints.login, portal],
  );

  const logout = React.useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const token = localStorage.getItem(`simple_auth_${portal}_token`);

      if (token) {
        await fetch(config.endpoints.logout, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }).catch(() => {
          // Ignore logout API errors, continue with cleanup
        });
      }
    } finally {
      // Clear all auth data
      localStorage.removeItem(`simple_auth_${portal}_token`);
      localStorage.removeItem(`simple_auth_${portal}_user`);
      Cookies.remove(`simple_auth_${portal}_remember`);

      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isRefreshing: false,
        error: "",
      });
    }
  }, [config.endpoints.logout, portal]);

  const refreshToken = React.useCallback(async (): Promise<void> => {
    const token = localStorage.getItem(`simple_auth_${portal}_token`);
    if (!token) return;

    setState((prev) => ({ ...prev, isRefreshing: true }));

    try {
      const response = await fetch(config.endpoints.refresh, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem(`simple_auth_${portal}_token`, data.access_token);

        if (data.user) {
          const updatedUser = {
            ...state.user,
            ...data.user,
            lastLoginAt: new Date(),
            updatedAt: new Date(data.user.updatedAt),
          } as User;

          localStorage.setItem(`simple_auth_${portal}_user`, JSON.stringify(updatedUser));
          setState((prev) => ({
            ...prev,
            user: updatedUser,
            isRefreshing: false,
          }));
        } else {
          setState((prev) => ({ ...prev, isRefreshing: false }));
        }
      } else {
        // Token refresh failed, logout user
        await logout();
      }
    } catch (error) {
      console.error("Token refresh failed:", error);
      await logout();
    }
  }, [config.endpoints.refresh, portal, logout, state.user]);

  const updateProfile = React.useCallback(
    async (updates: Partial<User>): Promise<void> => {
      if (!state.user) return;

      const token = localStorage.getItem(`simple_auth_${portal}_token`);
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
          localStorage.setItem(`simple_auth_${portal}_user`, JSON.stringify(updatedUser));
          setState((prev) => ({ ...prev, user: updatedUser }));
        }
      } catch (error) {
        console.error("Profile update failed:", error);
        throw error;
      }
    },
    [config.endpoints.profile, portal, state.user],
  );

  // Permission and role checking
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

  // Session management (simplified)
  const extendSession = React.useCallback(async (): Promise<void> => {
    if (state.isAuthenticated) {
      const lastActivity = Date.now();
      localStorage.setItem(`simple_auth_${portal}_activity`, lastActivity.toString());
    }
  }, [portal, state.isAuthenticated]);

  const getSessionTimeRemaining = React.useCallback((): number => {
    const lastActivity = localStorage.getItem(`simple_auth_${portal}_activity`);
    if (!lastActivity || !state.isAuthenticated) return 0;

    const elapsed = Date.now() - parseInt(lastActivity);
    return Math.max(0, config.sessionTimeout - elapsed);
  }, [portal, state.isAuthenticated, config.sessionTimeout]);

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
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};
