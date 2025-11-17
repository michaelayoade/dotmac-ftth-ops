/**
 * Custom hooks for Notification Management - TanStack Query Version
 *
 * Migrated from direct API calls to TanStack Query for:
 * - Automatic caching and deduplication
 * - Background refetching
 * - Optimistic updates for mutations
 * - Better error handling
 * - Reduced manual state management
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useReducer, useRef } from "react";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

// ============================================================================
// Type Definitions
// ============================================================================

export type NotificationType =
  // Service lifecycle
  | "subscriber_provisioned"
  | "subscriber_deprovisioned"
  | "subscriber_suspended"
  | "subscriber_reactivated"
  | "service_activated"
  | "service_failed"
  // Network events
  | "service_outage"
  | "service_restored"
  | "bandwidth_limit_reached"
  | "connection_quality_degraded"
  // Billing events
  | "invoice_generated"
  | "invoice_due"
  | "invoice_overdue"
  | "payment_received"
  | "payment_failed"
  | "subscription_renewed"
  | "subscription_cancelled"
  // Dunning events
  | "dunning_reminder"
  | "dunning_suspension_warning"
  | "dunning_final_notice"
  // CRM events
  | "lead_assigned"
  | "quote_sent"
  | "quote_accepted"
  | "quote_rejected"
  | "site_survey_scheduled"
  | "site_survey_completed"
  // Ticketing events
  | "ticket_created"
  | "ticket_assigned"
  | "ticket_updated"
  | "ticket_resolved"
  | "ticket_closed"
  | "ticket_reopened"
  // System events
  | "password_reset"
  | "account_locked"
  | "two_factor_enabled"
  | "api_key_expiring"
  // Custom
  | "system_announcement"
  | "custom";

export type NotificationPriority = "low" | "medium" | "high" | "urgent";

export type NotificationChannel = "in_app" | "email" | "sms" | "push" | "webhook";

export interface Notification {
  id: string;
  user_id: string;
  tenant_id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  action_url?: string;
  action_label?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  is_read: boolean;
  read_at?: string;
  is_archived: boolean;
  archived_at?: string;
  channels: string[];
  email_sent: boolean;
  email_sent_at?: string;
  sms_sent: boolean;
  sms_sent_at?: string;
  push_sent: boolean;
  push_sent_at?: string;
  notification_metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  unread_count: number;
}

export interface NotificationCreateRequest {
  user_id: string;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  action_url?: string;
  action_label?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  channels?: NotificationChannel[];
  metadata?: Record<string, any>;
}

export type CommunicationType = "email" | "webhook" | "sms" | "push";

export type CommunicationStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "failed"
  | "bounced"
  | "cancelled";

export interface CommunicationTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  type: CommunicationType;
  subject_template?: string;
  text_template?: string;
  html_template?: string;
  variables: string[];
  required_variables: string[];
  is_active: boolean;
  is_default: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface CommunicationLog {
  id: string;
  tenant_id: string;
  type: CommunicationType;
  recipient: string;
  sender?: string;
  subject?: string;
  text_body?: string;
  html_body?: string;
  status: CommunicationStatus;
  sent_at?: string;
  delivered_at?: string;
  failed_at?: string;
  error_message?: string;
  retry_count: number;
  provider?: string;
  provider_message_id?: string;
  template_id?: string;
  template_name?: string;
  user_id?: string;
  job_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface TemplateCreateRequest {
  name: string;
  description?: string;
  type: CommunicationType;
  subject_template?: string;
  text_template?: string;
  html_template?: string;
  required_variables?: string[];
}

export interface TemplateUpdateRequest {
  name?: string;
  description?: string;
  subject_template?: string;
  text_template?: string;
  html_template?: string;
  required_variables?: string[];
  is_active?: boolean;
}

export interface BulkNotificationRequest {
  recipient_filter?: {
    subscriber_ids?: string[];
    customer_ids?: string[];
    status?: string[];
    connection_type?: string[];
  };
  template_id?: string;
  custom_notification?: NotificationCreateRequest;
  channels: NotificationChannel[];
  schedule_at?: string;
}

export interface BulkNotificationResponse {
  job_id: string;
  total_recipients: number;
  status: "queued" | "processing" | "completed" | "failed";
  scheduled_at?: string;
}

export interface NotificationPreference {
  user_id: string;
  channel: NotificationChannel;
  enabled: boolean;
  notification_types?: NotificationType[];
}

const buildUrlWithParams = (basePath: string, params: URLSearchParams) => {
  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
};

// ============================================================================
// Query Key Factory
// ============================================================================

export const notificationsKeys = {
  all: ["notifications"] as const,
  lists: () => [...notificationsKeys.all, "list"] as const,
  list: (filters: {
    unreadOnly?: boolean;
    priority?: NotificationPriority;
    notificationType?: NotificationType;
  }) => [...notificationsKeys.lists(), filters] as const,
  unreadCount: () => [...notificationsKeys.all, "unread-count"] as const,
  templates: () => [...notificationsKeys.all, "templates"] as const,
  templateList: (filters: { type?: CommunicationType; activeOnly?: boolean }) =>
    [...notificationsKeys.templates(), filters] as const,
  logs: () => [...notificationsKeys.all, "logs"] as const,
  logList: (filters: {
    type?: CommunicationType;
    status?: CommunicationStatus;
    recipient?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) => [...notificationsKeys.logs(), filters] as const,
};

// ============================================================================
// Hook: useNotifications
// ============================================================================

export function useNotifications(options?: {
  unreadOnly?: boolean;
  priority?: NotificationPriority;
  notificationType?: NotificationType;
  autoRefresh?: boolean;
  refreshInterval?: number;
}) {
  const queryClient = useQueryClient();
  const listFilters: {
    unreadOnly?: boolean;
    priority?: NotificationPriority;
    notificationType?: NotificationType;
  } = {};

  if (typeof options?.unreadOnly !== "undefined") {
    listFilters.unreadOnly = options.unreadOnly;
  }
  if (options?.priority) {
    listFilters.priority = options.priority;
  }
  if (options?.notificationType) {
    listFilters.notificationType = options.notificationType;
  }

  // Query for notifications list
  const notificationsQuery = useQuery({
    queryKey: notificationsKeys.list(listFilters),
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (options?.unreadOnly) {
          params.set("unread_only", "true");
        }
        if (options?.priority) {
          params.set("priority", options.priority);
        }
        if (options?.notificationType) {
          params.set("notification_type", options.notificationType);
        }

        const endpoint = buildUrlWithParams("/notifications", params);
        const response = await apiClient.get<NotificationListResponse>(endpoint);
        return response.data;
      } catch (err: any) {
        if (err.response?.status === 403) {
          logger.warn("Notifications endpoint returned 403. Using empty fallback data.");
          return { notifications: [], total: 0, unread_count: 0 };
        }
        logger.error("Failed to fetch notifications", err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: options?.autoRefresh ? options.refreshInterval || 30000 : false,
    refetchOnWindowFocus: true,
  });

  // Mutation: Mark as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await apiClient.post(`/notifications/${notificationId}/read`, {});
    },
    onMutate: async (notificationId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: notificationsKeys.lists() });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<NotificationListResponse>(
        notificationsKeys.list(listFilters)
      );

      // Optimistically update
      if (previousData) {
        queryClient.setQueryData<NotificationListResponse>(
          notificationsKeys.list(listFilters),
          {
            ...previousData,
            notifications: previousData.notifications.map((n) =>
              n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
            ),
            unread_count: Math.max(0, previousData.unread_count - 1),
          }
        );
      }

      return { previousData };
    },
    onError: (err, notificationId, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          notificationsKeys.list(listFilters),
          context.previousData
        );
      }
      logger.error("Failed to mark notification as read", err instanceof Error ? err : new Error(String(err)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount() });
    },
  });

  // Mutation: Mark as unread
  const markAsUnreadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await apiClient.post(`/notifications/${notificationId}/unread`, {});
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: notificationsKeys.lists() });

      const previousData = queryClient.getQueryData<NotificationListResponse>(
        notificationsKeys.list(listFilters)
      );

      if (previousData) {
        queryClient.setQueryData<NotificationListResponse>(
          notificationsKeys.list(listFilters),
          {
            ...previousData,
            notifications: previousData.notifications.map((n) =>
              n.id === notificationId
                ? (({ read_at: _ignored, ...rest }) => ({
                    ...rest,
                    is_read: false,
                  }))(n)
                : n
            ),
            unread_count: previousData.unread_count + 1,
          }
        );
      }

      return { previousData };
    },
    onError: (err, notificationId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          notificationsKeys.list(listFilters),
          context.previousData
        );
      }
      logger.error("Failed to mark notification as unread", err instanceof Error ? err : new Error(String(err)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount() });
    },
  });

  // Mutation: Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/notifications/mark-all-read");
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationsKeys.lists() });

      const previousData = queryClient.getQueryData<NotificationListResponse>(
        notificationsKeys.list(listFilters)
      );

      if (previousData) {
        queryClient.setQueryData<NotificationListResponse>(
          notificationsKeys.list(listFilters),
          {
            ...previousData,
            notifications: previousData.notifications.map((n) => ({
              ...n,
              is_read: true,
              read_at: new Date().toISOString(),
            })),
            unread_count: 0,
          }
        );
      }

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          notificationsKeys.list(listFilters),
          context.previousData
        );
      }
      logger.error("Failed to mark all as read", err instanceof Error ? err : new Error(String(err)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount() });
    },
  });

  // Mutation: Archive notification
  const archiveNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await apiClient.post(`/notifications/${notificationId}/archive`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.lists() });
    },
    onError: (err) => {
      logger.error("Failed to archive notification", err instanceof Error ? err : new Error(String(err)));
    },
  });

  // Mutation: Delete notification
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await apiClient.delete(`/notifications/${notificationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.lists() });
    },
    onError: (err) => {
      logger.error("Failed to delete notification", err instanceof Error ? err : new Error(String(err)));
    },
  });

  return {
    notifications: notificationsQuery.data?.notifications ?? [],
    unreadCount: notificationsQuery.data?.unread_count ?? 0,
    isLoading: notificationsQuery.isLoading,
    error: notificationsQuery.error,
    refetch: notificationsQuery.refetch,
    markAsRead: async (notificationId: string) => {
      try {
        await markAsReadMutation.mutateAsync(notificationId);
        return true;
      } catch {
        return false;
      }
    },
    markAsUnread: async (notificationId: string) => {
      try {
        await markAsUnreadMutation.mutateAsync(notificationId);
        return true;
      } catch {
        return false;
      }
    },
    markAllAsRead: async () => {
      try {
        await markAllAsReadMutation.mutateAsync();
        return true;
      } catch {
        return false;
      }
    },
    archiveNotification: async (notificationId: string) => {
      try {
        await archiveNotificationMutation.mutateAsync(notificationId);
        return true;
      } catch {
        return false;
      }
    },
    deleteNotification: async (notificationId: string) => {
      try {
        await deleteNotificationMutation.mutateAsync(notificationId);
        return true;
      } catch {
        return false;
      }
    },
  };
}

// ============================================================================
// Hook: useNotificationTemplates
// ============================================================================

export function useNotificationTemplates(options?: {
  type?: CommunicationType;
  activeOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  const templateFilters: { type?: CommunicationType; activeOnly?: boolean } = {};

  if (options?.type) {
    templateFilters.type = options.type;
  }
  if (typeof options?.activeOnly !== "undefined") {
    templateFilters.activeOnly = options.activeOnly;
  }

  // Query for templates list
  const templatesQuery = useQuery({
    queryKey: notificationsKeys.templateList(templateFilters),
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (options?.type) {
          params.set("type", options.type);
        }
        if (options?.activeOnly) {
          params.set("active_only", "true");
        }

        const endpoint = buildUrlWithParams("/communications/templates", params);
        const response = await apiClient.get<CommunicationTemplate[]>(endpoint);
        return response.data;
      } catch (err: any) {
        if (err.response?.status === 403) {
          logger.warn("Templates endpoint returned 403. Falling back to empty template list.");
          return [];
        }
        logger.error("Failed to fetch templates", err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  // Mutation: Create template
  const createTemplateMutation = useMutation({
    mutationFn: async (data: TemplateCreateRequest) => {
      const response = await apiClient.post<CommunicationTemplate>("/communications/templates", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.templates() });
    },
    onError: (err) => {
      logger.error("Failed to create template", err instanceof Error ? err : new Error(String(err)));
    },
  });

  // Mutation: Update template
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ templateId, data }: { templateId: string; data: TemplateUpdateRequest }) => {
      const response = await apiClient.patch<CommunicationTemplate>(
        `/communications/templates/${templateId}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.templates() });
    },
    onError: (err) => {
      logger.error("Failed to update template", err instanceof Error ? err : new Error(String(err)));
    },
  });

  // Mutation: Delete template
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      await apiClient.delete(`/communications/templates/${templateId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.templates() });
    },
    onError: (err) => {
      logger.error("Failed to delete template", err instanceof Error ? err : new Error(String(err)));
    },
  });

  // Helper: Render template preview
  const renderTemplatePreview = async (
    templateId: string,
    data: Record<string, any>
  ): Promise<{ subject?: string; text?: string; html?: string } | null> => {
    try {
      const response = await apiClient.post<{
        subject?: string;
        text?: string;
        html?: string;
      }>(`/communications/templates/${templateId}/render`, { data });
      return response.data || null;
    } catch (err) {
      logger.error("Failed to render template preview", err instanceof Error ? err : new Error(String(err)));
      return null;
    }
  };

  return {
    templates: templatesQuery.data ?? [],
    isLoading: templatesQuery.isLoading,
    error: templatesQuery.error,
    refetch: templatesQuery.refetch,
    createTemplate: async (data: TemplateCreateRequest) => {
      try {
        return await createTemplateMutation.mutateAsync(data);
      } catch {
        return null;
      }
    },
    updateTemplate: async (templateId: string, data: TemplateUpdateRequest) => {
      try {
        return await updateTemplateMutation.mutateAsync({ templateId, data });
      } catch {
        return null;
      }
    },
    deleteTemplate: async (templateId: string) => {
      try {
        await deleteTemplateMutation.mutateAsync(templateId);
        return true;
      } catch {
        return false;
      }
    },
    renderTemplatePreview,
  };
}

// ============================================================================
// Hook: useCommunicationLogs
// ============================================================================

export function useCommunicationLogs(options?: {
  type?: CommunicationType;
  status?: CommunicationStatus;
  recipient?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}) {
  const queryClient = useQueryClient();
  const logFilters: {
    type?: CommunicationType;
    status?: CommunicationStatus;
    recipient?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  } = {};

  if (options?.type) logFilters.type = options.type;
  if (options?.status) logFilters.status = options.status;
  if (options?.recipient) logFilters.recipient = options.recipient;
  if (options?.startDate) logFilters.startDate = options.startDate;
  if (options?.endDate) logFilters.endDate = options.endDate;
  if (typeof options?.page !== "undefined") logFilters.page = options.page;
  if (typeof options?.pageSize !== "undefined") logFilters.pageSize = options.pageSize;

  // Query for communication logs
  const logsQuery = useQuery({
    queryKey: notificationsKeys.logList(logFilters),
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (options?.type) params.set("type", options.type);
        if (options?.status) params.set("status", options.status);
        if (options?.recipient) params.set("recipient", options.recipient);
        if (options?.startDate) params.set("start_date", options.startDate);
        if (options?.endDate) params.set("end_date", options.endDate);
        if (options?.page) params.set("page", options.page.toString());
        if (options?.pageSize) params.set("page_size", options.pageSize.toString());

        const endpoint = buildUrlWithParams("/communications/logs", params);
        const response = await apiClient.get<{
          logs: CommunicationLog[];
          total: number;
        }>(endpoint);
        return response.data;
      } catch (err: any) {
        if (err.response?.status === 403) {
          logger.warn("Communications logs endpoint returned 403. Falling back to empty log set.");
          return { logs: [], total: 0 };
        }
        logger.error("Failed to fetch communication logs", err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  // Mutation: Retry failed communication
  const retryFailedCommunicationMutation = useMutation({
    mutationFn: async (logId: string) => {
      await apiClient.post(`/communications/logs/${logId}/retry`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.logs() });
    },
    onError: (err) => {
      logger.error("Failed to retry communication", err instanceof Error ? err : new Error(String(err)));
    },
  });

  return {
    logs: logsQuery.data?.logs ?? [],
    total: logsQuery.data?.total ?? 0,
    isLoading: logsQuery.isLoading,
    error: logsQuery.error,
    refetch: logsQuery.refetch,
    retryFailedCommunication: async (logId: string) => {
      try {
        await retryFailedCommunicationMutation.mutateAsync(logId);
        return true;
      } catch {
        return false;
      }
    },
  };
}

// ============================================================================
// Hook: useBulkNotifications
// ============================================================================

export function useBulkNotifications() {
  const queryClient = useQueryClient();
  const isSendingRef = useRef(false);
  const [, forceRender] = useReducer((x) => x + 1, 0);

  const setSending = (value: boolean) => {
    isSendingRef.current = value;
    forceRender();
  };

  // Mutation: Send bulk notification
  const sendBulkNotificationMutation = useMutation({
    mutationFn: async (data: BulkNotificationRequest) => {
      const response = await apiClient.post<BulkNotificationResponse>("/notifications/bulk", data);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate relevant queries after bulk send
      queryClient.invalidateQueries({ queryKey: notificationsKeys.lists() });
    },
    onError: (err) => {
      logger.error("Failed to send bulk notification", err instanceof Error ? err : new Error(String(err)));
    },
  });

  // Helper: Get bulk job status
  const getBulkJobStatus = async (jobId: string): Promise<BulkNotificationResponse | null> => {
    try {
      const response = await apiClient.get<BulkNotificationResponse>(`/notifications/bulk/${jobId}`);
      return response.data || null;
    } catch (err) {
      logger.error("Failed to get bulk job status", err instanceof Error ? err : new Error(String(err)));
      return null;
    }
  };

  return {
    get isLoading() {
      return isSendingRef.current;
    },
    sendBulkNotification: async (data: BulkNotificationRequest) => {
      setSending(true);
      try {
        return await sendBulkNotificationMutation.mutateAsync(data);
      } catch {
        return null;
      } finally {
        setSending(false);
      }
    },
    getBulkJobStatus,
  };
}

// ============================================================================
// Hook: useUnreadCount (Lightweight for header badge)
// ============================================================================

export function useUnreadCount(options?: { autoRefresh?: boolean; refreshInterval?: number }) {
  const unreadCountQuery = useQuery({
    queryKey: notificationsKeys.unreadCount(),
    queryFn: async () => {
      try {
        const response = await apiClient.get<{ unread_count: number }>("/notifications/unread-count");
        return response.data?.unread_count ?? 0;
      } catch (err: any) {
        if (err.response?.status === 403) {
          logger.warn("Unread count endpoint returned 403. Defaulting to zero unread notifications.");
          return 0;
        }
        logger.error("Failed to fetch unread count", err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: options?.autoRefresh ? options.refreshInterval || 30000 : false,
    refetchOnWindowFocus: true,
  });

  return {
    unreadCount: unreadCountQuery.data ?? 0,
    isLoading: unreadCountQuery.isLoading,
    refetch: unreadCountQuery.refetch,
  };
}
