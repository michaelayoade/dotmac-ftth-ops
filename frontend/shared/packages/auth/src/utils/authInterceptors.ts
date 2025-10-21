/**
 * Authentication Interceptors
 * Provides request/response interceptors for API clients
 */

import type { AuthContextValue } from "../types";

export interface AuthInterceptorConfig {
  auth: AuthContextValue;
  autoRefresh?: boolean;
  redirectOnUnauthorized?: boolean;
  redirectUrl?: string;
}

/**
 * Request interceptor that adds auth headers
 */
export function createAuthRequestInterceptor(config: AuthInterceptorConfig) {
  return async (requestConfig: any) => {
    if (config.auth.isAuthenticated && config.auth.user) {
      // Add auth header if not already present
      if (!requestConfig.headers?.Authorization) {
        const token = getAuthToken();
        if (token) {
          requestConfig.headers = {
            ...requestConfig.headers,
            Authorization: `Bearer ${token}`,
          };
        }
      }

      // Add tenant context if available
      if (config.auth.user.tenantId) {
        requestConfig.headers = {
          ...requestConfig.headers,
          "X-Tenant-ID": config.auth.user.tenantId,
        };
      }

      // Add portal context
      const portalType = detectPortalType();
      requestConfig.headers = {
        ...requestConfig.headers,
        "X-Portal-Type": portalType,
      };
    }

    return requestConfig;
  };
}

/**
 * Response interceptor that handles auth errors
 */
export function createAuthResponseInterceptor(config: AuthInterceptorConfig) {
  return {
    onResponse: (response: any) => response,

    onError: async (error: any) => {
      const { status } = error.response || {};

      if (status === 401) {
        // Token expired or invalid
        if (config.autoRefresh && config.auth.isAuthenticated) {
          try {
            await config.auth.refreshToken();
            // Retry the original request
            return retryRequest(error.config);
          } catch (refreshError) {
            // Refresh failed, logout user
            await config.auth.logout();

            if (config.redirectOnUnauthorized) {
              redirectToLogin(config.redirectUrl);
            }
          }
        } else {
          await config.auth.logout();

          if (config.redirectOnUnauthorized) {
            redirectToLogin(config.redirectUrl);
          }
        }
      } else if (status === 403) {
        // Forbidden - user doesn't have permission
        console.warn("Access forbidden:", error.response?.data?.message);
        // Could emit a permission denied event here
      } else if (status === 429) {
        // Rate limited
        console.warn("Rate limited:", error.response?.data?.message);
      }

      throw error;
    },
  };
}

/**
 * Utility functions
 */

function getAuthToken(): string | null {
  // This should ideally come from the TokenManager
  // For now, check localStorage based on portal type
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

function detectPortalType(): string {
  if (typeof window === "undefined") return "customer";

  const { hostname, port } = window.location;

  // Development port detection
  const devPortMap: Record<string, string> = {
    "3000": "admin",
    "3001": "management",
    "3002": "customer",
    "3003": "reseller",
    "3004": "technician",
  };

  if (devPortMap[port]) {
    return devPortMap[port];
  }

  // Production subdomain detection
  const subdomain = hostname.split(".")[0] || "";
  const subdomainMap: Record<string, string> = {
    admin: "admin",
    manage: "management",
    management: "management",
    my: "customer",
    customer: "customer",
    partner: "reseller",
    reseller: "reseller",
    tech: "technician",
    technician: "technician",
  };

  return subdomainMap[subdomain] || "customer";
}

async function retryRequest(config: any) {
  // This would depend on the actual HTTP client being used
  // For now, return a placeholder
  throw new Error("Retry not implemented");
}

function redirectToLogin(redirectUrl?: string) {
  if (typeof window !== "undefined") {
    const loginUrl = redirectUrl || "/login";
    window.location.href = loginUrl;
  }
}
