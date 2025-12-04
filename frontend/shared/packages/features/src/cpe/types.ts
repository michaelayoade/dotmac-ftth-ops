/**
 * GenieACS CPE Management Types
 *
 * Shared TypeScript interfaces for GenieACS TR-069/CWMP operations
 * Used across both platform-admin-app and isp-ops-app
 */

// ============================================================================
// Device Types
// ============================================================================

export interface DeviceInfo {
  device_id: string;
  manufacturer?: string;
  model?: string;
  product_class?: string;
  oui?: string;
  serial_number?: string;
  hardware_version?: string;
  software_version?: string;
  connection_request_url?: string;
  last_inform?: string;
  registered?: string;
}

export interface DeviceResponse {
  device_id: string;
  device_info: Record<string, any>;
  parameters: Record<string, any>;
  tags: string[];
}

export interface DeviceListResponse {
  devices: DeviceInfo[];
  total: number;
  skip: number;
  limit: number;
}

export interface DeviceStatsResponse {
  total_devices: number;
  online_devices: number;
  offline_devices: number;
  manufacturers: Record<string, number>;
  models: Record<string, number>;
}

// ============================================================================
// Task Types
// ============================================================================

export interface TaskResponse {
  success: boolean;
  message: string;
  task_id?: string;
  details?: Record<string, any>;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface WiFiConfig {
  ssid: string;
  password: string;
  security_mode?: string;
  channel?: number;
  enabled?: boolean;
}

export interface LANConfig {
  ip_address: string;
  subnet_mask: string;
  dhcp_enabled?: boolean;
  dhcp_start?: string;
  dhcp_end?: string;
}

export interface WANConfig {
  connection_type: string;
  username?: string;
  password?: string;
  vlan_id?: number;
}

// ============================================================================
// Mass Configuration Types
// ============================================================================

export interface MassConfigFilter {
  query: Record<string, any>;
  expected_count?: number;
}

export interface MassConfigRequest {
  name: string;
  description?: string | undefined;
  device_filter: MassConfigFilter;
  wifi?: WiFiConfig | undefined;
  lan?: LANConfig | undefined;
  wan?: WANConfig | undefined;
  custom_parameters?: Record<string, any> | undefined;
  max_concurrent?: number | undefined;
  dry_run?: boolean | undefined;
}

export interface MassConfigResult {
  device_id: string;
  status: "success" | "failed" | "pending" | "in_progress" | "skipped";
  parameters_changed: Record<string, any>;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
}

export interface MassConfigJob {
  job_id: string;
  name: string;
  description?: string;
  device_filter: Record<string, any>;
  total_devices: number;
  completed_devices: number;
  failed_devices: number;
  pending_devices: number;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  dry_run: boolean;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface MassConfigResponse {
  job: MassConfigJob;
  preview?: string[]; // Device IDs for dry run
  results: MassConfigResult[];
}

// ============================================================================
// Config Template Types (UI-specific)
// ============================================================================

export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  category: "residential" | "business" | "custom";
  wifi?: WiFiConfig;
  lan?: LANConfig;
  wan?: WANConfig;
  custom_parameters?: Record<string, any>;
}
