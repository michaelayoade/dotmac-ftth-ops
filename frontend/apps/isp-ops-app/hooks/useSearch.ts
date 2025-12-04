/**
 * Global Search Hooks
 *
 * React Query hooks for global search functionality across all tenant entities.
 * Uses the searchService for all API calls.
 *
 * Pattern:
 * - Query hooks for data fetching with caching
 * - Mutation hooks with cache invalidation and toast notifications
 * - Proper type safety with React Query v5 generics
 * - Debounced search for real-time search as user types
 */

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@dotmac/ui";
import { searchService } from "@/lib/services/search-service";
import type {
  SearchResponse,
  SearchParams,
  IndexContentRequest,
  IndexContentResponse,
  RemoveFromIndexResponse,
} from "@/types/search";
import type { SearchStatistics, ReindexRequest } from "@/lib/services/search-service";

// ==================== Query Keys ====================

export const searchKeys = {
  all: ["search"] as const,
  searches: (params: SearchParams) => ["search", params] as const,
  statistics: () => ["search", "statistics"] as const,
};

// ==================== Search Operations ====================

/**
 * Search across tenant entities
 * GET /api/v1/search
 */
export function useSearch(params: SearchParams, enabled = true) {
  return useQuery<SearchResponse, Error, SearchResponse, any>({
    queryKey: searchKeys.searches(params),
    queryFn: () => searchService.search(params),
    enabled: enabled && !!params.q && params.q.trim().length > 0,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Quick search with simpler interface
 */
export function useQuickSearch(query: string, type?: string, limit: number = 10, enabled = true) {
  return useQuery<SearchResponse, Error, SearchResponse, any>({
    queryKey: searchKeys.searches({ q: query, type, limit, page: 1 }),
    queryFn: () => searchService.quickSearch(query, type, limit),
    enabled: enabled && !!query && query.trim().length > 0,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Search by entity type
 */
export function useSearchByType(
  query: string,
  entityType: string,
  limit: number = 20,
  enabled = true,
) {
  return useQuery<SearchResponse, Error, SearchResponse, any>({
    queryKey: searchKeys.searches({
      q: query,
      type: entityType,
      limit,
      page: 1,
    }),
    queryFn: () => searchService.searchByType(query, entityType, limit),
    enabled: enabled && !!query && query.trim().length > 0,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Debounced search hook for real-time search as user types
 */
export function useDebouncedSearch(query: string, type?: string, debounceMs = 300) {
  const [debouncedQuery, setDebouncedQuery] = React.useState(query);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  return useSearch(
    {
      q: debouncedQuery,
      type,
      limit: 10,
      page: 1,
    },
    !!debouncedQuery && debouncedQuery.trim().length > 0,
  );
}

// ==================== Index Management ====================

/**
 * Index content for search
 * POST /api/v1/search/index
 */
export function useIndexContent(options?: {
  onSuccess?: (data: IndexContentResponse) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<IndexContentResponse, Error, IndexContentRequest>({
    mutationFn: (content) => searchService.indexContent(content),
    onSuccess: (data) => {
      // Invalidate all search queries to reflect new content
      queryClient.invalidateQueries({ queryKey: searchKeys.all });
      // toast.success('Content indexed successfully');
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to index content', {
      //   description: error.message,
      // });
      options?.onError?.(error);
    },
  });
}

/**
 * Remove content from search index
 * DELETE /api/v1/search/index/{contentId}
 */
export function useRemoveFromIndex(options?: {
  onSuccess?: (data: RemoveFromIndexResponse) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<RemoveFromIndexResponse, Error, string>({
    mutationFn: (contentId) => searchService.removeFromIndex(contentId),
    onSuccess: (data) => {
      // Invalidate all search queries to reflect removed content
      queryClient.invalidateQueries({ queryKey: searchKeys.all });
      // toast.success('Content removed from index');
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to remove content', {
      //   description: error.message,
      // });
      options?.onError?.(error);
    },
  });
}

/**
 * Reindex entity
 * POST /api/v1/search/reindex
 */
export function useReindex(options?: { onSuccess?: () => void; onError?: (error: Error) => void }) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ReindexRequest>({
    mutationFn: (request) => searchService.reindex(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: searchKeys.all });
      queryClient.invalidateQueries({ queryKey: searchKeys.statistics() });
      // toast.success('Reindex started successfully', {
      //   description: 'Search index is being rebuilt',
      // });
      options?.onSuccess?.();
    },
    onError: (error) => {
      // toast.error('Failed to start reindex', {
      //   description: error.message,
      // });
      options?.onError?.(error);
    },
  });
}

// ==================== Statistics ====================

/**
 * Get search statistics
 * GET /api/v1/search/stats
 */
export function useSearchStatistics(enabled = true) {
  return useQuery<SearchStatistics, Error, SearchStatistics, any>({
    queryKey: searchKeys.statistics(),
    queryFn: () => searchService.getStatistics(),
    enabled,
    staleTime: 300000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ==================== Composite Hooks ====================

/**
 * Search with auto-suggestion
 * Combines search with debounced suggestions
 */
export function useSearchWithSuggestions(query: string, type?: string) {
  const debouncedSearch = useDebouncedSearch(query, type, 300);

  return {
    results: debouncedSearch.data?.results || [],
    total: debouncedSearch.data?.total || 0,
    facets: debouncedSearch.data?.facets,
    isLoading: debouncedSearch.isLoading,
    error: debouncedSearch.error,
    refetch: debouncedSearch.refetch,
  };
}

/**
 * Search with statistics
 * Combines search results with overall statistics
 */
export function useSearchWithStats(params: SearchParams) {
  const search = useSearch(params);
  const stats = useSearchStatistics();

  return {
    results: search.data?.results || [],
    total: search.data?.total || 0,
    facets: search.data?.facets,
    statistics: stats.data,
    isLoading: search.isLoading || stats.isLoading,
    error: search.error || stats.error,
    refetch: () => {
      search.refetch();
      stats.refetch();
    },
  };
}
