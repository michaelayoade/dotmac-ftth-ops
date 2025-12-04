/**
 * @fileoverview Tests for useApiClient hook
 * Validates API client functionality, request handling, and error management
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useApiClient } from "../hooks/useApiClient";
import { useAuthStore } from "../auth/store";
import {
  createMockUser,
  createMockTokens,
  mockFetchResponse,
  mockFetchError,
} from "../../__tests__/setup";

// Mock the auth store to provide authentication context
const mockAuthStore = {
  tokens: createMockTokens(),
  user: createMockUser(),
  isAuthenticated: true,
  refreshToken: jest.fn(),
};

jest.mock("../auth/store", () => ({
  useAuthStore: jest.fn(() => mockAuthStore),
}));

const OriginalAbortController = global.AbortController;

describe("useApiClient Hook", () => {
  beforeEach(() => {
    mockAuthStore.tokens = createMockTokens();
    mockAuthStore.user = createMockUser();
    mockAuthStore.isAuthenticated = true;
    mockAuthStore.refreshToken = jest.fn();
    (useAuthStore as jest.Mock).mockImplementation(() => mockAuthStore);
    global.AbortController = OriginalAbortController;
    (global.fetch as jest.Mock).mockReset();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: jest.fn().mockResolvedValue({}),
      text: jest.fn().mockResolvedValue("{}"),
      headers: new Headers({
        "content-type": "application/json",
      }),
    });
  });

  describe("Basic API Requests", () => {
    it("should make GET request successfully", async () => {
      const mockData = { id: 1, name: "Test Item" };
      mockFetchResponse(mockData);

      const { result } = renderHook(() => useApiClient());

      let response: any;
      await act(async () => {
        response = await result.current.get("/api/test");
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          method: "GET",
          headers: {
            Authorization: `Bearer ${mockAuthStore.tokens.accessToken}`,
            "Content-Type": "application/json",
            "X-Tenant-ID": mockAuthStore.user.tenantId,
          },
        }),
      );
      expect(response).toEqual(mockData);
    });

    it("should make POST request with data", async () => {
      const postData = { name: "New Item", description: "Test description" };
      const responseData = { id: 2, ...postData };
      mockFetchResponse(responseData, 201);

      const { result } = renderHook(() => useApiClient());

      let response: any;
      await act(async () => {
        response = await result.current.post("/api/items", postData);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/items",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: `Bearer ${mockAuthStore.tokens.accessToken}`,
            "Content-Type": "application/json",
            "X-Tenant-ID": mockAuthStore.user.tenantId,
          },
          body: JSON.stringify(postData),
        }),
      );
      expect(response).toEqual(responseData);
    });

    it("should make PUT request for updates", async () => {
      const updateData = { id: 1, name: "Updated Item" };
      mockFetchResponse(updateData);

      const { result } = renderHook(() => useApiClient());

      let response: any;
      await act(async () => {
        response = await result.current.put("/api/items/1", updateData);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/items/1",
        expect.objectContaining({
          method: "PUT",
          headers: {
            Authorization: `Bearer ${mockAuthStore.tokens.accessToken}`,
            "Content-Type": "application/json",
            "X-Tenant-ID": mockAuthStore.user.tenantId,
          },
          body: JSON.stringify(updateData),
        }),
      );
      expect(response).toEqual(updateData);
    });

    it("should make DELETE request", async () => {
      mockFetchResponse({}, 204);

      const { result } = renderHook(() => useApiClient());

      await act(async () => {
        await result.current.delete("/api/items/1");
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/items/1",
        expect.objectContaining({
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${mockAuthStore.tokens.accessToken}`,
            "Content-Type": "application/json",
            "X-Tenant-ID": mockAuthStore.user.tenantId,
          },
        }),
      );
    });
  });

  describe("Authentication Integration", () => {
    it("should include authorization headers for authenticated requests", async () => {
      mockFetchResponse({ data: "test" });

      const { result } = renderHook(() => useApiClient());

      await act(async () => {
        await result.current.get("/api/protected");
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/protected",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAuthStore.tokens.accessToken}`,
          }),
        }),
      );
    });

    it("should handle requests when user is not authenticated", async () => {
      mockAuthStore.isAuthenticated = false;
      mockAuthStore.tokens = null;
      mockFetchResponse({ data: "public" });

      const { result } = renderHook(() => useApiClient());

      await act(async () => {
        await result.current.get("/api/public");
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/public",
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.any(String),
          }),
        }),
      );
    });

    it("should refresh token on 401 response", async () => {
      const newTokens = createMockTokens({ accessToken: "new-access-token" });
      mockAuthStore.refreshToken.mockResolvedValueOnce(newTokens);

      // First call returns 401, second call succeeds
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ error: "Unauthorized" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: "success" }),
        });

      const { result } = renderHook(() => useApiClient());

      let response: any;
      await act(async () => {
        response = await result.current.get("/api/protected");
      });

      expect(mockAuthStore.refreshToken).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(response).toEqual({ data: "success" });
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors", async () => {
      const networkError = new Error("Network request failed");
      mockFetchError(networkError);

      const { result } = renderHook(() => useApiClient());

      await act(async () => {
        try {
          await result.current.get("/api/test");
        } catch (error) {
          expect(error).toBe(networkError);
        }
      });
    });

    it("should handle 4xx client errors", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({ error: "Invalid data" }),
      });

      const { result } = renderHook(() => useApiClient());

      await act(async () => {
        try {
          await result.current.post("/api/items", { invalid: "data" });
        } catch (error: any) {
          expect(error.status).toBe(400);
          expect(error.message).toContain("Invalid data");
        }
      });
    });

    it("should handle 5xx server errors", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({ error: "Server error" }),
      });

      const { result } = renderHook(() => useApiClient());

      await act(async () => {
        try {
          await result.current.get("/api/test");
        } catch (error: any) {
          expect(error.status).toBe(500);
          expect(error.message).toContain("Server error");
        }
      });
    });

    it("should handle malformed JSON responses", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      const { result } = renderHook(() => useApiClient());

      await act(async () => {
        try {
          await result.current.get("/api/test");
        } catch (error: any) {
          expect(error.message).toContain("Invalid JSON");
        }
      });
    });
  });

  describe("Request Interceptors", () => {
    it("should allow custom request headers", async () => {
      mockFetchResponse({ data: "test" });

      const { result } = renderHook(() => useApiClient());

      await act(async () => {
        await result.current.get("/api/test", {
          headers: {
            "X-Custom-Header": "custom-value",
          },
        });
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Custom-Header": "custom-value",
          }),
        }),
      );
    });

    it("should merge custom options with defaults", async () => {
      mockFetchResponse({ data: "test" });

      const { result } = renderHook(() => useApiClient());

      await act(async () => {
        await result.current.get("/api/test", {
          headers: { "X-Custom": "value" },
          timeout: 10000,
        });
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAuthStore.tokens.accessToken}`,
            "X-Custom": "value",
          }),
        }),
      );
    });
  });

  describe("Response Interceptors", () => {
    it("should transform successful responses", async () => {
      const rawResponse = {
        data: { id: 1, name: "Test" },
        meta: { total: 1, page: 1 },
      };
      mockFetchResponse(rawResponse);

      const { result } = renderHook(() =>
        useApiClient({
          responseTransformer: (data) => data.data,
        }),
      );

      let response: any;
      await act(async () => {
        response = await result.current.get("/api/items");
      });

      expect(response).toEqual({ id: 1, name: "Test" });
    });

    it("should handle response transformation errors", async () => {
      mockFetchResponse({ data: "test" });

      const { result } = renderHook(() =>
        useApiClient({
          responseTransformer: () => {
            throw new Error("Transform error");
          },
        }),
      );

      await act(async () => {
        try {
          await result.current.get("/api/test");
        } catch (error: any) {
          expect(error.message).toContain("Transform error");
        }
      });
    });
  });

  describe("Portal-Specific Configuration", () => {
    const portals = [
      { portal: "admin", baseURL: "/api/admin" },
      { portal: "customer", baseURL: "/api/customer" },
      { portal: "technician", baseURL: "/api/technician" },
      { portal: "reseller", baseURL: "/api/reseller" },
      { portal: "management-admin", baseURL: "/api/management" },
      { portal: "management-reseller", baseURL: "/api/management-reseller" },
      { portal: "tenant-portal", baseURL: "/api/isp/v1/portal" },
    ];

    portals.forEach(({ portal, baseURL }) => {
      it(`should configure API client for ${portal} portal`, async () => {
        mockFetchResponse({ data: "test" });

        const { result } = renderHook(() =>
          useApiClient({
            portal,
            baseURL,
          }),
        );

        await act(async () => {
          await result.current.get("/health");
        });

        expect(global.fetch).toHaveBeenCalledWith(`${baseURL}/health`, expect.any(Object));
      });
    });
  });

  describe("Request Caching", () => {
    it("should cache GET requests when enabled", async () => {
      const cacheData = { id: 1, name: "Cached Item" };
      mockFetchResponse(cacheData);

      const { result } = renderHook(() =>
        useApiClient({
          enableCaching: true,
          cacheTimeout: 5000,
        }),
      );

      // First request
      await act(async () => {
        await result.current.get("/api/items/1");
      });

      // Second request (should use cache)
      let cachedResponse: any;
      await act(async () => {
        cachedResponse = await result.current.get("/api/items/1");
      });

      expect(global.fetch).toHaveBeenCalledTimes(1); // Only called once
      expect(cachedResponse).toEqual(cacheData);
    });

    it("should bypass cache for non-GET requests", async () => {
      const postData = { name: "New Item" };
      mockFetchResponse({ id: 2, ...postData }, 201);

      const { result } = renderHook(() =>
        useApiClient({
          enableCaching: true,
        }),
      );

      await act(async () => {
        await result.current.post("/api/items", postData);
        await result.current.post("/api/items", postData);
      });

      expect(global.fetch).toHaveBeenCalledTimes(2); // Both requests made
    });

    it("should invalidate cache when specified", async () => {
      mockFetchResponse({ data: "test" });

      const { result } = renderHook(() =>
        useApiClient({
          enableCaching: true,
        }),
      );

      await act(async () => {
        await result.current.get("/api/items/1");
        result.current.invalidateCache("/api/items/1");
        await result.current.get("/api/items/1");
      });

      expect(global.fetch).toHaveBeenCalledTimes(2); // Cache was invalidated
    });
  });

  describe("Request Timeout", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      // Ensure no timers leak into subsequent tests
      jest.runOnlyPendingTimers();
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it("should timeout long-running requests", async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 10000)),
      );

      const { result } = renderHook(() =>
        useApiClient({
          timeout: 5000,
        }),
      );

      const requestPromise = act(async () => {
        await result.current.get("/api/slow");
      });

      // Fast-forward time to trigger timeout
      act(() => {
        jest.advanceTimersByTime(6000);
      });

      await expect(requestPromise).rejects.toThrow(/timeout/i);
    });
  });

  describe("Retry Logic", () => {
    it("should retry failed requests", async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: "success" }),
        });

      const { result } = renderHook(() =>
        useApiClient({
          retries: 2,
          retryDelay: 1000,
        }),
      );

      let response: any;
      await act(async () => {
        response = await result.current.get("/api/test");
      });

      expect(global.fetch).toHaveBeenCalledTimes(3); // Original + 2 retries
      expect(response).toEqual({ data: "success" });
    });

    it("should not retry on 4xx errors", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({ error: "Bad request" }),
      });

      const { result } = renderHook(() =>
        useApiClient({
          retries: 3,
        }),
      );

      await act(async () => {
        try {
          await result.current.get("/api/test");
        } catch (error) {
          // Expected to throw
        }
      });

      expect(global.fetch).toHaveBeenCalledTimes(1); // No retries for client errors
    });
  });

  describe("Loading State Management", () => {
    it("should track loading state for requests", async () => {
      mockFetchResponse({ data: "test" });

      const { result } = renderHook(() => useApiClient());

      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.get("/api/test");
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it("should track loading state per request", async () => {
      mockFetchResponse({ data: "test" });

      const { result } = renderHook(() => useApiClient());

      act(() => {
        result.current.get("/api/test");
      });

      expect(result.current.isRequestLoading("/api/test")).toBe(true);
      expect(result.current.isRequestLoading("/api/other")).toBe(false);

      await waitFor(() => {
        expect(result.current.isRequestLoading("/api/test")).toBe(false);
      });
    });
  });

  describe("AbortController Integration", () => {
    it("should cancel requests when component unmounts", async () => {
      const abortSpy = jest.fn();
      global.AbortController = jest.fn(() => ({
        abort: abortSpy,
        signal: { aborted: false },
      })) as any;

      const { result, unmount } = renderHook(() => useApiClient());

      act(() => {
        result.current.get("/api/test");
      });

      unmount();

      expect(abortSpy).toHaveBeenCalled();
    });

    it("should allow manual request cancellation", async () => {
      const { result } = renderHook(() => useApiClient());

      let request: Promise<any>;
      act(() => {
        request = result.current.get("/api/test");
        result.current.cancelRequest("/api/test");
      });

      await expect(request!).rejects.toThrow(/aborted/i);
    });
  });
});
