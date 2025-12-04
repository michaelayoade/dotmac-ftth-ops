/**
 * Analytics Hook
 *
 * Comprehensive analytics data management with real-time updates,
 * caching, and business intelligence calculations.
 *
 * Features:
 * - Real-time analytics data fetching
 * - Automated metric calculations
 * - Historical data management
 * - Performance optimizations
 * - Error handling and retry logic
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useQueries, QueryClient } from "@tanstack/react-query";

// Types
interface AnalyticsMetric {
  id: string;
  name: string;
  value: number;
  previousValue?: number;
  change?: number;
  changePercent?: number;
  trend?: "up" | "down" | "stable";
  target?: number;
  unit?: string;
}

interface TimeSeriesData {
  timestamp: string;
  date: string;
  revenue: number;
  customers: number;
  services: number;
  churn: number;
  arpu: number;
  costs: number;
  profit: number;
}

interface CustomerSegment {
  segment: string;
  count: number;
  revenue: number;
  percentage: number;
  color: string;
}

interface GeographicData {
  region: string;
  state?: string;
  city?: string;
  latitude: number;
  longitude: number;
  customers: number;
  revenue: number;
  growth: number;
}

interface ServiceMetrics {
  service: string;
  subscribers: number;
  revenue: number;
  churn: number;
  satisfaction: number;
  arpu: number;
}

interface AnalyticsFilters {
  dateRange: {
    start: string;
    end: string;
  };
  segments?: string[];
  regions?: string[];
  services?: string[];
  granularity: "hourly" | "daily" | "weekly" | "monthly";
}

interface UseAnalyticsOptions {
  filters: AnalyticsFilters;
  refreshInterval?: number;
  enableRealTime?: boolean;
  cacheTime?: number;
  staleTime?: number;
}

interface AnalyticsData {
  metrics: AnalyticsMetric[];
  timeSeriesData: TimeSeriesData[];
  customerSegments: CustomerSegment[];
  geographicData: GeographicData[];
  serviceMetrics: ServiceMetrics[];
  summary: {
    totalRevenue: number;
    totalCustomers: number;
    avgChurn: number;
    avgARPU: number;
    profitMargin: number;
    growthRate: number;
  };
}

// API functions
const fetchAnalyticsMetrics = async (filters: AnalyticsFilters): Promise<AnalyticsMetric[]> => {
  const params = new URLSearchParams({
    start: filters.dateRange.start,
    end: filters.dateRange.end,
    granularity: filters.granularity,
  });

  if (filters.segments?.length) {
    params.append("segments", filters.segments.join(","));
  }
  if (filters.regions?.length) {
    params.append("regions", filters.regions.join(","));
  }
  if (filters.services?.length) {
    params.append("services", filters.services.join(","));
  }

  const response = await fetch(`/api/analytics/metrics?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch analytics metrics: ${response.statusText}`);
  }

  return response.json();
};

const fetchTimeSeriesData = async (filters: AnalyticsFilters): Promise<TimeSeriesData[]> => {
  const params = new URLSearchParams({
    start: filters.dateRange.start,
    end: filters.dateRange.end,
    granularity: filters.granularity,
  });

  const response = await fetch(`/api/analytics/timeseries?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch time series data: ${response.statusText}`);
  }

  return response.json();
};

const fetchCustomerSegments = async (filters: AnalyticsFilters): Promise<CustomerSegment[]> => {
  const params = new URLSearchParams({
    start: filters.dateRange.start,
    end: filters.dateRange.end,
  });

  const response = await fetch(`/api/analytics/customer-segments?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch customer segments: ${response.statusText}`);
  }

  return response.json();
};

const fetchGeographicData = async (filters: AnalyticsFilters): Promise<GeographicData[]> => {
  const params = new URLSearchParams({
    start: filters.dateRange.start,
    end: filters.dateRange.end,
  });

  const response = await fetch(`/api/analytics/geographic?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch geographic data: ${response.statusText}`);
  }

  return response.json();
};

const fetchServiceMetrics = async (filters: AnalyticsFilters): Promise<ServiceMetrics[]> => {
  const params = new URLSearchParams({
    start: filters.dateRange.start,
    end: filters.dateRange.end,
  });

  const response = await fetch(`/api/analytics/services?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch service metrics: ${response.statusText}`);
  }

  return response.json();
};

// Utility functions
const calculateTrend = (current: number, previous: number): "up" | "down" | "stable" => {
  if (!previous) return "stable";
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 1) return "stable";
  return change > 0 ? "up" : "down";
};

const calculatePercentageChange = (current: number, previous: number): number => {
  if (!previous) return 0;
  return ((current - previous) / previous) * 100;
};

// Main hook
export const useAnalytics = (options: UseAnalyticsOptions) => {
  const {
    filters,
    refreshInterval = 30000,
    enableRealTime = false,
    cacheTime = 300000, // 5 minutes
    staleTime = 60000, // 1 minute
  } = options;

  const [isRealTimeActive, setIsRealTimeActive] = useState(enableRealTime);
  const websocketRef = useRef<WebSocket | null>(null);
  const [realTimeUpdates, setRealTimeUpdates] = useState<Partial<AnalyticsData>>({});

  // Query configuration
  const refetchInterval: number | false = isRealTimeActive ? refreshInterval : false;

  const queryConfig = {
    staleTime,
    cacheTime,
    refetchInterval,
    retry: 3,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  };

  // Fetch all analytics data
  const queries = useQueries({
    queries: [
      {
        queryKey: ["analytics", "metrics", filters],
        queryFn: () => fetchAnalyticsMetrics(filters),
        ...queryConfig,
      },
      {
        queryKey: ["analytics", "timeseries", filters],
        queryFn: () => fetchTimeSeriesData(filters),
        ...queryConfig,
      },
      {
        queryKey: ["analytics", "customer-segments", filters],
        queryFn: () => fetchCustomerSegments(filters),
        ...queryConfig,
      },
      {
        queryKey: ["analytics", "geographic", filters],
        queryFn: () => fetchGeographicData(filters),
        ...queryConfig,
      },
      {
        queryKey: ["analytics", "services", filters],
        queryFn: () => fetchServiceMetrics(filters),
        ...queryConfig,
      },
    ],
  });

  const [
    metricsQuery,
    timeSeriesQuery,
    customerSegmentsQuery,
    geographicQuery,
    serviceMetricsQuery,
  ] = queries;

  // WebSocket for real-time updates
  useEffect(() => {
    if (!isRealTimeActive) return;

    const wsUrl = `${process.env["NEXT_PUBLIC_WS_URL"] || "ws://localhost:3001"}/analytics`;
    websocketRef.current = new WebSocket(wsUrl);

    websocketRef.current.onopen = () => {
      console.log("Analytics WebSocket connected");
      // Subscribe to analytics updates
      websocketRef.current?.send(
        JSON.stringify({
          type: "subscribe",
          filters,
        }),
      );
    };

    websocketRef.current.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        setRealTimeUpdates((prev) => ({
          ...prev,
          [update.type]: update.data,
        }));
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    websocketRef.current.onerror = (error) => {
      console.error("Analytics WebSocket error:", error);
    };

    websocketRef.current.onclose = () => {
      console.log("Analytics WebSocket disconnected");
    };

    return () => {
      websocketRef.current?.close();
    };
  }, [isRealTimeActive, filters]);

  // Calculate derived metrics
  const calculatedMetrics = useMemo(() => {
    const timeSeriesData = timeSeriesQuery.data || [];
    if (!timeSeriesData.length) return null;

    const latestData = timeSeriesData[timeSeriesData.length - 1];
    if (!latestData) {
      return null;
    }
    const previousData = timeSeriesData[timeSeriesData.length - 2];

    const totalRevenue = timeSeriesData.reduce((sum, data) => sum + data.revenue, 0);
    const totalCustomers = latestData.customers;
    const avgChurn =
      timeSeriesData.reduce((sum, data) => sum + data.churn, 0) / timeSeriesData.length;
    const avgARPU =
      timeSeriesData.reduce((sum, data) => sum + data.arpu, 0) / timeSeriesData.length;
    const totalCosts = timeSeriesData.reduce((sum, data) => sum + data.costs, 0);
    const totalProfit = timeSeriesData.reduce((sum, data) => sum + data.profit, 0);
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Calculate growth rate
    const firstMonth = timeSeriesData[0];
    const lastMonth = latestData;
    const monthsDiff = timeSeriesData.length || 1;
    const growthRate =
      firstMonth && lastMonth && firstMonth.revenue > 0
        ? (Math.pow(lastMonth.revenue / firstMonth.revenue, 1 / monthsDiff) - 1) * 100
        : 0;

    return {
      totalRevenue,
      totalCustomers,
      avgChurn,
      avgARPU,
      profitMargin,
      growthRate,
    };
  }, [timeSeriesQuery.data]);

  // Enhanced metrics with calculations
  const enhancedMetrics = useMemo(() => {
    const baseMetrics = metricsQuery.data || [];
    const timeSeriesData = timeSeriesQuery.data || [];

    if (!timeSeriesData.length) return baseMetrics;

    const latestData = timeSeriesData[timeSeriesData.length - 1];
    if (!latestData) {
      return baseMetrics;
    }
    const previousData = timeSeriesData[timeSeriesData.length - 2];

    return baseMetrics.map((metric) => {
      let enhancedMetric = { ...metric };

      // Add trend and change calculations
      if (previousData) {
        const currentValue = latestData[metric.id as keyof TimeSeriesData] as number;
        const previousValue = previousData[metric.id as keyof TimeSeriesData] as number;

        if (typeof currentValue === "number" && typeof previousValue === "number") {
          enhancedMetric.previousValue = previousValue;
          enhancedMetric.change = currentValue - previousValue;
          enhancedMetric.changePercent = calculatePercentageChange(currentValue, previousValue);
          enhancedMetric.trend = calculateTrend(currentValue, previousValue);
        }
      }

      return enhancedMetric;
    });
  }, [metricsQuery.data, timeSeriesQuery.data]);

  // Combine base data with real-time updates
  const combinedData = useMemo((): AnalyticsData | null => {
    const isLoading = queries.some((query) => query.isLoading);
    const hasError = queries.some((query) => query.isError);

    if (isLoading || hasError || !calculatedMetrics) return null;

    return {
      metrics: realTimeUpdates.metrics || enhancedMetrics,
      timeSeriesData: realTimeUpdates.timeSeriesData || timeSeriesQuery.data || [],
      customerSegments: realTimeUpdates.customerSegments || customerSegmentsQuery.data || [],
      geographicData: realTimeUpdates.geographicData || geographicQuery.data || [],
      serviceMetrics: realTimeUpdates.serviceMetrics || serviceMetricsQuery.data || [],
      summary: calculatedMetrics,
    };
  }, [
    queries,
    enhancedMetrics,
    timeSeriesQuery.data,
    customerSegmentsQuery.data,
    geographicQuery.data,
    serviceMetricsQuery.data,
    calculatedMetrics,
    realTimeUpdates,
  ]);

  // Utility functions
  const toggleRealTime = useCallback(() => {
    setIsRealTimeActive((prev) => !prev);
  }, []);

  const refreshData = useCallback(() => {
    queries.forEach((query) => query.refetch());
  }, [queries]);

  const exportData = useCallback(
    async (format: "csv" | "excel" | "pdf") => {
      if (!combinedData) return;

      try {
        const response = await fetch("/api/analytics/export", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            data: combinedData,
            format,
            filters,
          }),
        });

        if (!response.ok) {
          throw new Error(`Export failed: ${response.statusText}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `analytics-${new Date().toISOString().split("T")[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        console.error("Export failed:", error);
        throw error;
      }
    },
    [combinedData, filters],
  );

  // Return hook interface
  return {
    // Data
    data: combinedData,
    metrics: combinedData?.metrics || [],
    timeSeriesData: combinedData?.timeSeriesData || [],
    customerSegments: combinedData?.customerSegments || [],
    geographicData: combinedData?.geographicData || [],
    serviceMetrics: combinedData?.serviceMetrics || [],
    summary: combinedData?.summary,

    // State
    isLoading: queries.some((query) => query.isLoading),
    isError: queries.some((query) => query.isError),
    error: queries.find((query) => query.isError)?.error,
    isRealTimeActive,
    lastUpdated: Math.max(...queries.map((query) => query.dataUpdatedAt || 0)),

    // Actions
    toggleRealTime,
    refreshData,
    exportData,

    // Query states for individual components
    queries: {
      metrics: metricsQuery,
      timeSeries: timeSeriesQuery,
      customerSegments: customerSegmentsQuery,
      geographic: geographicQuery,
      services: serviceMetricsQuery,
    },
  };
};

// Specialized hooks for specific analytics
export const useRevenueAnalytics = (filters: AnalyticsFilters) => {
  const { data, isLoading, isError } = useAnalytics({ filters });

  const revenueMetrics = useMemo(() => {
    if (!data) return null;

    const { timeSeriesData, summary } = data;
    const totalRevenue = summary.totalRevenue;
    const avgRevenue = totalRevenue / (timeSeriesData.length || 1);

    // Calculate revenue growth trend
    const revenueData = timeSeriesData.map((d) => d.revenue);
    let trend: "up" | "down" | "stable" = "stable";
    if (revenueData.length > 1) {
      const latestValue = revenueData[revenueData.length - 1];
      const firstValue = revenueData[0];
      if (latestValue !== undefined && firstValue !== undefined) {
        trend = calculateTrend(latestValue, firstValue);
      }
    }

    return {
      total: totalRevenue,
      average: avgRevenue,
      trend,
      profitMargin: summary.profitMargin,
      growthRate: summary.growthRate,
    };
  }, [data]);

  return {
    revenueMetrics,
    timeSeriesData: data?.timeSeriesData || [],
    isLoading,
    isError,
  };
};

export const useCustomerAnalytics = (filters: AnalyticsFilters) => {
  const { data, isLoading, isError } = useAnalytics({ filters });

  const customerMetrics = useMemo(() => {
    if (!data) return null;

    const { summary, customerSegments } = data;
    const totalCustomers = summary.totalCustomers;
    const churnRate = summary.avgChurn;
    const retentionRate = 1 - churnRate;
    const arpu = summary.avgARPU;

    // Customer lifetime value estimation
    const clv = retentionRate > 0 ? (arpu * 12) / churnRate : 0;

    return {
      total: totalCustomers,
      churnRate,
      retentionRate,
      arpu,
      clv,
      segments: customerSegments,
    };
  }, [data]);

  return {
    customerMetrics,
    segments: data?.customerSegments || [],
    isLoading,
    isError,
  };
};

export default useAnalytics;
