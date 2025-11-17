/**
 * MSW Handlers for Communications API
 * Mocks email/SMS communications, templates, bulk operations, and statistics
 */

import { http, HttpResponse } from "msw";

// In-memory storage
let templates: any[] = [];
let logs: any[] = [];
let bulkOperations: any[] = [];
let tasks: Map<string, any> = new Map();
let nextTemplateId = 1;
let nextLogId = 1;
let nextBulkId = 1;

// Factory functions
function createMockTemplate(data: Partial<any> = {}): any {
  const now = new Date().toISOString();
  return {
    id: data.id || `template-${nextTemplateId++}`,
    name: data.name || `Template ${nextTemplateId}`,
    description: data.description || "",
    subject: data.subject || "{{subject}}",
    body_html: data.body_html || "<p>{{message}}</p>",
    body_text: data.body_text || "{{message}}",
    variables: data.variables || ["subject", "message"],
    is_active: data.is_active ?? true,
    created_at: now,
    updated_at: now,
    ...data,
  };
}

function createMockLog(data: Partial<any> = {}): any {
  const now = new Date().toISOString();
  return {
    id: data.id || `log-${nextLogId++}`,
    type: data.type || "email",
    status: data.status || "sent",
    recipient: data.recipient || "user@example.com",
    subject: data.subject || "Test Email",
    template_id: data.template_id || null,
    sent_at: data.sent_at || now,
    error_message: data.error_message || null,
    metadata: data.metadata || {},
    created_at: now,
    ...data,
  };
}

function createMockBulkOperation(data: Partial<any> = {}): any {
  const now = new Date().toISOString();
  return {
    id: data.id || `bulk-${nextBulkId++}`,
    name: data.name || `Bulk Operation ${nextBulkId}`,
    status: data.status || "queued",
    total_count: data.total_count || 0,
    processed_count: data.processed_count || 0,
    success_count: data.success_count || 0,
    failure_count: data.failure_count || 0,
    progress: data.progress || 0,
    created_at: now,
    started_at: data.started_at || null,
    completed_at: data.completed_at || null,
    ...data,
  };
}

// Seed functions
export function seedTemplates(templatesList: Partial<any>[]): void {
  templates = templatesList.map(createMockTemplate);
}

export function seedLogs(logsList: Partial<any>[]): void {
  logs = logsList.map(createMockLog);
}

export function seedBulkOperations(bulkList: Partial<any>[]): void {
  bulkOperations = bulkList.map(createMockBulkOperation);
}

export function clearCommunicationsData(): void {
  templates = [];
  logs = [];
  bulkOperations = [];
  tasks.clear();
  nextTemplateId = 1;
  nextLogId = 1;
  nextBulkId = 1;
}

const updateTemplateEntry = async (req: any, res: any, ctx: any) => {
  const { id } = req.params;
  const body = await req.json<any>();

  const templateIndex = templates.findIndex((t) => t.id === id);
  if (templateIndex === -1) {
    return HttpResponse.json({ detail: "Template not found" }, { status: 404 });
  }

  templates[templateIndex] = {
    ...templates[templateIndex],
    ...body,
    updated_at: new Date().toISOString(),
  };

  return HttpResponse.json(templates[templateIndex]);
};

