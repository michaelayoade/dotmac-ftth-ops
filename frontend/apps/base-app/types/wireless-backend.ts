/**
 * Wireless Infrastructure Backend Types
 *
 * Type definitions that match the backend API exactly
 */

// ============================================================================
// Enums (matching backend)
// ============================================================================

export type DeviceType = "access_point" | "radio" | "antenna" | "cpe" | "backhaul" | "tower";

export type DeviceStatus = "online" | "offline" | "degraded" | "maintenance" | "decommissioned";

export type Frequency = "2.4GHz" | "5GHz" | "6GHz" | "60GHz" | "custom";

export type RadioProtocol =
  | "802.11n"
  | "802.11ac"
  | "802.11ax"
  | "802.11ax_6ghz"
  | "802.11be"
  | "wimax"
  | "lte"
  | "custom";

export type CoverageType = "primary" | "secondary" | "dead_zone" | "interference";

// ============================================================================
// Wireless Device
// ============================================================================

export interface WirelessDevice {
  id: string;
  tenant_id: string;
  name: string;
  device_type: DeviceType;
  status: DeviceStatus;

  // Hardware info
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  mac_address?: string;
  firmware_version?: string;

  // Network configuration
  ip_address?: string;
  management_url?: string;
  ssid?: string;

  // Location
  latitude?: number;
  longitude?: number;
  altitude_meters?: number;
  address?: string;
  site_name?: string;

  // Physical mounting
  tower_height_meters?: number;
  mounting_height_meters?: number;
  azimuth_degrees?: number;
  tilt_degrees?: number;

  // Operational data
  last_seen?: string;
  uptime_seconds?: number;

  // External references
  netbox_device_id?: number;
  external_id?: string;

  // Metadata
  notes?: string;
  extra_metadata: Record<string, any>;
  tags: string[];

  created_at: string;
  updated_at: string;
}

// ============================================================================
// Wireless Radio
// ============================================================================

export interface WirelessRadio {
  id: string;
  tenant_id: string;
  device_id: string;

  radio_name: string;
  radio_index: number;

  // Radio configuration
  frequency: Frequency;
  protocol: RadioProtocol;
  channel?: number;
  channel_width_mhz?: number;

  // Power settings
  transmit_power_dbm?: number;
  max_power_dbm?: number;

  // Status
  enabled: boolean;
  status: DeviceStatus;

  // Performance metrics
  noise_floor_dbm?: number;
  interference_level?: number;
  utilization_percent?: number;
  connected_clients: number;

  // Statistics
  tx_bytes: number;
  rx_bytes: number;
  tx_packets: number;
  rx_packets: number;
  errors: number;
  retries: number;

  extra_metadata: Record<string, any>;

  created_at: string;
  updated_at: string;
}

// ============================================================================
// Coverage Zone
// ============================================================================

export interface CoverageZone {
  id: string;
  tenant_id: string;
  device_id?: string;

  zone_name: string;
  coverage_type: CoverageType;

  // GeoJSON polygon
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };

  center_latitude?: number;
  center_longitude?: number;

  estimated_signal_strength_dbm?: number;
  coverage_radius_meters?: number;

  frequency?: Frequency;

  description?: string;
  extra_metadata: Record<string, any>;

  created_at: string;
  updated_at: string;
}

// ============================================================================
// Signal Measurement
// ============================================================================

export interface SignalMeasurement {
  id: string;
  tenant_id: string;
  device_id: string;

  measured_at: string;

  latitude?: number;
  longitude?: number;

  // Signal metrics
  rssi_dbm?: number;
  snr_db?: number;
  noise_floor_dbm?: number;
  link_quality_percent?: number;

  // Performance metrics
  throughput_mbps?: number;
  latency_ms?: number;
  packet_loss_percent?: number;
  jitter_ms?: number;

  // Connection info
  frequency?: Frequency;
  channel?: number;
  client_mac?: string;

  measurement_type?: string;
  extra_metadata: Record<string, any>;

  created_at: string;
}

// ============================================================================
// Wireless Client
// ============================================================================

export interface WirelessClient {
  id: string;
  tenant_id: string;
  device_id: string;

  mac_address: string;
  ip_address?: string;
  hostname?: string;

  // Connection info
  ssid?: string;
  frequency?: Frequency;
  channel?: number;

  // Connection status
  connected: boolean;
  first_seen: string;
  last_seen: string;
  connection_duration_seconds?: number;

  // Signal quality
  rssi_dbm?: number;
  snr_db?: number;
  tx_rate_mbps?: number;
  rx_rate_mbps?: number;

  // Traffic statistics
  tx_bytes: number;
  rx_bytes: number;
  tx_packets: number;
  rx_packets: number;

