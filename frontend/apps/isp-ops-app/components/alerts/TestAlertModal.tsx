"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@dotmac/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { apiClient } from "@/lib/api/client";

interface TestAlertModalProps {
  isOpen: boolean;
  channel: { id: string; name: string };
  onClose: () => void;
  onSuccess: () => void;
}

export function TestAlertModal({ isOpen, channel, onClose, onSuccess }: TestAlertModalProps) {
  const [message, setMessage] = useState("Test alert from DotMac monitoring");

  const testMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/alerts/test", {
        channel_id: channel.id,
        severity: "warning",
        message,
      });
    },
    onSuccess: () => onSuccess(),
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Test Alert: {channel.name}</DialogTitle>
        </DialogHeader>

        {testMutation.isSuccess && (
          <Alert>
            <AlertDescription>Test alert sent successfully!</AlertDescription>
          </Alert>
        )}

        {testMutation.error && (
          <Alert variant="destructive">
            <AlertDescription>Failed to send test alert</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="message">Test Message</Label>
          <Input id="message" value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>
            {testMutation.isPending ? "Sending..." : "Send Test Alert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
