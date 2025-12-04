/**
 * Shared Billing Types
 *
 * Common types used across billing features in both apps.
 */

export enum InvoiceStatus {
  DRAFT = "draft",
  FINALIZED = "finalized",
  OPEN = "open",
  PAID = "paid",
  VOID = "void",
  UNCOLLECTIBLE = "uncollectible",
}

export enum PaymentStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  PAID = "paid",
  FAILED = "failed",
  REFUNDED = "refunded",
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_amount: number;
  amount: number;
  tax_rate?: number;
  tax_amount?: number;
}

export interface Invoice {
  id: string;
  invoice_id: string;
  invoice_number: string;
  tenant_id: string;
  customer_id: string;
  billing_email: string;
  status: InvoiceStatus;
  payment_status?: PaymentStatus;
  total_amount: number;
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  currency: string;
  due_date: string;
  created_at: string;
  updated_at: string;
  line_items?: InvoiceLineItem[];
  billing_address?: Record<string, string>;
  notes?: string;
  internal_notes?: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  payment_method?: string;
  created_at: string;
  updated_at: string;
}

export interface BillingMetrics {
  total_invoices: number;
  total_revenue: number;
  total_outstanding: number;
  paid_count: number;
  unpaid_count: number;
  overdue_count: number;
}

export interface ReceiptLineItem {
  line_item_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  tax_rate: number;
  tax_amount: number;
  product_id?: string;
  sku?: string;
}

export interface Receipt {
  id: string;
  receipt_id: string;
  receipt_number: string;
  payment_id?: string;
  invoice_id?: string;
  customer_id: string;
  issue_date: string;
  currency: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  customer_name: string;
  customer_email: string;
  billing_address?: Record<string, string>;
  notes?: string;
  pdf_url?: string;
  html_content?: string;
  sent_at?: string;
  delivery_method?: string;
  line_items: ReceiptLineItem[];
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Licensing Framework Types
// ============================================================================

export enum ModuleCategory {
  NETWORK = "NETWORK",
  OSS_INTEGRATION = "OSS_INTEGRATION",
  BILLING = "BILLING",
  ANALYTICS = "ANALYTICS",
  AUTOMATION = "AUTOMATION",
  COMMUNICATIONS = "COMMUNICATIONS",
  SECURITY = "SECURITY",
  REPORTING = "REPORTING",
  API_MANAGEMENT = "API_MANAGEMENT",
  OTHER = "OTHER",
}

export enum PricingModel {
  FLAT_FEE = "FLAT_FEE",
  PER_UNIT = "PER_UNIT",
  TIERED = "TIERED",
  USAGE_BASED = "USAGE_BASED",
  CUSTOM = "CUSTOM",
  FREE = "FREE",
  BUNDLED = "BUNDLED",
}

export enum SubscriptionStatus {
  TRIAL = "TRIAL",
  ACTIVE = "ACTIVE",
  PAST_DUE = "PAST_DUE",
  CANCELED = "CANCELED",
  EXPIRED = "EXPIRED",
  SUSPENDED = "SUSPENDED",
}

export enum BillingCycle {
  MONTHLY = "MONTHLY",
  ANNUAL = "ANNUAL",
}

export interface Module {
  id: string;
  module_name: string;
  module_code: string;
  description?: string;
  category: ModuleCategory;
  is_core: boolean;
  dependencies?: string[];
  created_at: string;
  updated_at: string;
}

export interface PlanModule {
  id: string;
  module_id: string;
  module?: Module;
  included_by_default: boolean;
  addon_price?: number;
}

export interface Quota {
  id: string;
  quota_name: string;
  quota_code: string;
  unit_name: string;
  description?: string;
}

export interface PlanQuota {
  id: string;
  quota_id: string;
  quota?: Quota;
  included_quantity: number;
  overage_allowed: boolean;
  overage_rate?: number;
}

export interface ServicePlan {
  id: string;
  plan_name: string;
  plan_code: string;
  description?: string;
  base_price_monthly: number;
  annual_discount_percent: number;
  trial_days: number;
  is_public: boolean;
  is_active: boolean;
  modules?: PlanModule[];
  quotas?: PlanQuota[];
  created_at: string;
  updated_at: string;
}

export interface SubscriptionModule {
  id: string;
  module_id: string;
  module?: Module;
  source: "PLAN" | "ADDON" | "TRIAL";
  addon_price?: number;
}

export interface QuotaUsage {
  id: string;
  quota_id: string;
  quota?: Quota;
  allocated_quantity: number;
  current_usage: number;
  overage_quantity: number;
  overage_charges: number;
}

export interface TenantSubscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  plan?: ServicePlan;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  monthly_price: number;
  trial_end?: string;
  current_period_start: string;
  current_period_end: string;
  modules?: SubscriptionModule[];
  quota_usage?: QuotaUsage[];
  created_at: string;
  updated_at: string;
}
