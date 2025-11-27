/**
 * Invoice Detail Modal
 *
 * Wrapper that connects the shared InvoiceDetailModal to app-specific hooks and utilities.
 */

"use client";

import { useState, useEffect } from "react";
import {
  InvoiceDetailModal as SharedInvoiceDetailModal,
  type CompanyInfo,
  type CustomerInfo,
  type Invoice as SharedInvoice,
} from "@dotmac/features/billing";
import { type Invoice } from "@/types/billing";
import { useInvoiceActions } from "@/hooks/useInvoiceActions";
import { RecordPaymentModal } from "./RecordPaymentModal";
import { CreateCreditNoteModal } from "./CreateCreditNoteModal";
import { InvoicePDFGenerator } from "@/lib/pdf/invoice-pdf";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import { useToast } from "@dotmac/ui";

interface InvoiceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onUpdate?: () => void;
  onRecordPayment?: (invoice: Invoice) => void;
}

export function InvoiceDetailModal({
  isOpen,
  onClose,
  invoice,
  onUpdate,
  onRecordPayment,
}: InvoiceDetailModalProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  // Invoice actions hook
  const {
    sendInvoiceEmail,
    voidInvoice,
    sendPaymentReminder,
    isLoading: isActionLoading,
  } = useInvoiceActions();

  // Fetch company info from settings
  useEffect(() => {
    const fetchCompanyInfo = async () => {
      try {
        const response = await apiClient.get("/settings/company");
        if (response.data) {
          setCompanyInfo(response.data);
        }
      } catch (error) {
        logger.error(
          "Failed to fetch company info for invoice detail",
          error instanceof Error ? error : new Error(String(error)),
        );
        // Use fallback data if API fails
        setCompanyInfo({
          name: "Your ISP Company",
          address: "123 Main Street",
          city: "Your City",
          state: "ST",
          zip: "12345",
          phone: "(555) 123-4567",
          email: "billing@yourisp.com",
          website: "www.yourisp.com",
        });
      }
    };

    if (isOpen && invoice) {
      fetchCompanyInfo();
    }
  }, [isOpen, invoice]);

  // Fetch customer info
  useEffect(() => {
    const fetchCustomerInfo = async () => {
      if (!invoice?.customer_id) return;

      try {
        const response = await apiClient.get(`/customers/${invoice.customer_id}`);
        if (response.data) {
          setCustomerInfo(response.data);
        }
      } catch (error) {
        logger.error(
          "Failed to fetch customer info for invoice detail",
          error instanceof Error ? error : new Error(String(error)),
          { customerId: invoice.customer_id },
        );
        // Fallback to just customer ID
        setCustomerInfo({ name: `Customer ${invoice.customer_id}` });
      }
    };

    if (isOpen && invoice) {
      fetchCustomerInfo();
    }
  }, [isOpen, invoice]);

  const handleSendEmail = async () => {
    if (!invoice) return;
    await sendInvoiceEmail.mutateAsync({
      invoiceId: invoice.invoice_id,
      ...(invoice.billing_email && { email: invoice.billing_email }),
    });
    if (onUpdate) onUpdate();
  };

  const handleVoid = async () => {
    if (!invoice) return;
    // eslint-disable-next-line no-alert
    const reason = prompt(
      `Are you sure you want to void invoice ${invoice.invoice_number}?\n\nThis action cannot be undone. Please provide a reason:`,
    );
    if (!reason) return;

    await voidInvoice.mutateAsync({
      invoiceId: invoice.invoice_id,
      reason,
    });
    if (onUpdate) onUpdate();
  };

  const handleSendReminder = async () => {
    if (!invoice) return;
    await sendPaymentReminder.mutateAsync({
      invoiceId: invoice.invoice_id,
    });
    if (onUpdate) onUpdate();
  };

  const handleDownloadPDF = async () => {
    if (!invoice) return;
    setIsProcessing(true);
    try {
      const generator = new InvoicePDFGenerator();

      // Use fetched company info or fallback
      const company = companyInfo || {
        name: "Your ISP Company",
        address: "123 Main Street",
        city: "Your City",
        state: "ST",
        zip: "12345",
        phone: "(555) 123-4567",
        email: "billing@yourisp.com",
        website: "www.yourisp.com",
      };

      // Use fetched customer info or fallback
      const customerName =
        customerInfo?.name ||
        customerInfo?.full_name ||
        customerInfo?.company_name ||
        `Customer ${invoice.customer_id}`;

      await generator.downloadInvoicePDF({
        company,
        invoice,
        customerName,
      });

      toast({
        title: "PDF Downloaded",
        description: `Invoice ${invoice.invoice_number} has been downloaded as PDF.`,
      });
    } catch (error) {
      logger.error(
        "Failed to generate invoice PDF",
        error instanceof Error ? error : new Error(String(error)),
        { invoiceId: invoice.invoice_id },
      );
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecordPayment = () => {
    if (onRecordPayment && invoice) {
      onRecordPayment(invoice);
    } else {
      setShowPaymentModal(true);
    }
  };

  const handleCreateCreditNote = () => {
    setShowCreditNoteModal(true);
  };

  const sharedInvoice = (invoice as unknown as SharedInvoice) || null;

  return (
    <SharedInvoiceDetailModal
      isOpen={isOpen}
      onClose={onClose}
      invoice={sharedInvoice}
      companyInfo={companyInfo}
      customerInfo={customerInfo}
      onSendEmail={handleSendEmail}
      onVoid={handleVoid}
      onSendReminder={handleSendReminder}
      onDownloadPDF={handleDownloadPDF}
      {...(handleRecordPayment && { onRecordPayment: handleRecordPayment })}
      onCreateCreditNote={handleCreateCreditNote}
      {...(onUpdate && { onUpdate })}
      isProcessing={isProcessing}
      isActionLoading={isActionLoading}
      RecordPaymentModal={RecordPaymentModal}
      CreateCreditNoteModal={CreateCreditNoteModal}
      showPaymentModal={showPaymentModal}
      setShowPaymentModal={setShowPaymentModal}
      showCreditNoteModal={showCreditNoteModal}
      setShowCreditNoteModal={setShowCreditNoteModal}
    />
  );
}
