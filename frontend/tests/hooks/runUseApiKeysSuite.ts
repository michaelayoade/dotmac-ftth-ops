/**
 * Shared test suite for useApiKeys hook
 * Tests API key management functionality (create, read, update, delete)
 */
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type PropsWithChildren } from "react";
import type {
  APIKey,
  APIKeyCreateRequest,
  APIKeyCreateResponse,
  APIKeyUpdateRequest,
  AvailableScopes,
} from "../../apps/platform-admin-app/hooks/useApiKeys";

type UseApiKeysHook = () => {
  apiKeys: APIKey[];
  loading: boolean;
  error: string | null;
  fetchApiKeys: (page?: number, limit?: number) => Promise<void>;
  createApiKey: (data: APIKeyCreateRequest) => Promise<APIKeyCreateResponse>;
  updateApiKey: (id: string, data: APIKeyUpdateRequest) => Promise<APIKey>;
  revokeApiKey: (id: string) => Promise<void>;
  getAvailableScopes: () => Promise<AvailableScopes>;
};

interface MockApiClient {
  get: jest.Mock<Promise<{ data: any }>, [string]>;
  post: jest.Mock<Promise<{ data: any }>, [string, any?]>;
  patch: jest.Mock<Promise<{ data: any }>, [string, any?]>;
  delete: jest.Mock<Promise<{ data?: any }>, [string]>;
}

