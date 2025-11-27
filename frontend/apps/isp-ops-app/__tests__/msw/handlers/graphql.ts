/**
 * MSW GraphQL Handlers - General Purpose
 *
 * This file provides general-purpose MSW (Mock Service Worker) handlers for GraphQL queries
 * and mutations. It serves as both a reference implementation and a place for GraphQL handlers
 * that don't belong to a specific domain.
 *
 * ## Relationship with Specialized GraphQL Handlers
 *
 * This project has multiple GraphQL handler files organized by domain:
 * - `graphql-fiber.ts` - Fiber infrastructure queries (FiberCableList, DistributionPointList, etc.)
 * - `graphql-subscriber.ts` - Subscriber dashboard queries (SubscriberDashboard, ActiveSessions, etc.)
 * - `graphql.ts` (this file) - General/shared GraphQL handlers and wireless queries
 *
 * When adding new GraphQL handlers:
 * 1. Check if a specialized file exists for your domain (fiber, subscriber, etc.)
 * 2. If yes, add your handler to that file
 * 3. If no, either create a new specialized file or add it here
 *
 * ## How GraphQL MSW Works
 *
 * Unlike REST endpoints that match specific URLs, GraphQL handlers match by:
 * 1. The GraphQL endpoint URL (e.g., /api/v1/graphql)
 * 2. The operation name (e.g., "FiberDashboard", "AccessPointList")
 *
 * MSW v1 uses `graphql.query()` and `graphql.mutation()` from 'msw' to create handlers.
 * These handlers intercept GraphQL requests and return mock data in the standard GraphQL response format.
 *
 * ## GraphQL Response Format
 *
 * GraphQL responses always have this structure:
 * ```typescript
 * {
 *   data: {
 *     queryName: result  // The actual data
 *   },
 *   errors?: [{         // Optional errors array
 *     message: string,
 *     extensions?: { code: string }
 *   }]
 * }
 * ```
 *
 * ## How to Add New Query Mocks
 *
 * 1. Find your GraphQL query name (e.g., in lib/graphql/queries/fiber.graphql)
 * 2. Add a new handler using `graphql.query()`:
 *
 * ```typescript
 * graphql.query('YourQueryName', ({ variables }) => {
 *   const variables = request.variables;  // Access query variables
 *
 *   return res(
 *     ctx.data({
 *       yourQueryName: {
 *         // Your mock data here
 *       }
 *     })
 *   );
 * }),
 * ```
 *
 * 3. For mutations, use `graphql.mutation()`:
 *
 * ```typescript
 * graphql.mutation('YourMutationName', ({ variables }) => {
 *   const input = request.variables.input;
 *
 *   return res(
 *     ctx.data({
 *       yourMutation: {
 *         success: true,
 *         result: { ... }
 *       }
 *     })
 *   );
 * }),
 * ```
 *
 * ## Testing GraphQL Hooks
 *
 * To test hooks that use GraphQL:
 *
 * 1. Import and seed mock data:
 * ```typescript
 * import { seedFiberData, clearFiberData } from '@/__tests__/msw/handlers/graphql';
 *
 * beforeEach(() => {
 *   clearFiberData();
 *   seedFiberData({ cables: [...], distributionPoints: [...] });
 * });
 * ```
 *
 * 2. Render your hook and verify it receives the mocked data:
 * ```typescript
 * const { result } = renderHook(() => useFiberCablesQuery({ limit: 10 }));
 *
 * await waitFor(() => {
 *   expect(result.current.data?.fiberCables.cables).toHaveLength(10);
 * });
 * ```
 *
 * 3. Test error scenarios using `createGraphQLError()`:
 * ```typescript
 * server.use(
 *   graphql.query('FiberCableList', ({ variables }) => {
 *     return res(
 *       ctx.errors([createGraphQLError('Network unavailable', 'NETWORK_ERROR')])
 *     );
 *   })
 * );
 * ```
 */

import { graphql, HttpResponse } from "msw";

// ============================================================================
// In-Memory Storage for GraphQL Data
// ============================================================================

interface FiberCable {
  id: string;
  cableId: string;
  name: string;
  description?: string;
  status: string;
  isActive: boolean;
  fiberType: string;
  totalStrands: number;
  availableStrands: number;
  usedStrands: number;
  manufacturer?: string;
  model?: string;
  installationType: string;
  lengthMeters: number;
  capacityUtilizationPercent: number;
  bandwidthCapacityGbps: number;
  spliceCount: number;
  totalLossDb?: number;
  createdAt: string;
  updatedAt: string;
}

