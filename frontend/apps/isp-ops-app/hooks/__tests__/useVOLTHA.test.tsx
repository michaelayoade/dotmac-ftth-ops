/**
 * Jest-based unit tests for useVOLTHA hooks
 *
 * Tests React Query hooks for VOLTHA PON management operations using Jest mocks
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useVOLTHAHealth,
  useOLTs,
  useOLTOverview,
  useONUs,
  useONU,
  useVOLTHAAlarms,
  usePONPortStatistics,
  useDiscoveredONUs,
  useVOLTHADashboard,
  useProvisionONU,
  useDeviceOperation,
  useAcknowledgeAlarm,
  useClearAlarm,
  volthaKeys,
} from "../useVOLTHA";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock the API client
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const { apiClient } = require("@/lib/api/client") as {
  apiClient: {
    get: jest.Mock;
    post: jest.Mock;
  };
};

// Create a test query client
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

// Create wrapper with QueryClient
const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useVOLTHA Hooks", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.useRealTimers();
    queryClient = createTestQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("Query Key Factory", () => {
    it("generates correct query keys", () => {
      expect(volthaKeys.all).toEqual(["voltha"]);
      expect(volthaKeys.health()).toEqual(["voltha", "health"]);
      expect(volthaKeys.olts()).toEqual(["voltha", "olts"]);
      expect(volthaKeys.oltOverview("olt-1")).toEqual(["voltha", "olt", "olt-1", "overview"]);
      expect(volthaKeys.onus()).toEqual(["voltha", "onus"]);
      expect(volthaKeys.alarms()).toEqual(["voltha", "alarms"]);
      expect(volthaKeys.alarms("device-1")).toEqual(["voltha", "alarms", "device", "device-1"]);
      expect(volthaKeys.portStatistics("olt-1", 1)).toEqual([
        "voltha",
        "port-statistics",
        "olt-1",
        1,
      ]);
      expect(volthaKeys.discoveredONUs()).toEqual(["voltha", "discovered-onus"]);
    });
  });

  describe("useVOLTHAHealth", () => {
    it("fetches VOLTHA health status successfully", async () => {
      const mockHealth = {
        healthy: true,
        state: "HEALTHY",
        message: "All systems operational",
      };

      apiClient.get.mockResolvedValue({ data: mockHealth });

      const { result } = renderHook(() => useVOLTHAHealth(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockHealth);
      expect(result.current.data?.healthy).toBe(true);
      expect(apiClient.get).toHaveBeenCalledWith("/access/health");
    });

    it("handles health check error", async () => {
      apiClient.get.mockRejectedValue(new Error("Service unavailable"));

      const { result } = renderHook(() => useVOLTHAHealth(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useOLTs", () => {
    it("fetches OLT devices successfully", async () => {
      const mockOLTs = [
        {
          id: "olt-1",
          root_device_id: "device-1",
          desc: { serial_num: "SN12345" },
        },
        {
          id: "olt-2",
          root_device_id: "device-2",
          desc: { serial_num: "SN67890" },
        },
      ];

      apiClient.get.mockResolvedValue({ data: { devices: mockOLTs } });

      const { result } = renderHook(() => useOLTs(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].id).toBe("olt-1");
      expect(apiClient.get).toHaveBeenCalledWith("/access/logical-devices");
    });

    it("handles empty OLT list", async () => {
      apiClient.get.mockResolvedValue({ data: { devices: [] } });

      const { result } = renderHook(() => useOLTs(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(0);
    });
  });

  describe("useOLTOverview", () => {
    it("fetches OLT overview successfully", async () => {
      const mockOverview = {
        model: "OLT-XG-PON-16",
        firmware_version: "2.5.1",
        oper_status: "ACTIVE",
        pon_ports: [
          {
            port_no: 1,
            label: "PON-1/1/1",
            oper_status: "ACTIVE",
            total_onus: 32,
            online_onus: 30,
            utilization_percent: 75.5,
          },
        ],
      };

      apiClient.get.mockResolvedValue({ data: mockOverview });

      const { result } = renderHook(() => useOLTOverview("olt-1"), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.model).toBe("OLT-XG-PON-16");
      expect(result.current.data?.pon_ports).toHaveLength(1);
      expect(apiClient.get).toHaveBeenCalledWith("/access/olts/olt-1/overview");
    });

    it("does not fetch when oltId is null", () => {
      const { result } = renderHook(() => useOLTOverview(null), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.fetchStatus).toBe("idle");
      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });

  describe("useONUs", () => {
    it("fetches ONU devices successfully", async () => {
      const mockONUs = [
        {
          id: "onu-1",
          serial_number: "ALCL12345678",
          vendor: "Nokia",
          model: "G-010G-A",
          oper_status: "ACTIVE",
        },
        {
          id: "onu-2",
          serial_number: "HWTC87654321",
          vendor: "Huawei",
          model: "HG8245H",
          oper_status: "ACTIVE",
        },
      ];

      apiClient.get.mockResolvedValue({ data: { devices: mockONUs } });

      const { result } = renderHook(() => useONUs(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].serial_number).toBe("ALCL12345678");
      expect(apiClient.get).toHaveBeenCalledWith("/access/devices");
    });
  });

  describe("useONU", () => {
    it("fetches single ONU details successfully", async () => {
      const mockONU = {
        id: "onu-1",
        serial_number: "ALCL12345678",
        vendor: "Nokia",
        metadata: {
          olt_id: "olt-1",
          pon_port: 1,
        },
      };

      apiClient.get.mockResolvedValue({ data: mockONU });

      const { result } = renderHook(() => useONU("onu-1"), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.serial_number).toBe("ALCL12345678");
      expect(apiClient.get).toHaveBeenCalledWith("/access/devices/onu-1");
    });
  });

  describe("useVOLTHAAlarms", () => {
    it("fetches all alarms successfully", async () => {
      const mockAlarms = [
        {
          id: "alarm-1",
          type: "EQUIPMENT_ALARM",
          severity: "CRITICAL",
          state: "RAISED",
          device_id: "onu-1",
        },
        {
          id: "alarm-2",
          type: "COMMUNICATION_ALARM",
          severity: "MAJOR",
          state: "RAISED",
          device_id: "olt-1",
        },
      ];

      apiClient.get.mockResolvedValue({ data: { alarms: mockAlarms } });

      const { result } = renderHook(() => useVOLTHAAlarms(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].severity).toBe("CRITICAL");
      expect(apiClient.get).toHaveBeenCalledWith("/access/alarms");
    });

    it("fetches device-specific alarms", async () => {
      const mockAlarms = [
        {
          id: "alarm-1",
          type: "EQUIPMENT_ALARM",
          severity: "CRITICAL",
          state: "RAISED",
          device_id: "onu-1",
        },
      ];

      apiClient.get.mockResolvedValue({ data: { alarms: mockAlarms } });

      const { result } = renderHook(() => useVOLTHAAlarms("onu-1"), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(apiClient.get).toHaveBeenCalledWith("/access/devices/onu-1/alarms");
    });
  });

  describe("usePONPortStatistics", () => {
    it("fetches port statistics successfully", async () => {
      const mockStats = {
        rx_power: -22.5,
        tx_power: 2.3,
        temperature: 45.2,
        rx_errors: 0,
        tx_errors: 0,
      };

      apiClient.get.mockResolvedValue({ data: mockStats });

      const { result } = renderHook(() => usePONPortStatistics("olt-1", 1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.rx_power).toBe(-22.5);
      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/access/devices/olt-1/ports/1/statistics");
    });
  });

  describe("useDiscoveredONUs", () => {
    it("does not fetch when not triggered (enabled: false)", () => {
      const { result } = renderHook(() => useDiscoveredONUs(), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.fetchStatus).toBe("idle");
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("fetches discovered ONUs when enabled is true", async () => {
      const mockDiscoveredONUs = [
        {
          serial_number: "NEWONU123456",
          state: "DISCOVERED",
          metadata: { olt_id: "olt-1", pon_port: 1 },
        },
        {
          serial_number: "NEWONU789012",
          state: "DISCOVERED",
          metadata: { olt_id: "olt-1", pon_port: 2 },
        },
      ];

      apiClient.get.mockResolvedValue({ data: mockDiscoveredONUs });

      const { result } = renderHook(() => useDiscoveredONUs({ enabled: true }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].serial_number).toBe("NEWONU123456");
      expect(apiClient.get).toHaveBeenCalledWith("/access/discover-onus");
    });
  });

  describe("useVOLTHADashboard", () => {
    it("fetches all dashboard data successfully", async () => {
      apiClient.get.mockImplementation((url: string) => {
        if (url === "/access/health") {
          return Promise.resolve({
            data: { healthy: true, state: "HEALTHY", message: "OK" },
          });
        }
        if (url === "/access/logical-devices") {
          return Promise.resolve({ data: { devices: [{ id: "olt-1" }] } });
        }
        if (url === "/access/devices") {
          return Promise.resolve({ data: { devices: [{ id: "onu-1" }] } });
        }
        if (url === "/access/alarms") {
          return Promise.resolve({ data: { alarms: [] } });
        }
        return Promise.reject(new Error("Unknown URL"));
      });

      const { result } = renderHook(() => useVOLTHADashboard(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.health).toBeDefined();
      expect(result.current.olts).toHaveLength(1);
      expect(result.current.onus).toHaveLength(1);
      expect(result.current.alarms).toHaveLength(0);
    });

    it("provides refetch function", async () => {
      apiClient.get.mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useVOLTHADashboard(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(typeof result.current.refetch).toBe("function");

      await act(async () => {
        result.current.refetch();
      });

      // Verify refetch was called
      expect(apiClient.get).toHaveBeenCalled();
    });
  });

  describe("useProvisionONU", () => {
    it("provisions ONU successfully", async () => {
      const mockRequest = {
        serial_number: "NEWONU123456",
        olt_device_id: "olt-1",
        pon_port: 1,
        subscriber_id: "sub-123",
        vlan: 100,
      };

      const mockResponse = {
        success: true,
        message: "ONU provisioned successfully",
        device_id: "onu-new-1",
      };

      apiClient.post.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useProvisionONU(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate(mockRequest);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/access/olts/olt-1/onus", mockRequest);
    });

    it("handles provisioning error", async () => {
      const mockRequest = {
        serial_number: "INVALID",
        olt_device_id: "olt-1",
        pon_port: 1,
      };

      apiClient.post.mockRejectedValue(new Error("Invalid serial number format"));

      const { result } = renderHook(() => useProvisionONU(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate(mockRequest);
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeTruthy();
    });

    it("calls onSuccess callback", async () => {
      const onSuccess = jest.fn();
      const mockRequest = {
        serial_number: "NEWONU123456",
        olt_device_id: "olt-1",
        pon_port: 1,
      };

      apiClient.post.mockResolvedValue({ data: { success: true } });

      const { result } = renderHook(() => useProvisionONU({ onSuccess }), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate(mockRequest);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(onSuccess).toHaveBeenCalledWith({ success: true });
    });

    it("invalidates cache after successful provisioning", async () => {
      const mockRequest = {
        serial_number: "NEWONU123456",
        olt_device_id: "olt-1",
        pon_port: 1,
      };

      apiClient.post.mockResolvedValue({ data: { success: true } });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useProvisionONU(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate(mockRequest);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: volthaKeys.onus() });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: volthaKeys.discoveredONUs(),
      });
    });
  });

  describe("useDeviceOperation", () => {
    it("performs device enable operation", async () => {
      apiClient.post.mockResolvedValue({
        data: { success: true, message: "Device enabled", device_id: "onu-1" },
      });

      const { result } = renderHook(() => useDeviceOperation(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({
          deviceId: "onu-1",
          operation: "enable",
          oltId: "olt-1",
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(apiClient.post).toHaveBeenCalledWith("/access/devices/onu-1/enable?olt_id=olt-1");
    });

    it("performs device reboot operation", async () => {
      apiClient.post.mockResolvedValue({
        data: { success: true, message: "Device rebooting", device_id: "onu-1" },
      });

      const { result } = renderHook(() => useDeviceOperation(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({
          deviceId: "onu-1",
          operation: "reboot",
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(apiClient.post).toHaveBeenCalledWith("/access/devices/onu-1/reboot");
    });
  });

  describe("useAcknowledgeAlarm", () => {
    it("acknowledges alarm successfully", async () => {
      apiClient.post.mockResolvedValue({
        data: { success: true, message: "Alarm acknowledged" },
      });

      const { result } = renderHook(() => useAcknowledgeAlarm(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate("alarm-1");
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Mutation returns the alarmId
      expect(result.current.data).toBe("alarm-1");
      expect(apiClient.post).toHaveBeenCalledWith("/access/alarms/alarm-1/acknowledge");
    });

    it("invalidates alarms cache after acknowledgment", async () => {
      apiClient.post.mockResolvedValue({ data: { success: true } });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useAcknowledgeAlarm(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate("alarm-1");
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: volthaKeys.alarms() });
    });

    it("surfaces feature-flag/driver 501 details gracefully", async () => {
      apiClient.post.mockRejectedValue({
        response: {
          status: 501,
          data: { detail: "Alarm acknowledgement is disabled by feature flag" },
        },
      });

      const { result } = renderHook(() => useAcknowledgeAlarm(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate("alarm-1");
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toContain("feature flag");
    });
  });

  describe("useClearAlarm", () => {
    it("clears alarm successfully", async () => {
      apiClient.post.mockResolvedValue({
        data: { success: true, message: "Alarm cleared" },
      });

      const { result } = renderHook(() => useClearAlarm(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate("alarm-1");
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Mutation returns the alarmId
      expect(result.current.data).toBe("alarm-1");
      expect(apiClient.post).toHaveBeenCalledWith("/access/alarms/alarm-1/clear");
    });

    it("invalidates alarms cache after clearing", async () => {
      apiClient.post.mockResolvedValue({ data: { success: true } });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useClearAlarm(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate("alarm-1");
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: volthaKeys.alarms() });
    });

    it("surfaces feature-flag/driver 501 details gracefully", async () => {
      apiClient.post.mockRejectedValue({
        response: { status: 501, data: { detail: "Alarm clear is disabled by feature flag" } },
      });

      const { result } = renderHook(() => useClearAlarm(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate("alarm-1");
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toContain("feature flag");
    });
  });
});
