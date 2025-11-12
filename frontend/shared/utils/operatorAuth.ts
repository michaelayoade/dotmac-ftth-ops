"use client";

/**
 * Operator authentication token utilities.
 *
 * These helpers mirror the behaviour of the headless package, persisting access
 * tokens in sessionStorage (with legacy localStorage migration), exposing an
 * in-memory fallback, and offering helpers to clear tokens across storage
 * backends. We keep the implementation local so frontend apps do not depend on
 * un-exported internals of the headless package.
 */

export const DEFAULT_PORTAL_TOKEN_KEY = "access_token";
export const DEFAULT_PORTAL_REFRESH_TOKEN_KEY = "refresh_token";
export const CUSTOMER_PORTAL_TOKEN_KEY = "customer_access_token";
export const CUSTOMER_PORTAL_REFRESH_TOKEN_KEY = "customer_refresh_token";

export class PortalAuthError extends Error {
  constructor(message: string, public readonly code: string = "PORTAL_AUTH_ERROR") {
    super(message);
    this.name = "PortalAuthError";
  }
}

const ACCESS_TOKEN_KEY = DEFAULT_PORTAL_TOKEN_KEY;
const REFRESH_TOKEN_KEY = "refresh_token";

let inMemoryAccessToken: string | null = null;

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
    // ignore storage failures (incognito, quota, etc.)
  }
};

const writeToSessionStorage = (key: string, value: string | null) => {
  const session = safeSessionStorage();
  const local = safeLocalStorage();

  if (value) {
    if (session) {
      try {
        session.setItem(key, value);
      } catch {
        // ignore storage failures
      }
    }
  } else {
    removeFromStorage(session, key);
  }

  // Always remove legacy/local copies to avoid long-lived storage.
  removeFromStorage(local, key);
};

export const setOperatorAccessToken = (token: string | null) => {
  const session = safeSessionStorage();
  const local = safeLocalStorage();

  if (token) {
    if (session) {
      try {
        session.setItem(ACCESS_TOKEN_KEY, token);
      } catch {
        // swallow storage errors
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

export const clearOperatorAuthTokens = () => {
  const session = safeSessionStorage();
  const local = safeLocalStorage();

  removeFromStorage(session, ACCESS_TOKEN_KEY);
  removeFromStorage(local, ACCESS_TOKEN_KEY);
  removeFromStorage(session, REFRESH_TOKEN_KEY);
  removeFromStorage(local, REFRESH_TOKEN_KEY);

  inMemoryAccessToken = null;
};

export const setPortalAuthToken = (
  token: string | null,
  tokenKey: string = DEFAULT_PORTAL_TOKEN_KEY,
) => {
  writeToSessionStorage(tokenKey, token);
};

export const clearPortalAuthToken = (tokenKey: string = DEFAULT_PORTAL_TOKEN_KEY) => {
  writeToSessionStorage(tokenKey, null);
};

// ---------------------------------------------------------------------------
// Portal token helpers (mirroring headless portalAuth utilities)
// ---------------------------------------------------------------------------

interface GetPortalTokenOptions {
  tokenKey?: string;
  required?: boolean;
  missingTokenMessage?: string;
}

export const getPortalAuthToken = ({
  tokenKey = DEFAULT_PORTAL_TOKEN_KEY,
  required = true,
  missingTokenMessage,
}: GetPortalTokenOptions = {}): string | null => {
  const session = safeSessionStorage();
  const local = safeLocalStorage();

  const token = readFromStorage(session, tokenKey) ?? readFromStorage(local, tokenKey);

  if (!token) {
    if (!required) {
      return null;
    }
    throw new PortalAuthError(
      missingTokenMessage ?? `Missing portal auth token for key "${tokenKey}".`,
    );
  }

  return token;
};

export interface BuildPortalAuthHeadersOptions extends GetPortalTokenOptions {
  headers?: HeadersInit;
  includeJsonContentType?: boolean;
}

export const buildPortalAuthHeaders = ({
  headers,
  includeJsonContentType = true,
  ...tokenOptions
}: BuildPortalAuthHeadersOptions = {}): Headers => {
  const resolvedHeaders = new Headers(headers ?? undefined);
  const token = getPortalAuthToken(tokenOptions);

  if (token) {
    resolvedHeaders.set("Authorization", `Bearer ${token}`);
  }

  if (includeJsonContentType && !resolvedHeaders.has("Content-Type")) {
    resolvedHeaders.set("Content-Type", "application/json");
  }

  return resolvedHeaders;
};

export interface PortalAuthFetchOptions extends BuildPortalAuthHeadersOptions {
  credentials?: RequestCredentials;
}

export const portalAuthFetch = (
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: PortalAuthFetchOptions = {},
): Promise<Response> => {
  const headerOptions: BuildPortalAuthHeadersOptions = {};

  if (typeof options.includeJsonContentType !== "undefined") {
    headerOptions.includeJsonContentType = options.includeJsonContentType;
  }
  if (typeof options.tokenKey !== "undefined") {
    headerOptions.tokenKey = options.tokenKey;
  }
  if (typeof options.required !== "undefined") {
    headerOptions.required = options.required;
  }
  if (typeof options.missingTokenMessage !== "undefined") {
    headerOptions.missingTokenMessage = options.missingTokenMessage;
  }
  if (init.headers) {
    headerOptions.headers = init.headers;
  }

  const headers = buildPortalAuthHeaders(headerOptions);

  const finalInit: RequestInit = {
    ...init,
    headers,
    credentials: options.credentials ?? init.credentials ?? "include",
  };

  return fetch(input, finalInit);
};

export interface CreatePortalFetchDefaults
  extends Omit<PortalAuthFetchOptions, "headers" | "tokenKey"> {}

export const createPortalAuthFetch = (
  tokenKey: string,
  defaults: CreatePortalFetchDefaults = {},
) => {
  return (
    input: RequestInfo | URL,
    init: RequestInit = {},
    options: CreatePortalFetchDefaults = {},
  ): Promise<Response> => {
    return portalAuthFetch(input, init, {
      tokenKey,
      ...defaults,
      ...options,
    });
  };
};
