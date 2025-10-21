/**
 * Wireless Infrastructure Type Definitions
 *
 * Type definitions for wireless network infrastructure, access points, coverage, and RF analytics
 */

// ============================================================================
// Geographic Types
// ============================================================================

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeoPath {
  id: string;
  coordinates: Coordinates[];
  distance_meters?: number;
}

// ============================================================================
// Wireless Equipment Types
// ============================================================================

export type AccessPointType =
  | "indoor"
  | "outdoor"
  | "mesh"
  | "point_to_point"
  | "point_to_multipoint"
  | "omni_directional"
  | "sector";

export type AccessPointStatus = "online" | "offline" | "degraded" | "maintenance" | "planned";

export type FrequencyBand = "2.4ghz" | "5ghz" | "6ghz" | "60ghz" | "sub_6ghz" | "mmwave";

export type WirelessStandard =
  | "wifi_4" // 802.11n
  | "wifi_5" // 802.11ac
  | "wifi_6" // 802.11ax
  | "wifi_6e" // 802.11ax (6 GHz)
  | "wifi_7" // 802.11be
  | "lte"
  | "5g_nr";

export type EncryptionType =
  | "open"
  | "wep"
  | "wpa"
  | "wpa2"
  | "wpa3"
  | "wpa2_enterprise"
  | "wpa3_enterprise";

export type AntennaType =
  | "internal"
  | "external_omni"
  | "external_directional"
  | "sector_120"
  | "sector_90"
  | "sector_60"
  | "parabolic"
  | "yagi"
  | "panel";

// ============================================================================
// Access Point
// ============================================================================

export interface AccessPoint {
  id: string;
  name: string;
  type: AccessPointType;
  status: AccessPointStatus;
  coordinates: Coordinates;

  // Radio Configuration
  frequency_band: FrequencyBand;
  channel: number;
  channel_width_mhz: number;
  wireless_standard: WirelessStandard;
  tx_power_dbm: number;
  max_tx_power_dbm: number;

  // Antenna Configuration
  antenna_type: AntennaType;
  antenna_gain_dbi?: number;
  antenna_azimuth_degrees?: number; // 0-360, where 0 is North
  antenna_elevation_degrees?: number; // -90 to +90
  antenna_beamwidth_degrees?: number;
  antenna_height_meters: number;

  // SSIDs
  ssids: SSID[];

  // Network Configuration
  ip_address?: string;
  mac_address?: string;
  management_vlan?: number;

  // Capacity & Performance
  max_clients: number;
  connected_clients: number;
  bandwidth_capacity_mbps: number;
  current_throughput_mbps: number;

  // Health Metrics
  cpu_usage_percent?: number;
  memory_usage_percent?: number;
  uptime_seconds?: number;
  noise_floor_dbm?: number;
  interference_level?: "low" | "medium" | "high";

  // Coverage
  coverage_radius_meters?: number;
  coverage_zone_id?: string;

  // Equipment Details
  vendor?: string;
  model?: string;
  serial_number?: string;
  firmware_version?: string;
  installation_date?: string;
  last_reboot?: string;

  // Location Details
  site_name?: string;
  address?: string;
  floor_level?: number;
  mounting_type?: "ceiling" | "wall" | "pole" | "tower" | "rooftop";

  // Backhaul
  backhaul_type?: "ethernet" | "fiber" | "wireless" | "microwave";
  backhaul_capacity_mbps?: number;

  created_at: string;
  updated_at: string;
}

// ============================================================================
// SSID Configuration
// ============================================================================

export interface SSID {
  id: string;
  ssid_name: string;
  enabled: boolean;
  hidden: boolean;
  encryption: EncryptionType;
  vlan_id?: number;

  // Client Limits
  max_clients?: number;
  connected_clients: number;

  // Bandwidth Management
  rate_limit_download_mbps?: number;
  rate_limit_upload_mbps?: number;

  // Authentication
  authentication_server?: string;
  radius_enabled?: boolean;

  // Usage
  purpose?: "public" | "private" | "guest" | "iot" | "backhaul" | "management";
  service_type?: "residential" | "commercial" | "hotspot";

  created_at: string;
  updated_at: string;
}

// ============================================================================
// Wireless Client
// ============================================================================

export interface WirelessClient {
  id: string;
  mac_address: string;
  ip_address?: string;
  hostname?: string;

