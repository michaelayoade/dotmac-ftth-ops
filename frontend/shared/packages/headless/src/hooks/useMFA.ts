/**
 * Multi-Factor Authentication (MFA) hook and utilities
 */

import { useCallback, useEffect, useState } from "react";

import { getApiClient } from "@dotmac/headless/api";
import { useAuthStore } from "@dotmac/headless/auth";

export type MFAMethod = "totp" | "sms" | "email" | "backup_code";

export interface MFASetupData {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface MFAChallenge {
  challengeId: string;
  methods: MFAMethod[];
  expiresAt: string;
}

export interface MFAVerificationResult {
  success: boolean;
  backupCodesRemaining?: number;
  message?: string;
}

export function useMFA() {
  const authStore = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupData, setSetupData] = useState<MFASetupData | null>(null);
  const [challenge, setChallenge] = useState<MFAChallenge | null>(null);

  const apiClient = getApiClient();

  /**
   * Check if user has MFA enabled
   */
  const isMFAEnabled = useCallback((): boolean => {
    return authStore.user?.mfaEnabled || false;
  }, [authStore.user]);

  /**
   * Check if MFA verification is required
   */
  const isMFARequired = useCallback((): boolean => {
    return authStore.mfaRequired && !authStore.mfaVerified;
  }, [authStore.mfaRequired, authStore.mfaVerified]);

  /**
   * Initialize MFA setup (get QR code and secret)
   */
  const initializeMFASetup = useCallback(async (): Promise<MFASetupData | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.request("/api/v1/auth/mfa/setup", {
        method: "POST",
      });

      const data: MFASetupData = response.data;
      setSetupData(data);

      return data;
    } catch (_error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to initialize MFA setup";
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [apiClient, error]);

  /**
   * Verify TOTP code during setup
   */
  const verifyMFASetup = useCallback(
    async (code: string): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!setupData) {
          throw new Error("MFA setup not initialized");
        }

        const response = await apiClient.request("/api/v1/auth/mfa/setup/verify", {
          method: "POST",
          body: JSON.stringify({
            code,
            secret: setupData.secret,
          }),
        });

        if (response.success) {
          // Update user MFA status
          authStore.updateUser({ mfaEnabled: true });
          setSetupData(null);
          return true;
        }

