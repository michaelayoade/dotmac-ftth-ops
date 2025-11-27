/**
 * MSW GraphQL Handlers for Wireless Network Management
 *
 * These handlers intercept GraphQL wireless queries during tests,
 * providing realistic responses without hitting a real GraphQL server.
 */

import { graphql, HttpResponse } from "msw";
import { AccessPointStatus, FrequencyBand, ClientConnectionType } from "@/lib/graphql/generated";

const camelCaseKey = (key: string) => {
  if (key.startsWith("__")) {
    return key;
  }
  return key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
};

const camelize = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(camelize);
  }
  if (value && typeof value === "object") {
    return Object.entries(value).reduce((acc: Record<string, any>, [key, val]) => {
      const camelKey = typeof key === "string" ? camelCaseKey(key) : key;
      acc[camelKey as string] = camelize(val);
      return acc;
    }, {});
  }
  return value;
};

const respondWithCamelCase = (data: any) => HttpResponse.json({ data: camelize(data) });

const getVariables = <T extends Record<string, any>>(variables?: Record<string, any>) =>
  (variables ?? {}) as T;

// ============================================================================
// Types
// ============================================================================

interface MockAccessPoint {
  id: string;
  name: string;
  status: AccessPointStatus;
  siteId: string;
  siteName: string;
  macAddress: string;
  ipAddress: string;
  ssid: string;
  frequencyBand: FrequencyBand;
  channel: number;
  channelWidth: number;
  transmitPower: number;
  isOnline: boolean;
  firmwareVersion: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  controllerId: string;
  controllerName: string;
  securityType: string;
  maxClients: number;
  isBandSteeringEnabled: boolean;
  isLoadBalancingEnabled: boolean;
  isMeshEnabled: boolean;
  rfMetrics: {
    signalStrengthDbm: number;
    noiseFloorDbm: number;
    signalToNoiseRatio: number;
    channelUtilizationPercent: number;
    interferenceLevel: number;
    txPowerDbm: number;
    rxPowerDbm: number;
  };
  performance: {
    txBytes: number;
    rxBytes: number;
    txPackets: number;
    rxPackets: number;
    txRateMbps: number;
    rxRateMbps: number;
    txErrors: number;
    rxErrors: number;
    txDropped: number;
    rxDropped: number;
    retries: number;
    retryRatePercent: number;
    connectedClients: number;
    authenticatedClients: number;
    authorizedClients: number;
    cpuUsagePercent: number;
    memoryUsagePercent: number;
    uptimeSeconds: number;
  };
  location: {
    siteName: string;
    building: string;
    floor: string;
    room: string;
    mountingType: string;
    coordinates: {
      latitude: number;
      longitude: number;
      altitude: number;
      accuracy: number;
    };
  } | null;
  lastSeenAt: string;
  lastRebootAt: string | null;
  createdAt: string;
  updatedAt: string;
  hardwareRevision: string;
}

interface MockWirelessClient {
  id: string;
  macAddress: string;
  hostname: string;
  ipAddress: string;
  accessPointId: string;
  accessPointName: string;
  customerId: string;
  customerName: string;
  ssid: string;
  frequencyBand: FrequencyBand;
  channel: number;
  connectionType: ClientConnectionType;
  signalStrengthDbm: number;
  snr: number;
  noiseFloorDbm: number;
  rxRateMbps: number;
  txRateMbps: number;
  maxPhyRateMbps: number;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  rxRetries: number;
  txRetries: number;
  uptimeSeconds: number;
  idleTimeSeconds: number;
  isAuthenticated: boolean;
  isAuthorized: boolean;
  authMethod: string;
  manufacturer: string;
  supports80211k: boolean;
  supports80211r: boolean;
  supports80211v: boolean;
  connectedAt: string;
  lastSeenAt: string;
  signalQuality: {
    rssiDbm: number;
    snrDb: number;
    noiseFloorDbm: number;
    signalStrengthPercent: number;
    linkQualityPercent: number;
  } | null;
}

