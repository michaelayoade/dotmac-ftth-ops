/**
 * Jest Mock Tests for usePlugins hook
 * Tests plugin management system with direct API mocking
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useAvailablePlugins,
  usePluginInstances,
  usePluginSchema,
  usePluginInstance,
  usePluginConfiguration,
  useCreatePluginInstance,
  useUpdatePluginConfiguration,
  useDeletePluginInstance,
  useTestPluginConnection,
  usePluginHealthCheck,
  useBulkHealthCheck,
  useRefreshPlugins,
  getStatusColor,
  getHealthStatusColor,
  groupFields,
  formatTimestamp,
  type FieldSpec,
  type PluginConfig,
  type PluginInstance,
  type PluginListResponse,
  type PluginConfigurationResponse,
  type PluginHealthCheck,
  type PluginTestResult,
} from "../usePlugins";

// Mock API client
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

// Mock useToast
jest.mock("@dotmac/ui", () => ({
  ...jest.requireActual("@dotmac/ui"),
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock extractDataOrThrow to return data directly
jest.mock("@/lib/api/response-helpers", () => ({
  extractDataOrThrow: (response: any) => response.data,
}));

import { apiClient } from "@/lib/api/client";

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("usePlugins", () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe("useAvailablePlugins", () => {
    it("should fetch available plugins successfully", async () => {
      const mockPlugins: PluginConfig[] = [
        {
          name: "slack-notification",
          type: "notification",
          version: "1.0.0",
          description: "Send notifications to Slack",
          fields: [],
          dependencies: [],
          tags: [],
          supports_health_check: true,
          supports_test_connection: true,
        },
        {
          name: "stripe-payment",
          type: "payment",
          version: "2.1.0",
          description: "Process payments via Stripe",
          fields: [],
          dependencies: [],
          tags: [],
          supports_health_check: true,
          supports_test_connection: true,
        },
      ];

      mockApiClient.get.mockResolvedValue({ data: mockPlugins });

      const { result } = renderHook(() => useAvailablePlugins(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].name).toBe("slack-notification");
      expect(mockApiClient.get).toHaveBeenCalledWith("/plugins");
    });

    it("should return empty array when no plugins", async () => {
      mockApiClient.get.mockResolvedValue({ data: [], status: 200 });

      const { result } = renderHook(() => useAvailablePlugins(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
    });

    it("should handle fetch error", async () => {
      mockApiClient.get.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAvailablePlugins(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("usePluginInstances", () => {
    it("should fetch plugin instances successfully", async () => {
      const mockResponse: PluginListResponse = {
        plugins: [
          {
            id: "inst-1",
            plugin_name: "slack-notification",
            instance_name: "Production Slack",
            config_schema: {} as PluginConfig,
            status: "active",
            has_configuration: true,
          },
          {
            id: "inst-2",
            plugin_name: "stripe-payment",
            instance_name: "Main Payment Gateway",
            config_schema: {} as PluginConfig,
            status: "configured",
            has_configuration: true,
          },
        ],
        total: 2,
      };

      mockApiClient.get.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => usePluginInstances(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.plugins).toHaveLength(2);
      expect(result.current.data?.total).toBe(2);
      expect(mockApiClient.get).toHaveBeenCalledWith("/plugins/instances");
    });
  });

  describe("usePluginSchema", () => {
    it("should fetch plugin schema successfully", async () => {
      const mockSchema = {
        schema: {
          name: "test-plugin",
          type: "notification" as const,
          version: "1.0.0",
          description: "Test plugin",
          fields: [
            {
              key: "api_key",
              label: "API Key",
              type: "secret" as const,
              required: true,
              validation_rules: [],
              options: [],
              order: 1,
              is_secret: true,
              description: "Your API key",
            },
          ],
          dependencies: [],
          tags: [],
          supports_health_check: true,
          supports_test_connection: true,
        },
        instance_id: null,
      };

      mockApiClient.get.mockResolvedValue({ data: mockSchema });

      const { result } = renderHook(() => usePluginSchema("test-plugin"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.schema.name).toBe("test-plugin");
      expect(result.current.data?.schema.fields).toHaveLength(1);
      expect(mockApiClient.get).toHaveBeenCalledWith("/plugins/test-plugin/schema");
    });

    it("should handle plugin not found", async () => {
      mockApiClient.get.mockRejectedValue(new Error("Plugin not found"));

      const { result } = renderHook(() => usePluginSchema("nonexistent"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeTruthy();
    });

    it("should not fetch when pluginName is empty", () => {
      const { result } = renderHook(() => usePluginSchema(""), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });
  });

  describe("usePluginInstance", () => {
    it("should fetch single instance successfully", async () => {
      const mockInstance: PluginInstance = {
        id: "inst-123",
        plugin_name: "test-plugin",
        instance_name: "Test Instance",
        config_schema: {} as PluginConfig,
        status: "active",
        has_configuration: true,
      };

      mockApiClient.get.mockResolvedValue({ data: mockInstance });

      const { result } = renderHook(() => usePluginInstance("inst-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.id).toBe("inst-123");
      expect(result.current.data?.has_configuration).toBe(true);
      expect(mockApiClient.get).toHaveBeenCalledWith("/plugins/instances/inst-123");
    });

    it("should not fetch when instanceId is empty", () => {
      const { result } = renderHook(() => usePluginInstance(""), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });
  });

  describe("usePluginConfiguration", () => {
    it("should fetch plugin configuration", async () => {
      const mockConfig: PluginConfigurationResponse = {
        plugin_instance_id: "inst-config-1",
        configuration: {
          api_key: "secret-key",
          enabled: true,
        },
        schema: {
          name: "test-plugin",
          type: "notification",
          version: "1.0.0",
          description: "Test",
          fields: [],
          dependencies: [],
          tags: [],
          supports_health_check: true,
          supports_test_connection: true,
        },
        status: "configured",
      };

      mockApiClient.get.mockResolvedValue({ data: mockConfig });

      const { result } = renderHook(() => usePluginConfiguration("inst-config-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.plugin_instance_id).toBe("inst-config-1");
      expect(result.current.data?.schema).toBeDefined();
      expect(mockApiClient.get).toHaveBeenCalledWith(
        "/plugins/instances/inst-config-1/configuration",
      );
    });
  });

  describe("useCreatePluginInstance", () => {
    it("should create plugin instance successfully", async () => {
      const mockInstance: PluginInstance = {
        id: "new-inst-1",
        plugin_name: "new-plugin",
        instance_name: "My Instance",
        config_schema: {} as PluginConfig,
        status: "configured",
        has_configuration: true,
      };

      mockApiClient.post.mockResolvedValue({ data: mockInstance, status: 200 });

      const { result } = renderHook(() => useCreatePluginInstance(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          plugin_name: "new-plugin",
          instance_name: "My Instance",
          configuration: {
            api_key: "test-key-123",
            enabled: true,
          },
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.plugin_name).toBe("new-plugin");
      expect(result.current.data?.instance_name).toBe("My Instance");
      expect(result.current.data?.status).toBe("configured");
    });

    it("should handle plugin not found", async () => {
      mockApiClient.post.mockRejectedValue(new Error("Plugin not found"));

      const { result } = renderHook(() => useCreatePluginInstance(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          plugin_name: "nonexistent",
          instance_name: "Test",
          configuration: {},
        }),
      ).rejects.toThrow();

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useUpdatePluginConfiguration", () => {
    it("should update configuration successfully", async () => {
      mockApiClient.put.mockResolvedValue({
        data: { message: "Configuration updated successfully" },
        status: 200,
      });

      const { result } = renderHook(() => useUpdatePluginConfiguration(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          instanceId: "inst-update-1",
          data: {
            configuration: {
              api_key: "updated-key",
              webhook_url: "https://example.com/webhook",
            },
          },
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.message).toContain("updated");
    });

    it("should handle instance not found", async () => {
      mockApiClient.put.mockRejectedValue(new Error("Instance not found"));

      const { result } = renderHook(() => useUpdatePluginConfiguration(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          instanceId: "nonexistent",
          data: { configuration: {} },
        }),
      ).rejects.toThrow();

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useDeletePluginInstance", () => {
    it("should delete instance successfully", async () => {
      mockApiClient.delete.mockResolvedValue({ status: 204 });

      const { result } = renderHook(() => useDeletePluginInstance(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("inst-delete-1");
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.delete).toHaveBeenCalledWith("/plugins/instances/inst-delete-1");
    });

    it("should handle delete non-existent instance", async () => {
      mockApiClient.delete.mockRejectedValue(new Error("Instance not found"));

      const { result } = renderHook(() => useDeletePluginInstance(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.mutateAsync("nonexistent")).rejects.toThrow();

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useTestPluginConnection", () => {
    it("should test connection successfully", async () => {
      const mockTestResult: PluginTestResult = {
        success: true,
        message: "Connection test successful",
        details: { latency: 45 },
        timestamp: new Date().toISOString(),
        response_time_ms: 45,
      };

      mockApiClient.post.mockResolvedValue({ data: mockTestResult, status: 200 });

      const { result } = renderHook(() => useTestPluginConnection(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          instanceId: "inst-test-1",
          configuration: {
            api_key: "test-key",
          },
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.success).toBe(true);
      expect(result.current.data?.message).toContain("successful");
    });

    it("should handle failed connection test", async () => {
      const mockTestResult: PluginTestResult = {
        success: false,
        message: "Connection failed: Invalid credentials",
        details: { error: "401 Unauthorized" },
        timestamp: new Date().toISOString(),
      };

      mockApiClient.post.mockResolvedValue({ data: mockTestResult, status: 200 });

      const { result } = renderHook(() => useTestPluginConnection(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          instanceId: "inst-error-1",
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.success).toBe(false);
      expect(result.current.data?.message).toContain("failed");
    });
  });

  describe("usePluginHealthCheck", () => {
    it("should fetch health check for active instance", async () => {
      const mockHealth: PluginHealthCheck = {
        plugin_instance_id: "inst-health-1",
        status: "healthy",
        message: "Plugin is operational",
        details: { uptime: 3600 },
        timestamp: new Date().toISOString(),
        response_time_ms: 12,
      };

      mockApiClient.get.mockResolvedValue({ data: mockHealth });

      const { result } = renderHook(() => usePluginHealthCheck("inst-health-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.status).toBe("healthy");
      expect(result.current.data?.plugin_instance_id).toBe("inst-health-1");
    });

    it("should show unhealthy for inactive instance", async () => {
      const mockHealth: PluginHealthCheck = {
        plugin_instance_id: "inst-inactive-1",
        status: "unhealthy",
        message: "Plugin is not responding",
        details: {},
        timestamp: new Date().toISOString(),
      };

      mockApiClient.get.mockResolvedValue({ data: mockHealth });

      const { result } = renderHook(() => usePluginHealthCheck("inst-inactive-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.status).toBe("unhealthy");
    });
  });

  describe("useBulkHealthCheck", () => {
    it("should check health of multiple instances", async () => {
      const mockHealthChecks: PluginHealthCheck[] = [
        {
          plugin_instance_id: "inst-1",
          status: "healthy",
          message: "OK",
          details: {},
          timestamp: new Date().toISOString(),
        },
        {
          plugin_instance_id: "inst-2",
          status: "unhealthy",
          message: "Not responding",
          details: {},
          timestamp: new Date().toISOString(),
        },
      ];

      mockApiClient.post.mockResolvedValue({ data: mockHealthChecks, status: 200 });

      const { result } = renderHook(() => useBulkHealthCheck(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync(["inst-1", "inst-2"]);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(2);
    });

    it("should check all instances when no IDs provided", async () => {
      const mockHealthChecks: PluginHealthCheck[] = [
        {
          plugin_instance_id: "inst-1",
          status: "healthy",
          message: "OK",
          details: {},
          timestamp: new Date().toISOString(),
        },
        {
          plugin_instance_id: "inst-2",
          status: "healthy",
          message: "OK",
          details: {},
          timestamp: new Date().toISOString(),
        },
      ];

      mockApiClient.post.mockResolvedValue({ data: mockHealthChecks, status: 200 });

      const { result } = renderHook(() => useBulkHealthCheck(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync(null);
      });

      await waitFor(() => expect(result.current.data).toBeTruthy());
      expect(result.current.data).toHaveLength(2);
    });
  });

  describe("useRefreshPlugins", () => {
    it("should refresh plugins successfully", async () => {
      mockApiClient.post.mockResolvedValue({
        data: {
          message: "Plugins refreshed",
          available_plugins: 5,
        },
        status: 200,
      });

      const { result } = renderHook(() => useRefreshPlugins(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync();
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.available_plugins).toBe(5);
    });
  });

  describe("Utility Functions", () => {
    describe("getStatusColor", () => {
      it("should return correct colors for each status", () => {
        expect(getStatusColor("registered")).toContain("gray");
        expect(getStatusColor("configured")).toContain("blue");
        expect(getStatusColor("active")).toContain("emerald");
        expect(getStatusColor("inactive")).toContain("yellow");
        expect(getStatusColor("error")).toContain("red");
      });
    });

    describe("getHealthStatusColor", () => {
      it("should return correct colors for health statuses", () => {
        expect(getHealthStatusColor("healthy")).toContain("emerald");
        expect(getHealthStatusColor("unhealthy")).toContain("red");
        expect(getHealthStatusColor("unknown")).toContain("gray");
        expect(getHealthStatusColor("error")).toContain("red");
      });
    });

    describe("groupFields", () => {
      it("should group fields by group name", () => {
        const fields: FieldSpec[] = [
          {
            key: "api_key",
            label: "API Key",
            type: "secret",
            required: true,
            validation_rules: [],
            options: [],
            group: "Authentication",
            order: 1,
            is_secret: true,
          },
          {
            key: "webhook_url",
            label: "Webhook URL",
            type: "url",
            required: true,
            validation_rules: [],
            options: [],
            group: "Settings",
            order: 1,
            is_secret: false,
          },
          {
            key: "enabled",
            label: "Enabled",
            type: "boolean",
            required: false,
            validation_rules: [],
            options: [],
            group: "Settings",
            order: 2,
            is_secret: false,
          },
        ];

        const grouped = groupFields(fields);

        expect(Object.keys(grouped)).toHaveLength(2);
        expect(grouped["Authentication"]).toHaveLength(1);
        expect(grouped["Settings"]).toHaveLength(2);
      });

      it("should use 'General' for fields without group", () => {
        const fields: FieldSpec[] = [
          {
            key: "field1",
            label: "Field 1",
            type: "string",
            required: false,
            validation_rules: [],
            options: [],
            order: 1,
            is_secret: false,
          },
        ];

        const grouped = groupFields(fields);

        expect(grouped["General"]).toHaveLength(1);
      });

      it("should sort fields by order within groups", () => {
        const fields: FieldSpec[] = [
          {
            key: "field3",
            label: "Field 3",
            type: "string",
            required: false,
            validation_rules: [],
            options: [],
            group: "Test",
            order: 3,
            is_secret: false,
          },
          {
            key: "field1",
            label: "Field 1",
            type: "string",
            required: false,
            validation_rules: [],
            options: [],
            group: "Test",
            order: 1,
            is_secret: false,
          },
          {
            key: "field2",
            label: "Field 2",
            type: "string",
            required: false,
            validation_rules: [],
            options: [],
            group: "Test",
            order: 2,
            is_secret: false,
          },
        ];

        const grouped = groupFields(fields);

        expect(grouped["Test"][0].key).toBe("field1");
        expect(grouped["Test"][1].key).toBe("field2");
        expect(grouped["Test"][2].key).toBe("field3");
      });
    });

    describe("formatTimestamp", () => {
      it("should format timestamps correctly", () => {
        expect(formatTimestamp(null)).toBe("Never");
        expect(formatTimestamp(undefined)).toBe("Never");

        const now = new Date();
        expect(formatTimestamp(now.toISOString())).toBe("Just now");

        const oneHourAgo = new Date(now.getTime() - 3600000);
        expect(formatTimestamp(oneHourAgo.toISOString())).toContain("hour");
      });
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle complete plugin installation workflow", async () => {
      // Setup: Mock schema fetch
      const mockSchema = {
        schema: {
          name: "email-notification",
          type: "notification" as const,
          version: "2.0.0",
          description: "Send email notifications",
          fields: [
            {
              key: "smtp_host",
              label: "SMTP Host",
              type: "string" as const,
              required: true,
              validation_rules: [],
              options: [],
              order: 1,
              is_secret: false,
            },
          ],
          dependencies: [],
          tags: [],
          supports_health_check: true,
          supports_test_connection: true,
        },
        instance_id: null,
      };

      mockApiClient.get.mockResolvedValue({ data: mockSchema });

      // Step 1: Get schema
      const { result: schemaResult } = renderHook(() => usePluginSchema("email-notification"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(schemaResult.current.isSuccess).toBe(true));
      expect(schemaResult.current.data?.schema.name).toBe("email-notification");

      // Step 2: Create instance
      const mockInstance: PluginInstance = {
        id: "new-email-inst",
        plugin_name: "email-notification",
        instance_name: "Production Email",
        config_schema: mockSchema.schema,
        status: "configured",
        has_configuration: true,
      };

      mockApiClient.post.mockResolvedValue({ data: mockInstance, status: 200 });

      const { result: createResult } = renderHook(() => useCreatePluginInstance(), {
        wrapper: createWrapper(),
      });

      let instanceId: string;

      await act(async () => {
        const instance = await createResult.current.mutateAsync({
          plugin_name: "email-notification",
          instance_name: "Production Email",
          configuration: {
            smtp_host: "smtp.example.com",
            smtp_port: 587,
          },
        });
        instanceId = instance.id;
      });

      await waitFor(() => expect(createResult.current.isSuccess).toBe(true));
      expect(createResult.current.data?.id).toBe("new-email-inst");

      // Step 3: Test connection
      const mockTestResult: PluginTestResult = {
        success: true,
        message: "Connection successful",
        details: {},
        timestamp: new Date().toISOString(),
      };

      mockApiClient.post.mockResolvedValue({ data: mockTestResult, status: 200 });

      const { result: testResult } = renderHook(() => useTestPluginConnection(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await testResult.current.mutateAsync({ instanceId: instanceId! });
      });

      await waitFor(() => expect(testResult.current.isSuccess).toBe(true));
      expect(testResult.current.data?.success).toBe(true);
    });
  });
});
