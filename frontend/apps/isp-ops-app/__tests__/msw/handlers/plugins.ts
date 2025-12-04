/**
 * MSW Handlers for Plugin Management API
 * Mocks plugin registry, instances, configuration, and health checks
 */

import { http, HttpResponse } from "msw";
import type {
  PluginConfig,
  PluginInstance,
  PluginListResponse,
  PluginHealthCheck,
  PluginTestResult,
  PluginConfigurationResponse,
  CreatePluginInstanceRequest,
  UpdatePluginConfigurationRequest,
  PluginStatus,
  PluginType,
} from "@/hooks/usePlugins";

// In-memory storage
let availablePlugins: PluginConfig[] = [];
let instances: PluginInstance[] = [];
let configurations: Map<string, Record<string, any>> = new Map();
let nextInstanceId = 1;

// Factory functions
function createMockPlugin(data: Partial<PluginConfig> = {}): PluginConfig {
  return {
    name: data.name || `plugin-${Date.now()}`,
    type: data.type || "notification",
    version: data.version || "1.0.0",
    description: data.description || "A test plugin",
    author: data.author || "DotMac",
    homepage: data.homepage || null,
    fields: data.fields || [],
    dependencies: data.dependencies || [],
    tags: data.tags || [],
    supports_health_check: data.supports_health_check ?? true,
    supports_test_connection: data.supports_test_connection ?? true,
    ...data,
  };
}

function createMockInstance(data: Partial<PluginInstance> = {}): PluginInstance {
  const pluginName = data.plugin_name || "test-plugin";
  const pluginConfig =
    availablePlugins.find((p) => p.name === pluginName) || createMockPlugin({ name: pluginName });

  return {
    id: data.id || `instance-${nextInstanceId++}`,
    plugin_name: pluginName,
    instance_name: data.instance_name || `Instance ${nextInstanceId}`,
    config_schema: pluginConfig,
    status: data.status || "registered",
    last_health_check: data.last_health_check || null,
    last_error: data.last_error || null,
    has_configuration: data.has_configuration ?? false,
    configuration_version: data.configuration_version || null,
    ...data,
  };
}

// Seed functions
export function seedPlugins(plugins: Partial<PluginConfig>[]): void {
  availablePlugins = plugins.map(createMockPlugin);
}

export function seedInstances(instancesList: Partial<PluginInstance>[]): void {
  instances = instancesList.map(createMockInstance);
}

export function clearPluginData(): void {
  availablePlugins = [];
  instances = [];
  configurations.clear();
  nextInstanceId = 1;
}

