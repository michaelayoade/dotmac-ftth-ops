/**
 * Platform Admin App - useNetworkMonitoring tests
 *
 * Validates critical TanStack query + mutation hooks that power the
 * network health dashboards (fetches, filtering, cache invalidations, toasts).
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useNetworkOverview,
  useNetworkDevices,
  useDeviceHealth,
  useDeviceMetrics,
  useDeviceTraffic,
  useNetworkAlerts,
  useAcknowledgeAlert,
  useAlertRules,
  useCreateAlertRule,
} from "../useNetworkMonitoring";
import { apiClient } from "@/lib/api/client";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const global.mockToast = jest.fn();

jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: global.mockToast,
  }),
}));

describe("Platform Admin useNetworkMonitoring hooks", () => {
  const createWrapper = (client?: QueryClient) => {
    const queryClient =
      client ??
      new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches network overview data", async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { total_devices: 10 } });

    const { result } = renderHook(() => useNetworkOverview(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.get).toHaveBeenCalledWith("/network/overview");
    expect(result.current.data).toEqual({ total_devices: 10 });
  });

  it("fetches network devices with filters", async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

    const { result } = renderHook(
      () =>
        useNetworkDevices({
          device_type: "olt" as any,
          status: "online" as any,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.get).toHaveBeenCalledWith("/network/devices?device_type=olt&status=online");
  });

  it("fetches device health/metrics/traffic by id", async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { id: "device-1" } });

    const wrapper = createWrapper();

    const { result: health } = renderHook(() => useDeviceHealth("device-1"), { wrapper });
    await waitFor(() => expect(health.current.isSuccess).toBe(true));
    expect(apiClient.get).toHaveBeenCalledWith("/network/devices/device-1/health");

    (apiClient.get as jest.Mock).mockResolvedValue({ data: { id: "device-1", metrics: [] } });
    const { result: metrics } = renderHook(() => useDeviceMetrics("device-1"), { wrapper });
    await waitFor(() => expect(metrics.current.isSuccess).toBe(true));
    expect(apiClient.get).toHaveBeenCalledWith("/network/devices/device-1/metrics");

    (apiClient.get as jest.Mock).mockResolvedValue({ data: { id: "device-1", traffic: [] } });
    const { result: traffic } = renderHook(() => useDeviceTraffic("device-1"), { wrapper });
    await waitFor(() => expect(traffic.current.isSuccess).toBe(true));
    expect(apiClient.get).toHaveBeenCalledWith("/network/devices/device-1/traffic");
  });

  it("does not fetch device resources when id is missing", () => {
    renderHook(() => useDeviceHealth(undefined), { wrapper: createWrapper() });
    renderHook(() => useDeviceMetrics(undefined), { wrapper: createWrapper() });
    renderHook(() => useDeviceTraffic(undefined), { wrapper: createWrapper() });

    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it("fetches network alerts with query params", async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

    const { result } = renderHook(
      () =>
        useNetworkAlerts({
          severity: "critical" as any,
          active_only: true,
          device_id: "dev-1",
          limit: 5,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.get).toHaveBeenCalledWith(
      "/network/alerts?severity=critical&active_only=true&device_id=dev-1&limit=5",
    );
  });

  it("acknowledges alerts and invalidates caches", async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: "alert-1" } });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = createWrapper(queryClient);
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useAcknowledgeAlert(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        alertId: "alert-1",
        data: { acknowledged_by: "user" } as any,
      });
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      "/network/alerts/alert-1/acknowledge",
      expect.any(Object),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["network", "alerts"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["network", "overview"] });
    expect(global.mockToast).toHaveBeenCalledWith({
      title: "Alert Acknowledged",
      description: "The alert has been acknowledged successfully",
    });
  });

  it("fetches alert rules", async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: [{ id: "rule-1" }] });
    const { result } = renderHook(() => useAlertRules(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.get).toHaveBeenCalledWith("/network/alert-rules");
    expect(result.current.data).toEqual([{ id: "rule-1" }]);
  });

  it("creates alert rules and invalidates list", async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: "rule-99", name: "CPU" } });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = createWrapper(queryClient);
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateAlertRule(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: "CPU" } as any);
    });

    expect(apiClient.post).toHaveBeenCalledWith("/network/alert-rules", { name: "CPU" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["network", "alert-rules"] });
    expect(global.mockToast).toHaveBeenCalledWith({
      title: "Alert Rule Created",
      description: 'Alert rule "CPU" has been created successfully',
    });
  });
});
