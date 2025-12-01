/**
 * Platform Partner Token Utilities
 * Isolated token management for channel partner authentication
 */

const PARTNER_TOKEN_KEY = "platform_partner_access_token";
const PARTNER_REFRESH_KEY = "platform_partner_refresh_token";

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    sessionStorage.setItem("__test__", "test");
    sessionStorage.removeItem("__test__");
    return sessionStorage;
  } catch {
    try {
      localStorage.setItem("__test__", "test");
      localStorage.removeItem("__test__");
      return localStorage;
    } catch {
      return null;
    }
  }
}

export function getPartnerToken(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  return storage.getItem(PARTNER_TOKEN_KEY);
}

export function setPartnerToken(token: string): void {
  const storage = getStorage();
  if (storage) {
    storage.setItem(PARTNER_TOKEN_KEY, token);
  }
}

export function getPartnerRefreshToken(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  return storage.getItem(PARTNER_REFRESH_KEY);
}

export function setPartnerRefreshToken(token: string): void {
  const storage = getStorage();
  if (storage) {
    storage.setItem(PARTNER_REFRESH_KEY, token);
  }
}

export function clearPartnerTokens(): void {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(PARTNER_TOKEN_KEY);
    storage.removeItem(PARTNER_REFRESH_KEY);
  }
}

export function isPartnerAuthenticated(): boolean {
  return !!getPartnerToken();
}
