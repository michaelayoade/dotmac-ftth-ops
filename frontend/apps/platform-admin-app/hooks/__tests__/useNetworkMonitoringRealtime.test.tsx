/**
 * Platform Admin App - useNetworkMonitoringRealtime tests
 *
 * Validates real-time monitoring hooks that combine GraphQL queries,
 * Apollo subscriptions, and toast side effects.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import {
  useNetworkOverviewRealtime,
  useNetworkDevicesRealtime,
  useNetworkAlertsRealtime,
  useNetworkDashboardRealtime,
  useWebSocketStatus,
  useRealtimeStats,
} from "../useNetworkMonitoringRealtime";
import { DeviceStatusEnum, DeviceTypeEnum, AlertSeverityEnum } from "@/lib/graphql/generated";

jest.unmock("@tanstack/react-query");

const mockToast = jest.fn();

jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

const mockUseNetworkOverviewGraphQL = jest.fn();
const mockUseNetworkDeviceListGraphQL = jest.fn();
const mockUseDeviceDetailGraphQL = jest.fn();
const mockUseNetworkAlertListGraphQL = jest.fn();

jest.mock("@/hooks/useNetworkGraphQL", () => ({
  useNetworkOverviewGraphQL: (...args: any[]) => mockUseNetworkOverviewGraphQL(...args),
  useNetworkDeviceListGraphQL: (...args: any[]) => mockUseNetworkDeviceListGraphQL(...args),
  useDeviceDetailGraphQL: (...args: any[]) => mockUseDeviceDetailGraphQL(...args),
  useNetworkAlertListGraphQL: (...args: any[]) => mockUseNetworkAlertListGraphQL(...args),
}));

const apolloClientMock = {
  query: jest.fn(),
  cache: {
    extract: jest.fn().mockReturnValue(null),
  },
};
const subscriptionRecords: Array<{ doc: unknown; options: any }> = [];

jest.mock("@apollo/client", () => {
  const actual = jest.requireActual("@apollo/client");
  return {
    ...actual,
    useSubscription: jest.fn((doc, options = {}) => {
      subscriptionRecords.push({ doc, options });
      return { data: null };
    }),
    useApolloClient: jest.fn(() => apolloClientMock),
    gql: actual.gql,
  };
});

const createDevices = () => [
  {
    deviceId: "dev-1",
    deviceName: "OLT-1",
    deviceType: DeviceTypeEnum.Olt,
    status: DeviceStatusEnum.Offline,
    ipAddress: "10.0.0.1",
    firmwareVersion: "1.0.0",
    cpuUsagePercent: 15,
    memoryUsagePercent: 30,
    temperatureCelsius: 45,
    uptimeSeconds: 1000,
    uptimeDays: 10,
    lastSeen: "2024-01-01T00:00:00Z",
    isHealthy: true,
    location: "HQ",
    model: "OLT-A",
    powerStatus: "normal",
    packetLossPercent: 0,
    pingLatencyMs: 4,
    tenantId: "tenant-1",
  },
];

describe("Platform Admin useNetworkMonitoringRealtime hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    subscriptionRecords.length = 0;
    apolloClientMock.query = jest.fn().mockResolvedValue({});
    apolloClientMock.cache.extract = jest.fn().mockReturnValue(null);

    mockUseNetworkOverviewGraphQL.mockReturnValue({
      overview: null,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseNetworkDeviceListGraphQL.mockReturnValue({
      devices: [],
      total: 0,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseDeviceDetailGraphQL.mockReturnValue({
      device: null,
      traffic: null,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseNetworkAlertListGraphQL.mockReturnValue({
      alerts: [],
      total: 0,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  it("maps overview GraphQL data to realtime summary", async () => {
    mockUseNetworkOverviewGraphQL.mockReturnValue({
      overview: {
        totalDevices: 100,
        onlineDevices: 90,
        offlineDevices: 10,
        activeAlerts: 5,
        criticalAlerts: 1,
        totalBandwidthGbps: 12.5,
        uptimePercentage: 99.9,
        deviceTypeSummary: [],
        recentAlerts: [],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { result } = renderHook(() => useNetworkOverviewRealtime());

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data).toMatchObject({
      totalDevices: 100,
      onlineDevices: 90,
      criticalAlerts: 1,
    });
  });

  it("updates device list via subscription and emits toast on status change", async () => {
    mockUseNetworkDeviceListGraphQL.mockReturnValue({
      devices: createDevices(),
      total: 1,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { result } = renderHook(() => useNetworkDevicesRealtime());

    await waitFor(() => expect(result.current.data).toHaveLength(1));

    const deviceSubscription = subscriptionRecords.find(
      (record) => record.options?.variables && "deviceType" in record.options.variables,
    );
    expect(deviceSubscription?.options.skip).toBe(false);

    const baseUpdate = {
      ...createDevices()[0],
      status: DeviceStatusEnum.Offline,
    };

    await act(async () => {
      deviceSubscription?.options?.onData?.({
        data: { data: { deviceUpdated: baseUpdate } },
      });
    });

    await act(async () => {
      deviceSubscription?.options?.onData?.({
        data: {
          data: {
            deviceUpdated: {
              ...baseUpdate,
              status: DeviceStatusEnum.Online,
            },
          },
        },
      });
    });

    await waitFor(() => expect(result.current.data?.[0].status).toBe(DeviceStatusEnum.Online));
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Device Online" }));
  });

  it("handles alert subscription updates and toast notifications", async () => {
    mockUseNetworkAlertListGraphQL.mockReturnValue({
      alerts: [
        {
          alertId: "alert-1",
          severity: AlertSeverityEnum.Warning,
          title: "Temp",
          deviceName: "OLT-1",
        },
      ],
      total: 1,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { result } = renderHook(() =>
      useNetworkAlertsRealtime({ severity: AlertSeverityEnum.Warning }),
    );

    await waitFor(() => expect(result.current.data).toHaveLength(1));

    const alertSubscription = subscriptionRecords.find(
      (record) => record.options?.variables && "severity" in record.options.variables,
    );
    expect(alertSubscription).toBeTruthy();

    await act(async () => {
      alertSubscription?.options?.onData?.({
        data: {
          data: {
            networkAlertUpdated: {
              action: "created",
              updatedAt: "now",
              alert: {
                alertId: "alert-99",
                severity: "critical",
                deviceName: "OLT-9",
                title: "Down",
              },
            },
          },
        },
      });
    });

    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Critical Alert" }));

    await act(async () => {
      alertSubscription?.options?.onData?.({
        data: {
          data: {
            networkAlertUpdated: {
              action: "resolved",
              updatedAt: "later",
              alert: {
                alertId: "alert-99",
                severity: "critical",
                deviceName: "OLT-9",
                title: "Down",
              },
            },
          },
        },
      });
    });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Alert Resolved" }));
  });

  it("aggregates dashboard data and refetches all sources", async () => {
    const overviewRefetch = jest.fn();
    const devicesRefetch = jest.fn();
    const alertsRefetch = jest.fn();

    mockUseNetworkOverviewGraphQL.mockReturnValue({
      overview: {
        totalDevices: 2,
        onlineDevices: 2,
        offlineDevices: 0,
        activeAlerts: 0,
        criticalAlerts: 0,
        totalBandwidthGbps: 1,
        uptimePercentage: 100,
        deviceTypeSummary: [],
        recentAlerts: [],
      },
      isLoading: false,
      error: null,
      refetch: overviewRefetch,
    });

    mockUseNetworkDeviceListGraphQL.mockReturnValue({
      devices: createDevices(),
      total: 1,
      isLoading: false,
      error: null,
      refetch: devicesRefetch,
    });

    mockUseNetworkAlertListGraphQL.mockReturnValue({
      alerts: [],
      total: 0,
      isLoading: false,
      error: null,
      refetch: alertsRefetch,
    });

    const { result } = renderHook(() => useNetworkDashboardRealtime());

    await waitFor(() => expect(result.current.devices).toHaveLength(1));
    expect(result.current.overview?.totalDevices).toBe(2);

    act(() => {
      result.current.refetch();
    });

    expect(overviewRefetch).toHaveBeenCalled();
    expect(devicesRefetch).toHaveBeenCalled();
    expect(alertsRefetch).toHaveBeenCalled();
  });

  it("tracks websocket connection health", async () => {
    jest.useFakeTimers();
    const error = new Error("offline");
    apolloClientMock.query = jest.fn().mockRejectedValue(error);

    const { result, unmount } = renderHook(() => useWebSocketStatus());

    await waitFor(() => expect(result.current.isConnected).toBe(false));
    expect(result.current.reconnectAttempts).toBeGreaterThan(0);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Connection Lost" }));

    unmount();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("returns default realtime stats", () => {
    const { result } = renderHook(() => useRealtimeStats());
    expect(result.current).toMatchObject({
      activeSubscriptions: 0,
      messagesReceived: 0,
    });
  });
});
