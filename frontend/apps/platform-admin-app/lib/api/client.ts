/**
 * API Client for making requests to the backend
 *
 * This module provides a configured API client instance for making
 * HTTP requests to the DotMac platform backend.
 */

import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosAdapter,
  InternalAxiosRequestConfig,
} from "axios";
import { getOperatorAccessToken } from "../../../../shared/utils/operatorAuth";
import { resolveTenantId } from "../../../../shared/utils/jwtUtils";
import { platformConfig } from "@/lib/config";

const DEFAULT_API_PREFIX = "/api/v1";

const resolveBaseUrl = (): string => {
  const base = platformConfig.api.baseUrl;
  const prefix = platformConfig.api.prefix || DEFAULT_API_PREFIX;

  if (base) {
    return `${base}${prefix}`;
  }

  return prefix;
};

/**
 * Configured axios instance for API requests
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: resolveBaseUrl(),
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Include cookies for authentication
});

// Request interceptor to add auth token and tenant ID if available
apiClient.interceptors.request.use(
  (config) => {
    if (!config.baseURL) {
      config.baseURL = resolveBaseUrl();
    }

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
function createFetchAdapter(): AxiosAdapter {
  return async (config: InternalAxiosRequestConfig) => {
    const method = (config.method || "get").toUpperCase();
    const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
    const urlPath = config.url || "";
    let targetUrl: URL;

    if (config.baseURL && config.baseURL.length > 0) {
      if (/^https?:\/\//i.test(config.baseURL)) {
        targetUrl = new URL(urlPath, config.baseURL);
      } else {
        const normalizedBase = config.baseURL.startsWith("/")
          ? config.baseURL
          : `/${config.baseURL}`;
        const normalizedPath = urlPath.startsWith("/") ? urlPath.substring(1) : urlPath;
        const combined = `${normalizedBase.replace(/\/+$/, "")}/${normalizedPath}`;
        targetUrl = new URL(combined, origin);
      }
    } else {
      targetUrl = new URL(urlPath, origin);
    }

    const headers = new Headers();
    Object.entries(config.headers || {}).forEach(([key, value]) => {
      if (value !== undefined) {
        headers.set(key, String(value));
      }
    });

    let body = config.data;
    if (body && typeof body === "object" && !(body instanceof FormData) && !(body instanceof Blob)) {
      body = JSON.stringify(body);
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
    }

    const testNativeFetch =
      (globalThis as typeof globalThis & { __JEST_NATIVE_FETCH__?: typeof fetch }).__JEST_NATIVE_FETCH__;
    const fetchImpl = testNativeFetch || fetch;
    const requestBody =
      method === "GET" || method === "HEAD" ? null : ((body ?? null) as BodyInit | null);

    const response = await fetchImpl(targetUrl, {
      method,
      headers,
      body: requestBody,
      credentials: config.withCredentials ? "include" : "same-origin",
    });

    const responseText = await response.text();
    const responseHeaders = Object.fromEntries(response.headers.entries());
    const contentType = response.headers.get("content-type") || "";
    let parsedData: unknown = responseText;
    if (contentType.includes("application/json")) {
      try {
        parsedData = responseText ? JSON.parse(responseText) : null;
      } catch {
        parsedData = responseText;
      }
    }

    const axiosResponse = {
      data: parsedData,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      config,
      request: {},
    };

    const validateStatus =
      config.validateStatus || ((status: number) => status >= 200 && status < 300);

    if (validateStatus(response.status)) {
      return axiosResponse;
    }

    throw new AxiosError(
      `Request failed with status code ${response.status}`,
      undefined,
      config,
      undefined,
      axiosResponse,
    );
  };
}

if (typeof process !== "undefined" && process.env["JEST_WORKER_ID"]) {
  apiClient.defaults.adapter = createFetchAdapter();
}
