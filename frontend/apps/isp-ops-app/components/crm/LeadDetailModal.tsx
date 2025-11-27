/**
 * Lead Detail Modal
 *
 * Wrapper that connects the shared LeadDetailModal to app-specific hooks.
 */

"use client";

import { useState } from "react";
import {
  LeadDetailModal as SharedLeadDetailModal,
  type LeadDetailModalProps as SharedLeadDetailModalProps,
  type LeadUpdateRequest,
} from "@dotmac/features/crm";
import { type Lead, useLeads, useQuotes, useSiteSurveys } from "@/hooks/useCRM";
import { useToast } from "@dotmac/ui";

interface LeadDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  onUpdate?: () => void;
}

export function LeadDetailModal({ isOpen, onClose, lead, onUpdate }: LeadDetailModalProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // Hooks
  const { updateLead, qualifyLead, disqualifyLead, convertToCustomer } = useLeads();
  const quoteOptions = lead?.id ? { leadId: lead.id } : undefined;
  const surveyOptions = lead?.id ? { leadId: lead.id } : undefined;
  const { quotes } = useQuotes(quoteOptions);
  const { surveys } = useSiteSurveys(surveyOptions);

  const handleSave = async (leadId: string, data: Partial<LeadUpdateRequest>) => {
    setIsSaving(true);
    try {
      await updateLead(leadId, data);
      toast({
        title: "Lead Updated",
        description: "Lead details have been successfully updated.",
      });
    } catch (error) {
      console.error("Failed to update lead:", error);
      toast({
        title: "Error",
        description: "Failed to update lead. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleQualify = async (leadId: string) => {
    try {
      await qualifyLead(leadId);
      toast({
        title: "Lead Qualified",
        description: lead
          ? `${lead.first_name} ${lead.last_name} is now qualified.`
          : "Lead qualified successfully.",
      });
    } catch (error) {
      console.error("Failed to qualify lead:", error);
      toast({
        title: "Error",
        description: "Failed to qualify lead. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDisqualify = async (leadId: string, reason: string) => {
    try {
      await disqualifyLead(leadId, reason);
      toast({
        title: "Lead Disqualified",
        description: lead
          ? `${lead.first_name} ${lead.last_name} has been disqualified.`
          : "Lead disqualified successfully.",
      });
    } catch (error) {
      console.error("Failed to disqualify lead:", error);
      toast({
        title: "Error",
        description: "Failed to disqualify lead. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleConvert = async (leadId: string) => {
    try {
      await convertToCustomer(leadId);
      toast({
        title: "Lead Converted",
        description: lead
          ? `${lead.first_name} ${lead.last_name} is now a customer!`
          : "Lead converted successfully!",
      });
    } catch (error) {
      console.error("Failed to convert lead:", error);
      toast({
        title: "Error",
        description: "Failed to convert lead. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <SharedLeadDetailModal
      isOpen={isOpen}
      onClose={onClose}
      lead={lead as any}
      quotes={quotes as any}
      surveys={surveys as any}
      onSave={handleSave}
      onQualify={handleQualify}
      onDisqualify={handleDisqualify}
      onConvert={handleConvert}
      isSaving={isSaving}
      onUpdate={onUpdate || (() => {})}
    />
  );
}
