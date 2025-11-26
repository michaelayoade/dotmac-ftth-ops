/**
 * Fiber Infrastructure GraphQL Hooks
 *
 * Comprehensive hooks for fiber optic network management using GraphQL.
 * Provides efficient data fetching for:
 * - Fiber cables (inventory, routing, health)
 * - Distribution points (cabinets, closures, poles)
 * - Splice points (fusion/mechanical splices)
 * - Service areas (coverage mapping)
 * - Network analytics and health metrics
 * - Complete fiber dashboard
 *
 * @module hooks/useFiberGraphQL
 * @created 2025-10-16
 */

import type { ApolloError } from "@apollo/client";

import {
  useFiberDashboardQuery,
  useFiberCableListQuery,
  useFiberCableDetailQuery,
  useFiberCablesByRouteQuery,
  useFiberCablesByDistributionPointQuery,
  useFiberHealthMetricsQuery,
  useFiberNetworkAnalyticsQuery,
  useSplicePointListQuery,
  useSplicePointDetailQuery,
  useSplicePointsByCableQuery,
  useDistributionPointListQuery,
  useDistributionPointDetailQuery,
  useDistributionPointsBySiteQuery,
  useServiceAreaListQuery,
  useServiceAreaDetailQuery,
  useServiceAreasByPostalCodeQuery,
  type FiberCableStatus,
  type FiberType,
  type CableInstallationType,
  type SpliceStatus,
  type SpliceType,
  type DistributionPointType,
  type ServiceAreaType,
  type FiberHealthStatus,
} from "@/lib/graphql/generated";

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Re-export types for use in components
export type {
  FiberCableStatus,
  FiberType,
  CableInstallationType,
  SpliceStatus,
  SpliceType,
  DistributionPointType,
  ServiceAreaType,
  FiberHealthStatus,
};

const formatGraphQLError = (error?: ApolloError) => {
  if (!error) {
    return undefined;
  }

  const graphQLError = error.graphQLErrors?.[0]?.message;
  if (graphQLError) {
    return graphQLError;
  }

  const extractMessage = (payload: unknown): string | undefined => {
    if (!payload) {
      return undefined;
    }

    const normalized =
      typeof payload === "string"
        ? (() => {
            try {
              return JSON.parse(payload);
            } catch {
              return undefined;
            }
          })()
        : payload;

    if (normalized && typeof normalized === "object" && "errors" in normalized) {
      const errors = (normalized as { errors?: Array<{ message?: string }> }).errors;
      return errors?.find((err) => typeof err?.message === "string")?.message;
    }

    return undefined;
  };

  const networkError = error.networkError as { result?: unknown; bodyText?: string } | null;
  const networkMessage =
    extractMessage(networkError?.result) ?? extractMessage(networkError?.bodyText);
  return networkMessage ?? error.message;
};

// ============================================================================
// FIBER DASHBOARD
// ============================================================================

/**
 * Hook for fetching complete fiber network dashboard data
 *
 * Provides:
 * - Network analytics (capacity, health, coverage)
 * - Top performers (cables, distribution points, service areas)
 * - Cables requiring attention
 * - Capacity planning insights
 * - Historical trends
 *
 * @param options - Query options
 * @returns Dashboard data with loading and error states
 *
 * @example
 * ```tsx
 * function FiberDashboard() {
 *   const { dashboard, loading, error, refetch } = useFiberDashboardGraphQL({
 *     pollInterval: 30000 // Refresh every 30 seconds
 *   });
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div>
 *       <MetricsGrid analytics={dashboard.analytics} />
 *       <CablesList cables={dashboard.top_cables_by_utilization} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useFiberDashboardGraphQL(
  options: {
    pollInterval?: number;
  } = {},
) {
  const { pollInterval = 30000 } = options;

  const { data, loading, error, refetch } = useFiberDashboardQuery({
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  return {
    dashboard: data?.fiberDashboard || null,
    analytics: data?.fiberDashboard?.analytics || null,
    topCables: data?.fiberDashboard?.topCablesByUtilization || [],
    topDistributionPoints: data?.fiberDashboard?.topDistributionPointsByCapacity || [],
    topServiceAreas: data?.fiberDashboard?.topServiceAreasByPenetration || [],
    cablesRequiringAttention: data?.fiberDashboard?.cablesRequiringAttention || [],
    distributionPointsNearCapacity: data?.fiberDashboard?.distributionPointsNearCapacity || [],
    serviceAreasExpansion: data?.fiberDashboard?.serviceAreasExpansionCandidates || [],
    loading,
    error: formatGraphQLError(error),
    refetch,
  };
}

// ============================================================================
// FIBER CABLES
// ============================================================================

/**
 * Hook for fetching paginated fiber cable list with filtering
 *
 * @param options - Query options with filters
 * @returns Cable list with pagination
 *
 * @example
 * ```tsx
 * const { cables, totalCount, loading, refetch } = useFiberCableListGraphQL({
 *   limit: 50,
 *   status: FiberCableStatus.Active,
 *   installationType: CableInstallationType.Underground,
 * });
 * ```
 */
