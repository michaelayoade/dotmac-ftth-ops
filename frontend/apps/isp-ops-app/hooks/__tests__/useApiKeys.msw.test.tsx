/**
 * MSW-powered tests for useApiKeys
 *
 * This test file uses MSW for API mocking instead of jest.mock.
 * MSW provides more realistic network mocking and better test isolation.
 *
 * Tests the actual hook contract: { apiKeys, loading, error, createApiKey, ... }
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useApiKeys, apiKeysKeys } from "../useApiKeys";
import {
  createTestQueryClient,
  createQueryWrapper,
  resetApiKeysStorage,
  createMockApiKey,
  seedApiKeysData,
  makeApiEndpointFail,
} from "../../__tests__/test-utils";

describe("useApiKeys (MSW)", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    resetApiKeysStorage();
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

      seedApiKeysData(mockKeys);

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
      seedApiKeysData([]);

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.apiKeys).toHaveLength(0);
      expect(result.current.total).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it("should handle pagination", async () => {
      const keys = Array.from({ length: 75 }, (_, i) =>
        createMockApiKey({ id: `key-${i + 1}`, name: `Key ${i + 1}` })
      );

      seedApiKeysData(keys);

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
      seedApiKeysData([]);

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.availableScopes).toBeDefined();
      expect(result.current.availableScopes["read:subscribers"]).toBeDefined();
      expect(result.current.availableScopes["read:subscribers"].name).toBe("Read Subscribers");
    });

    it("should handle fetch error", async () => {
      makeApiEndpointFail("get", "/api/v1/auth/api-keys", "Server error", 500);

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.apiKeys).toHaveLength(0);
    });
  });

  describe("useApiKeys - create API key", () => {
    it("should create API key successfully", async () => {
      seedApiKeysData([]);

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

      // Verify hook state updated
      await waitFor(() => {
        expect(result.current.apiKeys).toHaveLength(1);
        expect(result.current.apiKeys[0].name).toBe("New API Key");
      });
    });

    it("should handle create error", async () => {
      seedApiKeysData([]);
      makeApiEndpointFail("post", "/api/v1/auth/api-keys", "Invalid scopes", 400);

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        result.current.createApiKey({
          name: "Invalid Key",
          scopes: ["invalid:scope"],
        })
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

      seedApiKeysData([existingKey]);

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
      seedApiKeysData([]);

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        result.current.updateApiKey("non-existent", { name: "New Name" })
      ).rejects.toThrow();
    });
  });

  describe("useApiKeys - revoke API key", () => {
    it("should revoke API key successfully", async () => {
      const keys = [
        createMockApiKey({ id: "key-1", name: "Key 1" }),
        createMockApiKey({ id: "key-2", name: "Key 2" }),
      ];

      seedApiKeysData(keys);

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
      seedApiKeysData([]);

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(result.current.revokeApiKey("non-existent")).rejects.toThrow();
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle creating multiple API keys", async () => {
      seedApiKeysData([]);

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Create multiple keys
      await act(async () => {
        await result.current.createApiKey({
          name: "Production Key",
          scopes: ["read:subscribers", "write:subscribers"],
        });
      });

      await act(async () => {
        await result.current.createApiKey({
          name: "Development Key",
          scopes: ["read:subscribers"],
        });
      });

      await waitFor(() => {
        expect(result.current.apiKeys).toHaveLength(2);
      });
    });

    it("should handle updating and then revoking a key", async () => {
      const key = createMockApiKey({
        id: "key-1",
        name: "Test Key",
        is_active: true,
      });

      seedApiKeysData([key]);

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Update key
      await act(async () => {
        await result.current.updateApiKey("key-1", { is_active: false });
      });

      await waitFor(() => {
        expect(result.current.apiKeys[0].is_active).toBe(false);
      });

      // Revoke key
      await act(async () => {
        await result.current.revokeApiKey("key-1");
      });

      await waitFor(() => {
        expect(result.current.apiKeys).toHaveLength(0);
      });
    });

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

      seedApiKeysData(keys);

      const { result } = renderHook(() => useApiKeys(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.apiKeys).toHaveLength(3);
      expect(result.current.apiKeys[0].scopes).toHaveLength(3);
      expect(result.current.apiKeys[1].scopes).toHaveLength(1);
      expect(result.current.apiKeys[2].scopes).toContain("read:billing");
    });
  });
});
