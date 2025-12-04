/**
 * Shared Billing Utilities
 *
 * Common utility functions for billing features.
 */

import { InvoiceStatus, PaymentStatus, type Invoice } from "./types";

/**
 * Get display color classes for invoice status
 */
export function getInvoiceStatusColor(status: InvoiceStatus): string {
  const colors: Record<InvoiceStatus, string> = {
    [InvoiceStatus.DRAFT]: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
    [InvoiceStatus.FINALIZED]: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    [InvoiceStatus.OPEN]: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    [InvoiceStatus.PAID]: "bg-green-500/10 text-green-600 dark:text-green-400",
    [InvoiceStatus.VOID]: "bg-red-500/10 text-red-600 dark:text-red-400",
    [InvoiceStatus.UNCOLLECTIBLE]: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  };
  return colors[status] || colors[InvoiceStatus.DRAFT];
}

/**
 * Get display color classes for payment status
 */
export function getPaymentStatusColor(status: PaymentStatus): string {
  const colors: Record<PaymentStatus, string> = {
    [PaymentStatus.PENDING]: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    [PaymentStatus.PROCESSING]: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    [PaymentStatus.PAID]: "bg-green-500/10 text-green-600 dark:text-green-400",
    [PaymentStatus.FAILED]: "bg-red-500/10 text-red-600 dark:text-red-400",
    [PaymentStatus.REFUNDED]: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  };
  return colors[status] || colors[PaymentStatus.PENDING];
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: string = "USD"): string {
  // Amount is in minor units (cents), divide by 100
  const dollars = amount / 100;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Check if invoice is overdue
 */
export function isInvoiceOverdue(invoice: Invoice): boolean {
  if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.VOID) {
    return false;
  }

  const dueDate = new Date(invoice.due_date);
  const now = new Date();

  return dueDate < now;
}

/**
 * Calculate days until due (negative if overdue)
 */
export function getDaysUntilDue(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Get human-readable status label
 */
export function getInvoiceStatusLabel(status: InvoiceStatus): string {
  const labels: Record<InvoiceStatus, string> = {
    [InvoiceStatus.DRAFT]: "Draft",
    [InvoiceStatus.FINALIZED]: "Finalized",
    [InvoiceStatus.OPEN]: "Open",
    [InvoiceStatus.PAID]: "Paid",
    [InvoiceStatus.VOID]: "Void",
    [InvoiceStatus.UNCOLLECTIBLE]: "Uncollectible",
  };
  return labels[status] || status;
}

/**
 * Get human-readable payment status label
 */
export function getPaymentStatusLabel(status: PaymentStatus): string {
  const labels: Record<PaymentStatus, string> = {
    [PaymentStatus.PENDING]: "Pending",
    [PaymentStatus.PROCESSING]: "Processing",
    [PaymentStatus.PAID]: "Paid",
    [PaymentStatus.FAILED]: "Failed",
    [PaymentStatus.REFUNDED]: "Refunded",
  };
  return labels[status] || status;
}

/**
 * Calculate invoice totals
 */
export function calculateInvoiceTotals(invoice: Invoice) {
  return {
    subtotal:
      invoice.amount_due -
      (invoice.line_items?.reduce((sum, item) => sum + (item.tax_amount || 0), 0) || 0),
    tax: invoice.line_items?.reduce((sum, item) => sum + (item.tax_amount || 0), 0) || 0,
    total: invoice.amount_due,
    paid: invoice.amount_paid,
    remaining: invoice.amount_remaining,
  };
}
