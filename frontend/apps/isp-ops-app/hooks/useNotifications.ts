/**
 * Custom hooks for Notification Management
 *
 * Provides hooks for managing user notifications, templates, and bulk sending.
 */

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { apiClient } from "@/lib/api/client";

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

export interface CommunicationTemplateListResponse {
  templates: CommunicationTemplate[];
  total?: number;
  page?: number;
  page_size?: number;
  has_more?: boolean;
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
// Hook: useNotifications
// ============================================================================

export function useNotifications(options?: {
  unreadOnly?: boolean;
  priority?: NotificationPriority;
  notificationType?: NotificationType;
  autoRefresh?: boolean;
  refreshInterval?: number;
}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

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

      if (response.data) {
        setNotifications(response.data.notifications);
        setUnreadCount(response.data.unread_count);
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        console.warn("Notifications endpoint returned 403. Using empty fallback data.");
        setNotifications([]);
        setUnreadCount(0);
        setError(null);
      } else {
        console.error("Failed to fetch notifications:", err);
        setError(err instanceof Error ? err : new Error("Failed to fetch notifications"));
      }
    } finally {
      setIsLoading(false);
    }
  }, [options?.unreadOnly, options?.priority, options?.notificationType]);

  useEffect(() => {
    fetchNotifications();

    // Auto-refresh if enabled
    if (options?.autoRefresh) {
      const interval = setInterval(fetchNotifications, options.refreshInterval || 30000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [fetchNotifications, options?.autoRefresh, options?.refreshInterval]);

  const markAsRead = useCallback(async (notificationId: string): Promise<boolean> => {
    try {
      await apiClient.post(`/notifications/${notificationId}/read`, {});

      // Update local state
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      return true;
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
      return false;
    }
  }, []);

  const markAsUnread = useCallback(async (notificationId: string): Promise<boolean> => {
    try {
      await apiClient.post(`/notifications/${notificationId}/unread`, {});

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => {
          if (n.id !== notificationId) {
            return n;
          }
          const { read_at: _ignored, ...rest } = n;
          return { ...rest, is_read: false };
        }),
      );
      setUnreadCount((prev) => prev + 1);

      return true;
    } catch (err) {
      console.error("Failed to mark notification as unread:", err);
      return false;
    }
  }, []);

  const markAllAsRead = useCallback(async (): Promise<boolean> => {
    try {
      await apiClient.post("/notifications/mark-all-read");

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          is_read: true,
          read_at: new Date().toISOString(),
        })),
      );
      setUnreadCount(0);

      return true;
    } catch (err) {
      console.error("Failed to mark all as read:", err);
      return false;
    }
  }, []);

  const archiveNotification = useCallback(async (notificationId: string): Promise<boolean> => {
    try {
      await apiClient.post(`/notifications/${notificationId}/archive`, {});

      // Remove from local state
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

      return true;
    } catch (err) {
      console.error("Failed to archive notification:", err);
      return false;
    }
  }, []);

  const deleteNotification = useCallback(async (notificationId: string): Promise<boolean> => {
    try {
      await apiClient.delete(`/notifications/${notificationId}`);

      // Remove from local state
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

      return true;
    } catch (err) {
      console.error("Failed to delete notification:", err);
      return false;
    }
  }, []);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refetch: fetchNotifications,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    archiveNotification,
    deleteNotification,
  };
}

// ============================================================================
// Hook: useNotificationTemplates
// ============================================================================

