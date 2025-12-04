/**
 * MSW Handlers for Notification API Endpoints
 */

import { http, HttpResponse } from "msw";
import type {
  Notification,
  NotificationListResponse,
  NotificationCreateRequest,
  CommunicationTemplate,
  TemplateCreateRequest,
  TemplateUpdateRequest,
  CommunicationLog,
  BulkNotificationRequest,
  BulkNotificationResponse,
} from "../../../hooks/useNotifications";
import {
  seedTemplates as seedCommunicationsTemplates,
  seedLogs as seedCommunicationsLogs,
} from "./communications";

// In-memory storage for test data
let notifications: Notification[] = [];
let templates: CommunicationTemplate[] = [];
let logs: CommunicationLog[] = [];
let nextNotificationId = 1;
let nextTemplateId = 1;
let nextLogId = 1;
let nextJobId = 1;

// Reset storage between tests
export function resetNotificationStorage() {
  notifications = [];
  templates = [];
  logs = [];
  nextNotificationId = 1;
  nextTemplateId = 1;
  nextLogId = 1;
  nextJobId = 1;
}

// Helper to create a mock notification
export function createMockNotification(overrides?: Partial<Notification>): Notification {
  return {
    id: `notif-${nextNotificationId++}`,
    user_id: "user-123",
    tenant_id: "tenant-123",
    type: "ticket_created",
    priority: "medium",
    title: "Test Notification",
    message: "This is a test notification",
    is_read: false,
    is_archived: false,
    channels: ["in_app", "email"],
    email_sent: false,
    sms_sent: false,
    push_sent: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create a mock template
export function createMockTemplate(
  overrides?: Partial<CommunicationTemplate>,
): CommunicationTemplate {
  return {
    id: `tpl-${nextTemplateId++}`,
    tenant_id: "tenant-123",
    name: "Test Template",
    description: "A test template",
    type: "email",
    subject_template: "Test Subject {{variable}}",
    text_template: "Test text {{variable}}",
    html_template: "<p>Test HTML {{variable}}</p>",
    variables: ["variable"],
    required_variables: ["variable"],
    is_active: true,
    is_default: false,
    usage_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create a mock communication log
export function createMockLog(overrides?: Partial<CommunicationLog>): CommunicationLog {
  return {
    id: `log-${nextLogId++}`,
    tenant_id: "tenant-123",
    type: "email",
    recipient: "test@example.com",
    sender: "noreply@dotmac.com",
    subject: "Test Email",
    text_body: "Test body",
    status: "sent",
    retry_count: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to seed initial data
export function seedNotificationData(
  notificationData: Notification[],
  templateData: CommunicationTemplate[],
  logData: CommunicationLog[],
) {
  notifications = [...notificationData];
  templates = [...templateData];
  logs = [...logData];
  seedCommunicationsTemplates(templateData);
  seedCommunicationsLogs(logData);
}

export const notificationHandlers = [
  // GET /api/v1/notifications - List notifications
  http.get("*/api/v1/notifications", ({ request, params }) => {
    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get("unread_only") === "true";
    const priority = url.searchParams.get("priority");
    const notificationType = url.searchParams.get("notification_type");

    let filtered = notifications;

    if (unreadOnly) {
      filtered = filtered.filter((n) => !n.is_read);
    }

    if (priority) {
      filtered = filtered.filter((n) => n.priority === priority);
    }

    if (notificationType) {
      filtered = filtered.filter((n) => n.type === notificationType);
    }

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    const response: NotificationListResponse = {
      notifications: filtered,
      total: filtered.length,
      unread_count: unreadCount,
    };

    return HttpResponse.json(response);
  }),

  // GET /api/v1/notifications/unread-count - Get unread count
  http.get("*/api/v1/notifications/unread-count", ({ request, params }) => {
    const unreadCount = notifications.filter((n) => !n.is_read).length;
    return HttpResponse.json({ unread_count: unreadCount });
  }),

  // POST /api/v1/notifications/:id/read - Mark as read
  http.post("*/api/v1/notifications/:id/read", ({ request, params }) => {
    const { id } = params;
    const notification = notifications.find((n) => n.id === id);

    if (!notification) {
      return HttpResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    notification.is_read = true;
    notification.read_at = new Date().toISOString();

    return HttpResponse.json(notification);
  }),

  // POST /api/v1/notifications/:id/unread - Mark as unread
  http.post("*/api/v1/notifications/:id/unread", ({ request, params }) => {
    const { id } = params;
    const notification = notifications.find((n) => n.id === id);

    if (!notification) {
      return HttpResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    notification.is_read = false;
    delete notification.read_at;

    return HttpResponse.json(notification);
  }),

  // POST /api/v1/notifications/mark-all-read - Mark all as read
  http.post("*/api/v1/notifications/mark-all-read", ({ request, params }) => {
    const now = new Date().toISOString();
    notifications.forEach((n) => {
      n.is_read = true;
      n.read_at = now;
    });

    return HttpResponse.json({ success: true });
  }),

  // POST /api/v1/notifications/:id/archive - Archive notification
  http.post("*/api/v1/notifications/:id/archive", ({ request, params }) => {
    const { id } = params;
    const notification = notifications.find((n) => n.id === id);

    if (!notification) {
      return HttpResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    notification.is_archived = true;
    notification.archived_at = new Date().toISOString();

    return HttpResponse.json(notification);
  }),

  // DELETE /api/v1/notifications/:id - Delete notification
  http.delete("*/api/v1/notifications/:id", ({ request, params }) => {
    const { id } = params;
    const index = notifications.findIndex((n) => n.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    notifications.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // GET /api/v1/communications/templates - List templates
  http.get("*/api/v1/communications/templates", ({ request, params }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const activeOnly = url.searchParams.get("active_only") === "true";

    let filtered = templates;

    if (type) {
      filtered = filtered.filter((t) => t.type === type);
    }

    if (activeOnly) {
      filtered = filtered.filter((t) => t.is_active);
    }

    return HttpResponse.json(filtered);
  }),

  // POST /api/v1/communications/templates - Create template
  http.post("*/api/v1/communications/templates", async ({ request, params }) => {
    const data = (await request.json()) as TemplateCreateRequest;

    const newTemplate = createMockTemplate({
      ...data,
      variables: data.required_variables || [],
      required_variables: data.required_variables || [],
    });

    templates.push(newTemplate);

    return HttpResponse.json(newTemplate, { status: 201 });
  }),

  // PATCH /api/v1/communications/templates/:id - Update template
  http.patch("*/api/v1/communications/templates/:id", async ({ request, params }) => {
    const { id } = params;
    const updates = (await request.json()) as TemplateUpdateRequest;

    const index = templates.findIndex((t) => t.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: "Template not found" }, { status: 404 });
    }

    templates[index] = {
      ...templates[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(templates[index]);
  }),

  // DELETE /api/v1/communications/templates/:id - Delete template
  http.delete("*/api/v1/communications/templates/:id", ({ request, params }) => {
    const { id } = params;
    const index = templates.findIndex((t) => t.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: "Template not found" }, { status: 404 });
    }

    templates.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /api/v1/communications/templates/:id/render - Render template preview
  http.post("*/api/v1/communications/templates/:id/render", async ({ request, params }) => {
    const { id } = params;
    const { data } = (await request.json()) as { data: Record<string, any> };

    const template = templates.find((t) => t.id === id);

    if (!template) {
      return HttpResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Simple variable replacement for testing
    const renderText = (text: string, vars: Record<string, any>) => {
      let result = text;
      Object.entries(vars).forEach(([key, value]) => {
        result = result.replace(new RegExp(`{{${key}}}`, "g"), String(value));
      });
      return result;
    };

    return HttpResponse.json({
      subject: template.subject_template ? renderText(template.subject_template, data) : undefined,
      text: template.text_template ? renderText(template.text_template, data) : undefined,
      html: template.html_template ? renderText(template.html_template, data) : undefined,
    });
  }),

  // GET /api/v1/communications/logs - List communication logs
  http.get("*/api/v1/communications/logs", ({ request, params }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    const recipient = url.searchParams.get("recipient");
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("page_size") || "20");

    let filtered = logs;

    if (type) {
      filtered = filtered.filter((l) => l.type === type);
    }

    if (status) {
      filtered = filtered.filter((l) => l.status === status);
    }

    if (recipient) {
      filtered = filtered.filter((l) => l.recipient.includes(recipient));
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginated = filtered.slice(start, end);

    return HttpResponse.json({
      logs: paginated,
      total: filtered.length,
    });
  }),

  // POST /api/v1/communications/logs/:id/retry - Retry failed communication
  http.post("*/api/v1/communications/logs/:id/retry", ({ request, params }) => {
    const { id } = params;
    const log = logs.find((l) => l.id === id);

    if (!log) {
      return HttpResponse.json({ error: "Log not found" }, { status: 404 });
    }

    log.status = "pending";
    log.retry_count += 1;

    return HttpResponse.json(log);
  }),

  // POST /api/v1/notifications/bulk - Send bulk notification
  http.post("*/api/v1/notifications/bulk", async ({ request, params }) => {
    const data = (await request.json()) as BulkNotificationRequest;

    const response: BulkNotificationResponse = {
      job_id: `job-${nextJobId++}`,
      total_recipients: 100, // Mock value
      status: "queued",
      scheduled_at: data.schedule_at,
    };

    return HttpResponse.json(response, { status: 202 });
  }),

  // GET /api/v1/notifications/bulk/:jobId - Get bulk job status
  http.get("*/api/v1/notifications/bulk/:jobId", ({ request, params }) => {
    const { jobId } = params;

    const response: BulkNotificationResponse = {
      job_id: String(jobId),
      total_recipients: 100,
      status: "completed",
    };

    return HttpResponse.json(response);
  }),
];
