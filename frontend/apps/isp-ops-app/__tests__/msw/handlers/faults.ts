/**
 * MSW Handlers for Faults/Alarms API Endpoints
 *
 * These handlers intercept fault-related API calls during tests,
 * providing realistic responses without hitting a real server.
 */

import { http, HttpResponse } from "msw";
import type {
  Alarm,
  AlarmStatistics,
  SLACompliance,
  SLARollupStats,
  AlarmSeverity,
  AlarmStatus,
  AlarmSource,
} from "../../../hooks/useFaults";

// In-memory storage for test data
let alarms: Alarm[] = [];
let alarmHistory: any[] = [];
let alarmNotes: any[] = [];
let nextAlarmId = 1;
let nextHistoryId = 1;
let nextNoteId = 1;

// Reset storage between tests
export function resetFaultStorage() {
  alarms = [];
  alarmHistory = [];
  alarmNotes = [];
  nextAlarmId = 1;
  nextHistoryId = 1;
  nextNoteId = 1;
}

// Helper to create an alarm
export function createMockAlarm(overrides?: Partial<Alarm>): Alarm {
  return {
    id: `alarm-${nextAlarmId++}`,
    tenant_id: "tenant-1",
    alarm_id: `ALM-${String(nextAlarmId).padStart(3, "0")}`,
    severity: "critical",
    status: "active",
    source: "voltha",
    alarm_type: "ont_offline",
    title: "ONT Offline",
    description: "ONT device is offline",
    subscriber_count: 1,
    correlation_action: "none",
    is_root_cause: true,
    first_occurrence: new Date().toISOString(),
    last_occurrence: new Date().toISOString(),
    occurrence_count: 1,
    tags: {},
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create alarm history
export function createMockHistory(alarmId: string, overrides?: any) {
  return {
    id: `hist-${nextHistoryId++}`,
    alarm_id: alarmId,
    event: "created",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create alarm note
export function createMockNote(alarmId: string, overrides?: any) {
  return {
    id: `note-${nextNoteId++}`,
    alarm_id: alarmId,
    content: "Test note",
    created_by: "user-1",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to seed initial data
export function seedFaultData(alarmsData: Alarm[], historyData?: any[], notesData?: any[]) {
  alarms = [...alarmsData];
  alarmHistory = historyData ? [...historyData] : [];
  alarmNotes = notesData ? [...notesData] : [];
}

// Helper to create alarm statistics
export function createMockAlarmStatistics(): AlarmStatistics {
  const bySeverity: Record<AlarmSeverity, number> = {
    critical: 0,
    major: 0,
    minor: 0,
    warning: 0,
    info: 0,
  };

  const byStatus: Record<AlarmStatus, number> = {
    active: 0,
    acknowledged: 0,
    cleared: 0,
    resolved: 0,
  };

  const bySource: Record<AlarmSource, number> = {
    genieacs: 0,
    voltha: 0,
    netbox: 0,
    manual: 0,
    api: 0,
  };

  alarms.forEach((alarm) => {
    bySeverity[alarm.severity] = (bySeverity[alarm.severity] || 0) + 1;
    byStatus[alarm.status] = (byStatus[alarm.status] || 0) + 1;
    bySource[alarm.source] = (bySource[alarm.source] || 0) + 1;
  });

  const activeAlarms = byStatus.active;
  const criticalAlarms = bySeverity.critical;
  const acknowledgedAlarms = byStatus.acknowledged;
  const affectedSubscribers = alarms.reduce((acc, alarm) => acc + alarm.subscriber_count, 0);

  return {
    total_alarms: alarms.length,
    active_alarms: activeAlarms,
    critical_alarms: criticalAlarms,
    acknowledged_alarms: acknowledgedAlarms,
    resolved_last_24h: 0,
    affected_subscribers: affectedSubscribers,
    by_severity: bySeverity,
    by_status: byStatus,
    by_source: bySource,
  };
}

export const faultHandlers = [
  // GET /faults/alarms - List alarms
  http.get("*/faults/alarms", ({ request, params }) => {
    const url = new URL(request.url);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const severities = url.searchParams.getAll("severity");
    const statuses = url.searchParams.getAll("status");
    const sources = url.searchParams.getAll("source");
    const alarmType = url.searchParams.get("alarm_type");
    const resourceType = url.searchParams.get("resource_type");
    const resourceId = url.searchParams.get("resource_id");
    const customerId = url.searchParams.get("customer_id");
    const assignedTo = url.searchParams.get("assigned_to");
    const isRootCause = url.searchParams.get("is_root_cause");

    console.log("[MSW] GET /faults/alarms", {
      offset,
      limit,
      severities,
      statuses,
      totalAlarms: alarms.length,
    });

    let filtered = alarms;

    // Filter by severity
    if (severities.length > 0) {
      filtered = filtered.filter((alarm) => severities.includes(alarm.severity));
    }

    // Filter by status
    if (statuses.length > 0) {
      filtered = filtered.filter((alarm) => statuses.includes(alarm.status));
    }

    // Filter by source
    if (sources.length > 0) {
      filtered = filtered.filter((alarm) => sources.includes(alarm.source));
    }

    // Filter by alarm type
    if (alarmType) {
      filtered = filtered.filter((alarm) => alarm.alarm_type === alarmType);
    }

    // Filter by resource type
    if (resourceType) {
      filtered = filtered.filter((alarm) => alarm.resource_type === resourceType);
    }

    // Filter by resource ID
    if (resourceId) {
      filtered = filtered.filter((alarm) => alarm.resource_id === resourceId);
    }

    // Filter by customer ID
    if (customerId) {
      filtered = filtered.filter((alarm) => alarm.customer_id === customerId);
    }

    // Filter by assigned to
    if (assignedTo) {
      filtered = filtered.filter((alarm) => alarm.assigned_to === assignedTo);
    }

    // Filter by is root cause
    if (isRootCause !== null) {
      const isRoot = isRootCause === "true";
      filtered = filtered.filter((alarm) => alarm.is_root_cause === isRoot);
    }

    // Paginate
    const start = offset;
    const end = offset + limit;
    const paginated = filtered.slice(start, end);

    console.log("[MSW] Returning", paginated.length, "alarms");

    return HttpResponse.json(paginated);
  }),

  // GET /faults/alarms/statistics - Get alarm statistics
  http.get("*/faults/alarms/statistics", ({ request, params }) => {
    const stats = createMockAlarmStatistics();
    return HttpResponse.json(stats);
  }),

  // GET /faults/sla/compliance - Get SLA compliance
  http.get("*/faults/sla/compliance", ({ request, params }) => {
    const url = new URL(request.url);
    const fromDate = url.searchParams.get("from_date");
    const excludeMaintenance = url.searchParams.get("exclude_maintenance");

    // Return mock SLA compliance data
    const days = 7;
    const compliance: SLACompliance[] = Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - i - 1));

      return {
        date: date.toISOString().split("T")[0],
        compliance_percentage: 99.5 + Math.random() * 0.5,
        target_percentage: 99.9,
        uptime_minutes: 1435 + Math.floor(Math.random() * 5),
        downtime_minutes: Math.floor(Math.random() * 5),
        sla_breaches: Math.random() > 0.8 ? 1 : 0,
      };
    });

    return HttpResponse.json(compliance);
  }),

  // GET /faults/sla/rollup-stats - Get SLA rollup stats
  http.get("*/faults/sla/rollup-stats", ({ request, params }) => {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get("days") || "30");
    const targetPercentage = parseFloat(url.searchParams.get("target_percentage") || "99.9");

    const stats: SLARollupStats = {
      total_downtime_minutes: 150,
      total_breaches: 5,
      worst_day_compliance: 99.5,
      avg_compliance: 99.85,
      days_analyzed: days,
    };

    return HttpResponse.json(stats);
  }),

  // GET /faults/alarms/:id/history - Get alarm history
  http.get("*/faults/alarms/:id/history", ({ request, params }) => {
    const { id } = params;

    const history = alarmHistory.filter((h) => h.alarm_id === id);

    return HttpResponse.json(history);
  }),

  // GET /faults/alarms/:id/notes - Get alarm notes
  http.get("*/faults/alarms/:id/notes", ({ request, params }) => {
    const { id } = params;

    const notes = alarmNotes.filter((n) => n.alarm_id === id);

    return HttpResponse.json(notes);
  }),

  // POST /faults/alarms/:id/notes - Add alarm note
  http.post("*/faults/alarms/:id/notes", async ({ request, params }) => {
    const { id } = params;
    const data = (await request.json()) as { content: string };

    const newNote = createMockNote(id as string, { content: data.content });
    alarmNotes.push(newNote);

    return HttpResponse.json(newNote, { status: 201 });
  }),

  // POST /faults/alarms/:id/acknowledge - Acknowledge alarm
  http.post("*/faults/alarms/:id/acknowledge", ({ request, params }) => {
    const { id } = params;

    const index = alarms.findIndex((alarm) => alarm.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: "Alarm not found", code: "NOT_FOUND" }, { status: 404 });
    }

    alarms[index].status = "acknowledged";
    alarms[index].acknowledged_at = new Date().toISOString();
    alarms[index].updated_at = new Date().toISOString();

    return HttpResponse.json(alarms[index], { status: 200 });
  }),

  // POST /faults/alarms/:id/clear - Clear alarm
  http.post("*/faults/alarms/:id/clear", ({ request, params }) => {
    const { id } = params;

    const index = alarms.findIndex((alarm) => alarm.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: "Alarm not found", code: "NOT_FOUND" }, { status: 404 });
    }

    alarms[index].status = "cleared";
    alarms[index].cleared_at = new Date().toISOString();
    alarms[index].updated_at = new Date().toISOString();

    return HttpResponse.json(alarms[index], { status: 200 });
  }),

  // POST /faults/alarms/:id/create-ticket - Create ticket for alarm
  http.post("*/faults/alarms/:id/create-ticket", async ({ request, params }) => {
    const { id } = params;
    const data = (await request.json()) as { priority: string };

    const index = alarms.findIndex((alarm) => alarm.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: "Alarm not found", code: "NOT_FOUND" }, { status: 404 });
    }

    alarms[index].ticket_id = `ticket-${Date.now()}`;
    alarms[index].updated_at = new Date().toISOString();

    return HttpResponse.json({ ticket_id: alarms[index].ticket_id }, { status: 201 });
  }),
];
