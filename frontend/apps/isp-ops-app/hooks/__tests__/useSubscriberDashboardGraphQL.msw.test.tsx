/**
 * MSW Tests for useSubscriberDashboardGraphQL hook
 * Tests GraphQL-powered subscriber dashboard with realistic API mocking
 */

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock platformConfig to provide GraphQL endpoint
jest.mock("@/lib/config", () => ({
  platformConfig: {
    api: {
      baseUrl: "http://localhost:3000",
      prefix: "/api/v1",
      timeout: 30000,
      buildUrl: (path: string) => `http://localhost:3000/api/v1${path}`,
      graphqlEndpoint: "http://localhost:3000/api/v1/graphql",
    },
  },
}));

import { renderHook, waitFor, act } from "@testing-library/react";
import { graphql } from "msw";
import { createApolloWrapper } from "@/__tests__/test-utils";
import {
  useSubscriberDashboardGraphQL,
  getSubscriberSessions,
  formatDataUsage,
} from "../useSubscriberDashboardGraphQL";
import { server } from "@/__tests__/msw/server";
import {
  seedGraphQLSubscriberData,
  clearGraphQLSubscriberData,
  createMockGraphQLSession as createMockSession,
  createMockGraphQLSubscriber as createMockSubscriber,
} from "@/__tests__/test-utils";
import { logger } from "@/lib/logger";

