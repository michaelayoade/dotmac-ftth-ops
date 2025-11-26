/**
 * Shared Constants and Enums
 *
 * Auto-generated from backend Python enums.
 * DO NOT edit manually - regenerate using scripts/sync-backend-types.sh
 *
 * Last updated: 2025-11-25
 */

// ============================================================================
// Job & Background Task Enums
// ============================================================================

/**
 * Job execution status
 * @source src/dotmac/platform/jobs/models.py:JobStatus
 */
export enum JobStatus {
  PENDING = "pending",
  ASSIGNED = "assigned",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  RETRYING = "retrying",
  TIMEOUT = "timeout",
}

/**
 * Job type categories
 * @source src/dotmac/platform/jobs/models.py:JobType
 */
export enum JobType {
  BULK_IMPORT = "bulk_import",
  BULK_EXPORT = "bulk_export",
  DATA_MIGRATION = "data_migration",
  FIRMWARE_UPGRADE = "firmware_upgrade",
  BATCH_PROVISIONING = "batch_provisioning",
  BATCH_DEPROVISIONING = "batch_deprovisioning",
  REPORT_GENERATION = "report_generation",
  AUDIT_EXPORT = "audit_export",
  CUSTOM = "custom",
}

/**
 * Job priority levels
 * @source src/dotmac/platform/jobs/models.py:JobPriority
 */
export enum JobPriority {
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
  CRITICAL = "critical",
}

/**
 * Job chain execution mode
 * @source src/dotmac/platform/jobs/models.py:JobExecutionMode
 */
export enum JobExecutionMode {
  SEQUENTIAL = "sequential",
  PARALLEL = "parallel",
}

// ============================================================================
// Workflow & Orchestration Enums
// ============================================================================

/**
 * Workflow execution status
 * @source src/dotmac/platform/orchestration/models.py:WorkflowStatus
 */
export enum WorkflowStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  PARTIALLY_COMPLETED = "partially_completed",
  ROLLING_BACK = "rolling_back",
  ROLLED_BACK = "rolled_back",
  ROLLBACK_FAILED = "rollback_failed",
  TIMEOUT = "timeout",
  COMPENSATED = "compensated",
}

/**
 * Individual workflow step status
 * @source src/dotmac/platform/orchestration/models.py:WorkflowStepStatus
 */
export enum WorkflowStepStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  SKIPPED = "skipped",
  COMPENSATING = "compensating",
  COMPENSATED = "compensated",
  COMPENSATION_FAILED = "compensation_failed",
}

/**
 * Types of orchestrated workflows
 * @source src/dotmac/platform/orchestration/models.py:WorkflowType
 */
export enum WorkflowType {
  PROVISION_SUBSCRIBER = "provision_subscriber",
  DEPROVISION_SUBSCRIBER = "deprovision_subscriber",
  ACTIVATE_SERVICE = "activate_service",
  SUSPEND_SERVICE = "suspend_service",
  TERMINATE_SERVICE = "terminate_service",
  CHANGE_SERVICE_PLAN = "change_service_plan",
  UPDATE_NETWORK_CONFIG = "update_network_config",
  MIGRATE_SUBSCRIBER = "migrate_subscriber",
}

// ============================================================================
// Ticketing Enums
// ============================================================================

/**
 * Lifecycle state of a support ticket
 * @source src/dotmac/platform/ticketing/models.py:TicketStatus
 */
export enum TicketStatus {
  OPEN = "open",
  IN_PROGRESS = "in_progress",
  WAITING = "waiting",
  RESOLVED = "resolved",
  CLOSED = "closed",
}

/**
 * Operational priority assigned to a ticket
 * @source src/dotmac/platform/ticketing/models.py:TicketPriority
 */
export enum TicketPriority {
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
  URGENT = "urgent",
}

/**
 * ISP-specific ticket types for categorization and routing
 * @source src/dotmac/platform/ticketing/models.py:TicketType
 */
