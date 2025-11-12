/**
 * Tests for useSubscriberDashboardGraphQL hook
 * Tests GraphQL-powered subscriber dashboard queries
 */

import { renderHook, waitFor } from "@testing-library/react";
import {
  useSubscriberDashboardGraphQL,
  getSubscriberSessions,
  formatDataUsage,
} from "../useSubscriberDashboardGraphQL";
import { useSubscriberDashboardQuery } from "@/lib/graphql/generated";
import { logger } from "@/lib/logger";

// Mock GraphQL query
jest.mock("@/lib/graphql/generated", () => ({
  useSubscriberDashboardQuery: jest.fn(),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe("useSubscriberDashboardGraphQL", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("hook functionality", () => {
    it("should fetch subscriber dashboard data successfully", () => {
      const mockData = {
        subscribers: [
          {
            id: "1",
            username: "user1@test.com",
            sessions: [
              {
                acctsessionid: "session-1",
                nasipaddress: "10.0.0.1",
                acctstarttime: "2024-01-01T00:00:00Z",
              },
            ],
          },
          {
            id: "2",
            username: "user2@test.com",
            sessions: [],
          },
        ],
        subscriberMetrics: {
          totalCount: 100,
          enabledCount: 80,
          disabledCount: 20,
          activeSessionsCount: 50,
          totalDataUsageMb: 1024.5,
        },
      };

      (useSubscriberDashboardQuery as jest.Mock).mockReturnValue({
        data: mockData,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useSubscriberDashboardGraphQL());

      expect(result.current.subscribers).toHaveLength(2);
      expect(result.current.subscribersCount).toBe(2);
      expect(result.current.sessions).toHaveLength(1);
      expect(result.current.sessionsCount).toBe(1);
      expect(result.current.metrics.totalSubscribers).toBe(100);
      expect(result.current.metrics.enabledSubscribers).toBe(80);
      expect(result.current.metrics.disabledSubscribers).toBe(20);
      expect(result.current.metrics.activeSessions).toBe(50);
      expect(result.current.metrics.activeServices).toBe(1);
      expect(result.current.metrics.totalDataUsageMb).toBe(1024.5);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeUndefined();
    });

    it("should handle empty data", () => {
      (useSubscriberDashboardQuery as jest.Mock).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useSubscriberDashboardGraphQL());

      expect(result.current.subscribers).toEqual([]);
      expect(result.current.subscribersCount).toBe(0);
      expect(result.current.sessions).toEqual([]);
      expect(result.current.sessionsCount).toBe(0);
      expect(result.current.metrics.totalSubscribers).toBe(0);
      expect(result.current.metrics.enabledSubscribers).toBe(0);
      expect(result.current.metrics.disabledSubscribers).toBe(0);
      expect(result.current.metrics.activeSessions).toBe(0);
      expect(result.current.metrics.activeServices).toBe(0);
      expect(result.current.metrics.totalDataUsageMb).toBe(0);
    });

    it("should use custom limit", () => {
      (useSubscriberDashboardQuery as jest.Mock).mockReturnValue({
        data: { subscribers: [], subscriberMetrics: null },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      renderHook(() => useSubscriberDashboardGraphQL({ limit: 100 }));

      expect(useSubscriberDashboardQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            limit: 100,
            search: undefined,
          },
        })
      );
    });

    it("should use search parameter", () => {
      (useSubscriberDashboardQuery as jest.Mock).mockReturnValue({
        data: { subscribers: [], subscriberMetrics: null },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      renderHook(() =>
        useSubscriberDashboardGraphQL({ search: "test@example.com" })
      );

      expect(useSubscriberDashboardQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            limit: 50,
            search: "test@example.com",
          },
        })
      );
    });

    it("should skip query when enabled is false", () => {
      (useSubscriberDashboardQuery as jest.Mock).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      renderHook(() => useSubscriberDashboardGraphQL({ enabled: false }));

      expect(useSubscriberDashboardQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: true,
        })
      );
    });

    it("should enable query by default", () => {
      (useSubscriberDashboardQuery as jest.Mock).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      renderHook(() => useSubscriberDashboardGraphQL());

      expect(useSubscriberDashboardQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: false,
        })
      );
    });

    it("should set poll interval to 30 seconds", () => {
      (useSubscriberDashboardQuery as jest.Mock).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      renderHook(() => useSubscriberDashboardGraphQL());

      expect(useSubscriberDashboardQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          pollInterval: 30000,
        })
      );
    });

    it("should handle errors and log them", () => {
      const mockError = new Error("GraphQL query failed");

      (useSubscriberDashboardQuery as jest.Mock).mockReturnValue({
        data: null,
        loading: false,
        error: mockError,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useSubscriberDashboardGraphQL());

      // Call the onError callback
      const callArgs = (useSubscriberDashboardQuery as jest.Mock).mock.calls[0][0];
      callArgs.onError(mockError);

      expect(logger.error).toHaveBeenCalledWith(
        "GraphQL subscriber dashboard query failed",
        mockError
      );
      expect(result.current.error).toBe("GraphQL query failed");
    });

    it("should calculate active services count correctly", () => {
      const mockData = {
        subscribers: [
          { id: "1", username: "user1", sessions: [{ id: "s1" }] },
          { id: "2", username: "user2", sessions: [] },
          { id: "3", username: "user3", sessions: [{ id: "s2" }, { id: "s3" }] },
          { id: "4", username: "user4", sessions: [] },
        ],
        subscriberMetrics: null,
      };

      (useSubscriberDashboardQuery as jest.Mock).mockReturnValue({
        data: mockData,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useSubscriberDashboardGraphQL());

      // 2 subscribers have sessions (user1 and user3)
      expect(result.current.metrics.activeServices).toBe(2);
    });

    it("should flatten all sessions", () => {
      const mockData = {
        subscribers: [
          {
            id: "1",
            username: "user1",
            sessions: [{ id: "s1" }, { id: "s2" }],
          },
          {
            id: "2",
            username: "user2",
            sessions: [{ id: "s3" }],
          },
          {
            id: "3",
            username: "user3",
            sessions: [],
          },
        ],
        subscriberMetrics: null,
      };

      (useSubscriberDashboardQuery as jest.Mock).mockReturnValue({
        data: mockData,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useSubscriberDashboardGraphQL());

      expect(result.current.sessions).toHaveLength(3);
      expect(result.current.sessionsCount).toBe(3);
    });

    it("should expose refetch function", () => {
      const mockRefetch = jest.fn();

      (useSubscriberDashboardQuery as jest.Mock).mockReturnValue({
        data: { subscribers: [], subscriberMetrics: null },
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useSubscriberDashboardGraphQL());

      expect(result.current.refetch).toBe(mockRefetch);
    });

    it("should handle loading state", () => {
      (useSubscriberDashboardQuery as jest.Mock).mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useSubscriberDashboardGraphQL());

      expect(result.current.loading).toBe(true);
    });
  });

  describe("getSubscriberSessions helper", () => {
    it("should return sessions for matching subscriber", () => {
      const subscribers = [
        {
          username: "user1@test.com",
          sessions: [{ id: "s1" }, { id: "s2" }],
        },
        {
          username: "user2@test.com",
          sessions: [{ id: "s3" }],
        },
      ];

      const sessions = getSubscriberSessions(subscribers, "user1@test.com");

      expect(sessions).toHaveLength(2);
      expect(sessions).toEqual([{ id: "s1" }, { id: "s2" }]);
    });

    it("should return empty array for non-existent subscriber", () => {
      const subscribers = [
        {
          username: "user1@test.com",
          sessions: [{ id: "s1" }],
        },
      ];

      const sessions = getSubscriberSessions(subscribers, "nonexistent@test.com");

      expect(sessions).toEqual([]);
    });

    it("should return empty array for subscriber with no sessions", () => {
      const subscribers = [
        {
          username: "user1@test.com",
          sessions: [],
        },
      ];

      const sessions = getSubscriberSessions(subscribers, "user1@test.com");

      expect(sessions).toEqual([]);
    });
  });

  describe("formatDataUsage helper", () => {
    it("should format bytes to MB", () => {
      const input = 1024 * 1024 * 50; // 50 MB
      const output = 1024 * 1024 * 30; // 30 MB
      const result = formatDataUsage(input, output);

      expect(result).toBe("80.00 MB");
    });

    it("should format bytes to GB", () => {
      const input = 1024 * 1024 * 1024 * 2; // 2 GB
      const output = 1024 * 1024 * 1024 * 1; // 1 GB
      const result = formatDataUsage(input, output);

      expect(result).toBe("3.00 GB");
    });

    it("should handle null input", () => {
      const result = formatDataUsage(null, 1024 * 1024 * 100);

      expect(result).toBe("100.00 MB");
    });

    it("should handle null output", () => {
      const result = formatDataUsage(1024 * 1024 * 100, null);

      expect(result).toBe("100.00 MB");
    });

    it("should handle both null values", () => {
      const result = formatDataUsage(null, null);

      expect(result).toBe("0.00 MB");
    });

    it("should handle undefined values", () => {
      const result = formatDataUsage(undefined, undefined);

      expect(result).toBe("0.00 MB");
    });

    it("should format small values correctly", () => {
      const result = formatDataUsage(1024 * 512, 1024 * 512); // 1 MB

      expect(result).toBe("1.00 MB");
    });

    it("should format large values correctly", () => {
      const input = 1024 * 1024 * 1024 * 10; // 10 GB
      const output = 1024 * 1024 * 1024 * 5; // 5 GB
      const result = formatDataUsage(input, output);

      expect(result).toBe("15.00 GB");
    });
  });
});
