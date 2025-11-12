/**
 * Tests for useLogs hook
 * Tests log fetching, filtering, pagination, and statistics using TanStack Query
 */

import { renderHook, waitFor } from "@testing-library/react";
import { useLogs, logsKeys } from "../useLogs";
import axios from "axios";
import { useToast } from "@dotmac/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock axios
jest.mock("axios");

// Mock useToast
jest.mock("@dotmac/ui", () => ({
  useToast: jest.fn(),
}));

// Mock config
jest.mock("@/lib/config", () => ({
  platformConfig: {
    api: {
      baseUrl: "http://localhost:8000",
    },
  },
}));

describe("useLogs", () => {
  const mockToast = jest.fn();

  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
  });

  describe("fetchLogs", () => {
    it("should fetch logs successfully", async () => {
      const mockLogsResponse = {
        logs: [
          {
            id: "1",
            timestamp: "2024-01-01T00:00:00Z",
            level: "INFO" as const,
            service: "api",
            message: "Test log message",
            metadata: {},
          },
        ],
        total: 1,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      (axios.get as jest.Mock).mockResolvedValue({ data: mockLogsResponse });

      const { result } = renderHook(() => useLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.logs).toHaveLength(1);
      expect(result.current.logs[0].message).toBe("Test log message");
      expect(result.current.pagination.total).toBe(1);
      expect(axios.get).toHaveBeenCalledWith(
        "http://localhost:8000/api/v1/monitoring/logs?",
        { withCredentials: true }
      );
    });

    it("should build query params correctly with filters", async () => {
      const mockResponse = {
        logs: [],
        total: 0,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      (axios.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      renderHook(
        () =>
          useLogs({
            level: "ERROR",
            service: "api",
            search: "test",
            start_time: "2024-01-01T00:00:00Z",
            end_time: "2024-01-02T00:00:00Z",
            page: 2,
            page_size: 50,
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          expect.stringContaining("level=ERROR"),
          expect.any(Object)
        );
        expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("service=api"), expect.any(Object));
        expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("search=test"), expect.any(Object));
        expect(axios.get).toHaveBeenCalledWith(
          expect.stringContaining("start_time=2024-01-01T00%3A00%3A00Z"),
          expect.any(Object)
        );
        expect(axios.get).toHaveBeenCalledWith(
          expect.stringContaining("end_time=2024-01-02T00%3A00%3A00Z"),
          expect.any(Object)
        );
        expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("page=2"), expect.any(Object));
        expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("page_size=50"), expect.any(Object));
      });
    });

    it("should handle fetch error with toast notification", async () => {
      const mockError = {
        response: {
          data: {
            detail: "Failed to fetch logs",
          },
        },
      };

      (axios.isAxiosError as jest.Mock).mockReturnValue(true);
      (axios.get as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBe("Failed to fetch logs");
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Failed to fetch logs",
        variant: "destructive",
      });
    });

    it("should handle non-Axios error", async () => {
      const mockError = new Error("Network error");
      (axios.isAxiosError as jest.Mock).mockReturnValue(false);
      (axios.get as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBe("An error occurred");
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "An error occurred",
        variant: "destructive",
      });
    });

    it("should set loading state correctly", async () => {
      (axios.get as jest.Mock).mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ data: { logs: [], total: 0, page: 1, page_size: 100, has_more: false } }), 100)));

      const { result } = renderHook(() => useLogs(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 200 });
    });
  });

  describe("fetchStats", () => {
    it("should fetch log statistics successfully", async () => {
      const mockStats = {
        total: 100,
        by_level: { INFO: 50, ERROR: 30, WARNING: 20 },
        by_service: { api: 60, worker: 40 },
        time_range: {
          start: "2024-01-01T00:00:00Z",
          end: "2024-01-02T00:00:00Z",
        },
      };

      (axios.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/stats")) {
          return Promise.resolve({ data: mockStats });
        }
        return Promise.resolve({
          data: { logs: [], total: 0, page: 1, page_size: 100, has_more: false },
        });
      });

      const { result } = renderHook(() => useLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.stats).not.toBeNull());

      expect(result.current.stats).toEqual(mockStats);
      expect(axios.get).toHaveBeenCalledWith(
        "http://localhost:8000/api/v1/monitoring/logs/stats",
        { withCredentials: true }
      );
    });

    it("should handle stats fetch error silently", async () => {
      (axios.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/stats")) {
          return Promise.reject(new Error("Stats error"));
        }
        return Promise.resolve({
          data: { logs: [], total: 0, page: 1, page_size: 100, has_more: false },
        });
      });

      const { result } = renderHook(() => useLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Stats query should fail but logs should still load
      expect(result.current.stats).toBeNull();
      expect(result.current.logs).toEqual([]);
    });

    it("should expose fetchStats function", async () => {
      const mockStats = {
        total: 50,
        by_level: {},
        by_service: {},
        time_range: { start: "", end: "" },
      };

      (axios.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/stats")) {
          return Promise.resolve({ data: mockStats });
        }
        return Promise.resolve({
          data: { logs: [], total: 0, page: 1, page_size: 100, has_more: false },
        });
      });

      const { result } = renderHook(() => useLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Clear previous calls
      (axios.get as jest.Mock).mockClear();

      await result.current.fetchStats();

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          "http://localhost:8000/api/v1/monitoring/logs/stats",
          { withCredentials: true }
        );
      });
    });
  });

  describe("fetchServices", () => {
    it("should fetch services list successfully", async () => {
      const mockServices = ["api", "worker", "scheduler"];

      (axios.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/services")) {
          return Promise.resolve({ data: mockServices });
        }
        if (url.includes("/stats")) {
          return Promise.resolve({
            data: { total: 0, by_level: {}, by_service: {}, time_range: { start: "", end: "" } },
          });
        }
        return Promise.resolve({
          data: { logs: [], total: 0, page: 1, page_size: 100, has_more: false },
        });
      });

      const { result } = renderHook(() => useLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.services).toHaveLength(3));

      expect(result.current.services).toEqual(mockServices);
      expect(axios.get).toHaveBeenCalledWith(
        "http://localhost:8000/api/v1/monitoring/logs/services",
        { withCredentials: true }
      );
    });

    it("should handle services fetch error silently", async () => {
      (axios.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/services")) {
          return Promise.reject(new Error("Services error"));
        }
        if (url.includes("/stats")) {
          return Promise.resolve({
            data: { total: 0, by_level: {}, by_service: {}, time_range: { start: "", end: "" } },
          });
        }
        return Promise.resolve({
          data: { logs: [], total: 0, page: 1, page_size: 100, has_more: false },
        });
      });

      const { result } = renderHook(() => useLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Services query should fail but logs should still load
      expect(result.current.services).toEqual([]);
      expect(result.current.logs).toEqual([]);
    });
  });

  describe("refetch", () => {
    it("should refetch logs", async () => {
      const mockResponse = {
        logs: [],
        total: 0,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      (axios.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useLogs({ level: "INFO" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Clear previous calls
      (axios.get as jest.Mock).mockClear();

      await result.current.refetch();

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          expect.stringContaining("level=INFO"),
          expect.any(Object)
        );
      });
    });
  });

  describe("pagination", () => {
    it("should handle pagination correctly", async () => {
      const mockResponse = {
        logs: Array(50)
          .fill(null)
          .map((_, i) => ({
            id: String(i),
            timestamp: "2024-01-01T00:00:00Z",
            level: "INFO" as const,
            service: "api",
            message: `Log ${i}`,
            metadata: {},
          })),
        total: 200,
        page: 2,
        page_size: 50,
        has_more: true,
      };

      (axios.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useLogs({ page: 2, page_size: 50 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.pagination).toEqual({
        total: 200,
        page: 2,
        page_size: 50,
        has_more: true,
      });
      expect(result.current.logs).toHaveLength(50);
    });

    it("should indicate when there are no more pages", async () => {
      const mockResponse = {
        logs: Array(20)
          .fill(null)
          .map((_, i) => ({
            id: String(i),
            timestamp: "2024-01-01T00:00:00Z",
            level: "INFO" as const,
            service: "api",
            message: `Log ${i}`,
            metadata: {},
          })),
        total: 20,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      (axios.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.pagination.has_more).toBe(false);
    });
  });

  describe("log metadata", () => {
    it("should handle logs with metadata", async () => {
      const mockLogsResponse = {
        logs: [
          {
            id: "1",
            timestamp: "2024-01-01T00:00:00Z",
            level: "INFO" as const,
            service: "api",
            message: "Request completed",
            metadata: {
              request_id: "req-123",
              user_id: "user-456",
              tenant_id: "tenant-789",
              duration: 150,
              ip: "192.168.1.1",
            },
          },
        ],
        total: 1,
        page: 1,
        page_size: 100,
        has_more: false,
      };

      (axios.get as jest.Mock).mockResolvedValue({ data: mockLogsResponse });

      const { result } = renderHook(() => useLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const log = result.current.logs[0];
      expect(log.metadata.request_id).toBe("req-123");
      expect(log.metadata.user_id).toBe("user-456");
      expect(log.metadata.duration).toBe(150);
    });
  });

  describe("log levels", () => {
    it("should handle all log levels", async () => {
      const levels: Array<"DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL"> = [
        "DEBUG",
        "INFO",
        "WARNING",
        "ERROR",
        "CRITICAL",
      ];

      for (const level of levels) {
        const mockResponse = {
          logs: [
            {
              id: "1",
              timestamp: "2024-01-01T00:00:00Z",
              level,
              service: "api",
              message: `${level} message`,
              metadata: {},
            },
          ],
          total: 1,
          page: 1,
          page_size: 100,
          has_more: false,
        };

        (axios.get as jest.Mock).mockResolvedValue({ data: mockResponse });

        const { result } = renderHook(() => useLogs({ level }), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.logs[0].level).toBe(level);
      }
    });
  });
});
