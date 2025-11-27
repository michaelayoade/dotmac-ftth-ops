/**
 * Query Boundary Component
 *
 * Consolidated component for handling loading, empty, and error states.
 * Eliminates repetitive ternaries across dashboard pages.
 */

import type { ReactNode } from "react";

import type { NormalizedQueryResult } from "./query-helpers";

export interface QueryBoundaryProps<TData> {
  /** Query result from mapQueryResult */
  result: NormalizedQueryResult<TData>;

  /** Child render function - called when data is available */
  children: (data: TData) => ReactNode;

  /** Optional custom loading component */
  loadingComponent?: ReactNode;

  /** Optional custom error component */
  errorComponent?: (error: string) => ReactNode;

  /** Optional custom empty state component */
  emptyComponent?: ReactNode;

  /** Function to check if data is empty */
  isEmpty?: (data: TData) => boolean;

  /** Skip empty state check */
  skipEmptyCheck?: boolean;
}

/**
 * Default loading skeleton
 * Apps can override with their own design system components
 */
function DefaultLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/4" />
      <div className="h-32 bg-gray-200 rounded" />
      <div className="h-32 bg-gray-200 rounded" />
      <div className="h-32 bg-gray-200 rounded" />
    </div>
  );
}

/**
 * Default error display
 */
function DefaultErrorDisplay({ error }: { error: string }) {
  return (
    <div className="rounded-md bg-red-50 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">Error</h3>
          <div className="mt-2 text-sm text-red-700">{error}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Default empty state
 */
function DefaultEmptyState() {
  return (
    <div className="text-center py-12">
      <svg
        className="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
        />
      </svg>
      <h3 className="mt-2 text-sm font-medium text-gray-900">No data</h3>
      <p className="mt-1 text-sm text-gray-500">No results found for this query</p>
    </div>
  );
}

/**
 * Query Boundary Component
 *
 * Handles loading, error, and empty states declaratively
 *
 * @example
 * ```tsx
 * const result = useNetworkOverviewQuery(...);
 *
 * <QueryBoundary result={mapQueryResult(result)}>
 *   {(data) => <NetworkOverviewTable data={data} />}
 * </QueryBoundary>
 * ```
 *
 * @example With custom components
 * ```tsx
 * <QueryBoundary
 *   result={mapQueryResult(result)}
 *   loadingComponent={<DashboardSkeleton />}
 *   errorComponent={(error) => <CustomError message={error} />}
 *   emptyComponent={<CustomEmptyState />}
 *   isEmpty={(data) => data.length === 0}
 * >
 *   {(data) => <CustomerList customers={data} />}
 * </QueryBoundary>
 * ```
 */
export function QueryBoundary<TData>({
  result,
  children,
  loadingComponent,
  errorComponent,
  emptyComponent,
  isEmpty,
  skipEmptyCheck = false,
}: QueryBoundaryProps<TData>): React.ReactElement | null {
  // Loading state
  if (result.loading) {
    return <>{loadingComponent ?? <DefaultLoadingSkeleton />}</>;
  }

  // Error state
  if (result.error) {
    return (
      <>
        {errorComponent ? (
          errorComponent(result.error)
        ) : (
          <DefaultErrorDisplay error={result.error} />
        )}
      </>
    );
  }

  // No data
  if (result.data === undefined || result.data === null) {
    return <>{emptyComponent ?? <DefaultEmptyState />}</>;
  }

  // Empty state check
  if (!skipEmptyCheck && isEmpty && isEmpty(result.data)) {
    return <>{emptyComponent ?? <DefaultEmptyState />}</>;
  }

  // Render children with data
  return <>{children(result.data)}</>;
}

/**
 * Simplified query boundary for lists
 *
 * @example
 * ```tsx
 * <ListQueryBoundary
 *   result={mapQueryResult(result)}
 *   data={data?.customers ?? []}
 * >
 *   {(customers) => <CustomerList customers={customers} />}
 * </ListQueryBoundary>
 * ```
 */
export function ListQueryBoundary<TData, TItem>({
  result,
  data,
  children,
  loadingComponent,
  errorComponent,
  emptyComponent,
}: Omit<QueryBoundaryProps<TData>, "isEmpty" | "skipEmptyCheck"> & {
  data: TItem[];
}): React.ReactElement | null {
  return (
    <QueryBoundary
      result={result}
      loadingComponent={loadingComponent}
      {...(errorComponent ? { errorComponent } : {})}
      emptyComponent={emptyComponent}
      isEmpty={(d) => Array.isArray(data) && data.length === 0}
    >
      {children}
    </QueryBoundary>
  );
}