export enum TicketType {
  GENERAL_INQUIRY = "general_inquiry",
  BILLING_ISSUE = "billing_issue",
  TECHNICAL_SUPPORT = "technical_support",
  INSTALLATION_REQUEST = "installation_request",
  OUTAGE_REPORT = "outage_report",
  SERVICE_UPGRADE = "service_upgrade",
  SERVICE_DOWNGRADE = "service_downgrade",
  CANCELLATION_REQUEST = "cancellation_request",
  EQUIPMENT_ISSUE = "equipment_issue",
  SPEED_ISSUE = "speed_issue",
  NETWORK_ISSUE = "network_issue",
  CONNECTIVITY_ISSUE = "connectivity_issue",
  FAULT = "fault",
  OUTAGE = "outage",
  MAINTENANCE = "maintenance",
}

/**
 * Party acting within the ticket conversation
 * @source src/dotmac/platform/ticketing/models.py:TicketActorType
 */
export enum TicketActorType {
  CUSTOMER = "customer",
  TENANT = "tenant",
  PARTNER = "partner",
  PLATFORM = "platform",
}

// ============================================================================
// Billing Enums
// ============================================================================

/**
 * Billing cycle periods
 * @source src/dotmac/platform/billing/core/enums.py:BillingCycle
 */
export enum BillingCycle {
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  SEMI_ANNUAL = "semi_annual",
  ANNUAL = "annual",
  CUSTOM = "custom",
}

/**
 * Invoice status states
 * @source src/dotmac/platform/billing/core/enums.py:InvoiceStatus
 */
export enum InvoiceStatus {
  DRAFT = "draft",
  OPEN = "open",
  PAID = "paid",
  VOID = "void",
  OVERDUE = "overdue",
  PARTIALLY_PAID = "partially_paid",
}

/**
 * Payment status states
 * @source src/dotmac/platform/billing/core/enums.py:PaymentStatus
 */
export enum PaymentStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  SUCCEEDED = "succeeded",
  FAILED = "failed",
  REFUNDED = "refunded",
  PARTIALLY_REFUNDED = "partially_refunded",
  CANCELLED = "cancelled",
}

/**
 * Payment method types
 * @source src/dotmac/platform/billing/core/enums.py:PaymentMethodType
 */
export enum PaymentMethodType {
  CARD = "card",
  BANK_ACCOUNT = "bank_account",
  DIGITAL_WALLET = "digital_wallet",
  CRYPTO = "crypto",
  CHECK = "check",
  WIRE_TRANSFER = "wire_transfer",
  CASH = "cash",
}

/**
 * Financial transaction types
 * @source src/dotmac/platform/billing/core/enums.py:TransactionType
 */
export enum TransactionType {
  CHARGE = "charge",
  PAYMENT = "payment",
  REFUND = "refund",
  CREDIT = "credit",
  ADJUSTMENT = "adjustment",
  FEE = "fee",
  WRITE_OFF = "write_off",
  TAX = "tax",
}

/**
 * Credit note status states
 * @source src/dotmac/platform/billing/core/enums.py:CreditNoteStatus
 */
export enum CreditNoteStatus {
  DRAFT = "draft",
  ISSUED = "issued",
  APPLIED = "applied",
  VOIDED = "voided",
  PARTIALLY_APPLIED = "partially_applied",
}

/**
 * Credit note types
 * @source src/dotmac/platform/billing/core/enums.py:CreditType
 */
export enum CreditType {
  REFUND = "refund",
  ADJUSTMENT = "adjustment",
  WRITE_OFF = "write_off",
  DISCOUNT = "discount",
  ERROR_CORRECTION = "error_correction",
  OVERPAYMENT = "overpayment",
  GOODWILL = "goodwill",
}

/**
 * Payment method status states
 * @source src/dotmac/platform/billing/core/enums.py:PaymentMethodStatus
 */
export enum PaymentMethodStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  EXPIRED = "expired",
  REQUIRES_VERIFICATION = "requires_verification",
  VERIFICATION_FAILED = "verification_failed",
}

/**
 * Bank account types
 * @source src/dotmac/platform/billing/core/enums.py:BankAccountType
 */
export enum BankAccountType {
  CHECKING = "checking",
  SAVINGS = "savings",
  BUSINESS_CHECKING = "business_checking",
  BUSINESS_SAVINGS = "business_savings",
}

