"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Clock, Coffee } from "lucide-react";
import { Button } from "@dotmac/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { apiClient } from "@/lib/api/client";

type AgentStatus = "available" | "busy" | "offline" | "away";

interface AgentAvailability {
  user_id: string;
  tenant_id: string | null;
  status: AgentStatus;
  status_message: string | null;
  last_activity_at: string;
  updated_at: string;
}

const STATUS_CONFIG = {
  available: {
    label: "Available",
    icon: CheckCircle2,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  busy: {
    label: "Busy",
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
  away: {
    label: "Away",
    icon: Coffee,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
  },
  offline: {
    label: "Offline",
    icon: Clock,
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
  },
};

export function AgentStatusWidget() {
  const queryClient = useQueryClient();
  const [statusMessage, setStatusMessage] = useState("");

  // Fetch current user's availability
  const { data: availability, isLoading } = useQuery({
    queryKey: ["agent-availability-me"],
    queryFn: async () => {
      const response = await apiClient.get("/tickets/agents/availability/me");
      return response.data as AgentAvailability;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Sync status message with current availability
  useEffect(() => {
    if (availability?.status_message) {
      setStatusMessage(availability.status_message);
    }
  }, [availability]);

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (data: { status: AgentStatus; status_message?: string }) => {
      await apiClient.patch("/tickets/agents/availability/me", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-availability-me"] });
    },
  });

  const handleStatusChange = (newStatus: AgentStatus) => {
    const payload: { status: AgentStatus; status_message?: string } = { status: newStatus };
    if (statusMessage) {
      payload.status_message = statusMessage;
    }
    updateStatusMutation.mutate(payload);
  };

  const handleMessageUpdate = () => {
    if (availability) {
      const payload: { status: AgentStatus; status_message?: string } = {
        status: availability.status,
      };
      if (statusMessage) {
        payload.status_message = statusMessage;
      }
      updateStatusMutation.mutate(payload);
    }
  };

  if (isLoading || !availability) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-sm">Agent Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const config = STATUS_CONFIG[availability.status];
  const StatusIcon = config.icon;

  return (
    <Card className={`w-full border-2 ${config.borderColor} ${config.bgColor}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <StatusIcon className={`h-4 w-4 ${config.color}`} />
          Your Availability Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Selector */}
        <div className="space-y-2">
          <Label htmlFor="status">Current Status</Label>
          <Select
            value={availability.status}
            onValueChange={(value) => handleStatusChange(value as AgentStatus)}
            disabled={updateStatusMutation.isPending}
          >
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_CONFIG).map(([status, conf]) => {
                const Icon = conf.icon;
                return (
                  <SelectItem key={status} value={status}>
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${conf.color}`} />
                      <span>{conf.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Status Message */}
        <div className="space-y-2">
          <Label htmlFor="status-message">Status Message (Optional)</Label>
          <div className="flex gap-2">
            <Input
              id="status-message"
              placeholder="e.g., Back in 15 minutes"
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value)}
              maxLength={500}
            />
            <Button
              variant="outline"
              onClick={handleMessageUpdate}
              disabled={updateStatusMutation.isPending}
            >
              Save
            </Button>
          </div>
        </div>

        {/* Last Updated */}
        <div className="text-xs text-muted-foreground">
          Last updated: {new Date(availability.updated_at).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  const variant =
    status === "available"
      ? "default"
      : status === "busy"
        ? "destructive"
        : status === "away"
          ? "secondary"
          : "outline";

  return (
    <Badge variant={variant}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}
