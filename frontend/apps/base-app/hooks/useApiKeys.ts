import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api/client";

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

export function useApiKeys() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchApiKeys = useCallback(async (page = 1, limit = 50) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", limit.toString());

      const response = await apiClient.get(`/auth/api-keys?${params.toString()}`);
      const data = response.data as { api_keys?: APIKey[] };
      setApiKeys(data.api_keys || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch API keys";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const createApiKey = useCallback(
    async (data: APIKeyCreateRequest): Promise<APIKeyCreateResponse> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post("/auth/api-keys", data);
        const newApiKey = response.data as APIKeyCreateResponse;

        setApiKeys((prev) => [newApiKey, ...prev]);
        return newApiKey;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to create API key";
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const updateApiKey = useCallback(
    async (id: string, data: APIKeyUpdateRequest): Promise<APIKey> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.patch(`/auth/api-keys/${id}`, data);
        const updatedKey = response.data as APIKey;

        setApiKeys((prev) => prev.map((key) => (key.id === id ? updatedKey : key)));
        return updatedKey;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to update API key";
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const revokeApiKey = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await apiClient.delete(`/auth/api-keys/${id}`);
      setApiKeys((prev) => prev.filter((key) => key.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to revoke API key";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const getAvailableScopes = useCallback(async (): Promise<AvailableScopes> => {
    try {
      const response = await apiClient.get("/auth/api-keys/scopes/available");
      return (response.data as AvailableScopes) || ({} as AvailableScopes);
    } catch (err) {
      console.error("Failed to fetch available scopes:", err);
      return {} as AvailableScopes;
    }
  }, []);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  return {
    apiKeys,
    loading,
    error,
    fetchApiKeys,
    createApiKey,
    updateApiKey,
    revokeApiKey,
    getAvailableScopes,
  };
}
