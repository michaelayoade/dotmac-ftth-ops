/**
 * MSW-powered tests for useRADIUS
 *
 * This test file uses MSW for API mocking instead of jest.mock.
 * MSW provides more realistic network mocking and better test isolation.
 */

import React from 'react';
import { renderHook, waitFor } from "@testing-library/react";
import { useRADIUSSubscribers, useRADIUSSessions } from "../useRADIUS";
import { AppConfigProvider } from "@/providers/AppConfigContext";
import {
  createTestQueryClient,
  createQueryWrapper,
  resetRADIUSStorage,
  createMockRADIUSSubscriber,
  createMockRADIUSSession,
  seedRADIUSData,
  makeApiEndpointFail,
} from "../../__tests__/test-utils";

// Mock the operator auth utility
jest.mock('../../../../shared/utils/operatorAuth', () => ({
  getOperatorAccessToken: jest.fn(() => 'mock-token'),
}));

// Mock useAppConfig
jest.mock('@/providers/AppConfigContext', () => ({
  AppConfigProvider: ({ children }: { children: React.ReactNode }) => children,
  useAppConfig: jest.fn(() => ({
    api: {
      baseUrl: 'http://localhost:3000',
      prefix: '/api/v1',
    },
    features: {},
  })),
}));

const waitForRadiusLoading = async (getLoading: () => boolean) => {
  await waitFor(() => expect(getLoading()).toBe(false), { timeout: 5000 });
};

// Create a wrapper that includes QueryClient
function createRADIUSWrapper(queryClient: ReturnType<typeof createTestQueryClient>) {
  return createQueryWrapper(queryClient);
}