interface DistributionPoint {
  id: string;
  siteId: string;
  name: string;
  description?: string;
  pointType: string;
  status: string;
  isActive: boolean;
  totalCapacity: number;
  availableCapacity: number;
  usedCapacity: number;
  portCount: number;
  totalCablesConnected: number;
  capacityUtilizationPercent: number;
  createdAt: string;
  updatedAt: string;
}

interface ServiceArea {
  id: string;
  areaId: string;
  name: string;
  description?: string;
  areaType: string;
  isActive: boolean;
  isServiceable: boolean;
  areaSqkm: number;
  city: string;
  stateProvince: string;
  homesPassed: number;
  homesConnected: number;
  penetrationRatePercent: number;
  distributionPointCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AccessPoint {
  id: string;
  name: string;
  macAddress: string;
  ipAddress: string;
  serialNumber: string;
  status: string;
  isOnline: boolean;
  model: string;
  manufacturer: string;
  ssid: string;
  frequencyBand: string;
  channel: number;
  transmitPower: number;
  maxClients: number;
  createdAt: string;
  updatedAt: string;
}

interface WirelessClient {
  id: string;
  macAddress: string;
  hostname?: string;
  ipAddress: string;
  accessPointId: string;
  accessPointName: string;
  ssid: string;
  connectionType: string;
  frequencyBand: string;
  channel: number;
  isAuthenticated: boolean;
  isAuthorized: boolean;
  signalStrengthDbm: number;
  txRateMbps: number;
  rxRateMbps: number;
  connectedAt: string;
  lastSeenAt: string;
}

interface Subscriber {
  id: string;
  subscriberId: string;
  username: string;
  email?: string;
  status: string;
  planName?: string;
  ipAddress?: string;
  connectedAt?: string;
  dataUsageMB: number;
  createdAt: string;
  updatedAt: string;
}

// Storage maps
const fiberCables: Map<string, FiberCable> = new Map();
const distributionPoints: Map<string, DistributionPoint> = new Map();
const serviceAreas: Map<string, ServiceArea> = new Map();
const accessPoints: Map<string, AccessPoint> = new Map();
const wirelessClients: Map<string, WirelessClient> = new Map();
const subscribers: Map<string, Subscriber> = new Map();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a properly formatted GraphQL response wrapper
 */
export function createMockGraphQLResponse<T>(data: T) {
  return { data };
}

/**
 * Creates a GraphQL error response
 */
export function createGraphQLError(message: string, code?: string) {
  return {
    message,
    extensions: code ? { code } : undefined,
  };
}

const respondWithData = (payload: any) => HttpResponse.json({ data: payload });
const respondWithErrors = (errors: any[]) => HttpResponse.json({ errors }, { status: 200 });
const getVariables = <T extends Record<string, any>>(variables?: Record<string, any>) =>
  (variables ?? {}) as T;

/**
 * Creates a paginated GraphQL response
 */
export function createPaginatedResponse<T>(
  items: T[],
  totalCount: number,
  limit: number,
  offset: number,
) {
  const hasNextPage = offset + items.length < totalCount;

  return {
    items,
    totalCount,
    hasNextPage,
  };
}

/**
 * Filters and paginates a list
 */
function paginateList<T>(
  list: T[],
  limit: number = 50,
  offset: number = 0,
): { items: T[]; totalCount: number; hasNextPage: boolean } {
  const totalCount = list.length;
  const items = list.slice(offset, offset + limit);
  const hasNextPage = offset + items.length < totalCount;

  return { items, totalCount, hasNextPage };
}

// ============================================================================
// Seed and Clear Functions
// ============================================================================

export function seedFiberData(data: {
  cables?: Partial<FiberCable>[];
  distributionPoints?: Partial<DistributionPoint>[];
  serviceAreas?: Partial<ServiceArea>[];
}) {
  if (data.cables) {
    data.cables.forEach((cable, index) => {
      const id = cable.id || `cable-${index + 1}`;
      fiberCables.set(id, {
        id,
        cableId: cable.cableId || `CABLE-${String(index + 1).padStart(6, "0")}`,
        name: cable.name || `Fiber Cable ${index + 1}`,
        status: cable.status || "active",
        isActive: cable.isActive ?? true,
        fiberType: cable.fiberType || "single_mode",
        totalStrands: cable.totalStrands || 12,
        availableStrands: cable.availableStrands ?? 8,
        usedStrands: cable.usedStrands ?? 4,
        installationType: cable.installationType || "underground",
        lengthMeters: cable.lengthMeters || 1000,
        capacityUtilizationPercent: cable.capacityUtilizationPercent ?? 33.3,
        bandwidthCapacityGbps: cable.bandwidthCapacityGbps || 100,
        spliceCount: cable.spliceCount || 2,
        createdAt: cable.createdAt || new Date().toISOString(),
        updatedAt: cable.updatedAt || new Date().toISOString(),
        ...cable,
      } as FiberCable);
    });
  }

  if (data.distributionPoints) {
    data.distributionPoints.forEach((point, index) => {
      const id = point.id || `dp-${index + 1}`;
      distributionPoints.set(id, {
        id,
        siteId: point.siteId || `site-${index + 1}`,
        name: point.name || `Distribution Point ${index + 1}`,
        pointType: point.pointType || "fdt",
        status: point.status || "active",
        isActive: point.isActive ?? true,
        totalCapacity: point.totalCapacity || 48,
        availableCapacity: point.availableCapacity ?? 24,
        usedCapacity: point.usedCapacity ?? 24,
        portCount: point.portCount || 48,
        totalCablesConnected: point.totalCablesConnected || 4,
        capacityUtilizationPercent: point.capacityUtilizationPercent ?? 50,
        createdAt: point.createdAt || new Date().toISOString(),
        updatedAt: point.updatedAt || new Date().toISOString(),
        ...point,
      } as DistributionPoint);
    });
  }

  if (data.serviceAreas) {
    data.serviceAreas.forEach((area, index) => {
      const id = area.id || `area-${index + 1}`;
      serviceAreas.set(id, {
        id,
        areaId: area.areaId || `AREA-${String(index + 1).padStart(4, "0")}`,
        name: area.name || `Service Area ${index + 1}`,
        areaType: area.areaType || "residential",
        isActive: area.isActive ?? true,
        isServiceable: area.isServiceable ?? true,
        areaSqkm: area.areaSqkm || 5.0,
        city: area.city || "City",
        stateProvince: area.stateProvince || "State",
        homesPassed: area.homesPassed || 1000,
        homesConnected: area.homesConnected || 500,
        penetrationRatePercent: area.penetrationRatePercent ?? 50,
        distributionPointCount: area.distributionPointCount || 10,
        createdAt: area.createdAt || new Date().toISOString(),
        updatedAt: area.updatedAt || new Date().toISOString(),
        ...area,
      } as ServiceArea);
    });
  }
}

export function seedWirelessData(data: {
  accessPoints?: Partial<AccessPoint>[];
  clients?: Partial<WirelessClient>[];
}) {
  if (data.accessPoints) {
    data.accessPoints.forEach((ap, index) => {
      const id = ap.id || `ap-${index + 1}`;
      accessPoints.set(id, {
        id,
        name: ap.name || `AP-${index + 1}`,
        macAddress: ap.macAddress || `00:11:22:33:44:${String(index).padStart(2, "0")}`,
        ipAddress: ap.ipAddress || `10.0.0.${index + 1}`,
        serialNumber: ap.serialNumber || `SN-${String(index + 1).padStart(8, "0")}`,
        status: ap.status || "online",
        isOnline: ap.isOnline ?? true,
        model: ap.model || "UAP-AC-PRO",
        manufacturer: ap.manufacturer || "Ubiquiti",
        ssid: ap.ssid || "Corporate-WiFi",
        frequencyBand: ap.frequencyBand || "5ghz",
        channel: ap.channel || 36,
        transmitPower: ap.transmitPower || 20,
        maxClients: ap.maxClients || 50,
        createdAt: ap.createdAt || new Date().toISOString(),
        updatedAt: ap.updatedAt || new Date().toISOString(),
        ...ap,
      } as AccessPoint);
    });
  }

  if (data.clients) {
    data.clients.forEach((client, index) => {
      const id = client.id || `client-${index + 1}`;
      wirelessClients.set(id, {
        id,
        macAddress: client.macAddress || `AA:BB:CC:DD:EE:${String(index).padStart(2, "0")}`,
        hostname: client.hostname || `device-${index + 1}`,
        ipAddress: client.ipAddress || `192.168.1.${index + 1}`,
        accessPointId: client.accessPointId || "ap-1",
        accessPointName: client.accessPointName || "AP-1",
        ssid: client.ssid || "Corporate-WiFi",
        connectionType: client.connectionType || "wifi",
        frequencyBand: client.frequencyBand || "5ghz",
        channel: client.channel || 36,
        isAuthenticated: client.isAuthenticated ?? true,
        isAuthorized: client.isAuthorized ?? true,
        signalStrengthDbm: client.signalStrengthDbm || -50,
        txRateMbps: client.txRateMbps || 100,
        rxRateMbps: client.rxRateMbps || 100,
        connectedAt: client.connectedAt || new Date().toISOString(),
        lastSeenAt: client.lastSeenAt || new Date().toISOString(),
        ...client,
      } as WirelessClient);
    });
  }
}

export function seedSubscriberData(data: { subscribers?: Partial<Subscriber>[] }) {
  if (data.subscribers) {
    data.subscribers.forEach((sub, index) => {
      const id = sub.id || `sub-${index + 1}`;
      subscribers.set(id, {
        id,
        subscriberId: sub.subscriberId || `SUB-${String(index + 1).padStart(6, "0")}`,
        username: sub.username || `user${index + 1}`,
        email: sub.email || `user${index + 1}@example.com`,
        status: sub.status || "active",
        planName: sub.planName || "Basic Plan",
        ipAddress: sub.ipAddress || `10.1.0.${index + 1}`,
        dataUsageMB: sub.dataUsageMB || 1024,
        createdAt: sub.createdAt || new Date().toISOString(),
        updatedAt: sub.updatedAt || new Date().toISOString(),
        ...sub,
      } as Subscriber);
    });
  }
}

export function clearFiberData() {
  fiberCables.clear();
  distributionPoints.clear();
  serviceAreas.clear();
}

export function clearWirelessData() {
  accessPoints.clear();
  wirelessClients.clear();
}

export function clearSubscriberData() {
  subscribers.clear();
}

export function clearAllGraphQLData() {
  clearFiberData();
  clearWirelessData();
  clearSubscriberData();
}

// ============================================================================
// GraphQL Handlers
// ============================================================================

export const graphqlHandlers = [
  // ============================================================================
  // Fiber Infrastructure Queries
  // ============================================================================

  graphql.query("FiberCableList", ({ variables }) => {
    const {
      limit = 50,
      offset = 0,
      status,
      fiberType,
      search,
    } = getVariables<{
      limit?: number;
      offset?: number;
      status?: string;
      fiberType?: string;
      search?: string;
    }>(variables);

    let cables = Array.from(fiberCables.values());

    // Apply filters
    if (status) {
      cables = cables.filter((c) => c.status === status);
    }
    if (fiberType) {
      cables = cables.filter((c) => c.fiberType === fiberType);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      cables = cables.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.cableId.toLowerCase().includes(searchLower),
      );
    }

    const paginated = paginateList(cables, limit, offset);

    return respondWithData({
      fiberCables: {
        cables: paginated.items,
        totalCount: paginated.totalCount,
        hasNextPage: paginated.hasNextPage,
      },
    });
  }),

