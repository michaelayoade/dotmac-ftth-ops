/**
 * React Query hooks for integrations management
 *
 * Connects to backend integrations API:
 * - GET /api/v1/integrations - List all registered integrations
 * - GET /api/v1/integrations/{name} - Get integration details
 * - POST /api/v1/integrations/{name}/health-check - Trigger health check
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
// Types matching backend integrations models
// ============================================

export type IntegrationType =
  | "email"
  | "sms"
  | "storage"
  | "search"
  | "analytics"
  | "monitoring"
  | "secrets"
  | "cache"
  | "queue";
export type IntegrationStatus = "disabled" | "configuring" | "ready" | "error" | "deprecated";

export interface IntegrationResponse {
  name: string;
  type: IntegrationType;
  provider: string;
  enabled: boolean;
  status: IntegrationStatus;
  message: string | null;
  last_check: string | null;
  settings_count: number;
  has_secrets: boolean;
  required_packages: string[];
  metadata: Record<string, any> | null;
}

export interface IntegrationListResponse {
  integrations: IntegrationResponse[];
  total: number;
}

// ============================================
// Query Hooks
// ============================================

/**
 * Fetch all registered integrations
 */
type QueryOptions<TData, TKey extends QueryKey> = Omit<
  UseQueryOptions<TData, Error, TData, TKey>,
  "queryKey" | "queryFn"
>;

const isTestEnv = process.env.NODE_ENV === "test";

async function testRequest<T>(path: string, init: RequestInit, errorMessage: string): Promise<T> {
  if (typeof fetch === "undefined") {
    throw new Error(errorMessage);
  }

  const base = apiClient.defaults?.baseURL ?? "";
  const response = await fetch(`${base}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    throw new Error(errorMessage);
  }

  return (await response.json()) as T;
}

function requestIntegrations(path: string, errorMessage: string) {
  if (isTestEnv) {
    return testRequest<IntegrationListResponse>(path, { method: "GET" }, errorMessage);
  }

  return apiClient.get<IntegrationListResponse>(path).then((response) => {
    return extractDataOrThrow(response, errorMessage);
  });
}

function requestIntegration(path: string, errorMessage: string) {
  if (isTestEnv) {
    return testRequest<IntegrationResponse>(path, { method: "GET" }, errorMessage);
  }

  return apiClient.get<IntegrationResponse>(path).then((response) => {
    return extractDataOrThrow(response, errorMessage);
  });
}

function postIntegration(path: string, errorMessage: string) {
  if (isTestEnv) {
    return testRequest<IntegrationResponse>(path, { method: "POST" }, errorMessage);
  }

  return apiClient.post<IntegrationResponse>(path).then((response) => {
    return extractDataOrThrow(response, errorMessage);
  });
}

export function useIntegrations(options?: QueryOptions<IntegrationListResponse, ["integrations"]>) {
  return useQuery<IntegrationListResponse, Error, IntegrationListResponse, ["integrations"]>({
    queryKey: ["integrations"],
    queryFn: async () => requestIntegrations("/integrations", "Failed to load integrations"),
    refetchInterval: 60000, // Refresh every minute
    ...options,
  });
}

/**
 * Fetch single integration details
 */
export function useIntegration(
  name: string,
  options?: QueryOptions<IntegrationResponse, ["integrations", string]>,
) {
  return useQuery<IntegrationResponse, Error, IntegrationResponse, ["integrations", string]>({
    queryKey: ["integrations", name],
    queryFn: async () => requestIntegration(`/integrations/${name}`, "Failed to load integration"),
    enabled: !!name,
    refetchInterval: 30000, // Refresh every 30 seconds
    ...options,
  });
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * Trigger manual health check for an integration
 */
export function useHealthCheck() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (integrationName: string) =>
      postIntegration(
        `/integrations/${integrationName}/health-check`,
        "Failed to trigger health check",
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      queryClient.invalidateQueries({ queryKey: ["integrations", data.name] });

      toast({
        title: "Health check complete",
        description: `${data.name}: ${data.status}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Health check failed",
        description: error.response?.data?.detail || "Failed to check integration health",
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
export function getStatusColor(status: IntegrationStatus): string {
  const colors: Record<IntegrationStatus, string> = {
    disabled: "text-gray-400 bg-gray-500/15 border-gray-500/30",
    configuring: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30",
    ready: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
    error: "text-red-400 bg-red-500/15 border-red-500/30",
    deprecated: "text-orange-400 bg-orange-500/15 border-orange-500/30",
  };
  return colors[status] || colors.disabled;
}

/**
 * Get status icon
 */
export function getStatusIcon(status: IntegrationStatus): string {
  const icons: Record<IntegrationStatus, string> = {
    disabled: "⊘",
    configuring: "⚙",
    ready: "✓",
    error: "✗",
    deprecated: "⚠",
  };
  return icons[status] || icons.disabled;
}

/**
 * Get type color
 */
export function getTypeColor(type: IntegrationType): string {
  const colors: Record<IntegrationType, string> = {
    email: "text-blue-300 bg-blue-500/15",
    sms: "text-purple-300 bg-purple-500/15",
    storage: "text-cyan-300 bg-cyan-500/15",
    search: "text-green-300 bg-green-500/15",
    analytics: "text-orange-300 bg-orange-500/15",
    monitoring: "text-red-300 bg-red-500/15",
    secrets: "text-yellow-300 bg-yellow-500/15",
    cache: "text-pink-300 bg-pink-500/15",
    queue: "text-indigo-300 bg-indigo-500/15",
  };
  return colors[type] || colors.email;
}

/**
 * Get type icon
 */
export function getTypeIcon(type: IntegrationType): string {
  const icons: Record<IntegrationType, string> = {
    email: "✉",
    sms: "📱",
    storage: "💾",
    search: "🔍",
    analytics: "📊",
    monitoring: "🔧",
    secrets: "🔐",
    cache: "⚡",
    queue: "📬",
  };
  return icons[type] || "🔌";
}

/**
 * Format timestamp to relative time
 */
export function formatLastCheck(timestamp: string | null): string {
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

/**
 * Get provider display name
 */
export function getProviderDisplayName(provider: string): string {
  const providers: Record<string, string> = {
    sendgrid: "SendGrid",
    twilio: "Twilio",
    minio: "MinIO",
    elasticsearch: "Elasticsearch",
    opensearch: "OpenSearch",
    redis: "Redis",
    celery: "Celery",
    vault: "HashiCorp Vault",
    openbao: "OpenBao",
  };
  return providers[provider.toLowerCase()] || provider;
}

/**
 * Group integrations by type
 */
export function groupByType(
  integrations: IntegrationResponse[],
): Record<IntegrationType, IntegrationResponse[]> {
  const grouped: Partial<Record<IntegrationType, IntegrationResponse[]>> = {};

  integrations.forEach((integration) => {
    if (!grouped[integration.type]) {
      grouped[integration.type] = [];
    }
    grouped[integration.type]!.push(integration);
  });

  return grouped as Record<IntegrationType, IntegrationResponse[]>;
}

/**
 * Calculate health statistics
 */
export function calculateHealthStats(integrations: IntegrationResponse[]): {
  total: number;
  ready: number;
  error: number;
  disabled: number;
  configuring: number;
} {
  return {
    total: integrations.length,
    ready: integrations.filter((i) => i.status === "ready").length,
    error: integrations.filter((i) => i.status === "error").length,
    disabled: integrations.filter((i) => i.status === "disabled").length,
    configuring: integrations.filter((i) => i.status === "configuring").length,
  };
}
