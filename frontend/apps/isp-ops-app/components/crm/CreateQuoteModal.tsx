/**
 * Create Quote Modal
 *
 * Wrapper that connects the shared CreateQuoteModal to app-specific hooks.
 */

"use client";

import { useState } from "react";
import {
  CreateQuoteModal as SharedCreateQuoteModal,
  type CreateQuoteModalProps as SharedCreateQuoteModalProps,
  type QuoteCreateRequest,
} from "@dotmac/features/crm";
import { type Quote, useLeads, useQuotes } from "@/hooks/useCRM";
import { useToast } from "@dotmac/ui";

interface CreateQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  quote?: Quote | null;
  leadId?: string;
}

export function CreateQuoteModal({
  isOpen,
  onClose,
  onSuccess,
  quote,
  leadId,
}: CreateQuoteModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { leads } = useLeads();
  const { createQuote } = useQuotes();

  const handleCreate = async (data: QuoteCreateRequest) => {
    setIsSubmitting(true);
    try {
      await createQuote(data);
      toast({
        title: quote ? "Quote Updated" : "Quote Created",
        description: quote
          ? "Quote has been successfully updated."
          : `Quote for ${data.service_plan_name} has been created.`,
      });
    } catch (error) {
      console.error("Failed to create/update quote:", error);
      toast({
        title: "Error",
        description: "Failed to save quote. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SharedCreateQuoteModal
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={onSuccess}
      onCreate={handleCreate}
      quote={quote as any}
      leadId={leadId}
      leads={leads as any}
      isSubmitting={isSubmitting}
    />
  );
}