  graphql.query("FiberCableDetail", ({ variables }) => {
    const { id } = getVariables<{ id?: string }>(variables);
    const cable = fiberCables.get(id);

    if (!cable) {
      return respondWithErrors([createGraphQLError("Fiber cable not found", "NOT_FOUND")]);
    }

    return respondWithData({
      fiberCable: cable,
    });
  }),

  graphql.query("DistributionPointList", ({ variables }) => {
    const {
      limit = 50,
      offset = 0,
      pointType,
      status,
    } = getVariables<{
      limit?: number;
      offset?: number;
      pointType?: string;
      status?: string;
    }>(variables);

    let points = Array.from(distributionPoints.values());

    // Apply filters
    if (pointType) {
      points = points.filter((p) => p.pointType === pointType);
    }
    if (status) {
      points = points.filter((p) => p.status === status);
    }

    const paginated = paginateList(points, limit, offset);

    return respondWithData({
      distributionPoints: {
        distributionPoints: paginated.items,
        totalCount: paginated.totalCount,
        hasNextPage: paginated.hasNextPage,
      },
    });
  }),

  graphql.query("ServiceAreaList", ({ variables }) => {
    const {
      limit = 50,
      offset = 0,
      areaType,
      isServiceable,
    } = getVariables<{
      limit?: number;
      offset?: number;
      areaType?: string;
      isServiceable?: boolean;
    }>(variables);

    let areas = Array.from(serviceAreas.values());

    // Apply filters
    if (areaType) {
      areas = areas.filter((a) => a.areaType === areaType);
    }
    if (typeof isServiceable === "boolean") {
      areas = areas.filter((a) => a.isServiceable === isServiceable);
    }

    const paginated = paginateList(areas, limit, offset);

    return respondWithData({
      serviceAreas: {
        serviceAreas: paginated.items,
        totalCount: paginated.totalCount,
        hasNextPage: paginated.hasNextPage,
      },
    });
  }),