        return false;
      } catch (_error) {
        const errorMessage = error instanceof Error ? error.message : "MFA verification failed";
        setError(errorMessage);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [apiClient, setupData, authStore, error],
  );

  /**
   * Disable MFA for user
   */
  const disableMFA = useCallback(
    async (password: string): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await apiClient.request("/api/v1/auth/mfa/disable", {
          method: "POST",
          body: JSON.stringify({ password }),
        });

        if (response.success) {
          authStore.updateUser({ mfaEnabled: false });
          return true;
        }

        return false;
      } catch (_error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to disable MFA";
        setError(errorMessage);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [apiClient, authStore, error],
  );

  /**
   * Request MFA challenge (during login)
   */
  const requestMFAChallenge = useCallback(async (): Promise<MFAChallenge | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.request("/api/v1/auth/mfa/challenge", {
        method: "POST",
      });

      const challengeData: MFAChallenge = response.data;
      setChallenge(challengeData);

      return challengeData;
    } catch (_error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to request MFA challenge";
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [apiClient, error]);

  /**
   * Verify MFA code during authentication
   */
  const verifyMFAChallenge = useCallback(
    async (
      challengeId: string,
      code: string,
      method: MFAMethod = "totp",
    ): Promise<MFAVerificationResult> => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await apiClient.request("/api/v1/auth/mfa/verify", {
          method: "POST",
          body: JSON.stringify({
            challengeId,
            code,
            method,
          }),
        });

        const result: MFAVerificationResult = response.data;

        if (result.success) {
          // Mark MFA as verified in the auth store
          authStore.completeMFA();
          setChallenge(null);
        }

        return result;
      } catch (_error) {
        const errorMessage = error instanceof Error ? error.message : "MFA verification failed";
        setError(errorMessage);

        return {
          success: false,
          message: errorMessage,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [apiClient, authStore, error],
  );

  /**
   * Send SMS code for MFA
   */
  const sendSMSCode = useCallback(
    async (phoneNumber?: string): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await apiClient.request("/api/v1/auth/mfa/sms", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber,
            challengeId: challenge?.challengeId,
          }),
        });

        return response.success;
      } catch (_error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to send SMS code";
        setError(errorMessage);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [apiClient, challenge, error],
  );

  /**
   * Send email code for MFA
   */
  const sendEmailCode = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.request("/api/v1/auth/mfa/email", {
        method: "POST",
        body: JSON.stringify({
          challengeId: challenge?.challengeId,
        }),
      });

      return response.success;
    } catch (_error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send email code";
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [apiClient, challenge, error]);

  /**
   * Generate new backup codes
   */
  const generateBackupCodes = useCallback(async (): Promise<string[] | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.request("/api/v1/auth/mfa/backup-codes", {
        method: "POST",
      });

      return response.data.codes;
    } catch (_error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to generate backup codes";
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [apiClient, error]);

  /**
   * Clear MFA state
   */
  const clearMFAState = useCallback(() => {
    setSetupData(null);
    setChallenge(null);
    setError(null);
  }, []);

  /**
   * Check if challenge has expired
   */
  const isChallengeExpired = useCallback((): boolean => {
    if (!challenge) {
      return false;
    }

    const expiryTime = new Date(challenge.expiresAt).getTime();
    const now = Date.now();

    return now > expiryTime;
  }, [challenge]);

  /**
   * Get remaining time for challenge
   */
  const getChallengeTimeRemaining = useCallback((): number => {
    if (!challenge) {
      return 0;
    }

    const expiryTime = new Date(challenge.expiresAt).getTime();
    const now = Date.now();

    return Math.max(0, expiryTime - now);
  }, [challenge]);

  // Auto-clear expired challenges
  useEffect(() => {
    if (challenge && isChallengeExpired()) {
      setChallenge(null);
      setError("MFA challenge has expired. Please try again.");
    }
  }, [challenge, isChallengeExpired]);

  return {
    // State
    isLoading,
    error,
    setupData,
    challenge,

    // Status checks
    isMFAEnabled,
    isMFARequired,
    isChallengeExpired,
    getChallengeTimeRemaining,

    // Setup methods
    initializeMFASetup,
    verifyMFASetup,
    disableMFA,
    generateBackupCodes,

    // Authentication methods
    requestMFAChallenge,
    verifyMFAChallenge,
    sendSMSCode,
    sendEmailCode,

    // Utility methods
    clearMFAState,
    setError,
  };
}

/**
 * Hook for MFA enforcement in components
 */
export function useMFAGuard(required = true) {
  const { isMFARequired } = useMFA();
  const authStore = useAuthStore();

  const shouldShowMFA = required && isMFARequired();
  const canProceed = !required || !isMFARequired();

  useEffect(() => {
    if (required && !authStore.isAuthenticated) {
      // Redirect to login if authentication required but not authenticated
    }
  }, [required, authStore.isAuthenticated]);

  return {
    shouldShowMFA,
    canProceed,
    mfaRequired: isMFARequired(),
  };
}

/**
 * Utility function to validate TOTP code format
 */
export function isValidTOTPCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/**
 * Utility function to validate backup code format
 */
export function isValidBackupCode(code: string): boolean {
  return /^[A-Z0-9]{8}-[A-Z0-9]{8}$/.test(code.toUpperCase());
}

/**
 * Format backup code for display
 */
export function formatBackupCode(code: string): string {
  const cleaned = code.replace(/[^A-Z0-9]/g, "").toUpperCase();
  if (cleaned.length >= 8) {
    return `${cleaned.slice(0, 8)}-${cleaned.slice(8, 16)}`;
  }
  return cleaned;
}
