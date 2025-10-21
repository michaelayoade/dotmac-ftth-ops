/**
 * Authenticated API Hook
 * Integrates auth with the existing headless API client
 */

import { useCallback } from "react";
import { useAuth } from "../AuthProvider";

export interface AuthenticatedApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  data?: any;
  requireAuth?: boolean;
  headers?: Record<string, string>;
}

/**
 * Hook that provides an authenticated API client
 * Automatically includes auth headers and handles token refresh
 */
export function useAuthenticatedApi() {
  const { isAuthenticated, refreshToken, logout } = useAuth();

  const makeRequest = useCallback(
    async <T = any>(url: string, options: AuthenticatedApiOptions = {}): Promise<T> => {
      const { requireAuth = true, headers = {}, method = "GET", data } = options;

      // Check if authentication is required
      if (requireAuth && !isAuthenticated) {
        throw new Error("Authentication required");
      }

      // Merge headers with auth token
      const authHeaders = isAuthenticated
        ? { Authorization: `Bearer ${getTokenFromStorage()}` }
        : {};

      const finalOptions: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
          ...headers,
        },
        ...(data && { body: JSON.stringify(data) }),
      };

      try {
        const response = await fetch(url, finalOptions);

        if (!response.ok) {
          if (response.status === 401 && isAuthenticated) {
            // Try to refresh token
            try {
              await refreshToken();
              // Retry with new token
              const retryOptions: RequestInit = {
                ...finalOptions,
                headers: {
                  ...finalOptions.headers,
                  Authorization: `Bearer ${getTokenFromStorage()}`,
                },
              };
              const retryResponse = await fetch(url, retryOptions);
              if (!retryResponse.ok) {
                throw new Error(`HTTP ${retryResponse.status}: ${retryResponse.statusText}`);
              }
              return await retryResponse.json();
            } catch (refreshError) {
              // Refresh failed, logout user
              await logout();
              throw new Error("Session expired. Please login again.");
            }
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } catch (error: any) {
        throw error;
      }
    },
    [isAuthenticated, refreshToken, logout],
  );

  const get = useCallback(
    <T = any>(url: string, options?: AuthenticatedApiOptions) =>
      makeRequest<T>(url, { ...options, method: "GET" }),
    [makeRequest],
  );

  const post = useCallback(
    <T = any>(url: string, data?: any, options?: AuthenticatedApiOptions) =>
      makeRequest<T>(url, { ...options, method: "POST", data }),
    [makeRequest],
  );

  const put = useCallback(
    <T = any>(url: string, data?: any, options?: AuthenticatedApiOptions) =>
      makeRequest<T>(url, { ...options, method: "PUT", data }),
    [makeRequest],
  );

  const patch = useCallback(
    <T = any>(url: string, data?: any, options?: AuthenticatedApiOptions) =>
      makeRequest<T>(url, { ...options, method: "PATCH", data }),
    [makeRequest],
  );

  const del = useCallback(
    <T = any>(url: string, options?: AuthenticatedApiOptions) =>
      makeRequest<T>(url, { ...options, method: "DELETE" }),
    [makeRequest],
  );

  return {
    request: makeRequest,
    get,
    post,
    put,
    patch,
    delete: del,
    isAuthenticated,
  };
}

// Helper to get token from storage (implementation depends on auth provider variant)
function getTokenFromStorage(): string | null {
  // This would be better handled by the TokenManager in each provider
  // For now, try different storage locations based on portal type
  const portals = ["admin", "customer", "reseller", "technician", "management"];

  for (const portal of portals) {
    const token =
      localStorage.getItem(`simple_auth_${portal}_token`) ||
      localStorage.getItem(`secure_auth_${portal}_token`) ||
      localStorage.getItem(`enterprise_auth_${portal}_token`);
    if (token) return token;
  }

  return null;
}
