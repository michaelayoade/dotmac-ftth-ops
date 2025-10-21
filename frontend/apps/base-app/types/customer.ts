// Customer domain types with TypeScript utilities
import {
  BaseEntitySnake,
  WithMetadata,
  WithCustomFields,
  WithTags,
  Address,
  ContactInfo,
  DateString,
  CustomerID,
} from "./common";
import { PartialBy, RequiredBy } from "./utils";

// Base customer type extending common patterns (using snake_case to match API)
export interface Customer extends BaseEntitySnake, WithMetadata, WithCustomFields, WithTags {
  id: CustomerID;
  customer_number: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  display_name?: string;
  company_name?: string;
  customer_type: CustomerType;
  tier: CustomerTier;
  status: CustomerStatus;

  // Contact info
  email: string;
  phone?: string;
  mobile?: string;
  website?: string;

  // Address fields (API uses snake_case)
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state_province?: string;
  postal_code?: string;
  country?: string;

  // Business fields
  tax_id?: string;
  vat_number?: string;
  credit_limit?: number;
  payment_terms?: number;

  // Metrics
  lifetime_value: number;
  total_purchases: number;
  average_order_value: number;
  last_purchase_date?: DateString;
  first_purchase_date?: DateString;
  last_interaction?: DateString;

  // Relationships
  primary_contact_id?: string;
  account_manager_id?: string;
  parent_customer_id?: CustomerID;

  // Additional
  notes?: string;
  preferences?: CustomerPreferences;
  segments?: string[];
}

// Customer enums using const assertions for better type inference
export const CustomerTypes = {
  INDIVIDUAL: "individual",
  BUSINESS: "business",
  ENTERPRISE: "enterprise",
  PARTNER: "partner",
  VENDOR: "vendor",
} as const;
export type CustomerType = (typeof CustomerTypes)[keyof typeof CustomerTypes];

export const CustomerTiers = {
  FREE: "free",
  BASIC: "basic",
  STANDARD: "standard",
  PREMIUM: "premium",
  ENTERPRISE: "enterprise",
} as const;
export type CustomerTier = (typeof CustomerTiers)[keyof typeof CustomerTiers];

export const CustomerStatuses = {
  PROSPECT: "prospect",
  ACTIVE: "active",
  INACTIVE: "inactive",
  SUSPENDED: "suspended",
  CHURNED: "churned",
  ARCHIVED: "archived",
} as const;
export type CustomerStatus = (typeof CustomerStatuses)[keyof typeof CustomerStatuses];

// Customer preferences
export interface CustomerPreferences {
  language?: string;
  currency?: string;
  timezone?: string;
  communicationChannels?: CommunicationChannel[];
  marketingOptIn?: boolean;
  invoiceDelivery?: "email" | "mail" | "both";
}

export type CommunicationChannel = "email" | "sms" | "phone" | "push" | "mail";

// Using TypeScript utilities for create/update operations
export type CustomerCreateInput = RequiredBy<
  PartialBy<
    Customer,
    | "id"
    | "customer_number"
    | "created_at"
    | "updated_at"
    | "lifetime_value"
    | "total_purchases"
    | "average_order_value"
    | "status"
    | "tier"
    | "customer_type"
  >,
  "first_name" | "last_name" | "email"
>;

export type CustomerUpdateInput = PartialBy<
  Customer,
  "id" | "customer_number" | "created_at" | "updated_at"
>;

// Search and filter types
export interface CustomerSearchParams {
  query?: string;
  email?: string;
  status?: CustomerStatus | CustomerStatus[];
  customerType?: CustomerType | CustomerType[];
  tier?: CustomerTier | CustomerTier[];
  country?: string;
  city?: string;
  tags?: string[];
  segments?: string[];
  minLifetimeValue?: number;
  maxLifetimeValue?: number;
  hasRecentPurchase?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: CustomerSortField;
  sortOrder?: "asc" | "desc";
}

export type CustomerSortField =
  | "displayName"
  | "email"
  | "createdAt"
  | "lifetimeValue"
  | "totalPurchases"
  | "lastPurchaseDate";

// Customer metrics for dashboard (using snake_case to match API)
export interface CustomerMetrics {
  total_customers: number;
  active_customers: number;
  new_customers_this_month: number;
  churned_this_month?: number;
  average_lifetime_value: number;
  total_revenue: number;
  retention_rate?: number;
  churn_rate?: number;
  customers_by_tier?: Record<string, number>;
  customers_by_status?: Record<string, number>;
  customers_by_type?: Record<string, number>;
  growth_rate?: number;
  top_customers?: CustomerSummary[];
  top_segments?: Array<{ name: string; count: number }>;
}

export interface CustomerSummary {
  id: CustomerID;
  displayName: string;
  email: string;
  lifetimeValue: number;
  tier: CustomerTier;
  status: CustomerStatus;
}

// Customer activity and history
export interface CustomerActivity {
  id: string;
  customerId: CustomerID;
  type: ActivityType;
  description: string;
  timestamp: DateString;
  metadata?: Record<string, unknown>;
}

export type ActivityType =
  | "purchase"
  | "support_ticket"
  | "email_sent"
  | "email_opened"
  | "login"
  | "profile_update"
  | "subscription_change"
  | "note_added";

// Type guards
export function isBusinessCustomer(customer: Customer): boolean {
  return (
    customer.customer_type === CustomerTypes.BUSINESS ||
    customer.customer_type === CustomerTypes.ENTERPRISE
  );
}

export function isActiveCustomer(customer: Customer): boolean {
  return customer.status === CustomerStatuses.ACTIVE;
}

export function isPremiumCustomer(customer: Customer): boolean {
  return customer.tier === CustomerTiers.PREMIUM || customer.tier === CustomerTiers.ENTERPRISE;
}
