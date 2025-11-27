"use client";

/**
 * Auth Context
 *
 * Provides authentication state and actions to the application.
 * Replaces Better Auth's useSession hook.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { AuthContextValue, UserInfo, LoginResult } from "./types";
import {
  login as loginApi,
  logout as logoutApi,
  verify2FA as verify2FAApi,
  getCurrentUser,
} from "./loginService";
import { isAuthBypassEnabled, MOCK_USER } from "./bypass";

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = useMemo(() => user !== null, [user]);

  /**
   * Fetch current user on mount.
   */
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Check bypass mode
        if (isAuthBypassEnabled()) {
          setUser(MOCK_USER);
          setIsLoading(false);
          return;
        }

        // Try to get current user (validates cookies)
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (err) {
        console.error("Auth init error:", err);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  /**
   * Login with email/username and password.
   */
  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await loginApi(email, password);

        if (result.success && result.user) {
          setUser(result.user);
        } else if (!result.requires2FA) {
          setError(result.error || "Login failed");
        }

        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Login failed";
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Complete 2FA verification.
   */
  const verify2FA = useCallback(
    async (
      userId: string,
      code: string,
      isBackupCode = false
    ): Promise<LoginResult> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await verify2FAApi(userId, code, isBackupCode);

        if (result.success && result.user) {
          setUser(result.user);
        } else {
          setError(result.error || "2FA verification failed");
        }

        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "2FA verification failed";
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Logout and clear state.
   */
  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);

    try {
      await logoutApi();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setUser(null);
      setError(null);
      setIsLoading(false);
    }
  }, []);

  /**
   * Refresh user data.
   */
  const refreshUser = useCallback(async (): Promise<void> => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (err) {
      console.error("Refresh user error:", err);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      error,
      login,
      logout,
      refreshUser,
      verify2FA,
    }),
    [user, isAuthenticated, isLoading, error, login, logout, refreshUser, verify2FA]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

/**
 * Compatibility hook that returns session-like object.
 * This helps with migration from Better Auth's useSession.
 *
 * Returns a simpler interface focused on what components actually need:
 * - user: The current user or null
 * - isLoading: Whether auth state is being determined
 * - isAuthenticated: Whether user is logged in
 * - refreshUser: Function to refresh user data
 */
export function useSession() {
  const auth = useAuth();

  return {
    user: auth.user,
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
    refreshUser: auth.refreshUser,
    error: auth.error ? new Error(auth.error) : null,
  };
}

export { AuthContext };
