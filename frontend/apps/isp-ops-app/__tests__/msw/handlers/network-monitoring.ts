/**
 * MSW Handlers for Network Monitoring API Endpoints
 *
 * These handlers intercept network monitoring API calls during tests,
 * providing realistic responses without hitting a real server.
 */

import { http, HttpResponse } from "msw";
import type {
  NetworkOverview,
  DeviceHealth,
  DeviceMetrics,
  TrafficStats,
  NetworkAlert,
  AlertRule,
  DeviceType,
  DeviceStatus,
  AlertSeverity,
  AcknowledgeAlertRequest,
  CreateAlertRuleRequest,
} from "../../../types/network-monitoring";

// In-memory storage for test data
let networkOverview: NetworkOverview | null = null;
let devices: DeviceHealth[] = [];
let deviceMetrics: Map<string, DeviceMetrics> = new Map();
let deviceTraffic: Map<string, TrafficStats> = new Map();
let alerts: NetworkAlert[] = [];
let alertRules: AlertRule[] = [];
let nextAlertId = 1;
let nextRuleId = 1;

// Reset storage between tests
export function resetNetworkMonitoringStorage() {
  networkOverview = null;
  devices = [];
  deviceMetrics = new Map();
  deviceTraffic = new Map();
  alerts = [];
  alertRules = [];
  nextAlertId = 1;
  nextRuleId = 1;
}

// Helper to create a mock network overview
export function createMockNetworkOverview(overrides?: Partial<NetworkOverview>): NetworkOverview {
  return {
    tenant_id: "tenant-123",
    timestamp: new Date().toISOString(),
    total_devices: 10,
    online_devices: 8,
    offline_devices: 1,
    degraded_devices: 1,
    active_alerts: 3,
    critical_alerts: 1,
    warning_alerts: 2,
    total_bandwidth_in_bps: 1000000000,
    total_bandwidth_out_bps: 500000000,
    peak_bandwidth_in_bps: 1500000000,
    peak_bandwidth_out_bps: 750000000,
    device_type_summary: [],
    recent_offline_devices: [],
    recent_alerts: [],
    ...overrides,
  };
}

// Helper to create a mock device
export function createMockDevice(overrides?: Partial<DeviceHealth>): DeviceHealth {
  const id = `device-${devices.length + 1}`;
  return {
    device_id: id,
    device_name: `Device ${id}`,
    device_type: "olt" as DeviceType,
    status: "online" as DeviceStatus,
    ip_address: "192.168.1.1",
    last_seen: new Date().toISOString(),
    uptime_seconds: 86400,
    cpu_usage_percent: 45,
    memory_usage_percent: 60,
    temperature_celsius: 55,
    ping_latency_ms: 10,
    packet_loss_percent: 0,
    firmware_version: "1.0.0",
    model: "Model X",
    location: "Data Center A",
    tenant_id: "tenant-123",
    ...overrides,
  };
}

// Helper to create mock device metrics
export function createMockDeviceMetrics(
  deviceId: string,
  overrides?: Partial<DeviceMetrics>,
): DeviceMetrics {
  return {
    device_id: deviceId,
    device_name: `Device ${deviceId}`,
    device_type: "olt" as DeviceType,
    timestamp: new Date().toISOString(),
    health: createMockDevice({ device_id: deviceId }),
    ...overrides,
  };
}

