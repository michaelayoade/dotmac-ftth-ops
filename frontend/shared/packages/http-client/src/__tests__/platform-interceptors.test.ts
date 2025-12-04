/**
 * @jest-environment jsdom
 */

import { v4 as uuidv4 } from "uuid";
import {
  PlatformInterceptors,
  createPlatformInterceptors,
  addPlatformInterceptors,
} from "../platform-interceptors";
import type { AxiosRequestConfig, AxiosResponse } from "axios";

// Mock uuid
jest.mock("uuid", () => ({
  v4: jest.fn(),
}));

const mockUuidv4 = uuidv4 as jest.MockedFunction<typeof uuidv4>;

describe("PlatformInterceptors", () => {
  const originalNavigator = global.navigator;
  const originalProcess = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUuidv4.mockReturnValue("test-correlation-id-123");
    sessionStorage.clear();

    // Mock navigator.userAgent
    Object.defineProperty(global, "navigator", {
      value: { userAgent: "test-user-agent" },
      writable: true,
    });

    // Mock window.location
    Object.defineProperty(window, "location", {
      value: { href: "http://localhost:3000/test" },
      writable: true,
    });

    // Mock process.env
    process.env = { ...originalProcess, VITE_APP_VERSION: "2.0.0" };
  });

  afterEach(() => {
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
    });
    process.env = originalProcess;
  });

  describe("constructor", () => {
    it("creates interceptor with default configuration", () => {
      const interceptor = new PlatformInterceptors();
      expect(interceptor).toBeInstanceOf(PlatformInterceptors);
    });

    it("creates interceptor with custom configuration", () => {
      const interceptor = new PlatformInterceptors({
        enableAuditLogging: false,
        enableCorrelationId: false,
        enableServiceRegistry: true,
        platformApiPrefix: "/v2/api",
      });
      expect(interceptor).toBeInstanceOf(PlatformInterceptors);
    });

    it("merges custom config with defaults", () => {
      const interceptor = new PlatformInterceptors({
        enableAuditLogging: false,
      });

      // Test via request behavior
      const config: AxiosRequestConfig = { url: "/test", headers: {} };
      const result = interceptor.requestInterceptor(config);

      // Should still add correlation ID (default enabled)
      expect(result.headers?.["X-Correlation-ID"]).toBe("test-correlation-id-123");
      // Should not add audit context (disabled)
      expect(result.headers?.["X-Audit-Context"]).toBeUndefined();
    });
  });

  describe("requestInterceptor", () => {
    describe("correlation ID", () => {
      it("adds correlation ID header when enabled", () => {
        const interceptor = new PlatformInterceptors();
        const config: AxiosRequestConfig = { url: "/test", headers: {} };

        const result = interceptor.requestInterceptor(config);

        expect(result.headers?.["X-Correlation-ID"]).toBe("test-correlation-id-123");
        expect(mockUuidv4).toHaveBeenCalled();
      });

      it("stores correlation ID in config for error reporting", () => {
        const interceptor = new PlatformInterceptors();
        const config: AxiosRequestConfig = { url: "/test", headers: {} };

        const result = interceptor.requestInterceptor(config);

        expect((result as any).__correlationId).toBe("test-correlation-id-123");
      });

      it("does not add correlation ID when disabled", () => {
        const interceptor = new PlatformInterceptors({ enableCorrelationId: false });
        const config: AxiosRequestConfig = { url: "/test", headers: {} };

        const result = interceptor.requestInterceptor(config);

        expect(result.headers?.["X-Correlation-ID"]).toBeUndefined();
        expect(mockUuidv4).not.toHaveBeenCalled();
      });
    });

    describe("audit logging", () => {
      it("adds audit context header when enabled", () => {
        const interceptor = new PlatformInterceptors();
        const config: AxiosRequestConfig = {
          url: "/users",
          method: "POST",
          headers: {},
        };

        const result = interceptor.requestInterceptor(config);

        expect(result.headers?.["X-Audit-Context"]).toBeDefined();
        const auditContext = JSON.parse(result.headers?.["X-Audit-Context"] as string);
        expect(auditContext.component).toBe("frontend");
        expect(auditContext.user_agent).toBe("test-user-agent");
        expect(auditContext.method).toBe("POST");
        expect(auditContext.endpoint).toBe("/users");
        expect(auditContext.url).toBe("http://localhost:3000/test");
        expect(auditContext.timestamp).toBeDefined();
      });

      it("does not add audit context when disabled", () => {
        const interceptor = new PlatformInterceptors({ enableAuditLogging: false });
        const config: AxiosRequestConfig = { url: "/test", headers: {} };

        const result = interceptor.requestInterceptor(config);

        expect(result.headers?.["X-Audit-Context"]).toBeUndefined();
      });
    });

    describe("service registry", () => {
      it("adds service discovery headers for platform endpoints", () => {
        const interceptor = new PlatformInterceptors({
          enableServiceRegistry: true,
        });
        const config: AxiosRequestConfig = {
          url: "/api/service-registry/health",
          headers: {},
        };

        const result = interceptor.requestInterceptor(config);

        expect(result.headers?.["X-Service-Discovery"]).toBe("enabled");
        expect(result.headers?.["X-Client-Type"]).toBe("web-frontend");
        expect(result.headers?.["X-Client-Version"]).toBe("2.0.0");
      });

      it("recognizes various platform endpoints", () => {
        const interceptor = new PlatformInterceptors({
          enableServiceRegistry: true,
        });

        const platformEndpoints = [
          "/api/service-registry",
          "/api/audit-trail",
          "/api/distributed-locks",
          "/api/auth",
          "/api/tenant",
        ];

        platformEndpoints.forEach((endpoint) => {
          const config: AxiosRequestConfig = { url: endpoint, headers: {} };
          const result = interceptor.requestInterceptor(config);
          expect(result.headers?.["X-Service-Discovery"]).toBe("enabled");
        });
      });

      it("does not add service headers for non-platform endpoints", () => {
        const interceptor = new PlatformInterceptors({
          enableServiceRegistry: true,
        });
        const config: AxiosRequestConfig = {
          url: "/api/users",
          headers: {},
        };

        const result = interceptor.requestInterceptor(config);

        expect(result.headers?.["X-Service-Discovery"]).toBeUndefined();
      });

      it("uses custom platformApiPrefix", () => {
        const interceptor = new PlatformInterceptors({
          enableServiceRegistry: true,
          platformApiPrefix: "/v2",
        });

        const config: AxiosRequestConfig = {
          url: "/v2/service-registry/health",
          headers: {},
        };

        const result = interceptor.requestInterceptor(config);

        expect(result.headers?.["X-Service-Discovery"]).toBe("enabled");
      });

      it("does not add service headers when disabled", () => {
        const interceptor = new PlatformInterceptors({
          enableServiceRegistry: false,
        });
        const config: AxiosRequestConfig = {
          url: "/api/service-registry",
          headers: {},
        };

        const result = interceptor.requestInterceptor(config);

        expect(result.headers?.["X-Service-Discovery"]).toBeUndefined();
      });

      it("uses default version when VITE_APP_VERSION not set", () => {
        delete process.env.VITE_APP_VERSION;
        const interceptor = new PlatformInterceptors({
          enableServiceRegistry: true,
        });
        const config: AxiosRequestConfig = {
          url: "/api/service-registry",
          headers: {},
        };

        const result = interceptor.requestInterceptor(config);

        expect(result.headers?.["X-Client-Version"]).toBe("1.0.0");
      });
    });

    describe("request timing", () => {
      it("adds request start time for performance tracking", () => {
        const interceptor = new PlatformInterceptors();
        const config: AxiosRequestConfig = { url: "/test", headers: {} };

        const beforeTime = Date.now();
        const result = interceptor.requestInterceptor(config);
        const afterTime = Date.now();

        const startTime = (result as any).__requestStartTime;
        expect(startTime).toBeGreaterThanOrEqual(beforeTime);
        expect(startTime).toBeLessThanOrEqual(afterTime);
      });
    });

    it("initializes headers object if not present", () => {
      const interceptor = new PlatformInterceptors();
      const config: AxiosRequestConfig = { url: "/test" };

      const result = interceptor.requestInterceptor(config);

      expect(result.headers).toBeDefined();
      expect(result.headers?.["X-Correlation-ID"]).toBeDefined();
    });
  });

  describe("responseInterceptor", () => {
    describe("onFulfilled", () => {
      it("calculates and adds response time header", () => {
        const interceptor = new PlatformInterceptors();
        const response = {
          data: {},
          status: 200,
          statusText: "OK",
          headers: {},
          config: {
            __requestStartTime: Date.now() - 100,
            url: "/test",
          },
        } as AxiosResponse;

        const result = interceptor.responseInterceptor.onFulfilled(response);

        expect(parseInt(result.headers["x-response-time"])).toBeGreaterThanOrEqual(100);
      });

      it("logs slow requests (> 5 seconds)", () => {
        const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
        const interceptor = new PlatformInterceptors();
        const response = {
          data: {},
          status: 200,
          statusText: "OK",
          headers: {},
          config: {
            __requestStartTime: Date.now() - 6000, // 6 seconds ago
            url: "/slow-endpoint",
          },
        } as AxiosResponse;

        interceptor.responseInterceptor.onFulfilled(response);

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("Slow request detected")
        );
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("/slow-endpoint")
        );

        consoleSpy.mockRestore();
      });

      it("does not log normal speed requests", () => {
        const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
        const interceptor = new PlatformInterceptors();
        const response = {
          data: {},
          status: 200,
          statusText: "OK",
          headers: {},
          config: {
            __requestStartTime: Date.now() - 100, // 100ms ago
            url: "/fast-endpoint",
          },
        } as AxiosResponse;

        interceptor.responseInterceptor.onFulfilled(response);

        expect(consoleSpy).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it("handles service registry responses", () => {
        const interceptor = new PlatformInterceptors();
        const response = {
          data: {
            services: [
              { name: "service-a", status: "healthy" },
              { name: "service-b", status: "unhealthy" },
              { name: "service-c", status: "healthy" },
            ],
          },
          status: 200,
          statusText: "OK",
          headers: {},
          config: {
            url: "/api/service-registry/health",
            __requestStartTime: Date.now(),
          },
        } as AxiosResponse;

        interceptor.responseInterceptor.onFulfilled(response);

        const stored = JSON.parse(sessionStorage.getItem("dotmac:healthy-services") || "{}");
        expect(stored.services).toHaveLength(2);
        expect(stored.services.map((s: any) => s.name)).toEqual(["service-a", "service-c"]);
        expect(stored.updatedAt).toBeDefined();
      });

      it("handles missing __requestStartTime gracefully", () => {
        const interceptor = new PlatformInterceptors();
        const response = {
          data: {},
          status: 200,
          statusText: "OK",
          headers: {},
          config: {
            url: "/test",
          },
        } as AxiosResponse;

        const result = interceptor.responseInterceptor.onFulfilled(response);

        expect(result.headers["x-response-time"]).toBeUndefined();
      });
    });

    describe("onRejected", () => {
      it("adds correlation ID to error", async () => {
        const interceptor = new PlatformInterceptors();
        const error = {
          config: { __correlationId: "error-correlation-id" },
          response: { status: 500 },
        };

        await expect(interceptor.responseInterceptor.onRejected(error)).rejects.toMatchObject({
          correlationId: "error-correlation-id",
        });
      });

      it("adds platform context to errors with response", async () => {
        const interceptor = new PlatformInterceptors();
        const error = {
          config: {
            __correlationId: "context-correlation-id",
            url: "/api/users",
            method: "post",
          },
          response: { status: 400 },
        };

        await expect(interceptor.responseInterceptor.onRejected(error)).rejects.toMatchObject({
          platformContext: {
            status: 400,
            endpoint: "/api/users",
            method: "POST",
            correlationId: "context-correlation-id",
          },
        });
      });

      it("handles 423 Locked errors", async () => {
        const interceptor = new PlatformInterceptors();
        const error = {
          config: { url: "/api/resource" },
          response: {
            status: 423,
            data: {
              lock_info: {
                locked_by: "user-123",
                locked_at: "2024-01-01T00:00:00Z",
              },
            },
          },
        };

        await expect(interceptor.responseInterceptor.onRejected(error)).rejects.toMatchObject({
          isLockConflict: true,
          lockInfo: {
            locked_by: "user-123",
            locked_at: "2024-01-01T00:00:00Z",
          },
        });
      });

      it("handles 429 Rate Limit errors", async () => {
        const interceptor = new PlatformInterceptors();
        const error = {
          config: { url: "/api/resource" },
          response: {
            status: 429,
            headers: {
              "retry-after": "30",
              "x-ratelimit-limit": "100",
              "x-ratelimit-remaining": "0",
              "x-ratelimit-reset": "1640000000",
            },
          },
        };

        await expect(interceptor.responseInterceptor.onRejected(error)).rejects.toMatchObject({
          rateLimitInfo: {
            retryAfter: "30",
            limit: "100",
            remaining: "0",
            reset: "1640000000",
          },
        });
      });

      it("handles errors without response", async () => {
        const interceptor = new PlatformInterceptors();
        const error = {
          config: { __correlationId: "network-error-id" },
          message: "Network Error",
        };

        await expect(interceptor.responseInterceptor.onRejected(error)).rejects.toMatchObject({
          correlationId: "network-error-id",
          message: "Network Error",
        });
      });

      it("handles errors without config", async () => {
        const interceptor = new PlatformInterceptors();
        const error = {
          response: { status: 500 },
          message: "Server Error",
        };

        await expect(interceptor.responseInterceptor.onRejected(error)).rejects.toMatchObject({
          message: "Server Error",
        });
      });
    });
  });

  describe("createPlatformInterceptors()", () => {
    it("creates interceptor with default config", () => {
      const interceptor = createPlatformInterceptors();
      expect(interceptor).toBeInstanceOf(PlatformInterceptors);
    });

    it("creates interceptor with custom config", () => {
      const interceptor = createPlatformInterceptors({
        enableAuditLogging: false,
      });
      expect(interceptor).toBeInstanceOf(PlatformInterceptors);
    });
  });

  describe("addPlatformInterceptors()", () => {
    it("adds request and response interceptors to http client", () => {
      const mockHttpClient = {
        axiosInstance: {
          interceptors: {
            request: { use: jest.fn() },
            response: { use: jest.fn() },
          },
        },
      };

      addPlatformInterceptors(mockHttpClient);

      expect(mockHttpClient.axiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockHttpClient.axiosInstance.interceptors.response.use).toHaveBeenCalled();
    });

    it("passes custom config to interceptors", () => {
      const mockHttpClient = {
        axiosInstance: {
          interceptors: {
            request: { use: jest.fn() },
            response: { use: jest.fn() },
          },
        },
      };

      addPlatformInterceptors(mockHttpClient, {
        enableAuditLogging: false,
        enableCorrelationId: false,
      });

      // Verify that request interceptor was added
      expect(mockHttpClient.axiosInstance.interceptors.request.use).toHaveBeenCalled();

      // Get the request interceptor function
      const requestInterceptor = mockHttpClient.axiosInstance.interceptors.request.use.mock.calls[0][0];

      // Test that custom config was applied
      const config: AxiosRequestConfig = { url: "/test", headers: {} };
      const result = requestInterceptor(config);

      expect(result.headers?.["X-Correlation-ID"]).toBeUndefined();
      expect(result.headers?.["X-Audit-Context"]).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("handles URL with null/undefined", () => {
      const interceptor = new PlatformInterceptors({
        enableServiceRegistry: true,
      });
      const config: AxiosRequestConfig = { url: undefined, headers: {} };

      const result = interceptor.requestInterceptor(config);

      // Should not throw, should not add service registry headers
      expect(result.headers?.["X-Service-Discovery"]).toBeUndefined();
    });

    it("handles service registry response without services array", () => {
      const interceptor = new PlatformInterceptors();
      const response = {
        data: {},
        status: 200,
        statusText: "OK",
        headers: {},
        config: {
          url: "/api/service-registry/health",
          __requestStartTime: Date.now(),
        },
      } as AxiosResponse;

      // Should not throw
      interceptor.responseInterceptor.onFulfilled(response);

      expect(sessionStorage.getItem("dotmac:healthy-services")).toBeNull();
    });

    it("preserves existing headers", () => {
      const interceptor = new PlatformInterceptors();
      const config: AxiosRequestConfig = {
        url: "/test",
        headers: {
          "Existing-Header": "value",
          Authorization: "Bearer token",
        },
      };

      const result = interceptor.requestInterceptor(config);

      expect(result.headers?.["Existing-Header"]).toBe("value");
      expect(result.headers?.["Authorization"]).toBe("Bearer token");
      expect(result.headers?.["X-Correlation-ID"]).toBeDefined();
    });
  });
});