export const communicationsHandlers = [
  // POST /api/v1/communications/email/send - Send email immediately
  http.post("*/api/v1/communications/email/send", async (req) => {
    const body = await req.json<any>();

    const log = createMockLog({
      type: "email",
      status: "sent",
      recipient: body.to,
      subject: body.subject,
    });

    logs.push(log);

    return HttpResponse.json({
      message_id: `msg-${Date.now()}`,
      status: "sent",
      log_id: log.id,
    });
  }),

  // POST /api/v1/communications/email/queue - Queue email
  http.post("*/api/v1/communications/email/queue", async (req) => {
    const body = await req.json<any>();
    const taskId = `task-${Date.now()}`;

    tasks.set(taskId, {
      id: taskId,
      status: "pending",
      result: null,
    });

    const log = createMockLog({
      type: "email",
      status: "queued",
      recipient: body.to,
      subject: body.subject,
    });

    logs.push(log);

    return HttpResponse.json({
      task_id: taskId,
      log_id: log.id,
      status: "queued",
    });
  }),

  // GET /api/v1/communications/templates - List templates
  http.get("*/api/v1/communications/templates", ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("page_size") || "20");
    const search = url.searchParams.get("search");
    const isActive = url.searchParams.get("is_active");
    const activeOnly = url.searchParams.get("active_only");
    const typeParam = url.searchParams.get("type");

    let filtered = [...templates];

    if (search) {
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          (t.description && t.description.toLowerCase().includes(search.toLowerCase())),
      );
    }

    if (typeParam) {
      filtered = filtered.filter((t) => t.type === typeParam);
    }

    if (activeOnly === "true") {
      filtered = filtered.filter((t) => t.is_active);
    } else if (isActive !== null) {
      filtered = filtered.filter((t) => t.is_active === (isActive === "true"));
    }

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginated = filtered.slice(start, end);

    return HttpResponse.json({
      templates: paginated,
      total,
      page,
      page_size: pageSize,
      has_more: end < total,
    });
  }),

  // POST /api/v1/communications/templates - Create template
  http.post("*/api/v1/communications/templates", async (req) => {
    const body = await req.json<any>();
    const newTemplate = createMockTemplate(body);
    templates.push(newTemplate);
    return HttpResponse.json(newTemplate);
  }),

  // POST /api/v1/communications/render - Quick render
  http.post("*/api/v1/communications/render", async (req) => {
    const body = await req.json<any>();

    const rendered = {
      rendered_subject: body.subject || "Rendered Subject",
      rendered_body_html: body.body_html || "<p>Rendered HTML</p>",
      rendered_body_text: body.body_text || "Rendered text",
      variables_used: Object.keys(body.variables || {}),
    };

    return HttpResponse.json(rendered);
  }),

  // GET /api/v1/communications/templates/:id - Get template
  http.get("*/api/v1/communications/templates/:id", ({ params }) => {
    const id = params.id as string;
    const template = templates.find((t) => t.id === id);

    if (!template) {
      return HttpResponse.json({ detail: "Template not found" }, { status: 404 });
    }

    return HttpResponse.json(template);
  }),

  // PUT /api/v1/communications/templates/:id - Update template
  http.put("*/api/v1/communications/templates/:id", updateTemplateEntry),

  // PATCH /api/v1/communications/templates/:id - Partial update
  http.patch("*/api/v1/communications/templates/:id", updateTemplateEntry),

  // DELETE /api/v1/communications/templates/:id - Delete template
  http.delete("*/api/v1/communications/templates/:id", ({ params }) => {
    const id = params.id as string;
    const templateIndex = templates.findIndex((t) => t.id === id);

    if (templateIndex === -1) {
      return HttpResponse.json({ detail: "Template not found" }, { status: 404 });
    }

    templates.splice(templateIndex, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /api/v1/communications/templates/:id/render - Render template
  http.post("*/api/v1/communications/templates/:id/render", async ({ params, request }) => {
    const id = params.id as string;
    const body = await request.json<any>();
    const template = templates.find((t) => t.id === id);

    if (!template) {
      return HttpResponse.json({ detail: "Template not found" }, { status: 404 });
    }

    const variables = body?.variables ?? body?.data ?? {};
    const renderText = (input?: string | null) =>
      input
        ? input.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) =>
            variables[key] !== undefined && variables[key] !== null ? String(variables[key]) : "",
          )
        : null;

    const renderedSubject = renderText(template.subject_template || template.subject) ?? undefined;
    const renderedText = renderText(template.text_template || template.body_text) ?? undefined;
    const renderedHtml = renderText(template.html_template || template.body_html) ?? undefined;

    return HttpResponse.json({
      rendered_subject: renderedSubject,
      rendered_body_text: renderedText,
      rendered_body_html: renderedHtml,
      subject: renderedSubject,
      text: renderedText,
      html: renderedHtml,
      variables_used: Object.keys(variables),
    });
  }),

  // GET /api/v1/communications/logs - List logs
  http.get("*/api/v1/communications/logs", ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("page_size") || "20");
    const status = url.searchParams.get("status");
    const type = url.searchParams.get("type");

    let filtered = [...logs];

    if (status) {
      filtered = filtered.filter((l) => l.status === status);
    }

    if (type) {
      filtered = filtered.filter((l) => l.type === type);
    }

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginated = filtered.slice(start, end);

    return HttpResponse.json({ logs: paginated, total });
  }),

  // POST /api/v1/communications/logs/:id/retry - Retry communication
  http.post("*/api/v1/communications/logs/:id/retry", (req) => {
    const { id } = req.params;
    const logIndex = logs.findIndex((l) => l.id === id);

    if (logIndex === -1) {
      return HttpResponse.json({ detail: "Log not found" }, { status: 404 });
    }

    const current = logs[logIndex];
    logs[logIndex] = {
      ...current,
      status: "sent",
      retry_count: (current.retry_count || 0) + 1,
      error_message: null,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(logs[logIndex]);
  }),

  // GET /api/v1/communications/logs/:id - Get log
  http.get("*/api/v1/communications/logs/:id", ({ params }) => {
    const id = params.id as string;
    const log = logs.find((l) => l.id === id);

    if (!log) {
      return HttpResponse.json({ detail: "Log not found" }, { status: 404 });
    }

    return HttpResponse.json(log);
  }),

  // POST /api/v1/communications/bulk/queue - Queue bulk operation
  http.post("*/api/v1/communications/bulk/queue", async (req) => {
    const body = await req.json<any>();
    const newBulk = createMockBulkOperation({
      name: body.name,
      total_count: body.recipients?.length || 0,
      status: "queued",
    });

    bulkOperations.push(newBulk);
    return HttpResponse.json(newBulk);
  }),

  // GET /api/v1/communications/bulk/:id/status - Get bulk status
  http.get("*/api/v1/communications/bulk/:id/status", ({ params }) => {
    const id = params.id as string;
    const bulk = bulkOperations.find((b) => b.id === id);

    if (!bulk) {
      return HttpResponse.json({ detail: "Bulk operation not found" }, { status: 404 });
    }

    return HttpResponse.json({
      operation: bulk,
      recent_logs: [],
    });
  }),

  // POST /api/v1/communications/bulk/:id/cancel - Cancel bulk
  http.post("*/api/v1/communications/bulk/:id/cancel", (req) => {
    const { id } = req.params;
    const bulkIndex = bulkOperations.findIndex((b) => b.id === id);

    if (bulkIndex === -1) {
      return HttpResponse.json({ detail: "Bulk operation not found" }, { status: 404 });
    }

    bulkOperations[bulkIndex] = {
      ...bulkOperations[bulkIndex],
      status: "cancelled",
      completed_at: new Date().toISOString(),
    };

    return HttpResponse.json(bulkOperations[bulkIndex]);
  }),

  // GET /api/v1/communications/tasks/:taskId - Get task status
  http.get("*/api/v1/communications/tasks/:taskId", ({ params }) => {
    const taskId = params.taskId as string;
    const task = tasks.get(taskId);

    if (!task) {
      return HttpResponse.json({ detail: "Task not found" }, { status: 404 });
    }

    return HttpResponse.json(task);
  }),

  // GET /api/v1/communications/stats - Get statistics
  http.get("*/api/v1/communications/stats", ({ request }) => {
    const stats = {
      total_sent: logs.filter((l) => l.status === "sent").length,
      total_queued: logs.filter((l) => l.status === "queued").length,
      total_failed: logs.filter((l) => l.status === "failed").length,
      success_rate:
        logs.length > 0 ? (logs.filter((l) => l.status === "sent").length / logs.length) * 100 : 0,
      by_type: {
        email: logs.filter((l) => l.type === "email").length,
        sms: logs.filter((l) => l.type === "sms").length,
      },
    };

    return HttpResponse.json(stats);
  }),

  // GET /api/v1/communications/activity - Get recent activity
  http.get("*/api/v1/communications/activity", ({ request }) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return HttpResponse.json({
      activity: [
        {
          date: now.toISOString().split("T")[0],
          sent: logs.filter((l) => l.status === "sent").length,
          delivered: logs.filter((l) => l.status === "delivered").length,
          failed: logs.filter((l) => l.status === "failed").length,
          opened: logs.filter((l) => l.status === "opened").length,
          clicked: logs.filter((l) => l.status === "clicked").length,
        },
      ],
      start_date: thirtyDaysAgo.toISOString(),
      end_date: now.toISOString(),
    });
  }),

  // GET /api/v1/communications/health - Health check
  http.get("*/api/v1/communications/health", ({ request }) => {
    return HttpResponse.json({
      smtp_available: true,
      smtp_host: "smtp.example.com",
      smtp_port: 587,
      redis_available: true,
      celery_available: true,
      active_workers: 4,
      pending_tasks: 0,
      failed_tasks: 0,
    });
  }),

  // GET /api/v1/communications/metrics - Get metrics
  http.get("*/api/v1/communications/metrics", ({ request }) => {
    const totalSent = logs.filter((l) => l.status === "sent").length;
    const totalDelivered = logs.filter((l) => l.status === "delivered").length;
    const totalFailed = logs.filter((l) => l.status === "failed").length;

    return HttpResponse.json({
      total_logs: logs.length,
      total_templates: templates.length,
      active_templates: templates.filter((t) => t.is_active).length,
      stats: {
        total_sent: totalSent,
        total_delivered: totalDelivered,
        total_failed: totalFailed,
        total_opened: 0,
        total_clicked: 0,
        delivery_rate: logs.length > 0 ? (totalDelivered / logs.length) * 100 : 0,
        open_rate: 0,
        click_rate: 0,
        by_channel: {},
        by_status: {},
        recent_activity: [],
      },
      top_templates: [],
      recent_failures: [],
      cached_at: new Date().toISOString(),
    });
  }),
];
