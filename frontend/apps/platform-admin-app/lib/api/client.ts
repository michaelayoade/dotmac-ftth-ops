/**
 * API Client for making requests to the backend
 *
 * This module provides a configured API client instance for making
 * HTTP requests to the DotMac platform backend.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { getOperatorAccessToken } from "../../../../shared/utils/operatorAuth";
import { resolveTenantId } from "../../../../shared/utils/jwtUtils";
import { platformConfig } from "@/lib/config";

const API_PREFIX = platformConfig.api.prefix || "/api/v1";
const BASE_URL = platformConfig.api.baseUrl
  ? `${platformConfig.api.baseUrl}${API_PREFIX}`
  : API_PREFIX || "/api/v1";

/**
 * Configured axios instance for API requests
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Include cookies for authentication
});

// Request interceptor to add auth token and tenant ID if available
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const accessToken = getOperatorAccessToken();

      // Add Authorization header
      if (accessToken && config.headers && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }

      // Resolve tenant ID from JWT token (production) or fallback to storage (dev)
      // Platform admins may set X-Target-Tenant-ID for cross-tenant management
      // In development, you can manually set localStorage.setItem('tenant_id', 'default-isp')
      const tenantId = resolveTenantId(accessToken);

      if (tenantId && config.headers) {
        config.headers["X-Tenant-ID"] = tenantId;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;

      if (status === 401) {
        // DEBUG: Log 401 errors to understand what's failing
        const debugContext: Record<string, unknown> = {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
          responseData: data,
        };

        if (typeof document !== "undefined") {
          debugContext['cookies'] = document.cookie;
        }

        console.error("[API Client] 401 Unauthorized:", debugContext);

        // Unauthorized - redirect to login (but not if already on login page or logging in)
        if (typeof window !== "undefined") {
          const isLoginPage = window.location.pathname === "/login";
          const isLoginRequest = error.config?.url?.includes("/auth/login");

          // Only redirect if not already on login page and not a login request
          if (!isLoginPage && !isLoginRequest) {
            console.error("[API Client] Redirecting to login due to 401");
            window.location.href = "/login";
          }
        }
      }

      // Enhance error with API error details
      error.apiError = {
        status,
        message: data?.message || data?.detail || "An error occurred",
        code: data?.error || data?.code,
        details: data?.details,
      };
    }

    return Promise.reject(error);
  },
);

/**
 * Generic GET request
 */
export async function get<T = any>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  return apiClient.get<T>(url, config);
}

/**
 * Generic POST request
 */
export async function post<T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  return apiClient.post<T>(url, data, config);
}

/**
 * Generic PUT request
 */
export async function put<T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  return apiClient.put<T>(url, data, config);
}

/**
 * Generic PATCH request
 */
export async function patch<T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  return apiClient.patch<T>(url, data, config);
}

/**
 * Generic DELETE request
 */
export async function del<T = any>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  return apiClient.delete<T>(url, config);
}

export default apiClient;
