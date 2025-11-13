import { apiClient } from "../api/client";

export interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
}

export interface PluginConfig {
  name: string;
  display_name?: string;
  description?: string;
  version?: string;
  category?: string;
  icon?: string;
}

export interface PluginInstance {
  id: string;
  plugin_name: string;
  instance_name: string;
  configuration: Record<string, any>;
  status: string;
  error_message?: string;
  last_health_check?: string;
  created_at: string;
  updated_at: string;
}

export async function getPlugins(): Promise<Plugin[]> {
  const response = await apiClient.get<Plugin[]>("/plugins");
  return response.data;
}

export async function togglePlugin(id: string, enabled: boolean): Promise<void> {
  await apiClient.patch(`/plugins/${id}`, { enabled });
}

export async function listAvailablePlugins(): Promise<PluginConfig[]> {
  const response = await apiClient.get<PluginConfig[]>("/plugins/available");
  return response.data;
}

export async function listPluginInstances(): Promise<{
  plugins: PluginInstance[];
}> {
  const response = await apiClient.get<{ plugins: PluginInstance[] }>("/plugins/instances");
  return response.data;
}

export async function createPluginInstance(data: {
  plugin_name: string;
  instance_name: string;
  configuration: Record<string, any>;
}): Promise<PluginInstance> {
  const response = await apiClient.post<PluginInstance>("/plugins/instances", data);
  return response.data;
}

export async function deletePluginInstance(instanceId: string): Promise<void> {
  await apiClient.delete(`/plugins/instances/${instanceId}`);
}

export async function refreshPluginInstance(instanceId: string): Promise<void> {
  await apiClient.post(`/plugins/instances/${instanceId}/refresh`);
}

export function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    active: "bg-green-500",
    inactive: "bg-gray-500",
    error: "bg-red-500",
    pending: "bg-yellow-500",
  };
  return statusColors[status.toLowerCase()] || "bg-gray-500";
}

export const pluginsService = {
  getPlugins,
  togglePlugin,
  listAvailablePlugins,
  listPluginInstances,
  createPluginInstance,
  deletePluginInstance,
  refreshPluginInstance,
  getStatusColor,
};

export default pluginsService;
