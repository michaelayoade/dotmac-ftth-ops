/**
 * Quote Detail Modal
 *
 * Wrapper that connects the shared QuoteDetailModal to app-specific hooks.
 */

"use client";

import { useCallback, useState } from "react";
import {
  QuoteDetailModal as SharedQuoteDetailModal,
  type QuoteDetailModalProps as SharedQuoteDetailModalProps,
} from "@dotmac/features/crm";
import {
  type Quote,
  useSendQuote,
  useAcceptQuote,
  useRejectQuote,
  useDeleteQuote,
} from "@/hooks/useCRM";
import { useToast } from "@dotmac/ui";
import { apiClient } from "@/lib/api/client";

interface QuoteDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  quote: Quote | null;
  onUpdate?: () => void;
  onEdit?: (quote: Quote) => void;
}

export function QuoteDetailModal({
  isOpen,
  onClose,
  quote,
  onUpdate,
  onEdit,
}: QuoteDetailModalProps) {
  const { toast } = useToast();
  const sendQuoteMutation = useSendQuote();
  const acceptQuoteMutation = useAcceptQuote();
  const rejectQuoteMutation = useRejectQuote();
  const deleteQuoteMutation = useDeleteQuote();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSend = async (quoteId: string) => {
    setIsProcessing(true);
    try {
      await sendQuoteMutation.mutateAsync(quoteId);
      toast({
        title: "Quote Sent",
        description: `Quote ${quote?.quote_number} has been sent to the lead.`,
      });
    } catch (error) {
      console.error("Failed to send quote:", error);
      toast({
        title: "Error",
        description: "Failed to send quote. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAccept = async (quoteId: string, signatureData: any) => {
    setIsProcessing(true);
    try {
      await acceptQuoteMutation.mutateAsync({ id: quoteId, signatureData });
      toast({
        title: "Quote Accepted",
        description: `Quote ${quote?.quote_number} has been accepted! Ready to convert lead.`,
      });
    } catch (error) {
      console.error("Failed to accept quote:", error);
      toast({
        title: "Error",
        description: "Failed to accept quote. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (quoteId: string, reason: string) => {
    setIsProcessing(true);
    try {
      await rejectQuoteMutation.mutateAsync({ id: quoteId, reason });
      toast({
        title: "Quote Rejected",
        description: `Quote ${quote?.quote_number} has been rejected.`,
      });
    } catch (error) {
      console.error("Failed to reject quote:", error);
      toast({
        title: "Error",
        description: "Failed to reject quote. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (quoteId: string) => {
    setIsProcessing(true);
    try {
      await deleteQuoteMutation.mutateAsync(quoteId);
      toast({
        title: "Quote Deleted",
        description: `Quote ${quote?.quote_number} has been deleted successfully.`,
      });
      return true;
    } catch (error) {
      console.error("Failed to delete quote:", error);
      toast({
        title: "Error",
        description: "Failed to delete quote. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFetchCompanyInfo = async () => {
    try {
      const response = await apiClient.get("/settings/company");
      if (response.data) {
        return response.data;
      }
      // Return fallback if no data
      return {
        name: "Your ISP Company",
        address: "123 Main Street",
        city: "Your City",
        state: "ST",
        zip: "12345",
        phone: "(555) 123-4567",
        email: "sales@yourisp.com",
        website: "www.yourisp.com",
      };
    } catch (error) {
      console.error("Failed to fetch company info:", error);
      // Return fallback on error
      return {
        name: "Your ISP Company",
        address: "123 Main Street",
        city: "Your City",
        state: "ST",
        zip: "12345",
        phone: "(555) 123-4567",
        email: "sales@yourisp.com",
        website: "www.yourisp.com",
      };
    }
  };

  const handleEditQuote = useCallback(
    (sharedQuote: any) => {
      if (onEdit) {
        onEdit(sharedQuote as Quote);
      }
    },
    [onEdit],
  );

  return (
    <SharedQuoteDetailModal
      isOpen={isOpen}
      onClose={onClose}
      quote={quote as any}
      onUpdate={onUpdate ?? undefined}
      onEdit={onEdit ? handleEditQuote : undefined}
      onSend={handleSend}
      onAccept={handleAccept}
      onReject={handleReject}
      onDelete={handleDelete}
      onFetchCompanyInfo={handleFetchCompanyInfo}
      isProcessing={isProcessing}
      companyInfo={undefined}
    />
  );
}
