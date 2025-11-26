/**
 * Jest Tests for useFiberGraphQL Hooks
 *
 * Tests all fiber infrastructure GraphQL hooks with Jest mocks.
 * Covers dashboard, cables, splices, distribution points, service areas,
 * health metrics, network analytics, and aggregated hooks.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { createApolloWrapper } from "@/__tests__/test-utils";
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
} from "../useFiberGraphQL";
import * as generatedHooks from "@/lib/graphql/generated";

// Mock the generated GraphQL hooks
jest.mock("@/lib/graphql/generated", () => ({
  ...jest.requireActual("@/lib/graphql/generated"),
  useFiberDashboardQuery: jest.fn(),
  useFiberCableListQuery: jest.fn(),
  useFiberCableDetailQuery: jest.fn(),
  useFiberCablesByRouteQuery: jest.fn(),
  useFiberCablesByDistributionPointQuery: jest.fn(),
  useFiberHealthMetricsQuery: jest.fn(),
  useFiberNetworkAnalyticsQuery: jest.fn(),
  useSplicePointListQuery: jest.fn(),
  useSplicePointDetailQuery: jest.fn(),
  useSplicePointsByCableQuery: jest.fn(),
  useDistributionPointListQuery: jest.fn(),
  useDistributionPointDetailQuery: jest.fn(),
  useDistributionPointsBySiteQuery: jest.fn(),
  useServiceAreaListQuery: jest.fn(),
  useServiceAreaDetailQuery: jest.fn(),
  useServiceAreasByPostalCodeQuery: jest.fn(),
}));

// Test data factories
const createMockFiberCable = (overrides: any = {}) => ({
  id: "cable-001",
  cableCode: "FC-001",
  status: "ACTIVE",
  fiberType: "SINGLE_MODE",
  totalStrands: 24,
  usedStrands: 12,
  startPointId: "dp-start-001",
  endPointId: "dp-end-001",
  lengthMeters: 1000,
  installationType: "UNDERGROUND",
  ...overrides,
});

const createMockSplicePoint = (overrides: any = {}) => ({
  id: "splice-001",
  cableId: "cable-001",
  status: "ACTIVE",
  spliceType: "FUSION",
  location: { latitude: 0, longitude: 0 },
  ...overrides,
});

const createMockDistributionPoint = (overrides: any = {}) => ({
  id: "dp-001",
  pointType: "CABINET",
  status: "ACTIVE",
  siteId: "site-001",
  totalCapacity: 100,
  utilizedCapacity: 50,
  capacityUtilizationPercent: 50,
  location: { latitude: 0, longitude: 0 },
  ...overrides,
});

const createMockServiceArea = (overrides: any = {}) => ({
  id: "sa-001",
  name: "Service Area 1",
  areaType: "RESIDENTIAL",
  isServiceable: true,
  postalCodes: ["10001"],
  ...overrides,
});

const createMockHealthMetrics = (overrides: any = {}) => ({
  id: "health-001",
  cableId: "cable-001",
  healthStatus: "GOOD",
  signalLossDb: 2.5,
  recommendations: [],
  ...overrides,
});

const createMockDashboard = () => ({
  analytics: {
    totalFiberKm: 100.5,
    totalCables: 50,
    totalStrands: 1200,
    usedCapacity: 600,
    availableCapacity: 600,
    capacityUtilizationPercent: 50,
    healthyCables: 45,
    cablesByStatus: { ACTIVE: 45, INACTIVE: 5 },
    cablesByType: { SINGLE_MODE: 30, MULTI_MODE: 20 },
    networkHealthScore: 85,
    penetrationRatePercent: 65,
  },
  topCablesByUtilization: [createMockFiberCable({ id: "cable-001" })],
  topDistributionPointsByCapacity: [createMockDistributionPoint({ id: "dp-001" })],
  topServiceAreasByPenetration: [createMockServiceArea({ id: "sa-001" })],
  cablesRequiringAttention: [],
  distributionPointsNearCapacity: [],
  serviceAreasExpansionCandidates: [],
});

const createWrapper = () => createApolloWrapper();

// ============================================================================
// TESTS - FIBER DASHBOARD
// ============================================================================

describe("useFiberGraphQL - Dashboard", () => {
  const mockDashboard = createMockDashboard();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useFiberDashboardGraphQL", () => {
    it("should fetch dashboard data successfully", async () => {
      (generatedHooks.useFiberDashboardQuery as jest.Mock).mockReturnValue({
        data: { fiberDashboard: mockDashboard },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useFiberDashboardGraphQL(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.dashboard).toBeDefined();
      expect(result.current.analytics).toBeDefined();
      expect(result.current.topCables).toHaveLength(1);
      expect(result.current.topDistributionPoints).toHaveLength(1);
      expect(result.current.topServiceAreas).toHaveLength(1);
      expect(result.current.error).toBeUndefined();
    });

    it("should return analytics metrics", async () => {
      (generatedHooks.useFiberDashboardQuery as jest.Mock).mockReturnValue({
        data: { fiberDashboard: mockDashboard },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useFiberDashboardGraphQL(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.analytics).toMatchObject({
        totalFiberKm: expect.any(Number),
        totalCables: expect.any(Number),
        totalStrands: expect.any(Number),
        capacityUtilizationPercent: expect.any(Number),
      });
    });

    it("should support custom poll interval", async () => {
      const mockRefetch = jest.fn();
      (generatedHooks.useFiberDashboardQuery as jest.Mock).mockReturnValue({
        data: { fiberDashboard: mockDashboard },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useFiberDashboardGraphQL({ pollInterval: 60000 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.dashboard).toBeDefined();
      expect(generatedHooks.useFiberDashboardQuery).toHaveBeenCalledWith(
        expect.objectContaining({ pollInterval: 60000 }),
      );
    });
  });
});

// ============================================================================
// TESTS - FIBER CABLES
// ============================================================================

describe("useFiberGraphQL - Cables", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useFiberCableListGraphQL", () => {
    it("should fetch cable list successfully", async () => {
      const mockCables = [
        createMockFiberCable({ id: "cable-001" }),
        createMockFiberCable({ id: "cable-002" }),
        createMockFiberCable({ id: "cable-003" }),
      ];

      (generatedHooks.useFiberCableListQuery as jest.Mock).mockReturnValue({
        data: {
          fiberCables: {
            cables: mockCables,
            totalCount: 3,
            hasNextPage: false,
          },
        },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
        fetchMore: jest.fn(),
      });

      const { result } = renderHook(() => useFiberCableListGraphQL(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.cables).toHaveLength(3);
      expect(result.current.totalCount).toBe(3);
      expect(result.current.error).toBeUndefined();
    });

    it("should filter cables by status", async () => {
      const mockCables = [
        createMockFiberCable({ id: "cable-001", status: "ACTIVE" }),
        createMockFiberCable({ id: "cable-002", status: "ACTIVE" }),
      ];

      (generatedHooks.useFiberCableListQuery as jest.Mock).mockReturnValue({
        data: {
          fiberCables: {
            cables: mockCables,
            totalCount: 2,
            hasNextPage: false,
          },
        },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
        fetchMore: jest.fn(),
      });

      const { result } = renderHook(() => useFiberCableListGraphQL({ status: "ACTIVE" as any }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.cables).toHaveLength(2);
      expect(result.current.cables.every((c) => c.status === "ACTIVE")).toBe(true);
    });

    it("should support pagination", async () => {
      const mockCables = [
        createMockFiberCable({ id: "cable-001" }),
        createMockFiberCable({ id: "cable-002" }),
      ];

      (generatedHooks.useFiberCableListQuery as jest.Mock).mockReturnValue({
        data: {
          fiberCables: {
            cables: mockCables,
            totalCount: 3,
            hasNextPage: true,
          },
        },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
        fetchMore: jest.fn(),
      });

      const { result } = renderHook(() => useFiberCableListGraphQL({ limit: 2, offset: 0 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.cables).toHaveLength(2);
      expect(result.current.hasNextPage).toBe(true);
    });
  });

  describe("useFiberCableDetailGraphQL", () => {
    it("should fetch single cable details", async () => {
      const mockCable = createMockFiberCable({ id: "cable-001" });

      (generatedHooks.useFiberCableDetailQuery as jest.Mock).mockReturnValue({
        data: { fiberCable: mockCable },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useFiberCableDetailGraphQL("cable-001"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.cable).toBeDefined();
      expect(result.current.cable?.id).toBe("cable-001");
      expect(result.current.error).toBeUndefined();
    });

    it("should skip query when ID is undefined", async () => {
      (generatedHooks.useFiberCableDetailQuery as jest.Mock).mockReturnValue({
        data: undefined,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useFiberCableDetailGraphQL(undefined), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.cable).toBeNull();
      expect(generatedHooks.useFiberCableDetailQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      );
    });
  });

  describe("useFiberCablesByRouteGraphQL", () => {
    it("should fetch cables by route", async () => {
      const mockCables = [createMockFiberCable()];

      (generatedHooks.useFiberCablesByRouteQuery as jest.Mock).mockReturnValue({
        data: { fiberCablesByRoute: mockCables },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(
        () => useFiberCablesByRouteGraphQL("dp-start-001", "dp-end-001"),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.cables.length).toBeGreaterThanOrEqual(0);
      expect(result.current.error).toBeUndefined();
    });

    it("should skip query when IDs are undefined", async () => {
      (generatedHooks.useFiberCablesByRouteQuery as jest.Mock).mockReturnValue({
        data: undefined,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useFiberCablesByRouteGraphQL(undefined, undefined), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.cables).toEqual([]);
    });
  });

  describe("useFiberCablesByDistributionPointGraphQL", () => {
    it("should fetch cables connected to distribution point", async () => {
      const mockCables = [createMockFiberCable({ startPointId: "dp-001" })];

      (generatedHooks.useFiberCablesByDistributionPointQuery as jest.Mock).mockReturnValue({
        data: { fiberCablesByDistributionPoint: mockCables },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useFiberCablesByDistributionPointGraphQL("dp-001"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.cables.length).toBeGreaterThanOrEqual(1);
      expect(result.current.error).toBeUndefined();
    });

    it("should skip query when ID is undefined", async () => {
      (generatedHooks.useFiberCablesByDistributionPointQuery as jest.Mock).mockReturnValue({
        data: undefined,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useFiberCablesByDistributionPointGraphQL(undefined), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.cables).toEqual([]);
    });
  });
});

// ============================================================================
// TESTS - FIBER HEALTH & ANALYTICS
// ============================================================================

describe("useFiberGraphQL - Health & Analytics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useFiberHealthMetricsGraphQL", () => {
    it("should fetch health metrics successfully", async () => {
      const mockMetrics = [createMockHealthMetrics()];

      (generatedHooks.useFiberHealthMetricsQuery as jest.Mock).mockReturnValue({
        data: { fiberHealthMetrics: mockMetrics },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useFiberHealthMetricsGraphQL(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.metrics).toBeDefined();
      expect(Array.isArray(result.current.metrics)).toBe(true);
      expect(result.current.error).toBeUndefined();
    });

    it("should filter metrics by cable ID", async () => {
      const mockMetrics = [createMockHealthMetrics({ cableId: "cable-001" })];

      (generatedHooks.useFiberHealthMetricsQuery as jest.Mock).mockReturnValue({
        data: { fiberHealthMetrics: mockMetrics },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useFiberHealthMetricsGraphQL({ cableId: "cable-001" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.metrics.every((m) => m.cableId === "cable-001")).toBe(true);
    });
  });

  describe("useFiberNetworkAnalyticsGraphQL", () => {
    it("should fetch network analytics successfully", async () => {
      const mockAnalytics = {
        totalFiberKm: 100.5,
        totalCables: 50,
        totalStrands: 1200,
        usedCapacity: 600,
        availableCapacity: 600,
        capacityUtilizationPercent: 50,
        healthyCables: 45,
        cablesByStatus: {},
        cablesByType: {},
        networkHealthScore: 85,
        penetrationRatePercent: 65,
      };

      (generatedHooks.useFiberNetworkAnalyticsQuery as jest.Mock).mockReturnValue({
        data: { fiberNetworkAnalytics: mockAnalytics },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useFiberNetworkAnalyticsGraphQL(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.analytics).toBeDefined();
      expect(result.current.analytics).toHaveProperty("totalFiberKm");
      expect(result.current.analytics).toHaveProperty("totalCables");
      expect(result.current.error).toBeUndefined();
    });
  });
});

// ============================================================================
// TESTS - SPLICE POINTS
// ============================================================================

describe("useFiberGraphQL - Splice Points", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useSplicePointListGraphQL", () => {
    it("should fetch splice point list successfully", async () => {
      const mockSplices = [
        createMockSplicePoint({ id: "splice-001" }),
        createMockSplicePoint({ id: "splice-002" }),
        createMockSplicePoint({ id: "splice-003" }),
      ];

      (generatedHooks.useSplicePointListQuery as jest.Mock).mockReturnValue({
        data: {
          splicePoints: {
            splicePoints: mockSplices,
            totalCount: 3,
            hasNextPage: false,
          },
        },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useSplicePointListGraphQL(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.splicePoints).toHaveLength(3);
      expect(result.current.totalCount).toBe(3);
      expect(result.current.error).toBeUndefined();
    });

    it("should filter splice points by status", async () => {
      const mockSplices = [
        createMockSplicePoint({ id: "splice-001", status: "ACTIVE" }),
        createMockSplicePoint({ id: "splice-002", status: "ACTIVE" }),
      ];

      (generatedHooks.useSplicePointListQuery as jest.Mock).mockReturnValue({
        data: {
          splicePoints: {
            splicePoints: mockSplices,
            totalCount: 2,
            hasNextPage: false,
          },
        },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useSplicePointListGraphQL({ status: "ACTIVE" as any }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.splicePoints.every((s) => s.status === "ACTIVE")).toBe(true);
    });
  });

  describe("useSplicePointDetailGraphQL", () => {
    it("should fetch single splice point details", async () => {
      const mockSplice = createMockSplicePoint({ id: "splice-001" });

      (generatedHooks.useSplicePointDetailQuery as jest.Mock).mockReturnValue({
        data: { splicePoint: mockSplice },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useSplicePointDetailGraphQL("splice-001"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.splicePoint).toBeDefined();
      expect(result.current.splicePoint?.id).toBe("splice-001");
      expect(result.current.error).toBeUndefined();
    });

    it("should skip query when ID is undefined", async () => {
      (generatedHooks.useSplicePointDetailQuery as jest.Mock).mockReturnValue({
        data: undefined,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useSplicePointDetailGraphQL(undefined), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.splicePoint).toBeNull();
    });
  });

  describe("useSplicePointsByCableGraphQL", () => {
    it("should fetch splice points by cable", async () => {
      const mockSplices = [
        createMockSplicePoint({ cableId: "cable-001" }),
        createMockSplicePoint({ cableId: "cable-001" }),
      ];

      (generatedHooks.useSplicePointsByCableQuery as jest.Mock).mockReturnValue({
        data: { splicePointsByCable: mockSplices },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useSplicePointsByCableGraphQL("cable-001"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.splicePoints).toHaveLength(2);
      expect(result.current.splicePoints.every((s) => s.cableId === "cable-001")).toBe(true);
      expect(result.current.error).toBeUndefined();
    });

    it("should skip query when ID is undefined", async () => {
      (generatedHooks.useSplicePointsByCableQuery as jest.Mock).mockReturnValue({
        data: undefined,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useSplicePointsByCableGraphQL(undefined), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.splicePoints).toEqual([]);
    });
  });
});

// ============================================================================
// TESTS - DISTRIBUTION POINTS
// ============================================================================

describe("useFiberGraphQL - Distribution Points", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useDistributionPointListGraphQL", () => {
    it("should fetch distribution point list successfully", async () => {
      const mockDPs = [
        createMockDistributionPoint({ id: "dp-001" }),
        createMockDistributionPoint({ id: "dp-002" }),
        createMockDistributionPoint({ id: "dp-003" }),
      ];

      (generatedHooks.useDistributionPointListQuery as jest.Mock).mockReturnValue({
        data: {
          distributionPoints: {
            distributionPoints: mockDPs,
            totalCount: 3,
            hasNextPage: false,
          },
        },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useDistributionPointListGraphQL(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.distributionPoints).toHaveLength(3);
      expect(result.current.totalCount).toBe(3);
      expect(result.current.error).toBeUndefined();
    });

    it("should filter distribution points by type", async () => {
      const mockDPs = [createMockDistributionPoint({ pointType: "CABINET" })];

      (generatedHooks.useDistributionPointListQuery as jest.Mock).mockReturnValue({
        data: {
          distributionPoints: {
            distributionPoints: mockDPs,
            totalCount: 1,
            hasNextPage: false,
          },
        },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(
        () => useDistributionPointListGraphQL({ pointType: "CABINET" as any }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.distributionPoints.every((d) => d.pointType === "CABINET")).toBe(true);
    });
  });

  describe("useDistributionPointDetailGraphQL", () => {
    it("should fetch single distribution point details", async () => {
      const mockDP = createMockDistributionPoint({ id: "dp-001" });

      (generatedHooks.useDistributionPointDetailQuery as jest.Mock).mockReturnValue({
        data: { distributionPoint: mockDP },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useDistributionPointDetailGraphQL("dp-001"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.distributionPoint).toBeDefined();
      expect(result.current.distributionPoint?.id).toBe("dp-001");
      expect(result.current.error).toBeUndefined();
    });

    it("should skip query when ID is undefined", async () => {
      (generatedHooks.useDistributionPointDetailQuery as jest.Mock).mockReturnValue({
        data: undefined,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useDistributionPointDetailGraphQL(undefined), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.distributionPoint).toBeNull();
    });
  });

  describe("useDistributionPointsBySiteGraphQL", () => {
    it("should fetch distribution points by site", async () => {
      const mockDPs = [
        createMockDistributionPoint({ siteId: "site-001" }),
        createMockDistributionPoint({ siteId: "site-001" }),
      ];

      (generatedHooks.useDistributionPointsBySiteQuery as jest.Mock).mockReturnValue({
        data: { distributionPointsBySite: mockDPs },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useDistributionPointsBySiteGraphQL("site-001"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.distributionPoints).toHaveLength(2);
      expect(result.current.distributionPoints.every((d) => d.siteId === "site-001")).toBe(true);
      expect(result.current.error).toBeUndefined();
    });

    it("should skip query when ID is undefined", async () => {
      (generatedHooks.useDistributionPointsBySiteQuery as jest.Mock).mockReturnValue({
        data: undefined,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useDistributionPointsBySiteGraphQL(undefined), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.distributionPoints).toEqual([]);
    });
  });
});

// ============================================================================
// TESTS - SERVICE AREAS
// ============================================================================

describe("useFiberGraphQL - Service Areas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useServiceAreaListGraphQL", () => {
    it("should fetch service area list successfully", async () => {
      const mockAreas = [
        createMockServiceArea({ id: "sa-001" }),
        createMockServiceArea({ id: "sa-002" }),
        createMockServiceArea({ id: "sa-003" }),
      ];

      (generatedHooks.useServiceAreaListQuery as jest.Mock).mockReturnValue({
        data: {
          serviceAreas: {
            serviceAreas: mockAreas,
            totalCount: 3,
            hasNextPage: false,
          },
        },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useServiceAreaListGraphQL(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.serviceAreas).toHaveLength(3);
      expect(result.current.totalCount).toBe(3);
      expect(result.current.error).toBeUndefined();
    });

    it("should filter service areas by type", async () => {
      const mockAreas = [createMockServiceArea({ areaType: "RESIDENTIAL" })];

      (generatedHooks.useServiceAreaListQuery as jest.Mock).mockReturnValue({
        data: {
          serviceAreas: {
            serviceAreas: mockAreas,
            totalCount: 1,
            hasNextPage: false,
          },
        },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(
        () => useServiceAreaListGraphQL({ areaType: "RESIDENTIAL" as any }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.serviceAreas.every((a) => a.areaType === "RESIDENTIAL")).toBe(true);
    });
  });

  describe("useServiceAreaDetailGraphQL", () => {
    it("should fetch single service area details", async () => {
      const mockArea = createMockServiceArea({ id: "sa-001" });

      (generatedHooks.useServiceAreaDetailQuery as jest.Mock).mockReturnValue({
        data: { serviceArea: mockArea },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useServiceAreaDetailGraphQL("sa-001"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.serviceArea).toBeDefined();
      expect(result.current.serviceArea?.id).toBe("sa-001");
      expect(result.current.error).toBeUndefined();
    });

    it("should skip query when ID is undefined", async () => {
      (generatedHooks.useServiceAreaDetailQuery as jest.Mock).mockReturnValue({
        data: undefined,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useServiceAreaDetailGraphQL(undefined), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.serviceArea).toBeNull();
    });
  });

  describe("useServiceAreasByPostalCodeGraphQL", () => {
    it("should fetch service areas by postal code", async () => {
      const mockAreas = [createMockServiceArea({ postalCodes: ["10001"] })];

      (generatedHooks.useServiceAreasByPostalCodeQuery as jest.Mock).mockReturnValue({
        data: { serviceAreasByPostalCode: mockAreas },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useServiceAreasByPostalCodeGraphQL("10001"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.serviceAreas.length).toBeGreaterThan(0);
      expect(result.current.serviceAreas.every((a) => a.postalCodes?.includes("10001"))).toBe(true);
      expect(result.current.error).toBeUndefined();
    });

    it("should skip query when postal code is undefined", async () => {
      (generatedHooks.useServiceAreasByPostalCodeQuery as jest.Mock).mockReturnValue({
        data: undefined,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useServiceAreasByPostalCodeGraphQL(undefined), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.serviceAreas).toEqual([]);
    });
  });
});

// ============================================================================
// TESTS - AGGREGATED HOOKS
// ============================================================================

describe("useFiberGraphQL - Aggregated Hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useFiberCableDetailsAggregated", () => {
    it("should fetch cable details with health and splices", async () => {
      const mockCable = createMockFiberCable({ id: "cable-001" });
      const mockMetrics = [createMockHealthMetrics()];
      const mockSplices = [createMockSplicePoint(), createMockSplicePoint()];

      (generatedHooks.useFiberCableDetailQuery as jest.Mock).mockReturnValue({
        data: { fiberCable: mockCable },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      (generatedHooks.useFiberHealthMetricsQuery as jest.Mock).mockReturnValue({
        data: { fiberHealthMetrics: mockMetrics },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      (generatedHooks.useSplicePointsByCableQuery as jest.Mock).mockReturnValue({
        data: { splicePointsByCable: mockSplices },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useFiberCableDetailsAggregated("cable-001"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.cable).toBeDefined();
      expect(result.current.healthMetrics).toBeDefined();
      expect(result.current.splicePoints).toHaveLength(2);
      expect(result.current.error).toBeUndefined();
    });

    it("should provide refetch function", async () => {
      const mockRefetch1 = jest.fn();
      const mockRefetch2 = jest.fn();
      const mockRefetch3 = jest.fn();

      (generatedHooks.useFiberCableDetailQuery as jest.Mock).mockReturnValue({
        data: { fiberCable: createMockFiberCable() },
        loading: false,
        error: undefined,
        refetch: mockRefetch1,
      });

      (generatedHooks.useFiberHealthMetricsQuery as jest.Mock).mockReturnValue({
        data: { fiberHealthMetrics: [] },
        loading: false,
        error: undefined,
        refetch: mockRefetch2,
      });

      (generatedHooks.useSplicePointsByCableQuery as jest.Mock).mockReturnValue({
        data: { splicePointsByCable: [] },
        loading: false,
        error: undefined,
        refetch: mockRefetch3,
      });

      const { result } = renderHook(() => useFiberCableDetailsAggregated("cable-001"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(typeof result.current.refetch).toBe("function");

      result.current.refetch();

      expect(mockRefetch1).toHaveBeenCalled();
      expect(mockRefetch2).toHaveBeenCalled();
      expect(mockRefetch3).toHaveBeenCalled();
    });
  });

  describe("useDistributionPointDetailsAggregated", () => {
    it("should fetch distribution point with connected cables", async () => {
      const mockDP = createMockDistributionPoint({ id: "dp-001" });
      const mockCables = [createMockFiberCable({ startPointId: "dp-001" })];

      (generatedHooks.useDistributionPointDetailQuery as jest.Mock).mockReturnValue({
        data: { distributionPoint: mockDP },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      (generatedHooks.useFiberCablesByDistributionPointQuery as jest.Mock).mockReturnValue({
        data: { fiberCablesByDistributionPoint: mockCables },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useDistributionPointDetailsAggregated("dp-001"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.distributionPoint).toBeDefined();
      expect(result.current.connectedCables.length).toBeGreaterThanOrEqual(1);
      expect(result.current.error).toBeUndefined();
    });
  });

  describe("useFiberOverviewAggregated", () => {
    it("should fetch dashboard and analytics together", async () => {
      const mockDashboard = createMockDashboard();
      const mockAnalytics = mockDashboard.analytics;

      (generatedHooks.useFiberDashboardQuery as jest.Mock).mockReturnValue({
        data: { fiberDashboard: mockDashboard },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      (generatedHooks.useFiberNetworkAnalyticsQuery as jest.Mock).mockReturnValue({
        data: { fiberNetworkAnalytics: mockAnalytics },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useFiberOverviewAggregated(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.dashboard).toBeDefined();
      expect(result.current.analytics).toBeDefined();
      expect(result.current.error).toBeUndefined();
    });

    it("should provide refetch function", async () => {
      const mockRefetch1 = jest.fn();
      const mockRefetch2 = jest.fn();

      (generatedHooks.useFiberDashboardQuery as jest.Mock).mockReturnValue({
        data: { fiberDashboard: createMockDashboard() },
        loading: false,
        error: undefined,
        refetch: mockRefetch1,
      });

      (generatedHooks.useFiberNetworkAnalyticsQuery as jest.Mock).mockReturnValue({
        data: { fiberNetworkAnalytics: {} },
        loading: false,
        error: undefined,
        refetch: mockRefetch2,
      });

      const { result } = renderHook(() => useFiberOverviewAggregated(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(typeof result.current.refetch).toBe("function");

      result.current.refetch();

      expect(mockRefetch1).toHaveBeenCalled();
      expect(mockRefetch2).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// TESTS - ERROR HANDLING
// ============================================================================

describe("useFiberGraphQL - Error Handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should surface GraphQL errors for cable list hook", async () => {
    const errorMessage = "FiberCableList query failed";
    (generatedHooks.useFiberCableListQuery as jest.Mock).mockReturnValue({
      data: undefined,
      loading: false,
      error: {
        graphQLErrors: [{ message: errorMessage }],
        networkError: null,
        message: errorMessage,
      },
      refetch: jest.fn(),
      fetchMore: jest.fn(),
    });

    const { result } = renderHook(() => useFiberCableListGraphQL(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.error).toBeDefined());

    expect(result.current.error).toContain(errorMessage);
    expect(result.current.cables).toHaveLength(0);
    expect(result.current.totalCount).toBe(0);
  });
});