export function useFiberCableListGraphQL(
  options: {
    limit?: number;
    offset?: number;
    status?: FiberCableStatus;
    fiberType?: FiberType;
    installationType?: CableInstallationType;
    siteId?: string;
    search?: string;
    pollInterval?: number;
  } = {},
) {
  const {
    limit = 50,
    offset = 0,
    status,
    fiberType,
    installationType,
    siteId,
    search,
    pollInterval = 30000,
  } = options;

  const { data, loading, error, refetch, fetchMore } = useFiberCableListQuery({
    variables: {
      limit,
      offset,
      status,
      fiberType,
      installationType,
      siteId,
      search,
    },
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  return {
    cables: data?.fiberCables?.cables || [],
    totalCount: data?.fiberCables?.totalCount || 0,
    hasNextPage: data?.fiberCables?.hasNextPage || false,
    loading,
    error: formatGraphQLError(error),
    refetch,
    fetchMore: (newOffset: number) => {
      return fetchMore({
        variables: {
          offset: newOffset,
        },
      });
    },
  };
}

/**
 * Hook for fetching single fiber cable details
 *
 * @param cableId - Cable ID to fetch
 * @param options - Query options
 * @returns Cable details
 *
 * @example
 * ```tsx
 * const { cable, loading, error } = useFiberCableDetailGraphQL('cable-123', {
 *   pollInterval: 15000
 * });
 * ```
 */
export function useFiberCableDetailGraphQL(
  cableId: string | undefined,
  options: {
    pollInterval?: number;
  } = {},
) {
  const { pollInterval = 15000 } = options;

  const { data, loading, error, refetch } = useFiberCableDetailQuery({
    variables: { id: cableId! },
    skip: !cableId,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  return {
    cable: data?.fiberCable || null,
    loading,
    error: formatGraphQLError(error),
    refetch,
  };
}

/**
 * Hook for fetching cables between two distribution points (route)
 *
 * @param startPointId - Starting distribution point ID
 * @param endPointId - Ending distribution point ID
 * @returns Cables on the route
 *
 * @example
 * ```tsx
 * const { cables, loading } = useFiberCablesByRouteGraphQL(
 *   'dp-start-123',
 *   'dp-end-456'
 * );
 * ```
 */
export function useFiberCablesByRouteGraphQL(
  startPointId: string | undefined,
  endPointId: string | undefined,
) {
  const { data, loading, error, refetch } = useFiberCablesByRouteQuery({
    variables: {
      startPointId: startPointId!,
      endPointId: endPointId!,
    },
    skip: !startPointId || !endPointId,
    fetchPolicy: "cache-and-network",
  });

  return {
    cables: data?.fiberCablesByRoute || [],
    loading,
    error: formatGraphQLError(error),
    refetch,
  };
}

/**
 * Hook for fetching all cables connected to a distribution point
 *
 * @param distributionPointId - Distribution point ID
 * @returns Connected cables
 *
 * @example
 * ```tsx
 * const { cables, loading } = useFiberCablesByDistributionPointGraphQL('dp-123');
 * ```
 */
export function useFiberCablesByDistributionPointGraphQL(distributionPointId: string | undefined) {
  const { data, loading, error, refetch } = useFiberCablesByDistributionPointQuery({
    variables: {
      distributionPointId: distributionPointId!,
    },
    skip: !distributionPointId,
    fetchPolicy: "cache-and-network",
  });

  return {
    cables: data?.fiberCablesByDistributionPoint || [],
    loading,
    error: formatGraphQLError(error),
    refetch,
  };
}

// ============================================================================
// FIBER HEALTH & ANALYTICS
// ============================================================================

/**
 * Hook for fetching fiber health metrics
 *
 * Provides cable health status, signal loss, issues, and recommendations
 *
 * @param options - Query options with optional filters
 * @returns Health metrics
 *
 * @example
 * ```tsx
 * const { metrics, loading } = useFiberHealthMetricsGraphQL({
 *   cableId: 'cable-123',
 *   healthStatus: FiberHealthStatus.Poor,
 * });
 * ```
 */
export function useFiberHealthMetricsGraphQL(
  options: {
    cableId?: string;
    healthStatus?: FiberHealthStatus;
    pollInterval?: number;
  } = {},
) {
  const { cableId, healthStatus, pollInterval = 60000 } = options;

  const { data, loading, error, refetch } = useFiberHealthMetricsQuery({
    variables: {
      cableId,
      healthStatus,
    },
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  return {
    metrics: data?.fiberHealthMetrics || [],
    loading,
    error: formatGraphQLError(error),
    refetch,
  };
}

/**
 * Hook for fetching network-wide fiber analytics
 *
 * Provides aggregated statistics:
 * - Total fiber kilometers
 * - Cable and strand counts
 * - Capacity utilization
 * - Health distribution
 * - Coverage metrics
 *
 * @param options - Query options
 * @returns Network analytics
 *
 * @example
 * ```tsx
 * const { analytics, loading } = useFiberNetworkAnalyticsGraphQL({
 *   pollInterval: 60000 // Refresh every minute
 * });
 * ```
 */
export function useFiberNetworkAnalyticsGraphQL(
  options: {
    pollInterval?: number;
  } = {},
) {
  const { pollInterval = 60000 } = options;

  const { data, loading, error, refetch } = useFiberNetworkAnalyticsQuery({
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  return {
    analytics: data?.fiberNetworkAnalytics || null,
    loading,
    error: formatGraphQLError(error),
    refetch,
  };
}

// ============================================================================
// SPLICE POINTS
// ============================================================================

/**
 * Hook for fetching splice point list with filtering
 *
 * @param options - Query options with filters
 * @returns Splice points with pagination
 *
 * @example
 * ```tsx
 * const { splicePoints, totalCount, loading } = useSplicePointListGraphQL({
 *   status: SpliceStatus.Active,
 *   cableId: 'cable-123',
 * });
 * ```
 */
export function useSplicePointListGraphQL(
  options: {
    limit?: number;
    offset?: number;
    status?: SpliceStatus;
    cableId?: string;
    distributionPointId?: string;
    pollInterval?: number;
  } = {},
) {
  const {
    limit = 50,
    offset = 0,
    status,
    cableId,
    distributionPointId,
    pollInterval = 30000,
  } = options;

  const { data, loading, error, refetch } = useSplicePointListQuery({
    variables: {
      limit,
      offset,
      status,
      cableId,
      distributionPointId,
    },
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  return {
    splicePoints: data?.splicePoints?.splicePoints || [],
    totalCount: data?.splicePoints?.totalCount || 0,
    hasNextPage: data?.splicePoints?.hasNextPage || false,
    loading,
    error: formatGraphQLError(error),
    refetch,
  };
}

/**
 * Hook for fetching single splice point details
 *
 * @param splicePointId - Splice point ID
 * @returns Splice point details
 */
export function useSplicePointDetailGraphQL(splicePointId: string | undefined) {
  const { data, loading, error, refetch } = useSplicePointDetailQuery({
    variables: { id: splicePointId! },
    skip: !splicePointId,
    fetchPolicy: "cache-and-network",
  });

  return {
    splicePoint: data?.splicePoint || null,
    loading,
    error: formatGraphQLError(error),
    refetch,
  };
}

/**
 * Hook for fetching all splice points on a specific cable
 *
 * @param cableId - Cable ID
 * @returns Splice points on cable
 */
export function useSplicePointsByCableGraphQL(cableId: string | undefined) {
  const { data, loading, error, refetch } = useSplicePointsByCableQuery({
    variables: { cableId: cableId! },
    skip: !cableId,
    fetchPolicy: "cache-and-network",
  });

  return {
    splicePoints: data?.splicePointsByCable || [],
    loading,
    error: formatGraphQLError(error),
    refetch,
  };
}

// ============================================================================
// DISTRIBUTION POINTS
// ============================================================================

/**
 * Hook for fetching distribution point list with filtering
 *
 * @param options - Query options with filters
 * @returns Distribution points with pagination
 *
 * @example
 * ```tsx
 * const { distributionPoints, totalCount, loading } = useDistributionPointListGraphQL({
 *   pointType: DistributionPointType.Cabinet,
 *   nearCapacity: true,
 * });
 * ```
 */
export function useDistributionPointListGraphQL(
  options: {
    limit?: number;
    offset?: number;
    pointType?: DistributionPointType;
    status?: FiberCableStatus;
    siteId?: string;
    nearCapacity?: boolean;
    search?: string;
    pollInterval?: number;
  } = {},
) {
  const {
    limit = 50,
    offset = 0,
    pointType,
    status,
    siteId,
    nearCapacity,
    pollInterval = 30000,
  } = options;

  const { data, loading, error, refetch } = useDistributionPointListQuery({
    variables: {
      limit,
      offset,
      pointType,
      status,
      siteId,
      nearCapacity,
    },
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  return {
    distributionPoints: data?.distributionPoints?.distributionPoints || [],
    totalCount: data?.distributionPoints?.totalCount || 0,
    hasNextPage: data?.distributionPoints?.hasNextPage || false,
    loading,
    error: formatGraphQLError(error),
    refetch,
  };
}

/**
 * Hook for fetching single distribution point details
 *
 * @param distributionPointId - Distribution point ID
 * @returns Distribution point details
 */
export function useDistributionPointDetailGraphQL(distributionPointId: string | undefined) {
  const { data, loading, error, refetch } = useDistributionPointDetailQuery({
    variables: { id: distributionPointId! },
    skip: !distributionPointId,
    fetchPolicy: "cache-and-network",
  });

  return {
    distributionPoint: data?.distributionPoint || null,
    loading,
    error: formatGraphQLError(error),
    refetch,
  };
}

/**
 * Hook for fetching all distribution points at a specific site
 *
 * @param siteId - Site ID
 * @returns Distribution points at site
 */
export function useDistributionPointsBySiteGraphQL(siteId: string | undefined) {
  const { data, loading, error, refetch } = useDistributionPointsBySiteQuery({
    variables: { siteId: siteId! },
    skip: !siteId,
    fetchPolicy: "cache-and-network",
  });

  return {
    distributionPoints: data?.distributionPointsBySite || [],
    loading,
    error: formatGraphQLError(error),
    refetch,
  };
}

// ============================================================================
// SERVICE AREAS
// ============================================================================

/**
 * Hook for fetching service area list with filtering
 *
 * @param options - Query options with filters
 * @returns Service areas with pagination
 *
 * @example
 * ```tsx
 * const { serviceAreas, totalCount, loading } = useServiceAreaListGraphQL({
 *   areaType: ServiceAreaType.Residential,
 *   isServiceable: true,
 * });
 * ```
 */
export function useServiceAreaListGraphQL(
  options: {
    limit?: number;
    offset?: number;
    areaType?: ServiceAreaType;
    isServiceable?: boolean;
    constructionStatus?: string;
    search?: string;
    pollInterval?: number;
  } = {},
) {
  const {
    limit = 50,
    offset = 0,
    areaType,
    isServiceable,
    constructionStatus,
    pollInterval = 60000,
  } = options;

  const { data, loading, error, refetch } = useServiceAreaListQuery({
    variables: {
      limit,
      offset,
      areaType,
      isServiceable,
      constructionStatus,
    },
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  return {
    serviceAreas: data?.serviceAreas?.serviceAreas || [],
    totalCount: data?.serviceAreas?.totalCount || 0,
    hasNextPage: data?.serviceAreas?.hasNextPage || false,
    loading,
    error: formatGraphQLError(error),
    refetch,
  };
}

/**
 * Hook for fetching single service area details
 *
 * @param serviceAreaId - Service area ID
 * @returns Service area details
 */
export function useServiceAreaDetailGraphQL(serviceAreaId: string | undefined) {
  const { data, loading, error, refetch } = useServiceAreaDetailQuery({
    variables: { id: serviceAreaId! },
    skip: !serviceAreaId,
    fetchPolicy: "cache-and-network",
  });

  return {
    serviceArea: data?.serviceArea || null,
    loading,
    error: formatGraphQLError(error),
    refetch,
  };
}

/**
 * Hook for fetching service areas by postal code
 *
 * @param postalCode - Postal code to search
 * @returns Service areas covering postal code
 */
export function useServiceAreasByPostalCodeGraphQL(postalCode: string | undefined) {
  const { data, loading, error, refetch } = useServiceAreasByPostalCodeQuery({
    variables: { postalCode: postalCode! },
    skip: !postalCode,
    fetchPolicy: "cache-and-network",
  });

  return {
    serviceAreas: data?.serviceAreasByPostalCode || [],
    loading,
    error: formatGraphQLError(error),
    refetch,
  };
}

// ============================================================================
// AGGREGATED HOOKS (for complex pages)
// ============================================================================

/**
 * Aggregated hook for fiber cable details page
 *
 * Fetches cable details + health metrics + splice points in parallel
 *
 * @param cableId - Cable ID
 * @returns All data needed for cable details page
 *
 * @example
 * ```tsx
 * function CableDetailsPage({ cableId }) {
 *   const {
 *     cable,
 *     healthMetrics,
 *     splicePoints,
 *     isLoading,
 *     error,
 *     refetch
 *   } = useFiberCableDetailsAggregated(cableId);
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <CableDetails
 *       cable={cable}
 *       health={healthMetrics}
 *       splices={splicePoints}
 *     />
 *   );
 * }
 * ```
 */
export function useFiberCableDetailsAggregated(cableId: string | undefined) {
  const cableQuery = useFiberCableDetailGraphQL(cableId);
  const healthQuery = useFiberHealthMetricsGraphQL(cableId ? { cableId } : undefined);
  const spliceQuery = useSplicePointsByCableGraphQL(cableId);

  return {
    cable: cableQuery.cable,
    healthMetrics: healthQuery.metrics,
    splicePoints: spliceQuery.splicePoints,
    isLoading: cableQuery.loading || healthQuery.loading || spliceQuery.loading,
    error: cableQuery.error || healthQuery.error || spliceQuery.error,
    refetch: () => {
      cableQuery.refetch();
      healthQuery.refetch();
      spliceQuery.refetch();
    },
  };
}

/**
 * Aggregated hook for distribution point details page
 *
 * Fetches point details + connected cables in parallel
 *
 * @param distributionPointId - Distribution point ID
 * @returns All data needed for distribution point details page
 */
export function useDistributionPointDetailsAggregated(distributionPointId: string | undefined) {
  const pointQuery = useDistributionPointDetailGraphQL(distributionPointId);
  const cablesQuery = useFiberCablesByDistributionPointGraphQL(distributionPointId);

  return {
    distributionPoint: pointQuery.distributionPoint,
    connectedCables: cablesQuery.cables,
    isLoading: pointQuery.loading || cablesQuery.loading,
    error: pointQuery.error || cablesQuery.error,
    refetch: () => {
      pointQuery.refetch();
      cablesQuery.refetch();
    },
  };
}

/**
 * Aggregated hook for fiber overview page
 *
 * Fetches dashboard + analytics + top items
 *
 * @returns Complete fiber network overview
 *
 * @example
 * ```tsx
 * function FiberOverviewPage() {
 *   const {
 *     dashboard,
 *     analytics,
 *     isLoading,
 *     error,
 *     refetch
 *   } = useFiberOverviewAggregated();
 *
 *   return (
 *     <div>
 *       <FiberDashboard data={dashboard} />
 *       <NetworkAnalytics data={analytics} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useFiberOverviewAggregated() {
  const dashboardQuery = useFiberDashboardGraphQL();
  const analyticsQuery = useFiberNetworkAnalyticsGraphQL();

  return {
    dashboard: dashboardQuery.dashboard,
    analytics: analyticsQuery.analytics,
    isLoading: dashboardQuery.loading || analyticsQuery.loading,
    error: dashboardQuery.error || analyticsQuery.error,
    refetch: () => {
      dashboardQuery.refetch();
      analyticsQuery.refetch();
    },
  };
}
