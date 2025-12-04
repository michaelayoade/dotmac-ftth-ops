/**
 * Campaign Control Dialog
 *
 * Dialog for controlling campaign execution (pause, resume, cancel).
 * Shared between ISP Ops and Platform Admin applications.
 */

"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

export interface DunningCampaign {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  trigger_after_days: number;
  retry_interval_days: number;
  max_retries: number;
  priority: number;
  total_executions: number;
  successful_executions: number;
  total_recovered_amount: number;
}

interface CampaignWebSocketControl {
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  isConnected: boolean;
}

interface UpdateCampaignMutation {
  mutateAsync: (params: { campaignId: string; data: any }) => Promise<void>;
}

export interface CampaignControlDialogProps<TCampaign = any> {
  campaign: TCampaign | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  useCampaignWebSocket: (campaignId: string | null) => CampaignWebSocketControl;
  useUpdateCampaign: () => UpdateCampaignMutation;
}

export function CampaignControlDialog<TCampaign = any>({
  campaign,
  open,
  onOpenChange,
  useCampaignWebSocket,
  useUpdateCampaign,
}: CampaignControlDialogProps<TCampaign>) {
  const { toast } = useToast();
  const [cancelReason, setCancelReason] = useState("");
  const updateCampaign = useUpdateCampaign();

  const campaignData = campaign as any;
  const campaignId = campaignData?.id ?? null;
  const { pause, resume, cancel, isConnected } = useCampaignWebSocket(campaignId);

  if (!campaign) {
    return null;
  }

  const handlePause = async () => {
    try {
      pause();
      await updateCampaign.mutateAsync({
        campaignId: campaignData.id,
        data: { is_active: false },
      });
      toast({
        title: "Campaign paused",
        description: `${campaignData.name} is paused.`,
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
        campaignId: campaignData.id,
        data: { is_active: true },
      });
      toast({
        title: "Campaign resumed",
        description: `${campaignData.name} has been resumed.`,
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
        campaignId: campaignData.id,
        data: { is_active: false },
      });
      toast({
        title: "Campaign cancelled",
        description: cancelReason ? cancelReason : `${campaignData.name} has been cancelled.`,
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
              <h3 className="text-lg font-semibold text-foreground">{campaignData.name}</h3>
              <Badge variant={campaignData.is_active ? "outline" : "secondary"}>
                {campaignData.is_active ? "ACTIVE" : "INACTIVE"}
              </Badge>
            </div>
            {campaignData.description && (
              <p className="text-sm text-muted-foreground">{campaignData.description}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <span className="text-muted-foreground">Trigger after</span>
              <span className="ml-2 font-medium">{campaignData.trigger_after_days} days</span>
            </div>
            <div>
              <span className="text-muted-foreground">Retry interval</span>
              <span className="ml-2 font-medium">{campaignData.retry_interval_days} days</span>
            </div>
            <div>
              <span className="text-muted-foreground">Max retries</span>
              <span className="ml-2 font-medium">{campaignData.max_retries}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Priority</span>
              <span className="ml-2 font-medium">{campaignData.priority}</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <span className="text-muted-foreground">Executions</span>
              <div className="text-2xl font-semibold">{campaignData.total_executions}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Recoveries</span>
              <div className="text-2xl font-semibold">{campaignData.successful_executions}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Recovered amount</span>
              <div className="text-2xl font-semibold">
                $
                {(campaignData.total_recovered_amount / 100).toLocaleString(undefined, {
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
            <Button variant="outline" onClick={handlePause} disabled={!campaignData.is_active}>
              Pause
            </Button>
            <Button variant="outline" onClick={handleResume} disabled={campaignData.is_active}>
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
