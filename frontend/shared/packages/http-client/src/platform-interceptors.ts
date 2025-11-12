/**
 * Platform-specific interceptors for DotMac Platform Services integration
 */

import type { AxiosRequestConfig, AxiosResponse } from "axios";
import { v4 as uuidv4 } from "uuid";

export interface PlatformInterceptorConfig {
  enableAuditLogging?: boolean;
  enableCorrelationId?: boolean;
  enableServiceRegistry?: boolean;
  platformApiPrefix?: string;
}

export class PlatformInterceptors {
  private config: Required<PlatformInterceptorConfig>;

  constructor(config: PlatformInterceptorConfig = {}) {
    this.config = {
      enableAuditLogging: true,
      enableCorrelationId: true,
      enableServiceRegistry: false,
      platformApiPrefix: "/api",
      ...config,
    };
  }

  /**
   * Request interceptor for platform services integration
   */
  requestInterceptor = (config: AxiosRequestConfig): AxiosRequestConfig => {
    config.headers = config.headers || {};

    // Add correlation ID for request tracing
    if (this.config.enableCorrelationId) {
      const correlationId = uuidv4();
      config.headers["X-Correlation-ID"] = correlationId;

      // Store correlation ID for potential error reporting
      (config as any).__correlationId = correlationId;
    }

    // Add audit context for backend audit trail
    if (this.config.enableAuditLogging) {
      config.headers["X-Audit-Context"] = JSON.stringify({
        component: "frontend",
        user_agent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        method: config.method?.toUpperCase(),
        endpoint: config.url,
      });
    }

    // Add service registry headers for service discovery
    if (this.config.enableServiceRegistry && this.isPlatformServiceRequest(config.url)) {
      config.headers["X-Service-Discovery"] = "enabled";
      config.headers["X-Client-Type"] = "web-frontend";
      config.headers["X-Client-Version"] = process.env["VITE_APP_VERSION"] || "1.0.0";
    }

    // Add request timing for performance monitoring
    (config as any).__requestStartTime = Date.now();

    return config;
  };

  /**
   * Response interceptor for platform services integration
   */
  responseInterceptor = {
    onFulfilled: (response: AxiosResponse): AxiosResponse => {
      // Extract performance metrics
      const startTime = (response.config as any).__requestStartTime;
      if (startTime) {
        const responseTime = Date.now() - startTime;

        // Add to response for potential monitoring
        response.headers["x-response-time"] = responseTime.toString();

        // Log slow requests for monitoring
        if (responseTime > 5000) {
          // 5 seconds
          console.warn(`Slow request detected: ${response.config.url} took ${responseTime}ms`);
        }
      }

      // Handle service registry responses
      if (this.isServiceRegistryResponse(response)) {
        this.handleServiceRegistryResponse(response);
      }

      return response;
    },

    onRejected: async (error: any): Promise<any> => {
      // Extract correlation ID for error reporting
      const correlationId = error.config?.__correlationId;
      if (correlationId) {
        error.correlationId = correlationId;
      }

      // Add platform context to errors
      if (error.response) {
        error.platformContext = {
          status: error.response.status,
          endpoint: error.config?.url,
          method: error.config?.method?.toUpperCase(),
          timestamp: new Date().toISOString(),
          correlationId,
        };
      }

      // Handle distributed lock conflicts
      if (error.response?.status === 423) {
        // Locked
        error.isLockConflict = true;
        error.lockInfo = error.response.data?.lock_info;
      }

      // Handle rate limiting
      if (error.response?.status === 429) {
        // Too Many Requests
        error.rateLimitInfo = {
          retryAfter: error.response.headers["retry-after"],
          limit: error.response.headers["x-ratelimit-limit"],
          remaining: error.response.headers["x-ratelimit-remaining"],
          reset: error.response.headers["x-ratelimit-reset"],
        };
      }

      return Promise.reject(error);
    },
  };

  private isPlatformServiceRequest(url?: string): boolean {
    if (!url) return false;

    const platformEndpoints = [
      "/service-registry",
      "/audit-trail",
      "/distributed-locks",
      "/auth",
      "/tenant",
    ];

    return platformEndpoints.some((endpoint) =>
      url.includes(`${this.config.platformApiPrefix}${endpoint}`),
    );
  }

  private isServiceRegistryResponse(response: AxiosResponse): boolean {
    return response.config.url?.includes("/service-registry") ?? false;
  }

  private handleServiceRegistryResponse(response: AxiosResponse): void {
    // Extract service health information for client-side caching
    if (response.data?.services) {
      const healthyServices = response.data.services.filter(
        (service: any) => service.status === "healthy",
      );

      // Store healthy services in sessionStorage for client-side load balancing
      sessionStorage.setItem(
        "dotmac:healthy-services",
        JSON.stringify({
          services: healthyServices,
          updatedAt: Date.now(),
        }),
      );
    }
  }
}

/**
 * Factory function to create platform interceptors
 */
export function createPlatformInterceptors(
  config?: PlatformInterceptorConfig,
): PlatformInterceptors {
  return new PlatformInterceptors(config);
}

/**
 * Utility to add platform interceptors to an existing HTTP client
 */
export function addPlatformInterceptors(httpClient: any, config?: PlatformInterceptorConfig): void {
  const interceptors = createPlatformInterceptors(config);

  // Add request interceptor
  httpClient.axiosInstance.interceptors.request.use(interceptors.requestInterceptor, (error: any) =>
    Promise.reject(error),
  );

  // Add response interceptor
  httpClient.axiosInstance.interceptors.response.use(
    interceptors.responseInterceptor.onFulfilled,
    interceptors.responseInterceptor.onRejected,
  );
}