  // Device info
  vendor?: string;
  device_type?: string;

  // Subscriber reference
  subscriber_id?: string;
  customer_id?: string;

  extra_metadata: Record<string, any>;

  created_at: string;
  updated_at: string;
}

// ============================================================================
// Statistics
// ============================================================================

export interface WirelessStatistics {
  total_devices: number;
  online_devices: number;
  offline_devices: number;
  degraded_devices: number;

  total_radios: number;
  active_radios: number;

  total_coverage_zones: number;
  coverage_area_km2?: number;

  total_connected_clients: number;
  total_clients_seen_24h: number;

  by_device_type: Record<string, number>;
  by_frequency: Record<string, number>;
  by_site: Record<string, number>;

  avg_signal_strength_dbm?: number;
  avg_client_throughput_mbps?: number;
}

export interface DeviceHealthSummary {
  device_id: string;
  device_name: string;
  device_type: DeviceType;
  status: DeviceStatus;

  total_radios: number;
  active_radios: number;
  connected_clients: number;

  avg_rssi_dbm?: number;
  avg_snr_db?: number;
  avg_utilization_percent?: number;

  total_tx_bytes: number;
  total_rx_bytes: number;

  last_seen?: string;
  uptime_seconds?: number;
}

// ============================================================================
// Create/Update Requests
// ============================================================================

export interface CreateDeviceRequest {
  name: string;
  device_type: DeviceType;
  status?: DeviceStatus;

  manufacturer?: string;
  model?: string;
  serial_number?: string;
  mac_address?: string;
  firmware_version?: string;

  ip_address?: string;
  management_url?: string;
  ssid?: string;

  latitude?: number;
  longitude?: number;
  altitude_meters?: number;
  address?: string;
  site_name?: string;

  tower_height_meters?: number;
  mounting_height_meters?: number;
  azimuth_degrees?: number;
  tilt_degrees?: number;

  netbox_device_id?: number;
  external_id?: string;

  notes?: string;
  extra_metadata?: Record<string, any>;
  tags?: string[];
}

export interface UpdateDeviceRequest {
  name?: string;
  device_type?: DeviceType;
  status?: DeviceStatus;

  manufacturer?: string;
  model?: string;
  serial_number?: string;
  mac_address?: string;
  firmware_version?: string;

  ip_address?: string;
  management_url?: string;
  ssid?: string;

  latitude?: number;
  longitude?: number;
  altitude_meters?: number;
  address?: string;
  site_name?: string;

  tower_height_meters?: number;
  mounting_height_meters?: number;
  azimuth_degrees?: number;
  tilt_degrees?: number;

  netbox_device_id?: number;
  external_id?: string;

  notes?: string;
  extra_metadata?: Record<string, any>;
  tags?: string[];
}

export interface CreateRadioRequest {
  device_id: string;
  radio_name: string;
  radio_index?: number;

  frequency: Frequency;
  protocol: RadioProtocol;
  channel?: number;
  channel_width_mhz?: number;

  transmit_power_dbm?: number;
  max_power_dbm?: number;

  enabled?: boolean;
  status?: DeviceStatus;

  extra_metadata?: Record<string, any>;
}

export interface UpdateRadioRequest {
  radio_name?: string;
  radio_index?: number;

  frequency?: Frequency;
  protocol?: RadioProtocol;
  channel?: number;
  channel_width_mhz?: number;

  transmit_power_dbm?: number;
  max_power_dbm?: number;

  enabled?: boolean;
  status?: DeviceStatus;

  noise_floor_dbm?: number;
  interference_level?: number;
  utilization_percent?: number;
  connected_clients?: number;

  extra_metadata?: Record<string, any>;
}

export interface CreateCoverageZoneRequest {
  device_id?: string;
  zone_name: string;
  coverage_type?: CoverageType;

  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };

  center_latitude?: number;
  center_longitude?: number;

  estimated_signal_strength_dbm?: number;
  coverage_radius_meters?: number;

  frequency?: Frequency;

  description?: string;
  extra_metadata?: Record<string, any>;
}

export interface CreateSignalMeasurementRequest {
  device_id: string;
  measured_at?: string;

  latitude?: number;
  longitude?: number;

  rssi_dbm?: number;
  snr_db?: number;
  noise_floor_dbm?: number;
  link_quality_percent?: number;

  throughput_mbps?: number;
  latency_ms?: number;
  packet_loss_percent?: number;
  jitter_ms?: number;

  frequency?: Frequency;
  channel?: number;
  client_mac?: string;

  measurement_type?: string;
  extra_metadata?: Record<string, any>;
}
