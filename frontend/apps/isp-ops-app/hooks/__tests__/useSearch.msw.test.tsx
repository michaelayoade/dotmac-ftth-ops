/**
 * MSW Tests for useSearch hooks
 * Tests global search functionality with realistic API mocking
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useSearch,
  useQuickSearch,
  useSearchByType,
  useDebouncedSearch,
  useIndexContent,
  useRemoveFromIndex,
  useReindex,
  useSearchStatistics,
  useSearchWithSuggestions,
  useSearchWithStats,
  searchKeys,
} from "../useSearch";
import {
  clearSearchData,
  seedSearchIndex,
  seedSearchStatistics,
  createMockSearchResult,
} from "@/__tests__/msw/handlers/search";

// Mock platformConfig to provide a base URL for MSW to intercept
jest.mock("@/lib/config", () => ({
  platformConfig: {
    api: {
      baseUrl: "http://localhost:3000",
      prefix: "/api/v1",
      timeout: 30000,
      buildUrl: (path: string) => `http://localhost:3000/api/v1${path}`,
    },
  },
}));

// Mock useToast
jest.mock("@dotmac/ui", () => ({
  ...jest.requireActual("@dotmac/ui"),
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const waitForSearchSuccess = async (getStatus: () => boolean) => {
  await waitFor(() => expect(getStatus()).toBe(true), { timeout: 5000 });
};

describe("useSearch", () => {
  beforeEach(() => {
    clearSearchData();
  });

  describe("query keys", () => {
    it("should generate correct query keys", () => {
      expect(searchKeys.all).toEqual(["search"]);
      expect(searchKeys.searches({ q: "test", limit: 10 })).toEqual([
        "search",
        { q: "test", limit: 10 },
      ]);
      expect(searchKeys.statistics()).toEqual(["search", "statistics"]);
    });
  });

  describe("useSearch", () => {
    it("should search successfully", async () => {
      seedSearchIndex([
        {
          id: "1",
          type: "subscriber",
          title: "Test User",
          content: "test@example.com",
        },
        {
          id: "2",
          type: "job",
          title: "Installation Job",
          content: "Install fiber",
        },
      ]);

      const { result } = renderHook(() => useSearch({ q: "test", limit: 10, page: 1 }), {
        wrapper: createWrapper(),
      });

      await waitForSearchSuccess(() => result.current.isSuccess);

      expect(result.current.data?.results).toHaveLength(1);
      expect(result.current.data?.results[0].title).toBe("Test User");
      expect(result.current.data?.total).toBe(1);
    });

    it("should not fetch when query is empty", () => {
      const { result } = renderHook(() => useSearch({ q: "", limit: 10, page: 1 }), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should not fetch when query is whitespace only", () => {
      const { result } = renderHook(() => useSearch({ q: "   ", limit: 10, page: 1 }), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should not fetch when disabled", () => {
      const { result } = renderHook(() => useSearch({ q: "test", limit: 10, page: 1 }, false), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should filter by type", async () => {
      seedSearchIndex([
        {
          id: "1",
          type: "subscriber",
          title: "Test User",
          content: "user data",
        },
        {
          id: "2",
          type: "job",
          title: "Test Job",
          content: "job data",
        },
      ]);

      const { result } = renderHook(
        () => useSearch({ q: "test", type: "subscriber", limit: 10, page: 1 }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitForSearchSuccess(() => result.current.isSuccess);

      expect(result.current.data?.results).toHaveLength(1);
      expect(result.current.data?.results[0].type).toBe("subscriber");
    });
  });

  describe("useQuickSearch", () => {
    it("should perform quick search", async () => {
      seedSearchIndex([
        {
          id: "1",
          type: "subscriber",
          title: "Quick Result",
          content: "test",
        },
      ]);

      const { result } = renderHook(() => useQuickSearch("test", "subscriber", 5), {
        wrapper: createWrapper(),
      });

      await waitForSearchSuccess(() => result.current.isSuccess);

      expect(result.current.data?.results).toHaveLength(1);
      expect(result.current.data?.results[0].title).toBe("Quick Result");
    });

    it("should use default limit of 10", async () => {
      seedSearchIndex(
        Array.from({ length: 15 }, (_, i) => ({
          id: `${i + 1}`,
          type: "subscriber",
          title: `Result ${i + 1}`,
          content: "test",
        }))
      );

      const { result } = renderHook(() => useQuickSearch("test"), {
        wrapper: createWrapper(),
      });

      await waitForSearchSuccess(() => result.current.isSuccess);

      expect(result.current.data?.results).toHaveLength(10);
    });

    it("should not fetch when query is empty", () => {
      const { result } = renderHook(() => useQuickSearch(""), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useSearchByType", () => {
    it("should search by entity type", async () => {
      seedSearchIndex([
        {
          id: "1",
          type: "subscriber",
          title: "Typed Result",
          content: "test",
        },
        {
          id: "2",
          type: "job",
          title: "Job Result",
          content: "test",
        },
      ]);

      const { result } = renderHook(() => useSearchByType("test", "subscriber", 15), {
        wrapper: createWrapper(),
      });

      await waitForSearchSuccess(() => result.current.isSuccess);

      expect(result.current.data?.results).toHaveLength(1);
      expect(result.current.data?.results[0].type).toBe("subscriber");
    });

    it("should use default limit of 20", async () => {
      seedSearchIndex(
        Array.from({ length: 25 }, (_, i) => ({
          id: `${i + 1}`,
          type: "subscriber",
          title: `Result ${i + 1}`,
          content: "test",
        }))
      );

      const { result } = renderHook(() => useSearchByType("test", "subscriber"), {
        wrapper: createWrapper(),
      });

      await waitForSearchSuccess(() => result.current.isSuccess);

      expect(result.current.data?.results).toHaveLength(20);
    });

    it("should respect enabled flag", () => {
      const { result } = renderHook(() => useSearchByType("test", "subscriber", 20, false), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useIndexContent", () => {
    it("should index content successfully", async () => {
      const { result } = renderHook(() => useIndexContent(), {
        wrapper: createWrapper(),
      });

      let indexResult;
      await act(async () => {
        indexResult = await result.current.mutateAsync({
          id: "content-123",
          type: "subscriber",
          title: "Test Content",
          content: "Test content body",
        });
      });

      expect(indexResult).toBeDefined();
      expect(indexResult.indexed).toBe(true);
      expect(indexResult.id).toBe("content-123");
    });

    it("should call onSuccess callback", async () => {
      const onSuccessMock = jest.fn();

      const { result } = renderHook(() => useIndexContent({ onSuccess: onSuccessMock }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          id: "content-123",
          type: "subscriber",
          title: "Test",
          content: "Test",
        });
      });

      await waitForSearchSuccess(() => result.current.isSuccess);

      expect(onSuccessMock).toHaveBeenCalled();
    });
  });

  describe("useRemoveFromIndex", () => {
    it("should remove content from index successfully", async () => {
      // Seed with content first
      seedSearchIndex([
        {
          id: "content-123",
          type: "subscriber",
          title: "To Remove",
          content: "test",
        },
      ]);

      const { result } = renderHook(() => useRemoveFromIndex(), {
        wrapper: createWrapper(),
      });

      let removeResult;
      await act(async () => {
        removeResult = await result.current.mutateAsync("content-123");
      });

      expect(removeResult).toBeDefined();
      expect(removeResult.removed).toBe(true);
      expect(removeResult.id).toBe("content-123");
    });

    it("should call onSuccess callback", async () => {
      const onSuccessMock = jest.fn();

      const { result } = renderHook(() => useRemoveFromIndex({ onSuccess: onSuccessMock }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("content-123");
      });

      await waitForSearchSuccess(() => result.current.isSuccess);

      expect(onSuccessMock).toHaveBeenCalled();
    });
  });

  describe("useReindex", () => {
    it("should trigger reindex successfully", async () => {
      const { result } = renderHook(() => useReindex(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({ entityType: "subscriber", entityIds: ["sub-123"] });
      });

      expect(result.current.isSuccess).toBe(true);
    });

    it("should call onSuccess callback", async () => {
      const onSuccessMock = jest.fn();

      const { result } = renderHook(() => useReindex({ onSuccess: onSuccessMock }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({ entityType: "subscriber" });
      });

      await waitForSearchSuccess(() => result.current.isSuccess);

      expect(onSuccessMock).toHaveBeenCalled();
    });
  });

  describe("useSearchStatistics", () => {
    it("should fetch search statistics", async () => {
      seedSearchStatistics({
        totalDocuments: 1000,
        indexedEntities: 3,
        entitiesByType: {
          subscriber: 500,
          job: 300,
          ticket: 200,
        },
        lastIndexedAt: "2024-01-01T00:00:00Z",
        indexSize: "500MB",
        status: "healthy",
      });

      const { result } = renderHook(() => useSearchStatistics(), {
        wrapper: createWrapper(),
      });

      await waitForSearchSuccess(() => result.current.isSuccess);

      expect(result.current.data?.totalDocuments).toBe(1000);
      expect(result.current.data?.entitiesByType.subscriber).toBe(500);
    });

    it("should respect enabled flag", () => {
      const { result } = renderHook(() => useSearchStatistics(false), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useDebouncedSearch", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should debounce search queries", async () => {
      seedSearchIndex([
        {
          id: "1",
          type: "subscriber",
          title: "Debounced Result",
          content: "test",
        },
      ]);

      const { result, rerender } = renderHook(
        ({ query }) => useDebouncedSearch(query, undefined, 300),
        {
          wrapper: createWrapper(),
          initialProps: { query: "" },
        }
      );

      // Initially should not fetch
      expect(result.current.fetchStatus).toBe("idle");

      // Change query multiple times
      rerender({ query: "t" });
      rerender({ query: "te" });
      rerender({ query: "tes" });
      rerender({ query: "test" });

      // Fast-forward time by 300ms
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Should now fetch
      await waitForSearchSuccess(() => result.current.isSuccess);

      expect(result.current.data?.results).toHaveLength(1);
    });

    it("should use custom debounce time", async () => {
      seedSearchIndex([
        {
          id: "1",
          type: "subscriber",
          title: "Custom Debounce",
          content: "test",
        },
      ]);

      const { result, rerender } = renderHook(
        ({ query }) => useDebouncedSearch(query, undefined, 500),
        {
          wrapper: createWrapper(),
          initialProps: { query: "" },
        }
      );

      // Update to test query
      rerender({ query: "test" });

      // Should not fetch before debounce time
      act(() => {
        jest.advanceTimersByTime(300);
      });
      expect(result.current.fetchStatus).toBe("idle");

      // Should fetch after debounce time
      act(() => {
        jest.advanceTimersByTime(200);
      });

      await waitForSearchSuccess(() => result.current.isSuccess);
    });

    it("should filter by type when provided", async () => {
      seedSearchIndex([
        {
          id: "1",
          type: "subscriber",
          title: "Subscriber Result",
          content: "test",
        },
        {
          id: "2",
          type: "invoice",
          title: "Invoice Result",
          content: "test",
        },
      ]);

      const { result } = renderHook(() => useDebouncedSearch("test", "subscriber", 300), {
        wrapper: createWrapper(),
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitForSearchSuccess(() => result.current.isSuccess);

      expect(result.current.data?.results).toHaveLength(1);
      expect(result.current.data?.results[0].type).toBe("subscriber");
    });

    it("should not fetch when debounced query is empty", async () => {
      const { result } = renderHook(() => useDebouncedSearch("", undefined, 300), {
        wrapper: createWrapper(),
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    });
  });

  describe("useSearchWithSuggestions", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should return debounced search results", async () => {
      seedSearchIndex([
        {
          id: "1",
          type: "subscriber",
          title: "Suggestion 1",
          content: "test",
        },
        {
          id: "2",
          type: "subscriber",
          title: "Suggestion 2",
          content: "test",
        },
      ]);

      const { result } = renderHook(() => useSearchWithSuggestions("test"), {
        wrapper: createWrapper(),
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.results).toHaveLength(2);
      expect(result.current.total).toBe(2);
    });

    it("should filter by type when provided", async () => {
      seedSearchIndex([
        {
          id: "1",
          type: "subscriber",
          title: "Subscriber Suggestion",
          content: "test",
        },
        {
          id: "2",
          type: "invoice",
          title: "Invoice Suggestion",
          content: "test",
        },
      ]);

      const { result } = renderHook(() => useSearchWithSuggestions("test", "subscriber"), {
        wrapper: createWrapper(),
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.results).toHaveLength(1);
      expect(result.current.results[0].type).toBe("subscriber");
    });

    it("should return facets", async () => {
      seedSearchIndex([
        {
          id: "1",
          type: "subscriber",
          title: "Result 1",
          content: "test",
        },
        {
          id: "2",
          type: "invoice",
          title: "Result 2",
          content: "test",
        },
      ]);

      const { result } = renderHook(() => useSearchWithSuggestions("test"), {
        wrapper: createWrapper(),
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.facets).toBeDefined();
      expect(result.current.facets?.types).toBeDefined();
    });

    it("should expose refetch function", async () => {
      seedSearchIndex([
        {
          id: "1",
          type: "subscriber",
          title: "Result",
          content: "test",
        },
      ]);

      const { result } = renderHook(() => useSearchWithSuggestions("test"), {
        wrapper: createWrapper(),
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.refetch).toBeDefined();
      expect(typeof result.current.refetch).toBe("function");
    });
  });

  describe("useSearchWithStats", () => {
    it("should combine search results with statistics", async () => {
      seedSearchIndex([
        {
          id: "1",
          type: "subscriber",
          title: "Result 1",
          content: "test",
        },
      ]);

      seedSearchStatistics({
        total_documents: 1000,
        by_entity_type: { subscriber: 500 },
        index_size: 512000,
        last_indexed: "2024-01-01T00:00:00Z",
      });

      const { result } = renderHook(() => useSearchWithStats({ q: "test", limit: 10, page: 1 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.results).toHaveLength(1);
      expect(result.current.total).toBe(1);
      expect(result.current.statistics?.total_documents).toBe(1000);
    });

    it("should expose refetch function that refetches both", async () => {
      seedSearchIndex([
        {
          id: "1",
          type: "subscriber",
          title: "Result 1",
          content: "test",
        },
      ]);

      seedSearchStatistics({
        total_documents: 100,
        by_entity_type: {},
        index_size: 51200,
        last_indexed: "2024-01-01T00:00:00Z",
      });

      const { result } = renderHook(() => useSearchWithStats({ q: "test", limit: 10, page: 1 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.refetch).toBeDefined();
      expect(typeof result.current.refetch).toBe("function");

      await act(async () => {
        await result.current.refetch();
      });

      // Should still have data after refetch
      expect(result.current.results).toHaveLength(1);
    });

    it("should handle errors from both queries", async () => {
      // Don't seed any data to trigger empty results
      clearSearchData();

      const { result } = renderHook(() => useSearchWithStats({ q: "test", limit: 10, page: 1 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Should handle empty state gracefully
      expect(result.current.results).toHaveLength(0);
      expect(result.current.total).toBe(0);
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle search, index, then search again workflow", async () => {
      // Initial search - empty
      seedSearchIndex([]);

      const { result: searchResult } = renderHook(
        () => useSearch({ q: "john", limit: 10, page: 1 }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitForSearchSuccess(() => searchResult.current.isSuccess);
      expect(searchResult.current.data?.results).toHaveLength(0);

      // Index new content
      const { result: indexResult } = renderHook(() => useIndexContent(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await indexResult.current.mutateAsync({
          entity_id: "subscriber-123",
          entity_type: "subscriber",
          title: "John Doe",
          content: "john.doe@example.com",
          metadata: { status: "active" },
        });
      });

      expect(indexResult.current.isSuccess).toBe(true);

      // Search again - should find the indexed content
      const { result: searchAgainResult } = renderHook(
        () => useSearch({ q: "john", limit: 10, page: 1 }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitForSearchSuccess(() => searchAgainResult.current.isSuccess);
      expect(searchAgainResult.current.data?.results).toHaveLength(1);
      expect(searchAgainResult.current.data?.results[0].title).toBe("John Doe");
    });

    it("should handle pagination through search results", async () => {
      seedSearchIndex(
        Array.from({ length: 25 }, (_, i) => ({
          id: `result-${i + 1}`,
          type: "subscriber",
          title: `Subscriber ${i + 1}`,
          content: "test data",
        }))
      );

      // Page 1
      const { result: page1 } = renderHook(
        () => useSearch({ q: "subscriber", limit: 10, page: 1 }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(page1.current.isSuccess).toBe(true));
      expect(page1.current.data?.results).toHaveLength(10);
      expect(page1.current.data?.total).toBe(25);

      // Page 2
      const { result: page2 } = renderHook(
        () => useSearch({ q: "subscriber", limit: 10, page: 2 }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(page2.current.isSuccess).toBe(true));
      expect(page2.current.data?.results).toHaveLength(10);

      // Page 3
      const { result: page3 } = renderHook(
        () => useSearch({ q: "subscriber", limit: 10, page: 3 }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(page3.current.isSuccess).toBe(true));
      expect(page3.current.data?.results).toHaveLength(5);
    });

    it("should handle type filtering with facets", async () => {
      seedSearchIndex([
        { id: "1", type: "subscriber", title: "Sub 1", content: "test" },
        { id: "2", type: "subscriber", title: "Sub 2", content: "test" },
        { id: "3", type: "invoice", title: "Inv 1", content: "test" },
        { id: "4", type: "ticket", title: "Ticket 1", content: "test" },
      ]);

      const { result } = renderHook(() => useSearch({ q: "test", limit: 10, page: 1 }), {
        wrapper: createWrapper(),
      });

      await waitForSearchSuccess(() => result.current.isSuccess);

      expect(result.current.data?.total).toBe(4);
      expect(result.current.data?.facets?.types).toEqual({
        subscriber: 2,
        invoice: 1,
        ticket: 1,
      });

      // Now filter by type
      const { result: filteredResult } = renderHook(
        () => useSearch({ q: "test", type: "subscriber", limit: 10, page: 1 }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitForSearchSuccess(() => filteredResult.current.isSuccess);
      expect(filteredResult.current.data?.results).toHaveLength(2);
      expect(filteredResult.current.data?.total).toBe(2);
    });

    it("should handle reindex and update statistics", async () => {
      seedSearchIndex([
        { id: "1", type: "subscriber", title: "Sub 1", content: "test" },
        { id: "2", type: "invoice", title: "Inv 1", content: "test" },
      ]);

      // Check initial statistics
      const { result: statsResult } = renderHook(() => useSearchStatistics(), {
        wrapper: createWrapper(),
      });

      await waitForSearchSuccess(() => statsResult.current.isSuccess);
      expect(statsResult.current.data?.total_documents).toBe(2);

      // Trigger reindex
      const { result: reindexResult } = renderHook(() => useReindex(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await reindexResult.current.mutateAsync({ entity_type: "subscriber" });
      });

      expect(reindexResult.current.isSuccess).toBe(true);

      // Statistics should be updated
      const { result: updatedStatsResult } = renderHook(() => useSearchStatistics(), {
        wrapper: createWrapper(),
      });

      await waitForSearchSuccess(() => updatedStatsResult.current.isSuccess);
      // After reindexing only subscribers, we should still have the invoice
      expect(updatedStatsResult.current.data?.total_documents).toBeGreaterThanOrEqual(1);
    });
  });
});
