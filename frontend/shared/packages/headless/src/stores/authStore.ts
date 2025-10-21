/**
 * Secure authentication store using Zustand with enhanced security
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { User } from "../types";
import { csrfProtection } from "../utils/csrfProtection";
import { secureStorage } from "../utils/secureStorage";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  sessionId: string | null;
  mfaRequired: boolean;
  mfaVerified: boolean;
  lastActivity: number | null;
}

interface AuthActions {
  setAuth: (
    user: User,
    tokens?: TokenPair,
    sessionId?: string,
    csrfToken?: string,
  ) => Promise<void>;
  clearAuth: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  requireMFA: () => void;
  completeMFA: () => void;
  updateLastActivity: () => void;
  isSessionValid: () => boolean;
  getValidToken: () => Promise<string | null>;
  refreshTokens: (
    refreshFn: (token: string) => Promise<{ accessToken: string; refreshToken: string }>,
  ) => Promise<boolean>;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  sessionId: null,
  mfaRequired: false,
  mfaVerified: false,
  lastActivity: null,
};

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setAuth: async (user, tokens, sessionId, csrfToken) => {
        // Initialize CSRF protection if token provided
        if (csrfToken) {
          csrfProtection.storeToken(csrfToken);
        } else {
          await csrfProtection.initialize();
        }

        // Store tokens securely (in practice, would use httpOnly cookies)
        if (tokens) {
          secureStorage.setItem(
            "auth_tokens",
            JSON.stringify({
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
              expiresAt: tokens.expiresAt,
            }),
          );
        }

        // Generate session ID if not provided
        const currentSessionId =
          sessionId || crypto.getRandomValues(new Uint32Array(1))[0].toString(36);

        set({
          user,
          isAuthenticated: true,
          sessionId: currentSessionId,
          mfaRequired: user.mfaEnabled || false,
          mfaVerified: !user.mfaEnabled, // If MFA not enabled, consider it verified
          lastActivity: Date.now(),
        });
      },

      clearAuth: async () => {
        try {
          // Clear CSRF protection
          csrfProtection.clearToken();

          // Clear auth tokens
          secureStorage.removeItem("auth_tokens");

          // Clear all secure storage (non-sensitive data only)
          secureStorage.clear();

          // NOTE: Actual token clearing must be done via server actions
          // Tokens are in httpOnly cookies and cannot be cleared client-side

          set(initialState);
        } catch (_error) {
          // Still reset state even if cleanup fails
          set(initialState);
        }
      },

      updateUser: (updates) => {
        const { user } = get();
        if (user) {
          set({
            user: { ...user, ...updates },
            lastActivity: Date.now(),
          });
        }
      },

      requireMFA: () => {
        set({ mfaRequired: true, mfaVerified: false });
      },

      completeMFA: () => {
        set({ mfaVerified: true, lastActivity: Date.now() });
      },

      updateLastActivity: () => {
        set({ lastActivity: Date.now() });
      },

      isSessionValid: () => {
        const { lastActivity, isAuthenticated } = get();

        if (!isAuthenticated || !lastActivity) {
          return false;
        }

        // Check session timeout
        const now = Date.now();
        const timeSinceLastActivity = now - lastActivity;

        return timeSinceLastActivity < SESSION_TIMEOUT;
      },

      getValidToken: async () => {
        try {
          const tokensData = secureStorage.getItem("auth_tokens");
          if (!tokensData) return null;

          const tokens = JSON.parse(tokensData);
          const now = Date.now();

          // Check if token is expired
          if (now >= tokens.expiresAt) {
            return null;
          }

          return tokens.accessToken;
        } catch {
          return null;
        }
      },

      refreshTokens: async (refreshFn) => {
        try {
          const tokensData = secureStorage.getItem("auth_tokens");
          if (!tokensData) return false;

          const tokens = JSON.parse(tokensData);
          if (!tokens.refreshToken) return false;

          const newTokens = await refreshFn(tokens.refreshToken);

          // Store new tokens
          secureStorage.setItem(
            "auth_tokens",
            JSON.stringify({
              accessToken: newTokens.accessToken,
              refreshToken: newTokens.refreshToken,
              expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
            }),
          );

          set({ lastActivity: Date.now() });
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: "dotmac-session-state",
      storage: createJSONStorage(() => {
        // Use secure storage wrapper
        return {
          getItem: (name) => secureStorage.getItem(name),
          setItem: (name, value) => secureStorage.setItem(name, value),
          removeItem: (name) => secureStorage.removeItem(name),
        };
      }),
      partialize: (state) => ({
        // Only store non-sensitive session data
        user: state.user
          ? {
              ...state.user,
              // Remove sensitive fields from persistence
              password: undefined,
              tempPassword: undefined,
            }
          : null,
        isAuthenticated: state.isAuthenticated,
        sessionId: state.sessionId,
        mfaRequired: state.mfaRequired,
        mfaVerified: state.mfaVerified,
        lastActivity: state.lastActivity,
      }),
      onRehydrateStorage: () => (state) => {
        // Validate session on rehydration
        if (state?.isSessionValid && !state.isSessionValid()) {
          state.clearAuth?.();
        }
      },
    },
  ),
);
