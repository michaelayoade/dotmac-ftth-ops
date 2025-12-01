"use client";

/**
 * Customer Portal Authentication Token Utilities
 *
 * Manages customer access tokens in sessionStorage with localStorage fallback.
 * Completely isolated from operator/admin tokens.
 */

export const CUSTOMER_TOKEN_KEY = "customer_access_token";
export const CUSTOMER_REFRESH_TOKEN_KEY = "customer_refresh_token";

export class CustomerAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string = "CUSTOMER_AUTH_ERROR",
  ) {
    super(message);
    this.name = "CustomerAuthError";
  }
}

let inMemoryToken: string | null = null;

const safeSessionStorage = (): Storage | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const safeLocalStorage = (): Storage | null => {
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
    // ignore storage failures
  }
};

export const setCustomerToken = (token: string | null): void => {
  const session = safeSessionStorage();
  const local = safeLocalStorage();

  if (token) {
    if (session) {
      try {
        session.setItem(CUSTOMER_TOKEN_KEY, token);
      } catch {
        // swallow storage errors
      }
    }
    inMemoryToken = token;
  } else {
    removeFromStorage(session, CUSTOMER_TOKEN_KEY);
    inMemoryToken = null;
  }

  // Always clear legacy copies from localStorage for security
  removeFromStorage(local, CUSTOMER_TOKEN_KEY);
};

export const getCustomerToken = (): string | null => {
  const session = safeSessionStorage();
  const local = safeLocalStorage();

  const sessionToken = readFromStorage(session, CUSTOMER_TOKEN_KEY);
  if (sessionToken) {
    inMemoryToken = sessionToken;
    return sessionToken;
  }

  const localToken = readFromStorage(local, CUSTOMER_TOKEN_KEY);
  if (localToken) {
    // Migrate legacy token to session storage
    setCustomerToken(localToken);
    return localToken;
  }

  return inMemoryToken;
};

export const clearCustomerTokens = (): void => {
  const session = safeSessionStorage();
  const local = safeLocalStorage();

  removeFromStorage(session, CUSTOMER_TOKEN_KEY);
  removeFromStorage(local, CUSTOMER_TOKEN_KEY);
  removeFromStorage(session, CUSTOMER_REFRESH_TOKEN_KEY);
  removeFromStorage(local, CUSTOMER_REFRESH_TOKEN_KEY);

  inMemoryToken = null;
};

export const buildCustomerAuthHeaders = (headers?: HeadersInit): Headers => {
  const resolvedHeaders = new Headers(headers ?? undefined);
  const token = getCustomerToken();

  if (token) {
    resolvedHeaders.set("Authorization", `Bearer ${token}`);
  }

  if (!resolvedHeaders.has("Content-Type")) {
    resolvedHeaders.set("Content-Type", "application/json");
  }

  return resolvedHeaders;
};

export const customerAuthFetch = (
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> => {
  const headers = buildCustomerAuthHeaders(init.headers);

  return fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? "include",
  });
};
