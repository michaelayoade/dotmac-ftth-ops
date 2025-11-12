/**
 * Create Quote Modal
 *
 * Wrapper that connects the shared CreateQuoteModal to app-specific hooks.
 */

"use client";

import { useMemo, useState } from "react";
import {
  CreateQuoteModal as SharedCreateQuoteModal,
  type CreateQuoteModalProps as SharedCreateQuoteModalProps,
  type QuoteCreateRequest as SharedQuoteCreateRequest,
} from "@dotmac/features/crm";
import {
  type Quote,
  useLeads,
  useCreateQuote,
  type QuoteCreateRequest as CRMQuoteCreateRequest,
} from "@/hooks/useCRM";
import { mapLeadsToShared, mapQuoteToShared } from "./crmMapping";
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

  const { data: leads = [] } = useLeads();
  const createQuoteMutation = useCreateQuote();

  const handleCreate = async (data: SharedQuoteCreateRequest) => {
    setIsSubmitting(true);
    try {
      const payload: CRMQuoteCreateRequest = {
        lead_id: data.lead_id,
        service_plan_name: data.service_plan_name,
        bandwidth: data.bandwidth,
        monthly_recurring_charge: data.monthly_recurring_charge,
        valid_until: data.valid_until,
        ...(data.installation_fee !== undefined && { installation_fee: data.installation_fee }),
        ...(data.equipment_fee !== undefined && { equipment_fee: data.equipment_fee }),
        ...(data.activation_fee !== undefined && { activation_fee: data.activation_fee }),
        ...(data.contract_term_months !== undefined && {
          contract_term_months: data.contract_term_months,
        }),
        ...(data.early_termination_fee !== undefined && {
          early_termination_fee: data.early_termination_fee,
        }),
        ...(data.promo_discount_months !== undefined && {
          promo_discount_months: data.promo_discount_months,
        }),
        ...(data.promo_monthly_discount !== undefined && {
          promo_monthly_discount: data.promo_monthly_discount,
        }),
        ...(data.line_items?.length ? { line_items: data.line_items } : {}),
        ...(data.notes && { notes: data.notes }),
      };

      await createQuoteMutation.mutateAsync(payload);
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

  const sharedQuote = quote ? mapQuoteToShared(quote) : undefined;
  const sharedLeads = useMemo(() => mapLeadsToShared(leads), [leads]);

  return (
    <SharedCreateQuoteModal
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={onSuccess ?? (() => undefined)}
      onCreate={handleCreate}
      quote={sharedQuote ?? null}
      leadId={leadId}
      leads={sharedLeads}
      isSubmitting={isSubmitting}
    />
  );
}
