/**
 * Tenant Portal Token Utilities
 * Isolated token management for tenant (ISP owner) authentication
 */

const TENANT_TOKEN_KEY = "tenant_access_token";
const TENANT_REFRESH_KEY = "tenant_refresh_token";

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    // Use sessionStorage for tenant tokens
    sessionStorage.setItem("__test__", "test");
    sessionStorage.removeItem("__test__");
    return sessionStorage;
  } catch {
    // Fallback to localStorage
    try {
      localStorage.setItem("__test__", "test");
      localStorage.removeItem("__test__");
      return localStorage;
    } catch {
      return null;
    }
  }
}

export function getTenantToken(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  return storage.getItem(TENANT_TOKEN_KEY);
}

export function setTenantToken(token: string): void {
  const storage = getStorage();
  if (storage) {
    storage.setItem(TENANT_TOKEN_KEY, token);
  }
}

export function getTenantRefreshToken(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  return storage.getItem(TENANT_REFRESH_KEY);
}

export function setTenantRefreshToken(token: string): void {
  const storage = getStorage();
  if (storage) {
    storage.setItem(TENANT_REFRESH_KEY, token);
  }
}

export function clearTenantTokens(): void {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(TENANT_TOKEN_KEY);
    storage.removeItem(TENANT_REFRESH_KEY);
  }
}

export function isTenantAuthenticated(): boolean {
  return !!getTenantToken();
}
