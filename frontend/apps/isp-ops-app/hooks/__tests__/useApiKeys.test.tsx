/**
 * Tests for useApiKeys hook
 * Tests API key management with TanStack Query (queries and mutations)
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useApiKeys, apiKeysKeys } from "../useApiKeys";
import { apiClient } from "@/lib/api/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe("useApiKeys", () => {
  function createWrapper() {
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
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("fetchApiKeys", () => {
    it("should fetch API keys successfully", async () => {
      const mockResponse = {
        api_keys: [
          {
            id: "key-1",
            name: "Test Key",
            scopes: ["read:data"],
            created_at: "2024-01-01T00:00:00Z",
            is_active: true,
            key_preview: "sk_test_****",
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoadingKeys).toBe(false));

      expect(result.current.apiKeys).toHaveLength(1);
      expect(result.current.apiKeys[0].name).toBe("Test Key");
      expect(result.current.total).toBe(1);
      expect(apiClient.get).toHaveBeenCalledWith("/auth/api-keys?page=1&limit=50");
    });

    it("should handle pagination parameters", async () => {
      const mockResponse = {
        api_keys: [],
        total: 100,
        page: 2,
        limit: 25,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useApiKeys({ page: 2, limit: 25 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoadingKeys).toBe(false));

      expect(apiClient.get).toHaveBeenCalledWith("/auth/api-keys?page=2&limit=25");
      expect(result.current.total).toBe(100);
    });

    it("should handle empty api_keys array", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
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

      await waitFor(() => expect(result.current.isLoadingKeys).toBe(false));

      expect(result.current.apiKeys).toEqual([]);
      expect(result.current.total).toBe(0);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch API keys");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoadingKeys).toBe(false));

      expect(result.current.error).toBe("Failed to fetch API keys");
      expect(result.current.apiKeys).toEqual([]);
    });

    it("should set loading state correctly", async () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: { api_keys: [], total: 0, page: 1, limit: 50 } }), 100)
          )
      );

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoadingKeys).toBe(true);

      await waitFor(() => expect(result.current.isLoadingKeys).toBe(false), { timeout: 200 });
    });
  });

  describe("fetchAvailableScopes", () => {
    it("should fetch available scopes successfully", async () => {
      const mockScopes = {
        "read:data": {
          name: "Read Data",
          description: "Read access to data",
        },
        "write:data": {
          name: "Write Data",
          description: "Write access to data",
        },
      };

      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/scopes/available")) {
          return Promise.resolve({ data: mockScopes });
        }
        return Promise.resolve({
          data: { api_keys: [], total: 0, page: 1, limit: 50 },
        });
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoadingScopes).toBe(false));

      expect(result.current.availableScopes).toEqual(mockScopes);
      expect(apiClient.get).toHaveBeenCalledWith("/auth/api-keys/scopes/available");
    });

    it("should handle scopes fetch error gracefully", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/scopes/available")) {
          return Promise.reject(new Error("Scopes error"));
        }
        return Promise.resolve({
          data: { api_keys: [], total: 0, page: 1, limit: 50 },
        });
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoadingScopes).toBe(false));

      // Should return empty object on error
      expect(result.current.availableScopes).toEqual({});
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe("createApiKey", () => {
    it("should create API key successfully", async () => {
      const mockNewKey = {
        id: "key-new",
        name: "New Key",
        scopes: ["read:data"],
        created_at: "2024-01-02T00:00:00Z",
        is_active: true,
        key_preview: "sk_test_****",
        api_key: "sk_test_1234567890",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { api_keys: [], total: 0, page: 1, limit: 50 },
      });
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockNewKey });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoadingKeys).toBe(false));

      let createdKey;
      await act(async () => {
        createdKey = await result.current.createApiKey({
          name: "New Key",
          scopes: ["read:data"],
        });
      });

      expect(createdKey).toEqual(mockNewKey);
      expect(apiClient.post).toHaveBeenCalledWith("/auth/api-keys", {
        name: "New Key",
        scopes: ["read:data"],
      });
    });

    it("should invalidate queries after successful creation", async () => {
      const mockNewKey = {
        id: "key-new",
        name: "New Key",
        scopes: ["read:data"],
        created_at: "2024-01-02T00:00:00Z",
        is_active: true,
        key_preview: "sk_test_****",
        api_key: "sk_test_1234567890",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { api_keys: [], total: 0, page: 1, limit: 50 },
      });
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockNewKey });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoadingKeys).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      await act(async () => {
        await result.current.createApiKey({
          name: "New Key",
          scopes: ["read:data"],
        });
      });

      // Wait for invalidation to trigger refetch
      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it("should handle create error", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { api_keys: [], total: 0, page: 1, limit: 50 },
      });
      (apiClient.post as jest.Mock).mockRejectedValue(new Error("Create failed"));

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoadingKeys).toBe(false));

      await expect(
        act(async () => {
          await result.current.createApiKey({
            name: "New Key",
            scopes: ["read:data"],
          });
        })
      ).rejects.toThrow("Create failed");
    });

    it("should set isCreating state correctly", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { api_keys: [], total: 0, page: 1, limit: 50 },
      });
      (apiClient.post as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100))
      );

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoadingKeys).toBe(false));

      act(() => {
        result.current.createApiKey({
          name: "New Key",
          scopes: ["read:data"],
        });
      });

      // Wait for mutation to start
      await waitFor(() => expect(result.current.isCreating).toBe(true), { timeout: 100 });

      // Wait for mutation to complete
      await waitFor(() => expect(result.current.isCreating).toBe(false), { timeout: 200 });
    });
  });

  describe("updateApiKey", () => {
    it("should update API key successfully", async () => {
      const mockUpdatedKey = {
        id: "key-1",
        name: "Updated Key",
        scopes: ["read:data", "write:data"],
        created_at: "2024-01-01T00:00:00Z",
        is_active: true,
        key_preview: "sk_test_****",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { api_keys: [], total: 0, page: 1, limit: 50 },
      });
      (apiClient.patch as jest.Mock).mockResolvedValue({ data: mockUpdatedKey });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoadingKeys).toBe(false));

      let updatedKey;
      await act(async () => {
        updatedKey = await result.current.updateApiKey("key-1", {
          name: "Updated Key",
          scopes: ["read:data", "write:data"],
        });
      });

      expect(updatedKey).toEqual(mockUpdatedKey);
      expect(apiClient.patch).toHaveBeenCalledWith("/auth/api-keys/key-1", {
        name: "Updated Key",
        scopes: ["read:data", "write:data"],
      });
    });

    it("should handle update error", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { api_keys: [], total: 0, page: 1, limit: 50 },
      });
      (apiClient.patch as jest.Mock).mockRejectedValue(new Error("Update failed"));

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoadingKeys).toBe(false));

      await expect(
        act(async () => {
          await result.current.updateApiKey("key-1", { name: "Updated" });
        })
      ).rejects.toThrow("Update failed");
    });

    it("should set isUpdating state correctly", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { api_keys: [], total: 0, page: 1, limit: 50 },
      });
      (apiClient.patch as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100))
      );

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoadingKeys).toBe(false));

      act(() => {
        result.current.updateApiKey("key-1", { name: "Updated" });
      });

      // Wait for mutation to start
      await waitFor(() => expect(result.current.isUpdating).toBe(true), { timeout: 100 });

      // Wait for mutation to complete
      await waitFor(() => expect(result.current.isUpdating).toBe(false), { timeout: 200 });
    });
  });

  describe("revokeApiKey", () => {
    it("should revoke API key successfully", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { api_keys: [], total: 0, page: 1, limit: 50 },
      });
      (apiClient.delete as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoadingKeys).toBe(false));

      await act(async () => {
        await result.current.revokeApiKey("key-1");
      });

      expect(apiClient.delete).toHaveBeenCalledWith("/auth/api-keys/key-1");
    });

    it("should invalidate queries after successful revocation", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { api_keys: [], total: 0, page: 1, limit: 50 },
      });
      (apiClient.delete as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoadingKeys).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      await act(async () => {
        await result.current.revokeApiKey("key-1");
      });

      // Wait for invalidation to trigger refetch
      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it("should handle revoke error", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { api_keys: [], total: 0, page: 1, limit: 50 },
      });
      (apiClient.delete as jest.Mock).mockRejectedValue(new Error("Revoke failed"));

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoadingKeys).toBe(false));

      await expect(
        act(async () => {
          await result.current.revokeApiKey("key-1");
        })
      ).rejects.toThrow("Revoke failed");
    });

    it("should set isRevoking state correctly", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { api_keys: [], total: 0, page: 1, limit: 50 },
      });
      (apiClient.delete as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({}), 100))
      );

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoadingKeys).toBe(false));

      act(() => {
        result.current.revokeApiKey("key-1");
      });

      // Wait for mutation to start
      await waitFor(() => expect(result.current.isRevoking).toBe(true), { timeout: 100 });

      // Wait for mutation to complete
      await waitFor(() => expect(result.current.isRevoking).toBe(false), { timeout: 200 });
    });
  });

  describe("refetch functions", () => {
    it("should expose fetchApiKeys refetch function", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { api_keys: [], total: 0, page: 1, limit: 50 },
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoadingKeys).toBe(false));

      expect(apiClient.get).toHaveBeenCalledTimes(2); // Once for keys, once for scopes

      // Clear previous calls
      (apiClient.get as jest.Mock).mockClear();

      await act(async () => {
        await result.current.fetchApiKeys();
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/auth/api-keys?page=1&limit=50");
      });
    });

    it("should expose getAvailableScopes refetch function", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/scopes/available")) {
          return Promise.resolve({ data: {} });
        }
        return Promise.resolve({
          data: { api_keys: [], total: 0, page: 1, limit: 50 },
        });
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoadingScopes).toBe(false));

      // Clear previous calls
      (apiClient.get as jest.Mock).mockClear();

      await act(async () => {
        await result.current.getAvailableScopes();
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/auth/api-keys/scopes/available");
      });
    });
  });

  describe("combined loading state", () => {
    it("should show loading when any operation is in progress", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { api_keys: [], total: 0, page: 1, limit: 50 },
      });
      (apiClient.post as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100))
      );

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoadingKeys).toBe(false));

      act(() => {
        result.current.createApiKey({
          name: "Test",
          scopes: ["read:data"],
        });
      });

      // Wait for mutation to start
      await waitFor(() => expect(result.current.loading).toBe(true), { timeout: 100 });

      // Wait for mutation to complete
      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 200 });
    });
  });

  describe("API key properties", () => {
    it("should include all key properties", async () => {
      const mockKey = {
        id: "key-1",
        name: "Full Key",
        scopes: ["read:data", "write:data"],
        created_at: "2024-01-01T00:00:00Z",
        expires_at: "2025-01-01T00:00:00Z",
        description: "Test key",
        last_used_at: "2024-01-15T00:00:00Z",
        is_active: true,
        key_preview: "sk_test_****1234",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { api_keys: [mockKey], total: 1, page: 1, limit: 50 },
      });

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoadingKeys).toBe(false));

      expect(result.current.apiKeys[0]).toEqual(mockKey);
      expect(result.current.apiKeys[0].expires_at).toBe("2025-01-01T00:00:00Z");
      expect(result.current.apiKeys[0].last_used_at).toBe("2024-01-15T00:00:00Z");
      expect(result.current.apiKeys[0].description).toBe("Test key");
    });
  });
});
