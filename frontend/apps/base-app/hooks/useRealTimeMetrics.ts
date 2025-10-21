"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseRealTimeMetricsOptions<T> {
  fetchFn: () => Promise<T>;
  refreshInterval?: number; // in milliseconds
  enabled?: boolean;
  onError?: (error: Error) => void;
  onSuccess?: (data: T) => void;
}

interface UseRealTimeMetricsReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
  isStale: boolean;
}

export function useRealTimeMetrics<T>({
  fetchFn,
  refreshInterval = 30000, // 30 seconds default
  enabled = true,
  onError,
  onSuccess,
}: UseRealTimeMetricsOptions<T>): UseRealTimeMetricsReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!enabled || !mountedRef.current) return;

    try {
      setLoading(true);
      setError(null);
      setIsStale(false);

      const result = await fetchFn();

      if (mountedRef.current) {
        setData(result);
        setLastUpdated(new Date());
        onSuccess?.(result);
      }
    } catch (err) {
      if (mountedRef.current) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        onError?.(error);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetchFn, enabled, onSuccess, onError]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Set up auto-refresh interval
  useEffect(() => {
    if (!enabled || refreshInterval <= 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        setIsStale(true);
        fetchData();
      }
    }, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, refreshInterval, fetchData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    refresh: fetchData,
    lastUpdated,
    isStale,
  };
}

// Specialized hook for dashboard metrics
export function useDashboardMetrics<T>(
  fetchFn: () => Promise<T>,
  refreshInterval: number = 60000, // 1 minute for dashboard metrics
) {
  return useRealTimeMetrics({
    fetchFn,
    refreshInterval,
    enabled: true,
    onError: (error) => {
      console.error("Dashboard metrics error:", error);
    },
  });
}

// Hook for high-frequency updates (e.g., real-time monitoring)
export function useHighFrequencyMetrics<T>(
  fetchFn: () => Promise<T>,
  refreshInterval: number = 5000, // 5 seconds for real-time data
) {
  return useRealTimeMetrics({
    fetchFn,
    refreshInterval,
    enabled: true,
  });
}
