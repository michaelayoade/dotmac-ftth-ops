/**
 * Record Payment Modal - Platform Admin App Wrapper
 *
 * Wrapper that connects the shared RecordPaymentModal to app-specific dependencies.
 */

"use client";

import {
  RecordPaymentModal as SharedRecordPaymentModal,
  type RecordPaymentModalProps as SharedRecordPaymentModalProps,
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
  const { invoices, ...rest } = props;
  type SharedInvoice = SharedRecordPaymentModalProps["invoices"][number];
  // Map app-specific Invoice type to shared Invoice type
  const sharedInvoices: SharedInvoice[] = invoices.map((invoice) => ({
    invoice_id: invoice.invoice_id,
    invoice_number: invoice.invoice_number,
    amount_due: invoice.amount_due,
    due_date: invoice.due_date,
  }));

  return (
    <SharedRecordPaymentModal
      {...rest}
      invoices={sharedInvoices}
      apiClient={apiClient}
      useToast={useToast}
      logger={logger}
      useConfirmDialog={useConfirmDialog}
      formatCurrency={formatCurrency}
    />
  );
}
