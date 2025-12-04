/**
 * MSW Handlers for Audit API
 *
 * Mocks audit logging endpoints for testing audit trail functionality
 */

import { http, HttpResponse } from "msw";
import type {
  AuditActivity,
  AuditActivityList,
  AuditFilterParams,
  ActivitySummary,
} from "@/types/audit";
import { ActivityType, ActivitySeverity } from "@/types/audit";
import type {
  AuditExportRequest,
  AuditExportResponse,
  ComplianceReport,
} from "@/lib/services/audit-service";

// ============================================
// In-Memory Storage
// ============================================

let activities: AuditActivity[] = [];
let exportRequests: Map<string, AuditExportResponse> = new Map();

// ============================================
// Mock Data Generators
// ============================================

export function createMockActivity(overrides: Partial<AuditActivity> = {}): AuditActivity {
  const id = overrides.id || `activity-${Date.now()}-${Math.random()}`;
  return {
    id,
    activity_type: ActivityType.USER_LOGIN,
    severity: ActivitySeverity.LOW,
    user_id: "user-1",
    tenant_id: "tenant-1",
    timestamp: new Date().toISOString(),
    resource_type: null,
    resource_id: null,
    action: "login",
    description: "User logged in",
    details: { ip: "192.168.1.1" },
    ip_address: "192.168.1.1",
    user_agent: "Mozilla/5.0",
    request_id: `req-${Date.now()}`,
    ...overrides,
  };
}

export function createMockActivitySummary(
  overrides: Partial<ActivitySummary> = {},
): ActivitySummary {
  return {
    total_activities: 100,
    by_severity: {
      [ActivitySeverity.LOW]: 40,
      [ActivitySeverity.MEDIUM]: 35,
      [ActivitySeverity.HIGH]: 20,
      [ActivitySeverity.CRITICAL]: 5,
    },
    by_type: {
      [ActivityType.USER_LOGIN]: 30,
      [ActivityType.USER_LOGOUT]: 25,
      [ActivityType.ROLE_ASSIGNED]: 15,
      [ActivityType.PERMISSION_GRANTED]: 10,
      [ActivityType.FILE_UPLOADED]: 20,
    },
    by_user: [
      { user_id: "user-1", count: 50 },
      { user_id: "user-2", count: 30 },
      { user_id: "user-3", count: 20 },
    ],
    recent_critical: [
      createMockActivity({
        id: "critical-1",
        activity_type: ActivityType.PERMISSION_DELETED,
        severity: ActivitySeverity.CRITICAL,
      }),
    ],
    timeline: [
      { date: "2024-01-01", count: 20 },
      { date: "2024-01-02", count: 25 },
      { date: "2024-01-03", count: 30 },
    ],
    ...overrides,
  };
}