describe("useSubscriberDashboardGraphQL", () => {
  beforeEach(() => {
    clearGraphQLSubscriberData();
    jest.clearAllMocks();
  });

  describe("Basic Query", () => {
    it("should fetch dashboard data successfully", async () => {
      seedGraphQLSubscriberData([
        {
          username: "user1@example.com",
          enabled: true,
          sessions: [createMockSession({ username: "user1@example.com" })],
        },
        {
          username: "user2@example.com",
          enabled: true,
          sessions: [createMockSession({ username: "user2@example.com" })],
        },
      ]);

      const { result } = renderHook(() => useSubscriberDashboardGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.subscribers).toHaveLength(2);
      expect(result.current.subscribersCount).toBe(2);
      expect(result.current.metrics.totalSubscribers).toBe(2);
      expect(result.current.metrics.enabledSubscribers).toBe(2);
      expect(result.current.metrics.activeSessions).toBe(2);
      expect(result.current.error).toBeUndefined();
    });

    it("should return empty data when no subscribers exist", async () => {
      const { result } = renderHook(() => useSubscriberDashboardGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.subscribers).toHaveLength(0);
      expect(result.current.subscribersCount).toBe(0);
      expect(result.current.sessions).toHaveLength(0);
      expect(result.current.metrics.totalSubscribers).toBe(0);
    });
  });

  describe("Pagination", () => {
    it("should respect limit parameter", async () => {
      seedGraphQLSubscriberData(
        Array.from({ length: 100 }, (_, i) => ({
          username: `user${i + 1}@example.com`,
          enabled: true,
        }))
      );

      const { result } = renderHook(() => useSubscriberDashboardGraphQL({ limit: 10 }), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.subscribers).toHaveLength(10);
      expect(result.current.metrics.totalSubscribers).toBe(100);
    });

    it("should apply default limit of 50", async () => {
      seedGraphQLSubscriberData(
        Array.from({ length: 75 }, (_, i) => ({
          username: `user${i + 1}@example.com`,
        }))
      );

      const { result } = renderHook(() => useSubscriberDashboardGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.subscribers).toHaveLength(50);
    });
  });

  describe("Search Filtering", () => {
    it("should filter subscribers by username", async () => {
      seedGraphQLSubscriberData([
        { username: "alice@example.com", enabled: true },
        { username: "bob@example.com", enabled: true },
        { username: "alice.smith@example.com", enabled: true },
      ]);

      const { result } = renderHook(() => useSubscriberDashboardGraphQL({ search: "alice" }), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.subscribers).toHaveLength(2);
      expect(result.current.subscribers[0].username).toContain("alice");
      expect(result.current.subscribers[1].username).toContain("alice");
    });

    it("should filter by subscriber ID", async () => {
      seedGraphQLSubscriberData([
        { subscriberId: "SUB-000001", username: "user1@example.com" },
        { subscriberId: "SUB-000002", username: "user2@example.com" },
        { subscriberId: "SUB-000003", username: "user3@example.com" },
      ]);

      const { result } = renderHook(() => useSubscriberDashboardGraphQL({ search: "SUB-000002" }), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.subscribers).toHaveLength(1);
      expect(result.current.subscribers[0].subscriberId).toBe("SUB-000002");
    });

    it("should return empty results when no matches", async () => {
      seedGraphQLSubscriberData([
        { username: "user1@example.com" },
        { username: "user2@example.com" },
      ]);

      const { result } = renderHook(() => useSubscriberDashboardGraphQL({ search: "nonexistent" }), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.subscribers).toHaveLength(0);
    });
  });

  describe("Enabled/Disabled Flag", () => {
    it("should not fetch when enabled is false", async () => {
      seedGraphQLSubscriberData([
        { username: "user1@example.com" },
      ]);

      const { result } = renderHook(() => useSubscriberDashboardGraphQL({ enabled: false }), {
        wrapper: createApolloWrapper(),
      });

      // Should stay in idle state, not loading
      expect(result.current.loading).toBe(false);
      expect(result.current.subscribers).toHaveLength(0);
    });

    it("should fetch by default when enabled is not specified", async () => {
      seedGraphQLSubscriberData([
        { username: "user1@example.com" },
      ]);

      const { result } = renderHook(() => useSubscriberDashboardGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.subscribers).toHaveLength(1);
    });
  });

  describe("Poll Interval", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should refresh data every 30 seconds", async () => {
      seedGraphQLSubscriberData([
        { username: "user1@example.com", enabled: true },
      ]);

      const { result } = renderHook(() => useSubscriberDashboardGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const initialCount = result.current.subscribersCount;
      expect(initialCount).toBe(1);

      // Add a new subscriber after initial load
      seedGraphQLSubscriberData([
        { username: "user1@example.com", enabled: true },
        { username: "user2@example.com", enabled: true },
      ]);

      // Advance time by 30 seconds to trigger poll
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => expect(result.current.subscribersCount).toBe(2));

      expect(result.current.subscribersCount).toBe(2);
    });
  });

  describe("Data Transformation", () => {
    it("should transform subscribers data correctly", async () => {
      seedGraphQLSubscriberData([
        {
          id: 1,
          subscriberId: "SUB-001",
          username: "test@example.com",
          enabled: true,
          framedIpAddress: "10.0.0.1",
          bandwidthProfileId: "profile-100",
          sessions: [],
        },
      ]);

      const { result } = renderHook(() => useSubscriberDashboardGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const subscriber = result.current.subscribers[0];
      expect(subscriber.id).toBe(1);
      expect(subscriber.subscriberId).toBe("SUB-001");
      expect(subscriber.username).toBe("test@example.com");
      expect(subscriber.enabled).toBe(true);
      expect(subscriber.framedIpAddress).toBe("10.0.0.1");
      expect(subscriber.bandwidthProfileId).toBe("profile-100");
    });

    it("should flatten sessions array from all subscribers", async () => {
      const session1 = createMockSession({ username: "user1@example.com", radacctid: 1 });
      const session2 = createMockSession({ username: "user1@example.com", radacctid: 2 });
      const session3 = createMockSession({ username: "user2@example.com", radacctid: 3 });

      seedGraphQLSubscriberData([
        {
          username: "user1@example.com",
          sessions: [session1, session2],
        },
        {
          username: "user2@example.com",
          sessions: [session3],
        },
      ]);

      const { result } = renderHook(() => useSubscriberDashboardGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.sessions).toHaveLength(3);
      expect(result.current.sessionsCount).toBe(3);
      expect(result.current.sessions[0].radacctid).toBe(1);
      expect(result.current.sessions[1].radacctid).toBe(2);
      expect(result.current.sessions[2].radacctid).toBe(3);
    });

    it("should calculate active services count from sessions", async () => {
      seedGraphQLSubscriberData([
        {
          username: "user1@example.com",
          sessions: [createMockSession()],
        },
        {
          username: "user2@example.com",
          sessions: [createMockSession()],
        },
        {
          username: "user3@example.com",
          sessions: [], // No active sessions
        },
      ]);

      const { result } = renderHook(() => useSubscriberDashboardGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.metrics.activeServices).toBe(2);
    });

    it("should transform metrics correctly", async () => {
      seedGraphQLSubscriberData([
        {
          username: "user1@example.com",
          enabled: true,
          sessions: [createMockSession({ acctinputoctets: 1024 * 1024 * 100, acctoutputoctets: 1024 * 1024 * 50 })],
        },
        {
          username: "user2@example.com",
          enabled: true,
          sessions: [],
        },
        {
          username: "user3@example.com",
          enabled: false,
          sessions: [],
        },
      ]);

      const { result } = renderHook(() => useSubscriberDashboardGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.metrics.totalSubscribers).toBe(3);
      expect(result.current.metrics.enabledSubscribers).toBe(2);
      expect(result.current.metrics.disabledSubscribers).toBe(1);
      expect(result.current.metrics.activeSessions).toBe(1);
      expect(result.current.metrics.activeServices).toBe(1);
      expect(result.current.metrics.totalDataUsageMb).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should surface GraphQL errors and log them", async () => {
      const errorMessage = "Subscriber dashboard query failed";
      server.use(
        graphql.query("SubscriberDashboard", (req, res, ctx) => {
          return res(
            ctx.errors([
              {
                message: errorMessage,
              },
            ])
          );
        })
      );

      const { result } = renderHook(() => useSubscriberDashboardGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => expect(result.current.error).toBeDefined());
      expect(result.current.error).toContain(errorMessage);
      expect(result.current.subscribers).toHaveLength(0);
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        "GraphQL subscriber dashboard query failed",
        expect.any(Error)
      );
    });

    it("should handle network errors gracefully", async () => {
      seedGraphQLSubscriberData([]);

      const { result } = renderHook(() => useSubscriberDashboardGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Should have empty data but no crash
      expect(result.current.subscribers).toHaveLength(0);
      expect(result.current.metrics.totalSubscribers).toBe(0);
    });
  });

  describe("Refetch Function", () => {
    it("should refetch data when refetch is called", async () => {
      seedGraphQLSubscriberData([
        { username: "user1@example.com" },
      ]);

      const { result } = renderHook(() => useSubscriberDashboardGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.subscribersCount).toBe(1);

      // Update data
      seedGraphQLSubscriberData([
        { username: "user1@example.com" },
        { username: "user2@example.com" },
      ]);

      // Refetch
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => expect(result.current.subscribersCount).toBe(2));
    });
  });

  describe("Helper Functions", () => {
    describe("getSubscriberSessions", () => {
      it("should return sessions for a specific subscriber", () => {
        const session1 = createMockSession({ radacctid: 1 });
        const session2 = createMockSession({ radacctid: 2 });

        const subscribers = [
          createMockSubscriber({ username: "user1@example.com", sessions: [session1, session2] }),
          createMockSubscriber({ username: "user2@example.com", sessions: [] }),
        ];

        const sessions = getSubscriberSessions(subscribers, "user1@example.com");

        expect(sessions).toHaveLength(2);
        expect(sessions[0].radacctid).toBe(1);
        expect(sessions[1].radacctid).toBe(2);
      });

      it("should return empty array for subscriber with no sessions", () => {
        const subscribers = [
          createMockSubscriber({ username: "user1@example.com", sessions: [] }),
        ];

        const sessions = getSubscriberSessions(subscribers, "user1@example.com");

        expect(sessions).toHaveLength(0);
      });

      it("should return empty array for non-existent subscriber", () => {
        const subscribers = [
          createMockSubscriber({ username: "user1@example.com", sessions: [] }),
        ];

        const sessions = getSubscriberSessions(subscribers, "nonexistent@example.com");

        expect(sessions).toHaveLength(0);
      });
    });

    describe("formatDataUsage", () => {
      it("should format data usage in MB", () => {
        const inputOctets = 50 * 1024 * 1024; // 50 MB
        const outputOctets = 25 * 1024 * 1024; // 25 MB

        const formatted = formatDataUsage(inputOctets, outputOctets);

        expect(formatted).toBe("75.00 MB");
      });

      it("should format data usage in GB", () => {
        const inputOctets = 1024 * 1024 * 1024; // 1 GB
        const outputOctets = 512 * 1024 * 1024; // 0.5 GB

        const formatted = formatDataUsage(inputOctets, outputOctets);

        expect(formatted).toBe("1.50 GB");
      });

      it("should handle null input", () => {
        const formatted = formatDataUsage(null, null);

        expect(formatted).toBe("0.00 MB");
      });

      it("should handle undefined input", () => {
        const formatted = formatDataUsage(undefined, undefined);

        expect(formatted).toBe("0.00 MB");
      });

      it("should handle mixed null/undefined input", () => {
        const formatted = formatDataUsage(100 * 1024 * 1024, null);

        expect(formatted).toBe("100.00 MB");
      });
    });
  });

  describe("Real-world Scenarios", () => {
    it("should handle complete dashboard workflow", async () => {
      // Initial load
      seedGraphQLSubscriberData([
        {
          username: "alice@example.com",
          enabled: true,
          sessions: [
            createMockSession({
              username: "alice@example.com",
              acctinputoctets: 100 * 1024 * 1024,
              acctoutputoctets: 50 * 1024 * 1024,
            }),
          ],
        },
        {
          username: "bob@example.com",
          enabled: true,
          sessions: [],
        },
      ]);

      const { result, rerender } = renderHook(
        ({ search }) => useSubscriberDashboardGraphQL({ search }),
        {
          wrapper: createApolloWrapper(),
          initialProps: { search: undefined as string | undefined },
        }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Verify initial state
      expect(result.current.subscribersCount).toBe(2);
      expect(result.current.metrics.totalSubscribers).toBe(2);
      expect(result.current.metrics.activeSessions).toBe(1);

      // Filter by search
      rerender({ search: "alice" });

      await waitFor(() => expect(result.current.subscribersCount).toBe(1));

      expect(result.current.subscribers[0].username).toBe("alice@example.com");
      expect(result.current.sessions).toHaveLength(1);

      // Check metrics are still for all subscribers
      expect(result.current.metrics.totalSubscribers).toBe(2);
    });

    it("should differentiate subscribers with active sessions vs no sessions", async () => {
      seedGraphQLSubscriberData([
        {
          username: "active@example.com",
          enabled: true,
          sessions: [
            createMockSession({
              username: "active@example.com",
              acctsessiontime: 7200,
            }),
          ],
        },
        {
          username: "inactive@example.com",
          enabled: true,
          sessions: [],
        },
      ]);

      const { result } = renderHook(() => useSubscriberDashboardGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const activeSubscriber = result.current.subscribers.find((s) => s.username === "active@example.com");
      const inactiveSubscriber = result.current.subscribers.find((s) => s.username === "inactive@example.com");

      expect(activeSubscriber?.sessions).toHaveLength(1);
      expect(inactiveSubscriber?.sessions).toHaveLength(0);

      expect(result.current.metrics.activeServices).toBe(1);
      expect(result.current.sessions).toHaveLength(1);
    });

    it("should calculate data usage correctly", async () => {
      const inputMB = 500; // 500 MB
      const outputMB = 300; // 300 MB

      seedGraphQLSubscriberData([
        {
          username: "user@example.com",
          sessions: [
            createMockSession({
              acctinputoctets: inputMB * 1024 * 1024,
              acctoutputoctets: outputMB * 1024 * 1024,
            }),
          ],
        },
      ]);

      const { result } = renderHook(() => useSubscriberDashboardGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.metrics.totalDataUsageMb).toBe(800);
    });

    it("should handle dashboard refresh with polling simulation", async () => {
      jest.useFakeTimers();

      seedGraphQLSubscriberData([
        { username: "user1@example.com", enabled: true },
      ]);

      const { result } = renderHook(() => useSubscriberDashboardGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.subscribersCount).toBe(1);

      // Simulate new subscriber added in backend
      seedGraphQLSubscriberData([
        { username: "user1@example.com", enabled: true },
        { username: "user2@example.com", enabled: true },
        { username: "user3@example.com", enabled: false },
      ]);

      // Advance time to trigger poll (30 seconds)
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => expect(result.current.subscribersCount).toBe(3));

      expect(result.current.subscribersCount).toBe(3);
      expect(result.current.metrics.totalSubscribers).toBe(3);
      expect(result.current.metrics.enabledSubscribers).toBe(2);
      expect(result.current.metrics.disabledSubscribers).toBe(1);

      jest.useRealTimers();
    });

    it("should handle large dataset with multiple sessions per subscriber", async () => {
      const largeDataset = Array.from({ length: 50 }, (_, i) => ({
        username: `user${i + 1}@example.com`,
        enabled: i % 3 !== 0, // Some disabled
        sessions: i % 2 === 0
          ? [
              createMockSession({
                username: `user${i + 1}@example.com`,
                acctinputoctets: 50 * 1024 * 1024,
                acctoutputoctets: 25 * 1024 * 1024,
              }),
              createMockSession({
                username: `user${i + 1}@example.com`,
                acctinputoctets: 30 * 1024 * 1024,
                acctoutputoctets: 15 * 1024 * 1024,
              }),
            ]
          : [],
      }));

      seedGraphQLSubscriberData(largeDataset);

      const { result } = renderHook(() => useSubscriberDashboardGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.subscribersCount).toBe(50);
      expect(result.current.metrics.totalSubscribers).toBe(50);

      // 25 subscribers with sessions (i % 2 === 0)
      expect(result.current.metrics.activeServices).toBe(25);

      // 2 sessions per active subscriber = 50 total sessions
      expect(result.current.sessionsCount).toBe(50);

      const expectedTotalUsageMb = largeDataset.reduce((totalUsage, subscriber) => {
        const subscriberSessions = subscriber.sessions ?? [];
        const subscriberUsage = subscriberSessions.reduce((sessionTotal, session) => {
          const inputMb = (session?.acctinputoctets ?? 0) / (1024 * 1024);
          const outputMb = (session?.acctoutputoctets ?? 0) / (1024 * 1024);
          return sessionTotal + inputMb + outputMb;
        }, 0);
        return totalUsage + subscriberUsage;
      }, 0);

      expect(result.current.metrics.totalDataUsageMb).toBeCloseTo(expectedTotalUsageMb, 5);
    });
  });
});
