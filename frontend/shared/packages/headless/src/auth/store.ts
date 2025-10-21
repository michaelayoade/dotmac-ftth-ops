/**
 * Unified Authentication Store
 * Consolidates all auth patterns from individual portals
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import type {
  AuthStore,
  AuthState,
  AuthSession,
  LoginCredentials,
  User,
  PortalConfig,
  AuthError,
  DeviceFingerprint,
  AuthProviderConfig,
} from "./types";
import { SecureStorage } from "./storage";
import { TokenManager } from "./tokenManager";
import { CSRFProtection } from "./csrfProtection";
import { RateLimiter } from "./rateLimiter";

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  session: null,
  portal: null,
  error: null,
  mfaRequired: false,
  requiresPasswordChange: false,
  lastActivity: Date.now(),
  sessionValid: false,
};

export function useAuth(config: AuthProviderConfig) {
  const storage = new SecureStorage({
    backend: config.secureStorage ? "cookies" : "localStorage",
    encrypt: config.secureStorage || false,
    prefix: `auth_${config.portal.type}_`,
  });

  const tokenManager = new TokenManager(storage);
  const csrfProtection = new CSRFProtection();
  const rateLimiter = config.rateLimiting ? new RateLimiter() : null;

  return create<AuthStore>()(
    persist(
      immer((set, get) => ({
        ...initialState,

        // Login action with portal awareness
        login: async (credentials: LoginCredentials): Promise<boolean> => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            // Rate limiting check
            if (rateLimiter) {
              const rateLimitCheck = rateLimiter.checkLimit("login");
              if (!rateLimitCheck.allowed) {
                throw {
                  code: "RATE_LIMITED",
                  message: `Too many login attempts. Try again in ${rateLimitCheck.retryAfter}s`,
                  retryAfter: rateLimitCheck.retryAfter,
                };
              }
            }

            // Initialize CSRF protection
            await csrfProtection.initialize();

            // Generate device fingerprint if required
            const deviceFingerprint = config.portal.security.requireDeviceVerification
              ? generateDeviceFingerprint()
              : undefined;

            // Build login payload with portal context
            const loginPayload = {
              ...credentials,
              portal: config.portal.type,
              portalId: config.portal.id,
              tenantId: config.portal.tenantId,
              deviceFingerprint,
              csrfToken: csrfProtection.getToken(),
            };

            // Make login request
            const response = await fetch("/api/auth/login", {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfProtection.getToken() || "",
              },
              body: JSON.stringify(loginPayload),
            });

            if (!response.ok) {
              const errorData = await response.json();

              // Handle specific error cases
              if (errorData.requires_2fa) {
                set((state) => {
                  state.mfaRequired = true;
                });
              }

              if (errorData.password_expired) {
                set((state) => {
                  state.requiresPasswordChange = true;
                });
              }

              throw {
                code: errorData.code || "LOGIN_FAILED",
                message: errorData.message || "Authentication failed",
                ...errorData,
              };
            }

            const authData = await response.json();

            // Create auth session
            const session: AuthSession = {
              sessionId:
                authData.sessionId || crypto.getRandomValues(new Uint32Array(1))[0].toString(36),
              user: authData.user,
              tokens: {
                accessToken: authData.token,
                refreshToken: authData.refreshToken,
                expiresAt: Date.now() + (authData.expiresIn || 15 * 60) * 1000,
                csrfToken: authData.csrfToken,
              },
              portal: config.portal,
              lastActivity: Date.now(),
              deviceFingerprint,
            };

            // Store tokens securely
            tokenManager.setTokens(session.tokens);

            // Update state
            set((state) => {
              state.user = authData.user;
              state.isAuthenticated = true;
              state.session = session;
              state.portal = config.portal;
              state.sessionValid = true;
              state.lastActivity = Date.now();
              state.mfaRequired = false;
              state.requiresPasswordChange = authData.requiresPasswordChange || false;
              state.error = null;
              state.isLoading = false;
            });

            // Record successful login
            if (rateLimiter) {
              rateLimiter.recordAttempt("login", true);
            }

            // Setup auto-refresh
            if (config.autoRefresh) {
              tokenManager.setupAutoRefresh(
                () => get().refreshToken(),
                () => get().logout(),
              );
            }

            return true;
          } catch (error: any) {
            // Record failed attempt
            if (rateLimiter && error.code !== "RATE_LIMITED") {
              rateLimiter.recordAttempt("login", false);
            }

            set((state) => {
              state.error = error as AuthError;
              state.isLoading = false;
              state.isAuthenticated = false;
            });

            return false;
          }
        },

        // Logout action
        logout: async (): Promise<void> => {
          set((state) => {
            state.isLoading = true;
          });

          try {
            // Notify server
            await fetch("/api/auth/logout", {
              method: "POST",
              credentials: "include",
              headers: {
                Authorization: `Bearer ${tokenManager.getAccessToken()}`,
              },
            });
          } catch (error) {
            console.warn("Logout request failed:", error);
          }

          // Clear all auth data
          tokenManager.clearTokens();
          csrfProtection.clearToken();
          storage.clear();

          // Reset state
          set(() => ({
            ...initialState,
          }));

          // Redirect if configured
          if (config.redirectOnLogout && typeof window !== "undefined") {
            window.location.href = config.redirectOnLogout;
          }
        },

        // Token refresh
        refreshToken: async (): Promise<boolean> => {
          const refreshToken = tokenManager.getRefreshToken();
          if (!refreshToken) return false;

          try {
            const response = await fetch("/api/auth/refresh", {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ refreshToken }),
            });

            if (!response.ok) {
              await get().logout();
              return false;
            }

            const data = await response.json();

            // Update tokens
            const newTokens = {
              accessToken: data.token,
              refreshToken: data.refreshToken,
              expiresAt: Date.now() + (data.expiresIn || 15 * 60) * 1000,
              csrfToken: data.csrfToken,
            };

            tokenManager.setTokens(newTokens);

            // Update session
            set((state) => {
              if (state.session) {
                state.session.tokens = newTokens;
                state.session.lastActivity = Date.now();
              }
              state.lastActivity = Date.now();
              state.sessionValid = true;
            });

            return true;
          } catch (error) {
            console.error("Token refresh failed:", error);
            await get().logout();
            return false;
          }
        },

        // Session validation
        validateSession: async (): Promise<boolean> => {
          const accessToken = tokenManager.getAccessToken();
          if (!accessToken) return false;

          try {
            const response = await fetch("/api/auth/validate", {
              method: "GET",
              credentials: "include",
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });

            if (response.ok) {
              const userData = await response.json();

              set((state) => {
                if (userData.user) {
                  state.user = userData.user;
                }
                state.sessionValid = true;
                state.lastActivity = Date.now();
              });

              return true;
            } else {
              set((state) => {
                state.sessionValid = false;
              });
              return false;
            }
          } catch (error) {
            console.error("Session validation failed:", error);
            set((state) => {
              state.sessionValid = false;
            });
            return false;
          }
        },

        // User updates
        updateUser: (updates: Partial<User>) => {
          set((state) => {
            if (state.user) {
              state.user = { ...state.user, ...updates };
              if (state.session) {
                state.session.user = state.user;
              }
            }
          });
        },

        // Password update
        updatePassword: async (currentPassword: string, newPassword: string): Promise<boolean> => {
          const accessToken = tokenManager.getAccessToken();
          if (!accessToken) return false;

          try {
            const response = await fetch("/api/auth/password/update", {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
                "X-CSRF-Token": csrfProtection.getToken() || "",
              },
              body: JSON.stringify({
                currentPassword,
                newPassword,
              }),
            });

            if (response.ok) {
              set((state) => {
                state.requiresPasswordChange = false;
              });
              return true;
            }

            return false;
          } catch (error) {
            console.error("Password update failed:", error);
            return false;
          }
        },

        // MFA setup
        setupMfa: async (secret: string, code: string): Promise<boolean> => {
          const accessToken = tokenManager.getAccessToken();
          if (!accessToken) return false;

          try {
            const response = await fetch("/api/auth/mfa/setup", {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
                "X-CSRF-Token": csrfProtection.getToken() || "",
              },
              body: JSON.stringify({ secret, code }),
            });

            if (response.ok) {
              set((state) => {
                if (state.user) {
                  state.user.mfaEnabled = true;
                }
                state.mfaRequired = false;
              });
              return true;
            }

            return false;
          } catch (error) {
            console.error("MFA setup failed:", error);
            return false;
          }
        },

        // Utility actions
        clearError: () => {
          set((state) => {
            state.error = null;
          });
        },

        updateActivity: () => {
          set((state) => {
            state.lastActivity = Date.now();
            if (state.session) {
              state.session.lastActivity = Date.now();
            }
          });
        },
      })),
      {
        name: `dotmac-auth-${config.portal.type}`,
        storage: createJSONStorage(() => storage),
        partialize: (state) => ({
          // Only persist non-sensitive data
          user: state.user
            ? {
                id: state.user.id,
                email: state.user.email,
                name: state.user.name,
                role: state.user.role,
                tenantId: state.user.tenantId,
                avatar: state.user.avatar,
                // Don't persist sensitive fields
              }
            : null,
          portal: state.portal,
          lastActivity: state.lastActivity,
          // Don't persist tokens, session data, or errors
        }),
        onRehydrateStorage: () => (state) => {
          // Validate session on rehydration
          if (state?.validateSession) {
            state.validateSession();
          }
        },
      },
    ),
  );
}

// Device fingerprinting utility
function generateDeviceFingerprint(): DeviceFingerprint {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillText("DotMac fingerprint", 2, 2);
  }

  return {
    screen_resolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    platform: navigator.platform,
    user_agent_hash: btoa(navigator.userAgent.slice(0, 50)),
    canvas_fingerprint: canvas.toDataURL().slice(-20),
  };
}
