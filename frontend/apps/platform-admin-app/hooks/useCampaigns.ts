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
        `/api/isp/v1/admin/billing/dunning/campaigns/${campaignId}`,
        data,
      );
      return extractDataOrThrow(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

/**
 * WebSocket hook for campaign control
 * Re-exports the shared implementation from useRealtime which has proper auth
 */
export { useCampaignWebSocket } from "./useRealtime";
