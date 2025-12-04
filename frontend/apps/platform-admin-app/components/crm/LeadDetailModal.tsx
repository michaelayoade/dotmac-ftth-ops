/**
 * Lead Detail Modal
 *
 * Wrapper that connects the shared LeadDetailModal to app-specific hooks.
 */

"use client";

import { useMemo, useState } from "react";
import {
  LeadDetailModal as SharedLeadDetailModal,
  type Lead as SharedLead,
  type LeadUpdateRequest,
} from "@dotmac/features/crm";
import {
  type Lead,
  useQuotes,
  useUpdateLead,
  useQualifyLead,
  useDisqualifyLead,
  useConvertToCustomer,
} from "@/hooks/useCRM";
import { useToast } from "@dotmac/ui";
import { mapQuotesToShared } from "./crmMapping";

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
  const updateLeadMutation = useUpdateLead();
  const qualifyLeadMutation = useQualifyLead();
  const disqualifyLeadMutation = useDisqualifyLead();
  const convertLeadMutation = useConvertToCustomer();
  const { data: quotes = [] } = useQuotes(lead?.id ? { leadId: lead.id } : {});
  const sharedQuotes = useMemo(() => mapQuotesToShared(quotes), [quotes]);

  const handleSave = async (leadId: string, data: Partial<LeadUpdateRequest>) => {
    setIsSaving(true);
    try {
      await updateLeadMutation.mutateAsync({ id: leadId, ...data });
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
      await qualifyLeadMutation.mutateAsync(leadId);
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
      await disqualifyLeadMutation.mutateAsync({ id: leadId, reason });
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
      await convertLeadMutation.mutateAsync({ id: leadId });
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
      lead={lead as unknown as SharedLead}
      quotes={sharedQuotes}
      surveys={[]}
      onUpdate={onUpdate ?? (() => undefined)}
      onSave={handleSave}
      onQualify={handleQualify}
      onDisqualify={handleDisqualify}
      onConvert={handleConvert}
      isSaving={isSaving}
    />
  );
}
