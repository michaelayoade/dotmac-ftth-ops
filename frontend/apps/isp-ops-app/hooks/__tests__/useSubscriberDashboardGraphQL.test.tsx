/**
 * Jest Tests for useSubscriberDashboardGraphQL Hook
 *
 * Tests the GraphQL-powered subscriber dashboard hook that replaces 3 REST API calls
 * with a single GraphQL query. Tests polling, metrics calculation, and helper functions.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { createApolloWrapper } from "@/__tests__/test-utils";
import {
  useSubscriberDashboardGraphQL,
  getSubscriberSessions,
  formatDataUsage,
} from "../useSubscriberDashboardGraphQL";
import * as generatedHooks from "@/lib/graphql/generated";
import * as serviceLifecycleHooks from "../useServiceLifecycle";

// Mock dependencies
jest.mock("@/lib/graphql/generated", () => ({
  useSubscriberDashboardQuery: jest.fn(),
}));

jest.mock("../useServiceLifecycle", () => ({
  useServiceStatistics: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Test data factories
const createMockSubscriber = (overrides: any = {}) => ({
  id: "sub-001",
  username: "user001",
  enabled: true,
  dataUsageMb: 1024,
  sessions: [],
  ...overrides,
});

const createMockSession = (overrides: any = {}) => ({
  id: "session-001",
  username: "user001",
  nasIpAddress: "192.168.1.1",
  framedIpAddress: "10.0.0.1",
  accSessionId: "acc-001",
  accStartTime: "2024-01-01T00:00:00Z",
  inputOctets: 1024000,
  outputOctets: 2048000,
  ...overrides,
});

const createMockMetrics = (overrides: any = {}) => ({
  totalCount: 100,
  enabledCount: 85,
  disabledCount: 15,
  activeSessionsCount: 50,
  totalDataUsageMb: 10240,
  ...overrides,
});

const createMockServiceStatistics = (overrides: any = {}) => ({
  total_count: 100,
  active_count: 75,
  provisioning_count: 10,
  suspended_count: 10,
  terminated_count: 5,
  ...overrides,
});

describe("useSubscriberDashboardGraphQL", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe("Basic Data Fetching", () => {
    it("should fetch subscriber dashboard data successfully", async () => {
      const mockSubscribers = [
        createMockSubscriber({
          id: "sub-001",
          username: "user001",
          sessions: [createMockSession()],
        }),
        createMockSubscriber({
          id: "sub-002",
          username: "user002",
          sessions: [],
        }),
      ];

      const mockMetrics = createMockMetrics();

      (generatedHooks.useSubscriberDashboardQuery as jest.Mock).mockReturnValue({
        data: {
          subscribers: mockSubscribers,
          subscriberMetrics: mockMetrics,
        },
        loading: false,
        error: undefined,
        refetch: jest.fn().mockResolvedValue({
          data: { subscribers: mockSubscribers, subscriberMetrics: mockMetrics },
        }),
      });

      (serviceLifecycleHooks.useServiceStatistics as jest.Mock).mockReturnValue({
        data: undefined,
        error: undefined,
      });

      const { result } = renderHook(() => useSubscriberDashboardGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.subscribers).toEqual(mockSubscribers);
      expect(result.current.subscribersCount).toBe(2);
      expect(result.current.sessionsCount).toBe(1);
      expect(result.current.metrics.totalSubscribers).toBe(100);
      expect(result.current.metrics.enabledSubscribers).toBe(85);
      expect(result.current.metrics.activeSessions).toBe(50);
    });

    it("should handle empty subscriber data", async () => {
      const emptyMetrics = createMockMetrics({ totalCount: 0 });
      (generatedHooks.useSubscriberDashboardQuery as jest.Mock).mockReturnValue({
        data: {
          subscribers: [],
          subscriberMetrics: emptyMetrics,
        },
        loading: false,
        error: undefined,
        refetch: jest
          .fn()
          .mockResolvedValue({ data: { subscribers: [], subscriberMetrics: emptyMetrics } }),
      });

      (serviceLifecycleHooks.useServiceStatistics as jest.Mock).mockReturnValue({
        data: undefined,
        error: undefined,
      });

      const { result } = renderHook(() => useSubscriberDashboardGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.subscribers).toEqual([]);
      expect(result.current.subscribersCount).toBe(0);
      expect(result.current.sessionsCount).toBe(0);
    });

    it("should handle GraphQL errors", async () => {
      const mockError = new Error("GraphQL query failed");

      (generatedHooks.useSubscriberDashboardQuery as jest.Mock).mockReturnValue({
        data: undefined,
        loading: false,
        error: mockError,
        refetch: jest.fn().mockResolvedValue({ data: undefined }),
      });

      (serviceLifecycleHooks.useServiceStatistics as jest.Mock).mockReturnValue({
        data: undefined,
        error: undefined,
      });

      const { result } = renderHook(() => useSubscriberDashboardGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBe("GraphQL query failed");
      });
    });
  });

  describe("Query Options", () => {
    it("should respect the limit option", async () => {
      const mockRefetch = jest.fn().mockResolvedValue({ data: undefined });

      (generatedHooks.useSubscriberDashboardQuery as jest.Mock).mockReturnValue({
        data: { subscribers: [], subscriberMetrics: createMockMetrics() },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      (serviceLifecycleHooks.useServiceStatistics as jest.Mock).mockReturnValue({
        data: undefined,
        error: undefined,
      });

      renderHook(() => useSubscriberDashboardGraphQL({ limit: 100 }), {
        wrapper: createApolloWrapper(),
      });

      expect(generatedHooks.useSubscriberDashboardQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            limit: 100,
            search: undefined,
          },
        }),
      );
    });

    it("should respect the search option", async () => {
      (generatedHooks.useSubscriberDashboardQuery as jest.Mock).mockReturnValue({
        data: { subscribers: [], subscriberMetrics: createMockMetrics() },
        loading: false,
        error: undefined,
        refetch: jest.fn().mockResolvedValue({ data: undefined }),
      });

      (serviceLifecycleHooks.useServiceStatistics as jest.Mock).mockReturnValue({
        data: undefined,
        error: undefined,
      });

      renderHook(() => useSubscriberDashboardGraphQL({ search: "user001" }), {
        wrapper: createApolloWrapper(),
      });

      expect(generatedHooks.useSubscriberDashboardQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            limit: 50,
            search: "user001",
          },
        }),
      );
    });

    it("should respect the enabled option", () => {
      (generatedHooks.useSubscriberDashboardQuery as jest.Mock).mockReturnValue({
        data: undefined,
        loading: false,
        error: undefined,
        refetch: jest.fn().mockResolvedValue({ data: undefined }),
      });

      (serviceLifecycleHooks.useServiceStatistics as jest.Mock).mockReturnValue({
        data: undefined,
        error: undefined,
      });

      renderHook(() => useSubscriberDashboardGraphQL({ enabled: false }), {
        wrapper: createApolloWrapper(),
      });

      expect(generatedHooks.useSubscriberDashboardQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: true,
        }),
      );
    });
  });

  describe("Lifecycle Metrics Integration", () => {
    it("should fetch lifecycle statistics when enabled", async () => {
      const mockServiceStats = createMockServiceStatistics({ active_count: 60 });

      (generatedHooks.useSubscriberDashboardQuery as jest.Mock).mockReturnValue({
        data: {
          subscribers: [createMockSubscriber({ sessions: [createMockSession()] })],
          subscriberMetrics: createMockMetrics(),
        },
        loading: false,
        error: undefined,
        refetch: jest.fn().mockResolvedValue({ data: undefined }),
      });

      (serviceLifecycleHooks.useServiceStatistics as jest.Mock).mockReturnValue({
        data: mockServiceStats,
        error: undefined,
      });

      const { result } = renderHook(
        () => useSubscriberDashboardGraphQL({ lifecycleMetricsEnabled: true }),
        { wrapper: createApolloWrapper() },
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(serviceLifecycleHooks.useServiceStatistics).toHaveBeenCalledWith({
        enabled: true,
      });
      expect(result.current.metrics.activeServices).toBe(60);
    });

    it("should fall back to session-based active services count when lifecycle stats unavailable", async () => {
      (generatedHooks.useSubscriberDashboardQuery as jest.Mock).mockReturnValue({
        data: {
          subscribers: [
            createMockSubscriber({ id: "sub-001", sessions: [createMockSession()] }),
            createMockSubscriber({ id: "sub-002", sessions: [] }),
            createMockSubscriber({ id: "sub-003", sessions: [createMockSession()] }),
          ],
          subscriberMetrics: createMockMetrics(),
        },
        loading: false,
        error: undefined,
        refetch: jest.fn().mockResolvedValue({ data: undefined }),
      });

      (serviceLifecycleHooks.useServiceStatistics as jest.Mock).mockReturnValue({
        data: undefined,
        error: undefined,
      });

      const { result } = renderHook(() => useSubscriberDashboardGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should count subscribers with active sessions
      expect(result.current.metrics.activeServices).toBe(2);
    });
  });

  describe("Polling Functionality", () => {
    it("should poll at the specified interval when enabled", async () => {
      const mockRefetch = jest.fn(() => Promise.resolve({ data: {} }));

      (generatedHooks.useSubscriberDashboardQuery as jest.Mock).mockReturnValue({
        data: { subscribers: [], subscriberMetrics: createMockMetrics() },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      (serviceLifecycleHooks.useServiceStatistics as jest.Mock).mockReturnValue({
        data: undefined,
        error: undefined,
      });

      renderHook(
        () =>
          useSubscriberDashboardGraphQL({
            pollingEnabled: true,
            pollingIntervalMs: 10000,
          }),
        { wrapper: createApolloWrapper() },
      );

      // Fast-forward time by 10 seconds
      await act(async () => {
        jest.advanceTimersByTime(10000);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
      });
    });

    it("should not poll when pollingEnabled is false", async () => {
      const mockRefetch = jest.fn(() => Promise.resolve({ data: {} }));

      (generatedHooks.useSubscriberDashboardQuery as jest.Mock).mockReturnValue({
        data: { subscribers: [], subscriberMetrics: createMockMetrics() },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      (serviceLifecycleHooks.useServiceStatistics as jest.Mock).mockReturnValue({
        data: undefined,
        error: undefined,
      });

      renderHook(() => useSubscriberDashboardGraphQL({ pollingEnabled: false }), {
        wrapper: createApolloWrapper(),
      });

      await act(async () => {
        jest.advanceTimersByTime(30000);
        await Promise.resolve();
      });

      expect(mockRefetch).not.toHaveBeenCalled();
    });

    it("should not poll when enabled is false", async () => {
      const mockRefetch = jest.fn(() => Promise.resolve({ data: {} }));

      (generatedHooks.useSubscriberDashboardQuery as jest.Mock).mockReturnValue({
        data: { subscribers: [], subscriberMetrics: createMockMetrics() },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      (serviceLifecycleHooks.useServiceStatistics as jest.Mock).mockReturnValue({
        data: undefined,
        error: undefined,
      });

      renderHook(() => useSubscriberDashboardGraphQL({ enabled: false }), {
        wrapper: createApolloWrapper(),
      });

      await act(async () => {
        jest.advanceTimersByTime(30000);
        await Promise.resolve();
      });

      expect(mockRefetch).not.toHaveBeenCalled();
    });
  });

  describe("Sessions Aggregation", () => {
    it("should flatten all sessions from subscribers", async () => {
      const mockSubscribers = [
        createMockSubscriber({
          username: "user001",
          sessions: [
            createMockSession({ id: "session-001" }),
            createMockSession({ id: "session-002" }),
          ],
        }),
        createMockSubscriber({
          username: "user002",
          sessions: [createMockSession({ id: "session-003" })],
        }),
      ];

      (generatedHooks.useSubscriberDashboardQuery as jest.Mock).mockReturnValue({
        data: { subscribers: mockSubscribers, subscriberMetrics: createMockMetrics() },
        loading: false,
        error: undefined,
        refetch: jest.fn().mockResolvedValue({ data: undefined }),
      });

      (serviceLifecycleHooks.useServiceStatistics as jest.Mock).mockReturnValue({
        data: undefined,
        error: undefined,
      });

      const { result } = renderHook(() => useSubscriberDashboardGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.sessions).toHaveLength(3);
      expect(result.current.sessionsCount).toBe(3);
    });
  });
});

describe("Helper Functions", () => {
  describe("getSubscriberSessions", () => {
    it("should return sessions for a specific subscriber", () => {
      const subscribers = [
        {
          username: "user001",
          sessions: [
            createMockSession({ id: "session-001" }),
            createMockSession({ id: "session-002" }),
          ],
        },
        {
          username: "user002",
          sessions: [createMockSession({ id: "session-003" })],
        },
      ];

      const sessions = getSubscriberSessions(subscribers, "user001");

      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe("session-001");
    });

    it("should return empty array for non-existent subscriber", () => {
      const subscribers = [{ username: "user001", sessions: [createMockSession()] }];

      const sessions = getSubscriberSessions(subscribers, "nonexistent");

      expect(sessions).toEqual([]);
    });
  });

  describe("formatDataUsage", () => {
    it("should format data usage in MB when less than 1024 MB", () => {
      const result = formatDataUsage(512 * 1024 * 1024, 256 * 1024 * 1024);
      expect(result).toBe("768.00 MB");
    });

    it("should format data usage in GB when 1024 MB or more", () => {
      const result = formatDataUsage(1024 * 1024 * 1024, 1024 * 1024 * 1024);
      expect(result).toBe("2.00 GB");
    });

    it("should handle null values", () => {
      const result = formatDataUsage(null, null);
      expect(result).toBe("0.00 MB");
    });

    it("should handle undefined values", () => {
      const result = formatDataUsage(undefined, undefined);
      expect(result).toBe("0.00 MB");
    });

    it("should handle mixed null and valid values", () => {
      const result = formatDataUsage(512 * 1024 * 1024, null);
      expect(result).toBe("512.00 MB");
    });
  });
});
