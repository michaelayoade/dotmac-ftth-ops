/**
 * Network Monitoring Types
 *
 * TypeScript interfaces for network device monitoring, traffic stats, and alerts.
 * Maps to backend schemas in src/dotmac/platform/network_monitoring/schemas.py
 */

import { DateString } from "./common";

// ============================================================================
// Enums
// ============================================================================

export enum DeviceStatus {
  ONLINE = "online",
  OFFLINE = "offline",
  DEGRADED = "degraded",
  UNKNOWN = "unknown",
}

export enum AlertSeverity {
  CRITICAL = "critical",
  WARNING = "warning",
  INFO = "info",
}

export enum DeviceType {
  OLT = "olt", // Optical Line Terminal
  ONU = "onu", // Optical Network Unit
  CPE = "cpe", // Customer Premises Equipment
  ROUTER = "router",
  SWITCH = "switch",
  FIREWALL = "firewall",
  OTHER = "other",
}

// ============================================================================
// Device Health
// ============================================================================

export interface DeviceHealth {
  device_id: string;
  device_name: string;
  device_type: DeviceType;
  status: DeviceStatus;
  ip_address?: string;
  last_seen?: DateString;
  uptime_seconds?: number;

  // Health metrics
  cpu_usage_percent?: number;
  memory_usage_percent?: number;
  temperature_celsius?: number;
  power_status?: string;

  // Connectivity
  ping_latency_ms?: number;
  packet_loss_percent?: number;

  // Additional info
  firmware_version?: string;
  model?: string;
  location?: string;
  tenant_id?: string;
}

// ============================================================================
// Traffic/Bandwidth
// ============================================================================

export interface InterfaceStats {
  interface_name: string;
  status: string; // up, down, admin_down
  speed_mbps?: number;

  // Traffic counters (bytes)
  bytes_in: number;
  bytes_out: number;
  packets_in: number;
  packets_out: number;

  // Error counters
  errors_in: number;
  errors_out: number;
  drops_in: number;
  drops_out: number;

  // Rates (bits per second)
  rate_in_bps?: number;
  rate_out_bps?: number;

  // Utilization
  utilization_percent?: number;
}

export interface TrafficStats {
  device_id: string;
  device_name: string;
  timestamp: DateString;

  // Aggregate stats
  total_bytes_in: number;
  total_bytes_out: number;
  total_packets_in: number;
  total_packets_out: number;

  // Current rates
  current_rate_in_bps: number;
  current_rate_out_bps: number;

  // Interface details
  interfaces: InterfaceStats[];

  // Peak usage (last 24h)
  peak_rate_in_bps?: number;
  peak_rate_out_bps?: number;
  peak_timestamp?: DateString;
}

// ============================================================================
// Device-Specific Metrics
// ============================================================================

export interface ONUMetrics {
  serial_number: string;
  optical_power_rx_dbm?: number;
  optical_power_tx_dbm?: number;
  olt_rx_power_dbm?: number;
  distance_meters?: number;
  state?: string; // active, disabled, etc.
}

export interface CPEMetrics {
  mac_address: string;
  wifi_enabled?: boolean;
  connected_clients?: number;
  wifi_2ghz_clients?: number;
  wifi_5ghz_clients?: number;
  wan_ip?: string;
  last_inform?: DateString;
}

export interface DeviceMetrics {
  device_id: string;
  device_name: string;
  device_type: DeviceType;
  timestamp: DateString;

  // Common metrics
  health: DeviceHealth;
  traffic?: TrafficStats;

  // Device-specific metrics
  onu_metrics?: ONUMetrics;
  cpe_metrics?: CPEMetrics;

  // Custom metrics
  custom_metrics?: Record<string, any>;
}

// ============================================================================
// Alerts
// ============================================================================

export interface NetworkAlert {
  alert_id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  device_id?: string;
  device_name?: string;
  device_type?: DeviceType;

  // Timing
  triggered_at: DateString;
  acknowledged_at?: DateString;
  resolved_at?: DateString;

  // Status
  is_active: boolean;
  is_acknowledged: boolean;

  // Context
  metric_name?: string;
  threshold_value?: number;
  current_value?: number;
  alert_rule_id?: string;

  // Tenant isolation
  tenant_id: string;
}

export interface AcknowledgeAlertRequest {
  note?: string;
}

export interface CreateAlertRuleRequest {
  name: string;
  description?: string;
  device_type?: DeviceType;
  metric_name: string;
  condition: string; // gt, lt, gte, lte, eq
  threshold: number;
  severity: AlertSeverity;
  enabled: boolean;
}

export interface AlertRule {
  rule_id: string;
  tenant_id: string;
  name: string;
  description?: string;
  device_type?: DeviceType;
  metric_name: string;
  condition: string;
  threshold: number;
  severity: AlertSeverity;
  enabled: boolean;
  created_at: DateString;
}

// ============================================================================
// Dashboard/Overview
// ============================================================================

export interface DeviceTypeSummary {
  device_type: DeviceType;
  total_count: number;
  online_count: number;
  offline_count: number;
  degraded_count: number;
  avg_cpu_usage?: number;
  avg_memory_usage?: number;
}

export interface NetworkOverview {
  tenant_id: string;
  timestamp: DateString;

  // Device counts
  total_devices: number;
  online_devices: number;
  offline_devices: number;
  degraded_devices: number;

  // Alerts
  active_alerts: number;
  critical_alerts: number;
  warning_alerts: number;

  // Traffic summary (bits per second)
  total_bandwidth_in_bps: number;
  total_bandwidth_out_bps: number;
  peak_bandwidth_in_bps?: number;
  peak_bandwidth_out_bps?: number;

  // By device type
  device_type_summary: DeviceTypeSummary[];

  // Recent events
  recent_offline_devices: string[];
  recent_alerts: NetworkAlert[];
  data_source_status?: Record<string, string>;
}

// ============================================================================
// API Request Parameters
// ============================================================================

export interface ListDevicesParams {
  device_type?: DeviceType;
  status?: DeviceStatus;
}

export interface ListAlertsParams {
  severity?: AlertSeverity;
  active_only?: boolean;
  device_id?: string;
  limit?: number;
}

export interface DeviceHealthParams {
  device_type: DeviceType;
}
