# GraphQL Migration Helpers

This guide documents the migration utilities in `@dotmac/graphql` that make migrating from Apollo to TanStack Query trivial.

## Table of Contents

1. [Query Result Normalization](#query-result-normalization)
2. [Error Handling](#error-handling)
3. [Query Boundaries](#query-boundaries)
4. [Migration Examples](#migration-examples)
5. [Best Practices](#best-practices)

---

## Query Result Normalization

### `mapQueryResult`

Converts TanStack Query's `{ isLoading, isFetching, error }` to Apollo's `{ loading, error }` shape.

```tsx
import { useNetworkOverviewQuery } from '@dotmac/graphql/generated/react-query';
import { mapQueryResult } from '@dotmac/graphql';

function NetworkDashboard() {
  const queryResult = useNetworkOverviewQuery(undefined, { enabled: true });

  // Map to Apollo-compatible shape
  const { data, loading, error } = mapQueryResult(queryResult);

  // Existing component code works unchanged
  if (loading) return <Spinner />;
  if (error) return <Error message={error} />;
  return <NetworkOverview data={data} />;
}
```

### `mapQueryResultWithTransform`

Same as above but with custom data transformation:

```tsx
const { data, loading, error } = mapQueryResultWithTransform(
  queryResult,
  (data) => data?.customers?.customers ?? []
);
```

### Loading State Helpers

```tsx
import { loadingHelpers } from '@dotmac/graphql';

const isInitialLoad = loadingHelpers.isInitialLoading(queryResult); // No data yet
const isRefreshing = loadingHelpers.isRefetching(queryResult);      // Has data, fetching in background
const isAnyLoading = loadingHelpers.isAnyLoading(queryResult);      // Either state
```

---

## Error Handling

### `handleGraphQLError`

Centralized error handling with logging and toast notifications. Use in query `onError` callbacks:

```tsx
import { handleGraphQLError } from '@dotmac/graphql';
import { useToast } from '@dotmac/ui/use-toast';
import { logger } from '@/lib/logger';

function useNetworkOverviewGraphQL() {
  const { toast } = useToast();

  const { data, isLoading, error } = useNetworkOverviewQuery(
    undefined,
    {
      enabled: true,
      refetchInterval: 30000,
      onError: (err) =>
        handleGraphQLError(err, {
          toast,
          logger,
          operationName: 'NetworkOverviewQuery',
          context: {
            hook: 'useNetworkOverviewGraphQL',
          },
        }),
    }
  );

  return { data, isLoading, error };
}
```

### Error Handler Options

```tsx
interface GraphQLErrorHandlerOptions {
  /** Toast dispatcher (required) */
  toast: (options: { title: string; description?: string; variant?: ToastVariant }) => void;

  /** Optional logger */
  logger?: {
    error: (message: string, error?: unknown, context?: Record<string, unknown>) => void;
  };

  /** GraphQL operation name for logging */
  operationName?: string;

  /** Additional context merged into log payload */
  context?: Record<string, unknown>;

  /** Fallback message if error lacks a message */
  fallbackMessage?: string;

  /** Skip toast while still logging */
  suppressToast?: boolean;
}
```

### Error Code Mapping

The handler automatically maps error codes to user-friendly toast messages:

| Error Code | Toast Title | Description |
|-----------|-------------|-------------|
| `UNAUTHENTICATED` | Authentication required | Session expired message |
| `FORBIDDEN` | Access denied | Permission denied message |
| `NOT_FOUND` | Not found | Resource not found |
| `BAD_USER_INPUT` / `VALIDATION_ERROR` | Validation error | Shows error message |
| `RATE_LIMITED` | Too many requests | Rate limit message |
| `INTERNAL_SERVER_ERROR` | Server error | Generic server error |

---

## Query Boundaries

Eliminates repetitive loading/error/empty ternaries across dashboard pages.

### Basic Usage

```tsx
import { QueryBoundary, mapQueryResult } from '@dotmac/graphql';

function NetworkDashboard() {
  const result = useNetworkOverviewQuery(...);

  return (
    <QueryBoundary result={mapQueryResult(result)}>
      {(data) => <NetworkOverviewTable data={data} />}
    </QueryBoundary>
  );
}
```

### With Custom Components

```tsx
<QueryBoundary
  result={mapQueryResult(result)}
  loadingComponent={<DashboardSkeleton />}
  errorComponent={(error, severity) => (
    <CustomError message={error} variant={severity} />
  )}
  emptyComponent={<NoCustomersFound />}
  isEmpty={(data) => data.customers.length === 0}
>
  {(data) => <CustomerList customers={data.customers} />}
</QueryBoundary>
```

### List Query Boundary

Simplified for array data:

```tsx
import { ListQueryBoundary } from '@dotmac/graphql';

<ListQueryBoundary
  result={mapQueryResult(result)}
  data={data?.customers ?? []}
>
  {(customers) => <CustomerList customers={customers} />}
</ListQueryBoundary>
```

---

## Migration Examples

### Before: Apollo with manual ternaries

```tsx
function CustomerDashboard() {
  const { data, loading, error } = useCustomerListQuery({
    variables: { limit: 50 },
    skip: false,
    pollInterval: 30000,
    fetchPolicy: "cache-and-network",
    onError: (err) => {
      console.error('Customer list error:', err);
      toast.error(err.message);
    },
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="error">{error.message}</div>;
  if (!data?.customers?.customers?.length) return <div>No customers</div>;

  return <CustomerList customers={data.customers.customers} />;
}
```

### After: TanStack Query with error handler in hook

```tsx
function useCustomerListGraphQL() {
  const { toast } = useToast();

  const { data, isLoading, error, refetch } = useCustomerListQuery(
    { limit: 50 },
    {
      enabled: true,
      refetchInterval: 30000,
      onError: (err) =>
        handleGraphQLError(err, {
          toast,
          logger,
          operationName: 'CustomerListQuery',
          context: { hook: 'useCustomerListGraphQL' },
        }),
    }
  );

  return {
    customers: data?.customers?.customers ?? [],
    loading: isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
    refetch,
  };
}

function CustomerDashboard() {
  const { customers, loading, error } = useCustomerListGraphQL();

  if (loading) return <DashboardSkeleton />;
  if (error) return <ErrorDisplay message={error} />;
  if (!customers.length) return <NoCustomersFound />;

  return <CustomerList customers={customers} />;
}
```

### After: Fully optimized with QueryBoundary

```tsx
function useCustomerListGraphQL() {
  const { toast } = useToast();

  const queryResult = useCustomerListQuery(
    { limit: 50 },
    {
      enabled: true,
      refetchInterval: 30000,
      onError: (err) =>
        handleGraphQLError(err, {
          toast,
          logger,
          operationName: 'CustomerListQuery',
          context: { hook: 'useCustomerListGraphQL' },
        }),
    }
  );

  // Map to Apollo-compatible shape for existing components
  return mapQueryResultWithTransform(
    queryResult,
    (data) => data?.customers?.customers ?? []
  );
}

function CustomerDashboard() {
  const result = useCustomerListGraphQL();

  return (
    <ListQueryBoundary
      result={result}
      data={result.data ?? []}
      loadingComponent={<DashboardSkeleton />}
      emptyComponent={<NoCustomersFound />}
    >
      {(customers) => <CustomerList customers={customers} />}
    </ListQueryBoundary>
  );
}
```

---

## Best Practices

### 1. Use Query Boundaries for Consistent UX

```tsx
// ✅ Good: Consistent loading/error/empty states
<QueryBoundary result={mapQueryResult(result)}>
  {(data) => <Content data={data} />}
</QueryBoundary>

// ❌ Bad: Bespoke ternaries everywhere
{loading ? <Spinner /> : error ? <Error /> : !data ? <Empty /> : <Content />}
```

### 2. Use Shared Skeleton Components

The platform provides pre-built skeleton components in `@dotmac/primitives`:

```tsx
import {
  DashboardSkeleton,
  TableSkeleton,
  CardSkeleton,
} from '@dotmac/primitives';

// Use with QueryBoundary
<QueryBoundary
  result={mapQueryResult(result)}
  loadingComponent={<DashboardSkeleton variant="network" />}
>
  {(data) => <NetworkDashboard data={data} />}
</QueryBoundary>

// Table skeleton
<QueryBoundary
  result={mapQueryResult(result)}
  loadingComponent={<TableSkeleton columns={6} rows={10} showSearch />}
>
  {(data) => <CustomerTable customers={data} />}
</QueryBoundary>

// Card grid skeleton
<QueryBoundary
  result={mapQueryResult(result)}
  loadingComponent={
    <CardGridSkeleton count={4} columns={4} variant="metric" />
  }
>
  {(data) => <MetricsGrid metrics={data} />}
</QueryBoundary>
```

**Available Skeletons:**
- `DashboardSkeleton` - Dashboard pages with metrics and content sections
- `TableSkeleton` - Data tables with search, filters, and pagination
- `CardSkeleton` / `CardGridSkeleton` - Card layouts (metric, info, detailed)

**Preset Variants:**
```tsx
// Dashboard presets
<DashboardSkeletons.Network />
<DashboardSkeletons.Metrics />
<DashboardSkeletons.Compact />

// Table presets
<TableSkeletons.CustomerList />
<TableSkeletons.DeviceList />
<TableSkeletons.Compact />

// Card presets
<CardSkeletons.Metric />
<CardSkeletons.MetricGrid />
<CardSkeletons.InfoGrid />
```

### 3. Handle Errors in Hook onError

```tsx
// Add context to errors for better debugging
const { data, isLoading, error } = useSubscriberListQuery(
  { limit: 50 },
  {
    enabled: true,
    onError: (err) =>
      handleGraphQLError(err, {
        toast,
        logger,
        operationName: 'SubscriberListQuery',
        context: {
          hook: 'useSubscriberListGraphQL',
          userId: session?.user?.id,
          tenantId: tenant?.id,
          filters,
          searchTerm,
        },
      }),
  }
);
```

### 4. Skip Toast for Expected Errors

```tsx
// Use suppressToast for errors handled elsewhere (e.g., auth redirects)
onError: (err) =>
  handleGraphQLError(err, {
    toast,
    logger,
    operationName: 'LoginMutation',
    suppressToast: isAuthError(err), // Skip toast if auth handles it
  })
```

### 5. Create Reusable Query Hooks

```tsx
// Encapsulate error handling in custom hooks
function useSubscriberListGraphQL(options: { limit?: number } = {}) {
  const { toast } = useToast();
  const { limit = 50 } = options;

  const queryResult = useSubscriberListQuery(
    { limit },
    {
      enabled: true,
      refetchInterval: 30000,
      onError: (err) =>
        handleGraphQLError(err, {
          toast,
          logger,
          operationName: 'SubscriberListQuery',
          context: { hook: 'useSubscriberListGraphQL', limit },
        }),
    }
  );

  // Return Apollo-compatible shape
  return mapQueryResultWithTransform(
    queryResult,
    (data) => data?.subscribers ?? []
  );
}

// Use in components
function SubscriberDashboard() {
  const result = useSubscriberListGraphQL({ limit: 100 });

  return (
    <ListQueryBoundary result={result} data={result.data ?? []}>
      {(subscribers) => <SubscriberList subscribers={subscribers} />}
    </ListQueryBoundary>
  );
}
```

---

## Migration Checklist

- [ ] Replace `loading` with `isLoading` in hook destructure
- [ ] Replace `skip` with `enabled` in options
- [ ] Replace `pollInterval` with `refetchInterval`
- [ ] Replace `fetchPolicy` with TanStack equivalents (`staleTime`, `cacheTime`)
- [ ] Add `onError` callback with `handleGraphQLError` in hook
- [ ] Pass `toast` and `logger` to error handler
- [ ] Add operation name and context for debugging
- [ ] Wrap result with `mapQueryResult` for Apollo compatibility (optional)
- [ ] Replace manual ternaries with `QueryBoundary` (optional)
- [ ] Use shared skeleton components
- [ ] Test loading, error, and empty states

---

## Next Steps

1. **Skeleton Components**: Create shared `<DashboardSkeleton />`, `<TableSkeleton />`, `<CardSkeleton />` in `@dotmac/ui`
2. **Toast Integration**: Wire up `ErrorSeverity` to your toast library's variants
3. **Mutation Helpers**: Create `useMutationWithToast` for optimistic updates and cache invalidation
4. **Subscription Migration**: When ready, implement graphql-ws bridge using these same patterns

## Related Docs

- [GRAPHQL_MIGRATION_PLAN.md](./GRAPHQL_MIGRATION_PLAN.md) - Overall migration strategy
- [packages/graphql/README.md](../shared/packages/graphql/README.md) - Package documentation
