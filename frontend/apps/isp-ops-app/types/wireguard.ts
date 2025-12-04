/**
 * TypeScript type definitions for WireGuard VPN Management
 *
 * These types match the backend Pydantic schemas and SQLAlchemy models.
 */

// ============================================================================
// Enums
// ============================================================================

export enum WireGuardServerStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  DEGRADED = "degraded",
  MAINTENANCE = "maintenance",
}

export enum WireGuardPeerStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  DISABLED = "disabled",
  EXPIRED = "expired",
}

// ============================================================================
// Base Models
// ============================================================================

export interface WireGuardServer {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;

  // Identification
  name: string;
  description: string | null;

  // Network Configuration
  public_endpoint: string;
  listen_port: number;
  server_ipv4: string;
  server_ipv6: string | null;

  // WireGuard Keys
  public_key: string;
  private_key_encrypted: string;

  // Status
  status: WireGuardServerStatus;

  // Peer Capacity
  max_peers: number;
  current_peers: number;
  next_peer_ip_offset: number;

  // DNS & Routing
  dns_servers: string[];
  allowed_ips: string[];
  persistent_keepalive: number;

  // Location & Metadata
  location: string | null;
  metadata_: Record<string, unknown>;

  // Traffic Statistics
  total_rx_bytes: number;
  total_tx_bytes: number;
  last_stats_update: string | null;

  // Computed Properties
  is_active: boolean;
  has_capacity: boolean;
  utilization_percent: number;
}

export interface WireGuardPeer {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;

  // Relationships
  server_id: string;
  customer_id: string | null;
  subscriber_id: string | null;

  // Identification
  name: string;
  peer_name?: string; // Alias for name
  description: string | null;

  // WireGuard Keys
  public_key: string;
  preshared_key_encrypted: string | null;

  // Network Allocation
  peer_ipv4: string;
  peer_ip?: string; // Alias for peer_ipv4
  peer_ipv6: string | null;
  allowed_ips: string[];

  // Status
  status: WireGuardPeerStatus;
  enabled: boolean;

  // Connection Tracking
  last_handshake: string | null;
  endpoint: string | null;
  persistent_keepalive?: number; // WireGuard keepalive setting

  // Traffic Statistics
  rx_bytes: number;
  tx_bytes: number;
  last_stats_update: string | null;

  // Expiration
  expires_at: string | null;
  expiration_date?: string | null; // Alias for expires_at

  // Configuration & Notes
  config_file: string | null;
  metadata_: Record<string, unknown>;
  notes: string | null;

  // Computed Properties
  is_active: boolean;
  is_expired: boolean;
  is_online: boolean;
  total_bytes: number;
}

// ============================================================================
// Create/Update DTOs
// ============================================================================

// Type aliases for compatibility
export type CreateWireGuardPeerRequest = WireGuardPeerCreate;
export type UpdateWireGuardPeerRequest = WireGuardPeerUpdate;
export type VPNProvisionRequest = WireGuardServiceProvisionRequest;

export interface WireGuardServerCreate {
  name: string;
  description?: string | null;
  public_endpoint: string;
  listen_port?: number;
  server_ipv4: string;
  server_ipv6?: string | null;
  location?: string | null;
  max_peers?: number;
  dns_servers?: string[];
  allowed_ips?: string[];
  persistent_keepalive?: number;
  metadata?: Record<string, unknown>;
}

export interface WireGuardServerUpdate {
  name?: string;
  description?: string | null;
  public_endpoint?: string;
  status?: WireGuardServerStatus;
  max_peers?: number;
  dns_servers?: string[];
  allowed_ips?: string[];
  persistent_keepalive?: number;
  location?: string | null;
  metadata?: Record<string, unknown>;
}

export interface WireGuardPeerCreate {
  server_id: string;
  name: string;
  peer_name?: string | undefined; // Alias for name
  description?: string | null | undefined;
  customer_id?: string | null | undefined;
  subscriber_id?: string | null | undefined;
  generate_keys?: boolean | undefined;
  public_key?: string | undefined;
  peer_ipv4?: string | undefined;
  peer_ipv6?: string | null | undefined;
  allowed_ips?: (string | string[]) | undefined; // Accept both string (form input) and string[] (array)
  persistent_keepalive?: number | undefined; // WireGuard keepalive setting
  expires_at?: string | null | undefined;
  expiration_date?: string | null | undefined; // Alias for expires_at
  metadata?: Record<string, unknown> | undefined;
  notes?: string | null | undefined;
}

export interface WireGuardPeerUpdate {
  peerId?: string | undefined; // For update operations
  id?: string | undefined; // Alternative for peerId
  name?: string | undefined;
  peer_name?: string | undefined; // Alias for name
  description?: string | null | undefined;
  enabled?: boolean | undefined;
  status?: WireGuardPeerStatus | undefined;
  allowed_ips?: (string | string[]) | undefined; // Accept both string (form input) and string[] (array)
  persistent_keepalive?: number | undefined; // WireGuard keepalive setting
  expires_at?: string | null | undefined;
  expiration_date?: string | null | undefined; // Alias for expires_at
  metadata?: Record<string, unknown> | undefined;
  notes?: string | null | undefined;
}

// ============================================================================
// Response Types
// ============================================================================

export interface WireGuardPeerConfigResponse {
  peer_id: string;
  peer_name: string;
  config_file: string;
  created_at: string;
}

