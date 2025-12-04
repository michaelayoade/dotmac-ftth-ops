/**
 * Audit Logging Types
 *
 * Type definitions for audit trail and activity tracking.
 */

export enum ActivityType {
  // Auth activities
  USER_LOGIN = "user.login",
  USER_LOGOUT = "user.logout",
  USER_CREATED = "user.created",
  USER_UPDATED = "user.updated",
  USER_DELETED = "user.deleted",
  USER_IMPERSONATION = "user.impersonation",
  PASSWORD_RESET_ADMIN = "user.password_reset_admin",

  // RBAC activities
  ROLE_CREATED = "rbac.role.created",
  ROLE_UPDATED = "rbac.role.updated",
  ROLE_DELETED = "rbac.role.deleted",
  ROLE_ASSIGNED = "rbac.role.assigned",
  ROLE_REVOKED = "rbac.role.revoked",
  PERMISSION_GRANTED = "rbac.permission.granted",
  PERMISSION_REVOKED = "rbac.permission.revoked",
  PERMISSION_CREATED = "rbac.permission.created",
  PERMISSION_UPDATED = "rbac.permission.updated",
  PERMISSION_DELETED = "rbac.permission.deleted",

  // Secret activities
  SECRET_CREATED = "secret.created",
  SECRET_ACCESSED = "secret.accessed",
  SECRET_UPDATED = "secret.updated",
  SECRET_DELETED = "secret.deleted",

  // File activities
  FILE_UPLOADED = "file.uploaded",
  FILE_DOWNLOADED = "file.downloaded",
  FILE_DELETED = "file.deleted",

  // Customer activities
  CUSTOMER_STATUS_CHANGE = "customer.status_change",

  // API activities
  API_REQUEST = "api.request",
  API_ERROR = "api.error",

  // System activities
  SYSTEM_STARTUP = "system.startup",
  SYSTEM_SHUTDOWN = "system.shutdown",

  // Frontend activities
  FRONTEND_LOG = "frontend.log",
}

export enum ActivitySeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export interface AuditActivity {
  id: string;
  activity_type: ActivityType | string;
  severity: ActivitySeverity;
  user_id: string | null;
  tenant_id: string;
  timestamp: string;
  resource_type: string | null;
  resource_id: string | null;
  action: string;
  description: string;
  details: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
}

export interface AuditActivityList {
  activities: AuditActivity[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface AuditFilterParams {
  user_id?: string;
  activity_type?: ActivityType | string;
  severity?: ActivitySeverity;
  resource_type?: string;
  resource_id?: string;
  days?: number;
  page?: number;
  per_page?: number;
}

export interface ActivitySummary {
  total_activities: number;
  by_severity: Record<ActivitySeverity, number>;
  by_type: Record<string, number>;
  by_user: Array<{ user_id: string; count: number }>;
  recent_critical: AuditActivity[];
  timeline: Array<{ date: string; count: number }>;
}

// Severity colors for UI
export const SEVERITY_COLORS: Record<ActivitySeverity, string> = {
  [ActivitySeverity.LOW]: "bg-green-100 text-green-800 border-green-200",
  [ActivitySeverity.MEDIUM]: "bg-yellow-100 text-yellow-800 border-yellow-200",
  [ActivitySeverity.HIGH]: "bg-orange-100 text-orange-800 border-orange-200",
  [ActivitySeverity.CRITICAL]: "bg-red-100 text-red-800 border-red-200",
};

// Activity type categories for grouping
export const ACTIVITY_CATEGORIES: Record<string, ActivityType[]> = {
  Authentication: [
    ActivityType.USER_LOGIN,
    ActivityType.USER_LOGOUT,
    ActivityType.USER_IMPERSONATION,
  ],
  "User Management": [
    ActivityType.USER_CREATED,
    ActivityType.USER_UPDATED,
    ActivityType.USER_DELETED,
    ActivityType.PASSWORD_RESET_ADMIN,
  ],
  "Access Control": [
    ActivityType.ROLE_CREATED,
    ActivityType.ROLE_UPDATED,
    ActivityType.ROLE_DELETED,
    ActivityType.ROLE_ASSIGNED,
    ActivityType.ROLE_REVOKED,
    ActivityType.PERMISSION_GRANTED,
    ActivityType.PERMISSION_REVOKED,
    ActivityType.PERMISSION_CREATED,
    ActivityType.PERMISSION_UPDATED,
    ActivityType.PERMISSION_DELETED,
  ],
  Secrets: [
    ActivityType.SECRET_CREATED,
    ActivityType.SECRET_ACCESSED,
    ActivityType.SECRET_UPDATED,
    ActivityType.SECRET_DELETED,
  ],
  Files: [ActivityType.FILE_UPLOADED, ActivityType.FILE_DOWNLOADED, ActivityType.FILE_DELETED],
  System: [
    ActivityType.SYSTEM_STARTUP,
    ActivityType.SYSTEM_SHUTDOWN,
    ActivityType.API_REQUEST,
    ActivityType.API_ERROR,
  ],
};

// Format activity type for display
export function formatActivityType(type: string): string {
  return type
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" > ");
}

// Format severity for display
export function formatSeverity(severity: ActivitySeverity): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

// Get icon for activity type
export function getActivityIcon(type: string): string {
  if (type.startsWith("user.")) return "👤";
  if (type.startsWith("rbac.")) return "🔐";
  if (type.startsWith("secret.")) return "🔑";
  if (type.startsWith("file.")) return "📁";
  if (type.startsWith("customer.")) return "🏢";
  if (type.startsWith("api.")) return "🔌";
  if (type.startsWith("system.")) return "⚙️";
  if (type.startsWith("frontend.")) return "💻";
  return "📝";
}
