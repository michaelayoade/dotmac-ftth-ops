import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dunningService,
  type DunningCampaign,
  type DunningCampaignUpdate,
} from "@/lib/services/dunning-service";

type CampaignListKey = ["campaigns", { active?: boolean | null }];

interface UseCampaignsOptions {
  active?: boolean;
}

export function useCampaigns({ active }: UseCampaignsOptions = {}) {
  return useQuery<DunningCampaign[], Error, DunningCampaign[], CampaignListKey>({
    queryKey: ["campaigns", { active: active ?? null }],
    queryFn: async () => {
      const filters =
        active === undefined
          ? {}
          : {
              activeOnly: active,
            };
      return dunningService.listCampaigns(filters);
    },
    staleTime: 30_000,
  });
}

interface UpdateCampaignStatusVariables {
  campaignId: string;
  data: Partial<Pick<DunningCampaign, "is_active" | "priority">> & DunningCampaignUpdate;
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<{
    data: DunningCampaign | undefined;
    error: Error | null;
    isPending: boolean;
    isSuccess: boolean;
  }>({
    data: undefined,
    error: null,
    isPending: false,
    isSuccess: false,
  });

  const mutateAsync = useCallback(
    async ({ campaignId, data }: UpdateCampaignStatusVariables) => {
      setState((prev) => ({
        ...prev,
        isPending: true,
        error: null,
      }));

      try {
        const result = await dunningService.updateCampaign(campaignId, data);
        setState({
          data: result,
          error: null,
          isPending: false,
          isSuccess: true,
        });
        queryClient.invalidateQueries({ queryKey: ["campaigns"] });
        return result;
      } catch (error) {
        const normalizedError =
          error instanceof Error ? error : new Error("Failed to update campaign");
        setState((prev) => ({
          ...prev,
          error: normalizedError,
          isPending: false,
          isSuccess: false,
        }));
        throw normalizedError;
      }
    },
    [queryClient],
  );

  const mutate = useCallback(
    (
      variables: UpdateCampaignStatusVariables,
      callbacks?: {
        onSuccess?: (data: DunningCampaign) => void;
        onError?: (error: Error) => void;
      },
    ) => {
      void mutateAsync(variables)
        .then((data) => {
          callbacks?.onSuccess?.(data);
        })
        .catch((error: Error) => {
          callbacks?.onError?.(error);
        });
    },
    [mutateAsync],
  );

  const reset = useCallback(() => {
    setState({
      data: undefined,
      error: null,
      isPending: false,
      isSuccess: false,
    });
  }, []);

  return {
    mutate,
    mutateAsync,
    reset,
    data: state.data,
    error: state.error,
    isPending: state.isPending,
    isSuccess: state.isSuccess,
  };
}

/**
 * WebSocket hook for campaign control
 * Re-exports the shared implementation from useRealtime which has proper auth
 */
export { useCampaignWebSocket } from "./useRealtime";