/**
 * Verification status states
 * @source src/dotmac/platform/billing/core/enums.py:VerificationStatus
 */
export enum VerificationStatus {
  PENDING = "pending",
  VERIFIED = "verified",
  FAILED = "failed",
  EXPIRED = "expired",
}

// ============================================================================
// Service & Subscription Enums
// ============================================================================

/**
 * Service status states
 * @source src/dotmac/platform/billing/core/enums.py:ServiceStatus
 */
export enum ServiceStatus {
  PENDING = "pending",
  ACTIVE = "active",
  SUSPENDED = "suspended",
  TERMINATED = "terminated",
}

/**
 * Service type categories
 * @source src/dotmac/platform/billing/core/enums.py:ServiceType
 */
export enum ServiceType {
  BROADBAND = "broadband",
  VOICE = "voice",
  VIDEO = "video",
  BUNDLE = "bundle",
  ADDON = "addon",
  CUSTOM = "custom",
}

/**
 * Subscriber status
 * @source src/dotmac/platform/subscribers/models.py:SubscriberStatus
 */
export enum SubscriberStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  SUSPENDED = "suspended",
  TERMINATED = "terminated",
}

// ============================================================================
// Customer Management Enums
// ============================================================================

/**
 * Customer account status
 * @source src/dotmac/platform/customer_management/models.py:CustomerStatus
 */
export enum CustomerStatus {
  PROSPECT = "prospect",
  ACTIVE = "active",
  INACTIVE = "inactive",
  SUSPENDED = "suspended",
  CHURNED = "churned",
  ARCHIVED = "archived",
}

/**
 * Type of customer account
 * @source src/dotmac/platform/customer_management/models.py:CustomerType
 */
export enum CustomerType {
  INDIVIDUAL = "individual",
  BUSINESS = "business",
  ENTERPRISE = "enterprise",
  PARTNER = "partner",
  VENDOR = "vendor",
}

/**
 * Customer tier/level for service differentiation
 * @source src/dotmac/platform/customer_management/models.py:CustomerTier
 */
export enum CustomerTier {
  FREE = "free",
  BASIC = "basic",
  STANDARD = "standard",
  PREMIUM = "premium",
  ENTERPRISE = "enterprise",
}

// ============================================================================
// CRM Enums
// ============================================================================

/**
 * Lead status
 * @source src/dotmac/platform/crm/models.py:LeadStatus
 */
export enum LeadStatus {
  NEW = "new",
  CONTACTED = "contacted",
  QUALIFIED = "qualified",
  PROPOSAL = "proposal",
  NEGOTIATION = "negotiation",
  WON = "won",
  LOST = "lost",
  DISQUALIFIED = "disqualified",
}

/**
 * Lead source
 * @source src/dotmac/platform/crm/models.py:LeadSource
 */
export enum LeadSource {
  WEBSITE = "website",
  REFERRAL = "referral",
  PARTNER = "partner",
  ADVERTISEMENT = "advertisement",
  SOCIAL_MEDIA = "social_media",
  COLD_CALL = "cold_call",
  EVENT = "event",
  OTHER = "other",
}

/**
 * Quote status
 * @source src/dotmac/platform/crm/models.py:QuoteStatus
 */
export enum QuoteStatus {
  DRAFT = "draft",
  SENT = "sent",
  VIEWED = "viewed",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  EXPIRED = "expired",
}

/**
 * Site survey status
 * @source src/dotmac/platform/crm/models.py:SiteSurveyStatus
 */
