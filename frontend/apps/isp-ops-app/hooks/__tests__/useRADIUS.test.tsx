/**
 * Jest tests for useRADIUS
 *
 * Tests RADIUS hooks with Jest mocks instead of MSW.
 */

import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { useRADIUSSubscribers, useRADIUSSessions } from "../useRADIUS";
import { createQueryWrapper } from "../../__tests__/test-utils";

// Import MSW for handlers
import { http, HttpResponse } from "msw";
const { server } = require("@/__tests__/msw/server");

// Mock useAppConfig
jest.mock("@/providers/AppConfigContext", () => ({
  AppConfigProvider: ({ children }: { children: React.ReactNode }) => children,
  useAppConfig: jest.fn(() => ({
    api: {
      baseUrl: "http://localhost:3000",
      prefix: "/api/v1",
    },
    features: {},
  })),
}));

// Mock api-utils to bypass schema validation
jest.mock("../../../../shared/utils/api-utils", () => ({
  buildApiUrl: (path: string, api: any) => {
    return `${api.baseUrl}${api.prefix}${path}`;
  },
  parseListResponse: async (response: Response) => {
    const data = await response.json();
    return data;
  },
  handleApiError: async (response: Response, defaultMessage: string) => {
    const error = await response.json();
    throw new Error(error.error || defaultMessage);
  },
}));

// Test response storage for MSW handlers
let mockSubscribersResponse: any = { data: [], total: 0 };
let mockSessionsResponse: any = { data: [], total: 0 };
let shouldThrowError = false;

// Test data factories
const createMockRADIUSSubscriber = (overrides: any = {}) => ({
  id: 1,
  subscriber_id: "sub-001",
  username: "user@example.com",
  enabled: true,
  ...overrides,
});

const createMockRADIUSSession = (overrides: any = {}) => ({
  radacctid: 1,
  username: "user@example.com",
  framedipaddress: "10.0.0.1",
  acctsessiontime: 3600,
  acctinputoctets: 1000000,
  acctoutputoctets: 500000,
  subscriber_id: "sub-001",
  ...overrides,
});

