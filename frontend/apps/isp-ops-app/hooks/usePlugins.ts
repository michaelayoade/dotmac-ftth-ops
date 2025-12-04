/**
 * React Query hooks for plugin management
 *
 * Connects to backend plugin management API:
 * - GET /api/v1/plugins - List available plugins
 * - GET /api/v1/plugins/instances - List plugin instances
 * - GET /api/v1/plugins/{plugin_name}/schema - Get plugin schema
 * - POST /api/v1/plugins/instances - Create plugin instance
 * - GET /api/v1/plugins/instances/{instance_id} - Get plugin instance
 * - PUT /api/v1/plugins/instances/{instance_id}/configuration - Update configuration
 * - DELETE /api/v1/plugins/instances/{instance_id} - Delete instance
 * - GET /api/v1/plugins/instances/{instance_id}/health - Health check
 * - POST /api/v1/plugins/instances/{instance_id}/test - Test connection
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type QueryKey,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import { extractDataOrThrow } from "@/lib/api/response-helpers";

// ============================================
// Types matching backend plugins/schema models
// ============================================

export type FieldType =
  | "string"
  | "text"
  | "integer"
  | "float"
  | "boolean"
  | "select"
  | "multi_select"
  | "secret"
  | "url"
  | "email"
  | "phone"
  | "json"
  | "array";

export type PluginType =
  | "notification"
  | "payment"
  | "storage"
  | "search"
  | "authentication"
  | "integration"
  | "analytics"
  | "workflow";

export type PluginStatus = "registered" | "configured" | "active" | "inactive" | "error";

export interface SelectOption {
  value: string;
  label: string;
  description?: string | null;
}

export interface ValidationRule {
  type: string;
  value: any;
  message?: string | null;
}

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  description?: string | null;
  required: boolean;
  default?: any;
  validation_rules: ValidationRule[];
  min_length?: number | null;
  max_length?: number | null;
  min_value?: number | null;
  max_value?: number | null;
  pattern?: string | null;
  options: SelectOption[];
  placeholder?: string | null;
  help_text?: string | null;
  group?: string | null;
  order: number;
  is_secret: boolean;
}

export interface PluginConfig {
  name: string;
  type: PluginType;
  version: string;
  description: string;
  author?: string | null;
  homepage?: string | null;
  fields: FieldSpec[];
  dependencies: string[];
  tags: string[];
  supports_health_check: boolean;
  supports_test_connection: boolean;
}

export interface PluginInstance {
  id: string;
  plugin_name: string;
  instance_name: string;
  config_schema: PluginConfig;
  status: PluginStatus;
  last_health_check?: string | null;
  last_error?: string | null;
  has_configuration: boolean;
  configuration_version?: string | null;
}

export interface PluginListResponse {
  plugins: PluginInstance[];
  total: number;
}

export interface PluginHealthCheck {
  plugin_instance_id: string;
  status: "healthy" | "unhealthy" | "unknown" | "error";
  message?: string | null;
  details: Record<string, any>;
  timestamp: string;
  response_time_ms?: number | null;
}

export interface PluginTestResult {
  success: boolean;
  message: string;
  details: Record<string, any>;
  timestamp: string;
  response_time_ms?: number | null;
}

export interface PluginConfigurationResponse {
  plugin_instance_id: string;
  configuration: Record<string, any>;
  schema: PluginConfig;
  status: PluginStatus;
  last_updated?: string | null;
}

export interface CreatePluginInstanceRequest {
  plugin_name: string;
  instance_name: string;
  configuration: Record<string, any>;
}

export interface UpdatePluginConfigurationRequest {
  configuration: Record<string, any>;
}

export interface TestConnectionRequest {
  configuration?: Record<string, any> | null;
}

// ============================================
// Query Hooks
// ============================================

type QueryOptions<TData, TKey extends QueryKey> = Omit<
  UseQueryOptions<TData, Error, TData, TKey>,
  "queryKey" | "queryFn"
>;

/**
 * Fetch all available plugins
 */
export function useAvailablePlugins(
  options?: QueryOptions<PluginConfig[], ["plugins", "available"]>,
) {
  return useQuery<PluginConfig[], Error, PluginConfig[], ["plugins", "available"]>({
    queryKey: ["plugins", "available"],
    queryFn: async () => {
      const response = await apiClient.get<PluginConfig[]>("/plugins");
      return extractDataOrThrow(response, "Failed to load available plugins");
    },
    ...options,
  });
}

