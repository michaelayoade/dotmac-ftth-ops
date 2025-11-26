/**
 * Observability Hook - TanStack Query Version
 *
 * Migrated from axios to TanStack Query for:
 * - Automatic caching and deduplication
 * - Background refetching
 * - Better error handling
 * - Reduced boilerplate
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

export interface SpanData {
  span_id: string;
  parent_span_id?: string;
  name: string;
  service: string;
  duration: number;
  start_time: string;
  attributes: Record<string, unknown>;
}

export interface TraceData {
  trace_id: string;
  service: string;
  operation: string;
  duration: number;
  status: "success" | "error" | "warning";
  timestamp: string;
  spans: number;
  span_details: SpanData[];
}

export interface TracesResponse {
  traces: TraceData[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface MetricDataPoint {
  timestamp: string;
  value: number;
  labels: Record<string, string>;
}

export interface MetricSeries {
  name: string;
  type: "counter" | "gauge" | "histogram";
  data_points: MetricDataPoint[];
  unit: string;
}

export interface MetricsResponse {
  metrics: MetricSeries[];
  time_range: {
    start: string;
    end: string;
  };
}

export interface ServiceDependency {
  from_service: string;
  to_service: string;
  request_count: number;
  error_rate: number;
  avg_latency: number;
}

export interface ServiceMapResponse {
  services: string[];
  dependencies: ServiceDependency[];
  health_scores: Record<string, number>;
}

export interface PerformanceMetrics {
  percentile: string;
  value: number;
  target: number;
  within_sla: boolean;
}

export interface PerformanceResponse {
  percentiles: PerformanceMetrics[];
  slowest_endpoints: Array<{
    endpoint: string;
    avg_latency: number;
    status_code: number;
  }>;
  most_frequent_errors: Array<{
    error_type: string;
    count: number;
    status_code: number;
  }>;
}

export interface TracesFilter {
  service?: string;
  status?: "success" | "error" | "warning";
  min_duration?: number;
  start_time?: string;
  end_time?: string;
  page?: number;
  page_size?: number;
}

// ============================================================================
// Query Key Factory
// ============================================================================

export const observabilityKeys = {
  all: ["observability"] as const,
  traces: (filters?: TracesFilter) => [...observabilityKeys.all, "traces", filters] as const,
  traceDetail: (traceId: string) => [...observabilityKeys.all, "trace", traceId] as const,
  metrics: (metricNames?: string[], startTime?: string, endTime?: string) =>
    [...observabilityKeys.all, "metrics", metricNames, startTime, endTime] as const,
  serviceMap: () => [...observabilityKeys.all, "service-map"] as const,
  performance: () => [...observabilityKeys.all, "performance"] as const,
};

// ============================================================================
// Helper function to build query params
// ============================================================================

function buildTracesQueryString(filters: TracesFilter): string {
  const params = new URLSearchParams();
  if (filters.service) params.append("service", filters.service);
  if (filters.status) params.append("status", filters.status);
  if (filters.min_duration) params.append("min_duration", filters.min_duration.toString());
  if (filters.start_time) params.append("start_time", filters.start_time);
  if (filters.end_time) params.append("end_time", filters.end_time);
  if (filters.page) params.append("page", filters.page.toString());
  if (filters.page_size) params.append("page_size", filters.page_size.toString());
  return params.toString();
}

// ============================================================================
// useTraces Hook
// ============================================================================

export function useTraces(filters: TracesFilter = {}) {
  const query = useQuery({
    queryKey: observabilityKeys.traces(filters),
    queryFn: async () => {
      try {
        const queryString = buildTracesQueryString(filters);
        const response = await apiClient.get<TracesResponse>(
          `/observability/traces${queryString ? `?${queryString}` : ""}`,
        );
        logger.info("Fetched traces", {
          count: response.data.traces.length,
          filters,
        });
        return response.data;
      } catch (err) {
        logger.error("Failed to fetch traces", err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    staleTime: 30000, // 30 seconds - traces data changes frequently
    refetchOnWindowFocus: true,
  });

  const fetchTraceDetails = async (traceId: string): Promise<TraceData | null> => {
    try {
      const response = await apiClient.get<TraceData>(`/observability/traces/${traceId}`);
      logger.info("Fetched trace details", { traceId });
      return response.data;
    } catch (err) {
      logger.error(
        "Failed to fetch trace details",
        err instanceof Error ? err : new Error(String(err)),
      );
      return null;
    }
  };

  return {
    traces: query.data?.traces || [],
    isLoading: query.isLoading,
    error: query.error ? String(query.error) : null,
    pagination: {
      total: query.data?.total || 0,
      page: query.data?.page || 1,
      page_size: query.data?.page_size || 50,
      has_more: query.data?.has_more || false,
    },
    refetch: query.refetch,
    fetchTraceDetails,
  };
}

// ============================================================================
// useMetrics Hook
// ============================================================================

export function useMetrics(metricNames?: string[], startTime?: string, endTime?: string) {
  const query = useQuery({
    queryKey: observabilityKeys.metrics(metricNames, startTime, endTime),
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (metricNames && metricNames.length > 0) {
          params.append("metrics", metricNames.join(","));
        }
        if (startTime) params.append("start_time", startTime);
        if (endTime) params.append("end_time", endTime);

        const response = await apiClient.get<MetricsResponse>(
          `/observability/metrics${params.toString() ? `?${params.toString()}` : ""}`,
        );
        logger.info("Fetched metrics", {
          count: response.data.metrics.length,
          metricNames,
          startTime,
          endTime,
        });
        return response.data;
      } catch (err) {
        logger.error(
          "Failed to fetch metrics",
          err instanceof Error ? err : new Error(String(err)),
        );
        throw err;
      }
    },
    staleTime: 30000, // 30 seconds - metrics data changes frequently
    refetchOnWindowFocus: true,
  });

  return {
    metrics: query.data?.metrics || [],
    isLoading: query.isLoading,
    error: query.error ? String(query.error) : null,
    refetch: query.refetch,
  };
}

// ============================================================================
// useServiceMap Hook
// ============================================================================

export function useServiceMap() {
  const query = useQuery({
    queryKey: observabilityKeys.serviceMap(),
    queryFn: async () => {
      try {
        const response = await apiClient.get<ServiceMapResponse>("/observability/service-map");
        logger.info("Fetched service map", {
          servicesCount: response.data.services.length,
          dependenciesCount: response.data.dependencies.length,
        });
        return response.data;
      } catch (err) {
        logger.error(
          "Failed to fetch service map",
          err instanceof Error ? err : new Error(String(err)),
        );
        throw err;
      }
    },
    staleTime: 60000, // 1 minute - service map changes less frequently
    refetchOnWindowFocus: true,
  });

  return {
    serviceMap: query.data || null,
    isLoading: query.isLoading,
    error: query.error ? String(query.error) : null,
    refetch: query.refetch,
  };
}

// ============================================================================
// usePerformance Hook
// ============================================================================

export function usePerformance() {
  const query = useQuery({
    queryKey: observabilityKeys.performance(),
    queryFn: async () => {
      try {
        const response = await apiClient.get<PerformanceResponse>("/observability/performance");
        logger.info("Fetched performance metrics", {
          percentilesCount: response.data.percentiles.length,
          slowestEndpointsCount: response.data.slowest_endpoints.length,
          errorTypesCount: response.data.most_frequent_errors.length,
        });
        return response.data;
      } catch (err) {
        logger.error(
          "Failed to fetch performance metrics",
          err instanceof Error ? err : new Error(String(err)),
        );
        throw err;
      }
    },
    staleTime: 30000, // 30 seconds - performance data changes frequently
    refetchOnWindowFocus: true,
  });

  return {
    performance: query.data || null,
    isLoading: query.isLoading,
    error: query.error ? String(query.error) : null,
    refetch: query.refetch,
  };
}
