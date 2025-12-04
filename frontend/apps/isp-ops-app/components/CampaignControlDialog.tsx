/**
 * Campaign Control Dialog
 *
 * Wrapper that connects the shared CampaignControlDialog to app-specific hooks.
 */

"use client";

import { CampaignControlDialog as SharedCampaignControlDialog } from "@dotmac/features/campaigns";
import type { DunningCampaign } from "@/types";
import { useCampaignWebSocket, useUpdateCampaign } from "@/hooks/useCampaigns";

interface CampaignControlDialogProps {
  campaign: DunningCampaign | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CampaignControlDialog(props: CampaignControlDialogProps) {
  return (
    <SharedCampaignControlDialog
      {...props}
      useCampaignWebSocket={useCampaignWebSocket as any}
      useUpdateCampaign={useUpdateCampaign as any}
    />
  );
}
