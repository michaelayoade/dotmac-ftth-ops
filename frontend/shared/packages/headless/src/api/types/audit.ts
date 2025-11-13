/**
 * TypeScript types for Audit API integration
 * Mirrors backend audit system types for consistent typing
 */

export interface AuditEvent {
  event_id: string;
  event_type: AuditEventType;
  timestamp: number;
  service_name: string;
  tenant_id?: string;

  // Event details
  message: string;
  severity: AuditSeverity;
  outcome: AuditOutcome;

  // Actor information
  actor: AuditActor;

  // Resource information
  resource?: AuditResource;

  // Context and metadata
  context: AuditContext;
  metadata?: Record<string, any>;

  // Risk and compliance
  risk_score?: number;
  compliance_frameworks?: string[];

  // Technical details
  before_state?: Record<string, any>;
  after_state?: Record<string, any>;
  duration_ms?: number;

  // Tags for categorization
  tags?: string[];
}

export enum AuditEventType {
  // Authentication events
  AUTH_LOGIN = "auth.login",
  AUTH_LOGOUT = "auth.logout",
  AUTH_LOGIN_FAILED = "auth.login_failed",
  AUTH_TOKEN_REFRESH = "auth.token_refresh",
  AUTH_PASSWORD_CHANGE = "auth.password_change",
  AUTH_MFA_SETUP = "auth.mfa_setup",
  AUTH_MFA_SUCCESS = "auth.mfa_success",
  AUTH_MFA_FAILURE = "auth.mfa_failure",

  // Authorization events
  AUTHZ_PERMISSION_GRANTED = "authz.permission_granted",
  AUTHZ_PERMISSION_DENIED = "authz.permission_denied",
  AUTHZ_ROLE_ASSIGNED = "authz.role_assigned",
  AUTHZ_ROLE_REMOVED = "authz.role_removed",

  // Data access events
  DATA_CREATE = "data.create",
  DATA_READ = "data.read",
  DATA_UPDATE = "data.update",
  DATA_DELETE = "data.delete",
  DATA_EXPORT = "data.export",
  DATA_IMPORT = "data.import",

  // System events
  SYSTEM_STARTUP = "system.startup",
  SYSTEM_SHUTDOWN = "system.shutdown",
  SYSTEM_ERROR = "system.error",
  SYSTEM_CONFIG_CHANGE = "system.config_change",

  // Business events
  BUSINESS_TRANSACTION = "business.transaction",
  BUSINESS_WORKFLOW_START = "business.workflow_start",
  BUSINESS_WORKFLOW_COMPLETE = "business.workflow_complete",
  BUSINESS_APPROVAL_REQUEST = "business.approval_request",

  // Security events
  SECURITY_INTRUSION_DETECTED = "security.intrusion_detected",
  SECURITY_VULNERABILITY_FOUND = "security.vulnerability_found",
  SECURITY_POLICY_VIOLATION = "security.policy_violation",
  SECURITY_RATE_LIMIT_EXCEEDED = "security.rate_limit_exceeded",
}

export enum AuditSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum AuditOutcome {
  SUCCESS = "success",
  FAILURE = "failure",
  PARTIAL = "partial",
}

export interface AuditActor {
  id: string;
  type: "user" | "service" | "system" | "anonymous";
  name?: string;
  email?: string;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
}

export interface AuditResource {
  id: string;
  type: string;
  name?: string;
  attributes?: Record<string, any>;
}

export interface AuditContext {
  source: string;
  correlation_id?: string;
  request_id?: string;
  trace_id?: string;
  parent_event_id?: string;
  environment: string;
  additional?: Record<string, any>;
}

export interface AuditEventQuery {
  start_time?: number;
  end_time?: number;
  event_types?: string[];
  severities?: string[];
  outcomes?: string[];
  actor_ids?: string[];
  resource_types?: string[];
  tenant_id?: string;
  search?: string;
  tags?: string[];
  compliance_frameworks?: string[];
  min_risk_score?: number;
  max_risk_score?: number;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface AuditEventResponse {
  events: AuditEvent[];
  total: number;
  has_more: boolean;
  query_time_ms: number;
}

export interface AuditHealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  storage_healthy: boolean;
  api_healthy: boolean;
  last_event_time: number;
  event_count: number;
  checks: Record<string, boolean>;
}

export interface AuditStreamEvent {
  type: "event" | "error" | "heartbeat";
  data: AuditEvent | { error: string } | { timestamp: number };
}

export interface AuditExportOptions {
  format: "json" | "csv";
  filename?: string;
  include_metadata?: boolean;
  date_format?: string;
}

// Frontend-specific audit event types
export enum FrontendAuditEventType {
  UI_PAGE_VIEW = "ui.page_view",
  UI_BUTTON_CLICK = "ui.button_click",
  UI_FORM_SUBMIT = "ui.form_submit",
  UI_ERROR_DISPLAYED = "ui.error_displayed",
  UI_SESSION_START = "ui.session_start",
  UI_SESSION_END = "ui.session_end",
  UI_FEATURE_USED = "ui.feature_used",
  UI_PERFORMANCE_ISSUE = "ui.performance_issue",
}

// Utility type for creating frontend audit events
export type CreateFrontendAuditEvent = Omit<
  AuditEvent,
  "event_id" | "timestamp" | "service_name" | "event_type"
> & {
  event_type: AuditEventType | FrontendAuditEventType;
  service_name?: string;
};
