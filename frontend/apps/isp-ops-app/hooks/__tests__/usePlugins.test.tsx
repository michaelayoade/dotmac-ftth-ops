/**
 * Tests for usePlugins hook
 * Tests plugin management functionality with TanStack Query
 */

import { renderHook, waitFor, act } from "@testing-library/react";
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
  PluginConfig,
  PluginInstance,
  PluginListResponse,
  PluginHealthCheck,
  PluginTestResult,
  PluginConfigurationResponse,
  PluginType,
  PluginStatus,
  FieldSpec,
} from "../usePlugins";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

// Mock toast
const mockToast = jest.fn();
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock("@/lib/api/response-helpers", () => ({
  extractDataOrThrow: jest.fn((response, _errorMsg) => response.data),
}));

describe("usePlugins", () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useAvailablePlugins - list available plugins", () => {
    it("should fetch all available plugins successfully", async () => {
      const mockPlugins: PluginConfig[] = [
        {
          name: "sendgrid",
          type: "notification",
          version: "1.0.0",
          description: "SendGrid email notifications",
          author: "DotMac Team",
          homepage: "https://sendgrid.com",
          fields: [],
          dependencies: [],
          tags: ["email", "notifications"],
          supports_health_check: true,
          supports_test_connection: true,
        },
        {
          name: "stripe",
          type: "payment",
          version: "2.0.0",
          description: "Stripe payment processing",
          author: null,
          homepage: null,
          fields: [],
          dependencies: ["stripe-python"],
          tags: ["payment", "billing"],
          supports_health_check: false,
          supports_test_connection: true,
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockPlugins,
      });

      const { result } = renderHook(() => useAvailablePlugins(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockPlugins);
      expect(result.current.isSuccess).toBe(true);
      expect(apiClient.get).toHaveBeenCalledWith("/plugins");
    });

    it("should handle empty plugins list", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: [],
      });

      const { result } = renderHook(() => useAvailablePlugins(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual([]);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch plugins");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useAvailablePlugins(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.isError).toBe(true);
    });

    it("should set loading state correctly", async () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: [] }), 100))
      );

      const { result } = renderHook(() => useAvailablePlugins(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), {
        timeout: 200,
      });
    });

    it("should accept custom query options", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: [],
      });

      const { result } = renderHook(
        () => useAvailablePlugins({ enabled: false }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isFetching).toBe(false));

      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should handle all plugin types", async () => {
      const pluginTypes: PluginType[] = [
        "notification",
        "payment",
        "storage",
        "search",
        "authentication",
        "integration",
        "analytics",
        "workflow",
      ];

      const mockPlugins: PluginConfig[] = pluginTypes.map((type, index) => ({
        name: `plugin-${index}`,
        type,
        version: "1.0.0",
        description: `Plugin ${index}`,
        author: null,
        homepage: null,
        fields: [],
        dependencies: [],
        tags: [],
        supports_health_check: false,
        supports_test_connection: false,
      }));

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockPlugins,
      });

      const { result } = renderHook(() => useAvailablePlugins(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.length).toBe(pluginTypes.length);
      pluginTypes.forEach((type, index) => {
        expect(result.current.data?.[index].type).toBe(type);
      });
    });
  });

  describe("usePluginInstances - list plugin instances", () => {
    it("should fetch all plugin instances successfully", async () => {
      const mockInstances: PluginInstance[] = [
        {
          id: "inst-1",
          plugin_name: "sendgrid",
          instance_name: "Production SendGrid",
          config_schema: {
            name: "sendgrid",
            type: "notification",
            version: "1.0.0",
            description: "SendGrid email",
            author: null,
            homepage: null,
            fields: [],
            dependencies: [],
            tags: [],
            supports_health_check: true,
            supports_test_connection: true,
          },
          status: "active",
          last_health_check: "2024-01-01T00:00:00Z",
          last_error: null,
          has_configuration: true,
          configuration_version: "1.0.0",
        },
      ];

      const mockResponse: PluginListResponse = {
        plugins: mockInstances,
        total: 1,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockResponse,
      });

      const { result } = renderHook(() => usePluginInstances(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.plugins).toEqual(mockInstances);
      expect(result.current.data?.total).toBe(1);
      expect(apiClient.get).toHaveBeenCalledWith("/plugins/instances");
    });

    it("should handle empty instances list", async () => {
      const mockResponse: PluginListResponse = {
        plugins: [],
        total: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockResponse,
      });

      const { result } = renderHook(() => usePluginInstances(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.plugins).toEqual([]);
      expect(result.current.data?.total).toBe(0);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch instances");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => usePluginInstances(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.isError).toBe(true);
    });

    it("should handle all plugin statuses", async () => {
      const statuses: PluginStatus[] = [
        "registered",
        "configured",
        "active",
        "inactive",
        "error",
      ];

      const mockInstances: PluginInstance[] = statuses.map((status, index) => ({
        id: `inst-${index}`,
        plugin_name: `plugin-${index}`,
        instance_name: `Instance ${index}`,
        config_schema: {
          name: `plugin-${index}`,
          type: "notification",
          version: "1.0.0",
          description: "",
          author: null,
          homepage: null,
          fields: [],
          dependencies: [],
          tags: [],
          supports_health_check: false,
          supports_test_connection: false,
        },
        status,
        last_health_check: null,
        last_error: null,
        has_configuration: false,
        configuration_version: null,
      }));

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { plugins: mockInstances, total: mockInstances.length },
      });

      const { result } = renderHook(() => usePluginInstances(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.plugins.length).toBe(statuses.length);
      statuses.forEach((status, index) => {
        expect(result.current.data?.plugins[index].status).toBe(status);
      });
    });

    it("should accept custom query options", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { plugins: [], total: 0 },
      });

      const { result } = renderHook(
        () => usePluginInstances({ enabled: false }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isFetching).toBe(false));

      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });

  describe("usePluginSchema - single plugin schema", () => {
    it("should fetch plugin schema successfully", async () => {
      const mockSchema: PluginConfig = {
        name: "sendgrid",
        type: "notification",
        version: "1.0.0",
        description: "SendGrid email notifications",
        author: "DotMac Team",
        homepage: "https://sendgrid.com",
        fields: [
          {
            key: "api_key",
            label: "API Key",
            type: "secret",
            description: "SendGrid API key",
            required: true,
            default: null,
            validation_rules: [],
            min_length: null,
            max_length: null,
            min_value: null,
            max_value: null,
            pattern: null,
            options: [],
            placeholder: "SG.xxx",
            help_text: "Get from SendGrid dashboard",
            group: "Authentication",
            order: 1,
            is_secret: true,
          },
        ],
        dependencies: [],
        tags: ["email"],
        supports_health_check: true,
        supports_test_connection: true,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: {
          schema: mockSchema,
          instance_id: "inst-1",
        },
      });

      const { result } = renderHook(() => usePluginSchema("sendgrid"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.schema).toEqual(mockSchema);
      expect(result.current.data?.instance_id).toBe("inst-1");
      expect(apiClient.get).toHaveBeenCalledWith("/plugins/sendgrid/schema");
    });

    it("should not fetch when plugin name is empty", async () => {
      const { result } = renderHook(() => usePluginSchema(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Schema not found");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => usePluginSchema("sendgrid"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.isError).toBe(true);
    });

    it("should handle schema without instance", async () => {
      const mockSchema: PluginConfig = {
        name: "new-plugin",
        type: "notification",
        version: "1.0.0",
        description: "New plugin",
        author: null,
        homepage: null,
        fields: [],
        dependencies: [],
        tags: [],
        supports_health_check: false,
        supports_test_connection: false,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: {
          schema: mockSchema,
          instance_id: null,
        },
      });

      const { result } = renderHook(() => usePluginSchema("new-plugin"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.schema).toEqual(mockSchema);
      expect(result.current.data?.instance_id).toBeNull();
    });

    it("should accept custom query options", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { schema: {}, instance_id: null },
      });

      const { result } = renderHook(
        () => usePluginSchema("sendgrid", { enabled: false }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isFetching).toBe(false));

      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });

  describe("usePluginInstance - single plugin instance", () => {
    it("should fetch plugin instance successfully", async () => {
      const mockInstance: PluginInstance = {
        id: "inst-1",
        plugin_name: "sendgrid",
        instance_name: "Production SendGrid",
        config_schema: {
          name: "sendgrid",
          type: "notification",
          version: "1.0.0",
          description: "SendGrid email",
          author: null,
          homepage: null,
          fields: [],
          dependencies: [],
          tags: [],
          supports_health_check: true,
          supports_test_connection: true,
        },
        status: "active",
        last_health_check: "2024-01-01T00:00:00Z",
        last_error: null,
        has_configuration: true,
        configuration_version: "1.0.0",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockInstance,
      });

      const { result } = renderHook(() => usePluginInstance("inst-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockInstance);
      expect(apiClient.get).toHaveBeenCalledWith("/plugins/instances/inst-1");
    });

    it("should not fetch when instance ID is empty", async () => {
      const { result } = renderHook(() => usePluginInstance(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Instance not found");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => usePluginInstance("inst-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.isError).toBe(true);
    });

    it("should handle instance with error status", async () => {
      const mockInstance: PluginInstance = {
        id: "inst-1",
        plugin_name: "sendgrid",
        instance_name: "Failed SendGrid",
        config_schema: {
          name: "sendgrid",
          type: "notification",
          version: "1.0.0",
          description: "SendGrid email",
          author: null,
          homepage: null,
          fields: [],
          dependencies: [],
          tags: [],
          supports_health_check: true,
          supports_test_connection: true,
        },
        status: "error",
        last_health_check: "2024-01-01T00:00:00Z",
        last_error: "API key invalid",
        has_configuration: true,
        configuration_version: "1.0.0",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockInstance,
      });

      const { result } = renderHook(() => usePluginInstance("inst-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.status).toBe("error");
      expect(result.current.data?.last_error).toBe("API key invalid");
    });

    it("should accept custom query options", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: {},
      });

      const { result } = renderHook(
        () => usePluginInstance("inst-1", { enabled: false }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isFetching).toBe(false));

      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });

  describe("usePluginConfiguration - plugin configuration", () => {
    it("should fetch plugin configuration successfully", async () => {
      const mockConfig: PluginConfigurationResponse = {
        plugin_instance_id: "inst-1",
        configuration: {
          api_key: "SG.xxx",
          from_email: "noreply@example.com",
        },
        schema: {
          name: "sendgrid",
          type: "notification",
          version: "1.0.0",
          description: "SendGrid email",
          author: null,
          homepage: null,
          fields: [],
          dependencies: [],
          tags: [],
          supports_health_check: true,
          supports_test_connection: true,
        },
        status: "active",
        last_updated: "2024-01-01T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockConfig,
      });

      const { result } = renderHook(() => usePluginConfiguration("inst-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockConfig);
      expect(apiClient.get).toHaveBeenCalledWith("/plugins/instances/inst-1/configuration");
    });

    it("should not fetch when instance ID is empty", async () => {
      const { result } = renderHook(() => usePluginConfiguration(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Configuration not found");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => usePluginConfiguration("inst-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.isError).toBe(true);
    });

    it("should accept custom query options", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: {},
      });

      const { result } = renderHook(
        () => usePluginConfiguration("inst-1", { enabled: false }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isFetching).toBe(false));

      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });

  describe("useCreatePluginInstance - mutation", () => {
    it("should create plugin instance successfully", async () => {
      const mockInstance: PluginInstance = {
        id: "inst-1",
        plugin_name: "sendgrid",
        instance_name: "Production SendGrid",
        config_schema: {
          name: "sendgrid",
          type: "notification",
          version: "1.0.0",
          description: "SendGrid email",
          author: null,
          homepage: null,
          fields: [],
          dependencies: [],
          tags: [],
          supports_health_check: true,
          supports_test_connection: true,
        },
        status: "configured",
        last_health_check: null,
        last_error: null,
        has_configuration: true,
        configuration_version: "1.0.0",
      };

      (apiClient.post as jest.Mock).mockResolvedValue({
        data: mockInstance,
      });

      const { result } = renderHook(() => useCreatePluginInstance(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const created = await result.current.mutateAsync({
          plugin_name: "sendgrid",
          instance_name: "Production SendGrid",
          configuration: { api_key: "SG.xxx" },
        });
        expect(created).toEqual(mockInstance);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/plugins/instances", {
        plugin_name: "sendgrid",
        instance_name: "Production SendGrid",
        configuration: { api_key: "SG.xxx" },
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Plugin instance created",
        description: "Production SendGrid was created successfully.",
      });
    });

    it("should invalidate queries after successful creation", async () => {
      const mockInstance: PluginInstance = {
        id: "inst-1",
        plugin_name: "sendgrid",
        instance_name: "Test Instance",
        config_schema: {
          name: "sendgrid",
          type: "notification",
          version: "1.0.0",
          description: "",
          author: null,
          homepage: null,
          fields: [],
          dependencies: [],
          tags: [],
          supports_health_check: false,
          supports_test_connection: false,
        },
        status: "configured",
        last_health_check: null,
        last_error: null,
        has_configuration: true,
        configuration_version: null,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { plugins: [], total: 0 },
      });
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: mockInstance,
      });

      const wrapper = createWrapper();
      const { result: listResult } = renderHook(() => usePluginInstances(), { wrapper });
      await waitFor(() => expect(listResult.current.isLoading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      const { result: createResult } = renderHook(() => useCreatePluginInstance(), { wrapper });

      await act(async () => {
        await createResult.current.mutateAsync({
          plugin_name: "sendgrid",
          instance_name: "Test Instance",
          configuration: {},
        });
      });

      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it("should handle create error", async () => {
      const error = {
        response: {
          data: {
            detail: "Plugin already exists",
          },
        },
      };

      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCreatePluginInstance(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            plugin_name: "sendgrid",
            instance_name: "Test",
            configuration: {},
          });
        } catch (e) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Creation failed",
          description: "Plugin already exists",
          variant: "destructive",
        });
      });
    });

    it("should handle create error without detail", async () => {
      const error = new Error("Network error");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCreatePluginInstance(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            plugin_name: "sendgrid",
            instance_name: "Test",
            configuration: {},
          });
        } catch (e) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Creation failed",
          description: "Failed to create plugin instance",
          variant: "destructive",
        });
      });
    });
  });

  describe("useUpdatePluginConfiguration - mutation", () => {
    it("should update plugin configuration successfully", async () => {
      (apiClient.put as jest.Mock).mockResolvedValue({
        data: { message: "Configuration updated successfully" },
      });

      const { result } = renderHook(() => useUpdatePluginConfiguration(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const updated = await result.current.mutateAsync({
          instanceId: "inst-1",
          data: {
            configuration: { api_key: "SG.new" },
          },
        });
        expect(updated).toEqual({ message: "Configuration updated successfully" });
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        "/plugins/instances/inst-1/configuration",
        { configuration: { api_key: "SG.new" } }
      );

      expect(mockToast).toHaveBeenCalledWith({
        title: "Configuration updated",
        description: "Plugin configuration was updated successfully.",
      });
    });

    it("should invalidate queries after successful update", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { plugins: [], total: 0 },
      });
      (apiClient.put as jest.Mock).mockResolvedValue({
        data: { message: "Updated" },
      });

      const wrapper = createWrapper();
      const { result: listResult } = renderHook(() => usePluginInstances(), { wrapper });
      await waitFor(() => expect(listResult.current.isLoading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      const { result: updateResult } = renderHook(() => useUpdatePluginConfiguration(), { wrapper });

      await act(async () => {
        await updateResult.current.mutateAsync({
          instanceId: "inst-1",
          data: { configuration: {} },
        });
      });

      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it("should handle update error", async () => {
      const error = {
        response: {
          data: {
            detail: "Invalid configuration",
          },
        },
      };

      (apiClient.put as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useUpdatePluginConfiguration(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            instanceId: "inst-1",
            data: { configuration: {} },
          });
        } catch (e) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Update failed",
          description: "Invalid configuration",
          variant: "destructive",
        });
      });
    });

    it("should handle update error without detail", async () => {
      const error = new Error("Network error");
      (apiClient.put as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useUpdatePluginConfiguration(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            instanceId: "inst-1",
            data: { configuration: {} },
          });
        } catch (e) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Update failed",
          description: "Failed to update configuration",
          variant: "destructive",
        });
      });
    });
  });

  describe("useDeletePluginInstance - mutation", () => {
    it("should delete plugin instance successfully", async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({
        status: 200,
      });

      const { result } = renderHook(() => useDeletePluginInstance(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("inst-1");
      });

      expect(apiClient.delete).toHaveBeenCalledWith("/plugins/instances/inst-1");

      expect(mockToast).toHaveBeenCalledWith({
        title: "Plugin instance deleted",
        description: "Plugin instance was removed successfully.",
      });
    });

    it("should invalidate queries after successful deletion", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { plugins: [], total: 0 },
      });
      (apiClient.delete as jest.Mock).mockResolvedValue({
        status: 200,
      });

      const wrapper = createWrapper();
      const { result: listResult } = renderHook(() => usePluginInstances(), { wrapper });
      await waitFor(() => expect(listResult.current.isLoading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      const { result: deleteResult } = renderHook(() => useDeletePluginInstance(), { wrapper });

      await act(async () => {
        await deleteResult.current.mutateAsync("inst-1");
      });

      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it("should handle delete error", async () => {
      const error = {
        response: {
          data: {
            detail: "Cannot delete active plugin",
          },
        },
      };

      (apiClient.delete as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useDeletePluginInstance(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync("inst-1");
        } catch (e) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Deletion failed",
          description: "Cannot delete active plugin",
          variant: "destructive",
        });
      });
    });

    it("should handle delete error without detail", async () => {
      const error = new Error("Network error");
      (apiClient.delete as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useDeletePluginInstance(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync("inst-1");
        } catch (e) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Deletion failed",
          description: "Failed to delete plugin instance",
          variant: "destructive",
        });
      });
    });

    it("should handle non-2xx status codes", async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({
        status: 400,
      });

      const { result } = renderHook(() => useDeletePluginInstance(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync("inst-1");
        })
      ).rejects.toThrow("Failed to delete plugin instance");
    });
  });

  describe("useTestPluginConnection - mutation", () => {
    it("should test plugin connection successfully", async () => {
      const mockTestResult: PluginTestResult = {
        success: true,
        message: "Connection successful",
        details: { response_code: 200 },
        timestamp: "2024-01-01T00:00:00Z",
        response_time_ms: 150,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({
        data: mockTestResult,
      });

      const { result } = renderHook(() => useTestPluginConnection(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const testResult = await result.current.mutateAsync({
          instanceId: "inst-1",
          configuration: { api_key: "test" },
        });
        expect(testResult).toEqual(mockTestResult);
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        "/plugins/instances/inst-1/test",
        { configuration: { api_key: "test" } }
      );
    });

    it("should test connection without configuration", async () => {
      const mockTestResult: PluginTestResult = {
        success: true,
        message: "Connection successful",
        details: {},
        timestamp: "2024-01-01T00:00:00Z",
        response_time_ms: null,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({
        data: mockTestResult,
      });

      const { result } = renderHook(() => useTestPluginConnection(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          instanceId: "inst-1",
          configuration: null,
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        "/plugins/instances/inst-1/test",
        { configuration: null }
      );
    });

    it("should handle test failure", async () => {
      const mockTestResult: PluginTestResult = {
        success: false,
        message: "Connection failed",
        details: { error: "Invalid API key" },
        timestamp: "2024-01-01T00:00:00Z",
        response_time_ms: 50,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({
        data: mockTestResult,
      });

      const { result } = renderHook(() => useTestPluginConnection(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const testResult = await result.current.mutateAsync({
          instanceId: "inst-1",
          configuration: {},
        });
        expect(testResult.success).toBe(false);
      });
    });

    it("should handle test error", async () => {
      const error = new Error("Test failed");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useTestPluginConnection(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            instanceId: "inst-1",
            configuration: {},
          });
        })
      ).rejects.toThrow("Test failed");
    });
  });

  describe("usePluginHealthCheck - query", () => {
    it("should fetch plugin health check successfully", async () => {
      const mockHealth: PluginHealthCheck = {
        plugin_instance_id: "inst-1",
        status: "healthy",
        message: "All systems operational",
        details: { uptime: "99.9%" },
        timestamp: "2024-01-01T00:00:00Z",
        response_time_ms: 25,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockHealth,
      });

      const { result } = renderHook(() => usePluginHealthCheck("inst-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockHealth);
      expect(apiClient.get).toHaveBeenCalledWith("/plugins/instances/inst-1/health");
    });

    it("should not fetch when instance ID is empty", async () => {
      const { result } = renderHook(() => usePluginHealthCheck(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should handle unhealthy status", async () => {
      const mockHealth: PluginHealthCheck = {
        plugin_instance_id: "inst-1",
        status: "unhealthy",
        message: "Service unavailable",
        details: { error: "Connection timeout" },
        timestamp: "2024-01-01T00:00:00Z",
        response_time_ms: null,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockHealth,
      });

      const { result } = renderHook(() => usePluginHealthCheck("inst-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.status).toBe("unhealthy");
      expect(result.current.data?.message).toBe("Service unavailable");
    });

    it("should refetch on interval", async () => {
      jest.useFakeTimers();

      const mockHealth: PluginHealthCheck = {
        plugin_instance_id: "inst-1",
        status: "healthy",
        message: null,
        details: {},
        timestamp: "2024-01-01T00:00:00Z",
        response_time_ms: null,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockHealth,
      });

      renderHook(() => usePluginHealthCheck("inst-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledTimes(1);
      });

      // Fast forward 60 seconds (refetchInterval is 60000ms)
      jest.advanceTimersByTime(60000);

      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(1);
      });

      jest.useRealTimers();
    });

    it("should accept custom query options", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: {},
      });

      const { result } = renderHook(
        () => usePluginHealthCheck("inst-1", { refetchInterval: false }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });
  });

  describe("useBulkHealthCheck - mutation", () => {
    it("should perform bulk health check successfully", async () => {
      const mockHealthResults: PluginHealthCheck[] = [
        {
          plugin_instance_id: "inst-1",
          status: "healthy",
          message: null,
          details: {},
          timestamp: "2024-01-01T00:00:00Z",
          response_time_ms: 20,
        },
        {
          plugin_instance_id: "inst-2",
          status: "unhealthy",
          message: "Connection failed",
          details: {},
          timestamp: "2024-01-01T00:00:00Z",
          response_time_ms: 100,
        },
      ];

      (apiClient.post as jest.Mock).mockResolvedValue({
        data: mockHealthResults,
      });

      const { result } = renderHook(() => useBulkHealthCheck(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const results = await result.current.mutateAsync(["inst-1", "inst-2"]);
        expect(results).toEqual(mockHealthResults);
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        "/plugins/instances/health-check",
        { instance_ids: ["inst-1", "inst-2"] }
      );
    });

    it("should check all instances when no IDs provided", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: [],
      });

      const { result } = renderHook(() => useBulkHealthCheck(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync(null);
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        "/plugins/instances/health-check",
        { instance_ids: null }
      );
    });

    it("should handle bulk health check error", async () => {
      const error = new Error("Health check failed");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useBulkHealthCheck(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync([]);
        })
      ).rejects.toThrow("Health check failed");
    });
  });

  describe("useRefreshPlugins - mutation", () => {
    it("should refresh plugins successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: {
          message: "Plugins refreshed",
          available_plugins: 15,
        },
      });

      const { result } = renderHook(() => useRefreshPlugins(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const response = await result.current.mutateAsync();
        expect(response.available_plugins).toBe(15);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/plugins/refresh");

      expect(mockToast).toHaveBeenCalledWith({
        title: "Plugins refreshed",
        description: "Found 15 available plugins.",
      });
    });

    it("should invalidate available plugins query after refresh", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: [],
      });
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: {
          message: "Refreshed",
          available_plugins: 5,
        },
      });

      const wrapper = createWrapper();
      const { result: availableResult } = renderHook(() => useAvailablePlugins(), { wrapper });
      await waitFor(() => expect(availableResult.current.isLoading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      const { result: refreshResult } = renderHook(() => useRefreshPlugins(), { wrapper });

      await act(async () => {
        await refreshResult.current.mutateAsync();
      });

      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it("should handle refresh error", async () => {
      const error = {
        response: {
          data: {
            detail: "Refresh service unavailable",
          },
        },
      };

      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useRefreshPlugins(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync();
        } catch (e) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Refresh failed",
          description: "Refresh service unavailable",
          variant: "destructive",
        });
      });
    });

    it("should handle refresh error without detail", async () => {
      const error = new Error("Network error");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useRefreshPlugins(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync();
        } catch (e) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Refresh failed",
          description: "Failed to refresh plugins",
          variant: "destructive",
        });
      });
    });
  });

  describe("Utility Functions", () => {
    describe("getStatusColor", () => {
      it("should return correct color for each status", () => {
        expect(getStatusColor("registered")).toBe("bg-gray-500/15 text-gray-300 border border-gray-500/30");
        expect(getStatusColor("configured")).toBe("bg-blue-500/15 text-blue-300 border border-blue-500/30");
        expect(getStatusColor("active")).toBe("bg-emerald-500/15 text-emerald-300 border border-emerald-500/30");
        expect(getStatusColor("inactive")).toBe("bg-yellow-500/15 text-yellow-300 border border-yellow-500/30");
        expect(getStatusColor("error")).toBe("bg-red-500/15 text-red-300 border border-red-500/30");
      });

      it("should return default color for invalid status", () => {
        expect(getStatusColor("invalid" as PluginStatus)).toBe("bg-gray-500/15 text-gray-300 border border-gray-500/30");
      });
    });

    describe("getHealthStatusColor", () => {
      it("should return correct color for each health status", () => {
        expect(getHealthStatusColor("healthy")).toBe("text-emerald-400");
        expect(getHealthStatusColor("unhealthy")).toBe("text-red-400");
        expect(getHealthStatusColor("unknown")).toBe("text-gray-400");
        expect(getHealthStatusColor("error")).toBe("text-red-500");
      });

      it("should return default color for invalid status", () => {
        expect(getHealthStatusColor("invalid")).toBe("text-gray-400");
      });
    });

    describe("groupFields", () => {
      it("should group fields by group name", () => {
        const fields: FieldSpec[] = [
          {
            key: "api_key",
            label: "API Key",
            type: "secret",
            description: null,
            required: true,
            default: null,
            validation_rules: [],
            min_length: null,
            max_length: null,
            min_value: null,
            max_value: null,
            pattern: null,
            options: [],
            placeholder: null,
            help_text: null,
            group: "Authentication",
            order: 1,
            is_secret: true,
          },
          {
            key: "api_url",
            label: "API URL",
            type: "url",
            description: null,
            required: true,
            default: null,
            validation_rules: [],
            min_length: null,
            max_length: null,
            min_value: null,
            max_value: null,
            pattern: null,
            options: [],
            placeholder: null,
            help_text: null,
            group: "Authentication",
            order: 2,
            is_secret: false,
          },
          {
            key: "timeout",
            label: "Timeout",
            type: "integer",
            description: null,
            required: false,
            default: 30,
            validation_rules: [],
            min_length: null,
            max_length: null,
            min_value: 1,
            max_value: 300,
            pattern: null,
            options: [],
            placeholder: null,
            help_text: null,
            group: "Advanced",
            order: 1,
            is_secret: false,
          },
        ];

        const grouped = groupFields(fields);

        expect(grouped["Authentication"]).toHaveLength(2);
        expect(grouped["Advanced"]).toHaveLength(1);
        expect(grouped["Authentication"][0].key).toBe("api_key");
        expect(grouped["Authentication"][1].key).toBe("api_url");
        expect(grouped["Advanced"][0].key).toBe("timeout");
      });

      it("should use 'General' for fields without group", () => {
        const fields: FieldSpec[] = [
          {
            key: "name",
            label: "Name",
            type: "string",
            description: null,
            required: true,
            default: null,
            validation_rules: [],
            min_length: null,
            max_length: null,
            min_value: null,
            max_value: null,
            pattern: null,
            options: [],
            placeholder: null,
            help_text: null,
            group: null,
            order: 1,
            is_secret: false,
          },
        ];

        const grouped = groupFields(fields);

        expect(grouped["General"]).toHaveLength(1);
        expect(grouped["General"][0].key).toBe("name");
      });

      it("should sort fields within each group by order", () => {
        const fields: FieldSpec[] = [
          {
            key: "field3",
            label: "Field 3",
            type: "string",
            description: null,
            required: false,
            default: null,
            validation_rules: [],
            min_length: null,
            max_length: null,
            min_value: null,
            max_value: null,
            pattern: null,
            options: [],
            placeholder: null,
            help_text: null,
            group: "Group1",
            order: 3,
            is_secret: false,
          },
          {
            key: "field1",
            label: "Field 1",
            type: "string",
            description: null,
            required: false,
            default: null,
            validation_rules: [],
            min_length: null,
            max_length: null,
            min_value: null,
            max_value: null,
            pattern: null,
            options: [],
            placeholder: null,
            help_text: null,
            group: "Group1",
            order: 1,
            is_secret: false,
          },
          {
            key: "field2",
            label: "Field 2",
            type: "string",
            description: null,
            required: false,
            default: null,
            validation_rules: [],
            min_length: null,
            max_length: null,
            min_value: null,
            max_value: null,
            pattern: null,
            options: [],
            placeholder: null,
            help_text: null,
            group: "Group1",
            order: 2,
            is_secret: false,
          },
        ];

        const grouped = groupFields(fields);

        expect(grouped["Group1"]).toHaveLength(3);
        expect(grouped["Group1"][0].key).toBe("field1");
        expect(grouped["Group1"][1].key).toBe("field2");
        expect(grouped["Group1"][2].key).toBe("field3");
      });

      it("should handle empty fields array", () => {
        const grouped = groupFields([]);
        expect(Object.keys(grouped)).toHaveLength(0);
      });
    });

    describe("formatTimestamp", () => {
      it("should return 'Never' for null timestamp", () => {
        expect(formatTimestamp(null)).toBe("Never");
      });

      it("should return 'Never' for undefined timestamp", () => {
        expect(formatTimestamp(undefined)).toBe("Never");
      });

      it("should return 'Just now' for very recent timestamp", () => {
        const now = new Date().toISOString();
        expect(formatTimestamp(now)).toBe("Just now");
      });

      it("should format minutes ago", () => {
        const date = new Date();
        date.setMinutes(date.getMinutes() - 5);
        expect(formatTimestamp(date.toISOString())).toBe("5 minutes ago");
      });

      it("should format single minute ago", () => {
        const date = new Date();
        date.setMinutes(date.getMinutes() - 1);
        expect(formatTimestamp(date.toISOString())).toBe("1 minute ago");
      });

      it("should format hours ago", () => {
        const date = new Date();
        date.setHours(date.getHours() - 3);
        expect(formatTimestamp(date.toISOString())).toBe("3 hours ago");
      });

      it("should format single hour ago", () => {
        const date = new Date();
        date.setHours(date.getHours() - 1);
        expect(formatTimestamp(date.toISOString())).toBe("1 hour ago");
      });

      it("should format days ago", () => {
        const date = new Date();
        date.setDate(date.getDate() - 5);
        expect(formatTimestamp(date.toISOString())).toBe("5 days ago");
      });

      it("should format single day ago", () => {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        expect(formatTimestamp(date.toISOString())).toBe("1 day ago");
      });

      it("should return date string for old timestamps", () => {
        const date = new Date();
        date.setDate(date.getDate() - 45);
        const result = formatTimestamp(date.toISOString());
        expect(result).toBe(date.toLocaleDateString());
      });
    });
  });

  describe("Field types", () => {
    it("should handle all field types", () => {
      const fieldTypes = [
        "string",
        "text",
        "integer",
        "float",
        "boolean",
        "select",
        "multi_select",
        "secret",
        "url",
        "email",
        "phone",
        "json",
        "array",
      ];

      fieldTypes.forEach((type) => {
        const field: FieldSpec = {
          key: `field_${type}`,
          label: `Field ${type}`,
          type: type as any,
          description: null,
          required: false,
          default: null,
          validation_rules: [],
          min_length: null,
          max_length: null,
          min_value: null,
          max_value: null,
          pattern: null,
          options: [],
          placeholder: null,
          help_text: null,
          group: null,
          order: 1,
          is_secret: false,
        };

        expect(field.type).toBe(type);
      });
    });
  });

  describe("Query options", () => {
    it("should respect enabled option in all query hooks", async () => {
      const hooks = [
        () => useAvailablePlugins({ enabled: false }),
        () => usePluginInstances({ enabled: false }),
        () => usePluginSchema("test", { enabled: false }),
        () => usePluginInstance("test", { enabled: false }),
        () => usePluginConfiguration("test", { enabled: false }),
        () => usePluginHealthCheck("test", { enabled: false }),
      ];

      for (const hook of hooks) {
        const { result } = renderHook(hook, {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isFetching).toBe(false));

        expect(apiClient.get).not.toHaveBeenCalled();
        jest.clearAllMocks();
      }
    });
  });
});
