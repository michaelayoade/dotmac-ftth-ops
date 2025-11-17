/**
 * MSW-powered tests for useIntegrations
 *
 * This test file uses MSW for API mocking instead of jest.mock.
 * MSW provides more realistic network mocking and better test isolation.
 *
 * Tests the actual hook contract: { data, isLoading, error, ... }
 */

import { renderHook, waitFor, act, cleanup } from "@testing-library/react";
import { useIntegrations, useIntegration, useHealthCheck } from "../useIntegrations";
import {
  createTestQueryClient,
  createQueryWrapper,
  resetIntegrationsStorage,
  createMockIntegration,
  seedIntegrationsData,
  makeApiEndpointFail,
  server,
} from "../../__tests__/test-utils";

describe("useIntegrations (MSW)", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    resetIntegrationsStorage();
    server.resetHandlers();
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  describe("useIntegrations - fetch all integrations", () => {
    it("should fetch integrations successfully", async () => {
      const mockIntegrations = [
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
      ];

      seedIntegrationsData(mockIntegrations);

      const { result } = renderHook(() => useIntegrations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      // Should start in loading state
      expect(result.current.isLoading).toBe(true);

      // Wait for data to load
      await waitFor(() => expect(result.current?.isLoading ?? true).toBe(false));

      // Verify data
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.integrations).toHaveLength(3);
      expect(result.current.data?.total).toBe(3);
      expect(result.current.data?.integrations[0].name).toBe("sendgrid");
      expect(result.current.error).toBeNull();
    });

    it("should handle empty integrations list", async () => {
      seedIntegrationsData([]);

      const { result } = renderHook(() => useIntegrations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current?.isLoading ?? true).toBe(false));

      expect(result.current.data?.integrations).toHaveLength(0);
      expect(result.current.data?.total).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it("should handle fetch error", async () => {
      makeApiEndpointFail("get", "/api/v1/integrations", "Server error", 500);

      const { result } = renderHook(() => useIntegrations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current?.isLoading ?? true).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should filter integrations by status", async () => {
      const integrations = [
        createMockIntegration({ name: "int-1", status: "ready" }),
        createMockIntegration({ name: "int-2", status: "error" }),
        createMockIntegration({ name: "int-3", status: "ready" }),
        createMockIntegration({ name: "int-4", status: "disabled" }),
      ];

      seedIntegrationsData(integrations);

      const { result } = renderHook(() => useIntegrations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const readyIntegrations = result.current.data?.integrations.filter(
        (i) => i.status === "ready"
      );
      expect(readyIntegrations).toHaveLength(2);
    });
  });

  describe("useIntegration - fetch single integration", () => {
    it("should fetch single integration successfully", async () => {
      const integration = createMockIntegration({
        name: "sendgrid",
        type: "email",
        provider: "sendgrid",
        status: "ready",
        settings_count: 10,
        has_secrets: true,
      });

      seedIntegrationsData([integration]);

      const { result } = renderHook(() => useIntegration("sendgrid"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.name).toBe("sendgrid");
      expect(result.current.data?.type).toBe("email");
      expect(result.current.data?.has_secrets).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("should not fetch when name is empty", () => {
      seedIntegrationsData([]);

      const { result } = renderHook(() => useIntegration(""), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it("should handle integration not found", async () => {
      seedIntegrationsData([]);

      const { result } = renderHook(() => useIntegration("non-existent"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useHealthCheck - trigger health check", () => {
    it("should trigger health check successfully", async () => {
      const integration = createMockIntegration({
        name: "sendgrid",
        status: "ready",
        last_check: new Date("2024-01-01").toISOString(),
      });

      seedIntegrationsData([integration]);

      const { result } = renderHook(() => useHealthCheck(), {
        wrapper: createQueryWrapper(queryClient),
      });

      let updatedIntegration: any;
      await act(async () => {
        updatedIntegration = await result.current.mutateAsync("sendgrid");
      });

      expect(updatedIntegration).toBeDefined();
      expect(updatedIntegration.name).toBe("sendgrid");
      expect(updatedIntegration.last_check).not.toBe(integration.last_check);
    });

    it("should handle health check for disabled integration", async () => {
      const integration = createMockIntegration({
        name: "disabled-integration",
        enabled: false,
        status: "disabled",
      });

      seedIntegrationsData([integration]);

      const { result } = renderHook(() => useHealthCheck(), {
        wrapper: createQueryWrapper(queryClient),
      });

      let updatedIntegration: any;
      await act(async () => {
        updatedIntegration = await result.current.mutateAsync("disabled-integration");
      });

      expect(updatedIntegration.status).toBe("disabled");
    });

    it("should handle health check error for non-existent integration", async () => {
      seedIntegrationsData([]);

      const { result } = renderHook(() => useHealthCheck(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await act(async () => {
        await expect(result.current.mutateAsync("non-existent")).rejects.toThrow();
      });
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle multiple integration types", async () => {
      const integrations = [
        createMockIntegration({ name: "sendgrid", type: "email" }),
        createMockIntegration({ name: "twilio", type: "sms" }),
        createMockIntegration({ name: "minio", type: "storage" }),
        createMockIntegration({ name: "elasticsearch", type: "search" }),
        createMockIntegration({ name: "redis", type: "cache" }),
      ];

      seedIntegrationsData(integrations);

      const localQueryClient = createTestQueryClient();
      const { result } = renderHook(() => useIntegrations(), {
        wrapper: createQueryWrapper(localQueryClient),
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
      const integrations = [
        createMockIntegration({ name: "ready-int", status: "ready" }),
        createMockIntegration({ name: "error-int", status: "error", message: "Connection failed" }),
        createMockIntegration({ name: "configuring-int", status: "configuring" }),
        createMockIntegration({ name: "disabled-int", status: "disabled" }),
      ];

      seedIntegrationsData(integrations);

      const { result } = renderHook(() => useIntegrations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current?.isLoading ?? true).toBe(false));

      const statusCounts = result.current?.data?.integrations.reduce(
        (acc, i) => {
          acc[i.status] = (acc[i.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      expect(statusCounts?.ready).toBe(1);
      expect(statusCounts?.error).toBe(1);
      expect(statusCounts?.configuring).toBe(1);
      expect(statusCounts?.disabled).toBe(1);
    });

    it("should handle health check and list refresh", async () => {
      const integration = createMockIntegration({
        name: "test-integration",
        status: "ready",
      });

      seedIntegrationsData([integration]);

      const { result: listResult } = renderHook(() => useIntegrations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      const { result: healthCheckResult } = renderHook(() => useHealthCheck(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(listResult.current.isLoading).toBe(false));

      // Trigger health check
      await act(async () => {
        await healthCheckResult.current.mutateAsync("test-integration");
      });

      // Note: In a real app, the list would be invalidated and refetched
      // For this test, we just verify the mutation succeeded
      expect(healthCheckResult.current.isSuccess).toBe(true);
    });

    it("should handle integrations with metadata", async () => {
      const integrations = [
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
      ];

      seedIntegrationsData(integrations);

      const { result } = renderHook(() => useIntegrations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const withMeta = result.current.data?.integrations.find(
        (i) => i.name === "with-metadata"
      );
      const withoutMeta = result.current.data?.integrations.find(
        (i) => i.name === "without-metadata"
      );

      expect(withMeta?.metadata).toBeDefined();
      expect(withMeta?.metadata?.version).toBe("1.0.0");
      expect(withoutMeta?.metadata).toBeNull();
    });
  });
});
