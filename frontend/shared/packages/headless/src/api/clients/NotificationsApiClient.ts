/**
 * Notifications & Messaging API Client
 * Handles multi-channel communication, alerts, and notification management
 */

import { BaseApiClient } from "./BaseApiClient";
import type { PaginatedResponse, QueryParams } from "../types/api";

export interface NotificationTemplate {
  id: string;
  name: string;
  description: string;
  template_type: "EMAIL" | "SMS" | "PUSH" | "IN_APP" | "WEBHOOK" | "VOICE";
  category: "BILLING" | "SERVICE" | "MARKETING" | "SYSTEM" | "EMERGENCY" | "SUPPORT";
  subject?: string;
  content: string;
  variables: TemplateVariable[];
  channels: NotificationChannel[];
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  active: boolean;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateVariable {
  name: string;
  type: "STRING" | "NUMBER" | "DATE" | "BOOLEAN" | "URL";
  description: string;
  required: boolean;
  default_value?: string;
  format?: string;
}

export interface NotificationChannel {
  type: "EMAIL" | "SMS" | "PUSH" | "IN_APP" | "WEBHOOK" | "VOICE";
  enabled: boolean;
  priority: number;
  retry_attempts: number;
  retry_delay: number;
  fallback_channel?: string;
  configuration: Record<string, any>;
}

export interface Notification {
  id: string;
  template_id?: string;
  recipient_id: string;
  recipient_type: "CUSTOMER" | "USER" | "TECHNICIAN" | "ADMIN" | "SYSTEM";
  recipient_contact: {
    email?: string;
    phone?: string;
    device_token?: string;
    webhook_url?: string;
  };
  channel: NotificationChannel["type"];
  status: "PENDING" | "SENT" | "DELIVERED" | "FAILED" | "EXPIRED" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | "EMERGENCY";
  subject?: string;
  message: string;
  data?: Record<string, any>;
  scheduled_at?: string;
  sent_at?: string;
  delivered_at?: string;
  failed_reason?: string;
  retry_count: number;
  max_retries: number;
  expires_at?: string;
  read_at?: string;
  clicked_at?: string;
  created_at: string;
}

export interface NotificationCampaign {
  id: string;
  name: string;
  description: string;
  campaign_type: "BROADCAST" | "TARGETED" | "SCHEDULED" | "TRIGGERED";
  template_id: string;
  target_audience: AudienceFilter;
  channels: NotificationChannel["type"][];
  scheduling: CampaignScheduling;
  status: "DRAFT" | "SCHEDULED" | "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";
  metrics: CampaignMetrics;
  created_by: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface AudienceFilter {
  customer_segments?: string[];
  user_roles?: string[];
  territories?: string[];
  service_types?: string[];
  custom_filters?: Record<string, any>;
  exclude_opted_out: boolean;
  max_recipients?: number;
}

export interface CampaignScheduling {
  schedule_type: "IMMEDIATE" | "SCHEDULED" | "RECURRING";
  start_date?: string;
  end_date?: string;
  time_zone: string;
  recurrence?: {
    frequency: "DAILY" | "WEEKLY" | "MONTHLY";
    interval: number;
    days_of_week?: number[];
    days_of_month?: number[];
  };
  send_time_optimization: boolean;
}

export interface CampaignMetrics {
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  opened_count: number;
  clicked_count: number;
  unsubscribed_count: number;
  bounce_count: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  unsubscribe_rate: number;
}

export interface Alert {
  id: string;
  alert_type: "SYSTEM" | "BILLING" | "NETWORK" | "SERVICE" | "SECURITY" | "MAINTENANCE";
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  title: string;
  message: string;
  source: string;
  affected_entities?: string[];
  actions_required?: string[];
  auto_resolve: boolean;
  resolved: boolean;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_at?: string;
  escalation_rules: EscalationRule[];
  metadata: Record<string, any>;
  created_at: string;
}

export interface EscalationRule {
  level: number;
  delay_minutes: number;
  notify_roles: string[];
  notify_users: string[];
  escalation_message?: string;
  triggered: boolean;
  triggered_at?: string;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  category: NotificationTemplate["category"];
  channels: {
    email: { enabled: boolean; address?: string };
    sms: { enabled: boolean; number?: string };
    push: { enabled: boolean };
    in_app: { enabled: boolean };
  };
  quiet_hours?: {
    enabled: boolean;
    start_time: string;
    end_time: string;
    time_zone: string;
  };
  frequency_limits?: {
    max_per_hour?: number;
    max_per_day?: number;
  };
  keywords_to_filter?: string[];
  updated_at: string;
}

export class NotificationsApiClient extends BaseApiClient {
  constructor(baseURL: string, defaultHeaders: Record<string, string> = {}) {
    super(baseURL, defaultHeaders);
  }

  // Templates
  async getTemplates(params?: QueryParams): Promise<PaginatedResponse<NotificationTemplate>> {
    return this.get("/api/notifications/templates", { params });
  }

  async getTemplate(templateId: string): Promise<{ data: NotificationTemplate }> {
    return this.get(`/api/notifications/templates/${templateId}`);
  }

