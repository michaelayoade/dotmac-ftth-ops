/**
 * MSW Tests for usePlugins hook
 * Tests plugin management system with realistic API mocking
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { createQueryWrapper } from "@/__tests__/test-utils";
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
} from "../usePlugins";
import {
  seedPlugins,
  seedInstances,
  clearPluginData,
} from "@/__tests__/msw/handlers/plugins";

// Mock useToast
jest.mock("@dotmac/ui", () => ({
  ...jest.requireActual("@dotmac/ui"),
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

const waitForPluginsLoading = async (getLoading: () => boolean) => {
  await waitFor(() => expect(getLoading()).toBe(false), { timeout: 5000 });
};

const waitForPluginsSuccess = async (getStatus: () => boolean) => {
  await waitFor(() => expect(getStatus()).toBe(true), { timeout: 5000 });
};

describe("usePlugins", () => {
  beforeEach(() => {
    clearPluginData();
  });

  describe("useAvailablePlugins", () => {
    it("should fetch available plugins successfully", async () => {
      seedPlugins([
        {
          name: "slack-notification",
          type: "notification",
          version: "1.0.0",
          description: "Send notifications to Slack",
        },
        {
          name: "stripe-payment",
          type: "payment",
          version: "2.1.0",
          description: "Process payments via Stripe",
        },
      ]);

      const { result } = renderHook(() => useAvailablePlugins(), {
        wrapper: createQueryWrapper(),
      });

      await waitForPluginsLoading(() => result.current.isLoading);

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].name).toBe("slack-notification");
    });

    it("should return empty array when no plugins", async () => {
      const { result } = renderHook(() => useAvailablePlugins(), {
        wrapper: createQueryWrapper(),
      });

      await waitForPluginsLoading(() => result.current.isLoading);

      expect(result.current.data).toEqual([]);
    });
  });

  describe("usePluginInstances", () => {
    it("should fetch plugin instances successfully", async () => {
      seedInstances([
        {
          id: "inst-1",
          plugin_name: "slack-notification",
          instance_name: "Production Slack",
          status: "active",
        },
        {
          id: "inst-2",
          plugin_name: "stripe-payment",
          instance_name: "Main Payment Gateway",
          status: "configured",
        },
      ]);

      const { result } = renderHook(() => usePluginInstances(), {
        wrapper: createQueryWrapper(),
      });

      await waitForPluginsLoading(() => result.current.isLoading);

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.plugins).toHaveLength(2);
      expect(result.current.data?.total).toBe(2);
    });
  });

  describe("usePluginSchema", () => {
    it("should fetch plugin schema successfully", async () => {
      seedPlugins([
        {
          name: "test-plugin",
          type: "notification",
          version: "1.0.0",
          description: "Test plugin",
          fields: [
            {
              key: "api_key",
              label: "API Key",
              type: "secret",
              required: true,
              validation_rules: [],
              options: [],
              order: 1,
              is_secret: true,
              description: "Your API key",
            },
          ],
        },
      ]);

      const { result } = renderHook(() => usePluginSchema("test-plugin"), {
        wrapper: createQueryWrapper(),
      });

      await waitForPluginsLoading(() => result.current.isLoading);

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.schema.name).toBe("test-plugin");
      expect(result.current.data?.schema.fields).toHaveLength(1);
    });

    it("should handle plugin not found", async () => {
      const { result } = renderHook(() => usePluginSchema("nonexistent"), {
        wrapper: createQueryWrapper(),
      });

      await waitForPluginsLoading(() => result.current.isLoading);

      expect(result.current.isError).toBe(true);
    });

    it("should not fetch when pluginName is empty", () => {
      const { result } = renderHook(() => usePluginSchema(""), {
        wrapper: createQueryWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("usePluginInstance", () => {
    it("should fetch single instance successfully", async () => {
      seedInstances([
        {
          id: "inst-123",
          plugin_name: "test-plugin",
          instance_name: "Test Instance",
          status: "active",
          has_configuration: true,
        },
      ]);

      const { result } = renderHook(() => usePluginInstance("inst-123"), {
        wrapper: createQueryWrapper(),
      });

      await waitForPluginsLoading(() => result.current.isLoading);

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.id).toBe("inst-123");
      expect(result.current.data?.has_configuration).toBe(true);
    });

    it("should not fetch when instanceId is empty", () => {
      const { result } = renderHook(() => usePluginInstance(""), {
        wrapper: createQueryWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("usePluginConfiguration", () => {
    it("should fetch plugin configuration", async () => {
      seedPlugins([
        {
          name: "test-plugin",
          type: "notification",
          version: "1.0.0",
          description: "Test",
        },
      ]);

      seedInstances([
        {
          id: "inst-config-1",
          plugin_name: "test-plugin",
          instance_name: "Test",
          has_configuration: true,
        },
      ]);

      const { result } = renderHook(() => usePluginConfiguration("inst-config-1"), {
        wrapper: createQueryWrapper(),
      });

      await waitForPluginsLoading(() => result.current.isLoading);

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.plugin_instance_id).toBe("inst-config-1");
      expect(result.current.data?.schema).toBeDefined();
    });
  });

  describe("useCreatePluginInstance", () => {
    it("should create plugin instance successfully", async () => {
      seedPlugins([
        {
          name: "new-plugin",
          type: "notification",
          version: "1.0.0",
          description: "New plugin",
        },
      ]);

      const { result } = renderHook(() => useCreatePluginInstance(), {
        wrapper: createQueryWrapper(),
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

      // Wait for mutation state to settle
      await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.plugin_name).toBe("new-plugin");
      expect(result.current.data?.instance_name).toBe("My Instance");
      expect(result.current.data?.status).toBe("configured");
    });

    it("should handle plugin not found", async () => {
      const { result } = renderHook(() => useCreatePluginInstance(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            plugin_name: "nonexistent",
            instance_name: "Test",
            configuration: {},
          });
        } catch (error) {
          // Expected to fail
        }
      });

      // Wait for mutation state to settle
      await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

      expect(result.current.isError).toBe(true);
    });
  });

  describe("useUpdatePluginConfiguration", () => {
    it("should update configuration successfully", async () => {
      seedInstances([
        {
          id: "inst-update-1",
          plugin_name: "test-plugin",
          instance_name: "Test",
          status: "registered",
        },
      ]);

      const { result } = renderHook(() => useUpdatePluginConfiguration(), {
        wrapper: createQueryWrapper(),
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

      // Wait for mutation state to settle
      await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.message).toContain("updated");
    });

    it("should handle instance not found", async () => {
      const { result } = renderHook(() => useUpdatePluginConfiguration(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            instanceId: "nonexistent",
            data: { configuration: {} },
          });
        } catch (error) {
          // Expected to fail
        }
      });

      // Wait for mutation state to settle
      await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

      expect(result.current.isError).toBe(true);
    });
  });

  describe("useDeletePluginInstance", () => {
    it("should delete instance successfully", async () => {
      seedInstances([
        {
          id: "inst-delete-1",
          plugin_name: "test-plugin",
          instance_name: "To Delete",
        },
      ]);

      const { result } = renderHook(() => useDeletePluginInstance(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("inst-delete-1");
      });

      // Wait for mutation state to settle
      await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

      expect(result.current.isSuccess).toBe(true);
    });

    it("should handle delete non-existent instance", async () => {
      const { result } = renderHook(() => useDeletePluginInstance(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync("nonexistent");
        } catch (error) {
          // Expected to fail
        }
      });

      // Wait for mutation state to settle
      await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

      expect(result.current.isError).toBe(true);
    });
  });

  describe("useTestPluginConnection", () => {
    it("should test connection successfully", async () => {
      seedInstances([
        {
          id: "inst-test-1",
          plugin_name: "test-plugin",
          instance_name: "Test",
          status: "active",
        },
      ]);

      const { result } = renderHook(() => useTestPluginConnection(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          instanceId: "inst-test-1",
          configuration: {
            api_key: "test-key",
          },
        });
      });

      // Wait for mutation state to settle
      await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.success).toBe(true);
      expect(result.current.data?.message).toContain("successful");
    });

    it("should handle failed connection test", async () => {
      seedInstances([
        {
          id: "inst-error-1",
          plugin_name: "test-plugin",
          instance_name: "Error Instance",
          status: "error",
        },
      ]);

      const { result } = renderHook(() => useTestPluginConnection(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          instanceId: "inst-error-1",
        });
      });

      // Wait for mutation state to settle
      await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

      expect(result.current.data?.success).toBe(false);
    });
  });

  describe("usePluginHealthCheck", () => {
    it("should fetch health check for active instance", async () => {
      seedInstances([
        {
          id: "inst-health-1",
          plugin_name: "test-plugin",
          instance_name: "Healthy Instance",
          status: "active",
        },
      ]);

      const { result } = renderHook(() => usePluginHealthCheck("inst-health-1"), {
        wrapper: createQueryWrapper(),
      });

      await waitForPluginsLoading(() => result.current.isLoading);

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.status).toBe("healthy");
      expect(result.current.data?.plugin_instance_id).toBe("inst-health-1");
    });

    it("should show unhealthy for inactive instance", async () => {
      seedInstances([
        {
          id: "inst-inactive-1",
          plugin_name: "test-plugin",
          instance_name: "Inactive Instance",
          status: "inactive",
        },
      ]);

      const { result } = renderHook(() => usePluginHealthCheck("inst-inactive-1"), {
        wrapper: createQueryWrapper(),
      });

      await waitForPluginsLoading(() => result.current.isLoading);

      expect(result.current.data?.status).toBe("unhealthy");
    });
  });

  describe("useBulkHealthCheck", () => {
    it("should check health of multiple instances", async () => {
      seedInstances([
        { id: "inst-1", status: "active" },
        { id: "inst-2", status: "inactive" },
        { id: "inst-3", status: "error" },
      ]);

      const { result } = renderHook(() => useBulkHealthCheck(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync(["inst-1", "inst-2"]);
      });

      // Wait for mutation state to settle
      await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toHaveLength(2);
    });

    it("should check all instances when no IDs provided", async () => {
      seedInstances([
        { id: "inst-1", status: "active" },
        { id: "inst-2", status: "active" },
      ]);

      const { result } = renderHook(() => useBulkHealthCheck(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync(null);
      });

      // Wait for mutation state to settle
      await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

      expect(result.current.data).toHaveLength(2);
    });
  });

  describe("useRefreshPlugins", () => {
    it("should refresh plugins successfully", async () => {
      seedPlugins([
        { name: "plugin-1", type: "notification", version: "1.0.0", description: "Plugin 1" },
      ]);

      const { result } = renderHook(() => useRefreshPlugins(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync();
      });

      // Wait for mutation state to settle
      await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.available_plugins).toBe(1);
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
      // Setup available plugins
      seedPlugins([
        {
          name: "email-notification",
          type: "notification",
          version: "2.0.0",
          description: "Send email notifications",
          fields: [
            {
              key: "smtp_host",
              label: "SMTP Host",
              type: "string",
              required: true,
              validation_rules: [],
              options: [],
              order: 1,
              is_secret: false,
            },
          ],
        },
      ]);

      // Get schema
      const { result: schemaResult } = renderHook(
        () => usePluginSchema("email-notification"),
        { wrapper: createQueryWrapper() }
      );

      await waitForPluginsLoading(() => schemaResult.current.isLoading);
      expect(schemaResult.current.data?.schema.name).toBe("email-notification");

      // Create instance
      const { result: createResult } = renderHook(() => useCreatePluginInstance(), {
        wrapper: createQueryWrapper(),
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

      // Wait for mutation state to settle
      await waitFor(() => expect(createResult.current.isSuccess || createResult.current.isError).toBe(true));

      // Test connection
      const { result: testResult } = renderHook(() => useTestPluginConnection(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await testResult.current.mutateAsync({ instanceId: instanceId! });
      });

      // Wait for mutation state to settle
      await waitFor(() => expect(testResult.current.isSuccess || testResult.current.isError).toBe(true));

      expect(testResult.current.data?.success).toBe(true);
    });
  });
});
