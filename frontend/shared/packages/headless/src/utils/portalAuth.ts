/**
 * Shared helpers for performing authenticated portal requests.
 *
 * These utilities centralise how we read portal tokens from browser storage,
 * construct `Authorization` headers, and execute fetch requests with the
 * required credentials.
 */

export const DEFAULT_PORTAL_TOKEN_KEY = "access_token";
export const CUSTOMER_PORTAL_TOKEN_KEY = "customer_access_token";

export class PortalAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string = "PORTAL_AUTH_ERROR",
  ) {
    super(message);
    this.name = "PortalAuthError";
  }
}

interface GetPortalTokenOptions {
  tokenKey?: string;
  required?: boolean;
  missingTokenMessage?: string;
}

const readTokenFromStorage = (tokenKey: string): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const storageReaders: Array<() => string | null> = [
    () => {
      try {
        return window.localStorage.getItem(tokenKey);
      } catch {
        return null;
      }
    },
    () => {
      try {
        return window.sessionStorage.getItem(tokenKey);
      } catch {
        return null;
      }
    },
  ];

  for (const reader of storageReaders) {
    const token = reader();
    if (token) {
      return token;
    }
  }
  return null;
};

export const getPortalAuthToken = ({
  tokenKey = DEFAULT_PORTAL_TOKEN_KEY,
  required = true,
  missingTokenMessage,
}: GetPortalTokenOptions = {}): string | null => {
  const token = readTokenFromStorage(tokenKey);

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
  const headers = buildPortalAuthHeaders({
    headers: init.headers,
    includeJsonContentType: options.includeJsonContentType,
    tokenKey: options.tokenKey,
    required: options.required,
    missingTokenMessage: options.missingTokenMessage,
  });

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
