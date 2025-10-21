"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import type { DunningCampaign } from "@/types";
import { useCampaignWebSocket, useUpdateCampaign } from "@/hooks/useCampaigns";
import { AlertTriangle } from "lucide-react";

interface CampaignControlDialogProps {
  campaign: DunningCampaign | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CampaignControlDialog({
  campaign,
  open,
  onOpenChange,
}: CampaignControlDialogProps) {
  const { toast } = useToast();
  const [cancelReason, setCancelReason] = useState("");
  const updateCampaign = useUpdateCampaign();
  const { pause, resume, cancel, isConnected } = useCampaignWebSocket(campaign?.id ?? null);

  if (!campaign) {
    return null;
  }

  const handlePause = async () => {
    try {
      pause();
      await updateCampaign.mutateAsync({
        campaignId: campaign.id,
        data: { is_active: false },
      });
      toast({
        title: "Campaign paused",
        description: `${campaign.name} is paused.`,
      });
    } catch (error) {
      toast({
        title: "Pause failed",
        description: error instanceof Error ? error.message : "Unable to pause campaign",
        variant: "destructive",
      });
    }
  };

  const handleResume = async () => {
    try {
      resume();
      await updateCampaign.mutateAsync({
        campaignId: campaign.id,
        data: { is_active: true },
      });
      toast({
        title: "Campaign resumed",
        description: `${campaign.name} has been resumed.`,
      });
    } catch (error) {
      toast({
        title: "Resume failed",
        description: error instanceof Error ? error.message : "Unable to resume campaign",
        variant: "destructive",
      });
    }
  };

  const handleCancel = async () => {
    try {
      cancel();
      await updateCampaign.mutateAsync({
        campaignId: campaign.id,
        data: { is_active: false },
      });
      toast({
        title: "Campaign cancelled",
        description: cancelReason ? cancelReason : `${campaign.name} has been cancelled.`,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Cancel failed",
        description: error instanceof Error ? error.message : "Unable to cancel campaign",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Campaign Control</DialogTitle>
          <DialogDescription>Pause, resume, or cancel the campaign in real time.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">{campaign.name}</h3>
              <Badge variant={campaign.is_active ? "outline" : "secondary"}>
                {campaign.is_active ? "ACTIVE" : "INACTIVE"}
              </Badge>
            </div>
            {campaign.description && (
              <p className="text-sm text-muted-foreground">{campaign.description}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <span className="text-muted-foreground">Trigger after</span>
              <span className="ml-2 font-medium">{campaign.trigger_after_days} days</span>
            </div>
            <div>
              <span className="text-muted-foreground">Retry interval</span>
              <span className="ml-2 font-medium">{campaign.retry_interval_days} days</span>
            </div>
            <div>
              <span className="text-muted-foreground">Max retries</span>
              <span className="ml-2 font-medium">{campaign.max_retries}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Priority</span>
              <span className="ml-2 font-medium">{campaign.priority}</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <span className="text-muted-foreground">Executions</span>
              <div className="text-2xl font-semibold">{campaign.total_executions}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Recoveries</span>
              <div className="text-2xl font-semibold">{campaign.successful_executions}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Recovered amount</span>
              <div className="text-2xl font-semibold">
                $
                {(campaign.total_recovered_amount / 100).toLocaleString(undefined, {
                  style: "currency",
                  currency: "USD",
                })}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border/60 bg-card/40 p-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              WebSocket status: {isConnected ? "Connected" : "Disconnected"}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Cancellation reason (optional)
            </label>
            <Textarea
              placeholder="Add context for cancelling this campaign"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Actions are executed immediately via the campaign control worker.
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePause} disabled={!campaign.is_active}>
              Pause
            </Button>
            <Button variant="outline" onClick={handleResume} disabled={campaign.is_active}>
              Resume
            </Button>
            <Button variant="destructive" onClick={handleCancel}>
              Cancel campaign
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
