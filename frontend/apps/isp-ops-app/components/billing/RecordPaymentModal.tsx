/**
 * Record Payment Modal - ISP Ops App Wrapper
 *
 * Wrapper that connects the shared RecordPaymentModal to app-specific dependencies.
 */

"use client";

import {
  RecordPaymentModal as SharedRecordPaymentModal,
  type RecordPaymentInvoice,
} from "@dotmac/features/billing";
import { formatCurrency } from "@dotmac/features/billing";
import { useToast, useConfirmDialog } from "@dotmac/ui";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import { type Invoice } from "@/types/billing";

interface RecordPaymentModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: Invoice[];
  onSuccess?: () => void;
}

export function RecordPaymentModal(props: RecordPaymentModalWrapperProps) {
  // Map app-specific Invoice type to shared Invoice type
  const sharedInvoices: RecordPaymentInvoice[] = props.invoices.map((invoice) => ({
    invoice_id: invoice.invoice_id,
    invoice_number: invoice.invoice_number,
    customer_id: invoice.customer_id,
    billing_email: invoice.billing_email ?? "",
    total_amount: invoice.total_amount,
    amount_due: invoice.amount_due,
    amount_paid: invoice.amount_paid,
    currency: invoice.currency ?? "USD",
    due_date: invoice.due_date,
    created_at: invoice.created_at,
    status: invoice.status,
    payment_status: invoice.payment_status ?? "pending",
  }));

  return (
    <SharedRecordPaymentModal
      {...props}
      invoices={sharedInvoices}
      apiClient={apiClient}
      useToast={useToast}
      logger={logger}
      useConfirmDialog={useConfirmDialog}
      formatCurrency={formatCurrency}
    />
  );
}
