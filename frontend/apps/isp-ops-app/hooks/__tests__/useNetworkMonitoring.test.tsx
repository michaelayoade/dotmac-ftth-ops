/**
 * Tests for useNetworkMonitoring hooks
 * Tests network infrastructure monitoring and performance tracking with TanStack Query
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
  useNetworkDashboardData,
  useDeviceDetails,
} from "../useNetworkMonitoring";
import { apiClient } from "@/lib/api/client";
import type {
  NetworkOverview,
  DeviceHealth,
  DeviceMetrics,
  TrafficStats,
  NetworkAlert,
  AlertRule,
  DeviceType,
  DeviceStatus,
  AlertSeverity,
  InterfaceStats,
} from "@/types/network-monitoring";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

describe("useNetworkMonitoring", () => {
  function createWrapper() {
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
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== Network Overview ====================

  describe("useNetworkOverview", () => {
    it("should fetch network overview successfully", async () => {
      const mockOverview: NetworkOverview = {
        tenant_id: "tenant-1",
        timestamp: "2024-01-01T12:00:00Z",
        total_devices: 100,
        online_devices: 85,
        offline_devices: 10,
        degraded_devices: 5,
        active_alerts: 12,
        critical_alerts: 3,
        warning_alerts: 9,
        total_bandwidth_in_bps: 1000000000,
        total_bandwidth_out_bps: 500000000,
        peak_bandwidth_in_bps: 1500000000,
        peak_bandwidth_out_bps: 800000000,
        device_type_summary: [
          {
            device_type: "olt" as DeviceType,
            total_count: 10,
            online_count: 9,
            offline_count: 1,
            degraded_count: 0,
            avg_cpu_usage: 45.5,
            avg_memory_usage: 60.2,
          },
        ],
        recent_offline_devices: ["device-1", "device-2"],
        recent_alerts: [],
        data_source_status: {
          netbox: "healthy",
          prometheus: "healthy",
        },
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockOverview });

      const { result } = renderHook(() => useNetworkOverview(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockOverview);
      expect(apiClient.get).toHaveBeenCalledWith("/network/overview");
    });

    it("should auto-refresh every 30 seconds", async () => {
      jest.useFakeTimers();

      const mockOverview: NetworkOverview = {
        tenant_id: "tenant-1",
        timestamp: "2024-01-01T12:00:00Z",
        total_devices: 100,
        online_devices: 85,
        offline_devices: 10,
        degraded_devices: 5,
        active_alerts: 12,
        critical_alerts: 3,
        warning_alerts: 9,
        total_bandwidth_in_bps: 1000000000,
        total_bandwidth_out_bps: 500000000,
        device_type_summary: [],
        recent_offline_devices: [],
        recent_alerts: [],
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockOverview });

      renderHook(() => useNetworkOverview(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

      // Fast-forward 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));

      jest.useRealTimers();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch network overview");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useNetworkOverview(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should handle empty device type summary", async () => {
      const mockOverview: NetworkOverview = {
        tenant_id: "tenant-1",
        timestamp: "2024-01-01T12:00:00Z",
        total_devices: 0,
        online_devices: 0,
        offline_devices: 0,
        degraded_devices: 0,
        active_alerts: 0,
        critical_alerts: 0,
        warning_alerts: 0,
        total_bandwidth_in_bps: 0,
        total_bandwidth_out_bps: 0,
        device_type_summary: [],
        recent_offline_devices: [],
        recent_alerts: [],
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockOverview });

      const { result } = renderHook(() => useNetworkOverview(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.device_type_summary).toEqual([]);
      expect(result.current.data?.total_devices).toBe(0);
    });
  });

  // ==================== Network Devices ====================

  describe("useNetworkDevices", () => {
    it("should fetch network devices successfully", async () => {
      const mockDevices: DeviceHealth[] = [
        {
          device_id: "device-1",
          device_name: "OLT-1",
          device_type: "olt" as DeviceType,
          status: "online" as DeviceStatus,
          ip_address: "192.168.1.1",
          last_seen: "2024-01-01T12:00:00Z",
          uptime_seconds: 3600,
          cpu_usage_percent: 45.5,
          memory_usage_percent: 60.2,
          temperature_celsius: 42.5,
          ping_latency_ms: 5,
          packet_loss_percent: 0,
          firmware_version: "1.0.0",
          model: "OLT-1000",
          location: "Datacenter 1",
          tenant_id: "tenant-1",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockDevices });

      const { result } = renderHook(() => useNetworkDevices(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockDevices);
      expect(apiClient.get).toHaveBeenCalledWith("/network/devices?");
    });

    it("should filter by device type", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      renderHook(() => useNetworkDevices({ device_type: "olt" as DeviceType }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        const callArg = (apiClient.get as jest.Mock).mock.calls[0][0];
        expect(callArg).toContain("device_type=olt");
      });
    });

    it("should filter by device status", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      renderHook(() => useNetworkDevices({ status: "offline" as DeviceStatus }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        const callArg = (apiClient.get as jest.Mock).mock.calls[0][0];
        expect(callArg).toContain("status=offline");
      });
    });

    it("should handle all device types", async () => {
      const deviceTypes: DeviceType[] = ["olt", "onu", "cpe", "router", "switch", "firewall", "other"];

      for (const deviceType of deviceTypes) {
        const mockDevices: DeviceHealth[] = [
          {
            device_id: "device-1",
            device_name: `${deviceType}-1`,
            device_type: deviceType,
            status: "online" as DeviceStatus,
            tenant_id: "tenant-1",
          },
        ];

        (apiClient.get as jest.Mock).mockResolvedValue({ data: mockDevices });

        const { result } = renderHook(() => useNetworkDevices({ device_type: deviceType }), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.[0].device_type).toBe(deviceType);

        jest.clearAllMocks();
      }
    });

    it("should handle all device statuses", async () => {
      const statuses: DeviceStatus[] = ["online", "offline", "degraded", "unknown"];

      for (const status of statuses) {
        const mockDevices: DeviceHealth[] = [
          {
            device_id: "device-1",
            device_name: "Device-1",
            device_type: "olt" as DeviceType,
            status,
            tenant_id: "tenant-1",
          },
        ];

        (apiClient.get as jest.Mock).mockResolvedValue({ data: mockDevices });

        const { result } = renderHook(() => useNetworkDevices({ status }), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.[0].status).toBe(status);

        jest.clearAllMocks();
      }
    });

    it("should auto-refresh every 15 seconds", async () => {
      jest.useFakeTimers();

      const mockDevices: DeviceHealth[] = [];
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockDevices });

      renderHook(() => useNetworkDevices(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

      // Fast-forward 15 seconds
      act(() => {
        jest.advanceTimersByTime(15000);
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));

      jest.useRealTimers();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch devices");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useNetworkDevices(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  // ==================== Device Health ====================

  describe("useDeviceHealth", () => {
    it("should fetch device health successfully", async () => {
      const mockHealth: DeviceHealth = {
        device_id: "device-1",
        device_name: "OLT-1",
        device_type: "olt" as DeviceType,
        status: "online" as DeviceStatus,
        ip_address: "192.168.1.1",
        cpu_usage_percent: 45.5,
        memory_usage_percent: 60.2,
        temperature_celsius: 42.5,
        ping_latency_ms: 5,
        packet_loss_percent: 0,
        tenant_id: "tenant-1",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });

      const { result } = renderHook(() => useDeviceHealth("device-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockHealth);
      expect(apiClient.get).toHaveBeenCalledWith("/network/devices/device-1/health");
    });

    it("should not fetch when deviceId is undefined", async () => {
      const { result } = renderHook(() => useDeviceHealth(undefined), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should auto-refresh every 15 seconds", async () => {
      jest.useFakeTimers();

      const mockHealth: DeviceHealth = {
        device_id: "device-1",
        device_name: "OLT-1",
        device_type: "olt" as DeviceType,
        status: "online" as DeviceStatus,
        tenant_id: "tenant-1",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHealth });

      renderHook(() => useDeviceHealth("device-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

      // Fast-forward 15 seconds
      act(() => {
        jest.advanceTimersByTime(15000);
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));

      jest.useRealTimers();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Device not found");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useDeviceHealth("device-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  // ==================== Device Metrics ====================

  describe("useDeviceMetrics", () => {
    it("should fetch device metrics successfully", async () => {
      const mockMetrics: DeviceMetrics = {
        device_id: "device-1",
        device_name: "OLT-1",
        device_type: "olt" as DeviceType,
        timestamp: "2024-01-01T12:00:00Z",
        health: {
          device_id: "device-1",
          device_name: "OLT-1",
          device_type: "olt" as DeviceType,
          status: "online" as DeviceStatus,
          tenant_id: "tenant-1",
        },
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockMetrics });

      const { result } = renderHook(() => useDeviceMetrics("device-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockMetrics);
      expect(apiClient.get).toHaveBeenCalledWith("/network/devices/device-1/metrics");
    });

    it("should not fetch when deviceId is undefined", async () => {
      const { result } = renderHook(() => useDeviceMetrics(undefined), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should auto-refresh every 30 seconds", async () => {
      jest.useFakeTimers();

      const mockMetrics: DeviceMetrics = {
        device_id: "device-1",
        device_name: "OLT-1",
        device_type: "olt" as DeviceType,
        timestamp: "2024-01-01T12:00:00Z",
        health: {
          device_id: "device-1",
          device_name: "OLT-1",
          device_type: "olt" as DeviceType,
          status: "online" as DeviceStatus,
          tenant_id: "tenant-1",
        },
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockMetrics });

      renderHook(() => useDeviceMetrics("device-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

      // Fast-forward 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));

      jest.useRealTimers();
    });

    it("should handle ONU metrics", async () => {
      const mockMetrics: DeviceMetrics = {
        device_id: "onu-1",
        device_name: "ONU-1",
        device_type: "onu" as DeviceType,
        timestamp: "2024-01-01T12:00:00Z",
        health: {
          device_id: "onu-1",
          device_name: "ONU-1",
          device_type: "onu" as DeviceType,
          status: "online" as DeviceStatus,
          tenant_id: "tenant-1",
        },
        onu_metrics: {
          serial_number: "SN123456",
          optical_power_rx_dbm: -20.5,
          optical_power_tx_dbm: 2.3,
          olt_rx_power_dbm: -22.1,
          distance_meters: 1500,
          state: "active",
        },
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockMetrics });

      const { result } = renderHook(() => useDeviceMetrics("onu-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.onu_metrics).toBeDefined();
      expect(result.current.data?.onu_metrics?.serial_number).toBe("SN123456");
    });

    it("should handle CPE metrics", async () => {
      const mockMetrics: DeviceMetrics = {
        device_id: "cpe-1",
        device_name: "CPE-1",
        device_type: "cpe" as DeviceType,
        timestamp: "2024-01-01T12:00:00Z",
        health: {
          device_id: "cpe-1",
          device_name: "CPE-1",
          device_type: "cpe" as DeviceType,
          status: "online" as DeviceStatus,
          tenant_id: "tenant-1",
        },
        cpe_metrics: {
          mac_address: "AA:BB:CC:DD:EE:FF",
          wifi_enabled: true,
          connected_clients: 5,
          wifi_2ghz_clients: 3,
          wifi_5ghz_clients: 2,
          wan_ip: "203.0.113.1",
          last_inform: "2024-01-01T12:00:00Z",
        },
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockMetrics });

      const { result } = renderHook(() => useDeviceMetrics("cpe-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.cpe_metrics).toBeDefined();
      expect(result.current.data?.cpe_metrics?.connected_clients).toBe(5);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch metrics");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useDeviceMetrics("device-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  // ==================== Device Traffic ====================

  describe("useDeviceTraffic", () => {
    it("should fetch device traffic successfully", async () => {
      const mockTraffic: TrafficStats = {
        device_id: "device-1",
        device_name: "OLT-1",
        timestamp: "2024-01-01T12:00:00Z",
        total_bytes_in: 1000000000,
        total_bytes_out: 500000000,
        total_packets_in: 1000000,
        total_packets_out: 500000,
        current_rate_in_bps: 100000000,
        current_rate_out_bps: 50000000,
        peak_rate_in_bps: 150000000,
        peak_rate_out_bps: 80000000,
        peak_timestamp: "2024-01-01T10:00:00Z",
        interfaces: [
          {
            interface_name: "eth0",
            status: "up",
            speed_mbps: 1000,
            bytes_in: 500000000,
            bytes_out: 250000000,
            packets_in: 500000,
            packets_out: 250000,
            errors_in: 0,
            errors_out: 0,
            drops_in: 0,
            drops_out: 0,
            rate_in_bps: 50000000,
            rate_out_bps: 25000000,
            utilization_percent: 5,
          },
        ],
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockTraffic });

      const { result } = renderHook(() => useDeviceTraffic("device-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockTraffic);
      expect(apiClient.get).toHaveBeenCalledWith("/network/devices/device-1/traffic");
    });

    it("should not fetch when deviceId is undefined", async () => {
      const { result } = renderHook(() => useDeviceTraffic(undefined), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should auto-refresh every 10 seconds", async () => {
      jest.useFakeTimers();

      const mockTraffic: TrafficStats = {
        device_id: "device-1",
        device_name: "OLT-1",
        timestamp: "2024-01-01T12:00:00Z",
        total_bytes_in: 1000000000,
        total_bytes_out: 500000000,
        total_packets_in: 1000000,
        total_packets_out: 500000,
        current_rate_in_bps: 100000000,
        current_rate_out_bps: 50000000,
        interfaces: [],
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockTraffic });

      renderHook(() => useDeviceTraffic("device-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

      // Fast-forward 10 seconds
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));

      jest.useRealTimers();
    });

    it("should handle interface statuses", async () => {
      const statuses = ["up", "down", "admin_down", "testing"];

      for (const status of statuses) {
        const mockInterface: InterfaceStats = {
          interface_name: "eth0",
          status,
          bytes_in: 1000,
          bytes_out: 500,
          packets_in: 100,
          packets_out: 50,
          errors_in: 0,
          errors_out: 0,
          drops_in: 0,
          drops_out: 0,
        };

        const mockTraffic: TrafficStats = {
          device_id: "device-1",
          device_name: "OLT-1",
          timestamp: "2024-01-01T12:00:00Z",
          total_bytes_in: 1000,
          total_bytes_out: 500,
          total_packets_in: 100,
          total_packets_out: 50,
          current_rate_in_bps: 100,
          current_rate_out_bps: 50,
          interfaces: [mockInterface],
        };

        (apiClient.get as jest.Mock).mockResolvedValue({ data: mockTraffic });

        const { result } = renderHook(() => useDeviceTraffic("device-1"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.interfaces[0].status).toBe(status);

        jest.clearAllMocks();
      }
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch traffic");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useDeviceTraffic("device-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  // ==================== Network Alerts ====================

  describe("useNetworkAlerts", () => {
    it("should fetch network alerts successfully", async () => {
      const mockAlerts: NetworkAlert[] = [
        {
          alert_id: "alert-1",
          severity: "critical" as AlertSeverity,
          title: "High CPU Usage",
          description: "CPU usage exceeded 90%",
          device_id: "device-1",
          device_name: "OLT-1",
          device_type: "olt" as DeviceType,
          triggered_at: "2024-01-01T12:00:00Z",
          is_active: true,
          is_acknowledged: false,
          metric_name: "cpu_usage_percent",
          threshold_value: 90,
          current_value: 95,
          alert_rule_id: "rule-1",
          tenant_id: "tenant-1",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockAlerts });

      const { result } = renderHook(() => useNetworkAlerts(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockAlerts);
      expect(apiClient.get).toHaveBeenCalledWith("/network/alerts?");
    });

    it("should filter by severity", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      renderHook(() => useNetworkAlerts({ severity: "critical" as AlertSeverity }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        const callArg = (apiClient.get as jest.Mock).mock.calls[0][0];
        expect(callArg).toContain("severity=critical");
      });
    });

    it("should filter by active_only", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      renderHook(() => useNetworkAlerts({ active_only: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        const callArg = (apiClient.get as jest.Mock).mock.calls[0][0];
        expect(callArg).toContain("active_only=true");
      });
    });

    it("should filter by device_id", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      renderHook(() => useNetworkAlerts({ device_id: "device-1" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        const callArg = (apiClient.get as jest.Mock).mock.calls[0][0];
        expect(callArg).toContain("device_id=device-1");
      });
    });

    it("should filter by limit", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      renderHook(() => useNetworkAlerts({ limit: 50 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        const callArg = (apiClient.get as jest.Mock).mock.calls[0][0];
        expect(callArg).toContain("limit=50");
      });
    });

    it("should handle all alert severities", async () => {
      const severities: AlertSeverity[] = ["critical", "warning", "info"];

      for (const severity of severities) {
        const mockAlerts: NetworkAlert[] = [
          {
            alert_id: "alert-1",
            severity,
            title: "Test Alert",
            description: "Test description",
            triggered_at: "2024-01-01T12:00:00Z",
            is_active: true,
            is_acknowledged: false,
            tenant_id: "tenant-1",
          },
        ];

        (apiClient.get as jest.Mock).mockResolvedValue({ data: mockAlerts });

        const { result } = renderHook(() => useNetworkAlerts({ severity }), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.[0].severity).toBe(severity);

        jest.clearAllMocks();
      }
    });

    it("should auto-refresh every 15 seconds", async () => {
      jest.useFakeTimers();

      const mockAlerts: NetworkAlert[] = [];
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockAlerts });

      renderHook(() => useNetworkAlerts(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

      // Fast-forward 15 seconds
      act(() => {
        jest.advanceTimersByTime(15000);
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));

      jest.useRealTimers();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch alerts");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useNetworkAlerts(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  // ==================== Acknowledge Alert ====================

  describe("useAcknowledgeAlert", () => {
    it("should acknowledge alert successfully", async () => {
      const mockAlert: NetworkAlert = {
        alert_id: "alert-1",
        severity: "critical" as AlertSeverity,
        title: "High CPU Usage",
        description: "CPU usage exceeded 90%",
        triggered_at: "2024-01-01T12:00:00Z",
        acknowledged_at: "2024-01-01T12:05:00Z",
        is_active: true,
        is_acknowledged: true,
        tenant_id: "tenant-1",
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockAlert });

      const { result } = renderHook(() => useAcknowledgeAlert(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          alertId: "alert-1",
          data: { note: "Investigating issue" },
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/network/alerts/alert-1/acknowledge", {
        note: "Investigating issue",
      });
    });

    it("should acknowledge alert without note", async () => {
      const mockAlert: NetworkAlert = {
        alert_id: "alert-1",
        severity: "critical" as AlertSeverity,
        title: "High CPU Usage",
        description: "CPU usage exceeded 90%",
        triggered_at: "2024-01-01T12:00:00Z",
        is_active: true,
        is_acknowledged: true,
        tenant_id: "tenant-1",
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockAlert });

      const { result } = renderHook(() => useAcknowledgeAlert(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          alertId: "alert-1",
          data: {},
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/network/alerts/alert-1/acknowledge", {});
    });

    it("should invalidate queries on success", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const mockAlert: NetworkAlert = {
        alert_id: "alert-1",
        severity: "critical" as AlertSeverity,
        title: "High CPU Usage",
        description: "CPU usage exceeded 90%",
        triggered_at: "2024-01-01T12:00:00Z",
        is_active: true,
        is_acknowledged: true,
        tenant_id: "tenant-1",
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockAlert });

      const { result } = renderHook(() => useAcknowledgeAlert(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          alertId: "alert-1",
          data: {},
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["network", "alerts"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["network", "overview"] });
    });

    it("should handle error", async () => {
      const error = { response: { data: { detail: "Alert not found" } } };
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useAcknowledgeAlert(), {
        wrapper: createWrapper(),
      });

      let errorOccurred = false;
      await act(async () => {
        try {
          await result.current.mutateAsync({
            alertId: "alert-1",
            data: {},
          });
        } catch (err) {
          errorOccurred = true;
        }
      });

      expect(errorOccurred).toBe(true);
    });
  });

  // ==================== Alert Rules ====================

  describe("useAlertRules", () => {
    it("should fetch alert rules successfully", async () => {
      const mockRules: AlertRule[] = [
        {
          rule_id: "rule-1",
          tenant_id: "tenant-1",
          name: "High CPU Alert",
          description: "Alert when CPU exceeds threshold",
          device_type: "olt" as DeviceType,
          metric_name: "cpu_usage_percent",
          condition: "gt",
          threshold: 90,
          severity: "critical" as AlertSeverity,
          enabled: true,
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockRules });

      const { result } = renderHook(() => useAlertRules(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockRules);
      expect(apiClient.get).toHaveBeenCalledWith("/network/alert-rules");
    });

    it("should auto-refresh every 60 seconds", async () => {
      jest.useFakeTimers();

      const mockRules: AlertRule[] = [];
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockRules });

      renderHook(() => useAlertRules(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

      // Fast-forward 60 seconds
      act(() => {
        jest.advanceTimersByTime(60000);
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));

      jest.useRealTimers();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch alert rules");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useAlertRules(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  // ==================== Create Alert Rule ====================

  describe("useCreateAlertRule", () => {
    it("should create alert rule successfully", async () => {
      const mockRule: AlertRule = {
        rule_id: "rule-1",
        tenant_id: "tenant-1",
        name: "High CPU Alert",
        description: "Alert when CPU exceeds threshold",
        device_type: "olt" as DeviceType,
        metric_name: "cpu_usage_percent",
        condition: "gt",
        threshold: 90,
        severity: "critical" as AlertSeverity,
        enabled: true,
        created_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockRule });

      const { result } = renderHook(() => useCreateAlertRule(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          name: "High CPU Alert",
          description: "Alert when CPU exceeds threshold",
          device_type: "olt" as DeviceType,
          metric_name: "cpu_usage_percent",
          condition: "gt",
          threshold: 90,
          severity: "critical" as AlertSeverity,
          enabled: true,
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/network/alert-rules", {
        name: "High CPU Alert",
        description: "Alert when CPU exceeds threshold",
        device_type: "olt",
        metric_name: "cpu_usage_percent",
        condition: "gt",
        threshold: 90,
        severity: "critical",
        enabled: true,
      });
    });

    it("should invalidate queries on success", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const mockRule: AlertRule = {
        rule_id: "rule-1",
        tenant_id: "tenant-1",
        name: "High CPU Alert",
        metric_name: "cpu_usage_percent",
        condition: "gt",
        threshold: 90,
        severity: "critical" as AlertSeverity,
        enabled: true,
        created_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockRule });

      const { result } = renderHook(() => useCreateAlertRule(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          name: "High CPU Alert",
          metric_name: "cpu_usage_percent",
          condition: "gt",
          threshold: 90,
          severity: "critical" as AlertSeverity,
          enabled: true,
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["network", "alert-rules"] });
    });

    it("should handle error", async () => {
      const error = { response: { data: { detail: "Invalid threshold" } } };
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCreateAlertRule(), {
        wrapper: createWrapper(),
      });

      let errorOccurred = false;
      await act(async () => {
        try {
          await result.current.mutateAsync({
            name: "High CPU Alert",
            metric_name: "cpu_usage_percent",
            condition: "gt",
            threshold: 90,
            severity: "critical" as AlertSeverity,
            enabled: true,
          });
        } catch (err) {
          errorOccurred = true;
        }
      });

      expect(errorOccurred).toBe(true);
    });
  });

  // ==================== Composite Hooks ====================

  describe("useNetworkDashboardData", () => {
    it("should fetch all dashboard data successfully", async () => {
      const mockOverview: NetworkOverview = {
        tenant_id: "tenant-1",
        timestamp: "2024-01-01T12:00:00Z",
        total_devices: 100,
        online_devices: 85,
        offline_devices: 10,
        degraded_devices: 5,
        active_alerts: 12,
        critical_alerts: 3,
        warning_alerts: 9,
        total_bandwidth_in_bps: 1000000000,
        total_bandwidth_out_bps: 500000000,
        device_type_summary: [],
        recent_offline_devices: [],
        recent_alerts: [],
      };

      const mockDevices: DeviceHealth[] = [
        {
          device_id: "device-1",
          device_name: "OLT-1",
          device_type: "olt" as DeviceType,
          status: "online" as DeviceStatus,
          tenant_id: "tenant-1",
        },
      ];

      const mockAlerts: NetworkAlert[] = [
        {
          alert_id: "alert-1",
          severity: "critical" as AlertSeverity,
          title: "High CPU Usage",
          description: "CPU usage exceeded 90%",
          triggered_at: "2024-01-01T12:00:00Z",
          is_active: true,
          is_acknowledged: false,
          tenant_id: "tenant-1",
        },
      ];

      (apiClient.get as jest.Mock)
        .mockResolvedValueOnce({ data: mockOverview })
        .mockResolvedValueOnce({ data: mockDevices })
        .mockResolvedValueOnce({ data: mockAlerts });

      const { result } = renderHook(() => useNetworkDashboardData(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.overview).toEqual(mockOverview);
      expect(result.current.devices).toEqual(mockDevices);
      expect(result.current.alerts).toEqual(mockAlerts);
      expect(result.current.error).toBeFalsy();
    });

    it("should handle loading state", async () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: [] }), 100))
      );

      const { result } = renderHook(() => useNetworkDashboardData(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 200 });
    });

    it("should handle errors", async () => {
      const error = new Error("Failed to fetch overview");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useNetworkDashboardData(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should expose refetch function", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useNetworkDashboardData(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      (apiClient.get as jest.Mock).mockClear();

      await act(async () => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalled();
      });
    });
  });

  describe("useDeviceDetails", () => {
    it("should fetch all device details successfully", async () => {
      const mockHealth: DeviceHealth = {
        device_id: "device-1",
        device_name: "OLT-1",
        device_type: "olt" as DeviceType,
        status: "online" as DeviceStatus,
        tenant_id: "tenant-1",
      };

      const mockMetrics: DeviceMetrics = {
        device_id: "device-1",
        device_name: "OLT-1",
        device_type: "olt" as DeviceType,
        timestamp: "2024-01-01T12:00:00Z",
        health: mockHealth,
      };

      const mockTraffic: TrafficStats = {
        device_id: "device-1",
        device_name: "OLT-1",
        timestamp: "2024-01-01T12:00:00Z",
        total_bytes_in: 1000000000,
        total_bytes_out: 500000000,
        total_packets_in: 1000000,
        total_packets_out: 500000,
        current_rate_in_bps: 100000000,
        current_rate_out_bps: 50000000,
        interfaces: [],
      };

      const mockAlerts: NetworkAlert[] = [
        {
          alert_id: "alert-1",
          severity: "critical" as AlertSeverity,
          title: "High CPU Usage",
          description: "CPU usage exceeded 90%",
          device_id: "device-1",
          triggered_at: "2024-01-01T12:00:00Z",
          is_active: true,
          is_acknowledged: false,
          tenant_id: "tenant-1",
        },
      ];

      (apiClient.get as jest.Mock)
        .mockResolvedValueOnce({ data: mockHealth })
        .mockResolvedValueOnce({ data: mockMetrics })
        .mockResolvedValueOnce({ data: mockTraffic })
        .mockResolvedValueOnce({ data: mockAlerts });

      const { result } = renderHook(() => useDeviceDetails("device-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.health).toEqual(mockHealth);
      expect(result.current.metrics).toEqual(mockMetrics);
      expect(result.current.traffic).toEqual(mockTraffic);
      expect(result.current.alerts).toEqual(mockAlerts);
    });

    it("should not fetch when deviceId is undefined", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useDeviceDetails(undefined), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.health).toBeUndefined();
      expect(result.current.metrics).toBeUndefined();
      expect(result.current.traffic).toBeUndefined();

      // The alerts query still runs because it doesn't depend on deviceId being defined
      // It will just filter by device_id=undefined which returns empty results
      const getCallsForDeviceEndpoints = (apiClient.get as jest.Mock).mock.calls.filter(
        call => call[0].includes("/network/devices/")
      );
      expect(getCallsForDeviceEndpoints).toHaveLength(0);
    });

    it("should handle loading state", async () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100))
      );

      const { result } = renderHook(() => useDeviceDetails("device-1"), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 200 });
    });

    it("should handle errors", async () => {
      const error = new Error("Device not found");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useDeviceDetails("device-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should expose refetch function", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useDeviceDetails("device-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      (apiClient.get as jest.Mock).mockClear();

      await act(async () => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalled();
      });
    });
  });
});