  graphql.query("FiberDashboard", ({ variables }) => {
    const cables = Array.from(fiberCables.values());
    const points = Array.from(distributionPoints.values());
    const areas = Array.from(serviceAreas.values());

    const analytics = {
      totalFiberKm: cables.reduce((sum, c) => sum + c.lengthMeters, 0) / 1000,
      totalCables: cables.length,
      totalStrands: cables.reduce((sum, c) => sum + c.totalStrands, 0),
      totalDistributionPoints: points.length,
      totalSplicePoints: 0,
      capacityUtilizationPercent:
        cables.length > 0
          ? cables.reduce((sum, c) => sum + c.capacityUtilizationPercent, 0) / cables.length
          : 0,
      networkHealthScore: 85,
      homesPassed: areas.reduce((sum, a) => sum + a.homesPassed, 0),
      homesConnected: areas.reduce((sum, a) => sum + a.homesConnected, 0),
      penetrationRatePercent: 0,
    };

    if (analytics.homesPassed > 0) {
      analytics.penetrationRatePercent = (analytics.homesConnected / analytics.homesPassed) * 100;
    }

    return respondWithData({
      fiberDashboard: {
        analytics,
        topCablesByUtilization: cables.slice(0, 5),
        topDistributionPointsByCapacity: points.slice(0, 5),
        topServiceAreasByPenetration: areas.slice(0, 5),
        cablesRequiringAttention: [],
        recentTestResults: [],
        distributionPointsNearCapacity: [],
        serviceAreasExpansionCandidates: [],
        newConnectionsTrend: [],
        capacityUtilizationTrend: [],
        networkHealthTrend: [],
        generatedAt: new Date().toISOString(),
      },
    });
  }),

