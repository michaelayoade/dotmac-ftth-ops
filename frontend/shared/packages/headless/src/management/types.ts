/**
 * Unified Management Operations Types
 * Production-ready type definitions for cross-portal management operations
 */

// ===== CORE ENTITY TYPES =====

export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  status: EntityStatus;
  metadata?: Record<string, any>;
  tenant_id?: string;
}

export enum EntityStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  PENDING = "pending",
  SUSPENDED = "suspended",
  DELETED = "deleted",
}

export enum EntityType {
  TENANT = "tenant",
  CUSTOMER = "customer",
  USER = "user",
  SERVICE = "service",
  RESELLER = "reseller",
  PARTNER = "partner",
}

// ===== ENTITY MANAGEMENT =====

export interface EntityFilters {
  status?: EntityStatus[];
  created_after?: string;
  created_before?: string;
  search?: string;
  tenant_id?: string;
  entity_type?: EntityType;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface EntityListResponse<T extends BaseEntity> {
  entities: T[];
  total_count: number;
  has_more: boolean;
  next_cursor?: string;
  filters_applied: EntityFilters;
}

export interface CreateEntityRequest {
  entity_type: EntityType;
  data: Record<string, any>;
  tenant_id?: string;
  initial_status?: EntityStatus;
  metadata?: Record<string, any>;
}

export interface UpdateEntityRequest {
  data: Partial<Record<string, any>>;
  metadata?: Record<string, any>;
  status?: EntityStatus;
}

export interface EntityOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  error_code?: string;
  warnings?: string[];
}

// ===== BILLING OPERATIONS =====

export interface BillingEntity extends BaseEntity {
  billing_email: string;
  payment_method_id?: string;
  credit_balance: number;
  billing_cycle: BillingCycle;
  auto_pay_enabled: boolean;
  billing_address?: BillingAddress;
}

export enum BillingCycle {
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  ANNUALLY = "annually",
}

export interface BillingAddress {
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface DateRange {
  start_date: string;
  end_date: string;
}

export interface BillingData {
  entity_id: string;
  period: DateRange;
  total_charges: number;
  total_payments: number;
  outstanding_balance: number;
  invoices: Invoice[];
  payments: Payment[];
  usage_summary: UsageSummary[];
}

export interface Invoice {
  id: string;
  entity_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  line_items: InvoiceLineItem[];
  payment_terms: string;
}

export enum InvoiceStatus {
  DRAFT = "draft",
  SENT = "sent",
  PAID = "paid",
  OVERDUE = "overdue",
  CANCELLED = "cancelled",
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  service_id?: string;
  usage_period?: DateRange;
}

export interface Payment {
  id: string;
  entity_id: string;
  invoice_id?: string;
  amount: number;
  currency: string;
  payment_date: string;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  transaction_id?: string;
  gateway_response?: Record<string, any>;
}

export enum PaymentStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
  REFUNDED = "refunded",
  CANCELLED = "cancelled",
}

export enum PaymentMethod {
  CREDIT_CARD = "credit_card",
  BANK_TRANSFER = "bank_transfer",
  ACH = "ach",
  WIRE = "wire",
  CHECK = "check",
  CASH = "cash",
}

export interface PaymentResult {
  success: boolean;
  payment_id?: string;
  transaction_id?: string;
  amount: number;
  status: PaymentStatus;
  error_message?: string;
  gateway_response?: Record<string, any>;
}

export interface UsageSummary {
  service_id: string;
  service_name: string;
  usage_type: string;
  quantity: number;
  unit: string;
  rate: number;
  total_cost: number;
  period: DateRange;
}

// ===== ANALYTICS OPERATIONS =====

export interface DashboardStats {
  period: DateRange;
  entity_count: EntityCount;
  revenue_metrics: RevenueMetrics;
  usage_metrics: UsageMetrics;
  operational_metrics: OperationalMetrics;
  growth_metrics: GrowthMetrics;
}

export interface EntityCount {
  total_entities: number;
  active_entities: number;
  new_entities_period: number;
  churned_entities_period: number;
  by_type: Record<EntityType, number>;
  by_status: Record<EntityStatus, number>;
}

export interface RevenueMetrics {
  total_revenue: number;
  recurring_revenue: number;
  one_time_revenue: number;
  outstanding_receivables: number;
  collection_rate: number;
  average_revenue_per_entity: number;
  revenue_growth_rate: number;
}

export interface UsageMetrics {
  total_usage_hours: number;
  peak_concurrent_usage: number;
  average_usage_per_entity: number;
  usage_trends: UsageTrend[];
  top_services_by_usage: ServiceUsage[];
}

