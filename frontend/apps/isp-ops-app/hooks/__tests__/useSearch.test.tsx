/**
 * Jest Tests for useSearch hooks
 * Tests global search functionality with Jest mocks
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
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
import { searchService } from "@/lib/services/search-service";

// Mock the search service
jest.mock("@/lib/services/search-service", () => ({
  searchService: {
    search: jest.fn(),
    quickSearch: jest.fn(),
    searchByType: jest.fn(),
    indexContent: jest.fn(),
    removeFromIndex: jest.fn(),
    reindex: jest.fn(),
    getStatistics: jest.fn(),
  },
}));

// Mock useToast
jest.mock("@dotmac/ui", () => ({
  ...jest.requireActual("@dotmac/ui"),
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

const mockService = searchService as jest.Mocked<typeof searchService>;

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

describe("useSearch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      const mockResults = {
        results: [
          {
            id: "1",
            type: "subscriber",
            title: "Test User",
            content: "test@example.com",
            score: 1.0,
          },
        ],
        total: 1,
        facets: { types: { subscriber: 1 } },
      };

      mockService.search.mockResolvedValue(mockResults);

      const { result } = renderHook(() => useSearch({ q: "test", limit: 10, page: 1 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

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

    it("should filter by type", async () => {
      const mockResults = {
        results: [
          {
            id: "1",
            type: "subscriber",
            title: "Test User",
            content: "user data",
            score: 1.0,
          },
        ],
        total: 1,
        facets: { types: { subscriber: 1 } },
      };

      mockService.search.mockResolvedValue(mockResults);

      const { result } = renderHook(
        () => useSearch({ q: "test", type: "subscriber", limit: 10, page: 1 }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.results).toHaveLength(1);
      expect(result.current.data?.results[0].type).toBe("subscriber");
    });
  });

  describe("useIndexContent", () => {
    it("should index content successfully", async () => {
      const mockResponse = {
        indexed: true,
        id: "content-123",
      };

      mockService.indexContent.mockResolvedValue(mockResponse);

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
  });

  describe("useRemoveFromIndex", () => {
    it("should remove content from index successfully", async () => {
      const mockResponse = {
        removed: true,
        id: "content-123",
      };

      mockService.removeFromIndex.mockResolvedValue(mockResponse);

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
  });

  describe("useSearchStatistics", () => {
    it("should fetch search statistics", async () => {
      const mockStats = {
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
      };

      mockService.getStatistics.mockResolvedValue(mockStats);

      const { result } = renderHook(() => useSearchStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.totalDocuments).toBe(1000);
      expect(result.current.data?.entitiesByType.subscriber).toBe(500);
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle search, index, then search again workflow", async () => {
      // Initial search - empty
      mockService.search.mockResolvedValueOnce({
        results: [],
        total: 0,
        facets: {},
      });

      const { result: searchResult } = renderHook(
        () => useSearch({ q: "john", limit: 10, page: 1 }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(searchResult.current.isSuccess).toBe(true));
      expect(searchResult.current.data?.results).toHaveLength(0);

      // Index new content
      mockService.indexContent.mockResolvedValue({
        indexed: true,
        id: "subscriber-123",
      });

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

      await waitFor(() => expect(indexResult.current.isSuccess).toBe(true));

      // Search again - should find the indexed content
      mockService.search.mockResolvedValueOnce({
        results: [
          {
            id: "subscriber-123",
            type: "subscriber",
            title: "John Doe",
            content: "john.doe@example.com",
            score: 1.0,
          },
        ],
        total: 1,
        facets: { types: { subscriber: 1 } },
      });

      const { result: searchAgainResult } = renderHook(
        () => useSearch({ q: "john", limit: 10, page: 1 }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(searchAgainResult.current.isSuccess).toBe(true));
      expect(searchAgainResult.current.data?.results).toHaveLength(1);
      expect(searchAgainResult.current.data?.results[0].title).toBe("John Doe");
    });
  });
});
