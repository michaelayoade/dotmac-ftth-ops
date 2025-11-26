/**
 * Jest Tests for useWirelessGraphQL Hooks
 *
 * Tests all wireless network GraphQL hooks with Jest mocks.
 * Covers access points, wireless clients, coverage zones, RF analytics,
 * channel utilization, site metrics, dashboard, and utility functions.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { createApolloWrapper } from "@/__tests__/test-utils";
import {
  useAccessPointListGraphQL,
  useAccessPointDetailGraphQL,
  useAccessPointsBySiteGraphQL,
  useWirelessClientListGraphQL,
  useWirelessClientDetailGraphQL,
  useWirelessClientsByAccessPointGraphQL,
  useWirelessClientsByCustomerGraphQL,
  useCoverageZoneListGraphQL,
  useCoverageZoneDetailGraphQL,
  useCoverageZonesBySiteGraphQL,
  useRfAnalyticsGraphQL,
  useChannelUtilizationGraphQL,
  useWirelessSiteMetricsGraphQL,
  useWirelessDashboardGraphQL,
  calculateSignalQuality,
  getSignalQualityLabel,
  getFrequencyBandLabel,
} from "../useWirelessGraphQL";
import * as generatedHooks from "@/lib/graphql/generated";
import { AccessPointStatus, FrequencyBand } from "@/lib/graphql/generated";

// Mock the generated GraphQL hooks
jest.mock("@/lib/graphql/generated", () => ({
  ...jest.requireActual("@/lib/graphql/generated"),
  useAccessPointListQuery: jest.fn(),
  useAccessPointDetailQuery: jest.fn(),
  useAccessPointsBySiteQuery: jest.fn(),
  useWirelessClientListQuery: jest.fn(),
  useWirelessClientDetailQuery: jest.fn(),
  useWirelessClientsByAccessPointQuery: jest.fn(),
  useWirelessClientsByCustomerQuery: jest.fn(),
  useCoverageZoneListQuery: jest.fn(),
  useCoverageZoneDetailQuery: jest.fn(),
  useCoverageZonesBySiteQuery: jest.fn(),
  useRfAnalyticsQuery: jest.fn(),
  useChannelUtilizationQuery: jest.fn(),
  useWirelessSiteMetricsQuery: jest.fn(),
  useWirelessDashboardQuery: jest.fn(),
  AccessPointStatus: {
    Online: "ONLINE",
    Offline: "OFFLINE",
    Degraded: "DEGRADED",
  },
  FrequencyBand: {
    Band_2_4Ghz: "BAND_2_4GHZ",
    Band_5Ghz: "BAND_5GHZ",
    Band_6Ghz: "BAND_6GHZ",
  },
}));

// Test data factories
const createMockAccessPoint = (overrides: any = {}) => ({
  id: "ap-001",
  name: "AP-Building-A-01",
  status: AccessPointStatus.Online,
  macAddress: "00:11:22:33:44:55",
  ipAddress: "192.168.1.100",
  siteId: "site-001",
  model: "UniFi 6 Pro",
  firmwareVersion: "6.0.21",
  connectedClients: 15,
  uptime: 3600000,
  location: { latitude: 40.7128, longitude: -74.006 },
  ...overrides,
});

const createMockWirelessClient = (overrides: any = {}) => ({
  id: "client-001",
  macAddress: "AA:BB:CC:DD:EE:FF",
  hostname: "laptop-001",
  ipAddress: "10.0.0.50",
  accessPointId: "ap-001",
  customerId: "customer-001",
  frequencyBand: FrequencyBand.Band_5Ghz,
  rssi: -55,
  snr: 40,
  txRate: 866,
  rxRate: 780,
  connectedAt: "2024-01-01T10:00:00Z",
  ...overrides,
});

const createMockCoverageZone = (overrides: any = {}) => ({
  id: "zone-001",
  name: "Building A Coverage",
  siteId: "site-001",
  accessPoints: ["ap-001", "ap-002"],
  coverageArea: 5000,
  ...overrides,
});

describe("useWirelessGraphQL - Access Point Hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useAccessPointListGraphQL", () => {
    it("should fetch access point list successfully", async () => {
      const mockAccessPoints = [
        createMockAccessPoint({ id: "ap-001" }),
        createMockAccessPoint({ id: "ap-002" }),
      ];

      (generatedHooks.useAccessPointListQuery as jest.Mock).mockReturnValue({
        data: {
          accessPoints: {
            accessPoints: mockAccessPoints,
            totalCount: 2,
            hasNextPage: false,
          },
        },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useAccessPointListGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.accessPoints).toEqual(mockAccessPoints);
      expect(result.current.total).toBe(2);
      expect(result.current.hasNextPage).toBe(false);
    });

    it("should handle empty access point list", async () => {
      (generatedHooks.useAccessPointListQuery as jest.Mock).mockReturnValue({
        data: {
          accessPoints: {
            accessPoints: [],
            totalCount: 0,
            hasNextPage: false,
          },
        },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useAccessPointListGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.accessPoints).toEqual([]);
      expect(result.current.total).toBe(0);
    });

    it("should respect query options", () => {
      (generatedHooks.useAccessPointListQuery as jest.Mock).mockReturnValue({
        data: undefined,
        loading: true,
        error: undefined,
        refetch: jest.fn(),
      });

      renderHook(
        () =>
          useAccessPointListGraphQL({
            limit: 100,
            offset: 50,
            status: AccessPointStatus.Online,
            siteId: "site-001",
            search: "building-a",
          }),
        { wrapper: createApolloWrapper() },
      );

      expect(generatedHooks.useAccessPointListQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            limit: 100,
            offset: 50,
            status: AccessPointStatus.Online,
            siteId: "site-001",
            search: "building-a",
          },
        }),
      );
    });

    it("should handle errors", async () => {
      const error = new Error("Failed to fetch access points");

      (generatedHooks.useAccessPointListQuery as jest.Mock).mockReturnValue({
        data: undefined,
        loading: false,
        error,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useAccessPointListGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBe("Failed to fetch access points");
      });
    });
  });

  describe("useAccessPointDetailGraphQL", () => {
    it("should fetch access point detail successfully", async () => {
      const mockAP = createMockAccessPoint();

      (generatedHooks.useAccessPointDetailQuery as jest.Mock).mockReturnValue({
        data: { accessPoint: mockAP },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useAccessPointDetailGraphQL({ id: "ap-001" }), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.accessPoint).toEqual(mockAP);
    });

    it("should not fetch when enabled is false", () => {
      (generatedHooks.useAccessPointDetailQuery as jest.Mock).mockReturnValue({
        data: undefined,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      renderHook(() => useAccessPointDetailGraphQL({ id: "ap-001", enabled: false }), {
        wrapper: createApolloWrapper(),
      });

      expect(generatedHooks.useAccessPointDetailQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: true,
        }),
      );
    });
  });

  describe("useAccessPointsBySiteGraphQL", () => {
    it("should fetch access points by site", async () => {
      const mockAPs = [createMockAccessPoint({ siteId: "site-001" })];

      (generatedHooks.useAccessPointsBySiteQuery as jest.Mock).mockReturnValue({
        data: { accessPointsBySite: mockAPs },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useAccessPointsBySiteGraphQL({ siteId: "site-001" }), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.accessPoints).toEqual(mockAPs);
    });
  });
});

describe("useWirelessGraphQL - Wireless Client Hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useWirelessClientListGraphQL", () => {
    it("should fetch wireless client list successfully", async () => {
      const mockClients = [
        createMockWirelessClient({ id: "client-001" }),
        createMockWirelessClient({ id: "client-002" }),
      ];

      (generatedHooks.useWirelessClientListQuery as jest.Mock).mockReturnValue({
        data: {
          wirelessClients: {
            clients: mockClients,
            totalCount: 2,
            hasNextPage: false,
          },
        },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useWirelessClientListGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.clients).toEqual(mockClients);
      expect(result.current.total).toBe(2);
    });

    it("should filter by frequency band", () => {
      (generatedHooks.useWirelessClientListQuery as jest.Mock).mockReturnValue({
        data: undefined,
        loading: true,
        error: undefined,
        refetch: jest.fn(),
      });

      renderHook(() => useWirelessClientListGraphQL({ frequencyBand: FrequencyBand.Band_5Ghz }), {
        wrapper: createApolloWrapper(),
      });

      expect(generatedHooks.useWirelessClientListQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            frequencyBand: FrequencyBand.Band_5Ghz,
          }),
        }),
      );
    });
  });

  describe("useWirelessClientDetailGraphQL", () => {
    it("should fetch wireless client detail", async () => {
      const mockClient = createMockWirelessClient();

      (generatedHooks.useWirelessClientDetailQuery as jest.Mock).mockReturnValue({
        data: { wirelessClient: mockClient },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useWirelessClientDetailGraphQL({ id: "client-001" }), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.client).toEqual(mockClient);
    });
  });

  describe("useWirelessClientsByAccessPointGraphQL", () => {
    it("should fetch clients by access point", async () => {
      const mockClients = [createMockWirelessClient({ accessPointId: "ap-001" })];

      (generatedHooks.useWirelessClientsByAccessPointQuery as jest.Mock).mockReturnValue({
        data: { wirelessClientsByAccessPoint: mockClients },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(
        () => useWirelessClientsByAccessPointGraphQL({ accessPointId: "ap-001" }),
        { wrapper: createApolloWrapper() },
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.clients).toEqual(mockClients);
    });
  });

  describe("useWirelessClientsByCustomerGraphQL", () => {
    it("should fetch clients by customer", async () => {
      const mockClients = [createMockWirelessClient({ customerId: "customer-001" })];

      (generatedHooks.useWirelessClientsByCustomerQuery as jest.Mock).mockReturnValue({
        data: { wirelessClientsByCustomer: mockClients },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(
        () => useWirelessClientsByCustomerGraphQL({ customerId: "customer-001" }),
        { wrapper: createApolloWrapper() },
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.clients).toEqual(mockClients);
    });
  });
});

describe("useWirelessGraphQL - Coverage Zone Hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useCoverageZoneListGraphQL", () => {
    it("should fetch coverage zone list", async () => {
      const mockZones = [createMockCoverageZone()];

      (generatedHooks.useCoverageZoneListQuery as jest.Mock).mockReturnValue({
        data: {
          coverageZones: {
            zones: mockZones,
            totalCount: 1,
            hasNextPage: false,
          },
        },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useCoverageZoneListGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.zones).toEqual(mockZones);
    });
  });

  describe("useCoverageZoneDetailGraphQL", () => {
    it("should fetch coverage zone detail", async () => {
      const mockZone = createMockCoverageZone();

      (generatedHooks.useCoverageZoneDetailQuery as jest.Mock).mockReturnValue({
        data: { coverageZone: mockZone },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useCoverageZoneDetailGraphQL({ id: "zone-001" }), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.zone).toEqual(mockZone);
    });
  });

  describe("useCoverageZonesBySiteGraphQL", () => {
    it("should fetch coverage zones by site", async () => {
      const mockZones = [createMockCoverageZone({ siteId: "site-001" })];

      (generatedHooks.useCoverageZonesBySiteQuery as jest.Mock).mockReturnValue({
        data: { coverageZonesBySite: mockZones },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useCoverageZonesBySiteGraphQL({ siteId: "site-001" }), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.zones).toEqual(mockZones);
    });
  });
});

describe("useWirelessGraphQL - Analytics Hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useRfAnalyticsGraphQL", () => {
    it("should fetch RF analytics", async () => {
      const mockAnalytics = {
        siteId: "site-001",
        avgSignalStrength: -60,
        avgNoise: -90,
        interferenceLevel: 10,
      };

      (generatedHooks.useRfAnalyticsQuery as jest.Mock).mockReturnValue({
        data: { rfAnalytics: mockAnalytics },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useRfAnalyticsGraphQL({ siteId: "site-001" }), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.analytics).toEqual(mockAnalytics);
    });
  });

  describe("useChannelUtilizationGraphQL", () => {
    it("should fetch channel utilization", async () => {
      const mockUtilization = [
        { channel: 1, utilization: 45 },
        { channel: 6, utilization: 60 },
      ];

      (generatedHooks.useChannelUtilizationQuery as jest.Mock).mockReturnValue({
        data: { channelUtilization: mockUtilization },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(
        () =>
          useChannelUtilizationGraphQL({
            siteId: "site-001",
            band: FrequencyBand.Band_2_4Ghz,
          }),
        { wrapper: createApolloWrapper() },
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.channelUtilization).toEqual(mockUtilization);
    });
  });

  describe("useWirelessSiteMetricsGraphQL", () => {
    it("should fetch wireless site metrics", async () => {
      const mockMetrics = {
        siteId: "site-001",
        totalAccessPoints: 10,
        onlineAccessPoints: 9,
        totalClients: 150,
        avgClientSignal: -55,
      };

      (generatedHooks.useWirelessSiteMetricsQuery as jest.Mock).mockReturnValue({
        data: { wirelessSiteMetrics: mockMetrics },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useWirelessSiteMetricsGraphQL({ siteId: "site-001" }), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.metrics).toEqual(mockMetrics);
    });
  });

  describe("useWirelessDashboardGraphQL", () => {
    it("should fetch wireless dashboard data", async () => {
      const mockDashboard = {
        totalAccessPoints: 50,
        onlineAccessPoints: 48,
        totalClients: 500,
        avgSignalQuality: 80,
      };

      (generatedHooks.useWirelessDashboardQuery as jest.Mock).mockReturnValue({
        data: { wirelessDashboard: mockDashboard },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useWirelessDashboardGraphQL(), {
        wrapper: createApolloWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.dashboard).toEqual(mockDashboard);
    });
  });
});

describe("Utility Functions", () => {
  describe("calculateSignalQuality", () => {
    it("should return 100% for excellent signal (-30 dBm)", () => {
      expect(calculateSignalQuality(-30)).toBe(100);
    });

    it("should return 100% for better than -30 dBm", () => {
      expect(calculateSignalQuality(-20)).toBe(100);
    });

    it("should return 0% for poor signal (-90 dBm)", () => {
      expect(calculateSignalQuality(-90)).toBe(0);
    });

    it("should return 0% for worse than -90 dBm", () => {
      expect(calculateSignalQuality(-100)).toBe(0);
    });

    it("should calculate percentage for mid-range values", () => {
      const quality = calculateSignalQuality(-60);
      expect(quality).toBeGreaterThan(0);
      expect(quality).toBeLessThan(100);
      expect(quality).toBe(50);
    });

    it("should return 0 for null value", () => {
      expect(calculateSignalQuality(null)).toBe(0);
    });

    it("should return 0 for undefined value", () => {
      expect(calculateSignalQuality(undefined)).toBe(0);
    });
  });

  describe("getSignalQualityLabel", () => {
    it('should return "Excellent" for strong signal', () => {
      expect(getSignalQualityLabel(-40)).toBe("Excellent");
    });

    it('should return "Good" for good signal', () => {
      expect(getSignalQualityLabel(-55)).toBe("Good");
    });

    it('should return "Fair" for fair signal', () => {
      expect(getSignalQualityLabel(-65)).toBe("Fair");
    });

    it('should return "Poor" for weak signal', () => {
      expect(getSignalQualityLabel(-80)).toBe("Poor");
    });

    it('should return "Unknown" for null value', () => {
      expect(getSignalQualityLabel(null)).toBe("Unknown");
    });

    it('should return "Unknown" for undefined value', () => {
      expect(getSignalQualityLabel(undefined)).toBe("Unknown");
    });
  });

  describe("getFrequencyBandLabel", () => {
    it('should return "2.4 GHz" for 2.4GHz band', () => {
      expect(getFrequencyBandLabel(FrequencyBand.Band_2_4Ghz)).toBe("2.4 GHz");
    });

    it('should return "5 GHz" for 5GHz band', () => {
      expect(getFrequencyBandLabel(FrequencyBand.Band_5Ghz)).toBe("5 GHz");
    });

    it('should return "6 GHz" for 6GHz band', () => {
      expect(getFrequencyBandLabel(FrequencyBand.Band_6Ghz)).toBe("6 GHz");
    });

    it('should return "Unknown" for null value', () => {
      expect(getFrequencyBandLabel(null)).toBe("Unknown");
    });

    it('should return "Unknown" for undefined value', () => {
      expect(getFrequencyBandLabel(undefined)).toBe("Unknown");
    });
  });
});
