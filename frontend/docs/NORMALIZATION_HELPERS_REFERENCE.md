# Normalization Helpers Reference

Quick reference for normalizing custom GraphQL hooks for use with QueryBoundary.

## When to Use

Use these helpers when your custom hook returns a **flattened structure** like:
```tsx
{ customers, metrics, isLoading, error, refetch, isFetching }
```

Instead of a standard TanStack Query result like:
```tsx
{ data, isLoading, error, refetch }
```

---

## Core Helpers

### `normalizeDashboardHook`

**Use for:** Dashboard pages with multiple data sections (metrics + list)

```tsx
import { normalizeDashboardHook, QueryBoundary } from '@dotmac/graphql';

const dashboardQuery = useCustomerDashboardGraphQL(options);

const result = normalizeDashboardHook(dashboardQuery, (query) => ({
  customers: query.customers,
  metrics: query.metrics,
}));

<QueryBoundary result={result}>
  {(data) => (
    <>
      <Metrics metrics={data.metrics} />
      <CustomerList customers={data.customers} />
    </>
  )}
</QueryBoundary>
```

### `normalizeListQuery`

**Use for:** Simple list pages

```tsx
import { normalizeListQuery, QueryBoundary } from '@dotmac/graphql';

const listQuery = useCustomerListGraphQL(options);

const result = normalizeListQuery(listQuery, (query) => query.customers);

<QueryBoundary
  result={result}
  isEmpty={(customers) => customers.length === 0}
>
  {(customers) => <CustomerList customers={customers} />}
</QueryBoundary>
```

### `normalizeDetailQuery`

**Use for:** Detail/view pages

```tsx
import { normalizeDetailQuery, QueryBoundary } from '@dotmac/graphql';

const detailQuery = useCustomerDetailGraphQL({ customerId });

const result = normalizeDetailQuery(detailQuery, (query) => query.customer);

<QueryBoundary result={result}>
  {(customer) => <CustomerDetail customer={customer} />}
</QueryBoundary>
```

---

## Utility Helpers

### `hasQueryData`

**Use for:** Type-safe checking if query has loaded data

```tsx
import { hasQueryData } from '@dotmac/graphql';

const result = normalizeDashboardHook(...);

if (hasQueryData(result)) {
  // TypeScript now knows result.data is defined (not undefined)
  console.log(result.data.customers); // ✅ No type error
}
```

**Note:** Also available from `query-helpers` - internally re-exported to avoid duplication.

---

## Advanced Helpers

### `extractDashboardData`

**Use for:** Type-safe extraction of multiple fields

```tsx
import { normalizeDashboardHook, extractDashboardData } from '@dotmac/graphql';

const result = normalizeDashboardHook(
  useNetworkDashboardGraphQL(options),
  extractDashboardData({
    overview: (q) => q.overview,
    devices: (q) => q.devices,
    alerts: (q) => q.alerts,
  })
);

// data now has { overview, devices, alerts } with full type safety
```

### Utility Helpers Summary

| Helper             | Description                                      | Import Path                          |
|--------------------|--------------------------------------------------|--------------------------------------|
| `hasQueryData`     | Type guard that checks for data + no loading/error | `@dotmac/graphql` (re-exported)      |
| `normalizeDashboardHook` | Normalizes flattened dashboard hooks to `NormalizedQueryResult` | `@dotmac/graphql/normalization-helpers` |
| `normalizeListQuery` | Convenience wrapper for list pages              | `@dotmac/graphql/normalization-helpers` |
| `normalizeDetailQuery` | Convenience wrapper for detail/360° views      | `@dotmac/graphql/normalization-helpers` |
| `combineQueryResults` | Merges multiple normalized results              | `@dotmac/graphql/normalization-helpers` |

> **Note:** `hasQueryData` is defined once in `query-helpers.ts` and re-exported by the normalization helpers so both import styles reference the same implementation.

### `combineQueryResults`

**Use for:** Combining multiple separate queries

```tsx
import { normalizeListQuery, combineQueryResults } from '@dotmac/graphql';

const customersResult = normalizeListQuery(
  useCustomerListGraphQL(),
  (q) => q.customers
);

const metricsResult = normalizeDashboardHook(
  useCustomerMetricsGraphQL(),
  (q) => q.metrics
);

const combined = combineQueryResults(customersResult, metricsResult);

<QueryBoundary result={combined}>
  {([customers, metrics]) => (
    <>
      <Metrics metrics={metrics} />
      <CustomerList customers={customers} />
    </>
  )}
</QueryBoundary>
```

---

## What Gets Normalized

All helpers create a `NormalizedQueryResult<T>` with:

```typescript
interface NormalizedQueryResult<T> {
  data: T | undefined;
  loading: boolean;           // true only on initial load
  error: string | undefined;
  refetch: () => void;
  isRefetching: boolean;      // true during background refetches
}
```

**Key behavior:**
- `loading` is `true` only on initial load (no cached data)
- `isRefetching` is `true` during background refetches (has cached data)
- Cached data stays visible during refetches (no skeleton flash)

---

## Comparison: mapQueryResult vs normalizeDashboardHook

