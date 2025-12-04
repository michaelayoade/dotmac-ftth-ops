"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RadiusSessionMonitor } from "@dotmac/features/radius";
import type { RADIUSSession } from "@dotmac/features/radius";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import { useToast } from "@dotmac/ui";
import { useConfirmDialog } from "@dotmac/ui";

export default function RADIUSSessionsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const confirmDialog = useConfirmDialog();

  // Fetch active sessions
  const {
    data: sessions,
    isLoading,
    refetch,
  } = useQuery<RADIUSSession[]>({
    queryKey: ["radius-sessions"],
    queryFn: async () => {
      try {
        const response = await apiClient.get("/radius/sessions");
        return response.data;
      } catch (error) {
        logger.error("Failed to fetch RADIUS sessions", { error });
        throw error;
      }
    },
    refetchInterval: 15000, // Auto-refresh every 15 seconds
  });

  // Disconnect session mutation
  const disconnectMutation = useMutation({
    mutationFn: async (session: RADIUSSession) => {
      const response = await apiClient.post("/radius/sessions/disconnect", {
        username: session.username,
        acctsessionid: session.acctsessionid,
        nasipaddress: session.nasipaddress,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radius-sessions"] });
      toast({
        title: "Session disconnected",
        description: "The session has been disconnected successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to disconnect session",
        variant: "destructive",
      });
    },
  });

  const handleDisconnect = async (session: RADIUSSession) => {
    const confirmed = await confirmDialog({
      title: "Disconnect session",
      description: `Are you sure you want to disconnect session for "${session.username}"? The user will be forced to re-authenticate.`,
      confirmText: "Disconnect",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }
    disconnectMutation.mutate(session);
  };

  return (
    <RadiusSessionMonitor
      sessions={sessions ?? []}
      isLoading={isLoading}
      onRefresh={() => refetch()}
      onDisconnect={handleDisconnect}
      isDisconnecting={disconnectMutation.isPending}
    />
  );
}