// Helper to create mock traffic stats
export function createMockTrafficStats(
  deviceId: string,
  overrides?: Partial<TrafficStats>,
): TrafficStats {
  return {
    device_id: deviceId,
    device_name: `Device ${deviceId}`,
    timestamp: new Date().toISOString(),
    total_bytes_in: 1000000000,
    total_bytes_out: 500000000,
    total_packets_in: 1000000,
    total_packets_out: 500000,
    current_rate_in_bps: 100000000,
    current_rate_out_bps: 50000000,
    interfaces: [],
    peak_rate_in_bps: 150000000,
    peak_rate_out_bps: 75000000,
    peak_timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create a mock alert
export function createMockAlert(overrides?: Partial<NetworkAlert>): NetworkAlert {
  return {
    alert_id: `alert-${nextAlertId++}`,
    severity: "warning" as AlertSeverity,
    title: "Test Alert",
    description: "This is a test alert",
    device_id: "device-1",
    device_name: "Device 1",
    device_type: "olt" as DeviceType,
    triggered_at: new Date().toISOString(),
    is_active: true,
    is_acknowledged: false,
    tenant_id: "tenant-123",
    ...overrides,
  };
}

// Helper to create a mock alert rule
export function createMockAlertRule(overrides?: Partial<AlertRule>): AlertRule {
  return {
    rule_id: `rule-${nextRuleId++}`,
    tenant_id: "tenant-123",
    name: "Test Alert Rule",
    description: "This is a test alert rule",
    device_type: "olt" as DeviceType,
    metric_name: "cpu_usage_percent",
    condition: "gt",
    threshold: 80,
    severity: "warning" as AlertSeverity,
    enabled: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to seed initial data
export function seedNetworkMonitoringData(
  overview: NetworkOverview | null,
  devicesData: DeviceHealth[],
  alertsData: NetworkAlert[],
  rulesData: AlertRule[],
) {
  networkOverview = overview;
  devices = [...devicesData];
  alerts = [...alertsData];
  alertRules = [...rulesData];
}

export const networkMonitoringHandlers = [
  // GET /api/v1/network/overview - Get network overview
  http.get("*/api/v1/network/overview", ({ request, params }) => {
    console.log("[MSW] GET /network/overview");

    if (!networkOverview) {
      networkOverview = createMockNetworkOverview();
    }

    return HttpResponse.json(networkOverview);
  }),

  // GET /api/v1/network/devices - List network devices
  http.get("*/api/v1/network/devices", ({ request, params }) => {
    const url = new URL(request.url);
    const device_type = url.searchParams.get("device_type");
    const status = url.searchParams.get("status");

    console.log("[MSW] GET /network/devices", {
      device_type,
      status,
      totalDevices: devices.length,
    });

    let filtered = devices;

    if (device_type) {
      filtered = filtered.filter((d) => d.device_type === device_type);
    }

    if (status) {
      filtered = filtered.filter((d) => d.status === status);
    }

    console.log("[MSW] Returning", filtered.length, "devices");

    return HttpResponse.json(filtered);
  }),

  // GET /api/v1/network/devices/:deviceId/health - Get device health
  http.get("*/api/v1/network/devices/:deviceId/health", ({ request, params }) => {
    const { deviceId } = params;

    console.log("[MSW] GET /network/devices/:deviceId/health", { deviceId });

    const device = devices.find((d) => d.device_id === deviceId);

    if (!device) {
      return HttpResponse.json({ error: "Device not found", code: "NOT_FOUND" }, { status: 404 });
    }

    return HttpResponse.json(device);
  }),

  // GET /api/v1/network/devices/:deviceId/metrics - Get device metrics
  http.get("*/api/v1/network/devices/:deviceId/metrics", ({ request, params }) => {
    const { deviceId } = params;

    console.log("[MSW] GET /network/devices/:deviceId/metrics", { deviceId });

    let metrics = deviceMetrics.get(deviceId as string);

    if (!metrics) {
      // Auto-create metrics if device exists
      const device = devices.find((d) => d.device_id === deviceId);
      if (device) {
        metrics = createMockDeviceMetrics(deviceId as string);
        deviceMetrics.set(deviceId as string, metrics);
      }
    }

    if (!metrics) {
      return HttpResponse.json({ error: "Device not found", code: "NOT_FOUND" }, { status: 404 });
    }

    return HttpResponse.json(metrics);
  }),

  // GET /api/v1/network/devices/:deviceId/traffic - Get device traffic
  http.get("*/api/v1/network/devices/:deviceId/traffic", ({ request, params }) => {
    const { deviceId } = params;

    console.log("[MSW] GET /network/devices/:deviceId/traffic", { deviceId });

    let traffic = deviceTraffic.get(deviceId as string);

    if (!traffic) {
      // Auto-create traffic stats if device exists
      const device = devices.find((d) => d.device_id === deviceId);
      if (device) {
        traffic = createMockTrafficStats(deviceId as string);
        deviceTraffic.set(deviceId as string, traffic);
      }
    }

    if (!traffic) {
      return HttpResponse.json({ error: "Device not found", code: "NOT_FOUND" }, { status: 404 });
    }

    return HttpResponse.json(traffic);
  }),

  // GET /api/v1/network/alerts - List network alerts
  http.get("*/api/v1/network/alerts", ({ request, params }) => {
    const url = new URL(request.url);
    const severity = url.searchParams.get("severity");
    const active_only = url.searchParams.get("active_only");
    const device_id = url.searchParams.get("device_id");
    const limit = url.searchParams.get("limit");

    console.log("[MSW] GET /network/alerts", {
      severity,
      active_only,
      device_id,
      limit,
      totalAlerts: alerts.length,
    });

    let filtered = alerts;

    if (severity) {
      filtered = filtered.filter((a) => a.severity === severity);
    }

    if (active_only === "true") {
      filtered = filtered.filter((a) => a.is_active);
    }

    if (device_id) {
      filtered = filtered.filter((a) => a.device_id === device_id);
    }

    if (limit) {
      filtered = filtered.slice(0, parseInt(limit));
    }

    console.log("[MSW] Returning", filtered.length, "alerts");

    return HttpResponse.json(filtered);
  }),

  // POST /api/v1/network/alerts/:alertId/acknowledge - Acknowledge alert
  http.post("*/api/v1/network/alerts/:alertId/acknowledge", async ({ request, params }) => {
    const { alertId } = params;
    const data = (await request.json()) as AcknowledgeAlertRequest;

    console.log("[MSW] POST /network/alerts/:alertId/acknowledge", { alertId, data });

    const alertIndex = alerts.findIndex((a) => a.alert_id === alertId);

    if (alertIndex === -1) {
      return HttpResponse.json({ error: "Alert not found", code: "NOT_FOUND" }, { status: 404 });
    }

    alerts[alertIndex] = {
      ...alerts[alertIndex],
      is_acknowledged: true,
      acknowledged_at: new Date().toISOString(),
    };

    return HttpResponse.json(alerts[alertIndex]);
  }),

  // GET /api/v1/network/alert-rules - List alert rules
  http.get("*/api/v1/network/alert-rules", ({ request, params }) => {
    console.log("[MSW] GET /network/alert-rules", { totalRules: alertRules.length });

    return HttpResponse.json(alertRules);
  }),

  // POST /api/v1/network/alert-rules - Create alert rule
  http.post("*/api/v1/network/alert-rules", async ({ request, params }) => {
    const data = (await request.json()) as CreateAlertRuleRequest;

    console.log("[MSW] POST /network/alert-rules", { data });

    const newRule = createMockAlertRule({
      name: data.name,
      description: data.description,
      device_type: data.device_type,
      metric_name: data.metric_name,
      condition: data.condition,
      threshold: data.threshold,
      severity: data.severity,
      enabled: data.enabled,
    });

    alertRules.push(newRule);

    return HttpResponse.json(newRule, { status: 201 });
  }),
];
