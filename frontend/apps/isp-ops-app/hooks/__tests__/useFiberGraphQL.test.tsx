/**
 * Tests for useFiberGraphQL hooks
 *
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from "@testing-library/react";
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { ReactNode } from "react";
import {
  useFiberDashboardGraphQL,
  useFiberCableListGraphQL,
  useFiberCableDetailGraphQL,
  useFiberHealthMetricsGraphQL,
} from "../useFiberGraphQL";
import {
  FiberDashboardDocument,
  FiberCableListDocument,
  FiberCableDetailDocument,
  FiberHealthMetricsDocument,
} from "@/lib/graphql/generated";

// Mock wrapper component with configurable mocks
function createMockWrapper(mocks: MockedResponse[] = []) {
  return function MockWrapper({ children }: { children: ReactNode }) {
    return (
      <MockedProvider mocks={mocks} addTypename={false}>
        {children}
      </MockedProvider>
    );
  };
}

// Mock data fixtures
const mockDashboardData = {
  fiberDashboard: {
    id: "dashboard-1",
    totalCables: 150,
    activeCables: 140,
    faultyCables: 10,
    averageHealth: 95.5,
  },
};

const mockCablesData = {
  fiberCables: {
    cables: [
      {
        id: "cable-1",
        name: "Cable A",
        status: "ACTIVE",
        health: 98.5,
      },
      {
        id: "cable-2",
        name: "Cable B",
        status: "ACTIVE",
        health: 96.2,
      },
    ],
    totalCount: 2,
    hasNextPage: false,
  },
};

const mockCableDetailData = {
  fiberCable: {
    id: "cable-123",
    name: "Test Cable",
    status: "ACTIVE",
    health: 97.8,
    length: 5000,
    fiberCount: 24,
  },
};

const mockHealthMetricsData = {
  fiberHealthMetrics: [
    {
      id: "metric-1",
      timestamp: "2025-01-01T00:00:00Z",
      health: 98.5,
      temperature: 25.5,
      power: -10.5,
    },
    {
      id: "metric-2",
      timestamp: "2025-01-01T01:00:00Z",
      health: 97.8,
      temperature: 26.0,
      power: -11.0,
    },
  ],
};

describe("useFiberGraphQL", () => {
  describe("useFiberDashboardGraphQL", () => {
    it("should initialize with loading state", () => {
      const { result } = renderHook(() => useFiberDashboardGraphQL(), {
        wrapper: createMockWrapper([]),
      });

      // Note: Only tests initial state with empty mocks
      expect(result.current.loading).toBe(true);
      expect(result.current.dashboard).toBeNull();
      expect(result.current.error).toBeUndefined();
    });

    it("should load and return dashboard data", async () => {
      // Create mock with actual response
      const mocks: MockedResponse[] = [
        {
          request: {
            query: FiberDashboardDocument,
          },
          result: {
            data: mockDashboardData,
          },
        },
      ];

      const { result } = renderHook(() => useFiberDashboardGraphQL(), {
        wrapper: createMockWrapper(mocks),
      });

      // Initial state
      expect(result.current.loading).toBe(true);

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Assert on actual data
      expect(result.current.dashboard).toEqual(mockDashboardData.fiberDashboard);
      expect(result.current.error).toBeUndefined();
    });

    it("should provide refetch function", () => {
      const { result } = renderHook(() => useFiberDashboardGraphQL(), {
        wrapper: createMockWrapper([]),
      });

      expect(typeof result.current.refetch).toBe("function");
    });
  });

  describe("useFiberCableListGraphQL", () => {
    it("should initialize with empty cables array", () => {
      const { result } = renderHook(() => useFiberCableListGraphQL(), {
        wrapper: createMockWrapper([]),
      });

      // Note: Only tests initial state with empty mocks
      expect(result.current.cables).toEqual([]);
      expect(result.current.totalCount).toBe(0);
      expect(result.current.hasNextPage).toBe(false);
    });

    it("should accept filter options", () => {
      const { result } = renderHook(
        () =>
          useFiberCableListGraphQL({
            limit: 25,
            offset: 50,
            search: "test",
          }),
        {
          wrapper: createMockWrapper([]),
        },
      );

      // Note: Only tests initial loading state
      expect(result.current.loading).toBe(true);
    });

    it("should load and return cables list", async () => {
      // Create mock with actual response
      const mocks: MockedResponse[] = [
        {
          request: {
            query: FiberCableListDocument,
            variables: {
              limit: 50,
              offset: 0,
            },
          },
          result: {
            data: mockCablesData,
          },
        },
      ];

      const { result } = renderHook(() => useFiberCableListGraphQL(), {
        wrapper: createMockWrapper(mocks),
      });

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.cables.length).toBeGreaterThan(0);
      });

      // Assert on actual data
      expect(result.current.cables).toHaveLength(2);
      expect(result.current.cables[0]).toMatchObject({
        id: "cable-1",
        name: "Cable A",
        status: "ACTIVE",
      });
      expect(result.current.totalCount).toBe(2);
      expect(result.current.hasNextPage).toBe(false);
    });

    it("should provide fetchMore function", () => {
      const { result } = renderHook(() => useFiberCableListGraphQL(), {
        wrapper: createMockWrapper([]),
      });

      expect(typeof result.current.fetchMore).toBe("function");
    });
  });

  describe("useFiberCableDetailGraphQL", () => {
    it("should skip query when cableId is undefined", () => {
      const { result } = renderHook(() => useFiberCableDetailGraphQL(undefined), {
        wrapper: createMockWrapper([]),
      });

      expect(result.current.cable).toBeNull();
    });

    it("should query when cableId is provided", () => {
      const { result } = renderHook(() => useFiberCableDetailGraphQL("cable-123"), {
        wrapper: createMockWrapper([]),
      });

      // Note: Only tests initial loading state
      expect(result.current.loading).toBe(true);
    });

    it("should load and return cable detail", async () => {
      // Create mock with actual response
      const mocks: MockedResponse[] = [
        {
          request: {
            query: FiberCableDetailDocument,
            variables: { id: "cable-123" },
          },
          result: {
            data: mockCableDetailData,
          },
        },
      ];

      const { result } = renderHook(() => useFiberCableDetailGraphQL("cable-123"), {
        wrapper: createMockWrapper(mocks),
      });

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Assert on actual data
      expect(result.current.cable).toMatchObject({
        id: "cable-123",
        name: "Test Cable",
        status: "ACTIVE",
        health: 97.8,
      });
      expect(result.current.error).toBeUndefined();
    });
  });

  describe("useFiberHealthMetricsGraphQL", () => {
    it("should initialize with empty metrics", () => {
      const { result } = renderHook(() => useFiberHealthMetricsGraphQL(), {
        wrapper: createMockWrapper([]),
      });

      // Note: Only tests initial state with empty mocks
      expect(result.current.metrics).toEqual([]);
    });

    it("should accept filter options", () => {
      const { result } = renderHook(
        () =>
          useFiberHealthMetricsGraphQL({
            cableId: "cable-123",
            pollInterval: 60000,
          }),
        {
          wrapper: createMockWrapper([]),
        },
      );

      // Note: Only tests initial loading state
      expect(result.current.loading).toBe(true);
    });

    it("should load and return health metrics", async () => {
      // Create mock with actual response
      const mocks: MockedResponse[] = [
        {
          request: {
            query: FiberHealthMetricsDocument,
            variables: { cableId: "cable-123" },
          },
          result: {
            data: mockHealthMetricsData,
          },
        },
      ];

      const { result } = renderHook(
        () =>
          useFiberHealthMetricsGraphQL({
            cableId: "cable-123",
          }),
        {
          wrapper: createMockWrapper(mocks),
        },
      );

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.metrics.length).toBeGreaterThan(0);
      });

      // Assert on actual data
      expect(result.current.metrics).toHaveLength(2);
      expect(result.current.metrics[0]).toMatchObject({
        id: "metric-1",
        health: 98.5,
        temperature: 25.5,
      });
    });
  });
});