  // Connection Details
  access_point_id: string;
  access_point_name: string;
  ssid_id: string;
  ssid_name: string;

  // Signal Quality
  rssi_dbm: number; // Received Signal Strength Indicator
  snr_db?: number; // Signal-to-Noise Ratio
  signal_quality_percent: number;

  // Connection Info
  connected_at: string;
  connection_duration_seconds: number;
  last_seen: string;

  // Data Usage
  bytes_sent: number;
  bytes_received: number;
  packets_sent: number;
  packets_received: number;

  // Performance
  tx_rate_mbps: number;
  rx_rate_mbps: number;

  // Radio Details
  frequency_band: FrequencyBand;
  channel: number;
  wireless_standard: WirelessStandard;

  // Client Classification
  device_type?: "smartphone" | "tablet" | "laptop" | "desktop" | "iot" | "camera" | "unknown";
  os_type?: string;

  // Customer Association
  customer_id?: string;
  customer_name?: string;

  created_at: string;
  updated_at: string;
}

// ============================================================================
// Coverage Zone
// ============================================================================

export interface CoverageZone {
  id: string;
  name: string;
  type: "predicted" | "measured" | "planned";

  // Geographic Boundary
  boundary: GeoPath; // Polygon boundary
  center: Coordinates;
  area_square_meters?: number;

  // Coverage Quality
  coverage_level: "excellent" | "good" | "fair" | "poor" | "none";
  min_signal_dbm: number;
  max_signal_dbm: number;
  avg_signal_dbm: number;

  // Signal Strength Zones (heat map data)
  signal_zones?: SignalZone[];

  // Access Points Serving This Zone
  access_points: string[]; // AP IDs
  primary_ap_id?: string;

  // Usage Statistics
  active_clients?: number;
  peak_clients?: number;
  avg_throughput_mbps?: number;

  // Environment
  environment_type?: "urban" | "suburban" | "rural" | "indoor" | "dense_urban";
  interference_sources?: string[];

  created_at: string;
  updated_at: string;
}

// ============================================================================
// Signal Zone (for heat maps)
// ============================================================================

export interface SignalZone {
  id: string;
  boundary: GeoPath;
  signal_strength_dbm: number;
  signal_quality: "excellent" | "good" | "fair" | "poor";
  color: string; // Hex color for visualization
}

// ============================================================================
// RF Analytics
// ============================================================================

export interface RFAnalytics {
  id: string;
  access_point_id: string;
  access_point_name: string;
  timestamp: string;

  // Spectrum Analysis
  frequency_band: FrequencyBand;
  channel: number;
  channel_utilization_percent: number;

  // Interference
  noise_floor_dbm: number;
  interference_level: number; // 0-100
  interference_sources?: InterferenceSource[];

  // Channel Quality
  channel_quality_score: number; // 0-100
  recommended_channel?: number;

  // Adjacent AP Detection
  neighboring_aps: NeighboringAP[];
  co_channel_interference_count: number;
  adjacent_channel_interference_count: number;

  // Performance Metrics
  retry_rate_percent: number;
  error_rate_percent: number;
  airtime_utilization_percent: number;

  created_at: string;
}

export interface InterferenceSource {
  type: "bluetooth" | "microwave" | "wireless_camera" | "radar" | "other_wifi" | "unknown";
  frequency_mhz: number;
  strength_dbm: number;
  description?: string;
}

export interface NeighboringAP {
  ssid: string;
  bssid: string; // MAC address
  channel: number;
  rssi_dbm: number;
  frequency_band: FrequencyBand;
  is_managed: boolean; // Whether it's one of our APs
}

// ============================================================================
// Site Survey
// ============================================================================

export interface SiteSurvey {
  id: string;
  name: string;
  status: "planned" | "in_progress" | "completed" | "cancelled";

  // Survey Area
  survey_area: GeoPath;
  center: Coordinates;

  // Measurements
  measurement_points: MeasurementPoint[];

  // Coverage Analysis
  coverage_percentage: number;
  avg_signal_strength_dbm: number;
  dead_zones?: GeoPath[];

  // Recommendations
  recommended_ap_locations?: RecommendedAPLocation[];

  // Survey Details
  surveyed_by?: string;
  survey_date?: string;
  equipment_used?: string;
  notes?: string;

  created_at: string;
  updated_at: string;
}

