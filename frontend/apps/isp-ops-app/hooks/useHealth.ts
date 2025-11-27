/**
 * Health Monitoring Hook - TanStack Query Version
 *
 * Migrated from direct API calls to TanStack Query for:
 * - Automatic caching and deduplication
 * - Background refetching
 * - Better error handling
 * - Reduced boilerplate (118 lines → 65 lines)
 */
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

export interface ServiceHealth {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  message: string;
  required: boolean;
  uptime?: number;
  responseTime?: number;
  lastCheck?: string;
}

export interface HealthSummary {
  status: string;
  healthy: boolean;
  services: ServiceHealth[];
  failed_services: string[];
  version?: string;
  timestamp?: string;
}

// Query key factory for health
export const healthKeys = {
  all: ["health"] as const,
  status: () => [...healthKeys.all, "status"] as const,
};

/**
 * Helper to normalize health response formats
 * Returns both health summary and optional error message from API
 */
function normalizeHealthResponse(response: any): HealthSummary & { apiErrorMessage?: string } {
  const payload = response.data;

  // Handle wrapped success response
  if (payload?.success && payload.data) {
    return payload.data;
  }

  // Handle error response
  if (payload?.error?.message) {
    return {
      status: "degraded",
      healthy: false,
      services: [],
      failed_services: [],
      timestamp: new Date().toISOString(),
      apiErrorMessage: payload.error.message, // Preserve API error message
    };
  }

  // Handle direct health response
  if (payload?.services) {
    return payload as HealthSummary;
  }

  // Fallback for unknown format
  return {
    status: "unknown",
    healthy: false,
    services: [],
    failed_services: [],
    timestamp: new Date().toISOString(),
  };
}

/**
 * Hook to fetch service health status
 *
 * Features:
 * - Auto-refetches every 30 seconds
 * - Caches results for 10 seconds
 * - Handles 403 errors gracefully
 * - Normalizes various response formats
 *
 * Returns both TanStack Query API and legacy API for backward compatibility:
 * - TanStack Query: isLoading, data, error, refetch, isError
 * - Legacy: loading, health, error (formatted string)
 */
export const useHealth = () => {
  const query = useQuery({
    queryKey: healthKeys.status(),
    queryFn: async () => {
      try {
        const response = await apiClient.get<HealthSummary>("/ready");
        return normalizeHealthResponse(response);
      } catch (err) {
        const isAxiosError = axios.isAxiosError(err);
        const status = isAxiosError ? err.response?.status : undefined;

        logger.error(
          "Failed to fetch health data",
          err instanceof Error ? err : new Error(String(err)),
        );

        // Return fallback health data instead of throwing
        // This allows the UI to show degraded/forbidden status
        return {
          status: status === 403 ? "forbidden" : "degraded",
          healthy: false,
          services: [],
          failed_services: [],
          timestamp: new Date().toISOString(),
        } as HealthSummary;
      }
    },
    staleTime: 10000, // Consider data fresh for 10 seconds
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    refetchOnWindowFocus: true, // Refresh when window gains focus
    retry: 2, // Retry failed requests twice
  });

  // Determine error message: prioritize API error message, then fallback to status-based messages
  const errorMessage =
    (query.data as any)?.apiErrorMessage ||
    (query.data?.status === "forbidden"
      ? "You do not have permission to view service health."
      : query.data?.status === "degraded"
        ? "Service health is temporarily unavailable."
        : null);

  // Return both TanStack Query API and legacy API
  return {
    // TanStack Query API
    ...query,

    // Legacy API for backward compatibility
    loading: query.isLoading,
    health: query.data ?? null,
    error: errorMessage,
    refreshHealth: query.refetch,
  };
};

/**
 * Compatibility wrapper to match old API
 * This allows gradual migration - components can continue using the old interface
 *
 * Usage:
 * const { health, loading, error, refreshHealth } = useHealthLegacy();
 */
export const useHealthLegacy = () => {
  const query = useHealth();

  return {
    health: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? String(query.error) : null,
    refreshHealth: query.refetch,
  };
};