export const pluginsHandlers = [
  // GET /api/v1/plugins - List available plugins
  http.get("*/api/v1/plugins", ({ request }) => {
    return HttpResponse.json(availablePlugins);
  }),

  // GET /api/v1/plugins/instances/health-check - Must come before /:instanceId
  http.post("*/api/v1/plugins/instances/health-check", async (req) => {
    const body = await req.json<{ instance_ids: string[] | null }>();
    const targetIds = body.instance_ids || instances.map((i) => i.id);

    const healthChecks: PluginHealthCheck[] = targetIds.map((id) => {
      const instance = instances.find((i) => i.id === id);
      if (!instance) {
        return {
          plugin_instance_id: id,
          status: "error" as const,
          message: "Instance not found",
          details: {},
          timestamp: new Date().toISOString(),
        };
      }

      return {
        plugin_instance_id: id,
        status: instance.status === "active" ? "healthy" : "unhealthy",
        message: instance.status === "active" ? "Plugin is healthy" : "Plugin is not active",
        details: { instance_status: instance.status },
        timestamp: new Date().toISOString(),
        response_time_ms: Math.random() * 100,
      };
    });

    return HttpResponse.json(healthChecks);
  }),

  // GET /api/v1/plugins/instances - List plugin instances
  http.get("*/api/v1/plugins/instances", ({ request }) => {
    const response: PluginListResponse = {
      plugins: instances,
      total: instances.length,
    };

    return HttpResponse.json(response);
  }),

  // GET /api/v1/plugins/:pluginName/schema - Get plugin schema
  http.get("*/api/v1/plugins/:pluginName/schema", ({ params }) => {
    const pluginName = params.pluginName as string;
    const plugin = availablePlugins.find((p) => p.name === pluginName);

    if (!plugin) {
      return HttpResponse.json({ detail: "Plugin not found" }, { status: 404 });
    }

    const instance = instances.find((i) => i.plugin_name === pluginName);

    return HttpResponse.json({
      schema: plugin,
      instance_id: instance?.id || null,
    });
  }),

  // GET /api/v1/plugins/instances/:instanceId/health - Health check
  http.get("*/api/v1/plugins/instances/:instanceId/health", ({ params }) => {
    const instanceId = params.instanceId as string;
    const instance = instances.find((i) => i.id === instanceId);

    if (!instance) {
      return HttpResponse.json({ detail: "Plugin instance not found" }, { status: 404 });
    }

    const healthCheck: PluginHealthCheck = {
      plugin_instance_id: instanceId as string,
      status: instance.status === "active" ? "healthy" : "unhealthy",
      message:
        instance.status === "active" ? "Plugin is operating normally" : "Plugin is not active",
      details: {
        instance_status: instance.status,
        has_configuration: instance.has_configuration,
        last_error: instance.last_error,
      },
      timestamp: new Date().toISOString(),
      response_time_ms: Math.random() * 100,
    };

    return HttpResponse.json(healthCheck);
  }),

  // GET /api/v1/plugins/instances/:instanceId/configuration - Get configuration
  http.get("*/api/v1/plugins/instances/:instanceId/configuration", ({ params }) => {
    const instanceId = params.instanceId as string;
    const instance = instances.find((i) => i.id === instanceId);

    if (!instance) {
      return HttpResponse.json({ detail: "Plugin instance not found" }, { status: 404 });
    }

    const config = configurations.get(instanceId as string) || {};

    const response: PluginConfigurationResponse = {
      plugin_instance_id: instanceId as string,
      configuration: config,
      schema: instance.config_schema,
      status: instance.status,
      last_updated: new Date().toISOString(),
    };

    return HttpResponse.json(response);
  }),

  // GET /api/v1/plugins/instances/:instanceId - Get plugin instance
  http.get("*/api/v1/plugins/instances/:instanceId", ({ params }) => {
    const instanceId = params.instanceId as string;
    const instance = instances.find((i) => i.id === instanceId);

    if (!instance) {
      return HttpResponse.json({ detail: "Plugin instance not found" }, { status: 404 });
    }

    return HttpResponse.json(instance);
  }),

  // POST /api/v1/plugins/instances - Create plugin instance
  http.post("*/api/v1/plugins/instances", async (req) => {
    const body = await req.json<CreatePluginInstanceRequest>();

    const plugin = availablePlugins.find((p) => p.name === body.plugin_name);
    if (!plugin) {
      return HttpResponse.json({ detail: "Plugin not found" }, { status: 404 });
    }

    const newInstance = createMockInstance({
      plugin_name: body.plugin_name,
      instance_name: body.instance_name,
      status: "configured",
      has_configuration: true,
      configuration_version: "1.0",
    });

    instances.push(newInstance);
    configurations.set(newInstance.id, body.configuration);

    return HttpResponse.json(newInstance);
  }),

  // PUT /api/v1/plugins/instances/:instanceId/configuration - Update configuration
  http.put("*/api/v1/plugins/instances/:instanceId/configuration", async ({ params, request }) => {
    const instanceId = params.instanceId as string;
    const body = await request.json<UpdatePluginConfigurationRequest>();

    const instanceIndex = instances.findIndex((i) => i.id === instanceId);
    if (instanceIndex === -1) {
      return HttpResponse.json({ detail: "Plugin instance not found" }, { status: 404 });
    }

    configurations.set(instanceId as string, body.configuration);
    instances[instanceIndex] = {
      ...instances[instanceIndex],
      has_configuration: true,
      status: "configured",
    };

    return HttpResponse.json({ message: "Configuration updated successfully" });
  }),

  // DELETE /api/v1/plugins/instances/:instanceId - Delete instance
  http.delete("*/api/v1/plugins/instances/:instanceId", ({ params }) => {
    const instanceId = params.instanceId as string;
    const instanceIndex = instances.findIndex((i) => i.id === instanceId);

    if (instanceIndex === -1) {
      return HttpResponse.json({ detail: "Plugin instance not found" }, { status: 404 });
    }

    instances.splice(instanceIndex, 1);
    configurations.delete(instanceId as string);

    return new HttpResponse(null, { status: 204 });
  }),

  // POST /api/v1/plugins/instances/:instanceId/test - Test connection
  http.post("*/api/v1/plugins/instances/:instanceId/test", async ({ params }) => {
    const instanceId = params.instanceId as string;
    const instance = instances.find((i) => i.id === instanceId);

    if (!instance) {
      return HttpResponse.json({ detail: "Plugin instance not found" }, { status: 404 });
    }

    const testResult: PluginTestResult = {
      success: instance.status !== "error",
      message:
        instance.status !== "error" ? "Connection test successful" : "Connection test failed",
      details: {
        plugin_name: instance.plugin_name,
        instance_status: instance.status,
      },
      timestamp: new Date().toISOString(),
      response_time_ms: Math.random() * 200,
    };

    return HttpResponse.json(testResult);
  }),

  // POST /api/v1/plugins/refresh - Refresh plugins
  http.post("*/api/v1/plugins/refresh", (req) => {
    return HttpResponse.json({
      message: "Plugins refreshed successfully",
      available_plugins: availablePlugins.length,
    });
  }),
];