  async createTemplate(
    data: Omit<NotificationTemplate, "id" | "version" | "created_at" | "updated_at">,
  ): Promise<{ data: NotificationTemplate }> {
    return this.post("/api/notifications/templates", data);
  }

  async updateTemplate(
    templateId: string,
    data: Partial<NotificationTemplate>,
  ): Promise<{ data: NotificationTemplate }> {
    return this.put(`/api/notifications/templates/${templateId}`, data);
  }

  async deleteTemplate(templateId: string): Promise<{ success: boolean }> {
    return this.delete(`/api/notifications/templates/${templateId}`);
  }

  async testTemplate(
    templateId: string,
    testData: {
      recipient: string;
      channel: NotificationChannel["type"];
      variables?: Record<string, any>;
    },
  ): Promise<{ data: { success: boolean; preview?: string } }> {
    return this.post(`/api/notifications/templates/${templateId}/test`, testData);
  }

  async previewTemplate(
    templateId: string,
    variables?: Record<string, any>,
  ): Promise<{
    data: { rendered_content: string; rendered_subject?: string };
  }> {
    return this.post(`/api/notifications/templates/${templateId}/preview`, {
      variables,
    });
  }

  // Notifications
  async getNotifications(
    params?: QueryParams & {
      recipient_id?: string;
      status?: string;
      channel?: string;
      start_date?: string;
      end_date?: string;
    },
  ): Promise<PaginatedResponse<Notification>> {
    return this.get("/api/notifications", { params });
  }

  async getNotification(notificationId: string): Promise<{ data: Notification }> {
    return this.get(`/api/notifications/${notificationId}`);
  }

  async sendNotification(data: {
    template_id?: string;
    recipient_id: string;
    recipient_contact: Notification["recipient_contact"];
    channel: NotificationChannel["type"];
    subject?: string;
    message?: string;
    variables?: Record<string, any>;
    priority?: Notification["priority"];
    scheduled_at?: string;
    expires_at?: string;
  }): Promise<{ data: Notification }> {
    return this.post("/api/notifications/send", data);
  }

  async sendBulkNotifications(data: {
    template_id?: string;
    recipients: Array<{
      recipient_id: string;
      recipient_contact: Notification["recipient_contact"];
      variables?: Record<string, any>;
    }>;
    channel: NotificationChannel["type"];
    subject?: string;
    message?: string;
    priority?: Notification["priority"];
    scheduled_at?: string;
  }): Promise<{ data: { notifications_created: number; batch_id: string } }> {
    return this.post("/api/notifications/send-bulk", data);
  }

  async cancelNotification(notificationId: string): Promise<{ data: Notification }> {
    return this.post(`/api/notifications/${notificationId}/cancel`, {});
  }

  async retryNotification(notificationId: string): Promise<{ data: Notification }> {
    return this.post(`/api/notifications/${notificationId}/retry`, {});
  }

  async markAsRead(notificationId: string): Promise<{ data: Notification }> {
    return this.post(`/api/notifications/${notificationId}/read`, {});
  }

  async trackClick(notificationId: string, linkUrl?: string): Promise<{ data: Notification }> {
    return this.post(`/api/notifications/${notificationId}/click`, {
      link_url: linkUrl,
    });
  }

  // Campaigns
  async getCampaigns(params?: QueryParams): Promise<PaginatedResponse<NotificationCampaign>> {
    return this.get("/api/notifications/campaigns", { params });
  }

  async getCampaign(campaignId: string): Promise<{ data: NotificationCampaign }> {
    return this.get(`/api/notifications/campaigns/${campaignId}`);
  }

  async createCampaign(
    data: Omit<NotificationCampaign, "id" | "status" | "metrics" | "created_at">,
  ): Promise<{ data: NotificationCampaign }> {
    return this.post("/api/notifications/campaigns", data);
  }

  async updateCampaign(
    campaignId: string,
    data: Partial<NotificationCampaign>,
  ): Promise<{ data: NotificationCampaign }> {
    return this.put(`/api/notifications/campaigns/${campaignId}`, data);
  }

  async startCampaign(campaignId: string): Promise<{ data: NotificationCampaign }> {
    return this.post(`/api/notifications/campaigns/${campaignId}/start`, {});
  }

  async pauseCampaign(campaignId: string): Promise<{ data: NotificationCampaign }> {
    return this.post(`/api/notifications/campaigns/${campaignId}/pause`, {});
  }

  async resumeCampaign(campaignId: string): Promise<{ data: NotificationCampaign }> {
    return this.post(`/api/notifications/campaigns/${campaignId}/resume`, {});
  }

  async cancelCampaign(
    campaignId: string,
    reason?: string,
  ): Promise<{ data: NotificationCampaign }> {
    return this.post(`/api/notifications/campaigns/${campaignId}/cancel`, {
      reason,
    });
  }

  async getCampaignMetrics(campaignId: string): Promise<{ data: CampaignMetrics }> {
    return this.get(`/api/notifications/campaigns/${campaignId}/metrics`);
  }