describe("useRADIUS (Jest)", () => {
  // Set up MSW handlers for RADIUS endpoints before EACH test
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock responses
    mockSubscribersResponse = { data: [], total: 0 };
    mockSessionsResponse = { data: [], total: 0 };
    shouldThrowError = false;

    // Override MSW handlers for this test suite
    server.use(
      http.get("http://localhost:3000/api/v1/radius/subscribers", () => {
        if (shouldThrowError) {
          return new HttpResponse(JSON.stringify({ error: "Server error" }), { status: 500 });
        }
        return HttpResponse.json(mockSubscribersResponse);
      }),
      http.get("http://localhost:3000/api/v1/radius/sessions", () => {
        if (shouldThrowError) {
          return new HttpResponse(JSON.stringify({ error: "Server error" }), { status: 500 });
        }
        return HttpResponse.json(mockSessionsResponse);
      }),
    );
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe("useRADIUSSubscribers", () => {
    it("should fetch RADIUS subscribers successfully", async () => {
      const mockSubscribers = [
        createMockRADIUSSubscriber({ id: 1, username: "user1@example.com", enabled: true }),
        createMockRADIUSSubscriber({ id: 2, username: "user2@example.com", enabled: true }),
        createMockRADIUSSubscriber({ id: 3, username: "user3@example.com", enabled: false }),
      ];

      mockSubscribersResponse = { data: mockSubscribers, total: 3 };

      const { result } = renderHook(() => useRADIUSSubscribers(0, 20), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.data).toHaveLength(3);
      expect(result.current.data?.total).toBe(3);
      expect(result.current.data?.data[0]?.username).toBe("user1@example.com");
      expect(result.current.error).toBeNull();
    });

    it("should handle empty subscribers list", async () => {
      mockSubscribersResponse = { data: [], total: 0 };

      const { result } = renderHook(() => useRADIUSSubscribers(0, 20), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.data).toHaveLength(0);
      expect(result.current.data?.total).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it("should handle pagination with offset and limit", async () => {
      const mockSubscribers = Array.from({ length: 10 }, (_, i) =>
        createMockRADIUSSubscriber({
          id: i + 11,
          username: `user${i + 11}@example.com`,
        }),
      );

      mockSubscribersResponse = { data: mockSubscribers, total: 25 };

      const { result } = renderHook(() => useRADIUSSubscribers(10, 10), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.data).toHaveLength(10);
      expect(result.current.data?.data[0]?.username).toBe("user11@example.com");
    });

    it("should not fetch when enabled is false", () => {
      const { result } = renderHook(() => useRADIUSSubscribers(0, 20, { enabled: false }), {
        wrapper: createQueryWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it("should handle fetch error", async () => {
      shouldThrowError = true;

      const { result } = renderHook(() => useRADIUSSubscribers(0, 20), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should handle different page sizes", async () => {
      const mockSubscribers = Array.from({ length: 20 }, (_, i) =>
        createMockRADIUSSubscriber({ id: i + 1 }),
      );

      mockSubscribersResponse = { data: mockSubscribers, total: 50 };

      const { result } = renderHook(() => useRADIUSSubscribers(0, 20), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.data).toHaveLength(20);
      expect(result.current.data?.data[0]?.id).toBe(1);
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

      mockSessionsResponse = { data: mockSessions, total: 2 };

      const { result } = renderHook(() => useRADIUSSessions(0, 100), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.data).toHaveLength(2);
      expect(result.current.data?.total).toBe(2);
      expect(result.current.data?.data[0]?.username).toBe("user1@example.com");
      expect(result.current.error).toBeNull();
    });

    it("should handle empty sessions list", async () => {
      mockSessionsResponse = { data: [], total: 0 };

      const { result } = renderHook(() => useRADIUSSessions(0, 100), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.data).toHaveLength(0);
      expect(result.current.data?.total).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it("should not fetch when enabled is false", () => {
      const { result } = renderHook(() => useRADIUSSessions(0, 100, { enabled: false }), {
        wrapper: createQueryWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it("should handle fetch error", async () => {
      shouldThrowError = true;

      const { result } = renderHook(() => useRADIUSSessions(0, 100), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

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

      mockSessionsResponse = { data: mockSessions, total: 3 };

      const { result } = renderHook(() => useRADIUSSessions(0, 100), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.data).toHaveLength(3);
      expect(result.current.data?.data[0]?.acctsessiontime).toBe(3600);
      expect(result.current.data?.data[2]?.acctsessiontime).toBe(0);
    });

    it("should support default pagination parameters", async () => {
      const mockSessions = [createMockRADIUSSession({ radacctid: 1 })];

      mockSessionsResponse = { data: mockSessions, total: 1 };

      const { result } = renderHook(() => useRADIUSSessions(), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.data).toHaveLength(1);
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle concurrent subscribers and sessions fetches", async () => {
      mockSubscribersResponse = {
        data: [createMockRADIUSSubscriber({ username: "user1@example.com" })],
        total: 1,
      };
      mockSessionsResponse = {
        data: [createMockRADIUSSession({ username: "user1@example.com" })],
        total: 1,
      };

      const { result: subscribersResult } = renderHook(() => useRADIUSSubscribers(0, 20), {
        wrapper: createQueryWrapper(),
      });

      const { result: sessionsResult } = renderHook(() => useRADIUSSessions(0, 100), {
        wrapper: createQueryWrapper(),
      });

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
        }),
      );

      mockSessionsResponse = { data: mockSessions, total: 100 };

      const { result } = renderHook(() => useRADIUSSessions(0, 100), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.data).toHaveLength(100);
    });

    it("should handle subscribers with and without sessions", async () => {
      mockSubscribersResponse = {
        data: [
          createMockRADIUSSubscriber({ id: 1, subscriber_id: "sub-1", enabled: true }),
          createMockRADIUSSubscriber({ id: 2, subscriber_id: "sub-2", enabled: true }),
          createMockRADIUSSubscriber({ id: 3, subscriber_id: "sub-3", enabled: false }),
        ],
        total: 3,
      };
      mockSessionsResponse = {
        data: [createMockRADIUSSession({ subscriber_id: "sub-1" })],
        total: 1,
      };

      const { result: subscribersResult } = renderHook(() => useRADIUSSubscribers(0, 20), {
        wrapper: createQueryWrapper(),
      });

      const { result: sessionsResult } = renderHook(() => useRADIUSSessions(0, 100), {
        wrapper: createQueryWrapper(),
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