export function createMockComplianceReport(
  overrides: Partial<ComplianceReport> = {},
): ComplianceReport {
  return {
    report_id: `report-${Date.now()}`,
    period_start: "2024-01-01",
    period_end: "2024-01-31",
    total_events: 1000,
    critical_events: 25,
    failed_access_attempts: 10,
    permission_changes: 50,
    data_exports: 5,
    compliance_score: 85,
    issues: [
      {
        severity: ActivitySeverity.CRITICAL,
        description: "Unauthorized access attempt",
        event_ids: ["event-1", "event-2"],
      },
      {
        severity: ActivitySeverity.HIGH,
        description: "Multiple failed login attempts",
        event_ids: ["event-3", "event-4", "event-5"],
      },
    ],
    generated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================
// Storage Helpers
// ============================================

export function seedAuditData(initialActivities: AuditActivity[]): void {
  activities = [...initialActivities];
}

export function clearAuditData(): void {
  activities = [];
  exportRequests.clear();
}

export function getActivities(): AuditActivity[] {
  return [...activities];
}

// ============================================
// Filtering Logic
// ============================================

function applyFilters(items: AuditActivity[], filters: AuditFilterParams): AuditActivity[] {
  let filtered = [...items];

  if (filters.user_id) {
    filtered = filtered.filter((a) => a.user_id === filters.user_id);
  }

  if (filters.activity_type) {
    filtered = filtered.filter((a) => a.activity_type === filters.activity_type);
  }

  if (filters.severity) {
    filtered = filtered.filter((a) => a.severity === filters.severity);
  }

  if (filters.resource_type) {
    filtered = filtered.filter((a) => a.resource_type === filters.resource_type);
  }

  if (filters.resource_id) {
    filtered = filtered.filter((a) => a.resource_id === filters.resource_id);
  }

  if (filters.days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - filters.days);
    filtered = filtered.filter((a) => new Date(a.timestamp) >= cutoffDate);
  }

  return filtered;
}

// ============================================
// MSW Handlers
// ============================================

export const auditHandlers = [
  // Export audit logs
  http.post("*/api/v1/audit/export", async ({ request }) => {
    const body = (await request.json()) as AuditExportRequest;
    if (!body.format) {
      return HttpResponse.json({ detail: "Invalid format" }, { status: 400 });
    }
    const exportId = `export-${Date.now()}`;
    const fmt = body.format;
    const response: AuditExportResponse = {
      export_id: exportId,
      status: "completed",
      download_url: `/downloads/audit-export-${exportId}.${fmt}`,
      expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    };
    exportRequests.set(exportId, response);
    console.log("[MSW] POST /api/v1/audit/export", { format: fmt });
    return HttpResponse.json(response);
  }),
  // Export audit logs
  http.post("*/api/v1/audit/export", async ({ request }) => {
    const body = (await request.json()) as AuditExportRequest;
    const exportId = `export-${Date.now()}`;
    const fmt = body.format || "csv";
    const response: AuditExportResponse = {
      export_id: exportId,
      status: "completed",
      download_url: `/downloads/audit-export-${exportId}.${fmt}`,
      expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    };
    exportRequests.set(exportId, response);
    console.log("[MSW] POST /api/v1/audit/export", { format: fmt });
    return HttpResponse.json(response);
  }),
  // Compliance report
  http.get("*/api/v1/audit/compliance", ({ request }) => {
    const url = new URL(request.url);
    const from_date = url.searchParams.get("from_date") || "";
    const to_date = url.searchParams.get("to_date") || "";
    const report = createMockComplianceReport({
      period_start: from_date,
      period_end: to_date,
    });
    console.log("[MSW] GET /api/v1/audit/compliance", { from_date, to_date });
    return HttpResponse.json(report);
  }),
  // Get activity summary - MUST come before /activities/:activityId
  http.get("*/api/v1/audit/activities/summary", ({ request, params }) => {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get("days") || "7");

    console.log("[MSW] GET /api/v1/audit/activities/summary", { days });

    // Filter by days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const filtered = activities.filter((a) => new Date(a.timestamp) >= cutoffDate);

    // Build summary
    const summary: ActivitySummary = {
      total_activities: filtered.length,
      by_severity: {
        [ActivitySeverity.LOW]: filtered.filter((a) => a.severity === ActivitySeverity.LOW).length,
        [ActivitySeverity.MEDIUM]: filtered.filter((a) => a.severity === ActivitySeverity.MEDIUM)
          .length,
        [ActivitySeverity.HIGH]: filtered.filter((a) => a.severity === ActivitySeverity.HIGH)
          .length,
        [ActivitySeverity.CRITICAL]: filtered.filter(
          (a) => a.severity === ActivitySeverity.CRITICAL,
        ).length,
      },
      by_type: {},
      by_user: [],
      recent_critical: filtered
        .filter((a) => a.severity === ActivitySeverity.CRITICAL)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5),
      timeline: [],
    };

    // Count by type
    filtered.forEach((a) => {
      summary.by_type[a.activity_type] = (summary.by_type[a.activity_type] || 0) + 1;
    });

    // Count by user
    const userCounts = new Map<string, number>();
    filtered.forEach((a) => {
      if (a.user_id) {
        userCounts.set(a.user_id, (userCounts.get(a.user_id) || 0) + 1);
      }
    });
    summary.by_user = Array.from(userCounts.entries())
      .map(([user_id, count]) => ({ user_id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    console.log(`[MSW] Returning summary for ${filtered.length} activities`);
    return HttpResponse.json(summary);
  }),

  // Get recent audit activities - MUST come before /activities/:activityId
  http.get("*/api/v1/audit/activities/recent", ({ request, params }) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const days = parseInt(url.searchParams.get("days") || "7");

    console.log("[MSW] GET /api/v1/audit/activities/recent", { limit, days });

    // Filter by days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const filtered = activities.filter((a) => new Date(a.timestamp) >= cutoffDate);

    // Sort by timestamp desc and limit
    const recent = filtered
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    console.log(`[MSW] Returning ${recent.length} recent activities`);
    return HttpResponse.json(recent);
  }),

  // Get user audit activities - MUST come before /activities/:activityId
  http.get("*/api/v1/audit/activities/user/:userId", ({ request, params }) => {
    const { userId } = params;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const days = parseInt(url.searchParams.get("days") || "30");

    console.log("[MSW] GET /api/v1/audit/activities/user/:userId", {
      userId,
      limit,
      days,
    });

    // Filter by user and days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const filtered = activities.filter(
      (a) => a.user_id === userId && new Date(a.timestamp) >= cutoffDate,
    );

    // Sort and limit
    const userActivities = filtered
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    console.log(`[MSW] Returning ${userActivities.length} user activities`);
    return HttpResponse.json(userActivities);
  }),

  // List audit activities with pagination and filters
  http.get("*/api/v1/audit/activities", ({ request, params }) => {
    const url = new URL(request.url);
    const filters: AuditFilterParams = {
      user_id: url.searchParams.get("user_id") || undefined,
      activity_type: url.searchParams.get("activity_type") || undefined,
      severity: url.searchParams.get("severity") as ActivitySeverity | undefined,
      resource_type: url.searchParams.get("resource_type") || undefined,
      resource_id: url.searchParams.get("resource_id") || undefined,
      days: url.searchParams.get("days") ? parseInt(url.searchParams.get("days")!) : undefined,
      page: url.searchParams.get("page") ? parseInt(url.searchParams.get("page")!) : 1,
      per_page: url.searchParams.get("per_page") ? parseInt(url.searchParams.get("per_page")!) : 20,
    };

    console.log("[MSW] GET /api/v1/audit/activities", filters);

    // Apply filters
    const filtered = applyFilters(activities, filters);

    // Pagination
    const page = filters.page || 1;
    const perPage = filters.per_page || 20;
    const total = filtered.length;
    const totalPages = Math.ceil(total / perPage);
    const offset = (page - 1) * perPage;
    const paginated = filtered.slice(offset, offset + perPage);

    const response: AuditActivityList = {
      activities: paginated,
      total,
      page,
      per_page: perPage,
      total_pages: totalPages,
    };

    console.log(`[MSW] Returning ${paginated.length}/${total} activities`);
    return HttpResponse.json(response);
  }),

  // Get single activity details - MUST come after specific routes
  http.get("*/api/v1/audit/activities/:activityId", ({ request, params }) => {
    const { activityId } = params;

    console.log("[MSW] GET /api/v1/audit/activities/:activityId", { activityId });

    const activity = activities.find((a) => a.id === activityId);

    if (!activity) {
      return HttpResponse.json({ error: "Activity not found", code: "NOT_FOUND" }, { status: 404 });
    }

    return HttpResponse.json(activity);
  }),

  // Export audit logs
  http.post("*/api/v1/audit/export", async ({ request, params }) => {
    const exportRequest = await request.json<AuditExportRequest>();

    console.log("[MSW] POST /api/v1/audit/export", {
      format: exportRequest.format,
      filters: exportRequest.filters,
    });

    // Simulate export with validation
    if (!exportRequest.format) {
      return HttpResponse.json(
        { error: "Format is required", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const exportId = `export-${Date.now()}`;
    const exportResponse: AuditExportResponse = {
      export_id: exportId,
      status: "completed",
      download_url: `https://api.example.com/downloads/${exportId}.${exportRequest.format}`,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    };

    exportRequests.set(exportId, exportResponse);

    return HttpResponse.json(exportResponse);
  }),

  // Get compliance report
  http.get("*/api/v1/audit/compliance", ({ request, params }) => {
    const url = new URL(request.url);
    const fromDate = url.searchParams.get("from_date") || "";
    const toDate = url.searchParams.get("to_date") || "";

    console.log("[MSW] GET /api/v1/audit/compliance", { fromDate, toDate });

    if (!fromDate || !toDate) {
      return HttpResponse.json(
        {
          error: "From and to dates are required",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    // Filter activities by date range
    const start = new Date(fromDate);
    const end = new Date(toDate);
    const filtered = activities.filter((a) => {
      const timestamp = new Date(a.timestamp);
      return timestamp >= start && timestamp <= end;
    });

    const report = createMockComplianceReport({
      period_start: fromDate,
      period_end: toDate,
      total_events: filtered.length,
      critical_events: filtered.filter((a) => a.severity === ActivitySeverity.CRITICAL).length,
    });

    console.log(`[MSW] Returning compliance report for ${filtered.length} events`);
    return HttpResponse.json(report);
  }),
];
