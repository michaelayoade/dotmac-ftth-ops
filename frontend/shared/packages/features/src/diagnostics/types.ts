/**
 * Diagnostics Types
 *
 * TypeScript interfaces for network diagnostics and troubleshooting.
 * Shared between ISP Ops and Platform Admin applications.
 */

// ============================================================================
// Enums
// ============================================================================

export enum DiagnosticType {
  // Connectivity checks
  CONNECTIVITY_CHECK = "connectivity_check",
  PING_TEST = "ping_test",
  TRACEROUTE = "traceroute",

  // Service-specific checks
  RADIUS_SESSION = "radius_session",
  ONU_STATUS = "onu_status",
  CPE_STATUS = "cpe_status",
  IP_VERIFICATION = "ip_verification",

  // Performance tests
  BANDWIDTH_TEST = "bandwidth_test",
  LATENCY_TEST = "latency_test",
  PACKET_LOSS_TEST = "packet_loss_test",

  // Device operations
  CPE_RESTART = "cpe_restart",
  ONU_REBOOT = "onu_reboot",

  // Comprehensive checks
  HEALTH_CHECK = "health_check",
  SERVICE_PATH_TRACE = "service_path_trace",
}

export enum DiagnosticStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  TIMEOUT = "timeout",
}

export enum DiagnosticSeverity {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
}

// ============================================================================
// Models
// ============================================================================

export interface DiagnosticRecommendation {
  severity: string;
  message: string;
  action: string;
}

export interface DiagnosticRun {
  id: string;
  tenant_id: string;
  diagnostic_type: DiagnosticType;
  status: DiagnosticStatus;
  severity?: DiagnosticSeverity;
  subscriber_id?: string;
  customer_id?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  success: boolean;
  summary?: string;
  error_message?: string;
  results: Record<string, any>;
  recommendations: DiagnosticRecommendation[];
  diagnostic_metadata: Record<string, any>;
  created_at: string;
}

export interface DiagnosticRunListResponse {
  total: number;
  items: DiagnosticRun[];
  limit: number;
  offset: number;
}

// ============================================================================
// Specific Diagnostic Results
// ============================================================================

export interface ConnectivityCheckResults {
  subscriber_status: string;
  username: string;
  status: "online" | "inactive";
  checks: {
    subscriber_active: boolean;
    radius_auth: boolean;
    ip_allocated: boolean;
  };
  ip_address?: string;
  last_seen_seconds?: number;
  last_seen_hours?: number;
}

export interface RadiusSessionResults {
  username: string;
  active_sessions: number;
  sessions: any[];
  simultaneous_use_limit: number;
}

export interface ONUStatusResults {
  onu_serial: string;
  onu_status: string;
  optical_signal_level?: number;
  firmware_version?: string;
  registration_id?: string;
  operational_state?: string;
}

export interface CPEStatusResults {
  cpe_mac: string;
  status: string;
  last_inform?: string;
  last_inform_seconds?: number;
  firmware_version?: string;
  model?: string;
  uptime?: number;
  wan_ip?: string;
  wifi_enabled?: boolean;
}

export interface IPVerificationResults {
  subscriber_ip?: string;
  subscriber_ipv6?: string;
  netbox_ip?: string;
  netbox_status?: string;
  netbox_vrf?: any;
}

export interface CPERestartResults {
  cpe_mac: string;
  reboot_initiated: boolean;
  task_id?: string;
}

export interface HealthCheckResults {
  checks: {
    connectivity?: {
      status: string;
      summary?: string;
      severity?: string;
    };
    radius?: {
      status: string;
      summary?: string;
      severity?: string;
    };
    onu?: {
      status: string;
      summary?: string;
      severity?: string;
    };
    cpe?: {
      status: string;
      summary?: string;
      severity?: string;
    };
    ip?: {
      status: string;
      summary?: string;
      severity?: string;
    };
  };
  total_checks: number;
  checks_passed: number;
  checks_failed: number;
  checks_skipped: number;
  overall_health: "healthy" | "degraded" | "unhealthy";
}

// ============================================================================
// Request Parameters
// ============================================================================

export interface RunDiagnosticParams {
  subscriber_id: string;
}

export interface ListDiagnosticRunsParams {
  subscriber_id?: string;
  diagnostic_type?: DiagnosticType;
  limit?: number;
  offset?: number;
}

// ============================================================================
// UI State Types
// ============================================================================

export interface DiagnosticTool {
  type: DiagnosticType;
  name: string;
  description: string;
  icon: string;
  category: "check" | "test" | "action" | "comprehensive";
  requiresONU?: boolean;
  requiresCPE?: boolean;
}

export const DIAGNOSTIC_TOOLS: DiagnosticTool[] = [
  {
    type: DiagnosticType.CONNECTIVITY_CHECK,
    name: "Connectivity Check",
    description: "Check overall subscriber connectivity status",
    icon: "Wifi",
    category: "check",
  },
  {
    type: DiagnosticType.RADIUS_SESSION,
    name: "RADIUS Sessions",
    description: "View active RADIUS authentication sessions",
    icon: "Key",
    category: "check",
  },
  {
    type: DiagnosticType.ONU_STATUS,
    name: "ONU Status",
    description: "Check ONU optical signal and operational status",
    icon: "Radio",
    category: "check",
    requiresONU: true,
  },
  {
    type: DiagnosticType.CPE_STATUS,
    name: "CPE Status",
    description: "Check CPE online status and firmware version",
    icon: "Router",
    category: "check",
    requiresCPE: true,
  },
  {
    type: DiagnosticType.IP_VERIFICATION,
    name: "IP Verification",
    description: "Verify IP allocation consistency with NetBox",
    icon: "Globe",
    category: "check",
  },
  {
    type: DiagnosticType.CPE_RESTART,
    name: "Restart CPE",
    description: "Trigger CPE device restart remotely",
    icon: "RotateCw",
    category: "action",
    requiresCPE: true,
  },
  {
    type: DiagnosticType.HEALTH_CHECK,
    name: "Comprehensive Health Check",
    description: "Run all diagnostic checks and provide overall assessment",
    icon: "Activity",
    category: "comprehensive",
  },
];
