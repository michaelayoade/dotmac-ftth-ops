/**
 * Platform Admin App - useOperations tests
 *
 * Covers the TanStack hooks that surface monitoring/health data in the admin UI.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useMonitoringMetrics,
  useLogStats,
  useSystemHealth,
  getStatusColor,
  getStatusIcon,
} from "../useOperations";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

jest.mock("@/lib/api/response-helpers", () => ({
  extractDataOrThrow: jest.fn((response) => response.data),
}));

const mockedExtractDataOrThrow = extractDataOrThrow as jest.Mock;

describe("Platform Admin useOperations hooks", () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches monitoring metrics for a given period", async () => {
    const metrics = { total_requests: 1000 };
    (apiClient.get as jest.Mock).mockResolvedValue({ data: metrics });

    const { result } = renderHook(() => useMonitoringMetrics("7d"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.get).toHaveBeenCalledWith("/monitoring/metrics", {
      params: { period: "7d" },
    });
    expect(mockedExtractDataOrThrow).toHaveBeenCalled();
    expect(result.current.data).toEqual(metrics);
  });

  it("fetches log stats with the correct query key", async () => {
    const logStats = { total_logs: 500 };
    (apiClient.get as jest.Mock).mockResolvedValue({ data: logStats });

    const { result } = renderHook(() => useLogStats("1h"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.get).toHaveBeenCalledWith("/monitoring/logs/stats", {
      params: { period: "1h" },
    });
    expect(result.current.data).toEqual(logStats);
  });

  it("fetches system health data", async () => {
    const systemHealth = { status: "healthy", checks: {}, timestamp: "now" };
    (apiClient.get as jest.Mock).mockResolvedValue({ data: systemHealth });

    const { result } = renderHook(() => useSystemHealth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.get).toHaveBeenCalledWith("/health");
    expect(result.current.data).toEqual(systemHealth);
  });

  it("provides status color and icon helpers", () => {
    expect(getStatusColor("healthy")).toContain("emerald");
    expect(getStatusColor("degraded")).toContain("yellow");
    expect(getStatusColor("unhealthy")).toContain("red");

    expect(getStatusIcon("healthy")).toBe("✓");
    expect(getStatusIcon("degraded")).toBe("⚠");
    expect(getStatusIcon("unhealthy")).toBe("✗");
  });
});