describe("useRADIUS (MSW)", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    resetRADIUSStorage();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("useRADIUSSubscribers", () => {
    it("should fetch RADIUS subscribers successfully", async () => {
      const mockSubscribers = [
        createMockRADIUSSubscriber({
          id: 1,
          username: "user1@example.com",
          enabled: true,
        }),
        createMockRADIUSSubscriber({
          id: 2,
          username: "user2@example.com",
          enabled: true,
        }),
        createMockRADIUSSubscriber({
          id: 3,
          username: "user3@example.com",
          enabled: false,
        }),
      ];

      seedRADIUSData(mockSubscribers, []);

      const { result } = renderHook(() => useRADIUSSubscribers(0, 20), {
        wrapper: createRADIUSWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);

      await waitForRadiusLoading(() => result.current.isLoading);

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.data).toHaveLength(3);
      expect(result.current.data?.total).toBe(3);
      expect(result.current.data?.data[0].username).toBe("user1@example.com");
      expect(result.current.error).toBeNull();
    });

    it("should handle empty subscribers list", async () => {
      seedRADIUSData([], []);

      const { result } = renderHook(() => useRADIUSSubscribers(0, 20), {
        wrapper: createRADIUSWrapper(queryClient),
      });

      await waitForRadiusLoading(() => result.current.isLoading);

      expect(result.current.data?.data).toHaveLength(0);
      expect(result.current.data?.total).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it("should handle pagination with offset and limit", async () => {
      const mockSubscribers = Array.from({ length: 25 }, (_, i) =>
        createMockRADIUSSubscriber({
          id: i + 1,
          username: `user${i + 1}@example.com`,
        })
      );

      seedRADIUSData(mockSubscribers, []);

      const { result } = renderHook(() => useRADIUSSubscribers(10, 10), {
        wrapper: createRADIUSWrapper(queryClient),
      });

      await waitForRadiusLoading(() => result.current.isLoading);

      expect(result.current.data?.data).toHaveLength(10);
      expect(result.current.data?.data[0].username).toBe("user11@example.com");
    });

    it("should not fetch when enabled is false", () => {
      const { result } = renderHook(
        () => useRADIUSSubscribers(0, 20, { enabled: false }),
        {
          wrapper: createRADIUSWrapper(queryClient),
        }
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it("should handle fetch error", async () => {
      makeApiEndpointFail('get', '/api/v1/radius/subscribers', 'Server error');

      const { result } = renderHook(() => useRADIUSSubscribers(0, 20), {
        wrapper: createRADIUSWrapper(queryClient),
      });

      await waitForRadiusLoading(() => result.current.isLoading);

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should handle different page sizes", async () => {
      const mockSubscribers = Array.from({ length: 50 }, (_, i) =>
        createMockRADIUSSubscriber({ id: i + 1 })
      );

      seedRADIUSData(mockSubscribers, []);

      // First page with limit 20
      const { result: page1 } = renderHook(() => useRADIUSSubscribers(0, 20), {
        wrapper: createRADIUSWrapper(queryClient),
      });

      // Second page with limit 20
      const { result: page2 } = renderHook(() => useRADIUSSubscribers(20, 20), {
        wrapper: createRADIUSWrapper(queryClient),
      });

      await waitFor(() => {
        expect(page1.current.isLoading).toBe(false);
        expect(page2.current.isLoading).toBe(false);
      });

      expect(page1.current.data?.data).toHaveLength(20);
      expect(page2.current.data?.data).toHaveLength(20);
      expect(page1.current.data?.data[0].id).toBe(1);
      expect(page2.current.data?.data[0].id).toBe(21);
    });
  });

  describe("useRADIUSSessions", () => {
    it("should fetch RADIUS sessions successfully", async () => {
      const mockSessions = [
        createMockRADIUSSession({
          radacctid: 1,
          username: "user1@example.com",
          framedipaddress: "10.0.0.1",
        }),
        createMockRADIUSSession({
          radacctid: 2,
          username: "user2@example.com",
          framedipaddress: "10.0.0.2",
        }),
      ];

      seedRADIUSData([], mockSessions);

      const { result } = renderHook(() => useRADIUSSessions(), {
        wrapper: createRADIUSWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);

      await waitForRadiusLoading(() => result.current.isLoading);

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.data).toHaveLength(2);
      expect(result.current.data?.total).toBe(2);
      expect(result.current.data?.data[0].username).toBe("user1@example.com");
      expect(result.current.error).toBeNull();
    });

    it("should handle empty sessions list", async () => {
      seedRADIUSData([], []);

      const { result } = renderHook(() => useRADIUSSessions(), {
        wrapper: createRADIUSWrapper(queryClient),
      });

      await waitForRadiusLoading(() => result.current.isLoading);

      expect(result.current.data?.data).toHaveLength(0);
      expect(result.current.data?.total).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it("should not fetch when enabled is false", () => {
      const { result } = renderHook(
        () => useRADIUSSessions({ enabled: false }),
        {
          wrapper: createRADIUSWrapper(queryClient),
        }
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it("should handle fetch error", async () => {
      makeApiEndpointFail('get', '/api/v1/radius/sessions', 'Server error');

      const { result } = renderHook(() => useRADIUSSessions(), {
        wrapper: createRADIUSWrapper(queryClient),
      });

      await waitForRadiusLoading(() => result.current.isLoading);

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should handle sessions with various states", async () => {
      const mockSessions = [
        createMockRADIUSSession({
          acctsessiontime: 3600, // 1 hour
          acctinputoctets: 1000000,
          acctoutputoctets: 500000,
        }),
        createMockRADIUSSession({
          acctsessiontime: 7200, // 2 hours
          acctinputoctets: 2000000,
          acctoutputoctets: 1000000,
        }),
        createMockRADIUSSession({
          acctsessiontime: 0, // Just started
          acctinputoctets: 0,
          acctoutputoctets: 0,
        }),
      ];

      seedRADIUSData([], mockSessions);

      const { result } = renderHook(() => useRADIUSSessions(), {
        wrapper: createRADIUSWrapper(queryClient),
      });

      await waitForRadiusLoading(() => result.current.isLoading);

      expect(result.current.data?.data).toHaveLength(3);
      expect(result.current.data?.data[0].acctsessiontime).toBe(3600);
      expect(result.current.data?.data[2].acctsessiontime).toBe(0);
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle concurrent subscribers and sessions fetches", async () => {
      const mockSubscribers = [
        createMockRADIUSSubscriber({ username: "user1@example.com" }),
      ];
      const mockSessions = [
        createMockRADIUSSession({ username: "user1@example.com" }),
      ];

      seedRADIUSData(mockSubscribers, mockSessions);

      const { result: subscribersResult } = renderHook(
        () => useRADIUSSubscribers(0, 20),
        {
          wrapper: createRADIUSWrapper(queryClient),
        }
      );

      const { result: sessionsResult } = renderHook(() => useRADIUSSessions(), {
        wrapper: createRADIUSWrapper(queryClient),
      });

      // Both should load independently
      await waitFor(() => {
        expect(subscribersResult.current.isLoading).toBe(false);
        expect(sessionsResult.current.isLoading).toBe(false);
      });

      expect(subscribersResult.current.data?.data).toHaveLength(1);
      expect(sessionsResult.current.data?.data).toHaveLength(1);
    });

    it("should handle many active sessions", async () => {
      const mockSessions = Array.from({ length: 100 }, (_, i) =>
        createMockRADIUSSession({
          radacctid: i + 1,
          username: `user${i + 1}@example.com`,
        })
      );

      seedRADIUSData([], mockSessions);

      const { result } = renderHook(() => useRADIUSSessions(), {
        wrapper: createRADIUSWrapper(queryClient),
      });

      await waitForRadiusLoading(() => result.current.isLoading);

      expect(result.current.data?.data).toHaveLength(100);
    });

    it("should handle subscribers with and without sessions", async () => {
      const mockSubscribers = [
        createMockRADIUSSubscriber({ id: 1, subscriber_id: "sub-1", enabled: true }),
        createMockRADIUSSubscriber({ id: 2, subscriber_id: "sub-2", enabled: true }),
        createMockRADIUSSubscriber({ id: 3, subscriber_id: "sub-3", enabled: false }),
      ];

      const mockSessions = [
        createMockRADIUSSession({ subscriber_id: "sub-1" }), // Has session
        // sub-2 has no session
        // sub-3 is disabled
      ];

      seedRADIUSData(mockSubscribers, mockSessions);

      const { result: subscribersResult } = renderHook(
        () => useRADIUSSubscribers(0, 20),
        {
          wrapper: createRADIUSWrapper(queryClient),
        }
      );

      const { result: sessionsResult } = renderHook(() => useRADIUSSessions(), {
        wrapper: createRADIUSWrapper(queryClient),
      });

      await waitFor(() => {
        expect(subscribersResult.current.isLoading).toBe(false);
        expect(sessionsResult.current.isLoading).toBe(false);
      });

      expect(subscribersResult.current.data?.data).toHaveLength(3);
      expect(sessionsResult.current.data?.data).toHaveLength(1);
    });
  });
});