/**
 * Fetch all plugin instances
 */
export function usePluginInstances(
  options?: QueryOptions<PluginListResponse, ["plugins", "instances"]>,
) {
  return useQuery<PluginListResponse, Error, PluginListResponse, ["plugins", "instances"]>({
    queryKey: ["plugins", "instances"],
    queryFn: async () => {
      const response = await apiClient.get<PluginListResponse>("/plugins/instances");
      return extractDataOrThrow(response, "Failed to load plugin instances");
    },
    ...options,
  });
}

/**
 * Fetch plugin schema by name
 */
export function usePluginSchema(
  pluginName: string,
  options?: QueryOptions<
    { schema: PluginConfig; instance_id: string | null },
    ["plugins", "schema", string]
  >,
) {
  return useQuery<
    { schema: PluginConfig; instance_id: string | null },
    Error,
    { schema: PluginConfig; instance_id: string | null },
    ["plugins", "schema", string]
  >({
    queryKey: ["plugins", "schema", pluginName],
    queryFn: async () => {
      const response = await apiClient.get<{
        schema: PluginConfig;
        instance_id: string | null;
      }>(`/plugins/${pluginName}/schema`);
      return extractDataOrThrow(response, "Failed to load plugin schema");
    },
    enabled: !!pluginName,
    ...options,
  });
}

/**
 * Fetch single plugin instance
 */
export function usePluginInstance(
  instanceId: string,
  options?: QueryOptions<PluginInstance, ["plugins", "instances", string]>,
) {
  return useQuery<PluginInstance, Error, PluginInstance, ["plugins", "instances", string]>({
    queryKey: ["plugins", "instances", instanceId],
    queryFn: async () => {
      const response = await apiClient.get<PluginInstance>(`/plugins/instances/${instanceId}`);
      return extractDataOrThrow(response, "Failed to load plugin instance");
    },
    enabled: !!instanceId,
    ...options,
  });
}

/**
 * Fetch plugin configuration
 */