### `mapQueryResult`

**For:** Standard TanStack Query hooks

```tsx
// ✅ Use with standard TanStack Query hooks
const { data, isLoading, error } = useQuery({
  queryKey: ['customers'],
  queryFn: fetchCustomers,
});

const result = mapQueryResult({ data, isLoading, error, refetch });
```

### `normalizeDashboardHook`

**For:** Custom flattened hooks

```tsx
// ✅ Use with custom dashboard hooks
const { customers, metrics, isLoading, error } = useCustomerDashboardGraphQL();

const result = normalizeDashboardHook(
  { customers, metrics, isLoading, error, refetch, isFetching },
  (query) => ({
    customers: query.customers,
    metrics: query.metrics,
  })
);
```

---

## Common Patterns

### Pattern 1: Dashboard with Metrics + List

```tsx
const dashboardQuery = useDashboardGraphQL(options);

const result = normalizeDashboardHook(dashboardQuery, (q) => ({
  metrics: q.metrics,
  items: q.items,
}));

// Use result twice - once for metrics, once for list
<QueryBoundary result={result}>
  {(data) => <Metrics metrics={data.metrics} />}
</QueryBoundary>

<QueryBoundary
  result={result}
  isEmpty={(data) => data.items.length === 0}
>
  {(data) => <ItemList items={data.items} />}
</QueryBoundary>
```

### Pattern 2: Detail Page with Sections

```tsx
const detailQuery = use360ViewGraphQL({ id });

const result = normalizeDetailQuery(detailQuery, (q) => q.detail);

<QueryBoundary result={result}>
  {(detail) => (
    <>
      <DetailHeader data={detail} />
      <DetailTabs data={detail} />
      <DetailActivity data={detail} />
    </>
  )}
</QueryBoundary>
```

### Pattern 3: Refetch Button with Spinner

```tsx
const dashboardQuery = useDashboardGraphQL(options);
const result = normalizeDashboardHook(dashboardQuery, ...);

// Use isRefetching for button spinner
<Button
  onClick={() => result.refetch()}
  disabled={result.isRefetching}
>
  <RefreshCw
    className={result.isRefetching ? "animate-spin" : ""}
  />
  Refresh
</Button>

// QueryBoundary shows cached data during refetch
<QueryBoundary result={result}>
  {(data) => <Dashboard data={data} />}
</QueryBoundary>
```

---

## Migration Quick Start

1. **Identify your hook type:**
   - Standard TanStack Query → Use `mapQueryResult`
   - Custom flattened hook → Use `normalizeDashboardHook` / `normalizeListQuery` / `normalizeDetailQuery`

2. **Import the helper:**
   ```tsx
   import { normalizeDashboardHook, QueryBoundary } from '@dotmac/graphql';
   ```

3. **Normalize the result:**
   ```tsx
   const query = useCustomDashboardGraphQL(options);
   const result = normalizeDashboardHook(query, (q) => ({
     field1: q.field1,
     field2: q.field2,
   }));
   ```

4. **Use with QueryBoundary:**
   ```tsx
   <QueryBoundary result={result} loadingComponent={<Skeleton />}>
     {(data) => <Component data={data} />}
   </QueryBoundary>
   ```

---

## Type Safety

All helpers maintain full TypeScript type inference:

```tsx
const dashboardQuery = useCustomerDashboardGraphQL();
// dashboardQuery.customers has type Customer[]
// dashboardQuery.metrics has type CustomerMetrics

const result = normalizeDashboardHook(dashboardQuery, (query) => ({
  customers: query.customers, // ← TypeScript knows this is Customer[]
  metrics: query.metrics,     // ← TypeScript knows this is CustomerMetrics
}));

// result.data has type { customers: Customer[], metrics: CustomerMetrics } | undefined
```

---

## Troubleshooting

### Error: "Property 'isFetching' does not exist"

Your custom hook needs to expose `isFetching` from TanStack Query:

```tsx
// ✅ Add isFetching to custom hook
export function useCustomerDashboardGraphQL() {
  const { data, isLoading, error, refetch, isFetching } = useCustomerDashboardQuery();

  return {
    customers: data?.customers ?? [],
    metrics: data?.metrics ?? {},
    isLoading,
    error,
    refetch,
    isFetching, // ← Add this
  };
}
```

### Error: "Type '...' is not assignable to type 'NormalizedQueryResult'"

Make sure your extraction function returns the correct shape:

```tsx
// ❌ Wrong - returns query object
const result = normalizeDashboardHook(query, (q) => q);

// ✅ Correct - returns specific fields
const result = normalizeDashboardHook(query, (q) => ({
  customers: q.customers,
  metrics: q.metrics,
}));
```

---

## Related Documentation

- [MIGRATION_EXAMPLE_CUSTOMERS.md](./MIGRATION_EXAMPLE_CUSTOMERS.md) - Full migration example
- [GRAPHQL_MIGRATION_HELPERS.md](./GRAPHQL_MIGRATION_HELPERS.md) - Query helpers reference
- [SKELETON_COMPONENTS.md](./SKELETON_COMPONENTS.md) - Skeleton components guide
