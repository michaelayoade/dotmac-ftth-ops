/**
 * React Query hooks for Dunning & Collections Management
 *
 * Provides hooks for:
 * - Fetching dunning campaigns and executions
 * - Managing campaign lifecycle (pause/resume/delete)
 * - Tracking dunning statistics
 * - Managing executions (start/cancel)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@dotmac/ui";
import {
  dunningService,
  type CampaignListFilters,
  type DunningCampaign,
  type DunningCampaignCreate,
  type DunningCampaignStats,
  type DunningCampaignUpdate,
  type DunningExecution,
  type DunningExecutionStart,
  type DunningRecoveryChartData,
  type DunningStatistics,
  type ExecutionListFilters,
} from "@/lib/services/dunning-service";

// Re-export types for convenience
export type {
  DunningCampaign,
  DunningExecution,
  DunningStatistics,
  DunningCampaignStats,
  DunningRecoveryChartData,
};

// ============================================
// Query Keys
// ============================================

export const dunningKeys = {
  all: ["dunning"] as const,
  campaigns: () => [...dunningKeys.all, "campaigns"] as const,
  campaign: (filters: CampaignListFilters) => [...dunningKeys.campaigns(), filters] as const,
  campaignDetail: (id: string) => [...dunningKeys.campaigns(), id] as const,
  executions: () => [...dunningKeys.all, "executions"] as const,
  execution: (filters: ExecutionListFilters) => [...dunningKeys.executions(), filters] as const,
  executionDetail: (id: string) => [...dunningKeys.executions(), id] as const,
  statistics: () => [...dunningKeys.all, "statistics"] as const,
  campaignStats: (id: string) => [...dunningKeys.statistics(), "campaign", id] as const,
  recoveryChart: (days: number) => [...dunningKeys.all, "recovery-chart", days] as const,
};

// ============================================
// Campaign Query Hooks
// ============================================

/**
 * Hook to fetch dunning campaigns
 *
 * @param filters - Campaign filters
 * @returns Campaigns with loading and error states
 */
