/**
 * React Query hooks for Usage Billing Management
 *
 * Provides hooks for:
 * - Fetching usage records and aggregates
 * - Managing usage records (CRUD)
 * - Tracking usage statistics
 * - Billing operations (mark billed, exclude)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@dotmac/ui";
import {
  usageBillingService,
  type UsageAggregate,
  type UsageAggregateFilters,
  type UsageChartData,
  type UsageChartFilters,
  type UsageRecord,
  type UsageRecordCreate,
  type UsageRecordFilters,
  type UsageRecordUpdate,
  type UsageStatistics,
} from "@/lib/services/usage-billing-service";
import { logger } from "@/lib/logger";

const toError = (error: unknown) =>
  error instanceof Error ? error : new Error(typeof error === "string" ? error : String(error));

// Re-export types for convenience
export type {
  BilledStatus,
  UsageAggregate,
  UsageChartData,
  UsageRecord,
  UsageRecordCreate,
  UsageRecordUpdate,
  UsageStatistics,
  UsageType,
} from "@/lib/services/usage-billing-service";

// ============================================
// Query Keys
// ============================================

export const usageKeys = {
  all: ["usage"] as const,
  records: () => [...usageKeys.all, "records"] as const,
  record: (filters: UsageRecordFilters) => [...usageKeys.records(), filters] as const,
  recordDetail: (id: string) => [...usageKeys.records(), id] as const,
  aggregates: () => [...usageKeys.all, "aggregates"] as const,
  aggregate: (filters: UsageAggregateFilters) => [...usageKeys.aggregates(), filters] as const,
  statistics: (periodStart?: string, periodEnd?: string) =>
    [...usageKeys.all, "statistics", periodStart, periodEnd] as const,
  chartData: (filters: UsageChartFilters) => [...usageKeys.all, "chart", filters] as const,
};

// ============================================
// Usage Records Query Hooks
// ============================================

/**
 * Hook to fetch usage records
 *
 * @param filters - Record filters
 * @returns Usage records with loading and error states
 */
