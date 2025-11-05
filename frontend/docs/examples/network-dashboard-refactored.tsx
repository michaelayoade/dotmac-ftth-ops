/**
 * Example: Network Dashboard with Migration Helpers
 *
 * This demonstrates the recommended pattern using the new migration helpers.
 * Compare with the current implementation in apps/platform-admin-app/components/
 */

import {
  useNetworkOverviewQuery,
  mapQueryResult,
  QueryBoundary,
  handleGraphQLError,
  type NormalizedQueryResult,
} from '@dotmac/graphql';
import { DashboardSkeleton } from '@dotmac/primitives';
import { useToast } from '@dotmac/ui/use-toast';
import { logger } from '@/lib/logger';

// ============================================================================
// BEFORE: Manual error handling and ternaries
// ============================================================================

function NetworkDashboardBefore() {
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useNetworkOverviewQuery(
    undefined,
    {
      enabled: true,
      refetchInterval: 30000,
    }
  );

  // Manual error handling - logged but not consistently
  if (error) {
    console.error('[NetworkDashboard] Error:', error);
    // Inconsistent toast usage across components
  }

  // Manual loading/error/empty states - repetitive
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4" />
        <div className="h-32 bg-gray-200 rounded" />
        <div className="h-32 bg-gray-200 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="text-sm text-red-800">
          {error instanceof Error ? error.message : 'An error occurred'}
        </div>
      </div>
    );
  }

  if (!data?.networkOverview) {
    return (
      <div className="text-center py-12 text-gray-500">
        No network data available
      </div>
    );
  }

  return <NetworkOverviewContent data={data.networkOverview} />;
}

// ============================================================================
// AFTER: Using migration helpers
// ============================================================================

function NetworkDashboardAfter() {
  const { toast } = useToast();

  const queryResult = useNetworkOverviewQuery(
    undefined,
    {
      enabled: true,
      refetchInterval: 30000,
      // Centralized error handling in hook
      onError: (err) =>
        handleGraphQLError(err, {
          toast,
          logger,
          operationName: 'NetworkOverviewQuery',
          context: { hook: 'useNetworkOverviewGraphQL' },
        }),
    }
  );

  // Map to Apollo-compatible shape (optional - for backward compatibility)
  const result = mapQueryResult(queryResult);

  // Declarative loading/error/empty handling with shared skeleton
  return (
    <QueryBoundary
      result={result}
      loadingComponent={<DashboardSkeleton variant="network" />}
      isEmpty={(data) => !data?.networkOverview}
    >
      {(data) => <NetworkOverviewContent data={data.networkOverview!} />}
    </QueryBoundary>
  );
}

// ============================================================================
// EVEN BETTER: Reusable hook pattern
// ============================================================================

/**
 * Custom hook that encapsulates the entire pattern
 */
function useNetworkOverviewWithHelpers() {
  const { toast } = useToast();

  const queryResult = useNetworkOverviewQuery(
    undefined,
    {
      enabled: true,
      refetchInterval: 30000,
      // Error handling built into the hook
      onError: (err) =>
        handleGraphQLError(err, {
          toast,
          logger,
          operationName: 'NetworkOverviewQuery',
          context: { hook: 'useNetworkOverviewWithHelpers' },
        }),
    }
  );

  // Map to Apollo-compatible shape
  return mapQueryResult(queryResult);
}

function NetworkDashboardBest() {
  const result = useNetworkOverviewWithHelpers();

  return (
    <QueryBoundary
      result={result}
      loadingComponent={<DashboardSkeleton variant="network" />}
      isEmpty={(data) => !data?.networkOverview}
    >
      {(data) => <NetworkOverviewContent data={data.networkOverview!} />}
    </QueryBoundary>
  );
}

// ============================================================================
// Shared Components
// ============================================================================

function NetworkOverviewContent({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="Total Devices"
          value={data.totalDevices}
          trend={data.deviceTrend}
        />
        <MetricCard
          label="Online Devices"
          value={data.onlineDevices}
          status="success"
        />
        <MetricCard
          label="Active Alerts"
          value={data.activeAlerts}
          status="warning"
        />
        <MetricCard
          label="Uptime"
          value={`${data.uptimePercentage}%`}
          status="info"
        />
      </div>

      <DeviceTypeBreakdown summary={data.deviceTypeSummary} />
      <RecentAlerts alerts={data.recentAlerts} />
    </div>
  );
}

function MetricCard({ label, value, trend, status }: any) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-3xl font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

function DeviceTypeBreakdown({ summary }: any) {
  return <div>Device Type Breakdown</div>;
}

function RecentAlerts({ alerts }: any) {
  return <div>Recent Alerts</div>;
}

// ============================================================================
// Benefits Summary
// ============================================================================

/**
 * Benefits of using migration helpers:
 *
 * 1. **Consistency**: All pages use same loading/error/empty patterns
 * 2. **DRY**: Error handling centralized, not repeated in every component
 * 3. **Type Safety**: mapQueryResult preserves type information
 * 4. **Debugging**: Automatic error logging with context
 * 5. **UX**: Severity-aware toasts (error vs warning vs info)
 * 6. **Maintainability**: Changes to error handling happen in one place
 * 7. **Testability**: QueryBoundary is easier to test than nested ternaries
 * 8. **Skeleton Reuse**: Shared skeleton components from @dotmac/primitives
 *
 * Code Reduction:
 * - Before: ~40 lines of boilerplate per component
 * - After: ~10 lines per component (75% reduction)
 */

export {
  NetworkDashboardBefore,
  NetworkDashboardAfter,
  NetworkDashboardBest,
};