export interface WireGuardPeerQRCodeResponse {
  peer_id: string;
  peer_name: string;
  qr_code: string; // Base64 encoded PNG
  created_at: string;
}

export interface WireGuardServerHealthResponse {
  server_id: string;
  status: "healthy" | "degraded" | "unhealthy";
  is_active: boolean;
  interface_status: string;
  active_peers: number;
  capacity_utilization: number;
  last_stats_update: string | null;
  issues: string[];
  timestamp: string;
}

export interface WireGuardDashboardStatsResponse {
  servers: {
    total: number;
    by_status: Record<WireGuardServerStatus, number>;
  };
  peers: {
    total: number;
    by_status: Record<WireGuardPeerStatus, number>;
    online: number;
    offline: number;
  };
  traffic: {
    total_rx_bytes: number;
    total_tx_bytes: number;
    total_bytes: number;
  };
  timestamp: string;
}

export interface WireGuardBulkPeerCreateRequest {
  server_id: string;
  count: number;
  name_prefix: string;
  customer_id?: string | null;
  subscriber_id?: string | null;
  generate_keys?: boolean;
  allowed_ips?: string[];
  expires_at?: string | null;
  metadata?: Record<string, unknown>;
}

export interface WireGuardBulkPeerCreateResponse {
  created: number;
  failed: number;
  peers: WireGuardPeer[];
  errors: Array<{
    index: number;
    error: string;
  }>;
}

export interface WireGuardSyncStatsRequest {
  server_id: string;
}

export interface WireGuardSyncStatsResponse {
  server_id: string;
  peers_updated: number;
  timestamp: string;
}

export interface WireGuardServiceProvisionRequest {
  customer_id: string;
  subscriber_id?: string | null;
  peer_name: string;
  peer_name_prefix?: string; // Optional peer name prefix for bulk provisioning
  description?: string | null;
  allowed_ips?: string | string[]; // Accept both string (form input) and string[] (array)
  expires_at?: string | null;
  server_location?: string; // Optional server location
  listen_port?: number; // Optional listen port
  subnet?: string; // Optional subnet configuration
  dns_servers?: string | string[]; // Accept both string (form input) and string[] (array)
  initial_peer_count?: number; // Optional initial peer count for bulk provisioning
  notes?: string | null; // Optional notes
  server_name?: string; // Optional server name
}

export interface WireGuardServiceProvisionResponse {
  server: WireGuardServer;
  peer: WireGuardPeer;
  peers?: WireGuardPeer[]; // Alias for bulk operations
  config_file: string;
  message: string;
}

// ============================================================================
// Query Parameters
// ============================================================================

export interface ListServersParams {
  status?: WireGuardServerStatus;
  location?: string;
  limit?: number;
  offset?: number;
}

export interface ListPeersParams {
  server_id?: string;
  customer_id?: string;
  subscriber_id?: string;
  status?: WireGuardPeerStatus;
  limit?: number;
  offset?: number;
}

// ============================================================================
// UI Helper Types
// ============================================================================

export interface ServerFormData extends WireGuardServerCreate {
  // Additional UI-specific fields if needed
}

export interface PeerFormData extends WireGuardPeerCreate {
  // Additional UI-specific fields if needed
}

export interface ServerCardProps {
  server: WireGuardServer;
  onEdit?: (server: WireGuardServer) => void;
  onDelete?: (serverId: string) => void;
  onViewPeers?: (serverId: string) => void;
  onCheckHealth?: (serverId: string) => void;
}

export interface PeerCardProps {
  peer: WireGuardPeer;
  onEdit?: (peer: WireGuardPeer) => void;
  onDelete?: (peerId: string) => void;
  onDownloadConfig?: (peerId: string) => void;
  onRegenerate?: (peerId: string) => void;
}

export interface DashboardStatsProps {
  stats: WireGuardDashboardStatsResponse;
  onRefresh?: () => void;
}

export interface TrafficChartData {
  label: string;
  rx_bytes: number;
  tx_bytes: number;
  total_bytes: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export type ServerStatusColor = {
  [key in WireGuardServerStatus]: string;
};

export type PeerStatusColor = {
  [key in WireGuardPeerStatus]: string;
};

export const SERVER_STATUS_COLORS: ServerStatusColor = {
  [WireGuardServerStatus.ACTIVE]: "bg-green-500",
  [WireGuardServerStatus.INACTIVE]: "bg-gray-500",
  [WireGuardServerStatus.DEGRADED]: "bg-yellow-500",
  [WireGuardServerStatus.MAINTENANCE]: "bg-blue-500",
};

export const PEER_STATUS_COLORS: PeerStatusColor = {
  [WireGuardPeerStatus.ACTIVE]: "bg-green-500",
  [WireGuardPeerStatus.INACTIVE]: "bg-gray-500",
  [WireGuardPeerStatus.DISABLED]: "bg-red-500",
  [WireGuardPeerStatus.EXPIRED]: "bg-orange-500",
};

// Helper function to format bytes
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Helper function to get time ago
export function getTimeAgo(date: string | null): string {
  if (!date) return "Never";
  const now = new Date().getTime();
  const then = new Date(date).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

// Helper function to check if handshake is recent (online status)
export function isHandshakeRecent(lastHandshake: string | null): boolean {
  if (!lastHandshake) return false;
  const now = new Date().getTime();
  const then = new Date(lastHandshake).getTime();
  const diffMinutes = (now - then) / 1000 / 60;
  return diffMinutes < 3;
}
