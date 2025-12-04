/**
 * Invoice Actions Hooks
 *
 * Custom hooks for performing actions on invoices:
 * - Send invoice email
 * - Void invoice
 * - Send payment reminder
 * - Create credit note
 */

import { useMutation } from "@tanstack/react-query";
import { useToast } from "@dotmac/ui";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

export interface SendInvoiceEmailRequest {
  invoiceId: string;
  email?: string; // Optional: override recipient email
}

export interface VoidInvoiceRequest {
  invoiceId: string;
  reason: string;
}

export interface SendPaymentReminderRequest {
  invoiceId: string;
  message?: string; // Optional: custom reminder message
}

export interface CreditNoteLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total_price?: number;
}

export interface CreateCreditNoteRequest {
  invoice_id: string;
  amount: number;
  reason: string;
  line_items?: CreditNoteLineItem[];
  notes?: string;
}

export interface CreditNote {
  id: string;
  credit_note_number: string;
  invoice_id: string;
  amount: number;
  reason: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Hook
// ============================================================================

export function useInvoiceActions() {
  const { toast } = useToast();

  // Send invoice email
  const sendInvoiceEmail = useMutation({
    mutationFn: async ({ invoiceId, email }: SendInvoiceEmailRequest) => {
      const response = await apiClient.post(`/billing/invoices/${invoiceId}/send`, { email });
      return response.data;
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Invoice Sent",
        description: `Invoice has been sent successfully${variables.email ? ` to ${variables.email}` : ""}.`,
      });
    },
    onError: (error: any) => {
      logger.error("Failed to send invoice email", error);
      toast({
        title: "Failed to Send Invoice",
        description: error.response?.data?.detail || "Unable to send invoice. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Void invoice
  const voidInvoice = useMutation({
    mutationFn: async ({ invoiceId, reason }: VoidInvoiceRequest) => {
      const response = await apiClient.post(`/billing/invoices/${invoiceId}/void`, { reason });
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Invoice Voided",
        description: "Invoice has been voided successfully.",
      });
    },
    onError: (error: any) => {
      logger.error("Failed to void invoice", error);
      toast({
        title: "Failed to Void Invoice",
        description: error.response?.data?.detail || "Unable to void invoice. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Send payment reminder
  const sendPaymentReminder = useMutation({
    mutationFn: async ({ invoiceId, message }: SendPaymentReminderRequest) => {
      const response = await apiClient.post(`/billing/invoices/${invoiceId}/remind`, { message });
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Reminder Sent",
        description: "Payment reminder has been sent successfully.",
      });
    },
    onError: (error: any) => {
      logger.error("Failed to send payment reminder", error);
      toast({
        title: "Failed to Send Reminder",
        description:
          error.response?.data?.detail || "Unable to send payment reminder. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create credit note
  const createCreditNote = useMutation({
    mutationFn: async (data: CreateCreditNoteRequest): Promise<CreditNote> => {
      const response = await apiClient.post("/billing/credit-notes", data);
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: "Credit Note Created",
        description: `Credit note ${data.credit_note_number} has been created successfully.`,
      });
    },
    onError: (error: any) => {
      logger.error("Failed to create credit note", error);
      toast({
        title: "Failed to Create Credit Note",
        description:
          error.response?.data?.detail || "Unable to create credit note. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    // Mutations
    sendInvoiceEmail,
    voidInvoice,
    sendPaymentReminder,
    createCreditNote,

    // Loading states
    isSending: sendInvoiceEmail.isPending,
    isVoiding: voidInvoice.isPending,
    isSendingReminder: sendPaymentReminder.isPending,
    isCreatingCreditNote: createCreditNote.isPending,

    // Combined loading state
    isLoading:
      sendInvoiceEmail.isPending ||
      voidInvoice.isPending ||
      sendPaymentReminder.isPending ||
      createCreditNote.isPending,
  };
}
