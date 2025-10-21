import { useState, useCallback, useEffect } from "react";
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

export const useHealth = () => {
  const [health, setHealth] = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<HealthSummary>("/ready");

      const payload = response.data as
        | HealthSummary
        | { success: boolean; data: HealthSummary }
        | { error?: { message?: string }; data?: HealthSummary };

      if (
        payload &&
        typeof payload === "object" &&
        "success" in payload &&
        payload.success &&
        payload.data
      ) {
        setHealth(payload.data);
      } else if (
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        payload.error?.message
      ) {
        setError(payload.error.message);
        setHealth({
          status: "degraded",
          healthy: false,
          services: [],
          failed_services: [],
          version: undefined,
          timestamp: new Date().toISOString(),
        });
      } else if (payload && typeof payload === "object" && "services" in payload) {
        setHealth(payload as HealthSummary);
      } else {
        setHealth({
          status: "unknown",
          healthy: false,
          services: [],
          failed_services: [],
          version: undefined,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      const isAxiosError = axios.isAxiosError(err);
      const status = isAxiosError ? err.response?.status : undefined;
      const fallback: HealthSummary = {
        status: status === 403 ? "forbidden" : "degraded",
        healthy: false,
        services: [],
        failed_services: [],
        version: undefined,
        timestamp: new Date().toISOString(),
      };

      logger.error(
        "Failed to fetch health data",
        err instanceof Error ? err : new Error(String(err)),
      );
      setHealth(fallback);
      setError(
        status === 403
          ? "You do not have permission to view service health."
          : "Service health is temporarily unavailable.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  return {
    health,
    loading,
    error,
    refreshHealth: fetchHealth,
  };
};
