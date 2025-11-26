/**
 * Jest Mock Unit Tests for useApiKeys hook
 * Focuses on API contracts, query/mutation configuration, and implementation details
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useApiKeys, apiKeysKeys } from "../useApiKeys";
import type {
  APIKey,
  APIKeyCreateRequest,
  APIKeyCreateResponse,
  APIKeyUpdateRequest,
  AvailableScopes,
} from "../useApiKeys";

// Mock dependencies
jest.mock("@/lib/api/client");
jest.mock("@/lib/logger");

import { apiClient } from "@/lib/api/client";

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Create wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Helper to create mock API key
const createMockApiKey = (overrides?: Partial<APIKey>): APIKey => ({
  id: "key-1",
  name: "Test Key",
  scopes: ["read:users"],
  created_at: "2025-01-01T00:00:00Z",
  is_active: true,
  key_preview: "sk_prod_abc...xyz",
  ...overrides,
});

beforeEach(() => {
  jest.resetAllMocks();

  // Default mock implementations - must be set after reset
  mockApiClient.get.mockResolvedValue({
    data: {
      api_keys: [],
      total: 0,
      page: 1,
      limit: 50,
    },
  });
  mockApiClient.post.mockResolvedValue({ data: {} });
  mockApiClient.patch.mockResolvedValue({ data: {} });
  mockApiClient.delete.mockResolvedValue({ data: {} });
});

afterEach(() => {
  jest.resetAllMocks();
});

describe("useApiKeys - Unit Tests", () => {
  describe("Query Keys Factory", () => {
    it("should generate correct all key", () => {
      expect(apiKeysKeys.all).toEqual(["api-keys"]);
    });

    it("should generate correct lists key", () => {
      expect(apiKeysKeys.lists()).toEqual(["api-keys", "list"]);
    });

    it("should generate correct list key with pagination", () => {
      expect(apiKeysKeys.list(2, 25)).toEqual(["api-keys", "list", { page: 2, limit: 25 }]);
    });

    it("should generate correct scopes key", () => {
      expect(apiKeysKeys.scopes()).toEqual(["api-keys", "scopes"]);
    });
  });

  describe("API Keys Query", () => {
    it("should fetch API keys with correct endpoint and default pagination", async () => {
      const mockKeys = [createMockApiKey()];
      // Mock both parallel calls: keys and scopes
      mockApiClient.get.mockImplementation((url: string) => {
        if (url.includes("/scopes/available")) {
          return Promise.resolve({ data: {} });
        }
        return Promise.resolve({
          data: {
            api_keys: mockKeys,
            total: 1,
            page: 1,
            limit: 50,
          },
        });
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/auth/api-keys?page=1&limit=50");
      expect(result.current.apiKeys).toEqual(mockKeys);
    });

    it("should use correct query key with default pagination", async () => {
      renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockApiClient.get).toHaveBeenCalled());

      // Query key should be ["api-keys", "list", { page: 1, limit: 50 }]
      expect(mockApiClient.get).toHaveBeenCalledWith("/auth/api-keys?page=1&limit=50");
    });

    it("should fetch API keys with custom pagination", async () => {
      // Mock both parallel calls: keys and scopes
      mockApiClient.get.mockImplementation((url: string) => {
        if (url.includes("/scopes/available")) {
          return Promise.resolve({ data: {} });
        }
        return Promise.resolve({
          data: {
            api_keys: [],
            total: 0,
            page: 3,
            limit: 25,
          },
        });
      });

      const { result } = renderHook(() => useApiKeys({ page: 3, limit: 25 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/auth/api-keys?page=3&limit=25");
    });

    it("should return empty array when no keys exist", async () => {
      mockApiClient.get.mockResolvedValueOnce({
        data: {
          api_keys: [],
          total: 0,
          page: 1,
          limit: 50,
        },
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.apiKeys).toEqual([]);
      expect(result.current.total).toBe(0);
    });

    it("should handle missing api_keys property in response", async () => {
      mockApiClient.get.mockResolvedValueOnce({
        data: {},
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.apiKeys).toEqual([]);
    });

    it("should parse total from api_keys length if total missing", async () => {
      const mockKeys = [createMockApiKey(), createMockApiKey({ id: "key-2" })];
      mockApiClient.get.mockResolvedValueOnce({
        data: {
          api_keys: mockKeys,
        },
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.total).toBe(2);
    });

    it("should handle API error with detail message", async () => {
      mockApiClient.get.mockRejectedValueOnce({
        response: {
          data: {
            detail: "Unauthorized access",
          },
        },
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBe("Unauthorized access");
      expect(result.current.apiKeys).toEqual([]);
    });

    it("should handle API error with error.message format", async () => {
      mockApiClient.get.mockRejectedValueOnce({
        response: {
          data: {
            error: {
              message: "Invalid token",
            },
          },
        },
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBe("Invalid token");
    });

    it("should handle Error instance", async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBe("Network error");
    });

    it("should handle string error", async () => {
      mockApiClient.get.mockRejectedValueOnce("String error");

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBe("String error");
    });

    it("should use fallback error message for unknown error format", async () => {
      mockApiClient.get.mockRejectedValueOnce({ unknown: "format" });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBe("Failed to fetch API keys");
    });

    it("should expose pagination metadata", async () => {
      mockApiClient.get.mockResolvedValueOnce({
        data: {
          api_keys: [],
          total: 100,
          page: 2,
          limit: 25,
        },
      });

      const { result } = renderHook(() => useApiKeys({ page: 2, limit: 25 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.total).toBe(100);
      expect(result.current.page).toBe(2);
      expect(result.current.limit).toBe(25);
    });
  });

  describe("Available Scopes Query", () => {
    it("should fetch scopes with correct endpoint", async () => {
      const mockScopes: AvailableScopes = {
        "read:users": { name: "Read Users", description: "Read user data" },
      };

      mockApiClient.get
        .mockResolvedValueOnce({
          data: { api_keys: [], total: 0 },
        })
        .mockResolvedValueOnce({
          data: mockScopes,
        });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/auth/api-keys/scopes/available");
      expect(result.current.availableScopes).toEqual(mockScopes);
    });

    it("should return empty object on scopes error", async () => {
      mockApiClient.get
        .mockResolvedValueOnce({
          data: { api_keys: [] },
        })
        .mockRejectedValueOnce(new Error("Scopes not available"));

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.availableScopes).toEqual({});
    });

    it("should call getAvailableScopes to refetch", async () => {
      const mockScopes: AvailableScopes = {
        "write:data": { name: "Write Data", description: "Write data" },
      };

      mockApiClient.get
        .mockResolvedValueOnce({
          data: { api_keys: [] },
        })
        .mockResolvedValueOnce({
          data: {},
        })
        .mockResolvedValueOnce({
          data: mockScopes,
        });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      let scopes: AvailableScopes;
      await act(async () => {
        scopes = await result.current.getAvailableScopes();
      });

      expect(scopes!).toEqual(mockScopes);
      expect(mockApiClient.get).toHaveBeenCalledWith("/auth/api-keys/scopes/available");
    });
  });

  describe("Create API Key Mutation", () => {
    it("should create API key with correct endpoint and payload", async () => {
      const createRequest: APIKeyCreateRequest = {
        name: "New Key",
        scopes: ["read:data", "write:data"],
        description: "Test key",
        expires_at: "2026-01-01T00:00:00Z",
      };

      const createResponse: APIKeyCreateResponse = {
        ...createMockApiKey({ name: "New Key" }),
        api_key: "sk_test_full_key_12345",
      };

      mockApiClient.get.mockResolvedValueOnce({
        data: { api_keys: [] },
      });

      mockApiClient.post.mockResolvedValueOnce({
        data: createResponse,
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      let newKey: APIKeyCreateResponse;
      await act(async () => {
        newKey = await result.current.createApiKey(createRequest);
      });

      expect(mockApiClient.post).toHaveBeenCalledWith("/auth/api-keys", createRequest);
      expect(newKey!).toEqual(createResponse);
    });

    it("should update isCreating state during mutation", async () => {
      mockApiClient.get.mockResolvedValueOnce({
        data: { api_keys: [] },
      });

      mockApiClient.post.mockResolvedValueOnce({
        data: createMockApiKey(),
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.isCreating).toBe(false);

      const promise = act(async () => {
        await result.current.createApiKey({ name: "Test", scopes: [] });
      });

      await promise;

      expect(result.current.isCreating).toBe(false);
    });

    it("should handle create error", async () => {
      mockApiClient.get.mockResolvedValueOnce({
        data: { api_keys: [] },
      });

      mockApiClient.post.mockRejectedValueOnce(new Error("Invalid scopes"));

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        act(async () => {
          await result.current.createApiKey({ name: "Test", scopes: ["invalid"] });
        }),
      ).rejects.toThrow("Invalid scopes");
    });
  });

  describe("Update API Key Mutation", () => {
    it("should update API key with correct endpoint and payload", async () => {
      const existingKey = createMockApiKey({ name: "Old Name" });
      const updateRequest: APIKeyUpdateRequest = {
        name: "New Name",
        scopes: ["read:users", "write:users"],
      };
      const updatedKey = { ...existingKey, ...updateRequest };

      mockApiClient.get.mockResolvedValueOnce({
        data: {
          api_keys: [existingKey],
          total: 1,
        },
      });

      mockApiClient.patch.mockResolvedValueOnce({
        data: updatedKey,
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.apiKeys.length).toBe(1));

      let updated: APIKey;
      await act(async () => {
        updated = await result.current.updateApiKey("key-1", updateRequest);
      });

      expect(mockApiClient.patch).toHaveBeenCalledWith("/auth/api-keys/key-1", updateRequest);
      expect(updated!).toEqual(updatedKey);
    });

    it("should update isUpdating state during mutation", async () => {
      const existingKey = createMockApiKey();
      mockApiClient.get.mockResolvedValueOnce({
        data: { api_keys: [existingKey] },
      });

      mockApiClient.patch.mockResolvedValueOnce({
        data: existingKey,
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.isUpdating).toBe(false);

      const promise = act(async () => {
        await result.current.updateApiKey("key-1", { name: "Updated" });
      });

      await promise;

      expect(result.current.isUpdating).toBe(false);
    });

    it("should handle update error", async () => {
      mockApiClient.get.mockResolvedValueOnce({
        data: { api_keys: [createMockApiKey()] },
      });

      mockApiClient.patch.mockRejectedValueOnce(new Error("Key not found"));

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        act(async () => {
          await result.current.updateApiKey("key-1", { name: "New" });
        }),
      ).rejects.toThrow("Key not found");
    });
  });

  describe("Revoke API Key Mutation", () => {
    it("should revoke API key with correct endpoint", async () => {
      const key1 = createMockApiKey({ id: "key-1" });
      const key2 = createMockApiKey({ id: "key-2" });

      mockApiClient.get.mockResolvedValueOnce({
        data: {
          api_keys: [key1, key2],
          total: 2,
        },
      });

      mockApiClient.delete.mockResolvedValueOnce({ data: undefined });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.apiKeys.length).toBe(2));

      await act(async () => {
        await result.current.revokeApiKey("key-1");
      });

      expect(mockApiClient.delete).toHaveBeenCalledWith("/auth/api-keys/key-1");
    });

    it("should not allow total to go below zero on revoke", async () => {
      const key1 = createMockApiKey();

      mockApiClient.get.mockResolvedValueOnce({
        data: {
          api_keys: [key1],
          total: 0, // Already at 0
        },
      });

      mockApiClient.delete.mockResolvedValueOnce({ data: undefined });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.apiKeys.length).toBe(1));

      await act(async () => {
        await result.current.revokeApiKey("key-1");
      });

      await waitFor(() => expect(result.current.total).toBe(0));
    });

    it("should update isRevoking state during mutation", async () => {
      mockApiClient.get.mockResolvedValueOnce({
        data: { api_keys: [createMockApiKey()] },
      });

      mockApiClient.delete.mockResolvedValueOnce({ data: undefined });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.isRevoking).toBe(false);

      const promise = act(async () => {
        await result.current.revokeApiKey("key-1");
      });

      await promise;

      expect(result.current.isRevoking).toBe(false);
    });

    it("should handle revoke error", async () => {
      mockApiClient.get.mockResolvedValueOnce({
        data: { api_keys: [createMockApiKey()] },
      });

      mockApiClient.delete.mockRejectedValueOnce(new Error("Permission denied"));

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        act(async () => {
          await result.current.revokeApiKey("key-1");
        }),
      ).rejects.toThrow("Permission denied");
    });
  });

  describe("fetchApiKeys Helper", () => {
    it("should fetch with custom pagination parameters", async () => {
      mockApiClient.get.mockResolvedValue({
        data: { api_keys: [], total: 0 },
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      mockApiClient.get.mockClear();

      await act(async () => {
        await result.current.fetchApiKeys(3, 10);
      });

      expect(mockApiClient.get).toHaveBeenCalledWith("/auth/api-keys?page=3&limit=10");
    });

    it("should use default pagination when parameters not provided", async () => {
      mockApiClient.get.mockResolvedValue({
        data: { api_keys: [], total: 0 },
      });

      const { result } = renderHook(() => useApiKeys({ page: 2, limit: 25 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      mockApiClient.get.mockClear();

      await act(async () => {
        await result.current.fetchApiKeys();
      });

      expect(mockApiClient.get).toHaveBeenCalledWith("/auth/api-keys?page=2&limit=25");
    });
  });

  describe("Loading States", () => {
    it("should expose individual loading states", async () => {
      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.isLoadingKeys).toBe(false);
      expect(result.current.isLoadingScopes).toBe(false);
      expect(result.current.isCreating).toBe(false);
      expect(result.current.isUpdating).toBe(false);
      expect(result.current.isRevoking).toBe(false);
    });

    it("should track initial load completion", async () => {
      mockApiClient.get.mockResolvedValue({
        data: { api_keys: [] },
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      // Should start with loading true
      expect(result.current.loading).toBe(true);

      // Should finish with loading false
      await waitFor(() => expect(result.current.loading).toBe(false));
    });

    it("should combine all loading states into main loading flag", async () => {
      mockApiClient.get.mockResolvedValueOnce({
        data: { api_keys: [] },
      });

      mockApiClient.post.mockImplementation(
        () =>
          new Promise((resolve) => setTimeout(() => resolve({ data: createMockApiKey() }), 100)),
      );

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoadingKeys).toBe(false));

      // Start the mutation without awaiting
      act(() => {
        result.current.createApiKey({ name: "Test", scopes: [] });
      });

      // Wait for loading states to be set
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
        expect(result.current.isCreating).toBe(true);
      });
    });
  });

  describe("State Synchronization", () => {
    it("should sync query data to local state", async () => {
      const mockKeys = [createMockApiKey()];

      mockApiClient.get.mockResolvedValueOnce({
        data: {
          api_keys: mockKeys,
          total: 1,
        },
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.apiKeys.length).toBe(1));

      expect(result.current.apiKeys).toEqual(mockKeys);
    });

    it("should sync scopes data to local state", async () => {
      const mockScopes: AvailableScopes = {
        "read:data": { name: "Read", description: "Read data" },
      };

      mockApiClient.get
        .mockResolvedValueOnce({
          data: { api_keys: [] },
        })
        .mockResolvedValueOnce({
          data: mockScopes,
        });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.availableScopes).toEqual(mockScopes);
    });
  });

  describe("Edge Cases", () => {
    it("should handle keys with all optional fields", async () => {
      const fullKey: APIKey = {
        id: "key-1",
        name: "Full Key",
        scopes: ["read:all"],
        created_at: "2025-01-01T00:00:00Z",
        expires_at: "2026-01-01T00:00:00Z",
        description: "Full description",
        last_used_at: "2025-01-10T00:00:00Z",
        is_active: true,
        key_preview: "sk_prod_abc...xyz",
      };

      mockApiClient.get.mockResolvedValueOnce({
        data: {
          api_keys: [fullKey],
          total: 1,
        },
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.apiKeys[0]).toHaveProperty("expires_at");
      expect(result.current.apiKeys[0]).toHaveProperty("description");
      expect(result.current.apiKeys[0]).toHaveProperty("last_used_at");
    });

    it("should handle inactive keys", async () => {
      const inactiveKey = createMockApiKey({ is_active: false });

      mockApiClient.get.mockResolvedValueOnce({
        data: {
          api_keys: [inactiveKey],
          total: 1,
        },
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.apiKeys[0].is_active).toBe(false);
    });

    it("should handle keys with empty scopes", async () => {
      const keyWithNoScopes = createMockApiKey({ scopes: [] });

      // Mock both API calls (keys and scopes are fetched in parallel)
      mockApiClient.get.mockImplementation((url: string) => {
        if (url.includes("/auth/api-keys/scopes/available")) {
          return Promise.resolve({ data: {} });
        }
        return Promise.resolve({
          data: {
            api_keys: [keyWithNoScopes],
            total: 1,
          },
        });
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.apiKeys[0]?.scopes).toEqual([]);
    });
  });
});
