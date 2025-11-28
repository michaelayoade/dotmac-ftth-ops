/**
 * Token Refresh Interceptor
 *
 * Adds automatic token refresh functionality to axios instances.
 * When a 401 is received, attempts to refresh the token and retry the request.
 */

import { refreshToken } from "./loginService";
import { isAuthBypassEnabled } from "./bypass";

// Axios types - inline definitions for better compatibility across the monorepo
interface AxiosResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: InternalAxiosRequestConfig;
}

interface InternalAxiosRequestConfig {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  data?: unknown;
  _retry?: boolean;
}

interface AxiosError {
  config?: InternalAxiosRequestConfig;
  response?: {
    status: number;
    statusText: string;
    data?: unknown;
  };
  message: string;
}

interface AxiosInstance {
  (config: InternalAxiosRequestConfig): Promise<AxiosResponse>;
  interceptors: {
    response: {
      use: (
        onFulfilled: (response: AxiosResponse) => AxiosResponse,
        onRejected: (error: AxiosError) => Promise<unknown>
      ) => void;
    };
  };
}

// Track if a refresh is in progress to prevent multiple simultaneous refreshes
let isRefreshing = false;
let refreshSubscribers: Array<(success: boolean) => void> = [];

/**
 * Subscribe to the refresh completion.
 */
function subscribeToRefresh(callback: (success: boolean) => void): void {
  refreshSubscribers.push(callback);
}

/**
 * Notify all subscribers about refresh completion.
 */
function onRefreshComplete(success: boolean): void {
  refreshSubscribers.forEach((callback) => callback(success));
  refreshSubscribers = [];
}

/**
 * Setup the token refresh interceptor on an axios instance.
 *
 * @param axiosInstance - The axios instance to add the interceptor to
 * @param onAuthFailure - Callback when auth completely fails (redirect to login)
 */
export function setupRefreshInterceptor(
  axiosInstance: AxiosInstance,
  onAuthFailure?: () => void
): void {
  axiosInstance.interceptors.response.use(
    // Success handler - pass through
    (response) => response,
    // Error handler
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig;

      // Skip in bypass mode
      if (isAuthBypassEnabled()) {
        return Promise.reject(error);
      }

      // Only handle 401 errors
      if (error.response?.status !== 401) {
        return Promise.reject(error);
      }

      // Don't retry if already retried
      if (originalRequest._retry) {
        // Auth completely failed
        if (onAuthFailure) {
          onAuthFailure();
        }
        return Promise.reject(error);
      }

      // Don't retry auth endpoints themselves
      const url = originalRequest.url || "";
      if (
        url.includes("/auth/login") ||
        url.includes("/auth/refresh") ||
        url.includes("/auth/logout")
      ) {
        return Promise.reject(error);
      }

      // Mark as retrying
      originalRequest._retry = true;

      // If refresh is already in progress, wait for it
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeToRefresh((success) => {
            if (success) {
              // Retry the original request
              resolve(axiosInstance(originalRequest));
            } else {
              reject(error);
            }
          });
        });
      }

      // Start refresh
      isRefreshing = true;

      try {
        const success = await refreshToken();

        if (success) {
          onRefreshComplete(true);
          // Retry the original request
          return axiosInstance(originalRequest);
        } else {
          onRefreshComplete(false);
          // Refresh failed - auth is gone
          if (onAuthFailure) {
            onAuthFailure();
          }
          return Promise.reject(error);
        }
      } catch (refreshError) {
        onRefreshComplete(false);
        if (onAuthFailure) {
          onAuthFailure();
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
  );
}

/**
 * Default auth failure handler - redirects to login.
 */
export function defaultAuthFailureHandler(): void {
  if (typeof window === "undefined") {
    return;
  }
  const isLoginPage = window.location.pathname === "/login";
  if (!isLoginPage) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?redirect=${redirect}`;
  }
}
