import { refreshToken } from "./loginService";
import { defaultAuthFailureHandler } from "./refreshInterceptor";

type FetchInput = RequestInfo | URL;

type FetchOptions = RequestInit & {
  retry?: boolean;
};

/**
 * Minimal fetch wrapper that retries once on 401 via refreshToken() and preserves redirect handling.
 * Uses cookie-based auth; does not attach Authorization headers.
 */
export async function fetchWithAuth(input: FetchInput, init: FetchOptions = {}): Promise<Response> {
  const { retry = true, ...options } = init;
  const response = await fetch(input, {
    ...options,
    credentials: options.credentials ?? "include",
  });

  if (response.status !== 401 || !retry) {
    return response;
  }

  const refreshed = await refreshToken();
  if (!refreshed) {
    defaultAuthFailureHandler();
    return response;
  }

  const retryResponse = await fetch(input, {
    ...options,
    credentials: options.credentials ?? "include",
  });

  if (retryResponse.status === 401) {
    defaultAuthFailureHandler();
  }

  return retryResponse;
}
