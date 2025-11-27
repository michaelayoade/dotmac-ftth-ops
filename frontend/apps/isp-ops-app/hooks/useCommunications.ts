/**
 * Communications React Query Hooks
 *
 * Hooks for email/SMS communications, templates, campaigns, and statistics.
 * Uses the communicationsService for all API calls.
 *
 * Pattern:
 * - Query hooks for data fetching with caching
 * - Mutation hooks with optimistic updates and cache invalidation
 * - Toast notifications on all mutations
 * - Automatic refetching and background updates
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@dotmac/ui";
import { communicationsService } from "@/lib/services/communications-service";
import type {
  // Requests
  SendEmailRequest,
  QueueEmailRequest,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  QuickRenderRequest,
  RenderTemplateRequest,
  QueueBulkRequest,
  ListCommunicationsParams,
  ListTemplatesParams,
  StatsParams,
  ActivityParams,
  // Responses
  SendEmailResponse,
  QueueEmailResponse,
  CommunicationLog,
  CommunicationTemplate,
  TemplateListResponse,
  RenderTemplateResponse,
  BulkOperation,
  BulkOperationStatusResponse,
  TaskStatusResponse,
  CommunicationStats,
  ActivityResponse,
  HealthResponse,
  MetricsResponse,
} from "@/types/communications";

// ==================== Query Keys ====================

export const communicationsKeys = {
  all: ["communications"] as const,
  logs: {
    all: ["communications", "logs"] as const,
    list: (params: ListCommunicationsParams) => ["communications", "logs", "list", params] as const,
    detail: (id: string) => ["communications", "logs", "detail", id] as const,
  },
  templates: {
    all: ["communications", "templates"] as const,
    list: (params: ListTemplatesParams) => ["communications", "templates", "list", params] as const,
    detail: (id: string) => ["communications", "templates", "detail", id] as const,
  },
  bulk: {
    all: ["communications", "bulk"] as const,
    detail: (id: string) => ["communications", "bulk", "detail", id] as const,
  },
  tasks: {
    detail: (taskId: string) => ["communications", "tasks", "detail", taskId] as const,
  },
  stats: {
    overview: (params: StatsParams) => ["communications", "stats", "overview", params] as const,
    activity: (params: ActivityParams) => ["communications", "stats", "activity", params] as const,
    health: () => ["communications", "stats", "health"] as const,
    metrics: () => ["communications", "stats", "metrics"] as const,
  },
};

// ==================== Email Operations ====================

/**
 * Send immediate email
 * POST /api/v1/communications/email/send
 */
export function useSendEmail(options?: {
  onSuccess?: (data: SendEmailResponse) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<SendEmailResponse, Error, SendEmailRequest>({
    mutationFn: (data) => communicationsService.sendEmail(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: communicationsKeys.logs.all });
      queryClient.invalidateQueries({
        queryKey: communicationsKeys.stats.overview({}),
      });
      // toast.success('Email sent successfully');
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to send email', { description: error.message });
      options?.onError?.(error);
    },
  });
}

/**
 * Queue async email
 * POST /api/v1/communications/email/queue
 */
export function useQueueEmail(options?: {
  onSuccess?: (data: QueueEmailResponse) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<QueueEmailResponse, Error, QueueEmailRequest>({
    mutationFn: (data) => communicationsService.queueEmail(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: communicationsKeys.logs.all });
      // toast.success('Email queued successfully');
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to queue email', { description: error.message });
      options?.onError?.(error);
    },
  });
}

// ==================== Template Management ====================

/**
 * List templates with pagination
 * GET /api/v1/communications/templates
 */
