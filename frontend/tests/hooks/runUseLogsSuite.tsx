/**
 * Shared test suite for useLogs hook
 * Tests log management functionality (fetch logs, stats, services)
 */
import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type {
  LogEntry,
  LogsResponse,
  LogStats,
  LogsFilter,
} from "../../apps/platform-admin-app/hooks/useLogs";

type UseLogsHook = (filters?: LogsFilter) => {
  logs: LogEntry[];
  stats: LogStats | null;
  services: string[];
  isLoading: boolean;
  error: string | null;
  pagination: {
    total: number;
    page: number;
    page_size: number;
    has_more: boolean;
  };
  refetch: (customFilters?: LogsFilter) => Promise<void>;
  fetchStats: () => Promise<void>;
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

interface AxiosLike {
  get: jest.Mock;
  isAxiosError: jest.Mock;
}

interface LogsApiMockConfig {
  logs?: LogsResponse | LogsResponse[];
  stats?: LogStats | null;
  services?: string[];
  logsError?: unknown;
  statsError?: unknown;
  servicesError?: unknown;
}

const defaultLogsResponse: LogsResponse = {
  logs: [],
  total: 0,
  page: 1,
  page_size: 100,
  has_more: false,
};

const defaultStats: LogStats = {
  total: 0,
  by_level: {},
  by_service: {},
  time_range: { start: "", end: "" },
};

const setupLogsApiMocks = (axios: AxiosLike, config: LogsApiMockConfig) => {
  const logsQueue = Array.isArray(config.logs)
    ? [...config.logs]
    : config.logs
      ? [config.logs]
      : [];

  axios.get.mockImplementation((url: string) => {
    if (url.includes("/logs/stats")) {
      if (config.statsError) {
        return Promise.reject(config.statsError);
      }
      return Promise.resolve({ data: config.stats ?? defaultStats });
    }

    if (url.includes("/logs/services")) {
      if (config.servicesError) {
        return Promise.reject(config.servicesError);
      }
      return Promise.resolve({ data: config.services ?? [] });
    }

    if (url.includes("/logs?")) {
      if (config.logsError) {
        return Promise.reject(config.logsError);
      }
      const payload = logsQueue.length > 0 ? logsQueue.shift()! : defaultLogsResponse;
      return Promise.resolve({ data: payload });
    }

    return Promise.resolve({ data: {} });
  });
};

export function runUseLogsSuite(useLogs: UseLogsHook, axiosOverride?: AxiosLike) {
  const axiosModule = axiosOverride ?? jest.requireMock("axios");
  const axios: AxiosLike =
    axiosOverride !== undefined
      ? (axiosOverride as AxiosLike)
      : (((axiosModule as any).default ?? axiosModule) as AxiosLike);

  describe("useLogs", () => {
    beforeEach(() => {
      axios.get.mockReset();
      axios.isAxiosError.mockReset();
    });

    describe("Happy Path", () => {
      it("should fetch logs on mount", async () => {
        const mockLogs: LogEntry[] = [
          {
            id: "log-1",
            timestamp: "2025-01-10T10:00:00Z",
            level: "INFO",
            service: "api",
            message: "API request processed successfully",
            metadata: {
              request_id: "req-123",
              user_id: "user-1",
              duration: 150,
            },
          },
        ];

        const mockResponse: LogsResponse = {
          logs: mockLogs,
          total: 1,
          page: 1,
          page_size: 100,
          has_more: false,
        };

        const mockStats: LogStats = {
          total: 1,
          by_level: { INFO: 1 },
          by_service: { api: 1 },
          time_range: {
            start: "2025-01-10T00:00:00Z",
            end: "2025-01-10T23:59:59Z",
          },
        };

        const mockServices = ["api", "worker", "scheduler"];

        setupLogsApiMocks(axios, {
          logs: mockResponse,
          stats: mockStats,
          services: mockServices,
        });

        const wrapper = createWrapper();
        const { result } = renderHook(() => useLogs(), { wrapper });

        await waitFor(() => {
          expect(result.current.logs).toEqual(mockLogs);
          expect(result.current.stats).toEqual(mockStats);
          expect(result.current.services).toEqual(mockServices);
        });
        expect(result.current.pagination.total).toBe(1);
        expect(result.current.pagination.has_more).toBe(false);
        expect(result.current.error).toBeNull();
      });

      it("should fetch logs with filters", async () => {
        const filters: LogsFilter = {
          level: "ERROR",
          service: "api",
          search: "timeout",
          start_time: "2025-01-10T00:00:00Z",
          end_time: "2025-01-10T23:59:59Z",
          page: 2,
          page_size: 50,
        };

        const mockResponse: LogsResponse = {
          logs: [],
          total: 0,
          page: 2,
          page_size: 50,
          has_more: false,
        };

        setupLogsApiMocks(axios, {
          logs: mockResponse,
          stats: { total: 0, by_level: {}, by_service: {}, time_range: { start: "", end: "" } },
          services: [],
        });

        const wrapper = createWrapper();
        const { result } = renderHook(() => useLogs(filters), { wrapper });

        await waitFor(() => expect(result.current.pagination.page).toBe(2));

        const logsCall = axios.get.mock.calls.find(([url]) => url.includes("/logs?"));
        expect(logsCall?.[0]).toContain("level=ERROR");
        expect(logsCall?.[0]).toContain("service=api");
        expect(logsCall?.[0]).toContain("search=timeout");
        expect(logsCall?.[0]).toContain("page=2");
        expect(logsCall?.[0]).toContain("page_size=50");
      });

      it("should handle pagination correctly", async () => {
        const mockResponse: LogsResponse = {
          logs: Array.from({ length: 100 }, (_, i) => ({
            id: `log-${i}`,
            timestamp: "2025-01-10T10:00:00Z",
            level: "INFO",
            service: "api",
            message: `Log entry ${i}`,
            metadata: {},
          })),
          total: 500,
          page: 1,
          page_size: 100,
          has_more: true,
        };

        setupLogsApiMocks(axios, {
          logs: mockResponse,
          stats: { total: 500, by_level: {}, by_service: {}, time_range: { start: "", end: "" } },
          services: [],
        });

        const wrapper = createWrapper();
        const { result } = renderHook(() => useLogs(), { wrapper });

        await waitFor(() => expect(result.current.pagination.total).toBe(500));

        expect(result.current.pagination).toEqual({
          total: 500,
          page: 1,
          page_size: 100,
          has_more: true,
        });
      });

      it("should refetch logs with custom filters", async () => {
        setupLogsApiMocks(axios, {
          logs: [
            {
              logs: [],
              total: 0,
              page: 1,
              page_size: 100,
              has_more: false,
            },
            {
              logs: [
                {
                  id: "log-new",
                  timestamp: "2025-01-11T10:00:00Z",
                  level: "ERROR",
                  service: "api",
                  message: "Timeout occurred",
                  metadata: {},
                },
              ],
              total: 1,
              page: 1,
              page_size: 100,
              has_more: false,
            },
          ],
          stats: { total: 0, by_level: {}, by_service: {}, time_range: { start: "", end: "" } },
          services: [],
        });

        const wrapper = createWrapper();
        const { result } = renderHook(() => useLogs(), { wrapper });

        await waitFor(() => expect(result.current.pagination.total).toBe(0));

        await act(async () => {
          await result.current.refetch({ level: "ERROR" });
        });

        await waitFor(() => {
          expect(result.current.logs).toHaveLength(1);
          expect(result.current.logs[0].level).toBe("ERROR");
        });
      });

      it("should fetch stats separately", async () => {
        const mockResponse: LogsResponse = {
          logs: [],
          total: 0,
          page: 1,
          page_size: 100,
          has_more: false,
        };

        const mockStats: LogStats = {
          total: 100,
          by_level: {
            INFO: 50,
            WARNING: 20,
            ERROR: 8,
            CRITICAL: 2,
            DEBUG: 20,
          },
          by_service: {
            api: 60,
            worker: 30,
            scheduler: 10,
          },
          time_range: {
            start: "2025-01-01T00:00:00Z",
            end: "2025-01-10T23:59:59Z",
          },
        };

        setupLogsApiMocks(axios, {
          logs: mockResponse,
          stats: mockStats,
          services: [],
        });

        const wrapper = createWrapper();
        const { result } = renderHook(() => useLogs(), { wrapper });

        await waitFor(() => expect(result.current.stats).toEqual(mockStats));
      });

      it("should handle different log levels", async () => {
        const mockResponse: LogsResponse = {
          logs: [
            {
              id: "log-debug",
              timestamp: "2025-01-10T09:59:00Z",
              level: "DEBUG",
              service: "api",
              message: "Debug log",
              metadata: {},
            },
            {
              id: "log-critical",
              timestamp: "2025-01-10T10:01:00Z",
              level: "CRITICAL",
              service: "api",
              message: "Critical failure",
              metadata: { error_code: "500" },
            },
          ],
          total: 2,
          page: 1,
          page_size: 100,
          has_more: false,
        };

        setupLogsApiMocks(axios, {
          logs: mockResponse,
          stats: { total: 2, by_level: {}, by_service: {}, time_range: { start: "", end: "" } },
          services: [],
        });

        const wrapper = createWrapper();
        const { result } = renderHook(() => useLogs(), { wrapper });

        await waitFor(() => expect(result.current.logs).toHaveLength(2));
        expect(result.current.logs[0].level).toBe("DEBUG");
        expect(result.current.logs[1].metadata.error_code).toBe("500");
      });
    });

    describe("Error Handling", () => {
      it("should handle fetch logs errors", async () => {
        axios.isAxiosError.mockReturnValue(true);

        setupLogsApiMocks(axios, {
          logsError: { response: { data: { detail: "Failed to fetch logs from database" } } },
          stats: { total: 0, by_level: {}, by_service: {}, time_range: { start: "", end: "" } },
          services: [],
        });

        const wrapper = createWrapper();
        const { result } = renderHook(() => useLogs(), { wrapper });

        await waitFor(() => expect(result.current.error).toBe("Failed to fetch logs from database"));
        expect(result.current.logs).toEqual([]);
      });

      it("should handle generic errors", async () => {
        axios.isAxiosError.mockReturnValue(false);

        setupLogsApiMocks(axios, {
          logsError: new Error("Network error"),
          stats: { total: 0, by_level: {}, by_service: {}, time_range: { start: "", end: "" } },
          services: [],
        });

        const wrapper = createWrapper();
        const { result } = renderHook(() => useLogs(), { wrapper });

        await waitFor(() => expect(result.current.error).toBe("An error occurred"));
      });

      it("should handle stats fetch errors gracefully", async () => {
        setupLogsApiMocks(axios, {
          logs: { logs: [], total: 0, page: 1, page_size: 100, has_more: false },
          statsError: new Error("Stats error"),
          services: [],
        });

        const wrapper = createWrapper();
        const { result } = renderHook(() => useLogs(), { wrapper });

        await waitFor(() => expect(result.current.stats).toBeNull());
        expect(result.current.logs).toEqual([]);
        expect(result.current.error).toBeNull();
      });

      it("should handle services fetch errors gracefully", async () => {
        setupLogsApiMocks(axios, {
          logs: { logs: [], total: 0, page: 1, page_size: 100, has_more: false },
          stats: { total: 0, by_level: {}, by_service: {}, time_range: { start: "", end: "" } },
          servicesError: new Error("Services error"),
        });

        const wrapper = createWrapper();
        const { result } = renderHook(() => useLogs(), { wrapper });

        await waitFor(() => expect(result.current.services).toEqual([]));
        expect(result.current.error).toBeNull();
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty logs", async () => {
        setupLogsApiMocks(axios, {
          logs: { logs: [], total: 0, page: 1, page_size: 100, has_more: false },
          stats: { total: 0, by_level: {}, by_service: {}, time_range: { start: "", end: "" } },
          services: [],
        });

        const wrapper = createWrapper();
        const { result } = renderHook(() => useLogs(), { wrapper });

        await waitFor(() => expect(result.current.logs).toEqual([]));
      });

      it("should handle logs with complex metadata", async () => {
        const mockResponse: LogsResponse = {
          logs: [
            {
              id: "log-1",
              timestamp: "2025-01-10T10:00:00Z",
              level: "INFO",
              service: "api",
              message: "Complex metadata",
              metadata: {
                custom_field: "custom_value",
                nested: { deeply: { nested: "value" } },
              },
            },
          ],
          total: 1,
          page: 1,
          page_size: 100,
          has_more: false,
        };

        setupLogsApiMocks(axios, {
          logs: mockResponse,
          stats: { total: 1, by_level: {}, by_service: {}, time_range: { start: "", end: "" } },
          services: [],
        });

        const wrapper = createWrapper();
        const { result } = renderHook(() => useLogs(), { wrapper });

        await waitFor(() => expect(result.current.logs).toHaveLength(1));
        expect(result.current.logs[0].metadata.custom_field).toBe("custom_value");
        expect(result.current.logs[0].metadata.nested).toEqual({ deeply: { nested: "value" } });
      });

      it("should handle filters with undefined values", async () => {
        const filtersWithUndefined: LogsFilter = {
          level: undefined,
          service: undefined,
          search: undefined,
          page: 1,
          page_size: 100,
        };

        setupLogsApiMocks(axios, {
          logs: { logs: [], total: 0, page: 1, page_size: 100, has_more: false },
          stats: { total: 0, by_level: {}, by_service: {}, time_range: { start: "", end: "" } },
          services: [],
        });

        const wrapper = createWrapper();
        const { result } = renderHook(() => useLogs(filtersWithUndefined), { wrapper });

        await waitFor(() => expect(result.current.pagination.page).toBe(1));

        const logsCall = axios.get.mock.calls.find(([url]) => url.includes("/logs?"));
        expect(logsCall?.[0]).not.toContain("level=");
        expect(logsCall?.[0]).not.toContain("service=");
        expect(logsCall?.[0]).not.toContain("search=");
      });

      it("should handle large pagination values", async () => {
        const mockResponse: LogsResponse = {
          logs: [],
          total: 10000,
          page: 50,
          page_size: 200,
          has_more: true,
        };

        setupLogsApiMocks(axios, {
          logs: mockResponse,
          stats: { total: 10000, by_level: {}, by_service: {}, time_range: { start: "", end: "" } },
          services: [],
        });

        const wrapper = createWrapper();
        const { result } = renderHook(() => useLogs({ page: 50, page_size: 200 }), { wrapper });

        await waitFor(() => expect(result.current.pagination.total).toBe(10000));
        expect(result.current.pagination.page).toBe(50);
        expect(result.current.pagination.has_more).toBe(true);
      });
    });
  });
}
