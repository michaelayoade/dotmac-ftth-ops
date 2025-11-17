/**
 * MSW Tests for useFiberGraphQL Hooks
 *
 * Tests all fiber infrastructure GraphQL hooks with realistic API mocking.
 * Covers dashboard, cables, splices, distribution points, service areas,
 * health metrics, network analytics, and aggregated hooks.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { graphql } from 'msw';
import { createApolloWrapper } from '@/__tests__/test-utils';
import { server } from '@/__tests__/msw/server';
import {
  useFiberDashboardGraphQL,
  useFiberCableListGraphQL,
  useFiberCableDetailGraphQL,
  useFiberCablesByRouteGraphQL,
  useFiberCablesByDistributionPointGraphQL,
  useFiberHealthMetricsGraphQL,
  useFiberNetworkAnalyticsGraphQL,
  useSplicePointListGraphQL,
  useSplicePointDetailGraphQL,
  useSplicePointsByCableGraphQL,
  useDistributionPointListGraphQL,
  useDistributionPointDetailGraphQL,
  useDistributionPointsBySiteGraphQL,
  useServiceAreaListGraphQL,
  useServiceAreaDetailGraphQL,
  useServiceAreasByPostalCodeGraphQL,
  useFiberCableDetailsAggregated,
  useDistributionPointDetailsAggregated,
  useFiberOverviewAggregated,
} from '../useFiberGraphQL';
import {
  seedFiberData,
  resetFiberData,
  createMockFiberCable,
  createMockSplicePoint,
  createMockDistributionPoint,
  createMockServiceArea,
  createMockHealthMetrics,
} from '../../__tests__/msw/handlers/graphql-fiber';

const waitForFiberLoading = async (getLoading: () => boolean) => {
  await waitFor(() => expect(getLoading()).toBe(false), { timeout: 5000 });
};

// ============================================================================
// TEST SETUP
// ============================================================================

const createWrapper = () => createApolloWrapper();

// ============================================================================
// TEST DATA
// ============================================================================

const mockCables = [
  createMockFiberCable({ id: 'cable-001', cable_code: 'FC-001', status: 'ACTIVE', fiber_type: 'SINGLE_MODE' }),
  createMockFiberCable({ id: 'cable-002', cable_code: 'FC-002', status: 'ACTIVE', fiber_type: 'MULTI_MODE' }),
  createMockFiberCable({ id: 'cable-003', cable_code: 'FC-003', status: 'INACTIVE', fiber_type: 'SINGLE_MODE' }),
];

const mockSplices = [
  createMockSplicePoint({ id: 'splice-001', cable_id: 'cable-001', status: 'ACTIVE', splice_type: 'FUSION' }),
  createMockSplicePoint({ id: 'splice-002', cable_id: 'cable-001', status: 'VERIFIED', splice_type: 'MECHANICAL' }),
  createMockSplicePoint({ id: 'splice-003', cable_id: 'cable-002', status: 'ACTIVE', splice_type: 'FUSION' }),
];

const mockDistributionPoints = [
  createMockDistributionPoint({ id: 'dp-001', point_type: 'CABINET', status: 'ACTIVE', site_id: 'site-001' }),
  createMockDistributionPoint({ id: 'dp-002', point_type: 'CLOSURE', status: 'ACTIVE', site_id: 'site-001' }),
  createMockDistributionPoint({ id: 'dp-003', point_type: 'POLE', status: 'INACTIVE', site_id: 'site-002' }),
];

const mockServiceAreas = [
  createMockServiceArea({ id: 'sa-001', area_type: 'RESIDENTIAL', is_serviceable: true, postal_codes: ['10001', '10002'] }),
  createMockServiceArea({ id: 'sa-002', area_type: 'COMMERCIAL', is_serviceable: true, postal_codes: ['10003'] }),
  createMockServiceArea({ id: 'sa-003', area_type: 'RESIDENTIAL', is_serviceable: false, postal_codes: ['10004'] }),
];

const mockHealthMetrics = [
  createMockHealthMetrics(),
];

// ============================================================================
// TESTS - FIBER DASHBOARD
// ============================================================================

describe('useFiberGraphQL - Dashboard', () => {
  beforeEach(() => {
    resetFiberData();
    seedFiberData(mockCables, mockSplices, mockDistributionPoints, mockServiceAreas, mockHealthMetrics);
  });

  describe('useFiberDashboardGraphQL', () => {
    it('should fetch dashboard data successfully', async () => {
      const { result } = renderHook(() => useFiberDashboardGraphQL(), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.dashboard).toBeDefined();
      expect(result.current.analytics).toBeDefined();
      expect(result.current.topCables).toHaveLength(3);
      expect(result.current.topDistributionPoints).toHaveLength(2);
      expect(result.current.topServiceAreas).toHaveLength(2);
      expect(result.current.error).toBeUndefined();
    });

    it('should return analytics metrics', async () => {
      const { result } = renderHook(() => useFiberDashboardGraphQL(), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.analytics).toMatchObject({
        totalFiberKm: expect.any(Number),
        totalCables: expect.any(Number),
        totalStrands: expect.any(Number),
        capacityUtilizationPercent: expect.any(Number),
      });
    });

    it('should return top items by metrics', async () => {
      const { result } = renderHook(() => useFiberDashboardGraphQL(), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.topCables.length).toBeGreaterThan(0);
      expect(result.current.topDistributionPoints.length).toBeGreaterThan(0);
      expect(result.current.topServiceAreas.length).toBeGreaterThan(0);
    });

    it('should support custom poll interval', async () => {
      const { result } = renderHook(() => useFiberDashboardGraphQL({ pollInterval: 60000 }), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.dashboard).toBeDefined();
    });
  });
});

// ============================================================================
// TESTS - FIBER CABLES
// ============================================================================

describe('useFiberGraphQL - Cables', () => {
  beforeEach(() => {
    resetFiberData();
    seedFiberData(mockCables, mockSplices, mockDistributionPoints, mockServiceAreas, mockHealthMetrics);
  });

  describe('useFiberCableListGraphQL', () => {
    it('should fetch cable list successfully', async () => {
      const { result } = renderHook(() => useFiberCableListGraphQL(), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.cables).toHaveLength(3);
      expect(result.current.totalCount).toBe(3);
      expect(result.current.error).toBeUndefined();
    });

    it('should filter cables by status', async () => {
      const { result } = renderHook(() => useFiberCableListGraphQL({ status: 'ACTIVE' }), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.cables).toHaveLength(2);
      expect(result.current.cables.every(c => c.status === 'ACTIVE')).toBe(true);
    });

    it('should filter cables by fiber type', async () => {
      const { result } = renderHook(() => useFiberCableListGraphQL({ fiberType: 'SINGLE_MODE' }), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.cables).toHaveLength(2);
      expect(result.current.cables.every(c => c.fiberType === 'SINGLE_MODE')).toBe(true);
    });

    it('should support pagination', async () => {
      const { result } = renderHook(() => useFiberCableListGraphQL({ limit: 2, offset: 0 }), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.cables).toHaveLength(2);
      expect(result.current.hasNextPage).toBe(true);
    });

    it('should support fetchMore for pagination', async () => {
      const { result } = renderHook(() => useFiberCableListGraphQL({ limit: 2, offset: 0 }), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(typeof result.current.fetchMore).toBe('function');
    });
  });

  describe('useFiberCableDetailGraphQL', () => {
    it('should fetch single cable details', async () => {
      const { result } = renderHook(() => useFiberCableDetailGraphQL('cable-001'), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.cable).toBeDefined();
      expect(result.current.cable?.id).toBe('cable-001');
      expect(result.current.error).toBeUndefined();
    });

    it('should skip query when ID is undefined', async () => {
      const { result } = renderHook(() => useFiberCableDetailGraphQL(undefined), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.cable).toBeNull();
    });

    it('should return null for non-existent cable', async () => {
      const { result } = renderHook(() => useFiberCableDetailGraphQL('cable-999'), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.cable).toBeNull();
    });
  });

  describe('useFiberCablesByRouteGraphQL', () => {
    it('should fetch cables by route', async () => {
      const { result } = renderHook(() => useFiberCablesByRouteGraphQL('dp-start-001', 'dp-end-001'), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.cables.length).toBeGreaterThanOrEqual(0);
      expect(result.current.error).toBeUndefined();
    });

    it('should skip query when IDs are undefined', async () => {
      const { result } = renderHook(() => useFiberCablesByRouteGraphQL(undefined, undefined), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.cables).toEqual([]);
    });
  });

  describe('useFiberCablesByDistributionPointGraphQL', () => {
    it('should fetch cables connected to distribution point', async () => {
      const cableWithDP = createMockFiberCable({ id: 'cable-004', start_point_id: 'dp-001' });
      seedFiberData([...mockCables, cableWithDP], mockSplices, mockDistributionPoints, mockServiceAreas);

      const { result } = renderHook(() => useFiberCablesByDistributionPointGraphQL('dp-001'), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.cables.length).toBeGreaterThanOrEqual(1);
      expect(result.current.error).toBeUndefined();
    });

    it('should skip query when ID is undefined', async () => {
      const { result } = renderHook(() => useFiberCablesByDistributionPointGraphQL(undefined), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.cables).toEqual([]);
    });
  });
});

// ============================================================================
// TESTS - FIBER HEALTH & ANALYTICS
// ============================================================================

describe('useFiberGraphQL - Health & Analytics', () => {
  beforeEach(() => {
    resetFiberData();
    seedFiberData(mockCables, mockSplices, mockDistributionPoints, mockServiceAreas, mockHealthMetrics);
  });

  describe('useFiberHealthMetricsGraphQL', () => {
    it('should fetch health metrics successfully', async () => {
      const { result } = renderHook(() => useFiberHealthMetricsGraphQL(), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.metrics).toBeDefined();
      expect(Array.isArray(result.current.metrics)).toBe(true);
      expect(result.current.error).toBeUndefined();
    });

    it('should filter metrics by cable ID', async () => {
      const { result } = renderHook(() => useFiberHealthMetricsGraphQL({ cableId: 'cable-001' }), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.metrics.every(m => m.cableId === 'cable-001')).toBe(true);
    });

    it('should filter metrics by health status', async () => {
      const { result } = renderHook(() => useFiberHealthMetricsGraphQL({ healthStatus: 'GOOD' }), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.metrics.every(m => m.healthStatus === 'GOOD')).toBe(true);
    });

    it('should support custom poll interval', async () => {
      const { result } = renderHook(() => useFiberHealthMetricsGraphQL({ pollInterval: 120000 }), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.metrics).toBeDefined();
    });
  });

  describe('useFiberNetworkAnalyticsGraphQL', () => {
    it('should fetch network analytics successfully', async () => {
      const { result } = renderHook(() => useFiberNetworkAnalyticsGraphQL(), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.analytics).toBeDefined();
      expect(result.current.analytics).toHaveProperty('totalFiberKm');
      expect(result.current.analytics).toHaveProperty('totalCables');
      expect(result.current.error).toBeUndefined();
    });

    it('should return complete analytics structure', async () => {
      const { result } = renderHook(() => useFiberNetworkAnalyticsGraphQL(), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.analytics).toMatchObject({
        totalFiberKm: expect.any(Number),
        totalCables: expect.any(Number),
        totalStrands: expect.any(Number),
        usedCapacity: expect.any(Number),
        availableCapacity: expect.any(Number),
        capacityUtilizationPercent: expect.any(Number),
        healthyCables: expect.any(Number),
        cablesByStatus: expect.any(Object),
        cablesByType: expect.any(Object),
        networkHealthScore: expect.any(Number),
        penetrationRatePercent: expect.any(Number),
      });
    });
  });
});

// ============================================================================
// TESTS - SPLICE POINTS
// ============================================================================

describe('useFiberGraphQL - Splice Points', () => {
  beforeEach(() => {
    resetFiberData();
    seedFiberData(mockCables, mockSplices, mockDistributionPoints, mockServiceAreas, mockHealthMetrics);
  });

  describe('useSplicePointListGraphQL', () => {
    it('should fetch splice point list successfully', async () => {
      const { result } = renderHook(() => useSplicePointListGraphQL(), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.splicePoints).toHaveLength(3);
      expect(result.current.totalCount).toBe(3);
      expect(result.current.error).toBeUndefined();
    });

    it('should filter splice points by status', async () => {
      const { result } = renderHook(() => useSplicePointListGraphQL({ status: 'ACTIVE' }), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.splicePoints.every(s => s.status === 'ACTIVE')).toBe(true);
    });

    it('should filter splice points by cable ID', async () => {
      const { result } = renderHook(() => useSplicePointListGraphQL({ cableId: 'cable-001' }), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.splicePoints).toHaveLength(2);
      expect(result.current.splicePoints.every(s => s.cableId === 'cable-001')).toBe(true);
    });

    it('should support pagination', async () => {
      const { result } = renderHook(() => useSplicePointListGraphQL({ limit: 2, offset: 0 }), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.splicePoints).toHaveLength(2);
      expect(result.current.hasNextPage).toBe(true);
    });
  });

  describe('useSplicePointDetailGraphQL', () => {
    it('should fetch single splice point details', async () => {
      const { result } = renderHook(() => useSplicePointDetailGraphQL('splice-001'), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.splicePoint).toBeDefined();
      expect(result.current.splicePoint?.id).toBe('splice-001');
      expect(result.current.error).toBeUndefined();
    });

    it('should skip query when ID is undefined', async () => {
      const { result } = renderHook(() => useSplicePointDetailGraphQL(undefined), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.splicePoint).toBeNull();
    });
  });

  describe('useSplicePointsByCableGraphQL', () => {
    it('should fetch splice points by cable', async () => {
      const { result } = renderHook(() => useSplicePointsByCableGraphQL('cable-001'), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.splicePoints).toHaveLength(2);
      expect(result.current.splicePoints.every(s => s.cableId === 'cable-001')).toBe(true);
      expect(result.current.error).toBeUndefined();
    });

    it('should skip query when ID is undefined', async () => {
      const { result } = renderHook(() => useSplicePointsByCableGraphQL(undefined), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.splicePoints).toEqual([]);
    });
  });
});

// ============================================================================
// TESTS - DISTRIBUTION POINTS
// ============================================================================

describe('useFiberGraphQL - Distribution Points', () => {
  beforeEach(() => {
    resetFiberData();
    seedFiberData(mockCables, mockSplices, mockDistributionPoints, mockServiceAreas, mockHealthMetrics);
  });

  describe('useDistributionPointListGraphQL', () => {
    it('should fetch distribution point list successfully', async () => {
      const { result } = renderHook(() => useDistributionPointListGraphQL(), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.distributionPoints).toHaveLength(3);
      expect(result.current.totalCount).toBe(3);
      expect(result.current.error).toBeUndefined();
    });

    it('should filter distribution points by type', async () => {
      const { result } = renderHook(() => useDistributionPointListGraphQL({ pointType: 'CABINET' }), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.distributionPoints.every(d => d.pointType === 'CABINET')).toBe(true);
    });

    it('should filter distribution points by status', async () => {
      const { result } = renderHook(() => useDistributionPointListGraphQL({ status: 'ACTIVE' }), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.distributionPoints.every(d => d.status === 'ACTIVE')).toBe(true);
    });

    it('should filter distribution points near capacity', async () => {
      const nearCapacityDP = createMockDistributionPoint({
        id: 'dp-004',
        total_capacity: 100,
        utilized_capacity: 90
      });
      seedFiberData(mockCables, mockSplices, [...mockDistributionPoints, nearCapacityDP], mockServiceAreas);

      const { result } = renderHook(() => useDistributionPointListGraphQL({ nearCapacity: true }), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.distributionPoints.every(d => d.capacityUtilizationPercent >= 85)).toBe(true);
    });

    it('should support pagination', async () => {
      const { result } = renderHook(() => useDistributionPointListGraphQL({ limit: 2, offset: 0 }), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.distributionPoints).toHaveLength(2);
      expect(result.current.hasNextPage).toBe(true);
    });
  });

  describe('useDistributionPointDetailGraphQL', () => {
    it('should fetch single distribution point details', async () => {
      const { result } = renderHook(() => useDistributionPointDetailGraphQL('dp-001'), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.distributionPoint).toBeDefined();
      expect(result.current.distributionPoint?.id).toBe('dp-001');
      expect(result.current.error).toBeUndefined();
    });

    it('should skip query when ID is undefined', async () => {
      const { result } = renderHook(() => useDistributionPointDetailGraphQL(undefined), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.distributionPoint).toBeNull();
    });
  });

  describe('useDistributionPointsBySiteGraphQL', () => {
    it('should fetch distribution points by site', async () => {
      const { result } = renderHook(() => useDistributionPointsBySiteGraphQL('site-001'), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.distributionPoints).toHaveLength(2);
      expect(result.current.distributionPoints.every(d => d.siteId === 'site-001')).toBe(true);
      expect(result.current.error).toBeUndefined();
    });

    it('should skip query when ID is undefined', async () => {
      const { result } = renderHook(() => useDistributionPointsBySiteGraphQL(undefined), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.distributionPoints).toEqual([]);
    });
  });
});

// ============================================================================
// TESTS - SERVICE AREAS
// ============================================================================

describe('useFiberGraphQL - Service Areas', () => {
  beforeEach(() => {
    resetFiberData();
    seedFiberData(mockCables, mockSplices, mockDistributionPoints, mockServiceAreas, mockHealthMetrics);
  });

  describe('useServiceAreaListGraphQL', () => {
    it('should fetch service area list successfully', async () => {
      const { result } = renderHook(() => useServiceAreaListGraphQL(), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.serviceAreas).toHaveLength(3);
      expect(result.current.totalCount).toBe(3);
      expect(result.current.error).toBeUndefined();
    });

    it('should filter service areas by type', async () => {
      const { result } = renderHook(() => useServiceAreaListGraphQL({ areaType: 'RESIDENTIAL' }), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.serviceAreas.every(a => a.areaType === 'RESIDENTIAL')).toBe(true);
    });

    it('should filter service areas by serviceable status', async () => {
      const { result } = renderHook(() => useServiceAreaListGraphQL({ isServiceable: true }), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.serviceAreas).toHaveLength(2);
      expect(result.current.serviceAreas.every(a => a.isServiceable === true)).toBe(true);
    });

    it('should support pagination', async () => {
      const { result } = renderHook(() => useServiceAreaListGraphQL({ limit: 2, offset: 0 }), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.serviceAreas).toHaveLength(2);
      expect(result.current.hasNextPage).toBe(true);
    });
  });

  describe('useServiceAreaDetailGraphQL', () => {
    it('should fetch single service area details', async () => {
      const { result } = renderHook(() => useServiceAreaDetailGraphQL('sa-001'), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.serviceArea).toBeDefined();
      expect(result.current.serviceArea?.id).toBe('sa-001');
      expect(result.current.error).toBeUndefined();
    });

    it('should skip query when ID is undefined', async () => {
      const { result } = renderHook(() => useServiceAreaDetailGraphQL(undefined), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.serviceArea).toBeNull();
    });
  });

  describe('useServiceAreasByPostalCodeGraphQL', () => {
    it('should fetch service areas by postal code', async () => {
      const { result } = renderHook(() => useServiceAreasByPostalCodeGraphQL('10001'), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.serviceAreas.length).toBeGreaterThan(0);
      expect(result.current.serviceAreas.every(a => a.postalCodes?.includes('10001'))).toBe(true);
      expect(result.current.error).toBeUndefined();
    });

    it('should skip query when postal code is undefined', async () => {
      const { result } = renderHook(() => useServiceAreasByPostalCodeGraphQL(undefined), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => result.current.loading);

      expect(result.current.serviceAreas).toEqual([]);
    });
  });
});

// ============================================================================
// TESTS - AGGREGATED HOOKS
// ============================================================================

describe('useFiberGraphQL - Aggregated Hooks', () => {
  beforeEach(() => {
    resetFiberData();
    seedFiberData(mockCables, mockSplices, mockDistributionPoints, mockServiceAreas, mockHealthMetrics);
  });

  describe('useFiberCableDetailsAggregated', () => {
    it('should fetch cable details with health and splices', async () => {
      const { result } = renderHook(() => useFiberCableDetailsAggregated('cable-001'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.cable).toBeDefined();
      expect(result.current.healthMetrics).toBeDefined();
      expect(result.current.splicePoints).toHaveLength(2);
      expect(result.current.error).toBeUndefined();
    });

    it('should provide refetch function', async () => {
      const { result } = renderHook(() => useFiberCableDetailsAggregated('cable-001'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(typeof result.current.refetch).toBe('function');
    });

    it('should handle undefined cable ID', async () => {
      const { result } = renderHook(() => useFiberCableDetailsAggregated(undefined), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.cable).toBeNull();
    });
  });

  describe('useDistributionPointDetailsAggregated', () => {
    it('should fetch distribution point with connected cables', async () => {
      const cableWithDP = createMockFiberCable({ id: 'cable-004', start_point_id: 'dp-001' });
      seedFiberData([...mockCables, cableWithDP], mockSplices, mockDistributionPoints, mockServiceAreas);

      const { result } = renderHook(() => useDistributionPointDetailsAggregated('dp-001'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.distributionPoint).toBeDefined();
      expect(result.current.connectedCables.length).toBeGreaterThanOrEqual(1);
      expect(result.current.error).toBeUndefined();
    });

    it('should provide refetch function', async () => {
      const { result } = renderHook(() => useDistributionPointDetailsAggregated('dp-001'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(typeof result.current.refetch).toBe('function');
    });
  });

  describe('useFiberOverviewAggregated', () => {
    it('should fetch dashboard and analytics together', async () => {
      const { result } = renderHook(() => useFiberOverviewAggregated(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.dashboard).toBeDefined();
      expect(result.current.analytics).toBeDefined();
      expect(result.current.error).toBeUndefined();
    });

    it('should provide refetch function', async () => {
      const { result } = renderHook(() => useFiberOverviewAggregated(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(typeof result.current.refetch).toBe('function');
    });
  });
});

// ============================================================================
// TESTS - REAL-WORLD SCENARIOS
// ============================================================================

describe('useFiberGraphQL - Real-World Scenarios', () => {
  beforeEach(() => {
    resetFiberData();
    seedFiberData(mockCables, mockSplices, mockDistributionPoints, mockServiceAreas, mockHealthMetrics);
  });

  it('should support dashboard drill-down workflow', async () => {
    // Step 1: Fetch dashboard
    const { result: dashboardResult } = renderHook(() => useFiberDashboardGraphQL(), {
      wrapper: createWrapper(),
    });

    await waitForFiberLoading(() => dashboardResult.current.loading);

    const topCable = dashboardResult.current.topCables[0];
    expect(topCable).toBeDefined();

    // Step 2: Drill into cable details
    const { result: cableResult } = renderHook(() => useFiberCableDetailGraphQL(topCable.id), {
      wrapper: createWrapper(),
    });

    await waitForFiberLoading(() => cableResult.current.loading);

    expect(cableResult.current.cable?.id).toBe(topCable.id);
  });

  it('should support cable to splice points workflow', async () => {
    // Step 1: Fetch cable list
    const { result: cableListResult } = renderHook(() => useFiberCableListGraphQL(), {
      wrapper: createWrapper(),
    });

    await waitForFiberLoading(() => cableListResult.current.loading);

    const firstCable = cableListResult.current.cables[0];

    // Step 2: Fetch splices for cable
    const { result: spliceResult } = renderHook(() => useSplicePointsByCableGraphQL(firstCable.id), {
      wrapper: createWrapper(),
    });

    await waitForFiberLoading(() => spliceResult.current.loading);

    expect(spliceResult.current.splicePoints.every(s => s.cableId === firstCable.id)).toBe(true);
  });

  it('should support distribution point workflow', async () => {
    const cableWithDP = createMockFiberCable({ id: 'cable-004', start_point_id: 'dp-001' });
    seedFiberData([...mockCables, cableWithDP], mockSplices, mockDistributionPoints, mockServiceAreas);

    // Step 1: Fetch distribution point
    const { result: dpResult } = renderHook(() => useDistributionPointDetailGraphQL('dp-001'), {
      wrapper: createWrapper(),
    });

    await waitForFiberLoading(() => dpResult.current.loading);

    expect(dpResult.current.distributionPoint?.id).toBe('dp-001');

    // Step 2: Fetch connected cables
    const { result: cablesResult } = renderHook(() => useFiberCablesByDistributionPointGraphQL('dp-001'), {
      wrapper: createWrapper(),
    });

    await waitForFiberLoading(() => cablesResult.current.loading);

    expect(cablesResult.current.cables.length).toBeGreaterThanOrEqual(1);
  });

  it('should support service area postal code lookup', async () => {
    // Step 1: Search by postal code
    const { result: postalResult } = renderHook(() => useServiceAreasByPostalCodeGraphQL('10001'), {
      wrapper: createWrapper(),
    });

    await waitForFiberLoading(() => postalResult.current.loading);

    expect(postalResult.current.serviceAreas.length).toBeGreaterThan(0);

    const firstArea = postalResult.current.serviceAreas[0];

    // Step 2: Fetch detailed service area info
    const { result: areaResult } = renderHook(() => useServiceAreaDetailGraphQL(firstArea.id), {
      wrapper: createWrapper(),
    });

    await waitForFiberLoading(() => areaResult.current.loading);

    expect(areaResult.current.serviceArea?.postalCodes).toContain('10001');
  });

  it('should support health monitoring workflow', async () => {
    // Step 1: Fetch cables requiring attention
    const { result: dashboardResult } = renderHook(() => useFiberDashboardGraphQL(), {
      wrapper: createWrapper(),
    });

    await waitForFiberLoading(() => dashboardResult.current.loading);

    const poorCable = dashboardResult.current.cablesRequiringAttention[0];

    if (poorCable) {
      // Step 2: Fetch detailed health metrics
      const { result: healthResult } = renderHook(() => useFiberHealthMetricsGraphQL({ cableId: poorCable.id }), {
        wrapper: createWrapper(),
      });

      await waitForFiberLoading(() => healthResult.current.loading);

      expect(healthResult.current.metrics.every(m => m.cableId === poorCable.id)).toBe(true);
    }
  });
});

describe('useFiberGraphQL - Error Handling', () => {
  it('should surface GraphQL errors for cable list hook', async () => {
    const errorMessage = 'FiberCableList query failed';
    server.use(
      graphql.query('FiberCableList', (req, res, ctx) => {
        return res(
          ctx.errors([
            {
              message: errorMessage,
            },
          ]),
        );
      }),
    );

    const { result } = renderHook(() => useFiberCableListGraphQL(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.error).toBeDefined());

    expect(result.current.error).toContain(errorMessage);
    expect(result.current.cables).toHaveLength(0);
    expect(result.current.totalCount).toBe(0);
  });
});
