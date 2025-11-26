/**
 * Portal ID Authentication Hook - ISP Framework Integration
 * Implements ISP Framework Portal ID authentication system
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { createPortalAuthFetch, DEFAULT_PORTAL_TOKEN_KEY } from "../utils/portalAuth";
import type {
  PortalLoginCredentials,
  PortalAuthResponse,
  PortalAccount,
  PortalSession,
  PortalAuthError,
  PortalIdValidation,
  DeviceFingerprint,
} from "../types/portal-auth";
import { PORTAL_ID_CONFIG, RISK_THRESHOLDS } from "../types/portal-auth";

interface UsePortalIdAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: PortalAuthError | null;
  portalAccount: PortalAccount | null;
  session: PortalSession | null;
  customerData: any | null;
  technicianData: any | null;
  resellerData: any | null;
  permissions: string[];
  requiresMfa: boolean;
  requiresPasswordChange: boolean;
}

interface UsePortalIdAuthActions {
  login: (credentials: PortalLoginCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  validatePortalId: (portalId: string) => PortalIdValidation;
  checkSessionHealth: () => Promise<boolean>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  setupMfa: (secret: string, code: string) => Promise<boolean>;
  generateDeviceFingerprint: () => DeviceFingerprint;
}

export function usePortalIdAuth(): UsePortalIdAuthState & UsePortalIdAuthActions {
  const portalAuthFetch = useMemo(() => createPortalAuthFetch(DEFAULT_PORTAL_TOKEN_KEY), []);
  const [state, setState] = useState<UsePortalIdAuthState>({
    isAuthenticated: false,
    isLoading: false,
    error: null,
    portalAccount: null,
    session: null,
    customerData: null,
    technicianData: null,
    resellerData: null,
    permissions: [],
    requiresMfa: false,
    requiresPasswordChange: false,
  });

  // Validate Portal ID format and characters
  const validatePortalId = useCallback((portalId: string): PortalIdValidation => {
    const errors: string[] = [];
    let formatted = portalId.toUpperCase().trim();

    // Remove invalid characters
    formatted = formatted.replace(/[^A-Z2-9]/g, "");

    // Check length
    if (formatted.length !== PORTAL_ID_CONFIG.LENGTH) {
      errors.push(`Portal ID must be exactly ${PORTAL_ID_CONFIG.LENGTH} characters`);
    }

    // Check format
    if (!PORTAL_ID_CONFIG.VALIDATION_REGEX.test(formatted)) {
      errors.push("Portal ID contains invalid characters (use A-Z and 2-9 only)");
    }

    // Check for common mistakes
    if (formatted.includes("0") || formatted.includes("O")) {
      errors.push("Portal ID cannot contain 0 or O (zero/oh confusion)");
    }
    if (formatted.includes("1") || formatted.includes("I")) {
      errors.push("Portal ID cannot contain 1 or I (one/eye confusion)");
    }

    return {
      is_valid: errors.length === 0,
      formatted,
      errors,
    };
  }, []);

  // Generate device fingerprint for security
  const generateDeviceFingerprint = useCallback((): DeviceFingerprint => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillText("Portal ID fingerprint", 2, 2);
    }

    return {
      screen_resolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      user_agent_hash: btoa(navigator.userAgent).slice(0, 20),
      canvas_fingerprint: canvas.toDataURL().slice(-20),
    };
  }, []);

  // Calculate risk score based on login patterns
  const calculateRiskScore = useCallback(
    (credentials: PortalLoginCredentials, deviceFingerprint: DeviceFingerprint): number => {
      let risk = 0;

      // New device increases risk
      const storedFingerprint = localStorage.getItem(`device_fp_${credentials.portal_id}`);
      if (!storedFingerprint || storedFingerprint !== JSON.stringify(deviceFingerprint)) {
        risk += 20;
      }

      // Unusual timezone
      const storedTimezone = localStorage.getItem(`timezone_${credentials.portal_id}`);
      if (storedTimezone && storedTimezone !== deviceFingerprint.timezone) {
        risk += 30;
      }

      // Failed attempts tracking
      const failedAttempts = localStorage.getItem(`failed_attempts_${credentials.portal_id}`);
      if (failedAttempts && parseInt(failedAttempts) > 2) {
        risk += 25;
      }

      return Math.min(risk, 100);
    },
    [],
  );

  // Portal ID login implementation
  const login = useCallback(
    async (credentials: PortalLoginCredentials): Promise<boolean> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Validate Portal ID format
        const validation = validatePortalId(credentials.portal_id);
        if (!validation.is_valid) {
          throw {
            code: "INVALID_PORTAL_ID_FORMAT",
            message: validation.errors[0],
            details: { errors: validation.errors },
          };
        }

        // Generate device fingerprint
        const deviceFingerprint = generateDeviceFingerprint();
        const riskScore = calculateRiskScore(credentials, deviceFingerprint);

        // Call ISP Framework Portal ID authentication endpoint
        const response = await fetch("/api/portal/v1/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            portal_id: validation.formatted,
            password: credentials.password,
            mfa_code: credentials.mfa_code,
            device_fingerprint: deviceFingerprint,
            risk_score: riskScore,
            remember_device: credentials.remember_device || false,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();

          // Handle specific error cases
          if (errorData.requires_2fa) {
            setState((prev) => ({ ...prev, requiresMfa: true }));
            throw {
              code: "MFA_REQUIRED",
              message: "Two-factor authentication required",
              requires_2fa: true,
            };
          }

          if (errorData.account_locked) {
            throw {
              code: "ACCOUNT_LOCKED",
              message: `Account locked until ${errorData.locked_until}`,
              locked_until: errorData.locked_until,
            };
          }

          if (errorData.password_expired) {
            setState((prev) => ({ ...prev, requiresPasswordChange: true }));
            throw {
              code: "PASSWORD_EXPIRED",
              message: "Password has expired and must be changed",
              password_expired: true,
            };
          }

          // Track failed attempts
          const currentAttempts = parseInt(
            localStorage.getItem(`failed_attempts_${credentials.portal_id}`) || "0",
          );
          localStorage.setItem(
            `failed_attempts_${credentials.portal_id}`,
            (currentAttempts + 1).toString(),
          );

          throw {
            code: errorData.code || "LOGIN_FAILED",
            message: errorData.message || "Invalid Portal ID or password",
            details: errorData,
          };
        }

        const authData: PortalAuthResponse = await response.json();

        // Store authentication data
        localStorage.setItem("portal_session", JSON.stringify(authData.session));
        localStorage.setItem("portal_account", JSON.stringify(authData.portal_account));
        localStorage.setItem("access_token", authData.access_token);
        localStorage.setItem("refresh_token", authData.refresh_token);

        // Store device fingerprint for future risk assessment
        localStorage.setItem(
          `device_fp_${credentials.portal_id}`,
          JSON.stringify(deviceFingerprint),
        );
        localStorage.setItem(`timezone_${credentials.portal_id}`, deviceFingerprint.timezone);

        // Clear failed attempts on successful login
        localStorage.removeItem(`failed_attempts_${credentials.portal_id}`);

        // Update state
        setState((prev) => ({
          ...prev,
          isAuthenticated: true,
          portalAccount: authData.portal_account,
          session: authData.session,
          customerData: authData.customer || null,
          technicianData: authData.technician || null,
          resellerData: authData.reseller || null,
          permissions: authData.permissions,
          requiresPasswordChange: authData.requires_password_change || false,
          requiresMfa: false,
          error: null,
        }));

        return true;
      } catch (error: any) {
        setState((prev) => ({
          ...prev,
          error: error as PortalAuthError,
          isAuthenticated: false,
        }));
        return false;
      } finally {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [validatePortalId, generateDeviceFingerprint, calculateRiskScore],
  );

  // Logout implementation
  const logout = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const session = localStorage.getItem("portal_session");
      if (session) {
        // Notify backend of logout
        await portalAuthFetch("/api/portal/v1/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ session_id: JSON.parse(session).session_id }),
        });
      }
    } catch (error) {
      console.warn("Logout request failed:", error);
    } finally {
      // Clear all stored data
      localStorage.removeItem("portal_session");
      localStorage.removeItem("portal_account");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");

      setState({
        isAuthenticated: false,
        isLoading: false,
        error: null,
        portalAccount: null,
        session: null,
        customerData: null,
        technicianData: null,
        resellerData: null,
        permissions: [],
        requiresMfa: false,
        requiresPasswordChange: false,
      });
    }
  }, []);

  // Refresh session token
  const refreshSession = useCallback(async (): Promise<boolean> => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) return false;

    try {
      const response = await fetch("/api/portal/v1/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
        return true;
      }
    } catch (error) {
      console.error("Session refresh failed:", error);
    }

    // If refresh fails, logout
    await logout();
    return false;
  }, [logout]);

  // Check session health and risk
  const checkSessionHealth = useCallback(async (): Promise<boolean> => {
    const session = localStorage.getItem("portal_session");
    const accessToken = localStorage.getItem("access_token");

    if (!session || !accessToken) return false;

    try {
      const response = await fetch("/api/portal/v1/auth/session/health", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const healthData = await response.json();

        // Check if risk score is too high
        if (healthData.risk_score > RISK_THRESHOLDS.CRITICAL) {
          await logout();
          return false;
        }

        return healthData.is_healthy;
      }
    } catch (error) {
      console.error("Session health check failed:", error);
    }

    return false;
  }, [logout]);

  // Update password
  const updatePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<boolean> => {
      const accessToken = localStorage.getItem("access_token");
      if (!accessToken) return false;

      try {
        const response = await fetch("/api/portal/v1/auth/password/update", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
          }),
        });

        if (response.ok) {
          setState((prev) => ({ ...prev, requiresPasswordChange: false }));
          return true;
        }
      } catch (error) {
        console.error("Password update failed:", error);
      }

      return false;
    },
    [],
  );

  // Setup MFA
  const setupMfa = useCallback(async (secret: string, code: string): Promise<boolean> => {
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) return false;

    try {
      const response = await fetch("/api/portal/v1/auth/mfa/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          secret,
          verification_code: code,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error("MFA setup failed:", error);
    }

    return false;
  }, []);

  // Initialize authentication state from storage
  useEffect(() => {
    const initAuth = async () => {
      const portalAccount = localStorage.getItem("portal_account");
      const session = localStorage.getItem("portal_session");
      const accessToken = localStorage.getItem("access_token");

      if (portalAccount && session && accessToken) {
        // Verify session is still valid
        const isHealthy = await checkSessionHealth();
        if (isHealthy) {
          setState((prev) => ({
            ...prev,
            isAuthenticated: true,
            portalAccount: JSON.parse(portalAccount),
            session: JSON.parse(session),
            // Load other data from storage if needed
          }));
        }
      }
    };

    initAuth();
  }, [checkSessionHealth]);

  // Periodic session health checks
  useEffect(() => {
    if (state.isAuthenticated) {
      const interval = setInterval(checkSessionHealth, 5 * 60 * 1000); // Every 5 minutes
      return () => clearInterval(interval);
    }
  }, [state.isAuthenticated, checkSessionHealth]);

  return {
    ...state,
    login,
    logout,
    refreshSession,
    validatePortalId,
    checkSessionHealth,
    updatePassword,
    setupMfa,
    generateDeviceFingerprint,
  };
}
