/**
 * Type definitions for RADIUS Management API
 */

// =============================================================================
// RADIUS Subscriber Types
// =============================================================================

export interface RADIUSSubscriberCreate {
  subscriber_id: string;
  username: string;
  password: string;
  bandwidth_profile_id?: string | null;
  framed_ip_address?: string | null;
  framed_ipv6_prefix?: string | null; // IPv6 prefix (e.g., "2001:db8::/64")
  framed_ipv6_address?: string | null; // IPv6 address (e.g., "2001:db8::1/128")
  delegated_ipv6_prefix?: string | null; // DHCPv6 PD prefix
  session_timeout?: number | null;
  idle_timeout?: number | null;
}

export interface RADIUSSubscriberUpdate {
  password?: string | null;
  bandwidth_profile_id?: string | null;
  framed_ip_address?: string | null;
  framed_ipv6_prefix?: string | null;
  framed_ipv6_address?: string | null;
  delegated_ipv6_prefix?: string | null;
  session_timeout?: number | null;
  idle_timeout?: number | null;
  enabled?: boolean | null;
}

export interface RADIUSSubscriberResponse {
  id: number;
  tenant_id: string;
  subscriber_id: string;
  username: string;
  bandwidth_profile_id?: string | null;
  framed_ip_address?: string | null;
  framed_ipv6_prefix?: string | null;
  framed_ipv6_address?: string | null;
  delegated_ipv6_prefix?: string | null;
  session_timeout?: number | null;
  idle_timeout?: number | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// RADIUS Session Types
// =============================================================================

export interface RADIUSSessionResponse {
  radacctid: number;
  tenant_id: string;
  subscriber_id?: string | null;
  username: string;
  acctsessionid: string;
  nasipaddress: string;
  framedipaddress?: string | null;
  framedipv6address?: string | null; // IPv6 address assigned in session
  framedipv6prefix?: string | null; // IPv6 prefix assigned in session
  delegatedipv6prefix?: string | null; // Delegated IPv6 prefix
  acctstarttime?: string | null;
  acctsessiontime?: number | null; // Seconds
  acctinputoctets?: number | null; // Bytes downloaded
  acctoutputoctets?: number | null; // Bytes uploaded
  total_bytes: number;
  is_active: boolean;
}

export interface RADIUSSessionDisconnect {
  username?: string | null;
  nasipaddress?: string | null;
  acctsessionid?: string | null;
}

// =============================================================================
// RADIUS Accounting Types
// =============================================================================

export interface RADIUSUsageQuery {
  subscriber_id?: string | null;
  username?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  grouping?: "day" | "week" | "month" | null;
}

export interface RADIUSUsageResponse {
  subscriber_id?: string | null;
  username?: string | null;
  total_sessions: number;
  total_session_time: number; // Seconds
  total_input_octets: number; // Bytes
  total_output_octets: number; // Bytes
  total_bytes: number;
  avg_session_duration: number; // Seconds
  first_session?: string | null;
  last_session?: string | null;
  usage_by_period?: Array<{
    period: string;
    sessions: number;
    bytes: number;
    session_time: number;
  }> | null;
}

// =============================================================================
// NAS Device Types
// =============================================================================

export interface NASCreate {
  nasname: string;
  shortname: string;
  type?: string | null;
  ports?: number | null;
  secret: string;
  server?: string | null;
  community?: string | null;
  description?: string | null;
}

export interface NASUpdate {
  nasname?: string | null;
  shortname?: string | null;
  type?: string | null;
  ports?: number | null;
  secret?: string | null;
  server?: string | null;
  community?: string | null;
  description?: string | null;
}

export interface NASResponse {
  id: number;
  tenant_id: string;
  nasname: string;
  shortname: string;
  type?: string | null;
  ports?: number | null;
  secret_configured: boolean;
  server?: string | null;
  community?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Bandwidth Profile Types
// =============================================================================

export interface BandwidthProfileCreate {
  profile_id: string;
  name: string;
  download_rate_kbps: number;
  upload_rate_kbps: number;
  download_burst_kbps?: number | null;
  upload_burst_kbps?: number | null;
  burst_threshold_kbps?: number | null;
  burst_time_seconds?: number | null;
  priority?: number | null;
  description?: string | null;
}

export interface BandwidthProfileUpdate {
  name?: string | null;
  download_rate_kbps?: number | null;
  upload_rate_kbps?: number | null;
  download_burst_kbps?: number | null;
  upload_burst_kbps?: number | null;
  burst_threshold_kbps?: number | null;
  burst_time_seconds?: number | null;
  priority?: number | null;
  description?: string | null;
}

export interface BandwidthProfileResponse {
  id: number;
  tenant_id: string;
  profile_id: string;
  name: string;
  download_rate_kbps: number;
  upload_rate_kbps: number;
  download_burst_kbps?: number | null;
  upload_burst_kbps?: number | null;
  burst_threshold_kbps?: number | null;
  burst_time_seconds?: number | null;
  priority?: number | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// RADIUS Testing Types
// =============================================================================

export interface RADIUSAuthTest {
  username: string;
  password: string;
}

export interface RADIUSAuthTestResponse {
  success: boolean;
  message: string;
  attributes?: Record<string, string> | null;
  response_time_ms: number;
}

// =============================================================================
// RADIUS Health Types
// =============================================================================

export interface RADIUSHealthResponse {
  timestamp: number;
  status: "healthy" | "degraded" | "unhealthy";
  checks: {
    radius_connectivity?: {
      status: string;
      message: string;
    };
    database?: {
      status: string;
      message: string;
      active_sessions?: number;
    };
    nas_devices?: {
      status: string;
      count?: number;
      message?: string;
    };
    authentication?: {
      status: string;
      recent_failures?: number;
      window_minutes?: number;
      message?: string;
    };
  };
}

// =============================================================================
// RADIUS Attribute Types
// =============================================================================

export interface RADIUSAttribute {
  id: number;
  name: string;
  type: string;
  description?: string | null;
  check_item?: boolean;
  reply_item?: boolean;
}

export interface RADIUSAttributeList {
  attributes: RADIUSAttribute[];
  total: number;
  vendor_id?: number | null;
}
