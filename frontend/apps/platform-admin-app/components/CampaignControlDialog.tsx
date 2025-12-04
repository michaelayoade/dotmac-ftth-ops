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
  const useSharedCampaignWebSocket = (campaignId: string | null) => {
    const { pauseCampaign, resumeCampaign, cancelCampaign, isConnected } =
      useCampaignWebSocket(campaignId);

    return {
      pause: pauseCampaign,
      resume: resumeCampaign,
      cancel: cancelCampaign,
      isConnected,
    };
  };

  const useSharedUpdateCampaign = () => {
    const mutation = useUpdateCampaign();
    return {
      mutateAsync: async ({ campaignId, data }: { campaignId: string; data: unknown }) => {
        await mutation.mutateAsync({
          campaignId,
          data: data as Partial<Pick<DunningCampaign, "priority" | "is_active">> &
            Record<string, unknown>,
        });
      },
    };
  };

  return (
    <SharedCampaignControlDialog
      {...props}
      useCampaignWebSocket={useSharedCampaignWebSocket}
      useUpdateCampaign={useSharedUpdateCampaign}
    />
  );
}
