// Billing domain types using TypeScript best practices
import { BaseEntitySnake, Money, DateString, CustomerID, InvoiceID, WithMetadata } from "./common";
import { PartialBy, RequiredBy } from "./utils";

// Invoice types (using snake_case to match API)
export interface Invoice extends BaseEntitySnake, WithMetadata {
  invoice_id: string; // Using API's actual field name
  invoice_number: string;
  customer_id: CustomerID;
  billing_email?: string;
  status: InvoiceStatus;
  payment_status?: "pending" | "processing" | "paid" | "failed" | "refunded";

  // Dates
  due_date: DateString;
  paid_date?: DateString;

  // Financial
  currency?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  amount_due: number;
  amount_paid: number;

  // Details
  line_items: InvoiceLineItem[];
  tax_rates?: TaxRate[];
  payment_terms?: string;
  notes?: string;
  terms?: string;

  // References
  subscription_id?: string;
  order_id?: string;
}

export const InvoiceStatuses = {
  DRAFT: "draft",
  FINALIZED: "finalized",
  PAID: "paid",
  VOID: "void",
  UNCOLLECTIBLE: "uncollectible",
} as const;
export type InvoiceStatus = (typeof InvoiceStatuses)[keyof typeof InvoiceStatuses];

export interface InvoiceLineItem {
  item_id?: string; // Using API's field name
  description: string;
  quantity: number;
  unit_price: number;
  total_price?: number;
  discount?: number;
  tax?: number;
  product_id?: string;
  service_id?: string;
}

export interface TaxRate {
  name: string;
  rate: number; // Percentage
  amount: Money;
}

// Subscription types
export interface Subscription extends BaseEntitySnake, WithMetadata {
  id: string;
  customer_id: CustomerID;
  plan_id: string;
  status: SubscriptionStatus;

  // Billing cycle
  current_period_start: DateString;
  current_period_end: DateString;
  billing_cycle: BillingCycle;

  // Pricing
  amount: Money;
  quantity: number;
  discount?: Discount;

  // Dates
  startDate: DateString;
  endDate?: DateString;
  cancelledAt?: DateString;
  pausedAt?: DateString;

  // Trial
  trialStart?: DateString;
  trialEnd?: DateString;

  // Usage
  usage?: SubscriptionUsage;
  features?: string[];
}

export const SubscriptionStatuses = {
  ACTIVE: "active",
  TRIALING: "trialing",
  PAST_DUE: "past_due",
  PAUSED: "paused",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatuses)[keyof typeof SubscriptionStatuses];

export const BillingCycles = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  SEMI_ANNUAL: "semi_annual",
  ANNUAL: "annual",
  CUSTOM: "custom",
} as const;
export type BillingCycle = (typeof BillingCycles)[keyof typeof BillingCycles];

export interface SubscriptionUsage {
  period: DateString;
  items: UsageItem[];
  total: Money;
}

export interface UsageItem {
  metricId: string;
  name: string;
  quantity: number;
  unitPrice: Money;
  total: Money;
}

// Product catalog types
export interface Product extends BaseEntitySnake, WithMetadata {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  category?: string;
  type: ProductType;
  status: ProductStatus;

  // Pricing
  pricing: ProductPricing;
  taxable?: boolean;
  taxCode?: string;

  // Inventory
  trackInventory?: boolean;
  inventoryCount?: number;
  lowStockThreshold?: number;

  // Images and media
  images?: ProductImage[];
  features?: string[];
  specifications?: Record<string, string>;
}

export const ProductTypes = {
  PHYSICAL: "physical",
  DIGITAL: "digital",
  SERVICE: "service",
  SUBSCRIPTION: "subscription",
} as const;
export type ProductType = (typeof ProductTypes)[keyof typeof ProductTypes];

export const ProductStatuses = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  ARCHIVED: "archived",
  OUT_OF_STOCK: "out_of_stock",
} as const;
export type ProductStatus = (typeof ProductStatuses)[keyof typeof ProductStatuses];

export interface ProductPricing {
  model: PricingModel;
  basePrice?: Money;
  tiers?: PriceTier[];
  customPricing?: boolean;
}

export type PricingModel = "flat" | "tiered" | "volume" | "usage" | "custom";

export interface PriceTier {
  minQuantity: number;
  maxQuantity?: number;
  unitPrice: Money;
}

export interface ProductImage {
  id: string;
  url: string;
  alt?: string;
  isPrimary?: boolean;
  order?: number;
}

// Payment types
export interface Payment extends BaseEntitySnake, WithMetadata {
  id: string;
  customerId: CustomerID;
  amount: Money;
  status: PaymentStatus;
  method: PaymentMethod;

  // References
  invoiceId?: InvoiceID | null; // Allow null from API
  subscriptionId?: string | null;

  // Details
  description?: string;
  reference?: string;
  transactionId?: string;

  // Dates
  processedAt?: DateString;
  failedAt?: DateString;
  refundedAt?: DateString;

  // Error handling
  failureReason?: string;
  retryCount?: number;
}

export const PaymentStatuses = {
  PENDING: "pending",
  PROCESSING: "processing",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
  PARTIAL_REFUND: "partial_refund",
} as const;
export type PaymentStatus = (typeof PaymentStatuses)[keyof typeof PaymentStatuses];

export const PaymentMethods = {
  CARD: "card",
  BANK_TRANSFER: "bank_transfer",
  PAYPAL: "paypal",
  STRIPE: "stripe",
  CHECK: "check",
  CASH: "cash",
  CRYPTO: "crypto",
  OTHER: "other",
} as const;
export type PaymentMethod = (typeof PaymentMethods)[keyof typeof PaymentMethods];

