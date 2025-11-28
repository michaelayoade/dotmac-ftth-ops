/**
 * API Client for making requests to the backend
 *
 * This module provides a configured API client instance for making
 * HTTP requests to the DotMac platform backend.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { platformConfig } from "@/lib/config";
import { setupRefreshInterceptor, defaultAuthFailureHandler } from "@shared/lib/auth";

const DEFAULT_API_PREFIX = "/api/isp/v1/admin";

const resolveBaseUrl = (): string => {
  const base = platformConfig.api.baseUrl;
  const prefix = platformConfig.api.prefix || DEFAULT_API_PREFIX;

  if (base) {
    return `${base}${prefix}`;
  }

  return prefix;
};

const initialBaseUrl = ensureAbsoluteBaseUrl(resolveBaseUrl());

/**
 * Configured axios instance for API requests
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: initialBaseUrl,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Include cookies for authentication
});

// Request interceptor to sync baseURL with runtime config and add tenant headers
apiClient.interceptors.request.use(
  (config) => {
    const resolvedBaseUrl = ensureAbsoluteBaseUrl(resolveBaseUrl());
    config.baseURL = resolvedBaseUrl;
    apiClient.defaults.baseURL = resolvedBaseUrl;

    if (typeof window !== "undefined") {
      // Preserve multi-tenant header from storage (set at login)
      const tenantId = window.localStorage?.getItem("tenant_id");
      if (tenantId && config["headers"]) {
        config["headers"]["X-Tenant-ID"] = tenantId;
      }

      // Add X-Active-Tenant-Id header for partner multi-tenant access
      const activeManagedTenantId = localStorage.getItem("active_managed_tenant_id");
      if (activeManagedTenantId && config["headers"]) {
        config["headers"]["X-Active-Tenant-Id"] = activeManagedTenantId;
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
    if (error["response"]) {
      // Server responded with error status
      const { status, data } = error["response"];

      if (status === 401) {
        if (process.env["NODE_ENV"] !== "production") {
          console.warn("[API Client] 401 Unauthorized", {
            url: error["config"]?.["url"],
            method: error["config"]?.["method"],
          });
        }

        // Unauthorized - redirect to login (but not if already on login page or logging in)
        if (typeof window !== "undefined") {
          const isLoginPage = window.location.pathname === "/login";
          const isLoginRequest = error["config"]?.["url"]?.includes("/auth/login");

          // Only redirect if not already on login page and not a login request
          if (!isLoginPage && !isLoginRequest) {
            window.location.href = "/login";
          }
        }
      }

      // Enhance error with API error details
      error.apiError = {
        status,
        message: data?.["message"] || data?.["detail"] || "An error occurred",
        code: data?.["error"] || data?.["code"],
        details: data?.["details"],
      };
    }

    return Promise.reject(error);
  },
);

setupRefreshInterceptor(apiClient as any, defaultAuthFailureHandler);

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

type LocationLike = {
  origin?: string;
  protocol?: string;
  host?: string;
};

function ensureAbsoluteBaseUrl(url: string): string {
  if (!url || isAbsoluteUrl(url)) {
    return url;
  }

  const origin = getRuntimeOrigin();
  if (!origin) {
    return url;
  }

  try {
    return new URL(url, origin).toString();
  } catch {
    const normalizedOrigin = origin.replace(/\/+$/, "");
    const normalizedUrl = url.startsWith("/") ? url : `/${url}`;
    return `${normalizedOrigin}${normalizedUrl}`;
  }
}

function getRuntimeOrigin(): string | undefined {
  if (typeof window !== "undefined" && window.location) {
    return resolveOrigin(window.location) || "http://localhost";
  }

  const globalLocation = (globalThis as any)?.location as LocationLike | undefined;
  if (globalLocation) {
    return resolveOrigin(globalLocation);
  }

  return undefined;
}

function resolveOrigin(target: LocationLike | undefined): string | undefined {
  if (!target) {
    return undefined;
  }

  if (target.origin) {
    return target.origin;
  }

  if (target.protocol && target.host) {
    return `${target.protocol}//${target.host}`;
  }

  return undefined;
}

function isAbsoluteUrl(url: string): boolean {
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}
