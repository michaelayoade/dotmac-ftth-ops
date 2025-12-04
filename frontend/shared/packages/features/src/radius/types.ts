/**
 * Shared RADIUS types for monitoring and management
 */

// NAS Device types
export interface NASDevice {
  id?: number;
  tenant_id?: string;
  nasname: string;
  shortname: string;
  type: string;
  secret?: string;
  secret_configured?: boolean;
  ports?: number | null;
  server?: string | null;
  community?: string | null;
  description?: string | null;
  vendor?: string | null;
  model?: string | null;
  firmware_version?: string | null;
}

export const NAS_TYPES = [
  "other",
  "router",
  "olt",
  "wireless",
  "switch",
  "vpn",
  "access-point",
] as const;

export const NAS_VENDORS = [
  { value: "mikrotik", label: "Mikrotik" },
  { value: "cisco", label: "Cisco" },
  { value: "huawei", label: "Huawei" },
  { value: "juniper", label: "Juniper" },
  { value: "zte", label: "ZTE" },
  { value: "generic", label: "Generic" },
] as const;

// Bandwidth Profile types
export interface BandwidthProfile {
  id?: string;
  tenant_id?: string;
  name: string;
  download_rate: number;
  upload_rate: number;
  download_burst?: number | null;
  upload_burst?: number | null;
  created_at?: string;
  updated_at?: string;
}

// RADIUS Session types
export interface RADIUSSession {
  radacctid: number;
  tenant_id?: string;
  subscriber_id?: string | null;
  username: string;
  acctsessionid: string;
  nasipaddress: string;
  nasportid?: string | null;
  nasporttype?: string | null;
  framedipaddress?: string | null;
  framedipv6address?: string | null;
  framedipv6prefix?: string | null;
  acctstarttime?: string | null;
  acctupdatetime?: string | null;
  acctstoptime?: string | null;
  acctsessiontime?: number | null;
  acctinputoctets?: number | null;
  acctoutputoctets?: number | null;
  total_bytes: number;
  is_active: boolean;
  calledstationid?: string | null;
  callingstationid?: string | null;
  acctterminatecause?: string | null;
}

// RADIUS Statistics types
export interface RADIUSStats {
  active_sessions: number;
  total_nas_devices: number;
  bandwidth_profiles: number;
  total_subscribers: number;
}

// Session disconnect request
export interface SessionDisconnectRequest {
  username: string;
  acctsessionid: string;
  nasipaddress: string;
}

// Form data types for dialogs
export interface NASDeviceFormData {
  nasname: string;
  shortname: string;
  type: string;
  secret?: string;
  ports?: number | null;
  server?: string | null;
  community?: string | null;
  description?: string | null;
  vendor?: string | null;
  model?: string | null;
  firmware_version?: string | null;
}

export interface BandwidthProfileFormData {
  name: string;
  download_rate: string;
  upload_rate: string;
  download_burst?: string;
  upload_burst?: string;
  rateUnit: "Kbps" | "Mbps" | "Gbps";
}
