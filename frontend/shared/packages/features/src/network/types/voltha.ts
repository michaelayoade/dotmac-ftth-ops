/**
 * VOLTHA PON Management Types
 *
 * TypeScript interfaces for VOLTHA (Virtual OLT Hardware Abstraction)
 * Shared types for network management components
 */

// ============================================================================
// Common Types
// ============================================================================

export type DateString = string;

// ============================================================================
// Enums
// ============================================================================

export enum DeviceAdminState {
  UNKNOWN = "UNKNOWN",
  PREPROVISIONED = "PREPROVISIONED",
  ENABLED = "ENABLED",
  DISABLED = "DISABLED",
  DOWNLOADING_IMAGE = "DOWNLOADING_IMAGE",
}

export enum DeviceOperStatus {
  UNKNOWN = "UNKNOWN",
  DISCOVERED = "DISCOVERED",
  ACTIVATING = "ACTIVATING",
  ACTIVE = "ACTIVE",
  FAILED = "FAILED",
  RECONCILING = "RECONCILING",
  DELETED = "DELETED",
}

export enum DeviceConnectStatus {
  UNKNOWN = "UNKNOWN",
  UNREACHABLE = "UNREACHABLE",
  REACHABLE = "REACHABLE",
}

export enum PortType {
  UNKNOWN = "UNKNOWN",
  ETHERNET_NNI = "ETHERNET_NNI",
  ETHERNET_UNI = "ETHERNET_UNI",
  PON_OLT = "PON_OLT",
  PON_ONU = "PON_ONU",
  VENET_OLT = "VENET_OLT",
  VENET_ONU = "VENET_ONU",
}

export enum AlarmSeverity {
  INDETERMINATE = "INDETERMINATE",
  WARNING = "WARNING",
  MINOR = "MINOR",
  MAJOR = "MAJOR",
  CRITICAL = "CRITICAL",
}

// ============================================================================
// Device Types
// ============================================================================

export interface DeviceType {
  id: string;
  vendor?: string;
  model?: string;
  adapter?: string;
}

export interface Port {
  port_no: number;
  label?: string;
  type?: PortType | string;
  admin_state?: DeviceAdminState | string;
  oper_status?: DeviceOperStatus | string;
  device_id?: string;
  peers?: Array<{
    device_id: string;
    port_no: number;
  }>;
  ofp_port?: Record<string, any>;
}

export interface Device {
  id: string;
  type?: string;
  root: boolean;
  parent_id?: string;
  parent_port_no?: number;
  vendor?: string;
  model?: string;
  hardware_version?: string;
  firmware_version?: string;
  serial_number?: string;
  adapter?: string;
  vlan?: number;
  admin_state?: DeviceAdminState | string;
  oper_status?: DeviceOperStatus | string;
  connect_status?: DeviceConnectStatus | string;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface DeviceListResponse {
  devices: Device[];
  total: number;
}

export interface DeviceDetailResponse {
  device: Device;
  ports: Port[];
}

// ============================================================================
// Logical Device Types (OLTs)
// ============================================================================

export interface LogicalPort {
  id: string;
  ofp_port?: Record<string, any>;
  device_id?: string;
  device_port_no?: number;
}

export interface LogicalDevice {
  id: string;
  datapath_id: string;
  desc?: {
    mfr_desc?: string;
    hw_desc?: string;
    sw_desc?: string;
    serial_num?: string;
    dp_desc?: string;
  };
  root_device_id?: string;
  switch_features?: Record<string, any>;
  ports?: LogicalPort[];
  flows?: Record<string, any>[];
}

export interface LogicalDeviceListResponse {
  devices: LogicalDevice[];
  total: number;
  logical_devices?: LogicalDevice[]; // Backward compatibility
}

export interface LogicalDeviceDetailResponse {
  device: LogicalDevice;
  ports: LogicalPort[];
  flows: Record<string, any>[];
}

// ============================================================================
// PON Statistics
// ============================================================================

export interface PONStatistics {
  device_id: string;
  port_no: number;
  timestamp: DateString;

  // Optical metrics
  rx_power?: number; // dBm
  tx_power?: number; // dBm
  voltage?: number; // V
  temperature?: number; // C
  bias_current?: number; // mA

  // Traffic metrics
  rx_bytes?: number;
  tx_bytes?: number;
  rx_packets?: number;
  tx_packets?: number;
  rx_errors?: number;
  tx_errors?: number;

  // FEC metrics
  fec_corrected?: number;
  fec_uncorrectable?: number;

  // BER metrics
  ber?: number;
}

// ============================================================================
// Alarms and Events
// ============================================================================

export interface VOLTHAAlarm {
  id: string;
  type: string;
  category: string;
  severity: AlarmSeverity | string;
  state: "RAISED" | "CLEARED";
  raised_ts: DateString;
  cleared_ts?: DateString;
  device_id: string;
  logical_device_id?: string;
  resource_id?: string;
  description?: string;
  context?: Record<string, any>;
}

export interface VOLTHAAlarmListResponse {
  alarms: VOLTHAAlarm[];
  total: number;
  active_count?: number;
}

export interface VOLTHAEvent {
  type: string;
  category: string;
  sub_category?: string;
  raised_ts: DateString;
  device_id: string;
  resource_id?: string;
  description?: string;
  context?: Record<string, any>;
}

export interface VOLTHAEventStreamResponse {
  events: VOLTHAEvent[];
}

// ============================================================================
// ONU Discovery and Provisioning
// ============================================================================

export interface DiscoveredONU {
  onu_id: string;
  serial_number: string;
  state: string;
  rssi?: number;
  metadata: Record<string, any>;
}

export type ONUDiscoveryResponse = DiscoveredONU[];

export interface ONUProvisionRequest {
  serial_number: string;
  olt_device_id: string;
  pon_port: number;
  subscriber_id?: string;
  vlan?: number;
  line_profile_id?: string;
  service_profile_id?: string;
  bandwidth_profile?: string;
}

export interface ONUProvisionResponse {
  success: boolean;
  message?: string;
  applied_config?: Record<string, any>;
}

// ============================================================================
// Device Operations
// ============================================================================

export interface DeviceOperationResponse {
  success: boolean;
  message: string;
  device_id: string;
}

// ============================================================================
// Adapters
// ============================================================================

export interface Adapter {
  id: string;
  vendor: string;
  version: string;
  config?: Record<string, any>;
  current_replica?: number;
  total_replicas?: number;
  endpoint?: string;
}

export interface AdapterListResponse {
  adapters: Adapter[];
  total: number;
}

// ============================================================================
// Health
// ============================================================================

export interface VOLTHAHealthResponse {
  healthy: boolean;
  state: string;
  message: string;
  total_devices?: number;
  total_logical_devices?: number;
}

// ============================================================================
// PON Port Metrics
// ============================================================================

export interface PONPortMetrics {
  port_no: number;
  label: string;
  admin_state: string;
  oper_status: string;
  total_onus: number;
  online_onus: number;
  offline_onus: number;
  avg_rx_power?: number;
  avg_tx_power?: number;
  utilization_percent?: number;
}

export interface OLTOverview {
  device_id: string;
  serial_number: string;
  model: string;
  firmware_version: string;
  admin_state: string;
  oper_status: string;
  connect_status: string;
  total_pon_ports: number;
  active_pon_ports: number;
  total_onus: number;
  online_onus: number;
  pon_ports: PONPortMetrics[];
}
