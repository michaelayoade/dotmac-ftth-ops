/**
 * Example: Network Dashboard with Migration Helpers
 *
 * This demonstrates the recommended pattern using the new migration helpers.
 * Compare with the current implementation in apps/platform-admin-app/components/
 */

import { useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  useNetworkOverviewQuery,
  mapQueryResult,
  QueryBoundary,
  useErrorHandler,
  type NormalizedQueryResult,
} from '@dotmac/graphql';

// ============================================================================
// BEFORE: Manual error handling and ternaries
// ============================================================================

function NetworkDashboardBefore() {
  const { data, isLoading, error, refetch } = useNetworkOverviewQuery(
    undefined,
    {
      enabled: true,
      refetchInterval: 30000,
    }
  );

  // Manual error handling
  useEffect(() => {
    if (error) {
      console.error('[NetworkDashboard] Error:', error);
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    }
  }, [error]);

  // Manual loading/error/empty states
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
  const queryResult = useNetworkOverviewQuery(
    undefined,
    {
      enabled: true,
      refetchInterval: 30000,
    }
  );

  // Map to Apollo-compatible shape
  const result = mapQueryResult(queryResult);

  // Centralized error handling with severity and logging
  const errorState = useErrorHandler(result.error, {
    operation: 'NetworkOverview',
    componentName: 'NetworkDashboard',
  });

  useEffect(() => {
    if (errorState?.shouldToast) {
      // Severity-aware toasting (error | warning | info | critical)
      toast[errorState.severity](errorState.message);
    }
  }, [errorState]);

  // Declarative loading/error/empty handling
  return (
    <QueryBoundary
      result={result}
      loadingComponent={<NetworkDashboardSkeleton />}
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
  const queryResult = useNetworkOverviewQuery(
    undefined,
    {
      enabled: true,
      refetchInterval: 30000,
    }
  );

  const result = mapQueryResult(queryResult);
  const errorState = useErrorHandler(result.error, {
    operation: 'NetworkOverview',
    componentName: 'NetworkDashboard',
  });

  useEffect(() => {
    if (errorState?.shouldToast) {
      toast[errorState.severity](errorState.message);
    }
  }, [errorState]);

  return result;
}

function NetworkDashboardBest() {
  const result = useNetworkOverviewWithHelpers();

  return (
    <QueryBoundary
      result={result}
      loadingComponent={<NetworkDashboardSkeleton />}
      isEmpty={(data) => !data?.networkOverview}
    >
      {(data) => <NetworkOverviewContent data={data.networkOverview!} />}
    </QueryBoundary>
  );
}

// ============================================================================
// Shared Components
// ============================================================================

function NetworkDashboardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/4" />
      <div className="grid grid-cols-4 gap-4">
        <div className="h-24 bg-gray-200 rounded" />
        <div className="h-24 bg-gray-200 rounded" />
        <div className="h-24 bg-gray-200 rounded" />
        <div className="h-24 bg-gray-200 rounded" />
      </div>
      <div className="h-64 bg-gray-200 rounded" />
    </div>
  );
}

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
 * 8. **Skeleton Reuse**: Shared skeleton components across dashboard
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