export function useTemplates(params: ListTemplatesParams = {}) {
  return useQuery<TemplateListResponse, Error, TemplateListResponse, any>({
    queryKey: communicationsKeys.templates.list(params),
    queryFn: () => communicationsService.listTemplates(params),
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get single template
 * GET /api/v1/communications/templates/{id}
 */
export function useTemplate(id: string | null) {
  return useQuery<CommunicationTemplate, Error, CommunicationTemplate, any>({
    queryKey: communicationsKeys.templates.detail(id || ""),
    queryFn: () => communicationsService.getTemplate(id!),
    enabled: !!id,
    staleTime: 60000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Create template
 * POST /api/v1/communications/templates
 */
export function useCreateTemplate(options?: {
  onSuccess?: (data: CommunicationTemplate) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<CommunicationTemplate, Error, CreateTemplateRequest>({
    mutationFn: (data) => communicationsService.createTemplate(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: communicationsKeys.templates.all,
      });
      queryClient.invalidateQueries({
        queryKey: communicationsKeys.stats.metrics(),
      });
      // toast.success('Template created successfully');
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to create template', { description: error.message });
      options?.onError?.(error);
    },
  });
}

/**
 * Update template
 * PUT /api/v1/communications/templates/{id}
 */
export function useUpdateTemplate(options?: {
  onSuccess?: (data: CommunicationTemplate) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<CommunicationTemplate, Error, { id: string; updates: UpdateTemplateRequest }>({
    mutationFn: ({ id, updates }) => communicationsService.updateTemplate(id, updates),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({
        queryKey: communicationsKeys.templates.detail(id),
      });
      queryClient.invalidateQueries({
        queryKey: communicationsKeys.templates.all,
      });
      // toast.success('Template updated successfully');
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to update template', { description: error.message });
      options?.onError?.(error);
    },
  });
}

/**
 * Delete template
 * DELETE /api/v1/communications/templates/{id}
 */
export function useDeleteTemplate(options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => communicationsService.deleteTemplate(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({
        queryKey: communicationsKeys.templates.all,
      });
      queryClient.invalidateQueries({
        queryKey: communicationsKeys.stats.metrics(),
      });
      queryClient.removeQueries({
        queryKey: communicationsKeys.templates.detail(id),
      });
      // toast.success('Template deleted successfully');
      options?.onSuccess?.();
    },
    onError: (error) => {
      // toast.error('Failed to delete template', { description: error.message });
      options?.onError?.(error);
    },
  });
}

/**
 * Render template with variables
 * POST /api/v1/communications/templates/{id}/render
 */
export function useRenderTemplate(options?: {
  onSuccess?: (data: RenderTemplateResponse) => void;
  onError?: (error: Error) => void;
}) {
  return useMutation<RenderTemplateResponse, Error, { id: string; variables: Record<string, any> }>(
    {
      mutationFn: ({ id, variables }) => communicationsService.renderTemplate(id, variables),
      onSuccess: (data) => {
        options?.onSuccess?.(data);
      },
      onError: (error) => {
        // toast.error('Failed to render template', { description: error.message });
        options?.onError?.(error);
      },
    },
  );
}

/**
 * Quick render without template ID
 * POST /api/v1/communications/render
 */
export function useQuickRender(options?: {
  onSuccess?: (data: RenderTemplateResponse) => void;
  onError?: (error: Error) => void;
}) {
  return useMutation<RenderTemplateResponse, Error, QuickRenderRequest>({
    mutationFn: (data) => communicationsService.quickRender(data),
    onSuccess: (data) => {
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to render template', { description: error.message });
      options?.onError?.(error);
    },
  });
}

// ==================== Communication Logs ====================

/**
 * List communication logs with filters
 * GET /api/v1/communications/logs
 */
export function useCommunicationLogs(params: ListCommunicationsParams = {}) {
  return useQuery<
    { logs: CommunicationLog[]; total: number },
    Error,
    { logs: CommunicationLog[]; total: number },
    any
  >({
    queryKey: communicationsKeys.logs.list(params),
    queryFn: () => communicationsService.listLogs(params),
    staleTime: 10000, // 10 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get single communication log
 * GET /api/v1/communications/logs/{id}
 */
export function useCommunicationLog(id: string | null) {
  return useQuery<CommunicationLog, Error, CommunicationLog, any>({
    queryKey: communicationsKeys.logs.detail(id || ""),
    queryFn: () => communicationsService.getLog(id!),
    enabled: !!id,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ==================== Bulk Operations ====================

/**
 * Queue bulk email operation
 * POST /api/v1/communications/bulk/queue
 */
export function useQueueBulk(options?: {
  onSuccess?: (data: BulkOperation) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<BulkOperation, Error, QueueBulkRequest>({
    mutationFn: (data) => communicationsService.queueBulkEmail(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: communicationsKeys.bulk.all });
      queryClient.invalidateQueries({
        queryKey: communicationsKeys.stats.overview({}),
      });
      // toast.success('Bulk operation queued successfully');
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to queue bulk operation', { description: error.message });
      options?.onError?.(error);
    },
  });
}

/**
 * Get bulk operation status
 * GET /api/v1/communications/bulk/{id}/status
 */
export function useBulkOperationStatus(id: string | null, options?: { refetchInterval?: number }) {
  return useQuery<BulkOperationStatusResponse, Error, BulkOperationStatusResponse, any>({
    queryKey: communicationsKeys.bulk.detail(id || ""),
    queryFn: () => communicationsService.getBulkEmailStatus(id!),
    enabled: !!id,
    refetchInterval: options?.refetchInterval ?? false, // For live updates
    staleTime: 5000, // 5 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Cancel bulk operation
 * POST /api/v1/communications/bulk/{id}/cancel
 */
export function useCancelBulk(options?: {
  onSuccess?: (data: BulkOperation) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<BulkOperation, Error, string>({
    mutationFn: (id) => communicationsService.cancelBulkEmail(id),
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({
        queryKey: communicationsKeys.bulk.detail(id),
      });
      queryClient.invalidateQueries({ queryKey: communicationsKeys.bulk.all });
      // toast.success('Bulk operation cancelled');
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to cancel bulk operation', { description: error.message });
      options?.onError?.(error);
    },
  });
}

// ==================== Task Monitoring ====================

/**
 * Get Celery task status
 * GET /api/v1/communications/tasks/{task_id}
 */
export function useTaskStatus(taskId: string | null, options?: { refetchInterval?: number }) {
  return useQuery<TaskStatusResponse, Error, TaskStatusResponse, any>({
    queryKey: communicationsKeys.tasks.detail(taskId || ""),
    queryFn: () => communicationsService.getTaskStatus(taskId!),
    enabled: !!taskId,
    refetchInterval: options?.refetchInterval ?? false, // For live updates
    staleTime: 2000, // 2 seconds
    gcTime: 1 * 60 * 1000, // 1 minute
  });
}

// ==================== Statistics & Analytics ====================

/**
 * Get communication statistics
 * GET /api/v1/communications/stats
 */
export function useCommunicationStats(params: StatsParams = {}) {
  return useQuery<CommunicationStats, Error, CommunicationStats, any>({
    queryKey: communicationsKeys.stats.overview(params),
    queryFn: () => communicationsService.getStatistics(params),
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get activity timeline
 * GET /api/v1/communications/activity
 */
export function useCommunicationActivity(params: ActivityParams = {}) {
  return useQuery<ActivityResponse, Error, ActivityResponse, any>({
    queryKey: communicationsKeys.stats.activity(params),
    queryFn: () => communicationsService.getRecentActivity(params),
    staleTime: 60000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Get health status
 * GET /api/v1/communications/health
 */
export function useCommunicationHealth() {
  return useQuery<HealthResponse, Error, HealthResponse, any>({
    queryKey: communicationsKeys.stats.health(),
    queryFn: () => communicationsService.healthCheck(),
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 20000, // 20 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Get metrics (cached)
 * GET /api/v1/communications/metrics
 */
export function useCommunicationMetrics() {
  return useQuery<MetricsResponse, Error, MetricsResponse, any>({
    queryKey: communicationsKeys.stats.metrics(),
    queryFn: () => communicationsService.getMetrics(),
    staleTime: 300000, // 5 minutes (matches Redis cache TTL)
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ==================== Composite Hooks ====================

/**
 * Get dashboard data (stats + health + recent logs)
 */
export function useCommunicationsDashboard() {
  const stats = useCommunicationStats();
  const health = useCommunicationHealth();
  const logs = useCommunicationLogs({
    page: 1,
    page_size: 10,
    sort_by: "created_at",
    sort_order: "desc",
  });
  const metrics = useCommunicationMetrics();

  return {
    stats: stats.data,
    health: health.data,
    recentLogs: logs.data?.logs || [],
    metrics: metrics.data,
    isLoading: stats.isLoading || health.isLoading || logs.isLoading || metrics.isLoading,
    error: stats.error || health.error || logs.error || metrics.error,
  };
}

/**
 * Monitor bulk operation with auto-refresh
 */
export function useMonitorBulkOperation(id: string | null) {
  const status = useBulkOperationStatus(id, { refetchInterval: 2000 }); // 2 seconds
  const cancelMutation = useCancelBulk();

  const cancel = () => {
    if (id) {
      cancelMutation.mutate(id);
    }
  };

  return {
    operation: status.data?.operation,
    recentLogs: status.data?.recent_logs || [],
    isLoading: status.isLoading,
    error: status.error,
    cancel,
    isCancelling: cancelMutation.isPending,
  };
}

/**
 * Monitor Celery task with auto-refresh
 */
export function useMonitorTask(taskId: string | null) {
  const status = useTaskStatus(taskId, { refetchInterval: 1000 }); // 1 second

  return {
    task: status.data,
    isLoading: status.isLoading,
    error: status.error,
    isComplete: status.data?.status === "success" || status.data?.status === "failure",
    isSuccess: status.data?.status === "success",
    isFailed: status.data?.status === "failure",
  };
}

/**
 * Template with preview
 */
export function useTemplateWithPreview(id: string | null, variables: Record<string, any> = {}) {
  const template = useTemplate(id);
  const render = useRenderTemplate();

  const preview = async () => {
    if (!id) return;
    try {
      const result = await render.mutateAsync({ id, variables });
      return result;
    } catch (error) {
      console.error("Preview error:", error);
      throw error;
    }
  };

  return {
    template: template.data,
    isLoading: template.isLoading,
    error: template.error,
    preview,
    isPreviewLoading: render.isPending,
    previewError: render.error,
  };
}
