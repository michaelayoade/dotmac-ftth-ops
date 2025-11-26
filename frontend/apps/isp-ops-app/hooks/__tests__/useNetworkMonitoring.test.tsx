/**
 * Jest Mock Tests for useNetworkMonitoring hooks
 * Tests API contracts, query/mutation configuration, and hook behavior
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
  useNetworkDashboardData,
  useDeviceDetails,
} from "../useNetworkMonitoring";
import { apiClient } from "@/lib/api/client";

// Mock apiClient
jest.mock("@/lib/api/client");
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Mock useToast
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Create a wrapper component with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useNetworkMonitoring", () => {
  describe("useNetworkOverview", () => {
    it("should fetch network overview successfully", async () => {
      const mockOverview = {
        total_devices: 15,
        online_devices: 12,
        offline_devices: 2,
        degraded_devices: 1,
        active_alerts: 5,
      };

      mockApiClient.get.mockResolvedValueOnce({ data: mockOverview });

      const { result } = renderHook(() => useNetworkOverview(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/network/overview");
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.total_devices).toBe(15);
      expect(result.current.data?.online_devices).toBe(12);
      expect(result.current.error).toBeNull();
    });

    it("should handle fetch error", async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error("Server error"));

      const { result } = renderHook(() => useNetworkOverview(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useNetworkDevices", () => {
    it("should fetch all devices successfully", async () => {
      const mockDevices = [
        { device_id: "dev-1", device_type: "olt", status: "online" },
        { device_id: "dev-2", device_type: "onu", status: "online" },
        { device_id: "dev-3", device_type: "router", status: "offline" },
      ];

      mockApiClient.get.mockResolvedValueOnce({ data: mockDevices });

      const { result } = renderHook(() => useNetworkDevices({}), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/network/devices?");
      expect(result.current.data).toHaveLength(3);
      expect(result.current.data?.[0].device_id).toBe("dev-1");
      expect(result.current.error).toBeNull();
    });

    it("should filter devices by type", async () => {
      const mockDevices = [
        { device_id: "dev-1", device_type: "olt", status: "online" },
        { device_id: "dev-3", device_type: "olt", status: "online" },
      ];

      mockApiClient.get.mockResolvedValueOnce({ data: mockDevices });

      const { result } = renderHook(() => useNetworkDevices({ device_type: "olt" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/network/devices?device_type=olt");
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.every((d) => d.device_type === "olt")).toBe(true);
    });

    it("should filter devices by status", async () => {
      const mockDevices = [
        { device_id: "dev-1", device_type: "olt", status: "online" },
        { device_id: "dev-3", device_type: "onu", status: "online" },
      ];

      mockApiClient.get.mockResolvedValueOnce({ data: mockDevices });

      const { result } = renderHook(() => useNetworkDevices({ status: "online" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/network/devices?status=online");
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.every((d) => d.status === "online")).toBe(true);
    });
  });

  describe("useDeviceHealth", () => {
    it("should fetch device health successfully", async () => {
      const mockDevice = {
        device_id: "dev-1",
        cpu_usage_percent: 65,
        memory_usage_percent: 70,
      };

      mockApiClient.get.mockResolvedValueOnce({ data: mockDevice });

      const { result } = renderHook(() => useDeviceHealth("dev-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/network/devices/dev-1/health");
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.device_id).toBe("dev-1");
      expect(result.current.data?.cpu_usage_percent).toBe(65);
    });

    it("should not fetch when deviceId is undefined", () => {
      const { result } = renderHook(() => useDeviceHealth(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it("should handle device not found error", async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error("Device not found"));

      const { result } = renderHook(() => useDeviceHealth("non-existent"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useDeviceMetrics", () => {
    it("should fetch device metrics successfully", async () => {
      const mockMetrics = { device_id: "dev-1", timestamp: "2025-01-01T00:00:00Z" };

      mockApiClient.get.mockResolvedValueOnce({ data: mockMetrics });

      const { result } = renderHook(() => useDeviceMetrics("dev-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/network/devices/dev-1/metrics");
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.device_id).toBe("dev-1");
    });

    it("should not fetch when deviceId is undefined", () => {
      const { result } = renderHook(() => useDeviceMetrics(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useDeviceTraffic", () => {
    it("should fetch device traffic successfully", async () => {
      const mockTraffic = { device_id: "dev-1", timestamp: "2025-01-01T00:00:00Z" };

      mockApiClient.get.mockResolvedValueOnce({ data: mockTraffic });

      const { result } = renderHook(() => useDeviceTraffic("dev-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/network/devices/dev-1/traffic");
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.device_id).toBe("dev-1");
    });

    it("should not fetch when deviceId is undefined", () => {
      const { result } = renderHook(() => useDeviceTraffic(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useNetworkAlerts", () => {
    it("should fetch all alerts successfully", async () => {
      const mockAlerts = [
        { alert_id: "alert-1", severity: "critical" },
        { alert_id: "alert-2", severity: "warning" },
        { alert_id: "alert-3", severity: "info" },
      ];

      mockApiClient.get.mockResolvedValueOnce({ data: mockAlerts });

      const { result } = renderHook(() => useNetworkAlerts({}), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/network/alerts?");
      expect(result.current.data).toHaveLength(3);
      expect(result.current.data?.[0].alert_id).toBe("alert-1");
    });

    it("should filter alerts by severity", async () => {
      const mockAlerts = [
        { alert_id: "alert-1", severity: "critical" },
        { alert_id: "alert-3", severity: "critical" },
      ];

      mockApiClient.get.mockResolvedValueOnce({ data: mockAlerts });

      const { result } = renderHook(() => useNetworkAlerts({ severity: "critical" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/network/alerts?severity=critical");
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.every((a) => a.severity === "critical")).toBe(true);
    });

    it("should filter active alerts only", async () => {
      const mockAlerts = [
        { alert_id: "alert-1", is_active: true },
        { alert_id: "alert-3", is_active: true },
      ];

      mockApiClient.get.mockResolvedValueOnce({ data: mockAlerts });

      const { result } = renderHook(() => useNetworkAlerts({ active_only: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/network/alerts?active_only=true");
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.every((a) => a.is_active)).toBe(true);
    });

    it("should filter alerts by device", async () => {
      const mockAlerts = [
        { alert_id: "alert-1", device_id: "dev-1" },
        { alert_id: "alert-3", device_id: "dev-1" },
      ];

      mockApiClient.get.mockResolvedValueOnce({ data: mockAlerts });

      const { result } = renderHook(() => useNetworkAlerts({ device_id: "dev-1" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/network/alerts?device_id=dev-1");
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.every((a) => a.device_id === "dev-1")).toBe(true);
    });

    it("should limit number of alerts", async () => {
      const mockAlerts = Array.from({ length: 5 }, (_, i) => ({
        alert_id: `alert-${i + 1}`,
      }));

      mockApiClient.get.mockResolvedValueOnce({ data: mockAlerts });

      const { result } = renderHook(() => useNetworkAlerts({ limit: 5 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/network/alerts?limit=5");
      expect(result.current.data).toHaveLength(5);
    });
  });

  describe("useAcknowledgeAlert", () => {
    it("should acknowledge alert successfully", async () => {
      const mockAlert = {
        alert_id: "alert-1",
        is_acknowledged: true,
      };

      mockApiClient.post.mockResolvedValueOnce({ data: mockAlert });

      const { result } = renderHook(() => useAcknowledgeAlert(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          alertId: "alert-1",
          data: { note: "Acknowledged" },
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockApiClient.post).toHaveBeenCalledWith("/network/alerts/alert-1/acknowledge", {
        note: "Acknowledged",
      });
      expect(result.current.data?.is_acknowledged).toBe(true);
    });

    it("should handle acknowledge error", async () => {
      mockApiClient.post.mockRejectedValueOnce(new Error("Alert not found"));

      const { result } = renderHook(() => useAcknowledgeAlert(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            alertId: "non-existent",
            data: {},
          });
        } catch (error) {
          // Expected to fail
        }
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useAlertRules", () => {
    it("should fetch alert rules successfully", async () => {
      const mockRules = [
        { rule_id: "rule-1", name: "High CPU" },
        { rule_id: "rule-2", name: "Low Memory" },
      ];

      mockApiClient.get.mockResolvedValueOnce({ data: mockRules });

      const { result } = renderHook(() => useAlertRules(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/network/alert-rules");
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].name).toBe("High CPU");
    });
  });

  describe("useCreateAlertRule", () => {
    it("should create alert rule successfully", async () => {
      const mockRule = {
        rule_id: "rule-1",
        name: "New Rule",
        metric_name: "cpu_usage_percent",
        condition: "gt",
        threshold: 90,
        severity: "critical",
        enabled: true,
      };

      mockApiClient.post.mockResolvedValueOnce({ data: mockRule });

      const { result } = renderHook(() => useCreateAlertRule(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          name: "New Rule",
          metric_name: "cpu_usage_percent",
          condition: "gt",
          threshold: 90,
          severity: "critical",
          enabled: true,
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockApiClient.post).toHaveBeenCalledWith("/network/alert-rules", {
        name: "New Rule",
        metric_name: "cpu_usage_percent",
        condition: "gt",
        threshold: 90,
        severity: "critical",
        enabled: true,
      });
      expect(result.current.data?.name).toBe("New Rule");
    });
  });

  describe("useNetworkDashboardData", () => {
    it("should fetch all dashboard data successfully", async () => {
      const mockOverview = { total_devices: 10 };
      const mockDevices = [{ device_id: "dev-1" }];
      const mockAlerts = [{ alert_id: "alert-1", is_active: true }];

      mockApiClient.get
        .mockResolvedValueOnce({ data: mockOverview })
        .mockResolvedValueOnce({ data: mockDevices })
        .mockResolvedValueOnce({ data: mockAlerts });

      const { result } = renderHook(() => useNetworkDashboardData(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.overview).toBeDefined();
      expect(result.current.devices).toHaveLength(1);
      expect(result.current.alerts).toHaveLength(1);
    });
  });

  describe("useDeviceDetails", () => {
    it("should fetch all device details successfully", async () => {
      const mockDevice = { device_id: "dev-1" };
      const mockMetrics = { device_id: "dev-1" };
      const mockTraffic = { device_id: "dev-1" };
      const mockAlerts = [{ alert_id: "alert-1", device_id: "dev-1", is_active: true }];

      mockApiClient.get
        .mockResolvedValueOnce({ data: mockDevice })
        .mockResolvedValueOnce({ data: mockMetrics })
        .mockResolvedValueOnce({ data: mockTraffic })
        .mockResolvedValueOnce({ data: mockAlerts });

      const { result } = renderHook(() => useDeviceDetails("dev-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.health).toBeDefined();
      expect(result.current.metrics).toBeDefined();
      expect(result.current.traffic).toBeDefined();
      expect(result.current.alerts).toHaveLength(1);
    });
  });
});