export function useNotificationTemplates(options?: {
  type?: CommunicationType;
  activeOnly?: boolean;
}) {
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (options?.type) {
        params.set("type", options.type);
      }
      if (options?.activeOnly) {
        params.set("active_only", "true");
      }

      const endpoint = buildUrlWithParams("/communications/templates", params);
      const response = await apiClient.get<
        CommunicationTemplateListResponse | CommunicationTemplate[]
      >(endpoint);

      const data = response.data;
      if (Array.isArray(data)) {
        setTemplates(data);
      } else if (data?.templates) {
        setTemplates(data.templates);
      } else {
        setTemplates([]);
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        console.warn("Templates endpoint returned 403. Falling back to empty template list.");
        setTemplates([]);
        setError(null);
      } else {
        console.error("Failed to fetch templates:", err);
        setError(err instanceof Error ? err : new Error("Failed to fetch templates"));
      }
    } finally {
      setIsLoading(false);
    }
  }, [options?.type, options?.activeOnly]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = useCallback(
    async (data: TemplateCreateRequest): Promise<CommunicationTemplate | null> => {
      try {
        const response = await apiClient.post<CommunicationTemplate>(
          "/communications/templates",
          data,
        );

        if (response.data) {
          setTemplates((prev) => [...prev, response.data]);
          return response.data;
        }
        return null;
      } catch (err) {
        console.error("Failed to create template:", err);
        throw err;
      }
    },
    [],
  );

  const updateTemplate = useCallback(
    async (
      templateId: string,
      data: TemplateUpdateRequest,
    ): Promise<CommunicationTemplate | null> => {
      try {
        const response = await apiClient.patch<CommunicationTemplate>(
          `/communications/templates/${templateId}`,
          data,
        );

        if (response.data) {
          setTemplates((prev) => prev.map((t) => (t.id === templateId ? response.data : t)));
          return response.data;
        }
        return null;
      } catch (err) {
        console.error("Failed to update template:", err);
        throw err;
      }
    },
    [],
  );

  const deleteTemplate = useCallback(async (templateId: string): Promise<boolean> => {
    try {
      await apiClient.delete(`/communications/templates/${templateId}`);

      setTemplates((prev) => prev.filter((t) => t.id !== templateId));

      return true;
    } catch (err) {
      console.error("Failed to delete template:", err);
      return false;
    }
  }, []);

  const renderTemplatePreview = useCallback(
    async (
      templateId: string,
      data: Record<string, any>,
    ): Promise<{ subject?: string; text?: string; html?: string } | null> => {
      try {
        const response = await apiClient.post<{
          subject?: string;
          text?: string;
          html?: string;
        }>(`/communications/templates/${templateId}/render`, { data });

        return response.data || null;
      } catch (err) {
        console.error("Failed to render template preview:", err);
        return null;
      }
    },
    [],
  );

  return {
    templates,
    isLoading,
    error,
    refetch: fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
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
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

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

      if (response.data) {
        setLogs(response.data.logs);
        setTotal(response.data.total);
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        console.warn("Communications logs endpoint returned 403. Falling back to empty log set.");
        setLogs([]);
        setTotal(0);
        setError(null);
      } else {
        console.error("Failed to fetch communication logs:", err);
        setError(err instanceof Error ? err : new Error("Failed to fetch logs"));
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    options?.type,
    options?.status,
    options?.recipient,
    options?.startDate,
    options?.endDate,
    options?.page,
    options?.pageSize,
  ]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const retryFailedCommunication = useCallback(
    async (logId: string): Promise<boolean> => {
      try {
        await apiClient.post(`/communications/logs/${logId}/retry`);
        await fetchLogs(); // Refresh logs
        return true;
      } catch (err) {
        console.error("Failed to retry communication:", err);
        return false;
      }
    },
    [fetchLogs],
  );

  return {
    logs,
    total,
    isLoading,
    error,
    refetch: fetchLogs,
    retryFailedCommunication,
  };
}

// ============================================================================
// Hook: useBulkNotifications
// ============================================================================

export function useBulkNotifications() {
  const [isLoading, setIsLoading] = useState(false);

  const sendBulkNotification = useCallback(
    async (data: BulkNotificationRequest): Promise<BulkNotificationResponse | null> => {
      try {
        setIsLoading(true);

        const response = await apiClient.post<BulkNotificationResponse>(
          "/notifications/bulk",
          data,
        );

        return response.data || null;
      } catch (err) {
        console.error("Failed to send bulk notification:", err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const getBulkJobStatus = useCallback(
    async (jobId: string): Promise<BulkNotificationResponse | null> => {
      try {
        const response = await apiClient.get<BulkNotificationResponse>(
          `/notifications/bulk/${jobId}`,
        );

        return response.data || null;
      } catch (err) {
        console.error("Failed to get bulk job status:", err);
        return null;
      }
    },
    [],
  );

  return {
    isLoading,
    sendBulkNotification,
    getBulkJobStatus,
  };
}

// ============================================================================
// Hook: useUnreadCount (Lightweight for header badge)
// ============================================================================

export function useUnreadCount(options?: { autoRefresh?: boolean; refreshInterval?: number }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUnreadCount = useCallback(async () => {
    try {
      setIsLoading(true);

      const response = await apiClient.get<{ unread_count: number }>("/notifications/unread-count");

      if (response.data) {
        setUnreadCount(response.data.unread_count);
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        console.warn(
          "Unread count endpoint returned 403. Defaulting to zero unread notifications.",
        );
        setUnreadCount(0);
      } else {
        console.error("Failed to fetch unread count:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();

    // Auto-refresh if enabled
    if (options?.autoRefresh) {
      const interval = setInterval(fetchUnreadCount, options.refreshInterval || 30000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [fetchUnreadCount, options?.autoRefresh, options?.refreshInterval]);

  return {
    unreadCount,
    isLoading,
    refetch: fetchUnreadCount,
  };
}
