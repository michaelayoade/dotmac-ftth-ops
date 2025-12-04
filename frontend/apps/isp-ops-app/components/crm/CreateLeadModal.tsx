/**
 * Create Lead Modal
 *
 * Wrapper that connects the shared CreateLeadModal to app-specific hooks.
 */

"use client";

import { useState } from "react";
import {
  CreateLeadModal as SharedCreateLeadModal,
  type LeadCreateRequest as SharedLeadCreateRequest,
} from "@dotmac/features/crm";
import { useToast } from "@dotmac/ui";
import { type LeadCreateRequest as HookLeadCreateRequest } from "@/hooks/useCRM";

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onCreate: (data: HookLeadCreateRequest) => Promise<any>;
}

export function CreateLeadModal({ isOpen, onClose, onSuccess, onCreate }: CreateLeadModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (data: SharedLeadCreateRequest) => {
    setIsSubmitting(true);

    try {
      const payload: HookLeadCreateRequest = {
        ...(data as any),
      };
      await onCreate(payload);

      toast({
        title: "Lead Created",
        description: `${data.first_name} ${data.last_name} has been added to the pipeline.`,
      });
    } catch (error) {
      console.error("Failed to create lead:", error);
      toast({
        title: "Error",
        description: "Failed to create lead. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SharedCreateLeadModal
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={onSuccess}
      onCreate={handleCreate}
      isSubmitting={isSubmitting}
    />
  );
}