export interface UsageTrend {
  date: string;
  usage_value: number;
  entity_count: number;
}

export interface ServiceUsage {
  service_id: string;
  service_name: string;
  total_usage: number;
  entity_count: number;
  revenue_generated: number;
}

export interface OperationalMetrics {
  support_tickets_count: number;
  average_resolution_time_hours: number;
  system_uptime_percentage: number;
  error_rate_percentage: number;
  api_response_time_ms: number;
  customer_satisfaction_score?: number;
}

export interface GrowthMetrics {
  customer_acquisition_rate: number;
  customer_churn_rate: number;
  net_revenue_retention: number;
  monthly_recurring_revenue_growth: number;
  lifetime_value: number;
}

// ===== REPORTING =====

export enum ReportType {
  FINANCIAL = "financial",
  USAGE = "usage",
  OPERATIONAL = "operational",
  COMPLIANCE = "compliance",
  EXECUTIVE = "executive",
  CUSTOM = "custom",
}

export enum ReportFormat {
  JSON = "json",
  CSV = "csv",
  PDF = "pdf",
  EXCEL = "excel",
}

export interface ReportParams {
  period: DateRange;
  entity_filters?: EntityFilters;
  include_deleted?: boolean;
  group_by?: string[];
  metrics?: string[];
  format?: ReportFormat;
  custom_fields?: string[];
}

export interface Report {
  id: string;
  type: ReportType;
  title: string;
  description: string;
  generated_at: string;
  generated_by: string;
  parameters: ReportParams;
  status: ReportStatus;
  file_url?: string;
  file_size?: number;
  expires_at?: string;
  data?: ReportData;
}

export enum ReportStatus {
  QUEUED = "queued",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  EXPIRED = "expired",
}

export interface ReportData {
  summary: Record<string, any>;
  sections: ReportSection[];
  charts?: ChartData[];
  raw_data?: any[];
}

export interface ReportSection {
  title: string;
  type: "table" | "chart" | "text" | "metrics";
  data: any;
  metadata?: Record<string, any>;
}

export interface ChartData {
  id: string;
  type: "line" | "bar" | "pie" | "area" | "scatter";
  title: string;
  data: any[];
  config: Record<string, any>;
}

// ===== SERVICE MANAGEMENT =====

export interface Service extends BaseEntity {
  name: string;
  description: string;
  service_type: ServiceType;
  pricing_model: PricingModel;
  base_price: number;
  currency: string;
  billing_cycle: BillingCycle;
  features: ServiceFeature[];
  limits: ServiceLimits;
  is_public: boolean;
}

export enum ServiceType {
  INTERNET = "internet",
  VOICE = "voice",
  TV = "tv",
  CLOUD_STORAGE = "cloud_storage",
  EMAIL = "email",
  SECURITY = "security",
  SUPPORT = "support",
  CUSTOM = "custom",
}

export enum PricingModel {
  FIXED = "fixed",
  TIERED = "tiered",
  USAGE_BASED = "usage_based",
  HYBRID = "hybrid",
}

export interface ServiceFeature {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  configuration?: Record<string, any>;
}

export interface ServiceLimits {
  max_users?: number;
  max_bandwidth_mbps?: number;
  max_storage_gb?: number;
  max_email_accounts?: number;
  custom_limits?: Record<string, number>;
}

// ===== ERROR HANDLING =====

export interface OperationError {
  code: string;
  message: string;
  details?: Record<string, any>;
  context?: string;
  timestamp: string;
  recoverable: boolean;
  retry_after?: number;
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  current_value?: any;
}

// ===== API CONFIGURATION =====

export interface ApiConfig {
  base_url: string;
  timeout_ms: number;
  retry_attempts: number;
  retry_delay_ms: number;
  rate_limit_requests: number;
  rate_limit_window_ms: number;
  auth_header_name: string;
  tenant_header_name: string;
  request_id_header_name: string;
}

export interface RequestContext {
  request_id: string;
  user_id?: string;
  tenant_id?: string;
  portal_type: string;
  timestamp: string;
  correlation_id?: string;
}

// ===== CACHING =====

export interface CacheConfig {
  enabled: boolean;
  default_ttl_seconds: number;
  max_entries: number;
  cache_key_prefix: string;
  invalidation_patterns: string[];
}

export interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: number;
  ttl_seconds: number;
  tags?: string[];
}

// ===== EVENTS =====

export interface ManagementEvent {
  id: string;
  type: string;
  entity_type: EntityType;
  entity_id: string;
  action: string;
  actor_id: string;
  timestamp: string;
  data: Record<string, any>;
  metadata: Record<string, any>;
}