  async getCampaignRecipients(
    campaignId: string,
    params?: QueryParams,
  ): Promise<
    PaginatedResponse<{
      recipient_id: string;
      recipient_contact: Notification["recipient_contact"];
      status: Notification["status"];
      sent_at?: string;
      delivered_at?: string;
    }>
  > {
    return this.get(`/api/notifications/campaigns/${campaignId}/recipients`, {
      params,
    });
  }

  // Alerts
  async getAlerts(
    params?: QueryParams & {
      alert_type?: string;
      severity?: string;
      resolved?: boolean;
      acknowledged?: boolean;
    },
  ): Promise<PaginatedResponse<Alert>> {
    return this.get("/api/notifications/alerts", { params });
  }

  async getAlert(alertId: string): Promise<{ data: Alert }> {
    return this.get(`/api/notifications/alerts/${alertId}`);
  }

  async createAlert(
    data: Omit<Alert, "id" | "resolved" | "acknowledged" | "created_at">,
  ): Promise<{ data: Alert }> {
    return this.post("/api/notifications/alerts", data);
  }

  async acknowledgeAlert(alertId: string, acknowledgementNote?: string): Promise<{ data: Alert }> {
    return this.post(`/api/notifications/alerts/${alertId}/acknowledge`, {
      note: acknowledgementNote,
    });
  }

  async resolveAlert(alertId: string, resolutionNote?: string): Promise<{ data: Alert }> {
    return this.post(`/api/notifications/alerts/${alertId}/resolve`, {
      note: resolutionNote,
    });
  }

  async escalateAlert(alertId: string, escalationLevel?: number): Promise<{ data: Alert }> {
    return this.post(`/api/notifications/alerts/${alertId}/escalate`, {
      level: escalationLevel,
    });
  }

  async snoozeAlert(alertId: string, snoozeUntil: string): Promise<{ data: Alert }> {
    return this.post(`/api/notifications/alerts/${alertId}/snooze`, {
      snooze_until: snoozeUntil,
    });
  }

  // User Preferences
  async getUserPreferences(userId: string): Promise<{ data: NotificationPreference[] }> {
    return this.get(`/api/notifications/users/${userId}/preferences`);
  }

  async updateUserPreferences(
    userId: string,
    preferences: Partial<NotificationPreference>[],
  ): Promise<{ data: NotificationPreference[] }> {
    return this.put(`/api/notifications/users/${userId}/preferences`, {
      preferences,
    });
  }

  async optOut(userId: string, categories: string[]): Promise<{ data: { success: boolean } }> {
    return this.post(`/api/notifications/users/${userId}/opt-out`, {
      categories,
    });
  }

  async optIn(userId: string, categories: string[]): Promise<{ data: { success: boolean } }> {
    return this.post(`/api/notifications/users/${userId}/opt-in`, {
      categories,
    });
  }

  // Channel Management
  async getChannelStatus(): Promise<{
    data: Array<{
      channel: NotificationChannel["type"];
      status: "HEALTHY" | "DEGRADED" | "DOWN";
      last_success: string;
      error_rate: number;
      throughput: number;
    }>;
  }> {
    return this.get("/api/notifications/channels/status");
  }

  async testChannelConfiguration(
    channel: NotificationChannel["type"],
    config: Record<string, any>,
  ): Promise<{ data: { success: boolean; error?: string } }> {
    return this.post("/api/notifications/channels/test", {
      channel,
      configuration: config,
    });
  }

  // Analytics & Reporting
  async getNotificationMetrics(params?: {
    start_date?: string;
    end_date?: string;
    channel?: string;
    template_id?: string;
  }): Promise<{
    data: {
      total_sent: number;
      delivery_rate: number;
      open_rate: number;
      click_rate: number;
      bounce_rate: number;
      unsubscribe_rate: number;
      trends: any[];
    };
  }> {
    return this.get("/api/notifications/metrics", { params });
  }

  async getChannelPerformance(params?: { start_date?: string; end_date?: string }): Promise<{
    data: Array<{
      channel: NotificationChannel["type"];
      sent_count: number;
      delivered_count: number;
      failed_count: number;
      delivery_rate: number;
      average_delivery_time: number;
    }>;
  }> {
    return this.get("/api/notifications/analytics/channel-performance", {
      params,
    });
  }

  async getEngagementAnalytics(params?: {
    start_date?: string;
    end_date?: string;
    segment?: string;
  }): Promise<{
    data: {
      engagement_by_time: any[];
      engagement_by_channel: any[];
      top_performing_templates: any[];
      user_engagement_segments: any[];
    };
  }> {
    return this.get("/api/notifications/analytics/engagement", { params });
  }

  // Webhooks & Real-time
  async subscribeToNotificationEvents(
    webhookUrl: string,
    events: string[],
  ): Promise<{ data: { subscription_id: string } }> {
    return this.post("/api/notifications/webhooks/subscribe", {
      webhook_url: webhookUrl,
      events,
    });
  }

  async unsubscribeFromNotificationEvents(
    subscriptionId: string,
  ): Promise<{ data: { success: boolean } }> {
    return this.delete(`/api/notifications/webhooks/subscriptions/${subscriptionId}`);
  }
}
