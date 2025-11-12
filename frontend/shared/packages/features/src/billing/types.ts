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
