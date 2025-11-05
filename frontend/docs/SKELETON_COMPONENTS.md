# Skeleton Components Guide

Skeleton components provide consistent loading states across the platform. They're designed to match the structure of actual data components for seamless loading experiences.

## Table of Contents

1. [Overview](#overview)
2. [Available Components](#available-components)
3. [Usage with QueryBoundary](#usage-with-queryboundary)
4. [Component Reference](#component-reference)
5. [Examples](#examples)
6. [Best Practices](#best-practices)

---

## Overview

Skeleton components are pre-built loading state components that:
- Match the visual structure of their corresponding data components
- Provide consistent UX across all dashboards and pages
- Integrate seamlessly with `QueryBoundary` from `@dotmac/graphql`
- Support multiple variants for different use cases
- Include preset configurations for common patterns

**Package:** `@dotmac/primitives`

**Also available from:** `@dotmac/ui` (for backward compatibility)

---

## Available Components

### DashboardSkeleton

Loading state for dashboard pages with metrics and content sections.

**Variants:**
- `default` - Standard dashboard layout
- `metrics` - Metrics-heavy dashboard with cards
- `network` - Network monitoring dashboard
- `compact` - Compact dashboard with fewer elements

### TableSkeleton

Loading state for data tables with search, filters, and pagination.

**Features:**
- Configurable columns and rows
- Optional search bar and filters
- Optional checkboxes and action columns
- Optional pagination

**Variants:**
- `default` - Standard table spacing
- `compact` - Tighter spacing for dense data
- `detailed` - More generous spacing

### CardSkeleton / CardGridSkeleton

Loading states for card layouts.

**Variants:**
- `default` - Basic content card
- `metric` - KPI/metric card
- `info` - Information card with header
- `detailed` - Rich content card with image
- `compact` - Compact list item card

---

## Usage with QueryBoundary

The primary use case is combining skeletons with `QueryBoundary` from `@dotmac/graphql`:

```tsx
import { QueryBoundary, mapQueryResult } from '@dotmac/graphql';
import { DashboardSkeleton } from '@dotmac/primitives';

function NetworkDashboard() {
  const queryResult = useNetworkOverviewQuery(undefined, {
    enabled: true,
    refetchInterval: 30000,
    onError: (err) => handleGraphQLError(err, { toast, logger, operationName: 'NetworkOverview' }),
  });

  const result = mapQueryResult(queryResult);

  return (
    <QueryBoundary
      result={result}
      loadingComponent={<DashboardSkeleton variant="network" />}
      isEmpty={(data) => !data?.networkOverview}
    >
      {(data) => <NetworkOverviewContent data={data.networkOverview} />}
    </QueryBoundary>
  );
}
```

---

## Component Reference

### DashboardSkeleton

```tsx
interface DashboardSkeletonProps {
  variant?: 'default' | 'metrics' | 'network' | 'compact';
  metricCards?: number; // Default: 4
  showHeader?: boolean; // Default: true
  contentSections?: number; // Default: 2
  className?: string;
}

// Usage
<DashboardSkeleton
  variant="network"
  metricCards={6}
  contentSections={3}
/>

// Presets
<DashboardSkeletons.Network />
<DashboardSkeletons.Metrics />
<DashboardSkeletons.Compact />
<DashboardSkeletons.Default />
```

### TableSkeleton

```tsx
interface TableSkeletonProps {
  columns?: number; // Default: 5
  rows?: number; // Default: 5
  showHeader?: boolean; // Default: true
  showActions?: boolean; // Default: true
  showCheckbox?: boolean; // Default: false
  showPagination?: boolean; // Default: true
  showSearch?: boolean; // Default: true
  showFilters?: boolean; // Default: false
  variant?: 'default' | 'compact' | 'detailed';
  className?: string;
}

// Usage
<TableSkeleton
  columns={6}
  rows={10}
  showCheckbox
  showSearch
  showFilters
/>

// Presets
<TableSkeletons.CustomerList />
<TableSkeletons.DeviceList />
<TableSkeletons.Compact />
<TableSkeletons.Detailed />
<TableSkeletons.Simple />
```

### CardSkeleton / CardGridSkeleton

```tsx
interface CardSkeletonProps {
  variant?: 'default' | 'metric' | 'info' | 'detailed' | 'compact';
  showHeader?: boolean; // Default: true
  showFooter?: boolean; // Default: false
  showIcon?: boolean; // Default: false
  contentLines?: number; // Default: 3
  height?: string;
  className?: string;
}

interface CardGridSkeletonProps {
  count?: number; // Default: 6
  columns?: 2 | 3 | 4; // Default: 3
  variant?: CardSkeletonProps['variant'];
  cardProps?: Omit<CardSkeletonProps, 'variant' | 'className'>;
  className?: string;
}

// Single card
<CardSkeleton variant="metric" showIcon />

// Grid of cards
<CardGridSkeleton
  count={4}
  columns={4}
  variant="metric"
  cardProps={{ showIcon: true }}
/>

// Presets
<CardSkeletons.Metric />
<CardSkeletons.Info />
<CardSkeletons.Detailed />
<CardSkeletons.Compact />
<CardSkeletons.MetricGrid />
<CardSkeletons.InfoGrid />
```

---

## Examples

### Network Monitoring Dashboard

```tsx
import { QueryBoundary, mapQueryResult } from '@dotmac/graphql';
import { DashboardSkeleton } from '@dotmac/primitives';

function NetworkMonitoring() {
  const result = useNetworkDashboardGraphQL();

  return (
    <QueryBoundary
      result={mapQueryResult(result)}
      loadingComponent={<DashboardSkeleton variant="network" metricCards={6} />}
    >
      {(data) => <NetworkDashboardContent data={data} />}
    </QueryBoundary>
  );
}
```

### Customer List Table

```tsx
import { QueryBoundary, mapQueryResult } from '@dotmac/graphql';
import { TableSkeleton } from '@dotmac/primitives';

function CustomerList() {
  const result = useCustomerListGraphQL({ limit: 50 });

  return (
    <QueryBoundary
      result={mapQueryResult(result)}
      loadingComponent={
        <TableSkeleton
          columns={6}
          rows={10}
          showCheckbox
          showSearch
          showFilters
        />
      }
    >
      {(customers) => <CustomerTable customers={customers} />}
    </QueryBoundary>
  );
}
```

### Metrics Dashboard

```tsx
import { QueryBoundary, mapQueryResult } from '@dotmac/graphql';
import { CardGridSkeleton } from '@dotmac/primitives';

function MetricsDashboard() {
  const result = useMetricsQuery();

  return (
    <div className="space-y-6">
      <h1>Platform Metrics</h1>

      <QueryBoundary
        result={mapQueryResult(result)}
        loadingComponent={
          <CardGridSkeleton
            count={4}
            columns={4}
            variant="metric"
            cardProps={{ showIcon: true }}
          />
        }
      >
        {(metrics) => (
          <div className="grid grid-cols-4 gap-4">
            {metrics.map(metric => (
              <MetricCard key={metric.id} {...metric} />
            ))}
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}
```

### Subscriber Detail Page

```tsx
import { QueryBoundary, mapQueryResult } from '@dotmac/graphql';
import { CardSkeleton } from '@dotmac/primitives';

function SubscriberDetail({ subscriberId }: { subscriberId: string }) {
  const result = useSubscriberDetailGraphQL({ subscriberId });

  return (
    <div className="space-y-6">
      <QueryBoundary
        result={mapQueryResult(result)}
        loadingComponent={
          <div className="grid grid-cols-2 gap-6">
            <CardSkeleton variant="info" showHeader showIcon />
            <CardSkeleton variant="info" showHeader showIcon />
          </div>
        }
      >
        {(subscriber) => (
          <div className="grid grid-cols-2 gap-6">
            <SubscriberInfoCard subscriber={subscriber} />
            <SubscriberBillingCard subscriber={subscriber} />
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}
```

### Using Presets

```tsx
import {
  DashboardSkeletons,
  TableSkeletons,
  CardSkeletons,
} from '@dotmac/primitives';

// Network dashboard - one liner
<QueryBoundary
  result={result}
  loadingComponent={<DashboardSkeletons.Network />}
>
  {(data) => <Content data={data} />}
</QueryBoundary>

// Customer list - one liner
<QueryBoundary
  result={result}
  loadingComponent={<TableSkeletons.CustomerList />}
>
  {(customers) => <CustomerTable customers={customers} />}
</QueryBoundary>

// Metric grid - one liner
<QueryBoundary
  result={result}
  loadingComponent={<CardSkeletons.MetricGrid />}
>
  {(metrics) => <MetricsGrid metrics={metrics} />}
</QueryBoundary>
```

---

## Best Practices

### 1. Match Your Component Structure

Choose a skeleton variant that matches your actual component layout:

```tsx
// ✅ Good: Skeleton matches actual component
<QueryBoundary
  result={result}
  loadingComponent={<DashboardSkeleton variant="network" metricCards={6} />}
>
  {(data) => <NetworkDashboard data={data} />} {/* Has 6 metric cards */}
</QueryBoundary>

// ❌ Bad: Mismatch causes jarring transition
<QueryBoundary
  result={result}
  loadingComponent={<TableSkeleton />}
>
  {(data) => <NetworkDashboard data={data} />} {/* Not a table! */}
</QueryBoundary>
```

### 2. Use Presets for Common Patterns

Presets provide one-liner solutions for standard layouts:

```tsx
// ✅ Good: Use preset for common patterns
<DashboardSkeletons.Network />
<TableSkeletons.CustomerList />
<CardSkeletons.MetricGrid />

// ⚠️ Okay: Custom configuration when needed
<DashboardSkeleton variant="network" metricCards={8} contentSections={4} />
```

### 3. Configure Rows/Columns to Match Data

For tables, configure skeleton to match expected data:

```tsx
// ✅ Good: Skeleton rows match typical page size
function CustomerList() {
  const PAGE_SIZE = 20;
  const result = useCustomerListGraphQL({ limit: PAGE_SIZE });

  return (
    <QueryBoundary
      result={result}
      loadingComponent={<TableSkeleton columns={6} rows={PAGE_SIZE} />}
    >
      {(customers) => <CustomerTable customers={customers} />}
    </QueryBoundary>
  );
}
```

### 4. Consider Mobile Responsiveness

Skeleton components use Tailwind's responsive classes, but test on mobile:

```tsx
// Card grids automatically adjust on mobile
<CardGridSkeleton
  count={6}
  columns={3} // 3 on desktop, 2 on tablet, 1 on mobile (via Tailwind)
  variant="metric"
/>
```

### 5. Combine with Empty States

Use `isEmpty` prop to show empty states instead of skeletons:

```tsx
<QueryBoundary
  result={result}
  loadingComponent={<TableSkeletons.CustomerList />}
  emptyComponent={<NoCustomersFound />}
  isEmpty={(data) => data.customers.length === 0}
>
  {(data) => <CustomerTable customers={data.customers} />}
</QueryBoundary>
```

### 6. Reuse Across Similar Pages

Create page-specific constants for commonly used skeletons:

```tsx
// hooks/useNetworkGraphQL.ts
export const NetworkLoadingStates = {
  Dashboard: <DashboardSkeletons.Network />,
  DeviceList: <TableSkeletons.DeviceList />,
  AlertList: <TableSkeletons.Compact />,
};

// Usage in components
<QueryBoundary
  result={result}
  loadingComponent={NetworkLoadingStates.Dashboard}
>
  {(data) => <NetworkDashboard data={data} />}
</QueryBoundary>
```

---

## Migration from Custom Skeletons

If you have custom skeleton components, migrate to the shared ones:

### Before: Custom Skeleton

```tsx
function CustomDashboardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/4" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 rounded" />
        ))}
      </div>
    </div>
  );
}

{loading && <CustomDashboardSkeleton />}
```

### After: Shared Skeleton

```tsx
import { DashboardSkeleton } from '@dotmac/primitives';

<QueryBoundary
  result={result}
  loadingComponent={<DashboardSkeleton variant="metrics" metricCards={4} />}
>
  {(data) => <Dashboard data={data} />}
</QueryBoundary>
```

**Benefits:**
- Consistent UX across platform
- Reduced code duplication
- Easier to maintain and update
- Dark mode support included
- Accessible by default

---

## Related Documentation

- [GRAPHQL_MIGRATION_HELPERS.md](./GRAPHQL_MIGRATION_HELPERS.md) - Query helpers and error handling
- [GRAPHQL_MIGRATION_PLAN.md](./GRAPHQL_MIGRATION_PLAN.md) - Overall migration strategy
- [@dotmac/primitives README](../shared/packages/primitives/README.md) - Component library docs