// Discount types
export interface Discount {
  id: string;
  code?: string;
  type: DiscountType;
  value: number;
  description?: string;
  validFrom?: DateString;
  validUntil?: DateString;
  usageLimit?: number;
  usageCount?: number;
}

export type DiscountType = "percentage" | "fixed" | "trial";

// Input types using utilities
export type InvoiceCreateInput = RequiredBy<
  PartialBy<
    Invoice,
    "invoice_id" | "invoice_number" | "created_at" | "updated_at" | "amount_due" | "amount_paid"
  >,
  "customer_id" | "due_date" | "line_items"
>;

export type SubscriptionCreateInput = RequiredBy<
  PartialBy<Subscription, "id" | "created_at" | "updated_at" | "status">,
  "customer_id" | "plan_id" | "startDate"
>;

export type ProductCreateInput = RequiredBy<
  PartialBy<Product, "id" | "created_at" | "updated_at" | "status">,
  "name" | "type" | "pricing"
>;

// Search params
export interface InvoiceSearchParams {
  customerId?: CustomerID;
  status?: InvoiceStatus | InvoiceStatus[];
  fromDate?: DateString;
  toDate?: DateString;
  minAmount?: number;
  maxAmount?: number;
  overdue?: boolean;
  page?: number;
  pageSize?: number;
}

export interface SubscriptionSearchParams {
  customerId?: CustomerID;
  planId?: string;
  status?: SubscriptionStatus | SubscriptionStatus[];
  billingCycle?: BillingCycle;
  page?: number;
  pageSize?: number;
}

// Metrics and analytics
export interface BillingMetrics {
  revenue: {
    total: Money;
    recurring: Money;
    oneTime: Money;
  };
  invoices: {
    total: number;
    paid: number;
    overdue: number;
    averageValue: Money;
  };
  subscriptions: {
    active: number;
    trialing: number;
    churnRate: number;
    mrr: Money; // Monthly Recurring Revenue
    arr: Money; // Annual Recurring Revenue
  };
  payments: {
    successful: number;
    failed: number;
    pending: number;
    totalProcessed: Money;
  };
}

// Receipt types
export interface ReceiptLineItem {
  line_item_id: string;
  description: string;
  quantity: number;
  unit_price: number; // in minor units
  total_price: number; // in minor units
  tax_rate: number; // percentage
  tax_amount: number; // in minor units
  product_id?: string;
  sku?: string;
  extra_data?: Record<string, any>;
}

export interface Receipt extends BaseEntitySnake, WithMetadata {
  receipt_id: string;
  receipt_number: string;

  // References
  payment_id?: string;
  invoice_id?: string;
  customer_id: CustomerID;

  // Receipt details
  issue_date: DateString;
  currency: string; // 3-letter currency code

  // Amounts (in minor units)
  subtotal: number;
  tax_amount: number;
  total_amount: number;

  // Payment information
  payment_method: string;
  payment_status: string;

  // Line items
  line_items: ReceiptLineItem[];

  // Customer information
  customer_name: string;
  customer_email: string;
  billing_address?: Record<string, string>;

  // Content
  notes?: string;

  // Receipt generation
  pdf_url?: string;
  html_content?: string;

  // Delivery
  sent_at?: DateString;
  delivery_method?: string;

  // Metadata
  extra_data?: Record<string, any>;
}

export interface ReceiptSearchParams {
  customer_id?: CustomerID;
  payment_id?: string;
  invoice_id?: string;
  from_date?: DateString;
  to_date?: DateString;
  page?: number;
  limit?: number;
  offset?: number;
}

// Credit Note types
export interface CreditNote extends BaseEntitySnake, WithMetadata {
  id: string;
  credit_note_number: string;
  invoice_id: string;
  customer_id: CustomerID;
  status: CreditNoteStatus;
  reason: CreditNoteReason;
  total_amount: number;
  applied_amount: number;
  available_credit: number;
  currency: string;
  line_items: CreditNoteLineItem[];
  notes?: string;
  internal_notes?: string;

  // References
  invoice?: Invoice;

  // Dates
  issued_at?: DateString;
  voided_at?: DateString;
  applied_at?: DateString;
}

export const CreditNoteStatuses = {
  DRAFT: "draft",
  ISSUED: "issued",
  APPLIED: "applied",
  VOID: "void",
  REFUNDED: "refunded",
} as const;
export type CreditNoteStatus = (typeof CreditNoteStatuses)[keyof typeof CreditNoteStatuses];

export const CreditNoteReasons = {
  ERROR: "error",
  DISCOUNT: "discount",
  RETURN: "return",
  GOODWILL: "goodwill",
  OTHER: "other",
} as const;
export type CreditNoteReason = (typeof CreditNoteReasons)[keyof typeof CreditNoteReasons];

export interface CreditNoteLineItem {
  line_item_id?: string;
  description: string;
  amount: number;
  quantity?: number;
  unit_price?: number;
  product_id?: string;
  service_id?: string;
}

export interface CreditNoteSearchParams {
  customer_id?: CustomerID;
  invoice_id?: string;
  status?: CreditNoteStatus | CreditNoteStatus[];
  reason?: CreditNoteReason;
  from_date?: DateString;
  to_date?: DateString;
  page?: number;
  limit?: number;
  offset?: number;
}

export interface CreditNoteCreateInput {
  invoice_id: string;
  reason: CreditNoteReason;
  line_items: CreditNoteLineItem[];
  notes?: string;
  internal_notes?: string;
  auto_apply?: boolean;
}

export interface CreditNoteApplyInput {
  invoice_id?: string;
  amount?: number;
}
