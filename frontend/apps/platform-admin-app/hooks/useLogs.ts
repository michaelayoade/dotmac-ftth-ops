import { useState, useEffect } from "react";
import axios from "axios";
import { useToast } from "@dotmac/ui";
import { platformConfig } from "@/lib/config";

// Migrated from sonner to useToast hook
// Note: toast options have changed:
// - sonner: toast.success('msg') -> useToast: toast({ title: 'Success', description: 'msg' })
// - sonner: toast.error('msg') -> useToast: toast({ title: 'Error', description: 'msg', variant: 'destructive' })
// - For complex options, refer to useToast documentation

const API_BASE_URL = platformConfig.api.baseUrl;

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

export function useLogs(filters: LogsFilter = {}) {
  const { toast } = useToast();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [services, setServices] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    page_size: 100,
    has_more: false,
  });

  const fetchLogs = async (customFilters?: LogsFilter) => {
    const activeFilters = { ...filters, ...customFilters };

    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (activeFilters.level) params.append("level", activeFilters.level);
      if (activeFilters.service) params.append("service", activeFilters.service);
      if (activeFilters.search) params.append("search", activeFilters.search);
      if (activeFilters.start_time) params.append("start_time", activeFilters.start_time);
      if (activeFilters.end_time) params.append("end_time", activeFilters.end_time);
      if (activeFilters.page) params.append("page", activeFilters.page.toString());
      if (activeFilters.page_size) params.append("page_size", activeFilters.page_size.toString());

      const response = await axios.get<LogsResponse>(
        `${API_BASE_URL}/api/v1/monitoring/logs?${params.toString()}`,
        { withCredentials: true },
      );

      setLogs(response.data.logs);
      setPagination({
        total: response.data.total,
        page: response.data.page,
        page_size: response.data.page_size,
        has_more: response.data.has_more,
      });
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.detail || "Failed to fetch logs"
        : "An error occurred";
      setError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get<LogStats>(`${API_BASE_URL}/api/v1/monitoring/logs/stats`, {
        withCredentials: true,
      });
      setStats(response.data);
    } catch (err: unknown) {
      console.error("Failed to fetch log stats:", err);
    }
  };

  const fetchServices = async () => {
    try {
      const response = await axios.get<string[]>(
        `${API_BASE_URL}/api/v1/monitoring/logs/services`,
        { withCredentials: true },
      );
      setServices(response.data);
    } catch (err: unknown) {
      console.error("Failed to fetch services:", err);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchStats();
    fetchServices();
  }, []);

  return {
    logs,
    stats,
    services,
    isLoading,
    error,
    pagination,
    refetch: fetchLogs,
    fetchStats,
  };
}
