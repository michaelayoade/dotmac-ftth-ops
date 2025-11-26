/**
 * Jest Mock Tests for useIntegrations
 *
 * This test file uses MSW handlers for API mocking.
 * Tests the actual hook contract: { data, isLoading, error, ... }
 */

import { renderHook, waitFor, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { useIntegrations, useIntegration, useHealthCheck } from "../useIntegrations";
import { http, HttpResponse } from "msw";
import { server } from "@/__tests__/msw/server";

// Mock response storage
let mockIntegrationsResponse: any = { integrations: [], total: 0 };
let mockSingleIntegrationResponse: any = null;
let mockHealthCheckResponse: any = { status: "healthy" };
let shouldThrowError = false;

// Mock useToast
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock apiClient defaults
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    defaults: {
      baseURL: "http://localhost:3000/api/v1",
    },
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe("useIntegrations (Jest Mocks)", () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnMount: false,
          refetchOnWindowFocus: false,
          staleTime: Infinity,
        },
        mutations: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Reset mock responses
    mockIntegrationsResponse = { integrations: [], total: 0 };
    mockSingleIntegrationResponse = null;
    mockHealthCheckResponse = { status: "healthy" };
    shouldThrowError = false;

    // Set up MSW handlers for integrations
    server.use(
      http.get("http://localhost:3000/api/v1/integrations", () => {
        if (shouldThrowError) {
          return new HttpResponse(JSON.stringify({ error: "Server error" }), { status: 500 });
        }
        return HttpResponse.json(mockIntegrationsResponse);
      }),
      http.get("http://localhost:3000/api/v1/integrations/:name", ({ params }) => {
        if (shouldThrowError) {
          return new HttpResponse(JSON.stringify({ error: "Server error" }), { status: 500 });
        }
        return HttpResponse.json(mockSingleIntegrationResponse);
      }),
      http.post("http://localhost:3000/api/v1/integrations/:name/health-check", () => {
        if (shouldThrowError) {
          return new HttpResponse(JSON.stringify({ error: "Server error" }), { status: 500 });
        }
        return HttpResponse.json(mockHealthCheckResponse);
      }),
    );
  });

  afterEach(() => {
    cleanup();
    server.resetHandlers();
  });

  const createMockIntegration = (overrides = {}) => ({
    name: "test-integration",
    type: "email",
    provider: "sendgrid",
    status: "ready",
    enabled: true,
    message: null,
    last_check: new Date().toISOString(),
    settings_count: 0,
    has_secrets: false,
    required_packages: [],
    metadata: null,
    ...overrides,
  });

  describe("useIntegrations - fetch all integrations", () => {
    it("should fetch integrations successfully", async () => {
      mockIntegrationsResponse = {
        integrations: [
          createMockIntegration({
            name: "sendgrid",
            type: "email",
            provider: "sendgrid",
            status: "ready",
            enabled: true,
          }),
          createMockIntegration({
            name: "twilio",
            type: "sms",
            provider: "twilio",
            status: "configuring",
            enabled: true,
          }),
          createMockIntegration({
            name: "minio",
            type: "storage",
            provider: "minio",
            status: "disabled",
            enabled: false,
          }),
        ],
        total: 3,
      };

      const { result } = renderHook(() => useIntegrations(), {
        wrapper: createWrapper(),
      });

      // Should start in loading state
      expect(result.current.isLoading).toBe(true);

      // Wait for data to load
      await waitFor(() => expect(result.current?.isLoading ?? true).toBe(false));

      // Verify data
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.integrations).toHaveLength(3);
      expect(result.current.data?.total).toBe(3);
      expect(result.current.data?.integrations[0]?.name).toBe("sendgrid");
      expect(result.current.error).toBeNull();
    });

    it("should handle empty integrations list", async () => {
      mockIntegrationsResponse = { integrations: [], total: 0 };

      const { result } = renderHook(() => useIntegrations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current?.isLoading ?? true).toBe(false));

      expect(result.current.data?.integrations).toHaveLength(0);
      expect(result.current.data?.total).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it("should handle fetch error", async () => {
      shouldThrowError = true;

      const { result } = renderHook(() => useIntegrations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current?.isLoading ?? true).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should filter integrations by status", async () => {
      mockIntegrationsResponse = {
        integrations: [
          createMockIntegration({ name: "int-1", status: "ready" }),
          createMockIntegration({ name: "int-2", status: "error" }),
          createMockIntegration({ name: "int-3", status: "ready" }),
          createMockIntegration({ name: "int-4", status: "disabled" }),
        ],
        total: 4,
      };

      const { result } = renderHook(() => useIntegrations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const readyIntegrations = result.current.data?.integrations.filter(
        (i) => i.status === "ready",
      );
      expect(readyIntegrations).toHaveLength(2);
    });
  });

  describe("useIntegration - fetch single integration", () => {
    it("should fetch single integration successfully", async () => {
      mockSingleIntegrationResponse = createMockIntegration({
        name: "sendgrid",
        type: "email",
        provider: "sendgrid",
        status: "ready",
        settings_count: 10,
        has_secrets: true,
      });

      const { result } = renderHook(() => useIntegration("sendgrid"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.name).toBe("sendgrid");
      expect(result.current.data?.type).toBe("email");
      expect(result.current.data?.has_secrets).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("should not fetch when name is empty", () => {
      const { result } = renderHook(() => useIntegration(""), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it("should handle integration not found", async () => {
      shouldThrowError = true;

      const { result } = renderHook(() => useIntegration("non-existent"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useHealthCheck - trigger health check", () => {
    it("should trigger health check successfully", async () => {
      mockHealthCheckResponse = createMockIntegration({
        name: "sendgrid",
        status: "ready",
        last_check: new Date().toISOString(),
      });

      const { result } = renderHook(() => useHealthCheck(), {
        wrapper: createWrapper(),
      });

      let response: any;
      await act(async () => {
        response = await result.current.mutateAsync("sendgrid");
      });

      expect(response).toBeDefined();
      expect(response.name).toBe("sendgrid");
      expect(response.last_check).toBeDefined();
    });

    it("should handle health check for disabled integration", async () => {
      mockHealthCheckResponse = createMockIntegration({
        name: "disabled-integration",
        enabled: false,
        status: "disabled",
      });

      const { result } = renderHook(() => useHealthCheck(), {
        wrapper: createWrapper(),
      });

      let response: any;
      await act(async () => {
        response = await result.current.mutateAsync("disabled-integration");
      });

      expect(response.status).toBe("disabled");
    });

    it("should handle health check error for non-existent integration", async () => {
      shouldThrowError = true;

      const { result } = renderHook(() => useHealthCheck(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await expect(result.current.mutateAsync("non-existent")).rejects.toThrow();
      });
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle multiple integration types", async () => {
      mockIntegrationsResponse = {
        integrations: [
          createMockIntegration({ name: "sendgrid", type: "email" }),
          createMockIntegration({ name: "twilio", type: "sms" }),
          createMockIntegration({ name: "minio", type: "storage" }),
          createMockIntegration({ name: "elasticsearch", type: "search" }),
          createMockIntegration({ name: "redis", type: "cache" }),
        ],
        total: 5,
      };

      const { result } = renderHook(() => useIntegrations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        const length = result.current?.data?.integrations?.length;
        expect(length).toBe(5);
      });

      const finalResult = result.current;
      expect(finalResult).not.toBeNull();
      expect(finalResult?.data?.integrations).toHaveLength(5);

      const types = finalResult?.data?.integrations.map((i) => i.type);
      expect(types).toContain("email");
      expect(types).toContain("sms");
      expect(types).toContain("storage");
      expect(types).toContain("search");
      expect(types).toContain("cache");
    });

    it("should handle integrations with different statuses", async () => {
      mockIntegrationsResponse = {
        integrations: [
          createMockIntegration({ name: "ready-int", status: "ready" }),
          createMockIntegration({
            name: "error-int",
            status: "error",
            message: "Connection failed",
          }),
          createMockIntegration({ name: "configuring-int", status: "configuring" }),
          createMockIntegration({ name: "disabled-int", status: "disabled" }),
        ],
        total: 4,
      };

      const { result } = renderHook(() => useIntegrations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current?.isLoading ?? true).toBe(false));

      const statusCounts = result.current?.data?.integrations.reduce(
        (acc, i) => {
          acc[i.status] = (acc[i.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      expect(statusCounts?.ready).toBe(1);
      expect(statusCounts?.error).toBe(1);
      expect(statusCounts?.configuring).toBe(1);
      expect(statusCounts?.disabled).toBe(1);
    });

    it("should handle integrations with metadata", async () => {
      mockIntegrationsResponse = {
        integrations: [
          createMockIntegration({
            name: "with-metadata",
            metadata: {
              version: "1.0.0",
              region: "us-west-2",
              custom_field: "value",
            },
          }),
          createMockIntegration({
            name: "without-metadata",
            metadata: null,
          }),
        ],
        total: 2,
      };

      const { result } = renderHook(() => useIntegrations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const withMeta = result.current.data?.integrations.find((i) => i.name === "with-metadata");
      const withoutMeta = result.current.data?.integrations.find(
        (i) => i.name === "without-metadata",
      );

      expect(withMeta?.metadata).toBeDefined();
      expect(withMeta?.metadata?.version).toBe("1.0.0");
      expect(withoutMeta?.metadata).toBeNull();
    });
  });
});
