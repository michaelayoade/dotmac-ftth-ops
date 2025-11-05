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

Centralized error handling with logging and severity mapping:

```tsx
import { handleGraphQLError, ErrorSeverity } from '@dotmac/graphql';
import { toast } from 'react-hot-toast';

const { data, error } = useCustomerListQuery(...);

useEffect(() => {
  if (error) {
    const result = handleGraphQLError(error, {
      operation: 'CustomerList',
      componentName: 'CustomerDashboard',
    });

    // Auto-logged to console with context
    // result.severity = 'error' | 'warning' | 'info' | 'critical'

    if (result.shouldToast) {
      toast[result.severity](result.message);
    }
  }
}, [error]);
```

### Error Severity Mapping

Errors are automatically categorized based on `extensions.code`:

| Code Pattern | Severity | Example Codes |
|-------------|----------|---------------|
| `INTERNAL_SERVER_ERROR`, `DATABASE_ERROR` | `critical` | System failures |
| `VALIDATION_ERROR`, `BAD_USER_INPUT`, `NOT_FOUND` | `warning` | Recoverable client errors |
| `UNAUTHENTICATED`, `FORBIDDEN`, `UNAUTHORIZED` | `info` | Auth/permission errors |
| Default | `error` | Generic errors |

### User-Friendly Messages

```tsx
import { handleGraphQLErrorWithFriendlyMessage } from '@dotmac/graphql';

const result = handleGraphQLErrorWithFriendlyMessage(error, { operation: 'Login' });
// result.message = "Please log in to continue" (instead of technical message)
```

### Built-in Messages

```tsx
import { ERROR_MESSAGES } from '@dotmac/graphql';

ERROR_MESSAGES.UNAUTHENTICATED      // "Please log in to continue"
ERROR_MESSAGES.FORBIDDEN            // "You do not have permission..."
ERROR_MESSAGES.NOT_FOUND            // "The requested resource was not found"
ERROR_MESSAGES.VALIDATION_ERROR     // "Please check your input..."
ERROR_MESSAGES.INTERNAL_SERVER_ERROR // "A server error occurred..."
```

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

### After: TanStack Query with helpers

```tsx
function CustomerDashboard() {
  const queryResult = useCustomerListQuery(
    { limit: 50 },
    { enabled: true, refetchInterval: 30000 }
  );

  const { data, loading, error } = mapQueryResultWithTransform(
    queryResult,
    (data) => data?.customers?.customers ?? []
  );

  // Error handling
  useEffect(() => {
    if (error) {
      const result = handleGraphQLError(error, {
        operation: 'CustomerList',
        componentName: 'CustomerDashboard',
      });
      if (result.shouldToast) toast[result.severity](result.message);
    }
  }, [error]);

  return (
    <QueryBoundary
      result={{ data, loading, error }}
      isEmpty={(customers) => customers.length === 0}
    >
      {(customers) => <CustomerList customers={customers} />}
    </QueryBoundary>
  );
}
```

### After: Fully optimized

```tsx
function CustomerDashboard() {
  const queryResult = useCustomerListQuery(
    { limit: 50 },
    { enabled: true, refetchInterval: 30000 }
  );

  const { data, loading, error } = mapQueryResultWithTransform(
    queryResult,
    (data) => data?.customers?.customers ?? []
  );

  const errorState = useErrorHandler(error, {
    operation: 'CustomerList',
    componentName: 'CustomerDashboard',
  });

  useEffect(() => {
    if (errorState?.shouldToast) {
      toast[errorState.severity](errorState.message);
    }
  }, [errorState]);

  return (
    <ListQueryBoundary
      result={{ data, loading, error }}
      data={data ?? []}
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

### 2. Centralize Skeleton Components

Create shared skeleton components per domain:

```tsx
// shared/packages/ui/src/skeletons/DashboardSkeleton.tsx
export function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/4" />
      <div className="grid grid-cols-3 gap-4">
        <div className="h-32 bg-gray-200 rounded" />
        <div className="h-32 bg-gray-200 rounded" />
        <div className="h-32 bg-gray-200 rounded" />
      </div>
    </div>
  );
}
```

Then use across pages:

```tsx
<QueryBoundary
  result={mapQueryResult(result)}
  loadingComponent={<DashboardSkeleton />}
>
  {(data) => <Dashboard data={data} />}
</QueryBoundary>
```

### 3. Handle Errors Contextually

```tsx
// Add context to errors for better debugging
const errorState = useErrorHandler(error, {
  operation: 'SubscriberList',
  componentName: 'SubscriberDashboard',
  userId: session?.user?.id,
  tenantId: tenant?.id,
  additionalData: { filters, searchTerm },
});
```

### 4. Skip Toast for Expected Errors

```tsx
// Auth errors are handled by auth flow, don't toast
if (errorState && errorState.code !== 'UNAUTHENTICATED') {
  toast[errorState.severity](errorState.message);
}
```

### 5. Combine Helpers for Maximum DRY

```tsx
// Create a reusable hook
function useQueryWithErrorHandling<TData>(
  queryResult: UseQueryResult<TData>,
  operation: string
) {
  const normalized = mapQueryResult(queryResult);
  const errorState = useErrorHandler(normalized.error, { operation });

  useEffect(() => {
    if (errorState?.shouldToast) {
      toast[errorState.severity](errorState.message);
    }
  }, [errorState]);

  return normalized;
}

// Use everywhere
function MyComponent() {
  const result = useQueryWithErrorHandling(
    useCustomerListQuery(...),
    'CustomerList'
  );

  return <QueryBoundary result={result}>...</QueryBoundary>;
}
```

---

## Migration Checklist

- [ ] Replace `loading` with `isLoading` in hook destructure
- [ ] Replace `skip` with `enabled` in options
- [ ] Replace `pollInterval` with `refetchInterval`
- [ ] Replace `fetchPolicy` with TanStack equivalents (`staleTime`, `cacheTime`)
- [ ] Remove `onError` callbacks, use `useErrorHandler` instead
- [ ] Wrap result with `mapQueryResult` for Apollo compatibility
- [ ] Replace manual ternaries with `QueryBoundary`
- [ ] Use shared skeleton components
- [ ] Add error context for debugging
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