export function runUseApiKeysSuite(useApiKeys: UseApiKeysHook, apiClient: MockApiClient) {
  let apiKeysStore: APIKey[] = [];
  let scopesStore: AvailableScopes = {};

  const cleanupFns: Array<() => void> = [];

  const renderUseApiKeys = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });

    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const hook = renderHook(() => useApiKeys(), { wrapper });

    cleanupFns.push(() => {
      hook.unmount();
    });

    return hook;
  };

  describe("useApiKeys", () => {
    beforeEach(() => {
      jest.resetAllMocks();
      apiKeysStore = [];
      scopesStore = {};
      apiClient.get.mockImplementation((url: string) => {
        if (url.includes("/scopes/available")) {
          return Promise.resolve({ data: scopesStore });
        }
        return Promise.resolve({
          data: {
            api_keys: apiKeysStore,
            total: apiKeysStore.length,
            page: 1,
            limit: 50,
          },
        });
      });
    });

    afterEach(() => {
      cleanupFns.forEach((cleanup) => cleanup());
      cleanupFns.length = 0;
      jest.resetAllMocks();
    });

    describe("Happy Path", () => {
      it("should fetch API keys on mount", async () => {
        const mockApiKeys: APIKey[] = [
          {
            id: "key-1",
            name: "Production API Key",
            scopes: ["read:users", "write:users"],
            created_at: "2025-01-01T00:00:00Z",
            expires_at: "2026-01-01T00:00:00Z",
            description: "Main production key",
            last_used_at: "2025-01-10T12:00:00Z",
            is_active: true,
            key_preview: "sk_prod_abc...xyz",
          },
        ];

        apiKeysStore = mockApiKeys;

        const { result } = renderUseApiKeys();

        await waitFor(() => {
          expect(result.current.apiKeys).toBe(mockApiKeys);
        });

        expect(result.current.apiKeys).toEqual(mockApiKeys);
        expect(result.current.error).toBeNull();
        expect(apiClient.get).toHaveBeenCalledWith("/auth/api-keys?page=1&limit=50");
      });

      it("should fetch API keys with custom pagination", async () => {
        const mockApiKeys: APIKey[] = [];
        apiClient.get.mockResolvedValue({
          data: { api_keys: mockApiKeys },
        });

        const { result } = renderUseApiKeys();

        await waitFor(() => {
          expect(result.current.apiKeys).toBe(mockApiKeys);
        });

        apiClient.get.mockClear();

        await act(async () => {
          await result.current.fetchApiKeys(2, 25);
        });

        expect(apiClient.get).toHaveBeenCalledWith("/auth/api-keys?page=2&limit=25");
      });

      it("should create a new API key", async () => {
        const initialKeys: APIKey[] = [];
        apiClient.get.mockResolvedValueOnce({
          data: { api_keys: initialKeys },
        });

        const newKeyRequest: APIKeyCreateRequest = {
          name: "Test Key",
          scopes: ["read:data"],
          description: "Testing key",
          expires_at: "2026-01-01T00:00:00Z",
        };

        const newKeyResponse: APIKeyCreateResponse = {
          id: "key-2",
          name: "Test Key",
          scopes: ["read:data"],
          created_at: "2025-01-15T00:00:00Z",
          expires_at: "2026-01-01T00:00:00Z",
          description: "Testing key",
          is_active: true,
          key_preview: "sk_test_abc...xyz",
          api_key: "sk_test_abcdefgh12345678",
        };

        apiKeysStore = initialKeys;
        apiClient.post.mockImplementationOnce(() => {
          apiKeysStore = [newKeyResponse, ...apiKeysStore];
          return Promise.resolve({ data: newKeyResponse });
        });

        const { result } = renderUseApiKeys();

        await waitFor(() => {
          expect(result.current.apiKeys).toBe(initialKeys);
        });

        let createdKey: APIKeyCreateResponse | undefined;
        await act(async () => {
          createdKey = await result.current.createApiKey(newKeyRequest);
        });

        expect(createdKey).toEqual(newKeyResponse);
        expect(result.current.apiKeys).toContainEqual(newKeyResponse);
        expect(apiClient.post).toHaveBeenCalledWith("/auth/api-keys", newKeyRequest);
      });

      it("should update an existing API key", async () => {
        const mockApiKeys: APIKey[] = [
          {
            id: "key-1",
            name: "Old Name",
            scopes: ["read:users"],
            created_at: "2025-01-01T00:00:00Z",
            is_active: true,
            key_preview: "sk_prod_abc...xyz",
          },
        ];

        apiKeysStore = mockApiKeys;

        const updateRequest: APIKeyUpdateRequest = {
          name: "New Name",
          scopes: ["read:users", "write:users"],
          is_active: true,
        };

        const updatedKey: APIKey = {
          ...mockApiKeys[0],
          name: "New Name",
          scopes: ["read:users", "write:users"],
        };

        apiClient.patch.mockImplementationOnce(() => {
          apiKeysStore = apiKeysStore.map((key) => (key.id === updatedKey.id ? updatedKey : key));
          return Promise.resolve({ data: updatedKey });
        });

        const { result } = renderUseApiKeys();

        await waitFor(() => {
          expect(result.current.apiKeys).toBe(mockApiKeys);
        });

        let updated: APIKey | undefined;
        await act(async () => {
          updated = await result.current.updateApiKey("key-1", updateRequest);
        });

        expect(updated).toEqual(updatedKey);
        expect(result.current.apiKeys[0].name).toBe("New Name");
        expect(apiClient.patch).toHaveBeenCalledWith("/auth/api-keys/key-1", updateRequest);
      });

      it("should revoke an API key", async () => {
        const mockApiKeys: APIKey[] = [
          {
            id: "key-1",
            name: "Key to Revoke",
            scopes: ["read:users"],
            created_at: "2025-01-01T00:00:00Z",
            is_active: true,
            key_preview: "sk_prod_abc...xyz",
          },
          {
            id: "key-2",
            name: "Keep This Key",
            scopes: ["read:data"],
            created_at: "2025-01-01T00:00:00Z",
            is_active: true,
            key_preview: "sk_prod_def...uvw",
          },
        ];

        apiKeysStore = mockApiKeys;

        apiClient.delete.mockImplementationOnce((url: string) => {
          const id = url.split("/").pop();
          apiKeysStore = apiKeysStore.filter((key) => key.id !== id);
          return Promise.resolve({});
        });

        const { result } = renderUseApiKeys();

        await waitFor(() => {
          expect(result.current.apiKeys).toBe(mockApiKeys);
        });

        expect(result.current.apiKeys).toHaveLength(2);

        await act(async () => {
          await result.current.revokeApiKey("key-1");
        });

        expect(result.current.apiKeys).toHaveLength(1);
        expect(result.current.apiKeys[0].id).toBe("key-2");
        expect(apiClient.delete).toHaveBeenCalledWith("/auth/api-keys/key-1");
      });

      it("should fetch available scopes", async () => {
        const mockScopes: AvailableScopes = {
          "read:users": {
            name: "Read Users",
            description: "Read user information",
          },
          "write:users": {
            name: "Write Users",
            description: "Create and update users",
          },
        };

        scopesStore = mockScopes;

        const { result } = renderUseApiKeys();

        await waitFor(() => {
          expect(result.current.availableScopes).toBe(mockScopes);
        });

        let scopes: AvailableScopes | undefined;
        await act(async () => {
          scopes = await result.current.getAvailableScopes();
        });

        expect(scopes).toEqual(mockScopes);
        expect(apiClient.get).toHaveBeenCalledWith("/auth/api-keys/scopes/available");
      });
    });

    describe("Error Handling", () => {
      it("should handle fetch errors", async () => {
        const mockError = new Error("Failed to authenticate");
        apiClient.get.mockRejectedValueOnce(mockError);

        const { result } = renderUseApiKeys();

        await waitFor(() => {
          expect(result.current.error).toBe("Failed to authenticate");
        });

        expect(result.current.apiKeys).toEqual([]);
      });

      it("should handle create errors", async () => {
        const initialKeys: APIKey[] = [];
        apiClient.get.mockResolvedValueOnce({
          data: { api_keys: initialKeys },
        });

        const mockError = new Error("Invalid scopes");
        apiClient.post.mockRejectedValueOnce(mockError);

        const { result } = renderUseApiKeys();

        await waitFor(() => {
          expect(result.current.apiKeys).toBe(initialKeys);
        });

        await expect(async () => {
          await act(async () => {
            await result.current.createApiKey({
              name: "Test",
              scopes: ["invalid:scope"],
            });
          });
        }).rejects.toThrow("Invalid scopes");
      });

      it("should handle update errors", async () => {
        const mockApiKeys: APIKey[] = [
          {
            id: "key-1",
            name: "Test Key",
            scopes: ["read:users"],
            created_at: "2025-01-01T00:00:00Z",
            is_active: true,
            key_preview: "sk_prod_abc...xyz",
          },
        ];

        apiClient.get.mockResolvedValueOnce({
          data: { api_keys: mockApiKeys },
        });

        const mockError = new Error("Key not found");
        apiClient.patch.mockRejectedValueOnce(mockError);

        const { result } = renderUseApiKeys();

        await waitFor(() => {
          expect(result.current.apiKeys).toBe(mockApiKeys);
        });

        await expect(async () => {
          await act(async () => {
            await result.current.updateApiKey("key-1", { name: "New Name" });
          });
        }).rejects.toThrow("Key not found");
      });

      it("should handle revoke errors", async () => {
        const mockApiKeys: APIKey[] = [
          {
            id: "key-1",
            name: "Test Key",
            scopes: ["read:users"],
            created_at: "2025-01-01T00:00:00Z",
            is_active: true,
            key_preview: "sk_prod_abc...xyz",
          },
        ];

        apiClient.get.mockResolvedValueOnce({
          data: { api_keys: mockApiKeys },
        });

        const mockError = new Error("Permission denied");
        apiClient.delete.mockRejectedValueOnce(mockError);

        const { result } = renderUseApiKeys();

        await waitFor(() => {
          expect(result.current.apiKeys).toBe(mockApiKeys);
        });

        await expect(async () => {
          await act(async () => {
            await result.current.revokeApiKey("key-1");
          });
        }).rejects.toThrow("Permission denied");
      });

      it("should handle getAvailableScopes errors gracefully", async () => {
        const initialKeys: APIKey[] = [];
        apiClient.get.mockResolvedValueOnce({
          data: { api_keys: initialKeys },
        });

        apiClient.get.mockRejectedValueOnce(new Error("Network error"));

        const { result } = renderUseApiKeys();

        await waitFor(() => {
          expect(result.current.apiKeys).toBe(initialKeys);
        });

        let scopes: AvailableScopes | undefined;
        await act(async () => {
          scopes = await result.current.getAvailableScopes();
        });

        // Should return empty object on error
        expect(scopes).toEqual({});
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty API keys list", async () => {
        const emptyKeys: APIKey[] = [];
        apiClient.get.mockResolvedValueOnce({
          data: { api_keys: emptyKeys },
        });

        const { result } = renderUseApiKeys();

        await waitFor(() => {
          expect(result.current.apiKeys).toBe(emptyKeys);
        });

        expect(result.current.apiKeys).toEqual([]);
        expect(result.current.error).toBeNull();
      });

      it("should handle keys with minimal fields", async () => {
        const mockApiKeys: APIKey[] = [
          {
            id: "key-1",
            name: "Minimal Key",
            scopes: [],
            created_at: "2025-01-01T00:00:00Z",
            is_active: true,
            key_preview: "sk_prod_abc...xyz",
          },
        ];

        apiClient.get.mockResolvedValueOnce({
          data: { api_keys: mockApiKeys },
        });

        const { result } = renderUseApiKeys();

        await waitFor(() => {
          expect(result.current.apiKeys).toBe(mockApiKeys);
        });

        expect(result.current.apiKeys[0].description).toBeUndefined();
        expect(result.current.apiKeys[0].expires_at).toBeUndefined();
        expect(result.current.apiKeys[0].last_used_at).toBeUndefined();
      });

      it("should handle keys with all optional fields", async () => {
        const mockApiKeys: APIKey[] = [
          {
            id: "key-1",
            name: "Complete Key",
            scopes: ["read:all", "write:all"],
            created_at: "2025-01-01T00:00:00Z",
            expires_at: "2026-01-01T00:00:00Z",
            description: "Full description",
            last_used_at: "2025-01-10T12:00:00Z",
            is_active: true,
            key_preview: "sk_prod_abc...xyz",
          },
        ];

        apiClient.get.mockResolvedValueOnce({
          data: { api_keys: mockApiKeys },
        });

        const { result } = renderUseApiKeys();

        await waitFor(() => {
          expect(result.current.apiKeys).toBe(mockApiKeys);
        });

        expect(result.current.apiKeys[0]).toHaveProperty("description");
        expect(result.current.apiKeys[0]).toHaveProperty("expires_at");
        expect(result.current.apiKeys[0]).toHaveProperty("last_used_at");
      });

      it("should handle inactive keys", async () => {
        const mockApiKeys: APIKey[] = [
          {
            id: "key-1",
            name: "Inactive Key",
            scopes: ["read:users"],
            created_at: "2025-01-01T00:00:00Z",
            is_active: false,
            key_preview: "sk_prod_abc...xyz",
          },
        ];

        apiClient.get.mockResolvedValueOnce({
          data: { api_keys: mockApiKeys },
        });

        const { result } = renderUseApiKeys();

        await waitFor(() => {
          expect(result.current.apiKeys).toBe(mockApiKeys);
        });

        expect(result.current.apiKeys[0].is_active).toBe(false);
      });

      it("should handle response without api_keys property", async () => {
        apiClient.get.mockResolvedValueOnce({
          data: { page: 2 },
        });

        const { result } = renderUseApiKeys();

        await waitFor(() => {
          expect(result.current.page).toBe(2);
        });

        expect(result.current.apiKeys).toEqual([]);
      });
    });
  });
}
