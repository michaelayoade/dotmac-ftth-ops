"use client";

/**
 * Operator Auth Token Utilities
 *
 * Centralises how the operator portals persist and retrieve bearer tokens.
 * Tokens are constrained to sessionStorage to minimise exposure surface and
 * legacy values in localStorage are automatically migrated and cleared.
 *
 * Refresh tokens are never persisted in web-accessible storage; the backend
 * should manage them via httpOnly cookies.
 */

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

let inMemoryAccessToken: string | null = null;

const safeSessionStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const safeLocalStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const readFromStorage = (storage: Storage | null, key: string): string | null => {
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const removeFromStorage = (storage: Storage | null, key: string) => {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // no-op
  }
};

/**
 * Persist the access token for the current browser session only.
 */
export const setOperatorAccessToken = (token: string | null) => {
  const session = safeSessionStorage();
  const local = safeLocalStorage();

  if (token) {
    if (session) {
      try {
        session.setItem(ACCESS_TOKEN_KEY, token);
      } catch {
        // Ignore storage errors (e.g. quota exceeded, private mode)
      }
    }
    inMemoryAccessToken = token;
  } else {
    removeFromStorage(session, ACCESS_TOKEN_KEY);
    inMemoryAccessToken = null;
  }

  // Always clear legacy copies from localStorage for security.
  removeFromStorage(local, ACCESS_TOKEN_KEY);
};

/**
 * Retrieve the access token, migrating any legacy localStorage copies into
 * sessionStorage when found.
 */
export const getOperatorAccessToken = (): string | null => {
  const session = safeSessionStorage();
  const local = safeLocalStorage();

  const sessionToken = readFromStorage(session, ACCESS_TOKEN_KEY);
  if (sessionToken) {
    inMemoryAccessToken = sessionToken;
    return sessionToken;
  }

  const localToken = readFromStorage(local, ACCESS_TOKEN_KEY);
  if (localToken) {
    // Migrate legacy token to session storage and clear the old copy.
    setOperatorAccessToken(localToken);
    return localToken;
  }

  return inMemoryAccessToken;
};

/**
 * Clear all persisted tokens, including legacy refresh tokens.
 */
export const clearOperatorAuthTokens = () => {
  const session = safeSessionStorage();
  const local = safeLocalStorage();

  removeFromStorage(session, ACCESS_TOKEN_KEY);
  removeFromStorage(local, ACCESS_TOKEN_KEY);
  removeFromStorage(session, REFRESH_TOKEN_KEY);
  removeFromStorage(local, REFRESH_TOKEN_KEY);

  inMemoryAccessToken = null;
};
