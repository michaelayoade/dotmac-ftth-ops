/**
 * Usage Billing API Integration Hooks
 *
 * Custom React hooks for interacting with usage billing APIs.
 * Provides data fetching, statistics, and operations for metered services.
 */

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export type UsageType =
  | 'data_transfer'
  | 'voice_minutes'
  | 'sms_count'
  | 'bandwidth_gb'
  | 'overage_gb'
  | 'static_ip'
  | 'equipment_rental'
  | 'installation_fee'
  | 'custom';

export type BilledStatus = 'pending' | 'billed' | 'error' | 'excluded';

export interface UsageRecord {
  id: string;
  tenant_id: string;
  subscription_id: string;
  customer_id: string;
  customer_name?: string;
  usage_type: UsageType;
  quantity: number;
  unit: string;
  unit_price: number; // in cents
  total_amount: number; // in cents
  currency: string;
  period_start: string;
  period_end: string;
  billed_status: BilledStatus;
  invoice_id?: string;
  billed_at?: string;
  source_system: string;
  source_record_id?: string;
  description?: string;
  device_id?: string;
  service_location?: string;
  created_at: string;
  updated_at: string;
}

export interface UsageAggregate {
  id: string;
  tenant_id: string;
  subscription_id?: string;
  customer_id?: string;
  usage_type: UsageType;
  period_start: string;
  period_end: string;
  period_type: 'hourly' | 'daily' | 'monthly';
  total_quantity: number;
  total_amount: number; // in cents
  record_count: number;
  min_quantity?: number;
  max_quantity?: number;
}

export interface UsageSummary {
  usage_type: UsageType;
  total_quantity: number;
  total_amount: number; // in cents
  currency: string;
  record_count: number;
  period_start: string;
  period_end: string;
}

export interface UsageStats {
  total_records: number;
  total_amount: number; // in cents
  pending_amount: number; // in cents
  billed_amount: number; // in cents
  by_type: Record<string, UsageSummary>;
  period_start: string;
  period_end: string;
}

export interface UsageQueryParams {
  customer_id?: string;
  subscription_id?: string;
  usage_type?: UsageType;
  billed_status?: BilledStatus;
  period_start?: string;
  period_end?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// API Client Configuration
// ============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Simple API client (replace with your actual API client)
const apiClient = {
  get: async (url: string) => {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add authentication headers here
      },
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    return response.json();
  },
  post: async (url: string, data?: any) => {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add authentication headers here
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    return response.json();
  },
  put: async (url: string, data?: any) => {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        // Add authentication headers here
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    return response.json();
  },
};

// ============================================================================
// Hook: useUsageRecords
// ============================================================================

/**
 * Fetch usage records with optional filtering
 *
 * @example
 * const { records, isLoading, error, refetch } = useUsageRecords({
 *   customer_id: 'cust-123',
 *   billed_status: 'pending',
 *   limit: 100,
 * });
 */
export function useUsageRecords(params?: UsageQueryParams) {
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRecords = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Build query string
      const queryParams = new URLSearchParams();
      if (params?.customer_id) queryParams.append('customer_id', params.customer_id);
      if (params?.subscription_id) queryParams.append('subscription_id', params.subscription_id);
      if (params?.usage_type) queryParams.append('usage_type', params.usage_type);
      if (params?.billed_status) queryParams.append('billed_status', params.billed_status);
      if (params?.period_start) queryParams.append('period_start', params.period_start);
      if (params?.period_end) queryParams.append('period_end', params.period_end);
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.offset) queryParams.append('offset', params.offset.toString());

      const endpoint = `/api/v1/billing/usage/records?${queryParams.toString()}`;
      const response = await apiClient.get(endpoint);

      if (response.usage_records) {
        setRecords(response.usage_records as UsageRecord[]);
      }
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch usage records:', err);
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  return {
    records,
    isLoading,
    error,
    refetch: fetchRecords,
  };
}

// ============================================================================
// Hook: useUsageStatistics
// ============================================================================

/**
 * Fetch usage statistics for a time period
 *
 * @example
 * const { statistics, isLoading } = useUsageStatistics({
 *   period_start: '2025-01-01T00:00:00Z',
 *   period_end: '2025-01-31T23:59:59Z',
 * });
 */
export function useUsageStatistics(params?: { period_start?: string; period_end?: string }) {
  const [statistics, setStatistics] = useState<UsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStatistics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const queryParams = new URLSearchParams();
      if (params?.period_start) queryParams.append('period_start', params.period_start);
      if (params?.period_end) queryParams.append('period_end', params.period_end);

      const endpoint = `/api/v1/billing/usage/statistics?${queryParams.toString()}`;
      const response = await apiClient.get(endpoint);

      if (response) {
        setStatistics(response as UsageStats);
      }
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch usage statistics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  return {
    statistics,
    isLoading,
    error,
    refetch: fetchStatistics,
  };
}

// ============================================================================
// Hook: useUsageAggregates
// ============================================================================

/**
 * Fetch pre-aggregated usage data for reporting
 *
 * @example
 * const { aggregates, isLoading } = useUsageAggregates({
 *   period_type: 'daily',
 *   usage_type: 'data_transfer',
 *   period_start: '2025-01-01T00:00:00Z',
 *   period_end: '2025-01-31T23:59:59Z',
 * });
 */