export function usePluginConfiguration(
  instanceId: string,
  options?: QueryOptions<
    PluginConfigurationResponse,
    ["plugins", "instances", string, "configuration"]
  >,
) {
  return useQuery<
    PluginConfigurationResponse,
    Error,
    PluginConfigurationResponse,
    ["plugins", "instances", string, "configuration"]
  >({
    queryKey: ["plugins", "instances", instanceId, "configuration"],
    queryFn: async () => {
      const response = await apiClient.get<PluginConfigurationResponse>(
        `/plugins/instances/${instanceId}/configuration`,
      );
      return extractDataOrThrow(response, "Failed to load plugin configuration");
    },
    enabled: !!instanceId,
    ...options,
  });
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * Create plugin instance
 */
export function useCreatePluginInstance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreatePluginInstanceRequest) => {
      const response = await apiClient.post<PluginInstance>("/plugins/instances", data);
      return extractDataOrThrow(response, "Failed to create plugin instance");
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["plugins", "instances"] });

      toast({
        title: "Plugin instance created",
        description: `${data.instance_name} was created successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Creation failed",
        description: error.response?.data?.detail || "Failed to create plugin instance",
        variant: "destructive",
      });
    },
  });
}

/**
 * Update plugin configuration
 */
export function useUpdatePluginConfiguration() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      instanceId,
      data,
    }: {
      instanceId: string;
      data: UpdatePluginConfigurationRequest;
    }) => {
      const response = await apiClient.put<{ message: string }>(
        `/plugins/instances/${instanceId}/configuration`,
        data,
      );
      return extractDataOrThrow(response, "Failed to update plugin configuration");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["plugins", "instances"] });
      queryClient.invalidateQueries({
        queryKey: ["plugins", "instances", variables.instanceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["plugins", "instances", variables.instanceId, "configuration"],
      });

      toast({
        title: "Configuration updated",
        description: "Plugin configuration was updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.response?.data?.detail || "Failed to update configuration",
        variant: "destructive",
      });
    },
  });
}

/**
 * Delete plugin instance
 */
export function useDeletePluginInstance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (instanceId: string) => {
      const response = await apiClient.delete(`/plugins/instances/${instanceId}`);
      // Check for successful status codes (2xx)
      if (response.status < 200 || response.status >= 300) {
        throw new Error("Failed to delete plugin instance");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plugins", "instances"] });

      toast({
        title: "Plugin instance deleted",
        description: "Plugin instance was removed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Deletion failed",
        description: error.response?.data?.detail || "Failed to delete plugin instance",
        variant: "destructive",
      });
    },
  });
}

/**
 * Test plugin connection
 */
export function useTestPluginConnection() {
  return useMutation({
    mutationFn: async ({
      instanceId,
      configuration,
    }: {
      instanceId: string;
      configuration?: Record<string, any> | null;
    }) => {
      const response = await apiClient.post<PluginTestResult>(
        `/plugins/instances/${instanceId}/test`,
        { configuration: configuration || null },
      );
      return extractDataOrThrow(response, "Failed to test plugin connection");
    },
  });
}

/**
 * Plugin health check
 */
export function usePluginHealthCheck(
  instanceId: string,
  options?: QueryOptions<PluginHealthCheck, ["plugins", "instances", string, "health"]>,
) {
  return useQuery<
    PluginHealthCheck,
    Error,
    PluginHealthCheck,
    ["plugins", "instances", string, "health"]
  >({
    queryKey: ["plugins", "instances", instanceId, "health"],
    queryFn: async () => {
      const response = await apiClient.get<PluginHealthCheck>(
        `/plugins/instances/${instanceId}/health`,
      );
      return extractDataOrThrow(response, "Failed to load plugin health");
    },
    enabled: !!instanceId,
    refetchInterval: 60000, // Refresh every minute
    ...options,
  });
}

/**
 * Bulk health check for multiple instances
 */
export function useBulkHealthCheck() {
  return useMutation({
    mutationFn: async (instanceIds?: string[] | null) => {
      const response = await apiClient.post<PluginHealthCheck[]>(
        "/plugins/instances/health-check",
        {
          instance_ids: instanceIds || null,
        },
      );
      return extractDataOrThrow(response, "Failed to run plugin health check");
    },
  });
}

/**
 * Refresh plugins (re-scan for new plugins)
 */
export function useRefreshPlugins() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<{
        message: string;
        available_plugins: number;
      }>("/plugins/refresh");
      return extractDataOrThrow(response, "Failed to refresh plugins");
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["plugins", "available"] });

      toast({
        title: "Plugins refreshed",
        description: `Found ${data.available_plugins} available plugins.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Refresh failed",
        description: error.response?.data?.detail || "Failed to refresh plugins",
        variant: "destructive",
      });
    },
  });
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get status color class
 */
export function getStatusColor(status: PluginStatus): string {
  const colors: Record<PluginStatus, string> = {
    registered: "bg-gray-500/15 text-gray-300 border border-gray-500/30",
    configured: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
    active: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    inactive: "bg-yellow-500/15 text-yellow-300 border border-yellow-500/30",
    error: "bg-red-500/15 text-red-300 border border-red-500/30",
  };
  return colors[status] || colors.registered;
}

/**
 * Get health status color
 */
export function getHealthStatusColor(status: string): string {
  const colors = {
    healthy: "text-emerald-400",
    unhealthy: "text-red-400",
    unknown: "text-gray-400",
    error: "text-red-500",
  } as const;

  if (status in colors) {
    return colors[status as keyof typeof colors];
  }

  return colors.unknown;
}

/**
 * Group fields by group name
 */
export function groupFields(fields: FieldSpec[]): Record<string, FieldSpec[]> {
  const grouped: Record<string, FieldSpec[]> = {};

  fields.forEach((field) => {
    const group = field.group || "General";
    if (!grouped[group]) {
      grouped[group] = [];
    }
    grouped[group].push(field);
  });

  // Sort fields within each group by order
  Object.keys(grouped).forEach((group) => {
    const fieldsInGroup = grouped[group];
    if (fieldsInGroup) {
      fieldsInGroup.sort((a, b) => a.order - b.order);
    }
  });

  return grouped;
}

/**
 * Format last seen/updated timestamp
 */
export function formatTimestamp(timestamp: string | null | undefined): string {
  if (!timestamp) return "Never";

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  return date.toLocaleDateString();
}
