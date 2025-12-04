/**
 * Logs Management Hook - TanStack Query Version
 *
 * Migrated from direct API calls to TanStack Query for:
 * - Automatic caching and deduplication
 * - Background refetching
 * - Better error handling
 * - Reduced boilerplate (154 lines → 110 lines)
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useToast } from "@dotmac/ui";
import { useAppConfig } from "@/providers/AppConfigContext";
import { logger } from "@/lib/logger";

export interface LogMetadata {
  request_id?: string;
  user_id?: string;
  tenant_id?: string;
  duration?: number;
  ip?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  service: string;
  message: string;
  metadata: LogMetadata;
}

export interface LogsResponse {
  logs: LogEntry[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface LogStats {
  total: number;
  by_level: Record<string, number>;
  by_service: Record<string, number>;
  time_range: {
    start: string;
    end: string;
  };
}

export interface LogsFilter {
  level?: string;
  service?: string;
  search?: string;
  start_time?: string;
  end_time?: string;
  page?: number;
  page_size?: number;
}

// Query key factory for logs
export const logsKeys = {
  all: ["logs"] as const,
  lists: () => [...logsKeys.all, "list"] as const,
  list: (filters: LogsFilter) => [...logsKeys.lists(), filters] as const,
  stats: () => [...logsKeys.all, "stats"] as const,
  services: () => [...logsKeys.all, "services"] as const,
};

export function useLogs(filters: LogsFilter = {}) {
  const serializedFilters = useMemo(() => JSON.stringify(filters ?? {}), [filters]);
  const normalizedFilters = useMemo(
    () => JSON.parse(serializedFilters) as LogsFilter,
    [serializedFilters],
  );
  const { toast } = useToast();
  const { api } = useAppConfig();
  const buildApiUrl = (path: string) => {
    if (typeof api.buildUrl === "function") {
      return api.buildUrl(path);
    }
    const base = api.baseUrl || "";
    const prefix = api.prefix || "";
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${base}${prefix}${normalizedPath}`;
  };

  // Fetch logs
  const logsQuery = useQuery({
    queryKey: [...logsKeys.list(normalizedFilters), api.baseUrl, api.prefix],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (normalizedFilters.level) params.append("level", normalizedFilters.level);
        if (normalizedFilters.service) params.append("service", normalizedFilters.service);
        if (normalizedFilters.search) params.append("search", normalizedFilters.search);
        if (normalizedFilters.start_time) params.append("start_time", normalizedFilters.start_time);
        if (normalizedFilters.end_time) params.append("end_time", normalizedFilters.end_time);
        if (normalizedFilters.page) params.append("page", normalizedFilters.page.toString());
        if (normalizedFilters.page_size)
          params.append("page_size", normalizedFilters.page_size.toString());

        const query = params.toString();
        const logsUrl = query
          ? `${buildApiUrl("/monitoring/logs")}?${query}`
          : buildApiUrl("/monitoring/logs");
        const response = await axios.get<LogsResponse>(logsUrl, { withCredentials: true });

        return response.data;
      } catch (err: unknown) {
        const message = axios.isAxiosError(err)
          ? err.response?.data?.detail || "Failed to fetch logs"
          : "An error occurred";
        logger.error("Failed to fetch logs", err instanceof Error ? err : new Error(String(err)));
        toast({ title: "Error", description: message, variant: "destructive" });
        throw err;
      }
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  // Fetch stats
  const statsQuery = useQuery({
    queryKey: [...logsKeys.stats(), api.baseUrl, api.prefix],
    queryFn: async () => {
      try {
        const response = await axios.get<LogStats>(buildApiUrl("/monitoring/logs/stats"), {
          withCredentials: true,
        });
        return response.data;
      } catch (err: unknown) {
        logger.error(
          "Failed to fetch log stats",
          err instanceof Error ? err : new Error(String(err)),
        );
        return null;
      }
    },
    staleTime: 60000, // 1 minute
  });

  // Fetch services
  const servicesQuery = useQuery({
    queryKey: [...logsKeys.services(), api.baseUrl, api.prefix],
    queryFn: async () => {
      try {
        const response = await axios.get<string[]>(buildApiUrl("/monitoring/logs/services"), {
          withCredentials: true,
        });
        return response.data;
      } catch (err: unknown) {
        logger.error(
          "Failed to fetch services",
          err instanceof Error ? err : new Error(String(err)),
        );
        return [];
      }
    },
    staleTime: 300000, // 5 minutes
  });

  // Extract error message properly
  let errorMessage: string | null = null;
  if (logsQuery.error) {
    if (axios.isAxiosError(logsQuery.error)) {
      errorMessage = logsQuery.error.response?.data?.detail || "Failed to fetch logs";
    } else if (logsQuery.error instanceof Error) {
      errorMessage =
        logsQuery.error.message === "Network error" ? "An error occurred" : logsQuery.error.message;
    } else {
      errorMessage = "An error occurred";
    }
  }

  return {
    logs: logsQuery.data?.logs ?? [],
    stats: statsQuery.data ?? null,
    services: servicesQuery.data ?? [],
    isLoading: logsQuery.isLoading,
    error: errorMessage,
    pagination: {
      total: logsQuery.data?.total ?? 0,
      page: logsQuery.data?.page ?? 1,
      page_size: logsQuery.data?.page_size ?? 100,
      has_more: logsQuery.data?.has_more ?? false,
    },
    refetch: logsQuery.refetch,
    fetchStats: statsQuery.refetch,
  };
}