export enum SiteSurveyStatus {
  SCHEDULED = "scheduled",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

/**
 * Serviceability status
 * @source src/dotmac/platform/crm/models.py:Serviceability
 */
export enum Serviceability {
  SERVICEABLE = "serviceable",
  NOT_SERVICEABLE = "not_serviceable",
  PENDING_VERIFICATION = "pending_verification",
}

// ============================================================================
// Communication Enums
// ============================================================================

/**
 * Communication type
 * @source src/dotmac/platform/communications/models.py:CommunicationType
 */
export enum CommunicationType {
  EMAIL = "email",
  SMS = "sms",
  PUSH_NOTIFICATION = "push_notification",
  IN_APP = "in_app",
}

/**
 * Communication status
 * @source src/dotmac/platform/communications/models.py:CommunicationStatus
 */
export enum CommunicationStatus {
  PENDING = "pending",
  SENT = "sent",
  DELIVERED = "delivered",
  FAILED = "failed",
  BOUNCED = "bounced",
}

// ============================================================================
// Plugin & Integration Enums
// ============================================================================

/**
 * Plugin type
 * @source src/dotmac/platform/plugins/schema.py:PluginType
 */
export enum PluginType {
  NOTIFICATION = "notification",
  PAYMENT = "payment",
  ANALYTICS = "analytics",
  INTEGRATION = "integration",
  CUSTOM = "custom",
}

/**
 * Plugin status
 * @source src/dotmac/platform/plugins/schema.py:PluginStatus
 */
export enum PluginStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  ERROR = "error",
  PENDING = "pending",
}

// ============================================================================
// Webhook Enums
// ============================================================================

/**
 * Webhook delivery status
 * @source src/dotmac/platform/webhooks/models.py:DeliveryStatus
 */
export enum WebhookDeliveryStatus {
  PENDING = "pending",
  DELIVERED = "delivered",
  FAILED = "failed",
  RETRYING = "retrying",
}

// ============================================================================
// Licensing Enums
// ============================================================================

/**
 * Subscription tier
 * @source src/dotmac/platform/licensing/models_v2.py:SubscriptionTier
 */
export enum SubscriptionTier {
  FREE = "free",
  STARTER = "starter",
  PROFESSIONAL = "professional",
  ENTERPRISE = "enterprise",
  CUSTOM = "custom",
}

/**
 * Subscription status
 * @source src/dotmac/platform/licensing/models_v2.py:SubscriptionStatus
 */
export enum SubscriptionStatus {
  TRIAL = "trial",
  ACTIVE = "active",
  PAST_DUE = "past_due",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

/**
 * Feature category
 * @source src/dotmac/platform/licensing/models_v2.py:FeatureCategory
 */
export enum FeatureCategory {
  CORE = "core",
  BILLING = "billing",
  NETWORK = "network",
  ANALYTICS = "analytics",
  INTEGRATIONS = "integrations",
  ADVANCED = "advanced",
}

/**
 * Quota type
 * @source src/dotmac/platform/licensing/models_v2.py:QuotaType
 */
export enum QuotaType {
  SUBSCRIBERS = "subscribers",
  API_CALLS = "api_calls",
  STORAGE_GB = "storage_gb",
  TEAM_MEMBERS = "team_members",
  CUSTOM = "custom",
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid enum value
 */
export function isEnumValue<T extends Record<string, string>>(
  enumObj: T,
  value: unknown,
): value is T[keyof T] {
  return Object.values(enumObj).includes(value as string);
}

/**
 * Get all values from an enum
 */
export function getEnumValues<T extends Record<string, string>>(enumObj: T): Array<T[keyof T]> {
  return Object.values(enumObj) as Array<T[keyof T]>;
}

/**
 * Get all keys from an enum
 */
export function getEnumKeys<T extends Record<string, string>>(enumObj: T): Array<keyof T> {
  return Object.keys(enumObj) as Array<keyof T>;
}

// ============================================================================
// Human-Readable Labels
// ============================================================================

/**
 * Get human-readable label for job status
 */
export const JobStatusLabels: Record<JobStatus, string> = {
  [JobStatus.PENDING]: "Pending",
  [JobStatus.ASSIGNED]: "Assigned",
  [JobStatus.RUNNING]: "Running",
  [JobStatus.COMPLETED]: "Completed",
  [JobStatus.FAILED]: "Failed",
  [JobStatus.CANCELLED]: "Cancelled",
  [JobStatus.RETRYING]: "Retrying",
  [JobStatus.TIMEOUT]: "Timeout",
};

/**
 * Get human-readable label for workflow status
 */
export const WorkflowStatusLabels: Record<WorkflowStatus, string> = {
  [WorkflowStatus.PENDING]: "Pending",
  [WorkflowStatus.RUNNING]: "Running",
  [WorkflowStatus.COMPLETED]: "Completed",
  [WorkflowStatus.FAILED]: "Failed",
  [WorkflowStatus.PARTIALLY_COMPLETED]: "Partially Completed",
  [WorkflowStatus.ROLLING_BACK]: "Rolling Back",
  [WorkflowStatus.ROLLED_BACK]: "Rolled Back",
  [WorkflowStatus.ROLLBACK_FAILED]: "Rollback Failed",
  [WorkflowStatus.TIMEOUT]: "Timeout",
  [WorkflowStatus.COMPENSATED]: "Compensated",
};

/**
 * Get human-readable label for ticket status
 */
export const TicketStatusLabels: Record<TicketStatus, string> = {
  [TicketStatus.OPEN]: "Open",
  [TicketStatus.IN_PROGRESS]: "In Progress",
  [TicketStatus.WAITING]: "Waiting",
  [TicketStatus.RESOLVED]: "Resolved",
  [TicketStatus.CLOSED]: "Closed",
};

/**
 * Get human-readable label for invoice status
 */
export const InvoiceStatusLabels: Record<InvoiceStatus, string> = {
  [InvoiceStatus.DRAFT]: "Draft",
  [InvoiceStatus.OPEN]: "Open",
  [InvoiceStatus.PAID]: "Paid",
  [InvoiceStatus.VOID]: "Void",
  [InvoiceStatus.OVERDUE]: "Overdue",
  [InvoiceStatus.PARTIALLY_PAID]: "Partially Paid",
};

/**
 * Get human-readable label for payment status
 */
export const PaymentStatusLabels: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]: "Pending",
  [PaymentStatus.PROCESSING]: "Processing",
  [PaymentStatus.SUCCEEDED]: "Succeeded",
  [PaymentStatus.FAILED]: "Failed",
  [PaymentStatus.REFUNDED]: "Refunded",
  [PaymentStatus.PARTIALLY_REFUNDED]: "Partially Refunded",
  [PaymentStatus.CANCELLED]: "Cancelled",
};

