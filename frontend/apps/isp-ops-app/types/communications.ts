/**
 * Communications Module Type Definitions
 *
 * Type-safe interfaces for email/SMS communications, templates, and campaigns.
 * Matches backend schemas from src/dotmac/platform/communications/
 */

// ==================== Enums ====================

/**
 * Communication channel types
 */
export enum CommunicationChannel {
  EMAIL = "email",
  SMS = "sms",
  PUSH = "push",
  IN_APP = "in_app",
}

/**
 * Communication status
 */
export enum CommunicationStatus {
  PENDING = "pending",
  QUEUED = "queued",
  SENDING = "sending",
  SENT = "sent",
  DELIVERED = "delivered",
  FAILED = "failed",
  BOUNCED = "bounced",
  OPENED = "opened",
  CLICKED = "clicked",
}

/**
 * Template variable types
 */
export enum TemplateVariableType {
  STRING = "string",
  NUMBER = "number",
  BOOLEAN = "boolean",
  DATE = "date",
  URL = "url",
  EMAIL = "email",
}

/**
 * Bulk operation status
 */
export enum BulkOperationStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

// ==================== Base Types ====================

/**
 * Email recipient
 */
export interface EmailRecipient {
  email: string;
  name?: string;
  variables?: Record<string, any>;
}

/**
 * Email attachment
 */
export interface EmailAttachment {
  filename: string;
  content: string; // base64 encoded
  content_type?: string;
}

/**
 * Template variable definition
 */
export interface TemplateVariable {
  name: string;
  type: TemplateVariableType;
  description?: string;
  required?: boolean;
  default_value?: any;
  example?: string;
}

// ==================== Request Schemas ====================

/**
 * Send immediate email request
 * POST /api/v1/communications/email/send
 */
export interface SendEmailRequest {
  to: EmailRecipient[];
  subject: string;
  body_html?: string;
  body_text?: string;
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  reply_to?: string;
  attachments?: EmailAttachment[];
  template_id?: string;
  variables?: Record<string, any>;
  metadata?: Record<string, any>;
  scheduled_at?: string; // ISO datetime
}

/**
 * Queue async email request
 * POST /api/v1/communications/email/queue
 */
export interface QueueEmailRequest extends SendEmailRequest {
  priority?: number; // 1-10, default 5
  max_retries?: number; // default 3
}

/**
 * Create template request
 * POST /api/v1/communications/templates
 */
export interface CreateTemplateRequest {
  name: string;
  description?: string;
  channel: CommunicationChannel;
  subject?: string; // for email templates
  body_html?: string;
  body_text?: string;
  variables?: TemplateVariable[];
  metadata?: Record<string, any>;
  is_active?: boolean;
}

/**
 * Update template request
 * PUT /api/v1/communications/templates/{id}
 */
export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  subject?: string;
  body_html?: string;
  body_text?: string;
  variables?: TemplateVariable[];
  metadata?: Record<string, any>;
  is_active?: boolean;
}

/**
 * Render template request
 * POST /api/v1/communications/templates/{id}/render
 */
export interface RenderTemplateRequest {
  variables: Record<string, any>;
}

/**
 * Quick render request (no template ID)
 * POST /api/v1/communications/render
 */
export interface QuickRenderRequest {
  subject?: string;
  body_html?: string;
  body_text?: string;
  variables: Record<string, any>;
}

/**
 * Queue bulk operation request
 * POST /api/v1/communications/bulk/queue
 */
export interface QueueBulkRequest {
  recipients: EmailRecipient[];
  template_id: string;
  subject_override?: string;
  batch_size?: number; // default 100
  delay_between_batches?: number; // seconds, default 0
  metadata?: Record<string, any>;
}

// ==================== Response Schemas ====================

/**
 * Send email response
 */
export interface SendEmailResponse {
  message_id: string;
  status: CommunicationStatus;
  accepted: string[]; // accepted recipient emails
  rejected: string[]; // rejected recipient emails
  queued_at?: string;
  sent_at?: string;
}

/**
 * Queue email response
 */
export interface QueueEmailResponse {
  task_id: string;
  status: CommunicationStatus;
  queued_at: string;
  estimated_send_time?: string;
}

/**
 * Communication log entry
 */
