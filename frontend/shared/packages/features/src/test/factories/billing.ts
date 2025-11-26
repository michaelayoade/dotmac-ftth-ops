/**
 * Test data factories for billing module
 */

import type { Invoice } from "../../billing/types";
import { InvoiceStatus, PaymentStatus } from "../../billing/types";

let invoiceCounter = 1;
let receiptCounter = 1;
let paymentCounter = 1;

/**
 * Create a mock invoice with sensible defaults
 */
export const createMockInvoice = (overrides?: Partial<Invoice>): Invoice => {
  const id = invoiceCounter++;
  const amount = overrides?.total_amount ?? 150.0;
  const paidAmount = overrides?.amount_paid ?? 0;
  const invoiceIdValue = overrides?.invoice_id ?? `inv_${id}`;
  const invoiceNumberValue = overrides?.invoice_number ?? `INV-${String(id).padStart(5, "0")}`;

  return {
    id: overrides?.id ?? invoiceIdValue,
    invoice_id: invoiceIdValue,
    invoice_number: invoiceNumberValue,
    tenant_id: overrides?.tenant_id ?? "tenant_123",
    customer_id: "cust_123",
    billing_email: "customer@example.com",
    total_amount: amount,
    amount_due: amount - paidAmount,
    amount_paid: paidAmount,
    amount_remaining: amount - paidAmount,
    currency: "USD",
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: InvoiceStatus.DRAFT,
    payment_status: PaymentStatus.PENDING,
    ...overrides,
  };
};

/**
 * Create an overdue invoice
 */
export const createOverdueInvoice = (overrides?: Partial<Invoice>): Invoice => {
  return createMockInvoice({
    status: InvoiceStatus.OPEN,
    payment_status: PaymentStatus.PENDING,
    due_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    ...overrides,
  });
};

/**
 * Create a paid invoice
 */
export const createPaidInvoice = (overrides?: Partial<Invoice>): Invoice => {
  const amount = overrides?.total_amount ?? 150.0;
  return createMockInvoice({
    status: InvoiceStatus.PAID,
    payment_status: PaymentStatus.PAID,
    amount_paid: amount,
    amount_due: 0,
    ...overrides,
  });
};

/**
 * Create a partially paid invoice
 */
export const createPartiallyPaidInvoice = (overrides?: Partial<Invoice>): Invoice => {
  const amount = overrides?.total_amount ?? 150.0;
  const paidAmount = amount * 0.5;
  return createMockInvoice({
    status: InvoiceStatus.OPEN,
    payment_status: PaymentStatus.PROCESSING,
    amount_paid: paidAmount,
    amount_due: amount - paidAmount,
    total_amount: amount,
    ...overrides,
  });
};

/**
 * Create a voided invoice
 */
export const createVoidedInvoice = (overrides?: Partial<Invoice>): Invoice => {
  return createMockInvoice({
    status: InvoiceStatus.VOID,
    payment_status: PaymentStatus.FAILED,
    ...overrides,
  });
};

/**
 * Create multiple invoices for list testing
 */
export const createMockInvoices = (count: number = 5): Invoice[] => {
  return Array.from({ length: count }, (_, i) =>
    createMockInvoice({
      invoice_id: `inv_${i + 1}`,
      invoice_number: `INV-${String(i + 1).padStart(5, "0")}`,
    }),
  );
};

/**
 * Create a mock receipt
 */
export const createMockReceipt = (overrides?: Partial<any>) => {
  const id = receiptCounter++;
  return {
    receipt_id: `rcpt_${id}`,
    receipt_number: `RCPT-${String(id).padStart(5, "0")}`,
    customer_id: "cust_123",
    amount: 150.0,
    payment_method: "card",
    payment_date: new Date().toISOString(),
    created_at: new Date().toISOString(),
    status: "completed",
    ...overrides,
  };
};

/**
 * Create a mock payment
 */
export const createMockPayment = (overrides?: Partial<any>) => {
  const id = paymentCounter++;
  return {
    payment_id: `pay_${id}`,
    invoice_id: "inv_1",
    amount: 150.0,
    payment_method: "card",
    payment_date: new Date().toISOString(),
    reference: `REF-${id}`,
    status: "completed",
    ...overrides,
  };
};

/**
 * Create mock payment method
 */
export const createMockPaymentMethod = (overrides?: Partial<any>) => {
  return {
    id: "pm_123",
    type: "card",
    card: {
      brand: "visa",
      last4: "4242",
      exp_month: 12,
      exp_year: 2025,
    },
    is_default: true,
    ...overrides,
  };
};

/**
 * Reset counters (useful between test suites)
 */
export const resetBillingCounters = () => {
  invoiceCounter = 1;
  receiptCounter = 1;
  paymentCounter = 1;
};
