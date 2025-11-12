/**
 * Tests for useHealth hook
 * Tests health check functionality with auto-refresh
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useHealth } from "../useHealth";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import axios from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.mock("axios", () => ({
  isAxiosError: jest.fn(),
}));

describe("useHealth", () => {
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
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("should fetch health data successfully with direct health summary", async () => {
    const mockHealth = {
      status: "healthy",
      healthy: true,
      services: [
        { name: "database", status: "healthy" as const, message: "OK", required: true },
        { name: "redis", status: "healthy" as const, message: "OK", required: false },
      ],
      failed_services: [],
      version: "1.0.0",
      timestamp: "2024-01-01T00:00:00Z",
    };

    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });

    const { result } = renderHook(() => useHealth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.health).toEqual(mockHealth);
    expect(result.current.error).toBeNull();
    expect(apiClient.get).toHaveBeenCalledWith("/ready");
  });

  it("should handle success wrapper response format", async () => {
    const mockHealth = {
      status: "healthy",
      healthy: true,
      services: [],
      failed_services: [],
    };

    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        data: mockHealth,
      },
    });

    const { result } = renderHook(() => useHealth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.health).toEqual(mockHealth);
  });

  it("should handle error wrapper response format", async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {
        error: { message: "Service degraded" },
      },
    });

    const { result } = renderHook(() => useHealth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Service degraded");
    expect(result.current.health?.status).toBe("degraded");
    expect(result.current.health?.healthy).toBe(false);
  });

  it("should handle unknown response format", async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: { unknown: "format" },
    });

    const { result } = renderHook(() => useHealth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.health?.status).toBe("unknown");
    expect(result.current.health?.healthy).toBe(false);
  });

  it("should handle 403 forbidden error", async () => {
    (axios.isAxiosError as jest.Mock).mockReturnValue(true);
    (apiClient.get as jest.Mock).mockRejectedValue({
      response: { status: 403 },
    });

    const { result } = renderHook(() => useHealth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.health?.status).toBe("forbidden");
    expect(result.current.error).toBe("You do not have permission to view service health.");
    expect(logger.error).toHaveBeenCalled();
  });

  it("should handle network error", async () => {
    const networkError = new Error("Network error");
    (axios.isAxiosError as jest.Mock).mockReturnValue(false);
    (apiClient.get as jest.Mock).mockRejectedValue(networkError);

    const { result } = renderHook(() => useHealth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.health?.status).toBe("degraded");
    expect(result.current.error).toBe("Service health is temporarily unavailable.");
    expect(logger.error).toHaveBeenCalledWith("Failed to fetch health data", networkError);
  });

  it("should set loading state correctly", async () => {
    (apiClient.get as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100))
    );

    const { result } = renderHook(() => useHealth(), { wrapper: createWrapper() });

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 200 });
  });

  it("should auto-refresh health every 30 seconds", async () => {
    const mockHealth = { status: "healthy", healthy: true, services: [], failed_services: [] };
    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });

    const { result } = renderHook(() => useHealth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(apiClient.get).toHaveBeenCalledTimes(1);

    // Fast-forward 30 seconds
    act(() => {
      jest.advanceTimersByTime(30000);
    });

    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));

    // Fast-forward another 30 seconds
    act(() => {
      jest.advanceTimersByTime(30000);
    });

    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(3));
  });

  it("should expose refreshHealth function", async () => {
    const mockHealth = { status: "healthy", healthy: true, services: [], failed_services: [] };
    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });

    const { result } = renderHook(() => useHealth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(apiClient.get).toHaveBeenCalledTimes(1);

    // Manually trigger refresh
    await act(async () => {
      await result.current.refreshHealth();
    });

    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it("should clean up interval on unmount", async () => {
    const mockHealth = { status: "healthy", healthy: true, services: [], failed_services: [] };
    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });

    const { unmount } = renderHook(() => useHealth(), { wrapper: createWrapper() });

    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

    unmount();

    // Fast-forward time and verify no more calls
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    // Should still be 1 call (no new calls after unmount)
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });

  it("should handle non-Error objects in catch", async () => {
    (axios.isAxiosError as jest.Mock).mockReturnValue(false);
    (apiClient.get as jest.Mock).mockRejectedValue("string error");

    const { result } = renderHook(() => useHealth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.health?.status).toBe("degraded");
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to fetch health data",
      expect.any(Error)
    );
  });

  it("should include all health properties", async () => {
    const mockHealth = {
      status: "healthy",
      healthy: true,
      services: [
        {
          name: "database",
          status: "healthy" as const,
          message: "OK",
          required: true,
          uptime: 99.9,
          responseTime: 45,
          lastCheck: "2024-01-01T00:00:00Z",
        },
      ],
      failed_services: [],
      version: "1.0.0",
      timestamp: "2024-01-01T00:00:00Z",
    };

    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });

    const { result } = renderHook(() => useHealth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.health).toEqual(mockHealth);
    expect(result.current.health?.services[0].uptime).toBe(99.9);
    expect(result.current.health?.services[0].responseTime).toBe(45);
  });
});
