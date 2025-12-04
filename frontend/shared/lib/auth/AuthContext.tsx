"use client";

/**
 * Auth Context
 *
 * Provides authentication state and actions to the application.
 * Uses JWT cookie-based authentication with the FastAPI backend.
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
  getCurrentUserWithStatus,
} from "./loginService";
import { isAuthBypassEnabled, MOCK_USER } from "./bypass";
import { useRuntimeConfigState } from "../../runtime/RuntimeConfigContext";

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { loading: runtimeLoading, runtimeConfig } = useRuntimeConfigState();

  const isAuthenticated = useMemo(() => user !== null, [user]);

  /**
   * Fetch current user on mount.
   */
  useEffect(() => {
    if (runtimeLoading) {
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const initAuth = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Check bypass mode
        if (isAuthBypassEnabled()) {
          if (!cancelled) {
            setUser(MOCK_USER);
          }
          return;
        }

        // Try to get current user (validates cookies)
        const { user: currentUser, status } = await getCurrentUserWithStatus();
        if (!cancelled) {
          setUser(currentUser);
          if (!currentUser) {
            if (status === 401 || status === 403) {
              redirectToLogin();
            } else if (attempts < 2) {
              attempts += 1;
              setTimeout(initAuth, 500 * attempts);
              return;
            } else {
              setError("Could not verify session. Please try again.");
            }
          }
        }
      } catch (err) {
        console.error("Auth init error:", err);
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      cancelled = true;
    };
  }, [runtimeLoading, runtimeConfig?.generatedAt]);

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
      const { user: currentUser, status } = await getCurrentUserWithStatus();
      setUser(currentUser);
      if (!currentUser && (status === 401 || status === 403)) {
        redirectToLogin();
      }
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

function redirectToLogin() {
  if (typeof window === "undefined") {
    return;
  }
  const isLoginPage = window.location.pathname === "/login";
  if (!isLoginPage) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?redirect=${redirect}`;
  }
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
 * Hook that returns session-like object.
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
