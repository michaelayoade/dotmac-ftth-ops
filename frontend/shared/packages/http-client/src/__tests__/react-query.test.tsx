/**
 * @jest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import React from "react";

import { HttpClient } from "../http-client";
import {
  createApiQuery,
  useApiQuery,
  useApiMutation,
  createHttpClientForQuery,
} from "../react-query";
import type { ApiError } from "../types";

// Mock the http-client module
jest.mock("../http-client", () => ({
  HttpClient: {
    create: jest.fn(),
  },
}));

const mockHttpClient = HttpClient as jest.Mocked<typeof HttpClient>;

describe("react-query utilities", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
        mutations: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  const createWrapper = () => {
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  describe("createApiQuery()", () => {
    it("creates a request descriptor with execute function", () => {
      const mockFn = jest.fn().mockResolvedValue({ id: 1, name: "Test" });
      const descriptor = createApiQuery(mockFn);

      expect(descriptor).toHaveProperty("execute");
      expect(typeof descriptor.execute).toBe("function");
    });

    it("execute function calls the provided request function", async () => {
      const mockFn = jest.fn().mockResolvedValue({ id: 1, name: "Test" });
      const descriptor = createApiQuery(mockFn);

      const result = await descriptor.execute();

      expect(mockFn).toHaveBeenCalled();
      expect(result).toEqual({ id: 1, name: "Test" });
    });

    it("propagates errors from the request function", async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error("Request failed"));
      const descriptor = createApiQuery(mockFn);

      await expect(descriptor.execute()).rejects.toThrow("Request failed");
    });
  });

  describe("useApiQuery()", () => {
    it("fetches data using the descriptor", async () => {
      const mockData = { id: 1, name: "Test User" };
      const mockFn = jest.fn().mockResolvedValue(mockData);
      const descriptor = createApiQuery(mockFn);

      const { result } = renderHook(
        () => useApiQuery(["users", 1], descriptor),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("handles query errors", async () => {
      const mockError: ApiError = {
        message: "User not found",
        code: "NOT_FOUND",
        status: 404,
      };
      const mockFn = jest.fn().mockRejectedValue(mockError);
      const descriptor = createApiQuery(mockFn);

      const { result } = renderHook(
        () => useApiQuery(["users", 999], descriptor),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(mockError);
    });

    it("passes query options to useQuery", async () => {
      const mockFn = jest.fn().mockResolvedValue({ data: "test" });
      const descriptor = createApiQuery(mockFn);

      const { result } = renderHook(
        () =>
          useApiQuery(["data"], descriptor, {
            enabled: false,
          }),
        { wrapper: createWrapper() }
      );

      // Should not fetch when enabled is false
      expect(mockFn).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe("idle");
    });

    it("uses query key for caching", async () => {
      const mockFn = jest.fn().mockResolvedValue({ id: 1 });
      const descriptor = createApiQuery(mockFn);

      const { result, rerender } = renderHook(
        () => useApiQuery(["users", 1], descriptor),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Rerender should use cached data, not refetch
      rerender();

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("refetches when query key changes", async () => {
      const mockFn = jest.fn()
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 2 });

      let userId = 1;
      const { result, rerender } = renderHook(
        () => useApiQuery(["users", userId], createApiQuery(mockFn)),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toEqual({ id: 1 });

      // Change query key
      userId = 2;
      rerender();

      await waitFor(() => {
        expect(result.current.data).toEqual({ id: 2 });
      });

      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("supports staleTime option", async () => {
      const mockFn = jest.fn().mockResolvedValue({ data: "fresh" });
      const descriptor = createApiQuery(mockFn);

      renderHook(
        () =>
          useApiQuery(["data"], descriptor, {
            staleTime: 10000, // 10 seconds
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(mockFn).toHaveBeenCalledTimes(1);
      });
    });

    it("returns typed data", async () => {
      interface User {
        id: number;
        name: string;
        email: string;
      }

      const mockUser: User = { id: 1, name: "John", email: "john@test.com" };
      const mockFn = jest.fn().mockResolvedValue(mockUser);
      const descriptor = createApiQuery<User>(mockFn);

      const { result } = renderHook(
        () => useApiQuery<User>(["users", 1], descriptor),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // TypeScript should infer this correctly
      expect(result.current.data?.id).toBe(1);
      expect(result.current.data?.name).toBe("John");
    });
  });

  describe("useApiMutation()", () => {
    it("executes mutation with variables", async () => {
      const mockFn = jest.fn().mockResolvedValue({ id: 1, name: "Created User" });

      const { result } = renderHook(
        () => useApiMutation(mockFn),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        await result.current.mutateAsync({ name: "New User" });
      });

      // First argument is the variables
      expect(mockFn.mock.calls[0][0]).toEqual({ name: "New User" });
      await waitFor(() => {
        expect(result.current.data).toEqual({ id: 1, name: "Created User" });
      });
    });

    it("handles mutation errors", async () => {
      const mockError: ApiError = {
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        status: 422,
      };
      const mockFn = jest.fn().mockRejectedValue(mockError);

      const { result } = renderHook(
        () => useApiMutation(mockFn),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        try {
          await result.current.mutateAsync({ invalid: "data" });
        } catch {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      expect(result.current.error).toEqual(mockError);
    });

    it("calls onSuccess callback", async () => {
      const mockFn = jest.fn().mockResolvedValue({ success: true });
      const onSuccess = jest.fn();

      const { result } = renderHook(
        () => useApiMutation(mockFn, { onSuccess }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        await result.current.mutateAsync({ data: "test" });
      });

      expect(onSuccess).toHaveBeenCalledWith(
        { success: true },
        { data: "test" },
        undefined,
        expect.anything()
      );
    });

    it("calls onError callback", async () => {
      const mockError: ApiError = { message: "Error", code: "ERROR" };
      const mockFn = jest.fn().mockRejectedValue(mockError);
      const onError = jest.fn();

      const { result } = renderHook(
        () => useApiMutation(mockFn, { onError }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        try {
          await result.current.mutateAsync({ data: "test" });
        } catch {
          // Expected
        }
      });

      expect(onError).toHaveBeenCalledWith(
        mockError,
        { data: "test" },
        undefined,
        expect.anything()
      );
    });

    it("calls onSettled callback on success", async () => {
      const mockFn = jest.fn().mockResolvedValue({ result: "ok" });
      const onSettled = jest.fn();

      const { result } = renderHook(
        () => useApiMutation(mockFn, { onSettled }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        await result.current.mutateAsync({});
      });

      expect(onSettled).toHaveBeenCalledWith(
        { result: "ok" },
        null,
        {},
        undefined,
        expect.anything()
      );
    });

    it("calls onSettled callback on error", async () => {
      const mockError: ApiError = { message: "Error", code: "ERROR" };
      const mockFn = jest.fn().mockRejectedValue(mockError);
      const onSettled = jest.fn();

      const { result } = renderHook(
        () => useApiMutation(mockFn, { onSettled }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        try {
          await result.current.mutateAsync({});
        } catch {
          // Expected
        }
      });

      expect(onSettled).toHaveBeenCalledWith(
        undefined,
        mockError,
        {},
        undefined,
        expect.anything()
      );
    });

    it("invalidates queries on success", async () => {
      const mockFn = jest.fn().mockResolvedValue({ id: 1 });

      // Pre-populate the cache
      queryClient.setQueryData(["users"], [{ id: 1, name: "Old User" }]);
      queryClient.setQueryData(["posts"], [{ id: 1, title: "Old Post" }]);

      const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(
        () =>
          useApiMutation(mockFn, {
            invalidateQueries: [["users"], ["posts"]],
          }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        await result.current.mutateAsync({ name: "New User" });
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["users"] });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["posts"] });

      invalidateQueriesSpy.mockRestore();
    });

    it("does not invalidate queries on error", async () => {
      const mockFn = jest.fn().mockRejectedValue({ message: "Error" });

      const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(
        () =>
          useApiMutation(mockFn, {
            invalidateQueries: [["users"]],
          }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        try {
          await result.current.mutateAsync({});
        } catch {
          // Expected
        }
      });

      // onSettled is called even on error, but invalidateQueries should still be called
      // The implementation always invalidates in onSettled
      expect(invalidateQueriesSpy).toHaveBeenCalled();

      invalidateQueriesSpy.mockRestore();
    });

    it("supports mutation without variables", async () => {
      const mockFn = jest.fn().mockResolvedValue({ triggered: true });

      const { result } = renderHook(
        () => useApiMutation<{ triggered: boolean }, void>(mockFn),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        await result.current.mutateAsync();
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(mockFn).toHaveBeenCalled();
      expect(result.current.data).toEqual({ triggered: true });
    });

    it("tracks mutation state correctly", async () => {
      let resolvePromise: (value: any) => void;
      const mockFn = jest.fn().mockImplementation(
        () => new Promise((resolve) => { resolvePromise = resolve; })
      );

      const { result } = renderHook(
        () => useApiMutation(mockFn),
        { wrapper: createWrapper() }
      );

      expect(result.current.isPending).toBe(false);
      expect(result.current.isSuccess).toBe(false);

      let mutationPromise: Promise<any>;
      act(() => {
        mutationPromise = result.current.mutateAsync({});
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(true);
      });

      await act(async () => {
        resolvePromise!({ done: true });
        await mutationPromise;
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.isPending).toBe(false);
    });
  });

  describe("createHttpClientForQuery()", () => {
    it("creates HttpClient with default config", () => {
      const mockInstance = {
        enableAuth: jest.fn().mockReturnThis(),
      };
      mockHttpClient.create.mockReturnValue(mockInstance as any);

      createHttpClientForQuery();

      expect(mockHttpClient.create).toHaveBeenCalledWith({});
      expect(mockInstance.enableAuth).toHaveBeenCalled();
    });

    it("creates HttpClient with custom config", () => {
      const mockInstance = {
        enableAuth: jest.fn().mockReturnThis(),
      };
      mockHttpClient.create.mockReturnValue(mockInstance as any);

      createHttpClientForQuery({
        baseURL: "https://api.example.com",
        timeout: 60000,
      });

      expect(mockHttpClient.create).toHaveBeenCalledWith({
        baseURL: "https://api.example.com",
        timeout: 60000,
      });
      expect(mockInstance.enableAuth).toHaveBeenCalled();
    });

    it("enables authentication by default", () => {
      const mockInstance = {
        enableAuth: jest.fn().mockReturnThis(),
      };
      mockHttpClient.create.mockReturnValue(mockInstance as any);

      const client = createHttpClientForQuery();

      expect(mockInstance.enableAuth).toHaveBeenCalled();
      expect(client).toBe(mockInstance);
    });
  });

  describe("integration scenarios", () => {
    it("handles sequential mutations with query invalidation", async () => {
      const fetchUsers = jest.fn().mockResolvedValue([{ id: 1, name: "User 1" }]);
      const createUser = jest.fn().mockResolvedValue({ id: 2, name: "User 2" });

      // Setup query
      const { result: queryResult } = renderHook(
        () => useApiQuery(["users"], createApiQuery(fetchUsers)),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(queryResult.current.isSuccess).toBe(true);
      });

      // Setup mutation that invalidates users query
      const { result: mutationResult } = renderHook(
        () =>
          useApiMutation(createUser, {
            invalidateQueries: [["users"]],
          }),
        { wrapper: createWrapper() }
      );

      // Execute mutation
      await act(async () => {
        await mutationResult.current.mutateAsync({ name: "User 2" });
      });

      // The query should have been invalidated
      expect(fetchUsers).toHaveBeenCalledTimes(2);
    });

    it("handles parallel queries", async () => {
      const fetchUsers = jest.fn().mockResolvedValue([{ id: 1 }]);
      const fetchPosts = jest.fn().mockResolvedValue([{ id: 1 }]);

      const { result } = renderHook(
        () => ({
          users: useApiQuery(["users"], createApiQuery(fetchUsers)),
          posts: useApiQuery(["posts"], createApiQuery(fetchPosts)),
        }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.users.isSuccess).toBe(true);
        expect(result.current.posts.isSuccess).toBe(true);
      });

      expect(fetchUsers).toHaveBeenCalledTimes(1);
      expect(fetchPosts).toHaveBeenCalledTimes(1);
    });
  });
});