export interface CommunicationLog {
  id: string;
  tenant_id: string;
  channel: CommunicationChannel;
  recipient_email?: string;
  recipient_phone?: string;
  recipient_name?: string;
  subject?: string;
  body_text?: string;
  body_html?: string;
  template_id?: string;
  status: CommunicationStatus;
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  clicked_at?: string;
  failed_at?: string;
  error_message?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * Communication template
 */
export interface CommunicationTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  channel: CommunicationChannel;
  subject?: string;
  body_html?: string;
  body_text?: string;
  variables?: TemplateVariable[];
  metadata?: Record<string, any>;
  is_active: boolean;
  usage_count: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

/**
 * Template list response
 */
export interface TemplateListResponse {
  templates: CommunicationTemplate[];
  total: number;
  page: number;
  page_size: number;
  has_more?: boolean;
}

/**
 * Render template response
 */
export interface RenderTemplateResponse {
  rendered_subject?: string;
  rendered_body_html?: string;
  rendered_body_text?: string;
  variables_used: string[];
}

/**
 * Bulk operation
 */
export interface BulkOperation {
  id: string;
  tenant_id: string;
  template_id: string;
  recipient_count: number;
  status: BulkOperationStatus;
  progress: number; // 0-100
  sent_count: number;
  failed_count: number;
  pending_count: number;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  error_message?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * Bulk operation status response
 */
export interface BulkOperationStatusResponse {
  operation: BulkOperation;
  recent_logs?: CommunicationLog[]; // last 10 sends
}

/**
 * Task status response
 */
export interface TaskStatusResponse {
  task_id: string;
  status: "pending" | "started" | "success" | "failure" | "retry" | "revoked";
  result?: any;
  error?: string;
  progress?: {
    current: number;
    total: number;
    percent: number;
  };
}

/**
 * Communication statistics
 */
export interface CommunicationStats {
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  total_opened: number;
  total_clicked: number;
  delivery_rate: number; // percentage
  open_rate: number; // percentage
  click_rate: number; // percentage
  by_channel: Record<CommunicationChannel, number>;
  by_status: Record<CommunicationStatus, number>;
  recent_activity: ActivityPoint[];
}

/**
 * Activity data point for charts
 */
export interface ActivityPoint {
  date: string;
  sent: number;
  delivered: number;
  failed: number;
  opened: number;
  clicked: number;
}

/**
 * Activity response
 */
export interface ActivityResponse {
  activity: ActivityPoint[];
  start_date: string;
  end_date: string;
}

/**
 * Health check response
 */
export interface HealthResponse {
  smtp_available: boolean;
  smtp_host?: string;
  smtp_port?: number;
  redis_available: boolean;
  celery_available: boolean;
  active_workers?: number;
  pending_tasks?: number;
  failed_tasks?: number;
}

/**
 * Metrics response (with Redis caching)
 */
export interface MetricsResponse {
  total_logs: number;
  total_templates: number;
  stats: CommunicationStats;
  top_templates: Array<{
    template_id: string;
    template_name: string;
    usage_count: number;
    success_rate: number;
  }>;
  recent_failures: Array<{
    log_id: string;
    recipient: string;
    error_message: string;
    failed_at: string;
  }>;
  cached_at: string;
}

// ==================== Query Parameters ====================

/**
 * List communications query params
 */
export interface ListCommunicationsParams {
  channel?: CommunicationChannel;
  status?: CommunicationStatus;
  recipient_email?: string;
  template_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
  sort_by?: "created_at" | "sent_at" | "status";
  sort_order?: "asc" | "desc";
}

/**
 * List templates query params
 */
export interface ListTemplatesParams {
  channel?: CommunicationChannel;
  is_active?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}

/**
 * Statistics query params
 */
export interface StatsParams {
  date_from?: string;
  date_to?: string;
  channel?: CommunicationChannel;
}

/**
 * Activity query params
 */
export interface ActivityParams {
  days?: number; // default 30
  channel?: CommunicationChannel;
}

// ==================== Helper Functions ====================

/**
 * Get status badge color
 */
export function getStatusColor(status: CommunicationStatus): string {
  switch (status) {
    case CommunicationStatus.SENT:
    case CommunicationStatus.DELIVERED:
      return "text-green-600 bg-green-100";
    case CommunicationStatus.OPENED:
    case CommunicationStatus.CLICKED:
      return "text-blue-600 bg-blue-100";
    case CommunicationStatus.PENDING:
    case CommunicationStatus.QUEUED:
    case CommunicationStatus.SENDING:
      return "text-yellow-600 bg-yellow-100";
    case CommunicationStatus.FAILED:
    case CommunicationStatus.BOUNCED:
      return "text-red-600 bg-red-100";
    default:
      return "text-gray-600 bg-gray-100";
  }
}

/**
 * Get status label
 */
export function getStatusLabel(status: CommunicationStatus): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Get channel icon name
 */
export function getChannelIcon(channel: CommunicationChannel): string {
  switch (channel) {
    case CommunicationChannel.EMAIL:
      return "mail";
    case CommunicationChannel.SMS:
      return "message-square";
    case CommunicationChannel.PUSH:
      return "bell";
    case CommunicationChannel.IN_APP:
      return "inbox";
    default:
      return "send";
  }
}

/**
 * Format delivery rate as percentage
 */
export function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Check if email is valid format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Parse comma-separated emails
 */
export function parseEmails(input: string): EmailRecipient[] {
  return input
    .split(",")
    .map((email) => email.trim())
    .filter((email) => email.length > 0 && isValidEmail(email))
    .map((email) => ({ email }));
}

/**
 * Get time ago string
 */
export function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString();
}

/**
 * Extract variables from Jinja2 template
 */
export function extractTemplateVariables(template: string): string[] {
  const variableRegex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  const variables = new Set<string>();
  let match;

  while ((match = variableRegex.exec(template)) !== null) {
    if (match[1]) {
      variables.add(match[1]);
    }
  }

  return Array.from(variables);
}

/**
 * Validate template variables
 */
export function validateTemplateVariables(
  template: string,
  providedVariables: Record<string, any>,
): { valid: boolean; missing: string[] } {
  const required = extractTemplateVariables(template);
  const provided = Object.keys(providedVariables);
  const missing = required.filter((v) => !provided.includes(v));

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get bulk operation progress color
 */
export function getBulkProgressColor(status: BulkOperationStatus): string {
  switch (status) {
    case BulkOperationStatus.COMPLETED:
      return "bg-green-500";
    case BulkOperationStatus.PROCESSING:
      return "bg-blue-500";
    case BulkOperationStatus.FAILED:
    case BulkOperationStatus.CANCELLED:
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
}

/**
 * Calculate success rate
 */
export function calculateSuccessRate(sent: number, failed: number): number {
  const total = sent + failed;
  if (total === 0) return 0;
  return (sent / total) * 100;
}