export function useDunningCampaigns(filters: CampaignListFilters = {}) {
  return useQuery<DunningCampaign[], Error, DunningCampaign[], any>({
    queryKey: dunningKeys.campaign(filters),
    queryFn: () => dunningService.listCampaigns(filters),
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch single dunning campaign
 *
 * @param campaignId - Campaign UUID
 * @returns Campaign details with loading and error states
 */
export function useDunningCampaign(campaignId: string | null) {
  return useQuery<DunningCampaign, Error, DunningCampaign, any>({
    queryKey: dunningKeys.campaignDetail(campaignId!),
    queryFn: () => dunningService.getCampaign(campaignId!),
    enabled: !!campaignId,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });
}

// ============================================
// Campaign Mutation Hooks
// ============================================

/**
 * Hook to create dunning campaign
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function useCreateDunningCampaign(options?: {
  onSuccess?: (campaign: DunningCampaign) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<DunningCampaign, Error, DunningCampaignCreate>({
    mutationFn: (data) => dunningService.createCampaign(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: dunningKeys.campaigns() });
      queryClient.invalidateQueries({ queryKey: dunningKeys.statistics() });

      // toast.success('Campaign created successfully', {
      //   description: `Campaign "${data.name}" has been created.`,
      // });

      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to create campaign', {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

/**
 * Hook to update dunning campaign
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function useUpdateDunningCampaign(options?: {
  onSuccess?: (campaign: DunningCampaign) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<DunningCampaign, Error, { campaignId: string; data: DunningCampaignUpdate }>({
    mutationFn: ({ campaignId, data }) => dunningService.updateCampaign(campaignId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: dunningKeys.campaigns() });
      queryClient.invalidateQueries({
        queryKey: dunningKeys.campaignDetail(data.id),
      });
      queryClient.invalidateQueries({ queryKey: dunningKeys.statistics() });

      // toast.success('Campaign updated successfully');

      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to update campaign', {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

/**
 * Hook to delete dunning campaign
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function useDeleteDunningCampaign(options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (campaignId) => dunningService.deleteCampaign(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dunningKeys.campaigns() });
      queryClient.invalidateQueries({ queryKey: dunningKeys.statistics() });

      // toast.success('Campaign deleted successfully');

      options?.onSuccess?.();
    },
    onError: (error) => {
      // toast.error('Failed to delete campaign', {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

/**
 * Hook to pause dunning campaign
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function usePauseDunningCampaign(options?: {
  onSuccess?: (campaign: DunningCampaign) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<DunningCampaign, Error, string>({
    mutationFn: (campaignId) => dunningService.pauseCampaign(campaignId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: dunningKeys.campaigns() });
      queryClient.invalidateQueries({
        queryKey: dunningKeys.campaignDetail(data.id),
      });
      queryClient.invalidateQueries({ queryKey: dunningKeys.statistics() });

      // toast.success('Campaign paused');

      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to pause campaign', {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

/**
 * Hook to resume dunning campaign
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function useResumeDunningCampaign(options?: {
  onSuccess?: (campaign: DunningCampaign) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<DunningCampaign, Error, string>({
    mutationFn: (campaignId) => dunningService.resumeCampaign(campaignId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: dunningKeys.campaigns() });
      queryClient.invalidateQueries({
        queryKey: dunningKeys.campaignDetail(data.id),
      });
      queryClient.invalidateQueries({ queryKey: dunningKeys.statistics() });

      // toast.success('Campaign resumed');

      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to resume campaign', {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

// ============================================
// Execution Query Hooks
// ============================================

/**
 * Hook to fetch dunning executions
 *
 * @param filters - Execution filters
 * @returns Executions with loading and error states
 */
export function useDunningExecutions(filters: ExecutionListFilters = {}) {
  return useQuery<DunningExecution[], Error, DunningExecution[], any>({
    queryKey: dunningKeys.execution(filters),
    queryFn: () => dunningService.listExecutions(filters),
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch single dunning execution
 *
 * @param executionId - Execution UUID
 * @returns Execution details with loading and error states
 */
export function useDunningExecution(executionId: string | null) {
  return useQuery<DunningExecution, Error, DunningExecution, any>({
    queryKey: dunningKeys.executionDetail(executionId!),
    queryFn: () => dunningService.getExecution(executionId!),
    enabled: !!executionId,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });
}

// ============================================
// Execution Mutation Hooks
// ============================================

/**
 * Hook to start dunning execution
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function useStartDunningExecution(options?: {
  onSuccess?: (execution: DunningExecution) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<DunningExecution, Error, DunningExecutionStart>({
    mutationFn: (data) => dunningService.startExecution(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: dunningKeys.executions() });
      queryClient.invalidateQueries({ queryKey: dunningKeys.statistics() });

      // toast.success('Dunning execution started', {
      //   description: `Execution started for subscription ${data.subscription_id}`,
      // });

      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to start execution', {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

/**
 * Hook to cancel dunning execution
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function useCancelDunningExecution(options?: {
  onSuccess?: (execution: DunningExecution) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<DunningExecution, Error, { executionId: string; reason: string }>({
    mutationFn: ({ executionId, reason }) => dunningService.cancelExecution(executionId, reason),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: dunningKeys.executions() });
      queryClient.invalidateQueries({
        queryKey: dunningKeys.executionDetail(data.id),
      });
      queryClient.invalidateQueries({ queryKey: dunningKeys.statistics() });

      // toast.success('Execution canceled');

      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to cancel execution', {
      //   description: error.message,
      // });

      options?.onError?.(error);
    },
  });
}

// ============================================
// Statistics Hooks
// ============================================

/**
 * Hook to fetch dunning statistics
 *
 * @returns Statistics with loading and error states
 */
export function useDunningStatistics() {
  return useQuery<DunningStatistics, Error, DunningStatistics, any>({
    queryKey: dunningKeys.statistics(),
    queryFn: () => dunningService.getStatistics(),
    staleTime: 60000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch campaign-specific statistics
 *
 * @param campaignId - Campaign UUID
 * @returns Campaign statistics with loading and error states
 */
export function useDunningCampaignStatistics(campaignId: string | null) {
  return useQuery<DunningCampaignStats, Error, DunningCampaignStats, any>({
    queryKey: dunningKeys.campaignStats(campaignId!),
    queryFn: () => dunningService.getCampaignStatistics(campaignId!),
    enabled: !!campaignId,
    staleTime: 60000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to fetch recovery chart data
 *
 * @param days - Number of days (default: 30)
 * @returns Chart data with loading and error states
 */
export function useDunningRecoveryChart(days: number = 30) {
  return useQuery<DunningRecoveryChartData[], Error, DunningRecoveryChartData[], any>({
    queryKey: dunningKeys.recoveryChart(days),
    queryFn: () => dunningService.getRecoveryChartData(days),
    staleTime: 60000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ============================================
// Combined Operations Hook
// ============================================

/**
 * Hook that combines all dunning operations (pause, resume, cancel)
 *
 * @returns All operation hooks
 */
export function useDunningOperations() {
  const pauseCampaign = usePauseDunningCampaign();
  const resumeCampaign = useResumeDunningCampaign();
  const cancelExecution = useCancelDunningExecution();

  return {
    pauseCampaign: (campaignId: string) => pauseCampaign.mutateAsync(campaignId),
    resumeCampaign: (campaignId: string) => resumeCampaign.mutateAsync(campaignId),
    cancelExecution: (executionId: string, reason: string) =>
      cancelExecution.mutateAsync({ executionId, reason }),
    isLoading: pauseCampaign.isPending || resumeCampaign.isPending || cancelExecution.isPending,
  };
}
