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
import { getRuntimeConfigSnapshot } from "../../runtime/runtime-config";
import { clearOperatorAuthTokens } from "../../utils/operatorAuth";
import { fetchWithAuth } from "./fetchWithAuth";

const DEFAULT_API_PREFIX = "/api/isp/v1";

function sanitizeBase(url: string): string {
  return url.replace(/\/+$/, "");
}

function joinUrl(base: string, path: string): string {
  const normalizedBase = base ? sanitizeBase(base) : "";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}` || normalizedPath;
}

function resolveApiBase(): string {
  const runtime = getRuntimeConfigSnapshot();
  if (runtime?.api?.restUrl) {
    return runtime.api.restUrl;
  }

  const envBase =
    process.env["NEXT_PUBLIC_API_BASE_URL"] ??
    process.env["NEXT_PUBLIC_API_URL"] ??
    "";
  const envPrefix = process.env["NEXT_PUBLIC_API_PREFIX"] ?? DEFAULT_API_PREFIX;

  return joinUrl(envBase, envPrefix);
}

function getApiBase(): string {
  return resolveApiBase() || DEFAULT_API_PREFIX;
}

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
    const apiBase = getApiBase();
    const response = await fetchWithAuth(`${apiBase}/auth/login`, {
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
    const userResponse = await fetchWithAuth(`${apiBase}/auth/me`, {
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
    const apiBase = getApiBase();
    const response = await fetchWithAuth(`${apiBase}/auth/login/verify-2fa`, {
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
    const userResponse = await fetchWithAuth(`${apiBase}/auth/me`, {
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
  // Clear stored identifiers/tokens across storage backends
  const clearKeys = (storage: Storage | null, keys: string[]) => {
    if (!storage) return;
    keys.forEach((key) => {
      try {
        storage.removeItem(key);
      } catch {
        // Ignore storage errors
      }
    });
  };

  clearKeys(typeof window !== "undefined" ? window.localStorage : null, [
    "tenant_id",
    "active_managed_tenant_id",
    "access_token",
    "auth_token",
  ]);
  clearKeys(typeof window !== "undefined" ? window.sessionStorage : null, [
    "tenant_id",
    "active_managed_tenant_id",
    "access_token",
    "auth_token",
  ]);

  // Clear session/local auth token storage
  clearOperatorAuthTokens();

  // Bypass mode - just clear storage
  if (isAuthBypassEnabled()) {
    return;
  }

  try {
    const apiBase = getApiBase();
    await fetchWithAuth(`${apiBase}/auth/logout`, {
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
  const { user } = await getCurrentUserWithStatus();
  return user;
}

export async function getCurrentUserWithStatus(): Promise<{
  user: UserInfo | null;
  status?: number | undefined;
}> {
  // Bypass mode
  if (isAuthBypassEnabled()) {
    return { user: MOCK_USER, status: 200 };
  }

  try {
    const apiBase = getApiBase();
  const response = await fetchWithAuth(`${apiBase}/auth/me`, {
    credentials: "include",
    retry: true,
  });

    if (!response.ok) {
      return { user: null, status: response.status };
    }

    const data = (await response.json()) as UserInfo;
    return { user: data, status: response.status };
  } catch {
    return { user: null };
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
    const apiBase = getApiBase();
  const response = await fetchWithAuth(`${apiBase}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    retry: false,
  });

    return response.ok;
  } catch {
    return false;
  }
}
