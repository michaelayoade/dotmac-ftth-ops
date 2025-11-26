"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@dotmac/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { apiClient } from "@/lib/api/client";

interface CreateAlertChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateAlertChannelModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateAlertChannelModalProps) {
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    channel_type: "slack" as "slack" | "email" | "webhook" | "pagerduty" | "msteams",
    enabled: true,
    webhook_url: "",
    email_addresses: "",
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload: any = {
        id: data.id || `channel-${Date.now()}`,
        name: data.name,
        channel_type: data.channel_type,
        enabled: data.enabled,
      };

      // Add channel-specific config
      if (data.channel_type === "slack" || data.channel_type === "webhook") {
        payload.webhook_url = data.webhook_url;
      } else if (data.channel_type === "email") {
        payload.email_addresses = data.email_addresses.split(",").map((e) => e.trim());
      }

      await apiClient.post("/alerts/channels", payload);
    },
    onSuccess: () => onSuccess(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Alert Channel</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {createMutation.error && (
            <Alert variant="destructive">
              <AlertDescription>Failed to create channel</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Channel Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Production Alerts Slack"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel_type">Channel Type *</Label>
            <select
              id="channel_type"
              value={formData.channel_type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  channel_type: e.target.value as any,
                })
              }
              className="w-full px-3 py-2 border rounded-md bg-background"
              required
            >
              <option value="slack">Slack</option>
              <option value="email">Email</option>
              <option value="webhook">Webhook</option>
              <option value="pagerduty">PagerDuty</option>
              <option value="msteams">Microsoft Teams</option>
            </select>
          </div>

          {(formData.channel_type === "slack" || formData.channel_type === "webhook") && (
            <div className="space-y-2">
              <Label htmlFor="webhook_url">Webhook URL *</Label>
              <Input
                id="webhook_url"
                value={formData.webhook_url}
                onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                placeholder="https://hooks.slack.com/..."
                required
              />
            </div>
          )}

          {formData.channel_type === "email" && (
            <div className="space-y-2">
              <Label htmlFor="email_addresses">Email Addresses (comma-separated) *</Label>
              <Input
                id="email_addresses"
                value={formData.email_addresses}
                onChange={(e) => setFormData({ ...formData, email_addresses: e.target.value })}
                placeholder="ops@example.com, alerts@example.com"
                required
              />
            </div>
          )}

          <div className="flex items-center space-x-2">
            <input
              id="enabled"
              type="checkbox"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="enabled" className="cursor-pointer">
              Enable channel immediately
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Channel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