interface MockCoverageZone {
  id: string;
  name: string;
  siteId: string;
  siteName: string;
  description: string;
  areaType: string;
  floor: string;
  coverageAreaSqm: number;
  coveragePolygon: string;
  accessPointIds: string[];
  accessPointCount: number;
  connectedClients: number;
  maxClientCapacity: number;
  signalStrengthMinDbm: number;
  signalStrengthMaxDbm: number;
  signalStrengthAvgDbm: number;
  noiseFloorAvgDbm: number;
  interferenceLevel: number;
  channelUtilizationAvg: number;
  clientDensityPerAp: number;
  lastSurveyedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// In-Memory Storage
// ============================================================================

let accessPoints: MockAccessPoint[] = [];
let wirelessClients: MockWirelessClient[] = [];
let coverageZones: MockCoverageZone[] = [];

// ============================================================================
// Mock Data Factories
// ============================================================================

export function createMockAccessPoint(overrides?: Partial<MockAccessPoint>): MockAccessPoint {
  const id = overrides?.id || `ap-${Date.now()}-${Math.random()}`;
  const siteId = overrides?.siteId || `site-${Math.floor(Math.random() * 10) + 1}`;
  const locationOverride = overrides?.location as Partial<MockAccessPoint["location"]> | undefined;

  const randomLatitude = 6.5244 + (Math.random() - 0.5) * 0.1;
  const randomLongitude = 3.3792 + (Math.random() - 0.5) * 0.1;
  const fallbackSiteName = overrides?.siteName || locationOverride?.siteName || `Site ${siteId}`;

  const rfMetrics = overrides?.rfMetrics ?? {
    signalStrengthDbm: -55,
    noiseFloorDbm: -90,
    signalToNoiseRatio: 35,
    channelUtilizationPercent: 45,
    interferenceLevel: 0.12,
    txPowerDbm: 18,
    rxPowerDbm: -60,
  };

  const performance = overrides?.performance ?? {
    txBytes: 12_000_000,
    rxBytes: 18_000_000,
    txPackets: 125_000,
    rxPackets: 160_000,
    txRateMbps: 450,
    rxRateMbps: 600,
    txErrors: 5,
    rxErrors: 7,
    txDropped: 2,
    rxDropped: 3,
    retries: 15,
    retryRatePercent: 0.8,
    connectedClients: 32,
    authenticatedClients: 30,
    authorizedClients: 29,
    cpuUsagePercent: 48,
    memoryUsagePercent: 62,
    uptimeSeconds: 86_400,
  };

  const location = {
    siteName: locationOverride?.siteName ?? fallbackSiteName,
    building: locationOverride?.building ?? "Main Campus",
    floor: locationOverride?.floor ?? "Level 1",
    room: locationOverride?.room ?? "Network Closet",
    mountingType: locationOverride?.mountingType ?? "ceiling",
    coordinates: {
      latitude:
        locationOverride?.coordinates?.latitude ??
        // Support legacy overrides that provided latitude/longitude at root
        (locationOverride as any)?.latitude ??
        randomLatitude,
      longitude:
        locationOverride?.coordinates?.longitude ??
        (locationOverride as any)?.longitude ??
        randomLongitude,
      altitude: locationOverride?.coordinates?.altitude ?? 15,
      accuracy: locationOverride?.coordinates?.accuracy ?? 5,
    },
  };

  const { location: _removeLocation, ...restOverrides } = overrides || {};

  return {
    id,
    name: `Access Point ${id}`,
    status: AccessPointStatus.Online,
    siteId,
    siteName: fallbackSiteName,
    macAddress: `00:11:22:33:${Math.floor(Math.random() * 100)
      .toString(16)
      .padStart(2, "0")}:${Math.floor(Math.random() * 100)
      .toString(16)
      .padStart(2, "0")}`,
    ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    ssid: "WiFi-Network",
    frequencyBand: FrequencyBand.Band_5Ghz,
    channel: 36,
    channelWidth: 80,
    transmitPower: 20,
    isOnline: true,
    firmwareVersion: "1.2.3",
    manufacturer: "Ubiquiti",
    model: "UniFi AP AC Pro",
    serialNumber: `SN${Math.random().toString(36).substring(7).toUpperCase()}`,
    controllerId: "controller-1",
    controllerName: "Main Controller",
    securityType: "WPA3_ENTERPRISE",
    maxClients: 100,
    isBandSteeringEnabled: true,
    isLoadBalancingEnabled: true,
    isMeshEnabled: false,
    rfMetrics,
    performance,
    location,
    lastSeenAt: new Date().toISOString(),
    lastRebootAt: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    updatedAt: new Date().toISOString(),
    hardwareRevision: "Rev A",
    ...restOverrides,
  };
}

export function createMockWirelessClient(
  overrides?: Partial<MockWirelessClient>,
): MockWirelessClient {
  const id = overrides?.id || `client-${Date.now()}-${Math.random()}`;
  const accessPointId =
    overrides?.accessPointId || (accessPoints.length > 0 ? accessPoints[0].id : "ap-1");
  const signalStrengthDbm = overrides?.signalStrengthDbm ?? -55;
  const { signalQuality: signalQualityOverride, ...restOverrides } = overrides || {};

  const signalQuality = {
    rssiDbm: signalQualityOverride?.rssiDbm ?? signalStrengthDbm,
    snrDb: signalQualityOverride?.snrDb ?? 30,
    noiseFloorDbm: signalQualityOverride?.noiseFloorDbm ?? -90,
    signalStrengthPercent:
      signalQualityOverride?.signalStrengthPercent ??
      Math.max(0, Math.min(100, 100 + signalStrengthDbm)),
    linkQualityPercent: signalQualityOverride?.linkQualityPercent ?? 85,
  };

  return {
    id,
    macAddress: `AA:BB:CC:DD:${Math.floor(Math.random() * 100)
      .toString(16)
      .padStart(2, "0")}:${Math.floor(Math.random() * 100)
      .toString(16)
      .padStart(2, "0")}`,
    hostname: `device-${id}`,
    ipAddress: `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    accessPointId,
    accessPointName: `Access Point ${accessPointId}`,
    customerId: `customer-${Math.floor(Math.random() * 100)}`,
    customerName: `Customer ${Math.floor(Math.random() * 100)}`,
    ssid: "WiFi-Network",
    frequencyBand: FrequencyBand.Band_5Ghz,
    channel: 36,
    connectionType: ClientConnectionType.Wifi_5,
    signalStrengthDbm,
    snr: 35,
    noiseFloorDbm: -90,
    rxRateMbps: 100,
    txRateMbps: 50,
    maxPhyRateMbps: 866,
    rxBytes: 1024000000,
    txBytes: 512000000,
    rxPackets: 1000000,
    txPackets: 500000,
    rxRetries: 100,
    txRetries: 50,
    uptimeSeconds: 3600,
    idleTimeSeconds: 10,
    isAuthenticated: true,
    isAuthorized: true,
    authMethod: "WPA3-Enterprise",
    manufacturer: "Apple",
    supports80211k: true,
    supports80211r: true,
    supports80211v: true,
    connectedAt: new Date(Date.now() - 3600000).toISOString(),
    lastSeenAt: new Date().toISOString(),
    signalQuality,
    ...restOverrides,
  };
}

export function createMockCoverageZone(overrides?: Partial<MockCoverageZone>): MockCoverageZone {
  const id = overrides?.id || `zone-${Date.now()}-${Math.random()}`;
  const siteId = overrides?.siteId || "site-1";

  const base = {
    id,
    name: `Coverage Zone ${id}`,
    siteId,
    siteName: `Site ${siteId}`,
    description: "Coverage zone for testing",
    areaType: "Indoor",
    floor: "Floor 1",
    coverageAreaSqm: 500,
    coveragePolygon: "[[0,0],[100,0],[100,100],[0,100],[0,0]]",
    accessPointIds: ["ap-1", "ap-2"],
    accessPointCount: 2,
    connectedClients: 25,
    maxClientCapacity: 200,
    signalStrengthMinDbm: -75,
    signalStrengthMaxDbm: -40,
    signalStrengthAvgDbm: -55,
    noiseFloorAvgDbm: -90,
    interferenceLevel: 0.15,
    channelUtilizationAvg: 0.45,
    clientDensityPerAp: 12.5,
    lastSurveyedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const result = {
    ...base,
    ...overrides,
  };

  // If siteId was overridden but siteName wasn't, update siteName to match
  if (overrides?.siteId && !overrides?.siteName) {
    result.siteName = `Site ${overrides.siteId}`;
  }

  return result;
}

export function createMockRfAnalytics(siteId: string = "site-1") {
  return {
    siteId,
    siteName: `Site ${siteId}`,
    analysisTimestamp: new Date().toISOString(),
    recommendedChannels24ghz: [1, 6, 11],
    recommendedChannels5ghz: [36, 44, 149, 157],
    recommendedChannels6ghz: [5, 21, 37, 53],
    totalInterferenceScore: 0.25,
    averageSignalStrengthDbm: -55,
    averageSnr: 35,
    coverageQualityScore: 0.85,
    clientsPerBand24ghz: 15,
    clientsPerBand5ghz: 45,
    clientsPerBand6ghz: 10,
    bandUtilizationBalanceScore: 0.75,
    channelUtilization24ghz: [
      {
        channel: 1,
        frequencyMhz: 2412,
        band: FrequencyBand.Band_2_4Ghz,
        utilizationPercent: 35,
        interferenceLevel: 0.2,
        accessPointsCount: 3,
      },
      {
        channel: 6,
        frequencyMhz: 2437,
        band: FrequencyBand.Band_2_4Ghz,
        utilizationPercent: 40,
        interferenceLevel: 0.25,
        accessPointsCount: 4,
      },
      {
        channel: 11,
        frequencyMhz: 2462,
        band: FrequencyBand.Band_2_4Ghz,
        utilizationPercent: 30,
        interferenceLevel: 0.15,
        accessPointsCount: 2,
      },
    ],
    channelUtilization5ghz: [
      {
        channel: 36,
        frequencyMhz: 5180,
        band: FrequencyBand.Band_5Ghz,
        utilizationPercent: 45,
        interferenceLevel: 0.1,
        accessPointsCount: 5,
      },
      {
        channel: 44,
        frequencyMhz: 5220,
        band: FrequencyBand.Band_5Ghz,
        utilizationPercent: 50,
        interferenceLevel: 0.12,
        accessPointsCount: 6,
      },
      {
        channel: 149,
        frequencyMhz: 5745,
        band: FrequencyBand.Band_5Ghz,
        utilizationPercent: 35,
        interferenceLevel: 0.08,
        accessPointsCount: 4,
      },
    ],
    channelUtilization6ghz: [
      {
        channel: 5,
        frequencyMhz: 5955,
        band: FrequencyBand.Band_6Ghz,
        utilizationPercent: 20,
        interferenceLevel: 0.05,
        accessPointsCount: 2,
      },
      {
        channel: 21,
        frequencyMhz: 6115,
        band: FrequencyBand.Band_6Ghz,
        utilizationPercent: 25,
        interferenceLevel: 0.06,
        accessPointsCount: 3,
      },
    ],
    interferenceSources: [
      { sourceType: "APPLIANCE", frequencyMhz: 2450, strengthDbm: -60, affectedChannels: [1, 6] },
      { sourceType: "BLUETOOTH", frequencyMhz: 2440, strengthDbm: -70, affectedChannels: [6, 11] },
    ],
  };
}

export function createMockChannelUtilization(band: FrequencyBand) {
  const channelData: Record<FrequencyBand, any[]> = {
    [FrequencyBand.Band_2_4Ghz]: [
      {
        channel: 1,
        frequencyMhz: 2412,
        band,
        utilizationPercent: 35,
        interferenceLevel: 0.2,
        accessPointsCount: 3,
      },
      {
        channel: 6,
        frequencyMhz: 2437,
        band,
        utilizationPercent: 40,
        interferenceLevel: 0.25,
        accessPointsCount: 4,
      },
      {
        channel: 11,
        frequencyMhz: 2462,
        band,
        utilizationPercent: 30,
        interferenceLevel: 0.15,
        accessPointsCount: 2,
      },
    ],
    [FrequencyBand.Band_5Ghz]: [
      {
        channel: 36,
        frequencyMhz: 5180,
        band,
        utilizationPercent: 45,
        interferenceLevel: 0.1,
        accessPointsCount: 5,
      },
      {
        channel: 44,
        frequencyMhz: 5220,
        band,
        utilizationPercent: 50,
        interferenceLevel: 0.12,
        accessPointsCount: 6,
      },
      {
        channel: 149,
        frequencyMhz: 5745,
        band,
        utilizationPercent: 35,
        interferenceLevel: 0.08,
        accessPointsCount: 4,
      },
      {
        channel: 157,
        frequencyMhz: 5785,
        band,
        utilizationPercent: 38,
        interferenceLevel: 0.09,
        accessPointsCount: 3,
      },
    ],
    [FrequencyBand.Band_6Ghz]: [
      {
        channel: 5,
        frequencyMhz: 5955,
        band,
        utilizationPercent: 20,
        interferenceLevel: 0.05,
        accessPointsCount: 2,
      },
      {
        channel: 21,
        frequencyMhz: 6115,
        band,
        utilizationPercent: 25,
        interferenceLevel: 0.06,
        accessPointsCount: 3,
      },
      {
        channel: 37,
        frequencyMhz: 6275,
        band,
        utilizationPercent: 18,
        interferenceLevel: 0.04,
        accessPointsCount: 1,
      },
    ],
  };

  return channelData[band] || [];
}

export function createMockSiteMetrics(siteId: string = "site-1") {
  return {
    siteId,
    siteName: `Site ${siteId}`,
    totalAps: 10,
    onlineAps: 8,
    offlineAps: 1,
    degradedAps: 1,
    totalClients: 70,
    clients24ghz: 15,
    clients5ghz: 45,
    clients6ghz: 10,
    averageSignalStrengthDbm: -55,
    averageSnr: 35,
    totalThroughputMbps: 450,
    totalCapacity: 1000,
    capacityUtilizationPercent: 45,
    overallHealthScore: 0.85,
    rfHealthScore: 0.88,
    clientExperienceScore: 0.82,
  };
}

export function createMockWirelessDashboard() {
  const sourceAps =
    accessPoints.length > 0 ? accessPoints : [createMockAccessPoint({ id: "ap-dashboard" })];

  return {
    totalSites: 5,
    totalAccessPoints: 50,
    totalClients: 350,
    totalCoverageZones: 15,
    onlineAps: 45,
    offlineAps: 3,
    degradedAps: 2,
    clientsByBand24ghz: 75,
    clientsByBand5ghz: 225,
    clientsByBand6ghz: 50,
    totalThroughputMbps: 2250,
    averageSignalStrengthDbm: -55,
    averageClientExperienceScore: 0.85,
    clientCountTrend: [320, 330, 340, 345, 350, 355, 350],
    throughputTrendMbps: [2100, 2150, 2200, 2250, 2300, 2280, 2250],
    offlineEventsCount: 5,
    generatedAt: new Date().toISOString(),
    topApsByClients: sourceAps.slice(0, 5).map((ap) => ({
      id: ap.id,
      name: ap.name,
      siteName: ap.siteName,
      performance: ap.performance,
    })),
    topApsByThroughput: sourceAps.slice(0, 5).map((ap) => ({
      id: ap.id,
      name: ap.name,
      siteName: ap.siteName,
      performance: ap.performance,
    })),
    sitesWithIssues: [createMockSiteMetrics("site-2"), createMockSiteMetrics("site-3")],
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateSignalQualityScore(rssiDbm: number): number {
  if (rssiDbm >= -30) return 100;
  if (rssiDbm <= -90) return 0;
  return Math.round(((rssiDbm + 90) / 60) * 100);
}

function getSignalQualityLabelInternal(rssiDbm: number): string {
  if (rssiDbm >= -50) return "Excellent";
  if (rssiDbm >= -60) return "Good";
  if (rssiDbm >= -70) return "Fair";
  return "Poor";
}

// ============================================================================
// Storage Management
// ============================================================================

export function seedAccessPoints(data: Partial<MockAccessPoint>[]) {
  accessPoints = data.map(createMockAccessPoint);
}

export function seedWirelessClients(data: Partial<MockWirelessClient>[]) {
  wirelessClients = data.map(createMockWirelessClient);
}

export function seedCoverageZones(data: Partial<MockCoverageZone>[]) {
  coverageZones = data.map(createMockCoverageZone);
}

export function resetWirelessStorage() {
  accessPoints = [];
  wirelessClients = [];
  coverageZones = [];
}

export function clearWirelessData() {
  resetWirelessStorage();
}

// ============================================================================
// GraphQL Handlers
// ============================================================================

export const wirelessGraphQLHandlers = [
  // Access Point List Query
  graphql.query("AccessPointList", ({ variables }) => {
    const {
      limit = 50,
      offset = 0,
      status,
      siteId,
      search,
    } = getVariables<{
      limit?: number;
      offset?: number;
      status?: AccessPointStatus;
      siteId?: string;
      search?: string;
    }>(variables);

    let filtered = [...accessPoints];

    if (status) {
      filtered = filtered.filter((ap) => ap.status === status);
    }

    if (siteId) {
      filtered = filtered.filter((ap) => ap.siteId === siteId);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (ap) =>
          ap.name.toLowerCase().includes(searchLower) ||
          ap.macAddress.toLowerCase().includes(searchLower) ||
          ap.ipAddress.includes(searchLower),
      );
    }

    const totalCount = filtered.length;
    const paginatedAps = filtered.slice(offset, offset + limit);
    const hasNextPage = offset + limit < totalCount;

    const payload = {
      accessPoints: {
        __typename: "AccessPointConnection",
        accessPoints: paginatedAps.map((ap) => ({ ...ap, __typename: "AccessPoint" })),
        totalCount,
        hasNextPage,
      },
    };
    return respondWithCamelCase(payload);
  }),

  // Access Point Detail Query
  graphql.query("AccessPointDetail", ({ variables }) => {
    const { id } = getVariables<{ id?: string }>(variables);
    const accessPoint = accessPoints.find((ap) => ap.id === id);

    return respondWithCamelCase({
      accessPoint: accessPoint ? { ...accessPoint, __typename: "AccessPoint" } : null,
    });
  }),

  // Access Points by Site Query
  graphql.query("AccessPointsBySite", ({ variables }) => {
    const { siteId } = getVariables<{ siteId?: string }>(variables);
    const siteAps = accessPoints.filter((ap) => ap.siteId === siteId);

    return respondWithCamelCase({
      accessPointsBySite: siteAps.map((ap) => ({ ...ap, __typename: "AccessPoint" })),
    });
  }),

  // Wireless Client List Query
  graphql.query("WirelessClientList", ({ variables }) => {
    const {
      limit = 50,
      offset = 0,
      accessPointId,
      customerId,
      frequencyBand,
      search,
    } = getVariables<{
      limit?: number;
      offset?: number;
      accessPointId?: string;
      customerId?: string;
      frequencyBand?: FrequencyBand;
      search?: string;
    }>(variables);

    let filtered = [...wirelessClients];

    if (accessPointId) {
      filtered = filtered.filter((client) => client.accessPointId === accessPointId);
    }

    if (customerId) {
      filtered = filtered.filter((client) => client.customerId === customerId);
    }

    if (frequencyBand) {
      filtered = filtered.filter((client) => client.frequencyBand === frequencyBand);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (client) =>
          client.hostname.toLowerCase().includes(searchLower) ||
          client.macAddress.toLowerCase().includes(searchLower) ||
          client.ipAddress.includes(searchLower),
      );
    }

    const totalCount = filtered.length;
    const paginatedClients = filtered.slice(offset, offset + limit);
    const hasNextPage = offset + limit < totalCount;

    return respondWithCamelCase({
      wirelessClients: {
        __typename: "WirelessClientConnection",
        clients: paginatedClients.map((c) => ({ ...c, __typename: "WirelessClient" })),
        totalCount,
        hasNextPage,
      },
    });
  }),

  // Wireless Client Detail Query
  graphql.query("WirelessClientDetail", ({ variables }) => {
    const { id } = getVariables<{ id?: string }>(variables);
    const client = wirelessClients.find((c) => c.id === id);

    return respondWithCamelCase({
      wirelessClient: client ? { ...client, __typename: "WirelessClient" } : null,
    });
  }),

  // Wireless Clients by Access Point Query
  graphql.query("WirelessClientsByAccessPoint", ({ variables }) => {
    const { accessPointId } = getVariables<{ accessPointId?: string }>(variables);
    const apClients = wirelessClients.filter((c) => c.accessPointId === accessPointId);

    return respondWithCamelCase({
      wirelessClientsByAccessPoint: apClients.map((c) => ({ ...c, __typename: "WirelessClient" })),
    });
  }),

  // Wireless Clients by Customer Query
  graphql.query("WirelessClientsByCustomer", ({ variables }) => {
    const { customerId } = getVariables<{ customerId?: string }>(variables);
    const customerClients = wirelessClients.filter((c) => c.customerId === customerId);

    return respondWithCamelCase({
      wirelessClientsByCustomer: customerClients.map((c) => ({
        ...c,
        __typename: "WirelessClient",
      })),
    });
  }),

  // Coverage Zone List Query
  graphql.query("CoverageZoneList", ({ variables }) => {
    const {
      limit = 50,
      offset = 0,
      siteId,
    } = getVariables<{
      limit?: number;
      offset?: number;
      siteId?: string;
    }>(variables);

    let filtered = [...coverageZones];

    if (siteId) {
      filtered = filtered.filter((zone) => zone.siteId === siteId);
    }

    const totalCount = filtered.length;
    const paginatedZones = filtered.slice(offset, offset + limit);
    const hasNextPage = offset + limit < totalCount;

    return respondWithCamelCase({
      coverageZones: {
        __typename: "CoverageZoneConnection",
        zones: paginatedZones.map((z) => ({ ...z, __typename: "CoverageZone" })),
        totalCount,
        hasNextPage,
      },
    });
  }),

  // Coverage Zone Detail Query
  graphql.query("CoverageZoneDetail", ({ variables }) => {
    const { id } = getVariables<{ id?: string }>(variables);
    const zone = coverageZones.find((z) => z.id === id);

    return respondWithCamelCase({
      coverageZone: zone ? { ...zone, __typename: "CoverageZone" } : null,
    });
  }),

  // Coverage Zones by Site Query
  graphql.query("CoverageZonesBySite", ({ variables }) => {
    const { siteId } = getVariables<{ siteId?: string }>(variables);
    const siteZones = coverageZones.filter((z) => z.siteId === siteId);

    return respondWithCamelCase({
      coverageZonesBySite: siteZones.map((z) => ({ ...z, __typename: "CoverageZone" })),
    });
  }),

  // RF Analytics Query
  graphql.query("RFAnalytics", ({ variables }) => {
    const { siteId } = getVariables<{ siteId?: string }>(variables);
    const analytics = createMockRfAnalytics(siteId);

    return respondWithCamelCase({
      rfAnalytics: { ...analytics, __typename: "RFAnalytics" },
    });
  }),

  // Channel Utilization Query
  graphql.query("ChannelUtilization", ({ variables }) => {
    const { siteId, frequencyBand } = getVariables<{
      siteId?: string;
      frequencyBand?: FrequencyBand;
    }>(variables);
    const channelUtilization = createMockChannelUtilization(frequencyBand);

    return respondWithCamelCase({
      channelUtilization: channelUtilization.map((cu) => ({
        ...cu,
        __typename: "ChannelUtilization",
      })),
    });
  }),

  // Wireless Site Metrics Query
  graphql.query("WirelessSiteMetrics", ({ variables }) => {
    const { siteId } = getVariables<{ siteId?: string }>(variables);
    const metrics = createMockSiteMetrics(siteId);

    return respondWithCamelCase({
      wirelessSiteMetrics: { ...metrics, __typename: "WirelessSiteMetrics" },
    });
  }),

  // Wireless Dashboard Query
  graphql.query("WirelessDashboard", ({ variables }) => {
    const dashboard = createMockWirelessDashboard();

    return respondWithCamelCase({
      wirelessDashboard: { ...dashboard, __typename: "WirelessDashboard" },
    });
  }),
];
