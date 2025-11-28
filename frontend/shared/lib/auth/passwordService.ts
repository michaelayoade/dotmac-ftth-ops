/**
 * Password Service
 *
 * Handles password reset API calls to the FastAPI backend.
 */

import type { PasswordResetRequest, PasswordResetConfirm } from "./types";
import { isAuthBypassEnabled } from "./bypass";

const API_BASE = "/api/isp/v1/admin";

export interface PasswordResetResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Request a password reset email.
 */
export async function requestPasswordReset(
  email: string
): Promise<PasswordResetResult> {
  // Bypass mode
  if (isAuthBypassEnabled()) {
    return {
      success: true,
      message: "If the email exists, a reset link has been sent.",
    };
  }

  try {
    const response = await fetch(`${API_BASE}/auth/password-reset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
      } satisfies PasswordResetRequest),
    });

    // Backend always returns 200 for security (don't reveal if email exists)
    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: data.message || "If the email exists, a reset link has been sent.",
      };
    }

    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: errorData.detail || errorData.message || "Failed to request password reset",
    };
  } catch (error) {
    console.error("Password reset request error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to request password reset",
    };
  }
}

/**
 * Confirm password reset with token and new password.
 */
export async function confirmPasswordReset(
  token: string,
  newPassword: string
): Promise<PasswordResetResult> {
  // Bypass mode
  if (isAuthBypassEnabled()) {
    return {
      success: true,
      message: "Password has been reset successfully.",
    };
  }

  try {
    const response = await fetch(`${API_BASE}/auth/password-reset/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        new_password: newPassword,
      } satisfies PasswordResetConfirm),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: data.message || "Password has been reset successfully.",
      };
    }

    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: errorData.detail || errorData.message || "Failed to reset password",
    };
  } catch (error) {
    console.error("Password reset confirm error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reset password",
    };
  }
}