export interface MeasurementPoint {
  id: string;
  coordinates: Coordinates;
  rssi_dbm: number;
  snr_db?: number;
  throughput_mbps?: number;
  packet_loss_percent?: number;
  latency_ms?: number;
  access_point_id?: string;
  timestamp: string;
}

export interface RecommendedAPLocation {
  id: string;
  coordinates: Coordinates;
  antenna_height_meters: number;
  antenna_azimuth_degrees?: number;
  antenna_type: AntennaType;
  tx_power_dbm: number;
  predicted_coverage_radius_meters: number;
  reasoning: string;
}

// ============================================================================
// Wireless Infrastructure Statistics
// ============================================================================

export interface WirelessInfrastructureStats {
  total_access_points: number;
  online_aps: number;
  offline_aps: number;
  degraded_aps: number;

  total_ssids: number;
  active_ssids: number;

  total_connected_clients: number;
  total_bandwidth_capacity_mbps: number;
  current_throughput_mbps: number;
  bandwidth_utilization_percent: number;

  coverage_area_square_km: number;
  coverage_percentage: number;

  avg_signal_strength_dbm: number;
  avg_interference_level: number;

  aps_by_type: Record<AccessPointType, number>;
  aps_by_status: Record<AccessPointStatus, number>;
  aps_by_band: Record<FrequencyBand, number>;
  clients_by_band: Record<FrequencyBand, number>;
}

// ============================================================================
// Map Layer Configuration
// ============================================================================

export interface MapLayer {
  id: string;
  name: string;
  type:
    | "access_points"
    | "coverage_zones"
    | "signal_heat_map"
    | "clients"
    | "interference"
    | "site_survey";
  visible: boolean;
  color?: string;
  opacity?: number;
  icon?: string;
}

export interface MapViewState {
  center: Coordinates;
  zoom: number;
  layers: MapLayer[];
  selectedFeatures: {
    type: "access_point" | "coverage_zone" | "client" | "measurement_point";
    id: string;
  }[];
}

// ============================================================================
// API Response Types
// ============================================================================

export interface AccessPointsResponse {
  access_points: AccessPoint[];
  total: number;
  page: number;
  page_size: number;
}

export interface WirelessClientsResponse {
  clients: WirelessClient[];
  total: number;
  page: number;
  page_size: number;
}

export interface CoverageZonesResponse {
  coverage_zones: CoverageZone[];
  total: number;
  page: number;
  page_size: number;
}

export interface RFAnalyticsResponse {
  analytics: RFAnalytics[];
  total: number;
  page: number;
  page_size: number;
}

export interface SiteSurveysResponse {
  site_surveys: SiteSurvey[];
  total: number;
  page: number;
  page_size: number;
}

// ============================================================================
// Create/Update Request Types
// ============================================================================

export interface CreateAccessPointRequest {
  name: string;
  type: AccessPointType;
  coordinates: Coordinates;
  frequency_band: FrequencyBand;
  channel: number;
  channel_width_mhz: number;
  wireless_standard: WirelessStandard;
  tx_power_dbm: number;
  antenna_type: AntennaType;
  antenna_height_meters: number;
  antenna_azimuth_degrees?: number;
  antenna_elevation_degrees?: number;
  max_clients: number;
  vendor?: string;
  model?: string;
  serial_number?: string;
  site_name?: string;
  address?: string;
}

export interface UpdateAccessPointRequest {
  name?: string;
  status?: AccessPointStatus;
  channel?: number;
  tx_power_dbm?: number;
  antenna_azimuth_degrees?: number;
  antenna_elevation_degrees?: number;
}

export interface CreateSSIDRequest {
  access_point_id: string;
  ssid_name: string;
  encryption: EncryptionType;
  vlan_id?: number;
  max_clients?: number;
  rate_limit_download_mbps?: number;
  rate_limit_upload_mbps?: number;
  purpose?: SSID["purpose"];
}

export interface CreateCoverageZoneRequest {
  name: string;
  type: CoverageZone["type"];
  boundary: Coordinates[];
  coverage_level: CoverageZone["coverage_level"];
  min_signal_dbm: number;
  max_signal_dbm: number;
  avg_signal_dbm: number;
  access_points: string[];
}

export interface CreateSiteSurveyRequest {
  name: string;
  survey_area: Coordinates[];
  surveyed_by?: string;
  survey_date?: string;
  notes?: string;
}
