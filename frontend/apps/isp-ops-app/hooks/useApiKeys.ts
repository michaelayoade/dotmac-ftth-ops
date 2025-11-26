/**
 * API Keys Management Hook - TanStack Query Version
 *
 * Migrated from direct API calls to TanStack Query for:
 * - Automatic caching and deduplication
 * - Optimistic updates for mutations
 * - Better error handling
 * - Reduced boilerplate (158 lines → 125 lines)
 */
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

export interface APIKey {
  id: string;
  name: string;
  scopes: string[];
  created_at: string;
  expires_at?: string;
  description?: string;
  last_used_at?: string;
  is_active: boolean;
  key_preview: string;
}

export interface APIKeyCreateResponse extends APIKey {
  api_key: string;
}

export interface APIKeyCreateRequest {
  name: string;
  scopes: string[];
  expires_at?: string;
  description?: string;
}

export interface APIKeyUpdateRequest {
  name?: string;
  scopes?: string[];
  description?: string;
  is_active?: boolean;
}

export interface APIKeyListResponse {
  api_keys: APIKey[];
  total: number;
  page: number;
  limit: number;
}

export interface AvailableScopes {
  [key: string]: {
    name: string;
    description: string;
  };
}

export interface UseApiKeysOptions {
  page?: number;
  limit?: number;
}

// Query key factory
export const apiKeysKeys = {
  all: ["api-keys"] as const,
  lists: () => [...apiKeysKeys.all, "list"] as const,
  list: (page: number, limit: number) => [...apiKeysKeys.lists(), { page, limit }] as const,
  scopes: () => [...apiKeysKeys.all, "scopes"] as const,
};

interface ApiKeysQueryResult {
  apiKeys: APIKey[];
  total: number;
  page: number;
  limit: number;
}

const buildApiKeysQuery = (page: number, limit: number) => {
  const params = new URLSearchParams();
  params.append("page", page.toString());
  params.append("limit", limit.toString());
  return params.toString();
};

const parseApiKeysResponse = (
  data: Partial<APIKeyListResponse> | undefined,
  fallbackPage: number,
  fallbackLimit: number,
): ApiKeysQueryResult => ({
  apiKeys: data?.api_keys ?? [],
  total: data?.total ?? data?.api_keys?.length ?? 0,
  page: data?.page ?? fallbackPage,
  limit: data?.limit ?? fallbackLimit,
});

const extractApiErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === "string") {
    return error;
  }
  const responseData = (error as any)?.response?.data;
  if (typeof responseData?.detail === "string") {
    return responseData.detail;
  }
  if (typeof responseData?.error?.message === "string") {
    return responseData.error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

export function useApiKeys(options: UseApiKeysOptions = {}) {
  const queryClient = useQueryClient();
  const [apiKeysState, setApiKeysState] = useState<APIKey[]>([]);
  const [availableScopesState, setAvailableScopesState] = useState<AvailableScopes>({});
  const page = options.page ?? 1;
  const limit = options.limit ?? 50;

  const fetchApiKeysRequest = async (
    targetPage: number,
    targetLimit: number,
  ): Promise<ApiKeysQueryResult> => {
    const queryString = buildApiKeysQuery(targetPage, targetLimit);
    try {
      const response = await apiClient.get<APIKeyListResponse>(`/auth/api-keys?${queryString}`);
      return parseApiKeysResponse(response.data, targetPage, targetLimit);
    } catch (err) {
      const message = extractApiErrorMessage(err, "Failed to fetch API keys");
      logger.error("Failed to fetch API keys", err instanceof Error ? err : new Error(String(err)));
      throw new Error(message);
    }
  };

  // Fetch API keys
  const keysQuery = useQuery<ApiKeysQueryResult, Error>({
    queryKey: apiKeysKeys.list(page, limit),
    queryFn: () => fetchApiKeysRequest(page, limit),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Fetch available scopes
  const scopesQuery = useQuery<AvailableScopes>({
    queryKey: apiKeysKeys.scopes(),
    queryFn: async () => {
      try {
        const response = await apiClient.get("/auth/api-keys/scopes/available");
        return (response.data as AvailableScopes) || ({} as AvailableScopes);
      } catch (err) {
        logger.error(
          "Failed to fetch available scopes",
          err instanceof Error ? err : new Error(String(err)),
        );
        console.error(err);
        return {} as AvailableScopes;
      }
    },
    staleTime: 300000, // 5 minutes - scopes rarely change
    refetchOnWindowFocus: false,
  });

  // Create API key mutation
  const createMutation = useMutation({
    mutationFn: async (data: APIKeyCreateRequest): Promise<APIKeyCreateResponse> => {
      const response = await apiClient.post("/auth/api-keys", data);
      return response.data as APIKeyCreateResponse;
    },
    onSuccess: (newKey) => {
      queryClient.setQueryData<ApiKeysQueryResult>(apiKeysKeys.list(page, limit), (old) => {
        const previous = old ?? parseApiKeysResponse(undefined, page, limit);
        return {
          ...previous,
          apiKeys: [newKey, ...previous.apiKeys],
          total: previous.total + 1,
        };
      });
      queryClient.invalidateQueries({ queryKey: apiKeysKeys.lists() });
      setApiKeysState((current) => [newKey, ...current]);
    },
    onError: (err) => {
      logger.error("Failed to create API key", err instanceof Error ? err : new Error(String(err)));
    },
  });

  // Update API key mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: APIKeyUpdateRequest;
    }): Promise<APIKey> => {
      const response = await apiClient.patch(`/auth/api-keys/${id}`, data);
      return response.data as APIKey;
    },
    onSuccess: (updatedKey) => {
      queryClient.setQueryData<ApiKeysQueryResult>(apiKeysKeys.list(page, limit), (old) => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          apiKeys: old.apiKeys.map((key) => (key.id === updatedKey.id ? updatedKey : key)),
        };
      });
      queryClient.invalidateQueries({ queryKey: apiKeysKeys.lists() });
      setApiKeysState((current) =>
        current.map((key) => (key.id === updatedKey.id ? updatedKey : key)),
      );
    },
    onError: (err) => {
      logger.error("Failed to update API key", err instanceof Error ? err : new Error(String(err)));
    },
  });

  // Revoke API key mutation
  const revokeMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await apiClient.delete(`/auth/api-keys/${id}`);
    },
    onSuccess: (_, id) => {
      queryClient.setQueryData<ApiKeysQueryResult>(apiKeysKeys.list(page, limit), (old) => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          apiKeys: old.apiKeys.filter((key) => key.id !== id),
          total: Math.max(0, old.total - 1),
        };
      });
      queryClient.invalidateQueries({ queryKey: apiKeysKeys.lists() });
      setApiKeysState((current) => current.filter((key) => key.id !== id));
    },
    onError: (err) => {
      logger.error("Failed to revoke API key", err instanceof Error ? err : new Error(String(err)));
    },
  });

  const fetchApiKeys = async (targetPage?: number, targetLimit?: number) => {
    const nextPage = targetPage ?? page;
    const nextLimit = targetLimit ?? limit;
    const data = await fetchApiKeysRequest(nextPage, nextLimit);
    queryClient.setQueryData(apiKeysKeys.list(nextPage, nextLimit), data);
  };

  const getAvailableScopes = async () => {
    const result = await scopesQuery.refetch().catch(() => ({ data: undefined }));
    const next = ((result && result.data) ?? {}) as AvailableScopes;
    setAvailableScopesState(next);
    return next;
  };

  const apiKeysData = keysQuery.data ?? parseApiKeysResponse(undefined, page, limit);
  const derivedApiKeys = keysQuery.data?.apiKeys ?? apiKeysState;
  const derivedAvailableScopes = scopesQuery.data ?? availableScopesState;
  useEffect(() => {
    if (keysQuery.data) {
      setApiKeysState(keysQuery.data.apiKeys);
    }
  }, [keysQuery.data]);

  useEffect(() => {
    if (scopesQuery.data) {
      setAvailableScopesState(scopesQuery.data);
    }
  }, [scopesQuery.data]);
  const error = keysQuery.error instanceof Error ? keysQuery.error.message : null;
  const isCreating = createMutation.isPending;
  const isUpdating = updateMutation.isPending;
  const isRevoking = revokeMutation.isPending;
  const isLoadingKeys = keysQuery.isLoading;
  const isLoadingScopes = scopesQuery.isLoading;

  return {
    apiKeys: derivedApiKeys,
    availableScopes: derivedAvailableScopes,
    total: apiKeysData.total,
    page: apiKeysData.page,
    limit: apiKeysData.limit,
    loading: isLoadingKeys || isLoadingScopes || isCreating || isUpdating || isRevoking,
    error,
    isLoadingKeys,
    isLoadingScopes,
    isCreating,
    isUpdating,
    isRevoking,
    fetchApiKeys,
    createApiKey: createMutation.mutateAsync,
    updateApiKey: async (id: string, data: APIKeyUpdateRequest) =>
      updateMutation.mutateAsync({ id, data }),
    revokeApiKey: revokeMutation.mutateAsync,
    getAvailableScopes,
  };
}
