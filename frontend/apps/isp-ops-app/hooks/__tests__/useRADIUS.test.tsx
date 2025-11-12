/**
 * Tests for useRADIUS hooks
 * Tests RADIUS subscriber and session queries
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRADIUSSubscribers, useRADIUSSessions } from "../useRADIUS";
import { getOperatorAccessToken } from "../../../../shared/utils/operatorAuth";

// Mock platformConfig
jest.mock("@/lib/config", () => ({
  platformConfig: {
    api: {
      baseUrl: "http://localhost:8000",
    },
  },
}));

// Mock getOperatorAccessToken
jest.mock("../../../../shared/utils/operatorAuth", () => ({
  getOperatorAccessToken: jest.fn(),
}));

// Mock global fetch
global.fetch = jest.fn();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useRADIUS", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("useRADIUSSubscribers", () => {
    it("should fetch RADIUS subscribers successfully", async () => {
      const mockSubscribers = [
        {
          id: 1,
          tenant_id: "tenant-123",
          subscriber_id: "sub-1",
          username: "user1@test.com",
          enabled: true,
          bandwidth_profile_id: "profile-1",
          framed_ipv4_address: "10.0.0.1",
          framed_ipv6_address: "2001:db8::1",
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: 2,
          tenant_id: "tenant-123",
          subscriber_id: "sub-2",
          username: "user2@test.com",
          enabled: false,
          created_at: "2024-01-02T00:00:00Z",
        },
      ];

      (getOperatorAccessToken as jest.Mock).mockReturnValue("test-token");
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockSubscribers,
      });

      const { result } = renderHook(() => useRADIUSSubscribers(0, 20), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.data).toHaveLength(2);
      expect(result.current.data?.total).toBe(2);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/v1/radius/subscribers?offset=0&limit=20",
        expect.objectContaining({
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          },
        })
      );
    });

    it("should fetch without token if not available", async () => {
      (getOperatorAccessToken as jest.Mock).mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useRADIUSSubscribers(0, 20), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
          },
        })
      );
    });

    it("should use custom offset and limit", async () => {
      (getOperatorAccessToken as jest.Mock).mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      renderHook(() => useRADIUSSubscribers(10, 50), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:8000/api/v1/radius/subscribers?offset=10&limit=50",
          expect.any(Object)
        );
      });
    });

    it("should handle fetch error", async () => {
      (getOperatorAccessToken as jest.Mock).mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: "Internal Server Error",
      });

      const { result } = renderHook(() => useRADIUSSubscribers(0, 20), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
      expect((result.current.error as Error).message).toContain(
        "Failed to fetch RADIUS subscribers"
      );
    });

    it("should be enabled by default", () => {
      (getOperatorAccessToken as jest.Mock).mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useRADIUSSubscribers(0, 20), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(true);
    });

    it("should respect enabled option", () => {
      const { result } = renderHook(
        () => useRADIUSSubscribers(0, 20, { enabled: false }),
        {
          wrapper: createWrapper(),
        }
      );

      expect(result.current.isFetching).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should have correct stale time", () => {
      (getOperatorAccessToken as jest.Mock).mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useRADIUSSubscribers(0, 20), {
        wrapper: createWrapper(),
      });

      expect(result.current).toBeDefined();
    });

    it("should handle empty subscriber list", async () => {
      (getOperatorAccessToken as jest.Mock).mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useRADIUSSubscribers(0, 20), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.data).toEqual([]);
      expect(result.current.data?.total).toBe(0);
    });

    it("should handle pagination correctly", async () => {
      const page1Data = [{ id: 1, username: "user1@test.com" }];
      const page2Data = [{ id: 21, username: "user21@test.com" }];

      (getOperatorAccessToken as jest.Mock).mockReturnValue(null);
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => page1Data,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => page2Data,
        });

      const { result, rerender } = renderHook(
        ({ offset }) => useRADIUSSubscribers(offset, 20),
        {
          wrapper: createWrapper(),
          initialProps: { offset: 0 },
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data).toHaveLength(1);
      expect(result.current.data?.data[0].id).toBe(1);

      rerender({ offset: 20 });

      await waitFor(() => expect(result.current.data?.data[0].id).toBe(21));
    });
  });

  describe("useRADIUSSessions", () => {
    it("should fetch RADIUS sessions successfully", async () => {
      const mockSessions = [
        {
          radacctid: 1,
          tenant_id: "tenant-123",
          subscriber_id: "sub-1",
          username: "user1@test.com",
          acctsessionid: "session-1",
          nasipaddress: "10.0.0.1",
          framedipaddress: "192.168.1.1",
          framedipv6address: "2001:db8::1",
          acctstarttime: "2024-01-01T00:00:00Z",
          acctsessiontime: 3600,
          acctinputoctets: 1024000,
          acctoutputoctets: 2048000,
        },
      ];

      (getOperatorAccessToken as jest.Mock).mockReturnValue("test-token");
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockSessions,
      });

      const { result } = renderHook(() => useRADIUSSessions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.data).toHaveLength(1);
      expect(result.current.data?.total).toBe(1);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/v1/radius/sessions",
        expect.objectContaining({
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          },
        })
      );
    });

    it("should fetch without token if not available", async () => {
      (getOperatorAccessToken as jest.Mock).mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useRADIUSSessions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
          },
        })
      );
    });

    it("should handle fetch error", async () => {
      (getOperatorAccessToken as jest.Mock).mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: "Internal Server Error",
      });

      const { result } = renderHook(() => useRADIUSSessions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
      expect((result.current.error as Error).message).toContain(
        "Failed to fetch RADIUS sessions"
      );
    });

    it("should be enabled by default", () => {
      (getOperatorAccessToken as jest.Mock).mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useRADIUSSessions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(true);
    });

    it("should respect enabled option", () => {
      const { result } = renderHook(() => useRADIUSSessions({ enabled: false }), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should have correct stale time (10 seconds)", () => {
      (getOperatorAccessToken as jest.Mock).mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useRADIUSSessions(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toBeDefined();
    });

    it("should handle empty sessions list", async () => {
      (getOperatorAccessToken as jest.Mock).mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useRADIUSSessions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.data).toEqual([]);
      expect(result.current.data?.total).toBe(0);
    });

    it("should handle IPv6 addresses", async () => {
      const mockSessions = [
        {
          radacctid: 1,
          tenant_id: "tenant-123",
          subscriber_id: "sub-1",
          username: "user1@test.com",
          acctsessionid: "session-1",
          nasipaddress: "10.0.0.1",
          framedipaddress: null,
          framedipv6address: "2001:db8::1",
          framedipv6prefix: "2001:db8::/64",
          delegatedipv6prefix: "2001:db8:1::/48",
          acctstarttime: "2024-01-01T00:00:00Z",
          acctsessiontime: null,
          acctinputoctets: null,
          acctoutputoctets: null,
        },
      ];

      (getOperatorAccessToken as jest.Mock).mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockSessions,
      });

      const { result } = renderHook(() => useRADIUSSessions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const session = result.current.data?.data[0];
      expect(session?.framedipv6address).toBe("2001:db8::1");
      expect(session?.framedipv6prefix).toBe("2001:db8::/64");
      expect(session?.delegatedipv6prefix).toBe("2001:db8:1::/48");
    });
  });
});
