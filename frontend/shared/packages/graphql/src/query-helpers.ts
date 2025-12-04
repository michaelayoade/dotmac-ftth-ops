/**
 * Query Result Helpers
 *
 * Utilities to normalize TanStack Query results to Apollo-compatible shapes,
 * making page-level integrations trivial.
 */

import type { UseQueryResult } from "@tanstack/react-query";

/**
 * Apollo-compatible query result shape
 * Matches the interface that existing components expect
 */
export interface NormalizedQueryResult<TData = unknown> {
  data: TData | undefined;
  loading: boolean;
  error: string | undefined;
  refetch: () => void;
  /**
   * Indicates a background refetch is in flight while cached data is shown.
   */
  isRefetching: boolean;
}

/**
 * Maps TanStack Query result to Apollo-compatible shape
 *
 * @example
 * ```tsx
 * const result = useNetworkOverviewQuery(...);
 * const { data, loading, error } = mapQueryResult(result);
 * ```
 */
export function mapQueryResult<TData = unknown>(
  queryResult: UseQueryResult<TData, unknown>,
): NormalizedQueryResult<TData> {
  const { data, isLoading, isFetching, error, refetch } = queryResult;
  const hasData = data !== undefined && data !== null;

  return {
    data,
    // Only treat as loading while no data is available yet
    loading: !hasData && (isLoading || isFetching),
    isRefetching: hasData && isFetching,
    // Normalize error to string (Apollo returned error.message)
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
    refetch: () => {
      refetch();
    },
  };
}

/**
 * Maps TanStack Query result with custom data transformation
 *
 * @example
 * ```tsx
 * const result = useCustomerListQuery(...);
 * const { data, loading, error } = mapQueryResultWithTransform(
 *   result,
 *   (data) => data?.customers?.customers ?? []
 * );
 * ```
 */
export function mapQueryResultWithTransform<TData, TTransformed>(
  queryResult: UseQueryResult<TData, unknown>,
  transform: (data: TData | undefined) => TTransformed,
): NormalizedQueryResult<TTransformed> {
  const { data, isLoading, isFetching, error, refetch } = queryResult;
  const hasData = data !== undefined && data !== null;

  return {
    data: transform(data),
    loading: !hasData && (isLoading || isFetching),
    isRefetching: hasData && isFetching,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
    refetch: () => {
      refetch();
    },
  };
}

/**
 * Loading state helpers
 */
export const loadingHelpers = {
  /**
   * Check if query is in initial loading state (no data yet)
   */
  isInitialLoading: (result: UseQueryResult<unknown, unknown>) => result.isLoading,

  /**
   * Check if query is refetching (has data, fetching in background)
   */
  isRefetching: (result: UseQueryResult<unknown, unknown>) =>
    !result.isLoading && result.isFetching,

  /**
   * Check if any loading state is active
   */
  isAnyLoading: (result: UseQueryResult<unknown, unknown>) => result.isLoading || result.isFetching,
};

/**
 * Type guard to check if query has data
 */
export function hasQueryData<TData>(
  result: NormalizedQueryResult<TData>,
): result is NormalizedQueryResult<TData> & { data: TData } {
  return result.data !== undefined && !result.loading && !result.error;
}
