/**
 * Login Service
 *
 * Handles authentication API calls to the FastAPI backend.
 */

import type {
  LoginRequest,
  LoginResponse,
  LoginResult,
  UserInfo,
  TwoFactorVerifyRequest,
} from "./types";
import { isAuthBypassEnabled, MOCK_USER } from "./bypass";

const API_BASE = "/api/v1";

/**
 * Custom error for 2FA required response.
 */
export class TwoFactorRequiredError extends Error {
  userId: string;

  constructor(userId: string) {
    super("Two-factor authentication required");
    this.name = "TwoFactorRequiredError";
    this.userId = userId;
  }
}

/**
 * Login with email/username and password.
 *
 * Handles the 2FA flow by detecting 403 with X-2FA-Required header.
 */
export async function login(
  username: string,
  password: string
): Promise<LoginResult> {
  // Bypass mode for E2E tests
  if (isAuthBypassEnabled()) {
    // Store tenant_id for API headers
    try {
      localStorage.setItem("tenant_id", "default-tenant");
    } catch {
      // Ignore storage errors
    }
    return {
      success: true,
      user: MOCK_USER,
    };
  }

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Important: include cookies
      body: JSON.stringify({
        username,
        password,
      } satisfies LoginRequest),
    });

    // Check for 2FA required (403 with special header)
    if (response.status === 403) {
      const userId = response.headers.get("X-User-ID");
      const requires2FA = response.headers.get("X-2FA-Required") === "true";

      if (requires2FA && userId) {
        return {
          success: false,
          requires2FA: true,
          userId,
        };
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.detail || errorData.message || "Login failed",
      };
    }

    const data: LoginResponse = await response.json();

    // Cookies are set by the backend (httpOnly)
    // Fetch user info to get full user object
    const userResponse = await fetch(`${API_BASE}/auth/me`, {
      credentials: "include",
    });

    if (!userResponse.ok) {
      return {
        success: false,
        error: "Failed to fetch user info",
      };
    }

    const user: UserInfo = await userResponse.json();

    // Store tenant_id for API headers
    if (user.tenant_id) {
      try {
        localStorage.setItem("tenant_id", user.tenant_id);
      } catch {
        // Ignore storage errors
      }
    }

    return {
      success: true,
      user,
    };
  } catch (error) {
    console.error("Login error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Login failed",
    };
  }
}

/**
 * Complete 2FA verification after initial login.
 */
export async function verify2FA(
  userId: string,
  code: string,
  isBackupCode = false
): Promise<LoginResult> {
  // Bypass mode
  if (isAuthBypassEnabled()) {
    return {
      success: true,
      user: MOCK_USER,
    };
  }

  try {
    const response = await fetch(`${API_BASE}/auth/login/verify-2fa`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        user_id: userId,
        code,
        is_backup_code: isBackupCode,
      } satisfies TwoFactorVerifyRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.detail || errorData.message || "2FA verification failed",
      };
    }

    // Cookies are set by the backend
    // Fetch user info
    const userResponse = await fetch(`${API_BASE}/auth/me`, {
      credentials: "include",
    });

    if (!userResponse.ok) {
      return {
        success: false,
        error: "Failed to fetch user info",
      };
    }

    const user: UserInfo = await userResponse.json();

    // Store tenant_id
    if (user.tenant_id) {
      try {
        localStorage.setItem("tenant_id", user.tenant_id);
      } catch {
        // Ignore
      }
    }

    return {
      success: true,
      user,
    };
  } catch (error) {
    console.error("2FA verification error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "2FA verification failed",
    };
  }
}

/**
 * Logout - clears cookies and local storage.
 */
export async function logout(): Promise<void> {
  // Clear local storage
  try {
    localStorage.removeItem("tenant_id");
    localStorage.removeItem("active_managed_tenant_id");
  } catch {
    // Ignore
  }

  // Bypass mode - just clear storage
  if (isAuthBypassEnabled()) {
    return;
  }

  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.error("Logout error:", error);
    // Continue anyway - local state is cleared
  }
}

/**
 * Get current user info.
 */
export async function getCurrentUser(): Promise<UserInfo | null> {
  // Bypass mode
  if (isAuthBypassEnabled()) {
    return MOCK_USER;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      credentials: "include",
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Refresh access token using refresh token cookie.
 */
export async function refreshToken(): Promise<boolean> {
  // Bypass mode
  if (isAuthBypassEnabled()) {
    return true;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    return response.ok;
  } catch {
    return false;
  }
}

