/**
 * Comprehensive Billing and Payment Processing Types
 * Supports multiple payment processors with unified interface
 */

export interface PaymentProcessor {
  id: string;
  name: string;
  type: "STRIPE" | "SQUARE" | "AUTHORIZE_NET" | "PAYPAL" | "BRAINTREE" | "WORLDPAY";
  status: "ACTIVE" | "INACTIVE" | "TESTING" | "ERROR";
  capabilities: PaymentCapability[];
  configuration: ProcessorConfiguration;
  webhookUrl?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentCapability {
  type:
    | "CREDIT_CARD"
    | "DEBIT_CARD"
    | "ACH"
    | "PAYPAL"
    | "APPLE_PAY"
    | "GOOGLE_PAY"
    | "RECURRING"
    | "REFUNDS"
    | "TOKENIZATION";
  enabled: boolean;
  supported_currencies: string[];
  transaction_limits: {
    min_amount: number;
    max_amount: number;
    daily_limit?: number;
    monthly_limit?: number;
  };
}

export interface ProcessorConfiguration {
  processor_type: PaymentProcessor["type"];
  credentials: {
    // Stripe
    publishable_key?: string;
    secret_key?: string;
    webhook_secret?: string;

    // Square
    application_id?: string;
    access_token?: string;
    environment?: "sandbox" | "production";

    // Authorize.Net
    api_login_id?: string;
    transaction_key?: string;

    // PayPal
    client_id?: string;
    client_secret?: string;

    // Braintree
    merchant_id?: string;
    public_key?: string;
    private_key?: string;
  };
  settings: {
    currency: string;
    capture_method: "automatic" | "manual";
    statement_descriptor?: string;
    receipt_email: boolean;
    save_payment_methods: boolean;
    require_billing_address: boolean;
    require_shipping_address: boolean;
  };
}

export interface PaymentMethod {
  id: string;
  customer_id: string;
  processor_id: string;
  processor_payment_method_id: string;
  type: "CREDIT_CARD" | "DEBIT_CARD" | "ACH" | "PAYPAL" | "DIGITAL_WALLET";
  status: "ACTIVE" | "EXPIRED" | "DECLINED" | "REQUIRES_ACTION";
  is_default: boolean;
  metadata: {
    // Card details (last 4 digits, brand, etc.)
    card_brand?: string;
    card_last4?: string;
    card_exp_month?: number;
    card_exp_year?: number;

    // ACH details
    bank_name?: string;
    account_type?: "checking" | "savings";
    account_last4?: string;

    // Digital wallet
    wallet_type?: "apple_pay" | "google_pay" | "samsung_pay";
  };
  billing_address?: BillingAddress;
  created_at: string;
  updated_at: string;
}

export interface BillingAddress {
  first_name: string;
  last_name: string;
  company?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone?: string;
}

export interface PaymentIntent {
  id: string;
  customer_id: string;
  invoice_id?: string;
  subscription_id?: string;
  processor_id: string;
  processor_payment_intent_id: string;
  amount: number;
  currency: string;
  status:
    | "PENDING"
    | "REQUIRES_PAYMENT_METHOD"
    | "REQUIRES_CONFIRMATION"
    | "REQUIRES_ACTION"
    | "PROCESSING"
    | "SUCCEEDED"
    | "CANCELED";
  payment_method_id?: string;
  description?: string;
  metadata?: Record<string, any>;
  client_secret?: string;
  next_action?: {
    type: string;
    redirect_url?: string;
    verification_code?: string;
  };
  error?: PaymentError;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  customer_id: string;
  invoice_id?: string;
  subscription_id?: string;
  payment_intent_id?: string;
  processor_id: string;
  processor_transaction_id: string;
  type: "PAYMENT" | "REFUND" | "DISPUTE" | "CHARGEBACK" | "PARTIAL_REFUND";
  amount: number;
  currency: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELED" | "DISPUTED";
  payment_method: {
    type: string;
    details: Record<string, any>;
  };
  billing_address?: BillingAddress;
  fees: TransactionFee[];
  description?: string;
  receipt_url?: string;
  failure_reason?: string;
  dispute_reason?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface TransactionFee {
  type: "PROCESSING" | "APPLICATION" | "GATEWAY" | "INTERCHANGE";
  amount: number;
  currency: string;
  description: string;
}

export interface PaymentError {
  code: string;
  message: string;
  type: "card_error" | "invalid_request_error" | "api_error" | "authentication_error";
  decline_code?: string;
  processor_code?: string;
  processor_message?: string;
}

export interface Subscription {
  id: string;
  customer_id: string;
  plan_id: string;
  status:
    | "ACTIVE"
    | "PAST_DUE"
    | "CANCELED"
    | "INCOMPLETE"
    | "INCOMPLETE_EXPIRED"
    | "TRIALING"
    | "UNPAID";
  current_period_start: string;
  current_period_end: string;
  trial_start?: string;
  trial_end?: string;
  canceled_at?: string;
  billing_cycle_anchor?: string;
  collection_method: "charge_automatically" | "send_invoice";
  default_payment_method_id?: string;
  items: SubscriptionItem[];
  discount?: SubscriptionDiscount;
  tax_percent?: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionItem {
  id: string;
  subscription_id: string;
  plan_id: string;
  quantity: number;
  unit_amount: number;
  currency: string;
  tax_rates: TaxRate[];
  created_at: string;
  updated_at: string;
}

export interface TaxRate {
  id: string;
  display_name: string;
  percentage: number;
  country?: string;
  state?: string;
  jurisdiction?: string;
  inclusive: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionDiscount {
  coupon_id: string;
  discount_type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  currency?: string;
  duration: "ONCE" | "REPEATING" | "FOREVER";
  duration_in_months?: number;
  start: string;
  end?: string;
}

export interface Invoice {
  id: string;
  customer_id: string;
  subscription_id?: string;
  status: "DRAFT" | "OPEN" | "PAID" | "VOID" | "UNCOLLECTIBLE";
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  currency: string;
  description?: string;
  due_date: string;
  period_start?: string;
  period_end?: string;
  subtotal: number;
  total: number;
  tax: number;
  discount_amount: number;
  line_items: InvoiceLineItem[];
  billing_address?: BillingAddress;
  payment_terms?: string;
  footer?: string;
  receipt_number?: string;
  hosted_invoice_url?: string;
  invoice_pdf?: string;
  paid_at?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_amount: number;
  amount: number;
  currency: string;
  tax_rates: TaxRate[];
  metadata?: Record<string, any>;
}

// API Request/Response Types
export interface CreatePaymentIntentRequest {
  customer_id: string;
  amount: number;
  currency: string;
  payment_method_id?: string;
  description?: string;
  metadata?: Record<string, any>;
  save_payment_method?: boolean;
  setup_future_usage?: "on_session" | "off_session";
}

export interface CreatePaymentIntentResponse {
  payment_intent: PaymentIntent;
  client_secret?: string;
}

export interface ConfirmPaymentRequest {
  payment_intent_id: string;
  payment_method_id?: string;
  return_url?: string;
}

export interface ProcessRefundRequest {
  transaction_id: string;
  amount?: number;
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
  metadata?: Record<string, any>;
}

export interface CreateSubscriptionRequest {
  customer_id: string;
  plan_id: string;
  payment_method_id?: string;
  trial_period_days?: number;
  metadata?: Record<string, any>;
}

export interface UpdateSubscriptionRequest {
  subscription_id: string;
  plan_id?: string;
  quantity?: number;
  metadata?: Record<string, any>;
}

export interface BillingPortalSession {
  id: string;
  customer_id: string;
  url: string;
  return_url: string;
  expires_at: string;
  created_at: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  processor: string;
  data: Record<string, any>;
  processed: boolean;
  processed_at?: string;
  error?: string;
  retry_count: number;
  created_at: string;
}

// Analytics and Reporting Types
export interface BillingAnalytics {
  period: {
    start: string;
    end: string;
  };
  metrics: {
    total_revenue: number;
    successful_payments: number;
    failed_payments: number;
    refunds: number;
    new_customers: number;
    churned_customers: number;
    mrr: number; // Monthly Recurring Revenue
    arr: number; // Annual Recurring Revenue
    ltv: number; // Customer Lifetime Value
    churn_rate: number;
  };
  revenue_by_plan: Array<{
    plan_id: string;
    plan_name: string;
    revenue: number;
    customer_count: number;
  }>;
  payment_method_distribution: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  geographic_revenue: Array<{
    country: string;
    revenue: number;
    customer_count: number;
  }>;
}

export interface DunningAction {
  id: string;
  customer_id: string;
  invoice_id: string;
  action_type: "EMAIL_REMINDER" | "SUSPEND_SERVICE" | "CANCEL_SUBSCRIPTION" | "COLLECTION_AGENCY";
  days_overdue: number;
  status: "PENDING" | "COMPLETED" | "FAILED" | "CANCELED";
  scheduled_for: string;
  executed_at?: string;
  result?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}