/**
 * Get human-readable label for customer status
 */
export const CustomerStatusLabels: Record<CustomerStatus, string> = {
  [CustomerStatus.PROSPECT]: "Prospect",
  [CustomerStatus.ACTIVE]: "Active",
  [CustomerStatus.INACTIVE]: "Inactive",
  [CustomerStatus.SUSPENDED]: "Suspended",
  [CustomerStatus.CHURNED]: "Churned",
  [CustomerStatus.ARCHIVED]: "Archived",
};

// ============================================================================
// Status Badge Variants
// ============================================================================

/**
 * Badge color variants for job status
 */
export const JobStatusVariants: Record<
  JobStatus,
  "default" | "success" | "warning" | "destructive" | "secondary"
> = {
  [JobStatus.PENDING]: "secondary",
  [JobStatus.ASSIGNED]: "default",
  [JobStatus.RUNNING]: "default",
  [JobStatus.COMPLETED]: "success",
  [JobStatus.FAILED]: "destructive",
  [JobStatus.CANCELLED]: "secondary",
  [JobStatus.RETRYING]: "warning",
  [JobStatus.TIMEOUT]: "destructive",
};

/**
 * Badge color variants for payment status
 */
export const PaymentStatusVariants: Record<
  PaymentStatus,
  "default" | "success" | "warning" | "destructive" | "secondary"
> = {
  [PaymentStatus.PENDING]: "secondary",
  [PaymentStatus.PROCESSING]: "default",
  [PaymentStatus.SUCCEEDED]: "success",
  [PaymentStatus.FAILED]: "destructive",
  [PaymentStatus.REFUNDED]: "warning",
  [PaymentStatus.PARTIALLY_REFUNDED]: "warning",
  [PaymentStatus.CANCELLED]: "secondary",
};

/**
 * Badge color variants for ticket status
 */
export const TicketStatusVariants: Record<
  TicketStatus,
  "default" | "success" | "warning" | "destructive" | "secondary"
> = {
  [TicketStatus.OPEN]: "warning",
  [TicketStatus.IN_PROGRESS]: "default",
  [TicketStatus.WAITING]: "secondary",
  [TicketStatus.RESOLVED]: "success",
  [TicketStatus.CLOSED]: "secondary",
};
