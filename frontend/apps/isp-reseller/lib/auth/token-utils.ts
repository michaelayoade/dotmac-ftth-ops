/**
 * Reseller Portal Token Utilities
 * Isolated token management for reseller authentication
 */

const RESELLER_TOKEN_KEY = "reseller_access_token";
const RESELLER_REFRESH_KEY = "reseller_refresh_token";

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    // Use sessionStorage for reseller tokens (more secure for B2B)
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

export function getResellerToken(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  return storage.getItem(RESELLER_TOKEN_KEY);
}

export function setResellerToken(token: string): void {
  const storage = getStorage();
  if (storage) {
    storage.setItem(RESELLER_TOKEN_KEY, token);
  }
}

export function getResellerRefreshToken(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  return storage.getItem(RESELLER_REFRESH_KEY);
}

export function setResellerRefreshToken(token: string): void {
  const storage = getStorage();
  if (storage) {
    storage.setItem(RESELLER_REFRESH_KEY, token);
  }
}

export function clearResellerTokens(): void {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(RESELLER_TOKEN_KEY);
    storage.removeItem(RESELLER_REFRESH_KEY);
  }
}

export function isResellerAuthenticated(): boolean {
  return !!getResellerToken();
}
