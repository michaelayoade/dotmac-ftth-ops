/**
 * Platform Admin App - useApiKeys tests
 *
 * Tests the useApiKeys hook using Jest mocks for API client.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useApiKeys, apiKeysKeys, APIKey, APIKeyCreateResponse } from "../useApiKeys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Helper to create test QueryClient
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      log: console.log,
      warn: console.warn,
      error: () => {},
    },
  });
}

// Helper to create wrapper
function createQueryWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// Helper to create mock API key
function createMockApiKey(overrides: Partial<APIKey> = {}): APIKey {
  const id = overrides.id || `key-${Math.random().toString(36).substr(2, 9)}`;
  return {
    id,
    name: overrides.name || "Test API Key",
    scopes: overrides.scopes || ["read:subscribers"],
    created_at: overrides.created_at || new Date().toISOString(),
    is_active: overrides.is_active ?? true,
    key_preview: overrides.key_preview || "sk_test_...abc",
    description: overrides.description,
    expires_at: overrides.expires_at,
    last_used_at: overrides.last_used_at,
  };
}

// Mock available scopes
const mockAvailableScopes = {
  "read:subscribers": { name: "Read Subscribers", description: "Read subscriber data" },
  "write:subscribers": { name: "Write Subscribers", description: "Modify subscriber data" },
  "delete:subscribers": { name: "Delete Subscribers", description: "Delete subscribers" },
  "read:billing": { name: "Read Billing", description: "Read billing data" },
  "write:billing": { name: "Write Billing", description: "Modify billing data" },
};

describe("useApiKeys", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("apiKeysKeys query key factory", () => {
    it("should generate correct query keys", () => {
      expect(apiKeysKeys.all).toEqual(["api-keys"]);
      expect(apiKeysKeys.lists()).toEqual(["api-keys", "list"]);
      expect(apiKeysKeys.list(1, 50)).toEqual(["api-keys", "list", { page: 1, limit: 50 }]);
      expect(apiKeysKeys.scopes()).toEqual(["api-keys", "scopes"]);
    });
  });

  describe("useApiKeys - fetch API keys", () => {
    it("should fetch API keys successfully", async () => {
      const mockKeys = [
        createMockApiKey({
          id: "key-1",
          name: "Production Key",
          scopes: ["read:subscribers", "write:subscribers"],
          is_active: true,
        }),
        createMockApiKey({
          id: "key-2",
          name: "Development Key",
          scopes: ["read:subscribers"],
          is_active: false,
        }),
      ];

      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/auth/api-keys/scopes/available")) {
          return Promise.resolve({ data: mockAvailableScopes });
        }
        return Promise.resolve({
          data: {
            api_keys: mockKeys,
            total: mockKeys.length,
            page: 1,
            limit: 50,
          },
        });
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createQueryWrapper(queryClient),
      });

      // Should start in loading state
      expect(result.current.loading).toBe(true);

      // Wait for data to load
      await waitFor(() => expect(result.current.loading).toBe(false));

      // Verify data matches actual hook API
      expect(result.current.apiKeys).toBeDefined();
      expect(result.current.apiKeys).toHaveLength(2);
      expect(result.current.apiKeys[0].id).toBe("key-1");
      expect(result.current.apiKeys[0].name).toBe("Production Key");
      expect(result.current.apiKeys[0].scopes).toContain("read:subscribers");
      expect(result.current.error).toBeNull();
    });

    it("should handle empty API keys list", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/auth/api-keys/scopes/available")) {
          return Promise.resolve({ data: mockAvailableScopes });
        }
        return Promise.resolve({
          data: {
            api_keys: [],
            total: 0,
            page: 1,
            limit: 50,
          },
        });
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.apiKeys).toHaveLength(0);
      expect(result.current.total).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it("should handle pagination", async () => {
      const allKeys = Array.from({ length: 75 }, (_, i) =>
        createMockApiKey({ id: `key-${i + 1}`, name: `Key ${i + 1}` }),
      );

      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/auth/api-keys/scopes/available")) {
          return Promise.resolve({ data: mockAvailableScopes });
        }
        // Page 2 with limit 50 should return keys 51-75
        const page2Keys = allKeys.slice(50, 75);
        return Promise.resolve({
          data: {
            api_keys: page2Keys,
            total: 75,
            page: 2,
            limit: 50,
          },
        });
      });

      const { result } = renderHook(() => useApiKeys({ page: 2, limit: 50 }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.apiKeys).toHaveLength(25);
      expect(result.current.total).toBe(75);
      expect(result.current.page).toBe(2);
      expect(result.current.apiKeys[0].id).toBe("key-51");
    });

    it("should fetch available scopes", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/auth/api-keys/scopes/available")) {
          return Promise.resolve({ data: mockAvailableScopes });
        }
        return Promise.resolve({
          data: {
            api_keys: [],
            total: 0,
            page: 1,
            limit: 50,
          },
        });
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.availableScopes).toBeDefined();
      expect(result.current.availableScopes["read:subscribers"]).toBeDefined();
      expect(result.current.availableScopes["read:subscribers"].name).toBe("Read Subscribers");
    });

    it("should handle fetch error", async () => {
      const error = new Error("Server error");
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/auth/api-keys/scopes/available")) {
          return Promise.resolve({ data: mockAvailableScopes });
        }
        return Promise.reject(error);
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.apiKeys).toHaveLength(0);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("useApiKeys - create API key", () => {
    it("should create API key successfully", async () => {
      const createdKey: APIKeyCreateResponse = {
        ...createMockApiKey({ id: "new-key", name: "New API Key" }),
        api_key: "sk_test_newkey123",
      };

      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/auth/api-keys/scopes/available")) {
          return Promise.resolve({ data: mockAvailableScopes });
        }
        return Promise.resolve({
          data: {
            api_keys: [createdKey],
            total: 1,
            page: 1,
            limit: 50,
          },
        });
      });

      (apiClient.post as jest.Mock).mockResolvedValue({ data: createdKey });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      let newKey: any;
      await act(async () => {
        newKey = await result.current.createApiKey({
          name: "New API Key",
          scopes: ["read:subscribers"],
          description: "Test key",
        });
      });

      expect(newKey).toBeDefined();
      expect(newKey.name).toBe("New API Key");
      expect(newKey.api_key).toBeDefined();
      expect(newKey.api_key).toContain("sk_test_");
    });

    it("should handle create error", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/auth/api-keys/scopes/available")) {
          return Promise.resolve({ data: mockAvailableScopes });
        }
        return Promise.resolve({
          data: { api_keys: [], total: 0, page: 1, limit: 50 },
        });
      });

      const error = new Error("Invalid scopes");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        result.current.createApiKey({
          name: "Invalid Key",
          scopes: ["invalid:scope"],
        }),
      ).rejects.toThrow();
    });
  });

  describe("useApiKeys - update API key", () => {
    it("should update API key successfully", async () => {
      const existingKey = createMockApiKey({
        id: "key-1",
        name: "Original Name",
        is_active: true,
      });

      const updatedKey = {
        ...existingKey,
        name: "Updated Name",
        is_active: false,
      };

      let callCount = 0;
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/auth/api-keys/scopes/available")) {
          return Promise.resolve({ data: mockAvailableScopes });
        }
        callCount++;
        // Return updated data after mutation
        const keys = callCount > 1 ? [updatedKey] : [existingKey];
        return Promise.resolve({
          data: {
            api_keys: keys,
            total: 1,
            page: 1,
            limit: 50,
          },
        });
      });

      (apiClient.patch as jest.Mock).mockResolvedValue({ data: updatedKey });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.updateApiKey("key-1", {
          name: "Updated Name",
          is_active: false,
        });
      });

      // Verify hook state updated
      await waitFor(() => {
        expect(result.current.apiKeys[0].name).toBe("Updated Name");
        expect(result.current.apiKeys[0].is_active).toBe(false);
      });
    });

    it("should handle update error for non-existent key", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/auth/api-keys/scopes/available")) {
          return Promise.resolve({ data: mockAvailableScopes });
        }
        return Promise.resolve({
          data: { api_keys: [], total: 0, page: 1, limit: 50 },
        });
      });

      const error = new Error("Key not found");
      (apiClient.patch as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        result.current.updateApiKey("non-existent", { name: "New Name" }),
      ).rejects.toThrow();
    });
  });

  describe("useApiKeys - revoke API key", () => {
    it("should revoke API key successfully", async () => {
      const keys = [
        createMockApiKey({ id: "key-1", name: "Key 1" }),
        createMockApiKey({ id: "key-2", name: "Key 2" }),
      ];

      let callCount = 0;
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/auth/api-keys/scopes/available")) {
          return Promise.resolve({ data: mockAvailableScopes });
        }
        callCount++;
        // Return only key-2 after revocation
        const returnKeys = callCount > 1 ? [keys[1]] : keys;
        return Promise.resolve({
          data: {
            api_keys: returnKeys,
            total: returnKeys.length,
            page: 1,
            limit: 50,
          },
        });
      });

      (apiClient.delete as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.apiKeys).toHaveLength(2);

      await act(async () => {
        await result.current.revokeApiKey("key-1");
      });

      // Verify hook state updated
      await waitFor(() => {
        expect(result.current.apiKeys).toHaveLength(1);
        expect(result.current.apiKeys[0].id).toBe("key-2");
      });
    });

    it("should handle revoke error for non-existent key", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/auth/api-keys/scopes/available")) {
          return Promise.resolve({ data: mockAvailableScopes });
        }
        return Promise.resolve({
          data: { api_keys: [], total: 0, page: 1, limit: 50 },
        });
      });

      const error = new Error("Key not found");
      (apiClient.delete as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(result.current.revokeApiKey("non-existent")).rejects.toThrow();
    });
  });

  describe("Loading States", () => {
    it("should properly track initialLoad state", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/auth/api-keys/scopes/available")) {
          return Promise.resolve({ data: mockAvailableScopes });
        }
        return Promise.resolve({
          data: {
            api_keys: [createMockApiKey()],
            total: 1,
            page: 1,
            limit: 50,
          },
        });
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createQueryWrapper(queryClient),
      });

      // Initially should be loading
      expect(result.current.loading).toBe(true);

      // Wait for initial load to complete
      await waitFor(() => expect(result.current.loading).toBe(false));
    });

    it("should properly handle mutation loading states", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/auth/api-keys/scopes/available")) {
          return Promise.resolve({ data: mockAvailableScopes });
        }
        return Promise.resolve({
          data: {
            api_keys: [createMockApiKey({ id: "key-1" })],
            total: 1,
            page: 1,
            limit: 50,
          },
        });
      });

      (apiClient.post as jest.Mock).mockResolvedValue({
        data: { ...createMockApiKey(), api_key: "sk_test_new" },
      });
      (apiClient.patch as jest.Mock).mockResolvedValue({
        data: createMockApiKey({ name: "Updated" }),
      });
      (apiClient.delete as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Initially no mutations in progress
      expect(result.current.isCreating).toBe(false);
      expect(result.current.isUpdating).toBe(false);
      expect(result.current.isRevoking).toBe(false);

      // Test create
      await act(async () => {
        await result.current.createApiKey({
          name: "New Key",
          scopes: ["read:subscribers"],
        });
      });
      expect(result.current.isCreating).toBe(false);

      // Test update
      await act(async () => {
        await result.current.updateApiKey("key-1", { name: "Updated" });
      });
      expect(result.current.isUpdating).toBe(false);

      // Test revoke
      await act(async () => {
        await result.current.revokeApiKey("key-1");
      });
      expect(result.current.isRevoking).toBe(false);
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle keys with different scopes", async () => {
      const keys = [
        createMockApiKey({
          id: "key-1",
          name: "Admin Key",
          scopes: ["read:subscribers", "write:subscribers", "delete:subscribers"],
        }),
        createMockApiKey({
          id: "key-2",
          name: "Read-only Key",
          scopes: ["read:subscribers"],
        }),
        createMockApiKey({
          id: "key-3",
          name: "Billing Key",
          scopes: ["read:billing", "write:billing"],
        }),
      ];

      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/auth/api-keys/scopes/available")) {
          return Promise.resolve({ data: mockAvailableScopes });
        }
        return Promise.resolve({
          data: {
            api_keys: keys,
            total: keys.length,
            page: 1,
            limit: 50,
          },
        });
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createQueryWrapper(queryClient),
      });

      // Wait for data to be loaded
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.apiKeys).toHaveLength(3);
      });

      expect(result.current.apiKeys[0].scopes).toHaveLength(3);
      expect(result.current.apiKeys[1].scopes).toHaveLength(1);
      expect(result.current.apiKeys[2].scopes).toContain("read:billing");
    });
  });
});