export function useUsageAggregates(params?: {
  period_type?: 'hourly' | 'daily' | 'monthly';
  usage_type?: UsageType;
  customer_id?: string;
  subscription_id?: string;
  period_start?: string;
  period_end?: string;
}) {
  const [aggregates, setAggregates] = useState<UsageAggregate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAggregates = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const queryParams = new URLSearchParams();
      if (params?.period_type) queryParams.append('period_type', params.period_type);
      if (params?.usage_type) queryParams.append('usage_type', params.usage_type);
      if (params?.customer_id) queryParams.append('customer_id', params.customer_id);
      if (params?.subscription_id) queryParams.append('subscription_id', params.subscription_id);
      if (params?.period_start) queryParams.append('period_start', params.period_start);
      if (params?.period_end) queryParams.append('period_end', params.period_end);

      const endpoint = `/api/v1/billing/usage/aggregates?${queryParams.toString()}`;
      const response = await apiClient.get(endpoint);

      if (response.aggregates) {
        setAggregates(response.aggregates as UsageAggregate[]);
      }
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch usage aggregates:', err);
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchAggregates();
  }, [fetchAggregates]);

  return {
    aggregates,
    isLoading,
    error,
    refetch: fetchAggregates,
  };
}

// ============================================================================
// Hook: useUsageOperations
// ============================================================================

/**
 * Perform operations on usage records (mark as billed, exclude, etc.)
 *
 * @example
 * const { markAsBilled, excludeFromBilling, isLoading } = useUsageOperations();
 * await markAsBilled(['usage-1', 'usage-2'], 'inv-123');
 */
export function useUsageOperations() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Mark usage records as billed and associate with invoice
   */
  const markAsBilled = useCallback(async (usageIds: string[], invoiceId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const promises = usageIds.map(id =>
        apiClient.put(`/api/v1/billing/usage/records/${id}`, {
          billed_status: 'billed',
          invoice_id: invoiceId,
          billed_at: new Date().toISOString(),
        })
      );

      await Promise.all(promises);
      return true;
    } catch (err) {
      setError(err as Error);
      console.error('Failed to mark usage as billed:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Exclude usage records from billing
   */
  const excludeFromBilling = useCallback(async (usageIds: string[]) => {
    try {
      setIsLoading(true);
      setError(null);

      const promises = usageIds.map(id =>
        apiClient.put(`/api/v1/billing/usage/records/${id}`, {
          billed_status: 'excluded',
        })
      );

      await Promise.all(promises);
      return true;
    } catch (err) {
      setError(err as Error);
      console.error('Failed to exclude usage from billing:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Mark usage records as pending (undo billed/excluded)
   */
  const markAsPending = useCallback(async (usageIds: string[]) => {
    try {
      setIsLoading(true);
      setError(null);

      const promises = usageIds.map(id =>
        apiClient.put(`/api/v1/billing/usage/records/${id}`, {
          billed_status: 'pending',
          invoice_id: null,
          billed_at: null,
        })
      );

      await Promise.all(promises);
      return true;
    } catch (err) {
      setError(err as Error);
      console.error('Failed to mark usage as pending:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Create a new usage record
   */
  const createUsageRecord = useCallback(async (data: Partial<UsageRecord>) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.post('/api/v1/billing/usage/records', data);
      return response as UsageRecord;
    } catch (err) {
      setError(err as Error);
      console.error('Failed to create usage record:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Bulk create usage records
   */
  const bulkCreateUsageRecords = useCallback(async (records: Partial<UsageRecord>[]) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.post('/api/v1/billing/usage/records/bulk', {
        records,
      });
      return response.created_count as number;
    } catch (err) {
      setError(err as Error);
      console.error('Failed to bulk create usage records:', err);
      return 0;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    markAsBilled,
    excludeFromBilling,
    markAsPending,
    createUsageRecord,
    bulkCreateUsageRecords,
    isLoading,
    error,
  };
}

// ============================================================================
// Hook: useUsageChartData
// ============================================================================

/**
 * Fetch and format usage data for charts
 *
 * @example
 * const { chartData, isLoading } = useUsageChartData({
 *   period_type: 'daily',
 *   days: 30,
 * });
 */
export function useUsageChartData(params?: {
  period_type?: 'hourly' | 'daily' | 'monthly';
  days?: number;
  usage_types?: UsageType[];
}) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchChartData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Calculate period
      const days = params?.days || 7;
      const period_end = new Date();
      const period_start = new Date(Date.now() - days * 86400000);

      const queryParams = new URLSearchParams({
        period_type: params?.period_type || 'daily',
        period_start: period_start.toISOString(),
        period_end: period_end.toISOString(),
      });

      const endpoint = `/api/v1/billing/usage/aggregates?${queryParams.toString()}`;
      const response = await apiClient.get(endpoint);

      if (response.aggregates) {
        // Transform aggregates into chart-friendly format
        const aggregates = response.aggregates as UsageAggregate[];

        // Group by period
        const grouped = aggregates.reduce((acc: any, agg) => {
          const date = new Date(agg.period_start).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });

          if (!acc[date]) {
            acc[date] = { date };
          }

          acc[date][agg.usage_type] = agg.total_quantity;

          return acc;
        }, {});

        setChartData(Object.values(grouped));
      }
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch usage chart data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  return {
    chartData,
    isLoading,
    error,
    refetch: fetchChartData,
  };
}

// Export all hooks
export default {
  useUsageRecords,
  useUsageStatistics,
  useUsageAggregates,
  useUsageOperations,
  useUsageChartData,
};
