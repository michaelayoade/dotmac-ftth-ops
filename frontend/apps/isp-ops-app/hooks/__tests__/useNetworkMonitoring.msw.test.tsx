/**
 * MSW-powered tests for useNetworkMonitoring
 *
 * This test file uses MSW for API mocking instead of jest.mock.
 * MSW provides more realistic network mocking and better test isolation.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
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
import {
  createTestQueryClient,
  createQueryWrapper,
  resetNetworkMonitoringStorage,
  createMockNetworkOverview,
  createMockDevice,
  createMockDeviceMetrics,
  createMockTrafficStats,
  createMockAlert,
  createMockAlertRule,
  seedNetworkMonitoringData,
  makeApiEndpointFail,
} from "../../__tests__/test-utils";

describe("useNetworkMonitoring (MSW)", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    resetNetworkMonitoringStorage();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("useNetworkOverview", () => {
    it("should fetch network overview successfully", async () => {
      const mockOverview = createMockNetworkOverview({
        total_devices: 15,
        online_devices: 12,
        offline_devices: 2,
        degraded_devices: 1,
        active_alerts: 5,
      });

      seedNetworkMonitoringData(mockOverview, [], [], []);

      const { result } = renderHook(() => useNetworkOverview(), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.total_devices).toBe(15);
      expect(result.current.data?.online_devices).toBe(12);
      expect(result.current.error).toBeNull();
    });

    it("should handle fetch error", async () => {
      makeApiEndpointFail('get', '/network/overview', 'Server error');

      const { result } = renderHook(() => useNetworkOverview(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useNetworkDevices", () => {
    it("should fetch all devices successfully", async () => {
      const mockDevices = [
        createMockDevice({ device_id: "dev-1", device_type: "olt", status: "online" }),
        createMockDevice({ device_id: "dev-2", device_type: "onu", status: "online" }),
        createMockDevice({ device_id: "dev-3", device_type: "router", status: "offline" }),
      ];

      seedNetworkMonitoringData(null, mockDevices, [], []);

      const { result } = renderHook(() => useNetworkDevices({}), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(3);
      expect(result.current.data?.[0].device_id).toBe("dev-1");
      expect(result.current.error).toBeNull();
    });

    it("should filter devices by type", async () => {
      const mockDevices = [
        createMockDevice({ device_type: "olt" }),
        createMockDevice({ device_type: "onu" }),
        createMockDevice({ device_type: "olt" }),
      ];

      seedNetworkMonitoringData(null, mockDevices, [], []);

      const { result } = renderHook(() => useNetworkDevices({ device_type: "olt" }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.every((d) => d.device_type === "olt")).toBe(true);
    });

    it("should filter devices by status", async () => {
      const mockDevices = [
        createMockDevice({ status: "online" }),
        createMockDevice({ status: "offline" }),
        createMockDevice({ status: "online" }),
      ];

      seedNetworkMonitoringData(null, mockDevices, [], []);

      const { result } = renderHook(() => useNetworkDevices({ status: "online" }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.every((d) => d.status === "online")).toBe(true);
    });
  });

  describe("useDeviceHealth", () => {
    it("should fetch device health successfully", async () => {
      const mockDevice = createMockDevice({
        device_id: "dev-1",
        cpu_usage_percent: 65,
        memory_usage_percent: 70,
      });

      seedNetworkMonitoringData(null, [mockDevice], [], []);

      const { result } = renderHook(() => useDeviceHealth("dev-1"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.device_id).toBe("dev-1");
      expect(result.current.data?.cpu_usage_percent).toBe(65);
    });

    it("should not fetch when deviceId is undefined", () => {
      const { result } = renderHook(() => useDeviceHealth(undefined), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it("should handle device not found error", async () => {
      seedNetworkMonitoringData(null, [], [], []);

      const { result } = renderHook(() => useDeviceHealth("non-existent"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useDeviceMetrics", () => {
    it("should fetch device metrics successfully", async () => {
      const mockDevice = createMockDevice({ device_id: "dev-1" });

      seedNetworkMonitoringData(null, [mockDevice], [], []);

      const { result } = renderHook(() => useDeviceMetrics("dev-1"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.device_id).toBe("dev-1");
    });

    it("should not fetch when deviceId is undefined", () => {
      const { result } = renderHook(() => useDeviceMetrics(undefined), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useDeviceTraffic", () => {
    it("should fetch device traffic successfully", async () => {
      const mockDevice = createMockDevice({ device_id: "dev-1" });

      seedNetworkMonitoringData(null, [mockDevice], [], []);

      const { result } = renderHook(() => useDeviceTraffic("dev-1"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.device_id).toBe("dev-1");
    });

    it("should not fetch when deviceId is undefined", () => {
      const { result } = renderHook(() => useDeviceTraffic(undefined), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useNetworkAlerts", () => {
    it("should fetch all alerts successfully", async () => {
      const mockAlerts = [
        createMockAlert({ alert_id: "alert-1", severity: "critical" }),
        createMockAlert({ alert_id: "alert-2", severity: "warning" }),
        createMockAlert({ alert_id: "alert-3", severity: "info" }),
      ];

      seedNetworkMonitoringData(null, [], mockAlerts, []);

      const { result } = renderHook(() => useNetworkAlerts({}), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(3);
      expect(result.current.data?.[0].alert_id).toBe("alert-1");
    });

    it("should filter alerts by severity", async () => {
      const mockAlerts = [
        createMockAlert({ severity: "critical" }),
        createMockAlert({ severity: "warning" }),
        createMockAlert({ severity: "critical" }),
      ];

      seedNetworkMonitoringData(null, [], mockAlerts, []);

      const { result } = renderHook(() => useNetworkAlerts({ severity: "critical" }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.every((a) => a.severity === "critical")).toBe(true);
    });

    it("should filter active alerts only", async () => {
      const mockAlerts = [
        createMockAlert({ is_active: true }),
        createMockAlert({ is_active: false }),
        createMockAlert({ is_active: true }),
      ];

      seedNetworkMonitoringData(null, [], mockAlerts, []);

      const { result } = renderHook(() => useNetworkAlerts({ active_only: true }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.every((a) => a.is_active)).toBe(true);
    });

    it("should filter alerts by device", async () => {
      const mockAlerts = [
        createMockAlert({ device_id: "dev-1" }),
        createMockAlert({ device_id: "dev-2" }),
        createMockAlert({ device_id: "dev-1" }),
      ];

      seedNetworkMonitoringData(null, [], mockAlerts, []);

      const { result } = renderHook(() => useNetworkAlerts({ device_id: "dev-1" }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.every((a) => a.device_id === "dev-1")).toBe(true);
    });

    it("should limit number of alerts", async () => {
      const mockAlerts = Array.from({ length: 20 }, (_, i) =>
        createMockAlert({ alert_id: `alert-${i + 1}` })
      );

      seedNetworkMonitoringData(null, [], mockAlerts, []);

      const { result } = renderHook(() => useNetworkAlerts({ limit: 5 }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(5);
    });
  });

  describe("useAcknowledgeAlert", () => {
    it("should acknowledge alert successfully", async () => {
      const mockAlert = createMockAlert({
        alert_id: "alert-1",
        is_acknowledged: false,
      });

      seedNetworkMonitoringData(null, [], [mockAlert], []);

      const { result } = renderHook(() => useAcknowledgeAlert(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          alertId: "alert-1",
          data: { note: "Acknowledged" },
        });
      });

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.is_acknowledged).toBe(true);
    });

    it("should handle acknowledge error", async () => {
      seedNetworkMonitoringData(null, [], [], []);

      const { result } = renderHook(() => useAcknowledgeAlert(), {
        wrapper: createQueryWrapper(queryClient),
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

      expect(result.current.isError).toBe(true);
    });
  });

  describe("useAlertRules", () => {
    it("should fetch alert rules successfully", async () => {
      const mockRules = [
        createMockAlertRule({ rule_id: "rule-1", name: "High CPU" }),
        createMockAlertRule({ rule_id: "rule-2", name: "Low Memory" }),
      ];

      seedNetworkMonitoringData(null, [], [], mockRules);

      const { result } = renderHook(() => useAlertRules(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].name).toBe("High CPU");
    });
  });

  describe("useCreateAlertRule", () => {
    it("should create alert rule successfully", async () => {
      seedNetworkMonitoringData(null, [], [], []);

      const { result } = renderHook(() => useCreateAlertRule(), {
        wrapper: createQueryWrapper(queryClient),
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

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.name).toBe("New Rule");
    });
  });

  describe("useNetworkDashboardData", () => {
    it("should fetch all dashboard data successfully", async () => {
      const mockOverview = createMockNetworkOverview();
      const mockDevices = [createMockDevice()];
      const mockAlerts = [createMockAlert({ is_active: true })];

      seedNetworkMonitoringData(mockOverview, mockDevices, mockAlerts, []);

      const { result } = renderHook(() => useNetworkDashboardData(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.overview).toBeDefined();
      expect(result.current.devices).toHaveLength(1);
      expect(result.current.alerts).toHaveLength(1);
    });
  });

  describe("useDeviceDetails", () => {
    it("should fetch all device details successfully", async () => {
      const mockDevice = createMockDevice({ device_id: "dev-1" });
      const mockAlerts = [createMockAlert({ device_id: "dev-1", is_active: true })];

      seedNetworkMonitoringData(null, [mockDevice], mockAlerts, []);

      const { result } = renderHook(() => useDeviceDetails("dev-1"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.health).toBeDefined();
      expect(result.current.metrics).toBeDefined();
      expect(result.current.traffic).toBeDefined();
      expect(result.current.alerts).toHaveLength(1);
    });
  });
});