export function useUsageRecords(filters: UsageRecordFilters = {}) {
  return useQuery<UsageRecord[], Error, UsageRecord[], any>({
    queryKey: usageKeys.record(filters),
    queryFn: () => usageBillingService.listUsageRecords(filters),
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch single usage record
 *
 * @param recordId - Record UUID
 * @returns Usage record details with loading and error states
 */
export function useUsageRecord(recordId: string | null) {
  return useQuery<UsageRecord, Error, UsageRecord, any>({
    queryKey: usageKeys.recordDetail(recordId!),
    queryFn: () => usageBillingService.getUsageRecord(recordId!),
    enabled: !!recordId,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });
}

// ============================================
// Usage Records Mutation Hooks
// ============================================

/**
 * Hook to create usage record
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function useCreateUsageRecord(options?: {
  onSuccess?: (record: UsageRecord) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<UsageRecord, Error, UsageRecordCreate>({
    mutationFn: (data) => usageBillingService.createUsageRecord(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: usageKeys.records() });
      queryClient.invalidateQueries({ queryKey: usageKeys.statistics() });
      queryClient.invalidateQueries({ queryKey: usageKeys.aggregates() });

      // toast.success('Usage record created successfully');

      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to create usage record', {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

/**
 * Hook to create multiple usage records
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function useCreateUsageRecordsBulk(options?: {
  onSuccess?: (records: UsageRecord[]) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<UsageRecord[], Error, UsageRecordCreate[]>({
    mutationFn: (records) => usageBillingService.createUsageRecordsBulk(records),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: usageKeys.records() });
      queryClient.invalidateQueries({ queryKey: usageKeys.statistics() });
      queryClient.invalidateQueries({ queryKey: usageKeys.aggregates() });

      // toast.success(`${data.length} usage records created successfully`);

      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to create usage records', {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

/**
 * Hook to update usage record
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function useUpdateUsageRecord(options?: {
  onSuccess?: (record: UsageRecord) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<UsageRecord, Error, { recordId: string; data: UsageRecordUpdate }>({
    mutationFn: ({ recordId, data }) => usageBillingService.updateUsageRecord(recordId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: usageKeys.records() });
      queryClient.invalidateQueries({
        queryKey: usageKeys.recordDetail(data.id),
      });
      queryClient.invalidateQueries({ queryKey: usageKeys.statistics() });

      // toast.success('Usage record updated successfully');

      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to update usage record', {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

/**
 * Hook to delete usage record
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function useDeleteUsageRecord(options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (recordId) => usageBillingService.deleteUsageRecord(recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usageKeys.records() });
      queryClient.invalidateQueries({ queryKey: usageKeys.statistics() });
      queryClient.invalidateQueries({ queryKey: usageKeys.aggregates() });

      // toast.success('Usage record deleted successfully');

      options?.onSuccess?.();
    },
    onError: (error) => {
      // toast.error('Failed to delete usage record', {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

/**
 * Hook to mark usage records as billed
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function useMarkUsageRecordsAsBilled(options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { recordIds: string[]; invoiceId: string }>({
    mutationFn: ({ recordIds, invoiceId }) =>
      usageBillingService.markUsageRecordsAsBilled(recordIds, invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usageKeys.records() });
      queryClient.invalidateQueries({ queryKey: usageKeys.statistics() });

      // toast.success('Usage records marked as billed');

      options?.onSuccess?.();
    },
    onError: (error) => {
      // toast.error('Failed to mark usage records as billed', {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

/**
 * Hook to exclude usage records from billing
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function useExcludeUsageRecordsFromBilling(options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string[]>({
    mutationFn: (recordIds) => usageBillingService.excludeUsageRecordsFromBilling(recordIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usageKeys.records() });
      queryClient.invalidateQueries({ queryKey: usageKeys.statistics() });

      // toast.success('Usage records excluded from billing');

      options?.onSuccess?.();
    },
    onError: (error) => {
      // toast.error('Failed to exclude usage records from billing', {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

// ============================================
// Usage Aggregates Query Hooks
// ============================================

/**
 * Hook to fetch usage aggregates
 *
 * @param filters - Aggregate filters
 * @returns Usage aggregates with loading and error states
 */
export function useUsageAggregates(filters: UsageAggregateFilters = {}) {
  return useQuery<UsageAggregate[], Error, UsageAggregate[], any>({
    queryKey: usageKeys.aggregate(filters),
    queryFn: () => usageBillingService.listUsageAggregates(filters),
    staleTime: 60000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ============================================
// Statistics Hooks
// ============================================

/**
 * Hook to fetch usage statistics
 *
 * @param periodStart - Period start date (optional)
 * @param periodEnd - Period end date (optional)
 * @returns Usage statistics with loading and error states
 */
export function useUsageStatistics(periodStart?: string, periodEnd?: string) {
  return useQuery<UsageStatistics, Error, UsageStatistics, any>({
    queryKey: usageKeys.statistics(periodStart, periodEnd),
    queryFn: () => usageBillingService.getUsageStatistics(periodStart, periodEnd),
    staleTime: 60000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch usage chart data
 *
 * @param filters - Chart data filters
 * @returns Chart data with loading and error states
 */
export function useUsageChartData(filters: UsageChartFilters) {
  return useQuery<UsageChartData[], Error, UsageChartData[], any>({
    queryKey: usageKeys.chartData(filters),
    queryFn: () => usageBillingService.getUsageChartData(filters),
    staleTime: 60000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ============================================
// Combined Operations Hook
// ============================================

/**
 * Hook that combines all usage operations
 *
 * @returns All operation hooks
 */
export function useUsageOperations() {
  const markAsBilled = useMarkUsageRecordsAsBilled();
  const excludeFromBilling = useExcludeUsageRecordsFromBilling();

  return {
    markAsBilled: async (recordIds: string[], invoiceId: string) => {
      try {
        await markAsBilled.mutateAsync({ recordIds, invoiceId });
        return true;
      } catch (error) {
        logger.error("Failed to mark usage records as billed", toError(error), {
          invoiceId,
          recordCount: recordIds.length,
        });
        return false;
      }
    },
    excludeFromBilling: async (recordIds: string[]) => {
      try {
        await excludeFromBilling.mutateAsync(recordIds);
        return true;
      } catch (error) {
        logger.error("Failed to exclude usage records from billing", toError(error), {
          recordCount: recordIds.length,
        });
        return false;
      }
    },
    isLoading: markAsBilled.isPending || excludeFromBilling.isPending,
  };
}