  // ============================================================================
  // Wireless Infrastructure Queries
  // ============================================================================

  graphql.query("AccessPointList", ({ variables }) => {
    const {
      limit = 50,
      offset = 0,
      status,
      frequencyBand,
      search,
    } = getVariables<{
      limit?: number;
      offset?: number;
      status?: string;
      frequencyBand?: string;
      search?: string;
    }>(variables);

    let aps = Array.from(accessPoints.values());

    // Apply filters
    if (status) {
      aps = aps.filter((ap) => ap.status === status);
    }
    if (frequencyBand) {
      aps = aps.filter((ap) => ap.frequencyBand === frequencyBand);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      aps = aps.filter(
        (ap) =>
          ap.name.toLowerCase().includes(searchLower) ||
          ap.macAddress.toLowerCase().includes(searchLower),
      );
    }

    const paginated = paginateList(aps, limit, offset);

    return respondWithData({
      accessPoints: {
        accessPoints: paginated.items,
        totalCount: paginated.totalCount,
        hasNextPage: paginated.hasNextPage,
      },
    });
  }),

  graphql.query("WirelessClientList", ({ variables }) => {
    const {
      limit = 50,
      offset = 0,
      accessPointId,
      frequencyBand,
    } = getVariables<{
      limit?: number;
      offset?: number;
      accessPointId?: string;
      frequencyBand?: string;
    }>(variables);

    let clients = Array.from(wirelessClients.values());

    // Apply filters
    if (accessPointId) {
      clients = clients.filter((c) => c.accessPointId === accessPointId);
    }
    if (frequencyBand) {
      clients = clients.filter((c) => c.frequencyBand === frequencyBand);
    }

    const paginated = paginateList(clients, limit, offset);

    return respondWithData({
      wirelessClients: {
        clients: paginated.items,
        totalCount: paginated.totalCount,
        hasNextPage: paginated.hasNextPage,
      },
    });
  }),

  // ============================================================================
  // Subscriber Queries
  // ============================================================================

  graphql.query("SubscriberDashboard", ({ variables }) => {
    const subs = Array.from(subscribers.values());

    const analytics = {
      totalSubscribers: subs.length,
      activeSubscribers: subs.filter((s) => s.status === "active").length,
      suspendedSubscribers: subs.filter((s) => s.status === "suspended").length,
      totalDataUsageGB: subs.reduce((sum, s) => sum + s.dataUsageMB, 0) / 1024,
      averageDataUsageGB:
        subs.length > 0 ? subs.reduce((sum, s) => sum + s.dataUsageMB, 0) / 1024 / subs.length : 0,
    };

    return respondWithData({
      subscriberDashboard: {
        analytics,
        recentSubscribers: subs.slice(0, 10),
        topDataUsers: subs.sort((a, b) => b.dataUsageMB - a.dataUsageMB).slice(0, 10),
        generatedAt: new Date().toISOString(),
      },
    });
  }),
];
