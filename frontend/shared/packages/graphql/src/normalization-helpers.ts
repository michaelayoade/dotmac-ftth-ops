/**
 * Normalization Helpers for Custom GraphQL Hooks
 *
 * These helpers make it easy to normalize flattened dashboard hooks
 * into NormalizedQueryResult format for use with QueryBoundary.
 *
 * Use these when your custom hook returns a flattened structure like:
 * { customers, metrics, isLoading, error }
 *
 * Instead of a standard TanStack Query result like:
 * { data, isLoading, error }
 */

import type { NormalizedQueryResult } from "./query-helpers";
import { hasQueryData as hasQueryDataFromHelpers } from "./query-helpers";

/**
 * Common shape of custom dashboard hooks
 */
export interface DashboardHookResult {
  isLoading: boolean;
  error?: string | undefined;
  refetch: () => void;
  isFetching?: boolean;
  [key: string]: any; // Additional data fields
}

/**
 * Normalize a dashboard hook result that returns flattened data
 *
 * @example
 * ```tsx
 * const dashboardQuery = useCustomerDashboardGraphQL(options);
 *
 * type CustomerDashboardData = {
 *   customers: typeof dashboardQuery.customers;
 *   metrics: typeof dashboardQuery.metrics;
 * };
 *
 * const result = normalizeDashboardHook(
 *   dashboardQuery,
 *   (query) => ({
 *     customers: query.customers,
 *     metrics: query.metrics,
 *   })
 * );
 *
 * <QueryBoundary result={result}>
 *   {(data) => <Dashboard data={data} />}
 * </QueryBoundary>
 * ```
 */
export function normalizeDashboardHook<TQuery extends DashboardHookResult, TData>(
  query: TQuery,
  extractData: (query: TQuery) => TData,
): NormalizedQueryResult<TData> {
  const data = query.isLoading || query.error ? undefined : extractData(query);

  return {
    data,
    loading: query.isLoading && !data,
    error: query.error,
    refetch: query.refetch,
    isRefetching: Boolean(query.isFetching),
  };
}

/**
 * Normalize a list query result
 *
 * @example
 * ```tsx
 * const customerQuery = useCustomerListGraphQL(options);
 * const result = normalizeListQuery(customerQuery, (q) => q.customers);
 *
 * <QueryBoundary result={result}>
 *   {(customers) => <CustomerList customers={customers} />}
 * </QueryBoundary>
 * ```
 */
export function normalizeListQuery<TQuery extends DashboardHookResult, TItem>(
  query: TQuery,
  extractItems: (query: TQuery) => TItem[],
): NormalizedQueryResult<TItem[]> {
  return normalizeDashboardHook(query, extractItems);
}

/**
 * Normalize a detail query result
 *
 * @example
 * ```tsx
 * const customerQuery = useCustomerDetailGraphQL({ customerId });
 * const result = normalizeDetailQuery(customerQuery, (q) => q.customer);
 *
 * <QueryBoundary result={result}>
 *   {(customer) => <CustomerDetail customer={customer} />}
 * </QueryBoundary>
 * ```
 */
export function normalizeDetailQuery<TQuery extends DashboardHookResult, TDetail>(
  query: TQuery,
  extractDetail: (query: TQuery) => TDetail | null,
): NormalizedQueryResult<TDetail> {
  const detail = query.isLoading || query.error ? undefined : extractDetail(query);

  return {
    data: detail as TDetail | undefined,
    loading: query.isLoading && !detail,
    error: query.error,
    refetch: query.refetch,
    isRefetching: Boolean(query.isFetching),
  };
}

/**
 * Type-safe data extractor for common dashboard patterns
 *
 * @example
 * ```tsx
 * const result = normalizeDashboardHook(
 *   useNetworkDashboardGraphQL(options),
 *   extractDashboardData({
 *     overview: (q) => q.overview,
 *     devices: (q) => q.devices,
 *     alerts: (q) => q.alerts,
 *   })
 * );
 * ```
 */
export function extractDashboardData<
  TQuery,
  TExtractors extends Record<string, (q: TQuery) => any>,
>(
  extractors: TExtractors,
): (query: TQuery) => { [K in keyof TExtractors]: ReturnType<TExtractors[K]> } {
  return (query: TQuery) => {
    const result = {} as any;
    for (const key in extractors) {
      const extractor = extractors[key];
      if (extractor) {
        result[key] = extractor(query);
      }
    }
    return result;
  };
}

/**
 * Helper to check if a query has data (not loading, not error, has data)
 * Re-exported from query-helpers to avoid duplication
 */
export const hasQueryData = hasQueryDataFromHelpers;

/**
 * Helper to combine multiple query results
 * Useful when you need data from multiple queries in one QueryBoundary
 *
 * @example
 * ```tsx
 * const customersQuery = useCustomerListGraphQL();
 * const metricsQuery = useCustomerMetricsGraphQL();
 *
 * const result = combineQueryResults(
 *   normalizeDashboardHook(customersQuery, (q) => q.customers),
 *   normalizeDashboardHook(metricsQuery, (q) => q.metrics)
 * );
 *
 * <QueryBoundary result={result}>
 *   {([customers, metrics]) => (
 *     <>
 *       <Metrics metrics={metrics} />
 *       <CustomerList customers={customers} />
 *     </>
 *   )}
 * </QueryBoundary>
 * ```
 */
export function combineQueryResults<T1, T2>(
  result1: NormalizedQueryResult<T1>,
  result2: NormalizedQueryResult<T2>,
): NormalizedQueryResult<[T1, T2]> {
  const hasData = result1.data !== undefined && result2.data !== undefined;
  const isLoading = result1.loading || result2.loading;
  const error = result1.error || result2.error;

  return {
    data: hasData ? [result1.data!, result2.data!] : undefined,
    loading: isLoading && !hasData,
    error,
    refetch: () => {
      result1.refetch();
      result2.refetch();
    },
    isRefetching: result1.isRefetching || result2.isRefetching,
  };
}
