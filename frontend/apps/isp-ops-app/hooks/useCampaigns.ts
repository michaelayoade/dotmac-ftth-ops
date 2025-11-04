import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";
import type { DunningCampaign } from "@/types";

type CampaignListKey = ["campaigns", { active?: boolean | null }];

interface UseCampaignsOptions {
  active?: boolean;
}

export function useCampaigns({ active }: UseCampaignsOptions = {}) {
  return useQuery<DunningCampaign[], Error, DunningCampaign[], CampaignListKey>({
    queryKey: ["campaigns", { active: active ?? null }],
    queryFn: async () => {
      const response = await apiClient.get<DunningCampaign[]>("/billing/dunning/campaigns", {
        params: active === undefined ? undefined : { is_active: active },
      });
      return extractDataOrThrow(response);
    },
    staleTime: 30_000,
  });
}

interface UpdateCampaignStatusVariables {
  campaignId: string;
  data: Partial<Pick<DunningCampaign, "is_active" | "priority">> & Record<string, unknown>;
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  return useMutation<DunningCampaign, Error, UpdateCampaignStatusVariables>({
    mutationFn: async ({ campaignId, data }) => {
      const response = await apiClient.patch<DunningCampaign>(
        `/api/v1/billing/dunning/campaigns/${campaignId}`,
        data,
      );
      return extractDataOrThrow(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

export function useCampaignWebSocket(campaignId: string | null) {
  const [socket, setSocket] = React.useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);

  React.useEffect(() => {
    if (!campaignId) {
      return;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    if (!token) {
      return;
    }

    const base = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8001";
    const url = `${base}/api/v1/realtime/ws/campaigns/${campaignId}?token=${token}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setIsConnected(true);
    };
    ws.onclose = () => {
      setIsConnected(false);
    };
    ws.onerror = () => {
      setIsConnected(false);
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, [campaignId]);

  const sendCommand = React.useCallback(
    (type: "pause_campaign" | "resume_campaign" | "cancel_campaign") => {
      if (socket && isConnected) {
        socket.send(JSON.stringify({ type }));
      }
    },
    [socket, isConnected],
  );

  return {
    socket,
    isConnected,
    pause: React.useCallback(() => sendCommand("pause_campaign"), [sendCommand]),
    resume: React.useCallback(() => sendCommand("resume_campaign"), [sendCommand]),
    cancel: React.useCallback(() => sendCommand("cancel_campaign"), [sendCommand]),
  };
}
