/**
 * GenieACS CPE Management Types
 *
 * TypeScript interfaces for GenieACS TR-069/CWMP operations
 * Maps to backend schemas in src/dotmac/platform/genieacs/
 */

import { DateString } from "./common";

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
  last_inform?: DateString;
  registered?: DateString;
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

export interface DeviceQuery {
  query?: Record<string, any>;
  projection?: string;
  skip?: number;
  limit?: number;
}

export interface DeviceStatusResponse {
  device_id: string;
  online: boolean;
  last_inform?: DateString;
  last_boot?: DateString;
  uptime?: number; // Seconds
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

export interface TaskCreate {
  device_id: string;
  task_name: string;
  task_data?: Record<string, any>;
}

export interface RefreshRequest {
  device_id: string;
  object_path?: string;
}

export interface SetParameterRequest {
  device_id: string;
  parameters: Record<string, any>;
}

export interface GetParameterRequest {
  device_id: string;
  parameter_names: string[];
}

export interface RebootRequest {
  device_id: string;
}

export interface FactoryResetRequest {
  device_id: string;
}

export interface FirmwareDownloadRequest {
  device_id: string;
  file_type?: string;
  file_name: string;
  target_file_name?: string;
}

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

export interface CPEConfigRequest {
  device_id: string;
  wifi?: WiFiConfig;
  lan?: LANConfig;
  wan?: WANConfig;
}

// ============================================================================
// Mass Configuration Types
// ============================================================================

export interface MassConfigFilter {
  query: Record<string, any>;
  expected_count?: number;
}

export interface MassWiFiConfig {
  ssid?: string;
  password?: string;
  security_mode?: string;
  channel?: number;
  enabled?: boolean;
}

export interface MassLANConfig {
  dhcp_enabled?: boolean;
  dhcp_start?: string;
  dhcp_end?: string;
}

export interface MassWANConfig {
  connection_type?: string;
  vlan_id?: number;
}

export interface MassConfigRequest {
  name: string;
  description?: string;
  device_filter: MassConfigFilter;
  wifi?: MassWiFiConfig;
  lan?: MassLANConfig;
  wan?: MassWANConfig;
  custom_parameters?: Record<string, any>;
  max_concurrent?: number;
  dry_run?: boolean;
}

export interface MassConfigResult {
  device_id: string;
  status: "success" | "failed" | "pending" | "in_progress" | "skipped";
  parameters_changed: Record<string, any>;
  error_message?: string;
  started_at?: DateString;
  completed_at?: DateString;
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
  created_at: DateString;
  started_at?: DateString;
  completed_at?: DateString;
}

export interface MassConfigResponse {
  job: MassConfigJob;
  preview?: string[]; // Device IDs for dry run
  results: MassConfigResult[];
}

export interface MassConfigJobList {
  jobs: MassConfigJob[];
  total: number;
}

// ============================================================================
// Firmware Upgrade Types
// ============================================================================

export interface FirmwareUpgradeScheduleCreate {
  name: string;
  description?: string;
  firmware_file: string;
  file_type?: string;
  device_filter: Record<string, any>;
  scheduled_at: DateString;
  timezone?: string;
  max_concurrent?: number;
}

export interface FirmwareUpgradeSchedule {
  schedule_id?: string;
  name: string;
  description?: string;
  firmware_file: string;
  file_type: string;
  device_filter: Record<string, any>;
  scheduled_at: DateString;
  timezone: string;
  max_concurrent: number;
  total_devices: number;
  completed_devices: number;
  failed_devices: number;
  pending_devices?: number;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  created_at?: DateString;
  started_at?: DateString;
  completed_at?: DateString;
}

export interface FirmwareUpgradeResult {
  device_id: string;
  status: "success" | "failed" | "pending" | "in_progress";
  error_message?: string;
  started_at?: DateString;
  completed_at?: DateString;
}

export interface FirmwareUpgradeScheduleResponse {
  schedule: FirmwareUpgradeSchedule;
  total_devices: number;
  completed_devices: number;
  failed_devices: number;
  pending_devices: number;
  results: FirmwareUpgradeResult[];
}

export interface FirmwareUpgradeScheduleList {
  schedules: FirmwareUpgradeSchedule[];
  total: number;
}

// ============================================================================
// Preset and Provision Types
// ============================================================================

export interface PresetCreate {
  name: string;
  channel: string;
  schedule?: Record<string, any>;
  events: Record<string, boolean>;
  precondition?: string;
  configurations: Array<Record<string, any>>;
}

export interface PresetUpdate {
  channel?: string;
  schedule?: Record<string, any>;
  events?: Record<string, boolean>;
  precondition?: string;
  configurations?: Array<Record<string, any>>;
}

export interface PresetResponse {
  preset_id: string;
  name: string;
  channel: string;
  events: Record<string, boolean>;
  configurations: Array<Record<string, any>>;
}

export interface ProvisionResponse {
  provision_id: string;
  script: string;
}

// ============================================================================
// File and Fault Types
// ============================================================================

export interface FileResponse {
  file_id: string;
  metadata: Record<string, any>;
  length?: number;
  upload_date?: DateString;
}

export interface FaultResponse {
  fault_id: string;
  device: string;
  channel: string;
  code: string;
  message: string;
  detail?: Record<string, any>;
  timestamp: DateString;
  retries: number;
}

// ============================================================================
// Health Check
// ============================================================================

export interface GenieACSHealthResponse {
  healthy: boolean;
  message: string;
  device_count?: number;
  fault_count?: number;
}

// ============================================================================
// Campaign Types (UI-specific)
// ============================================================================

export type CampaignType = "firmware_upgrade" | "mass_config" | "reboot" | "factory_reset";

export interface Campaign {
  id: string;
  type: CampaignType;
  name: string;
  description?: string;
  status: "draft" | "scheduled" | "running" | "completed" | "failed" | "cancelled";
  device_filter: Record<string, any>;
  total_devices: number;
  completed_devices: number;
  failed_devices: number;
  scheduled_at?: DateString;
  created_at: DateString;
  started_at?: DateString;
  completed_at?: DateString;
  created_by?: string;
}

export interface CampaignStats {
  total_campaigns: number;
  active_campaigns: number;
  completed_today: number;
  failed_today: number;
  devices_affected_today: number;
  success_rate: number;
}
