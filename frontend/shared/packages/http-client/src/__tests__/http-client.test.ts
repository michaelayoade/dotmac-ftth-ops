/**
 * @jest-environment node
 */

import axios from "axios";
import { HttpClient } from "../http-client";
import { TenantResolver } from "../tenant-resolver";
import { ErrorNormalizer } from "../error-normalizer";
import type { ApiResponse } from "../types";

// Mock axios
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock TenantResolver
jest.mock("../tenant-resolver", () => ({
  TenantResolver: {
    fromHostname: jest.fn(),
    fromConfig: jest.fn(),
  },
}));

describe("HttpClient", () => {
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock axios instance
    mockAxiosInstance = {
      request: jest.fn(),
      interceptors: {
        request: {
          use: jest.fn(),
        },
        response: {
          use: jest.fn(),
        },
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);
  });

  describe("constructor", () => {
    it("creates HttpClient with default configuration", () => {
      const client = new HttpClient();

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: "",
        timeout: 30000,
        headers: {
          "Content-Type": "application/json",
        },
      });
    });

    it("creates HttpClient with custom configuration", () => {
      const client = new HttpClient({
        baseURL: "https://api.example.com",
        timeout: 60000,
        retries: 5,
        retryDelay: 2000,
      });

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: "https://api.example.com",
        timeout: 60000,
        headers: {
          "Content-Type": "application/json",
        },
      });
    });

    it("sets up request and response interceptors", () => {
      const client = new HttpClient();

      // Request interceptor for tenant ID
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      // Response interceptor for error normalization
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe("static factory methods", () => {
    it("HttpClient.create() creates new instance", () => {
      const client = HttpClient.create({ baseURL: "https://api.test.com" });

      expect(client).toBeInstanceOf(HttpClient);
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: "https://api.test.com",
        })
      );
    });

    it("HttpClient.createWithTenant() creates instance with tenant ID", () => {
      const mockResolver = { getTenantId: jest.fn().mockReturnValue("tenant-123") };
      (TenantResolver.fromConfig as jest.Mock).mockReturnValue(mockResolver);

      const client = HttpClient.createWithTenant("tenant-123", { baseURL: "https://api.test.com" });

      expect(client).toBeInstanceOf(HttpClient);
      expect(TenantResolver.fromConfig).toHaveBeenCalledWith("tenant-123");
    });

    it("HttpClient.createFromHostname() creates instance with hostname resolver", () => {
      const mockResolver = { getTenantId: jest.fn().mockReturnValue("subdomain-tenant") };
      (TenantResolver.fromHostname as jest.Mock).mockReturnValue(mockResolver);

      const client = HttpClient.createFromHostname({ baseURL: "https://api.test.com" });

      expect(client).toBeInstanceOf(HttpClient);
      expect(TenantResolver.fromHostname).toHaveBeenCalled();
    });

    it("HttpClient.createWithAuth() creates instance with auth enabled", () => {
      const client = HttpClient.createWithAuth(
        { tokenSource: "localStorage", tokenKey: "auth_token" },
        { baseURL: "https://api.test.com" }
      );

      expect(client).toBeInstanceOf(HttpClient);
      // Auth interceptor should add additional interceptors
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledTimes(2);
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledTimes(2);
    });
  });

  describe("setTenantResolver()", () => {
    it("sets custom tenant resolver", () => {
      const client = new HttpClient();
      const mockResolver = { getTenantId: jest.fn().mockReturnValue("custom-tenant") } as unknown as TenantResolver;

      const result = client.setTenantResolver(mockResolver);

      expect(result).toBe(client); // Returns this for chaining
      expect(client.getCurrentTenantId()).toBe("custom-tenant");
    });
  });

  describe("setTenantFromHostname()", () => {
    it("sets tenant resolver from hostname", () => {
      const mockResolver = { getTenantId: jest.fn().mockReturnValue("hostname-tenant") };
      (TenantResolver.fromHostname as jest.Mock).mockReturnValue(mockResolver);

      const client = new HttpClient();
      const result = client.setTenantFromHostname();

      expect(result).toBe(client);
      expect(TenantResolver.fromHostname).toHaveBeenCalled();
      expect(client.getCurrentTenantId()).toBe("hostname-tenant");
    });
  });

  describe("setTenantId()", () => {
    it("sets tenant ID directly", () => {
      const mockResolver = { getTenantId: jest.fn().mockReturnValue("direct-tenant") };
      (TenantResolver.fromConfig as jest.Mock).mockReturnValue(mockResolver);

      const client = new HttpClient();
      const result = client.setTenantId("direct-tenant");

      expect(result).toBe(client);
      expect(TenantResolver.fromConfig).toHaveBeenCalledWith("direct-tenant");
      expect(client.getCurrentTenantId()).toBe("direct-tenant");
    });
  });

  describe("enableAuth()", () => {
    it("enables authentication with default config", () => {
      const client = new HttpClient();
      const result = client.enableAuth();

      expect(result).toBe(client);
      // Should add auth request and response interceptors
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledTimes(2);
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledTimes(2);
    });

    it("enables authentication with custom config", () => {
      const client = new HttpClient();
      client.enableAuth({
        tokenSource: "localStorage",
        tokenKey: "custom_token",
        headerPrefix: "Token",
      });

      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledTimes(2);
    });
  });

  describe("HTTP methods", () => {
    describe("get()", () => {
      it("makes GET request successfully", async () => {
        const responseData = { id: 1, name: "Test" };
        mockAxiosInstance.request.mockResolvedValueOnce({
          data: responseData,
          status: 200,
        });

        const client = new HttpClient();
        const result = await client.get<typeof responseData>("/users/1");

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: "get",
          url: "/users/1",
          data: undefined,
        });
        expect(result).toEqual({
          data: responseData,
          success: true,
          message: "Request successful",
        });
      });

      it("makes GET request with query params", async () => {
        mockAxiosInstance.request.mockResolvedValueOnce({
          data: [{ id: 1 }],
          status: 200,
        });

        const client = new HttpClient();
        await client.get("/users", { params: { page: 1, limit: 10 } });

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: "get",
          url: "/users",
          data: undefined,
          params: { page: 1, limit: 10 },
        });
      });

      it("makes GET request with custom headers", async () => {
        mockAxiosInstance.request.mockResolvedValueOnce({
          data: {},
          status: 200,
        });

        const client = new HttpClient();
        await client.get("/users", { headers: { "X-Custom-Header": "value" } });

        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
          expect.objectContaining({
            headers: { "X-Custom-Header": "value" },
          })
        );
      });
    });

    describe("post()", () => {
      it("makes POST request with data", async () => {
        const requestData = { name: "New User", email: "user@test.com" };
        const responseData = { id: 1, ...requestData };
        mockAxiosInstance.request.mockResolvedValueOnce({
          data: responseData,
          status: 201,
        });

        const client = new HttpClient();
        const result = await client.post("/users", requestData);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: "post",
          url: "/users",
          data: requestData,
        });
        expect(result.data).toEqual(responseData);
        expect(result.success).toBe(true);
      });

      it("makes POST request without data", async () => {
        mockAxiosInstance.request.mockResolvedValueOnce({
          data: { action: "triggered" },
          status: 200,
        });

        const client = new HttpClient();
        await client.post("/trigger-action");

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: "post",
          url: "/trigger-action",
          data: undefined,
        });
      });
    });

    describe("put()", () => {
      it("makes PUT request with data", async () => {
        const requestData = { name: "Updated User" };
        mockAxiosInstance.request.mockResolvedValueOnce({
          data: { id: 1, ...requestData },
          status: 200,
        });

        const client = new HttpClient();
        const result = await client.put("/users/1", requestData);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: "put",
          url: "/users/1",
          data: requestData,
        });
        expect(result.success).toBe(true);
      });
    });

    describe("patch()", () => {
      it("makes PATCH request with partial data", async () => {
        const requestData = { email: "newemail@test.com" };
        mockAxiosInstance.request.mockResolvedValueOnce({
          data: { id: 1, name: "User", ...requestData },
          status: 200,
        });

        const client = new HttpClient();
        const result = await client.patch("/users/1", requestData);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: "patch",
          url: "/users/1",
          data: requestData,
        });
        expect(result.success).toBe(true);
      });
    });

    describe("delete()", () => {
      it("makes DELETE request", async () => {
        mockAxiosInstance.request.mockResolvedValueOnce({
          data: { deleted: true },
          status: 200,
        });

        const client = new HttpClient();
        const result = await client.delete("/users/1");

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: "delete",
          url: "/users/1",
          data: undefined,
        });
        expect(result.success).toBe(true);
      });

      it("makes DELETE request with config", async () => {
        mockAxiosInstance.request.mockResolvedValueOnce({
          data: null,
          status: 204,
        });

        const client = new HttpClient();
        await client.delete("/users/1", { headers: { "If-Match": "etag123" } });

        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
          expect.objectContaining({
            headers: { "If-Match": "etag123" },
          })
        );
      });
    });
  });

  describe("error handling", () => {
    // Note: Using skipRetry: true to test error normalization without retry handler
    // The retry handler has its own tests for error handling with retries

    it("normalizes and throws error on request failure", async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 404,
          data: { message: "User not found" },
        },
        request: {},
      };
      mockAxiosInstance.request.mockRejectedValueOnce(axiosError);

      const client = new HttpClient();

      await expect(client.get("/users/999", { skipRetry: true })).rejects.toEqual({
        message: "User not found",
        code: "NOT_FOUND",
        status: 404,
        details: { message: "User not found" },
      });
    });

    it("normalizes network errors", async () => {
      const networkError = {
        isAxiosError: true,
        request: {},
        message: "Network Error",
      };
      mockAxiosInstance.request.mockRejectedValueOnce(networkError);

      const client = new HttpClient();

      await expect(client.get("/users", { skipRetry: true })).rejects.toEqual({
        message: "Network error - no response received",
        code: "NETWORK_ERROR",
      });
    });

    it("normalizes 500 server errors", async () => {
      const serverError = {
        isAxiosError: true,
        response: {
          status: 500,
          data: { error: "Internal server error" },
        },
        request: {},
      };
      mockAxiosInstance.request.mockRejectedValueOnce(serverError);

      const client = new HttpClient();

      await expect(client.post("/users", {}, { skipRetry: true })).rejects.toMatchObject({
        status: 500,
        code: "INTERNAL_SERVER_ERROR",
      });
    });

    it("normalizes 401 unauthorized errors", async () => {
      const authError = {
        isAxiosError: true,
        response: {
          status: 401,
          data: { detail: "Token expired" },
        },
        request: {},
      };
      mockAxiosInstance.request.mockRejectedValueOnce(authError);

      const client = new HttpClient();

      await expect(client.get("/protected", { skipRetry: true })).rejects.toMatchObject({
        status: 401,
        code: "UNAUTHORIZED",
      });
    });

    it("normalizes 422 validation errors", async () => {
      const validationError = {
        isAxiosError: true,
        response: {
          status: 422,
          data: { detail: "Email is invalid" },
        },
        request: {},
      };
      mockAxiosInstance.request.mockRejectedValueOnce(validationError);

      const client = new HttpClient();

      await expect(client.post("/users", { email: "invalid" }, { skipRetry: true })).rejects.toMatchObject({
        status: 422,
        code: "VALIDATION_ERROR",
      });
    });
  });

  describe("skipRetry option", () => {
    it("skips retry handler when skipRetry is true", async () => {
      mockAxiosInstance.request.mockResolvedValueOnce({
        data: { fast: true },
        status: 200,
      });

      const client = new HttpClient();
      await client.get("/fast-endpoint", { skipRetry: true });

      // Request should be called directly without retry wrapper
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(1);
    });

    it("uses retry handler when skipRetry is false or undefined", async () => {
      mockAxiosInstance.request.mockResolvedValueOnce({
        data: {},
        status: 200,
      });

      const client = new HttpClient();
      await client.get("/endpoint");

      expect(mockAxiosInstance.request).toHaveBeenCalled();
    });
  });

  describe("skipTenantId option", () => {
    it("allows skipping tenant ID header", async () => {
      const mockResolver = { getTenantId: jest.fn().mockReturnValue("tenant-123") };
      (TenantResolver.fromConfig as jest.Mock).mockReturnValue(mockResolver);

      mockAxiosInstance.request.mockResolvedValueOnce({
        data: {},
        status: 200,
      });

      const client = new HttpClient();
      client.setTenantId("tenant-123");

      // Get the request interceptor callback
      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];

      // Test with skipTenantId: true
      const configWithSkip = { headers: {}, skipTenantId: true };
      const resultWithSkip = requestInterceptor(configWithSkip);
      expect(resultWithSkip.headers["X-Tenant-ID"]).toBeUndefined();

      // Test without skipTenantId
      const configWithoutSkip = { headers: {} };
      const resultWithoutSkip = requestInterceptor(configWithoutSkip);
      expect(resultWithoutSkip.headers["X-Tenant-ID"]).toBe("tenant-123");
    });
  });

  describe("getAxiosInstance()", () => {
    it("returns the underlying axios instance", () => {
      const client = new HttpClient();
      const instance = client.getAxiosInstance();

      expect(instance).toBe(mockAxiosInstance);
    });
  });

  describe("getCurrentTenantId()", () => {
    it("returns null when no tenant resolver is set", () => {
      const client = new HttpClient();
      expect(client.getCurrentTenantId()).toBeNull();
    });

    it("returns tenant ID from resolver", () => {
      const mockResolver = { getTenantId: jest.fn().mockReturnValue("my-tenant") };
      (TenantResolver.fromConfig as jest.Mock).mockReturnValue(mockResolver);

      const client = new HttpClient();
      client.setTenantId("my-tenant");

      expect(client.getCurrentTenantId()).toBe("my-tenant");
    });
  });

  describe("request interceptors", () => {
    it("adds X-Tenant-ID header when tenant resolver is set", async () => {
      const mockResolver = { getTenantId: jest.fn().mockReturnValue("interceptor-tenant") };
      (TenantResolver.fromConfig as jest.Mock).mockReturnValue(mockResolver);

      const client = new HttpClient();
      client.setTenantId("interceptor-tenant");

      // Get the request interceptor
      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];

      const config = { headers: {} };
      const result = requestInterceptor(config);

      expect(result.headers["X-Tenant-ID"]).toBe("interceptor-tenant");
    });

    it("does not add X-Tenant-ID when no resolver is set", async () => {
      const client = new HttpClient();

      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];

      const config = { headers: {} };
      const result = requestInterceptor(config);

      expect(result.headers["X-Tenant-ID"]).toBeUndefined();
    });

    it("normalizes request interceptor errors", async () => {
      const client = new HttpClient();

      const errorHandler = mockAxiosInstance.interceptors.request.use.mock.calls[0][1];

      const mockError = new Error("Request setup failed");
      await expect(errorHandler(mockError)).rejects.toEqual({
        message: "Request setup failed",
        code: "GENERIC_ERROR",
      });
    });
  });

  describe("response interceptors", () => {
    it("passes through successful responses", () => {
      const client = new HttpClient();

      const responseInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][0];
      const mockResponse = { data: { success: true }, status: 200 };

      const result = responseInterceptor(mockResponse);

      expect(result).toBe(mockResponse);
    });

    it("normalizes response errors", async () => {
      const client = new HttpClient();

      const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      const axiosError = {
        isAxiosError: true,
        response: { status: 400, data: { message: "Bad request" } },
        request: {},
      };

      await expect(errorHandler(axiosError)).rejects.toEqual({
        message: "Bad request",
        code: "BAD_REQUEST",
        status: 400,
        details: { message: "Bad request" },
      });
    });
  });

  describe("method chaining", () => {
    it("supports fluent API for configuration", () => {
      const mockResolver = { getTenantId: jest.fn().mockReturnValue("chain-tenant") };
      (TenantResolver.fromConfig as jest.Mock).mockReturnValue(mockResolver);

      const client = HttpClient.create({ baseURL: "https://api.test.com" })
        .setTenantId("chain-tenant")
        .enableAuth({ tokenSource: "localStorage" });

      expect(client).toBeInstanceOf(HttpClient);
      expect(client.getCurrentTenantId()).toBe("chain-tenant");
    });
  });

  describe("concurrent requests", () => {
    it("handles multiple concurrent requests", async () => {
      mockAxiosInstance.request
        .mockResolvedValueOnce({ data: { id: 1 }, status: 200 })
        .mockResolvedValueOnce({ data: { id: 2 }, status: 200 })
        .mockResolvedValueOnce({ data: { id: 3 }, status: 200 });

      const client = new HttpClient();

      const results = await Promise.all([
        client.get("/users/1"),
        client.get("/users/2"),
        client.get("/users/3"),
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].data).toEqual({ id: 1 });
      expect(results[1].data).toEqual({ id: 2 });
      expect(results[2].data).toEqual({ id: 3 });
    });

    it("handles mixed success and failure in concurrent requests", async () => {
      mockAxiosInstance.request
        .mockResolvedValueOnce({ data: { id: 1 }, status: 200 })
        .mockRejectedValueOnce({
          isAxiosError: true,
          response: { status: 404, data: { message: "Not found" } },
          request: {},
        })
        .mockResolvedValueOnce({ data: { id: 3 }, status: 200 });

      const client = new HttpClient();

      const results = await Promise.allSettled([
        client.get("/users/1"),
        client.get("/users/2"),
        client.get("/users/3"),
      ]);

      expect(results[0].status).toBe("fulfilled");
      expect(results[1].status).toBe("rejected");
      expect(results[2].status).toBe("fulfilled");
    });
  });

  describe("type safety", () => {
    it("returns typed response data", async () => {
      interface User {
        id: number;
        name: string;
        email: string;
      }

      mockAxiosInstance.request.mockResolvedValueOnce({
        data: { id: 1, name: "John", email: "john@test.com" },
        status: 200,
      });

      const client = new HttpClient();
      const result = await client.get<User>("/users/1");

      // TypeScript should infer result.data as User
      expect(result.data.id).toBe(1);
      expect(result.data.name).toBe("John");
      expect(result.data.email).toBe("john@test.com");
    });

    it("returns typed array response", async () => {
      interface User {
        id: number;
        name: string;
      }

      mockAxiosInstance.request.mockResolvedValueOnce({
        data: [
          { id: 1, name: "John" },
          { id: 2, name: "Jane" },
        ],
        status: 200,
      });

      const client = new HttpClient();
      const result = await client.get<User[]>("/users");

      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe("John");
    });
  });
});
