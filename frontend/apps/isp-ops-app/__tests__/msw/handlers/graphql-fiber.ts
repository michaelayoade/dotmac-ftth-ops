/**
 * MSW GraphQL Handlers for Fiber Infrastructure
 *
 * Mocks all fiber-related GraphQL queries for testing useFiberGraphQL hooks.
 * Provides realistic fiber optic network data including cables, distribution points,
 * splice points, service areas, health metrics, and network analytics.
 */

import { graphql, HttpResponse } from "msw";

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
// TYPES
// ============================================================================

export type FiberCableStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "DAMAGED"
  | "UNDER_CONSTRUCTION"
  | "DECOMMISSIONED";
export type FiberType = "SINGLE_MODE" | "MULTI_MODE" | "HYBRID";
export type CableInstallationType = "UNDERGROUND" | "AERIAL" | "DUCT" | "DIRECT_BURIAL";
export type SpliceStatus = "ACTIVE" | "DAMAGED" | "PENDING" | "VERIFIED";
export type SpliceType = "FUSION" | "MECHANICAL";
export type DistributionPointType = "CABINET" | "CLOSURE" | "POLE" | "MANHOLE";
export type ServiceAreaType = "RESIDENTIAL" | "COMMERCIAL" | "INDUSTRIAL" | "MIXED";
export type FiberHealthStatus = "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "CRITICAL";

export interface FiberCable {
  id: string;
  cable_code: string;
  fiber_type: FiberType;
  status: FiberCableStatus;
  installation_type: CableInstallationType;
  fiber_count: number;
  utilized_fibers: number;
  available_fibers: number;
  length_meters: number;
  start_point_id: string;
  end_point_id: string;
  route_description?: string;
  installation_date?: string;
  last_inspection_date?: string;
  site_id?: string;
  site_name?: string;
  health_status?: FiberHealthStatus;
  signal_loss_db?: number;
  created_at: string;
  updated_at: string;
}

export interface SplicePoint {
  id: string;
  splice_code: string;
  cable_id: string;
  cable_code?: string;
  distribution_point_id?: string;
  splice_type: SpliceType;
  status: SpliceStatus;
  fiber_count: number;
  location_description?: string;
  latitude?: number;
  longitude?: number;
  installation_date?: string;
  last_test_date?: string;
  test_results?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DistributionPoint {
  id: string;
  point_code: string;
  point_type: DistributionPointType;
  status: FiberCableStatus;
  total_capacity: number;
  utilized_capacity: number;
  available_capacity: number;
  name?: string;
  site_id?: string;
  site_name?: string;
  location_description?: string;
  latitude?: number;
  longitude?: number;
  installation_date?: string;
  last_maintenance_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ServiceArea {
  id: string;
  area_code: string;
  area_name: string;
  area_type: ServiceAreaType;
  is_serviceable: boolean;
  construction_status?: string;
  total_homes_passed?: number;
  connected_homes?: number;
  penetration_rate?: number;
  postal_codes?: string[];
  coverage_geometry?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FiberHealthMetric {
  id: string;
  cable_id: string;
  cable_code?: string;
  health_status: FiberHealthStatus;
  signal_loss_db: number;
  reflectance_db?: number;
  test_wavelength?: number;
  measured_at: string;
  issues?: string[];
  recommendations?: string[];
  created_at: string;
}

export interface FiberNetworkAnalytics {
  total_fiber_km: number;
  total_cables: number;
  total_strands: number;
  utilized_strands: number;
  available_strands: number;
  utilization_rate: number;
  cables_by_status: Record<string, number>;
  cables_by_type: Record<string, number>;
  health_distribution: Record<string, number>;
  coverage_percentage: number;
  total_distribution_points: number;
  distribution_points_near_capacity: number;
  total_service_areas: number;
  serviceable_areas: number;
  updated_at: string;
}

type GeoPoint = {
  latitude: number;
  longitude: number;
  altitude: number;
};

type Address = {
  streetAddress: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
};

type FiberStrand = {
  strandId: number;
  colorCode: string;
  isActive: boolean;
  isAvailable: boolean;
  customerId: string | null;
  customerName: string | null;
  serviceId: string | null;
  attenuationDb: number;
  lossDb: number;
  spliceCount: number;
};

type SpliceConnection = {
  cableAId: string;
  cableAStrand: number;
  cableBId: string;
  cableBStrand: number;
  spliceType: SpliceType | string;
  lossDb: number;
  reflectanceDb: number;
  isPassing: boolean;
  testResult: string;
  testedAt: string;
  testedBy: string;
};

type DistributionPort = {
  portNumber: number;
  isAllocated: boolean;
  isActive: boolean;
  cableId: string;
  strandId: number;
  customerId: string;
  customerName: string;
  serviceId: string;
};

type FiberDashboardCableSummary = {
  id: string;
  cableId: string;
  name: string;
  capacityUtilizationPercent: number;
  totalStrands: number;
  usedStrands: number;
};

type FiberDashboardDistributionSummary = {
  id: string;
  name: string;
  capacityUtilizationPercent: number;
  totalCapacity: number;
  usedCapacity: number;
};

type FiberDashboardServiceAreaSummary = {
  id: string;
  name: string;
  city: string;
  penetrationRatePercent: number;
  homesPassed: number;
  homesConnected: number;
};

type FiberDashboardAttention = {
  id: string;
  cableId: string;
  cableName: string;
  healthStatus: FiberHealthStatus;
  healthScore: number;
  requiresMaintenance: boolean;
};

type FiberDashboardTestResult = {
  testId: string;
  cableId: string;
  strandId: number;
  testedAt: string;
  isPassing: boolean;
  totalLossDb: number;
};

export interface FiberDashboard {
  analytics: FiberNetworkAnalytics;
  topCablesByUtilization: FiberDashboardCableSummary[];
  topDistributionPointsByCapacity: FiberDashboardDistributionSummary[];
  topServiceAreasByPenetration: FiberDashboardServiceAreaSummary[];
  cablesRequiringAttention: FiberDashboardAttention[];
  recentTestResults: FiberDashboardTestResult[];
  distributionPointsNearCapacity: FiberDashboardDistributionSummary[];
  serviceAreasExpansionCandidates: FiberDashboardServiceAreaSummary[];
  newConnectionsTrend: number[];
  capacityUtilizationTrend: number[];
  networkHealthTrend: number[];
  generatedAt: string;
}

const STRAND_COLORS = [
  "blue",
  "orange",
  "green",
  "brown",
  "slate",
  "white",
  "red",
  "black",
  "yellow",
  "violet",
  "rose",
  "aqua",
];

const toIsoString = (value?: string) => value ?? new Date().toISOString();

const ensureGeoPoint = (overrides?: Partial<GeoPoint>): GeoPoint => ({
  latitude: overrides?.latitude ?? 6.5244,
  longitude: overrides?.longitude ?? 3.3792,
  altitude: overrides?.altitude ?? 12,
});

const ensureAddress = (
  overrides?: Partial<Address>,
  fallbackStreet = "Fiber District",
): Address => ({
  streetAddress: overrides?.streetAddress ?? fallbackStreet,
  city: overrides?.city ?? "Metropolis",
  stateProvince: overrides?.stateProvince ?? "State",
  postalCode: overrides?.postalCode ?? "10001",
  country: overrides?.country ?? "USA",
});

const calculatePercent = (used: number, total: number) => {
  if (!total) {
    return 0;
  }
  return Number(((used / total) * 100).toFixed(2));
};

const ensureArray = <T>(value: T[] | undefined, fallback: T[]): T[] => {
  return value && value.length ? value : fallback;
};

const isDefined = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

const buildStrands = (total: number, used: number, strands?: FiberStrand[]): FiberStrand[] => {
  if (strands?.length) {
    return strands;
  }

  return Array.from({ length: Math.min(total, 12) }, (_, index) => ({
    strandId: index + 1,
    colorCode: STRAND_COLORS[index % STRAND_COLORS.length],
    isActive: index < used,
    isAvailable: index >= used,
    customerId: index < used ? `customer-${index + 1}` : null,
    customerName: index < used ? `Customer ${index + 1}` : null,
    serviceId: index < used ? `service-${index + 1}` : null,
    attenuationDb: Number((0.2 + index * 0.01).toFixed(2)),
    lossDb: Number((0.3 + index * 0.02).toFixed(2)),
    spliceCount: 4,
  }));
};

const getCableStartPointId = (cable: FiberCable) =>
  (cable as any).startDistributionPointId ??
  (cable as any).start_distribution_point_id ??
  cable.start_point_id;

const getCableEndPointId = (cable: FiberCable) =>
  (cable as any).endDistributionPointId ??
  (cable as any).end_distribution_point_id ??
  cable.end_point_id;

const toGraphQLFiberCable = (raw?: FiberCable): Record<string, any> | null => {
  if (!raw) {
    return null;
  }

  const totalStrands = raw.totalStrands ?? raw.total_strands ?? raw.fiber_count ?? 24;
  const usedStrands =
    raw.usedStrands ?? raw.used_strands ?? raw.utilized_fibers ?? Math.min(totalStrands, 12);
  const availableStrands =
    raw.availableStrands ??
    raw.available_strands ??
    raw.available_fibers ??
    Math.max(totalStrands - usedStrands, 0);
  const lengthMeters = raw.lengthMeters ?? raw.length_meters ?? 1500;
  const startDistributionPointId =
    raw.startDistributionPointId ??
    (raw as any).start_distribution_point_id ??
    raw.start_point_id ??
    "dp-start-001";
  const endDistributionPointId =
    raw.endDistributionPointId ??
    (raw as any).end_distribution_point_id ??
    raw.end_point_id ??
    "dp-end-001";
  const route = (raw as any).route ?? {};
  const startPoint = ensureGeoPoint(route.startPoint);
  const endPoint = ensureGeoPoint(
    route.endPoint ?? {
      latitude: startPoint.latitude + 0.01,
      longitude: startPoint.longitude + 0.01,
      altitude: startPoint.altitude,
    },
  );
  const intermediatePoints =
    route.intermediatePoints && route.intermediatePoints.length
      ? route.intermediatePoints.map((point: GeoPoint) => ensureGeoPoint(point))
      : [
          ensureGeoPoint({
            latitude: (startPoint.latitude + endPoint.latitude) / 2,
            longitude: (startPoint.longitude + endPoint.longitude) / 2,
            altitude: (startPoint.altitude + endPoint.altitude) / 2,
          }),
        ];
  const splicePointIds = ensureArray((raw as any).splicePointIds ?? (raw as any).splice_point_ids, [
    "splice-001",
    "splice-002",
  ]);

  return {
    id: raw.id,
    cableId: raw.cableId ?? raw.cable_id ?? raw.id,
    cableCode: raw.cableCode ?? raw.cable_code ?? `FC-${raw.id}`,
    name: raw.name ?? `Fiber Cable ${raw.id}`,
    description: raw.description ?? raw.route_description ?? "Primary backbone connection",
    status: raw.status ?? "ACTIVE",
    isActive: raw.isActive ?? raw.is_active ?? true,
    fiberType: raw.fiberType ?? raw.fiber_type ?? "SINGLE_MODE",
    totalStrands,
    availableStrands,
    usedStrands,
    manufacturer: raw.manufacturer ?? "Corning",
    model: raw.model ?? "SM-24",
    installationType: raw.installationType ?? raw.installation_type ?? "UNDERGROUND",
    route: {
      pathGeojson: route.pathGeojson ?? '{"type":"LineString","coordinates":[[0,0],[1,1]]}',
      totalDistanceMeters: route.totalDistanceMeters ?? lengthMeters,
      startPoint,
      endPoint,
      intermediatePoints,
      elevationChangeMeters: route.elevationChangeMeters ?? 5,
      undergroundDistanceMeters: route.undergroundDistanceMeters ?? lengthMeters * 0.7,
      aerialDistanceMeters: route.aerialDistanceMeters ?? lengthMeters * 0.3,
    },
    lengthMeters,
    strands: buildStrands(totalStrands, usedStrands, (raw as any).strands),
    startDistributionPointId,
    endDistributionPointId,
    startPointName: raw.startPointName ?? raw.start_point_name ?? "Start Distribution Point",
    endPointName: raw.endPointName ?? raw.end_point_name ?? "End Distribution Point",
    capacityUtilizationPercent:
      raw.capacityUtilizationPercent ??
      raw.capacity_utilization_percent ??
      calculatePercent(usedStrands, totalStrands),
    bandwidthCapacityGbps: raw.bandwidthCapacityGbps ?? raw.bandwidth_capacity_gbps ?? 10,
    splicePointIds,
    spliceCount: raw.spliceCount ?? raw.splice_count ?? splicePointIds.length,
    totalLossDb: raw.totalLossDb ?? raw.total_loss_db ?? 0.5,
    averageAttenuationDbPerKm:
      raw.averageAttenuationDbPerKm ?? raw.average_attenuation_db_per_km ?? 0.25,
    maxAttenuationDbPerKm: raw.maxAttenuationDbPerKm ?? raw.max_attenuation_db_per_km ?? 0.3,
    conduitId: (raw as any).conduitId ?? (raw as any).conduit_id ?? "conduit-001",
    ductNumber: (raw as any).ductNumber ?? (raw as any).duct_number ?? "duct-1",
    armored: (raw as any).armored ?? (raw as any).is_armored ?? false,
    fireRated: (raw as any).fireRated ?? (raw as any).is_fire_rated ?? true,
    ownerId: (raw as any).ownerId ?? (raw as any).owner_id ?? "owner-001",
    ownerName: (raw as any).ownerName ?? (raw as any).owner_name ?? "Dotmac Fiber",
    healthStatus: (raw as any).healthStatus ?? raw.health_status ?? "GOOD",
    healthScore: (raw as any).healthScore ?? 95,
    isLeased: raw.isLeased ?? raw.is_leased ?? false,
    installedAt: raw.installedAt ?? raw.installed_at ?? raw.installation_date ?? "2024-01-15",
    testedAt: (raw as any).testedAt ?? raw.last_inspection_date ?? toIsoString(),
    createdAt: raw.createdAt ?? raw.created_at ?? toIsoString(),
    updatedAt: raw.updatedAt ?? raw.updated_at ?? toIsoString(),
  };
};

const toGraphQLSplicePoint = (raw?: SplicePoint): Record<string, any> | null => {
  if (!raw) {
    return null;
  }

  const totalSplices = (raw as any).totalSplices ?? raw.fiber_count ?? 12;
  const activeSplices = (raw as any).activeSplices ?? Math.min(totalSplices, 10);

  return {
    id: raw.id,
    spliceId: (raw as any).spliceId ?? raw.splice_code ?? `SP-${raw.id}`,
    name: raw.name ?? raw.splice_code ?? `Splice ${raw.id}`,
    cableId: (raw as any).cableId ?? raw.cable_id ?? "cable-001",
    description: raw.description ?? raw.location_description ?? "Fiber splice enclosure",
    status: raw.status ?? "ACTIVE",
    isActive: raw.status !== "DECOMMISSIONED",
    location: ensureGeoPoint({
      latitude: raw.latitude,
      longitude: raw.longitude,
      altitude: (raw as any).altitude,
    }),
    address: ensureAddress((raw as any).address, raw.location_description ?? "Fiber Node"),
    distributionPointId: raw.distribution_point_id ?? "dp-001",
    closureType: raw.splice_type ?? "FUSION",
    manufacturer: raw.manufacturer ?? "Corning",
    model: raw.model ?? "SP-1",
    trayCount: (raw as any).trayCount ?? 4,
    trayCapacity: (raw as any).trayCapacity ?? 24,
    cablesConnected: (raw as any).cablesConnected ?? 2,
    cableCount: (raw as any).cableCount ?? 2,
    spliceConnections: (raw as any).spliceConnections ?? [
      {
        cableAId: raw.cable_id ?? "cable-001",
        cableAStrand: 1,
        cableBId: "cable-002",
        cableBStrand: 1,
        spliceType: "FUSION",
        lossDb: 0.12,
        reflectanceDb: -45,
        isPassing: true,
        testResult: "PASS",
        testedAt: toIsoString(),
        testedBy: "Technician A",
      },
    ],
    totalSplices,
    activeSplices,
    averageSpliceLossDb: (raw as any).averageSpliceLossDb ?? 0.12,
    maxSpliceLossDb: (raw as any).maxSpliceLossDb ?? 0.35,
    passingSplices: (raw as any).passingSplices ?? Math.max(activeSplices - 1, 0),
    failingSplices: (raw as any).failingSplices ?? 1,
    accessType: (raw as any).accessType ?? "CABINET",
    requiresSpecialAccess: (raw as any).requiresSpecialAccess ?? false,
    accessNotes: (raw as any).accessNotes ?? "Badge access required",
    installedAt: raw.installation_date ?? toIsoString(),
    lastTestedAt: raw.last_test_date ?? toIsoString(),
    lastMaintainedAt: raw.last_maintenance_date ?? toIsoString(),
    createdAt: raw.created_at ?? toIsoString(),
    updatedAt: raw.updated_at ?? toIsoString(),
  };
};

const toGraphQLDistributionPoint = (raw?: DistributionPoint): Record<string, any> | null => {
  if (!raw) {
    return null;
  }

  const totalCapacity = raw.total_capacity ?? 96;
  const usedCapacity = raw.used_capacity ?? raw.utilized_capacity ?? 48;
  const availableCapacity = raw.available_capacity ?? Math.max(totalCapacity - usedCapacity, 0);

  return {
    id: raw.id,
    siteId: (raw as any).siteId ?? raw.site_id ?? "site-001",
    siteName: raw.site_name ?? "Downtown Site",
    name: raw.name ?? `Distribution Point ${raw.id}`,
    description: raw.description ?? raw.location_description ?? "Distribution cabinet",
    pointType: raw.point_type ?? "CABINET",
    status: raw.status ?? "ACTIVE",
    isActive: raw.status !== "DECOMMISSIONED",
    location: ensureGeoPoint({
      latitude: raw.latitude,
      longitude: raw.longitude,
      altitude: (raw as any).altitude,
    }),
    address: ensureAddress((raw as any).address, raw.location_description ?? "Main St"),
    manufacturer: raw.manufacturer ?? "FiberHome",
    model: raw.model ?? "DP-96",
    totalCapacity,
    availableCapacity,
    usedCapacity,
    portCount: (raw as any).portCount ?? 96,
    incomingCables: (raw as any).incomingCables ?? 4,
    outgoingCables: (raw as any).outgoingCables ?? 8,
    totalCablesConnected: (raw as any).totalCablesConnected ?? 12,
    splicePoints: ensureArray((raw as any).splicePoints, ["splice-001", "splice-002"]),
    splicePointCount: (raw as any).splicePointCount ?? 2,
    serviceAreaIds: ensureArray((raw as any).serviceAreaIds, ["sa-001"]),
    hasPower: (raw as any).hasPower ?? true,
    batteryBackup: (raw as any).batteryBackup ?? true,
    environmentalMonitoring: (raw as any).environmentalMonitoring ?? true,
    temperatureCelsius: (raw as any).temperatureCelsius ?? 28,
    humidityPercent: (raw as any).humidityPercent ?? 55,
    capacityUtilizationPercent:
      raw.capacityUtilizationPercent ?? calculatePercent(usedCapacity, totalCapacity),
    fiberStrandCount: (raw as any).fiberStrandCount ?? 192,
    availableStrandCount: (raw as any).availableStrandCount ?? 100,
    servesCustomerCount: (raw as any).servesCustomerCount ?? 250,
    accessType: raw.accessType ?? "LOCKED",
    requiresKey: (raw as any).requiresKey ?? true,
    securityLevel: (raw as any).securityLevel ?? "standard",
    accessNotes: raw.accessNotes ?? "Requires technician badge",
    ports:
      (raw as any).ports ??
      Array.from({ length: 4 }, (_, index) => ({
        portNumber: index + 1,
        isAllocated: index % 2 === 0,
        isActive: true,
        cableId: `cable-00${index + 1}`,
        strandId: index + 1,
        customerId: `customer-${index + 1}`,
        customerName: `Customer ${index + 1}`,
        serviceId: `service-${index + 1}`,
      })),
    installedAt: raw.installation_date ?? toIsoString(),
    lastInspectedAt: raw.last_inspection_date ?? toIsoString(),
    lastMaintainedAt: raw.last_maintenance_date ?? toIsoString(),
    createdAt: raw.created_at ?? toIsoString(),
    updatedAt: raw.updated_at ?? toIsoString(),
  };
};

const toGraphQLServiceArea = (raw?: ServiceArea): Record<string, any> | null => {
  if (!raw) {
    return null;
  }

  const homesPassed = (raw as any).homesPassed ?? raw.total_homes_passed ?? 500;
  const homesConnected = (raw as any).homesConnected ?? raw.connected_homes ?? 300;
  const totalCapacity = (raw as any).totalCapacity ?? 10000;
  const usedCapacity = (raw as any).usedCapacity ?? Math.round(totalCapacity * 0.6);
  const distributionPointIds = ensureArray(
    (raw as any).distributionPointIds ?? raw.distribution_point_ids,
    ["dp-001", "dp-002"],
  );

  return {
    id: raw.id,
    areaId: (raw as any).areaId ?? raw.area_code ?? raw.id,
    name: raw.name ?? raw.area_name ?? `Service Area ${raw.id}`,
    description: raw.description ?? raw.notes ?? "Fiber coverage area",
    areaType: raw.area_type ?? "RESIDENTIAL",
    isActive: (raw as any).isActive ?? true,
    isServiceable: raw.is_serviceable ?? true,
    boundaryGeojson:
      raw.coverage_geometry ?? '{"type":"Polygon","coordinates":[[0,0],[1,0],[1,1],[0,1],[0,0]]}',
    areaSqkm: (raw as any).areaSqkm ?? 10,
    city: (raw as any).city ?? "Metropolis",
    stateProvince: (raw as any).stateProvince ?? "State",
    postalCodes: ensureArray(raw.postal_codes ?? (raw as any).postalCodes, ["10001"]),
    streetCount: (raw as any).streetCount ?? 25,
    homesPassed,
    homesConnected,
    businessesPassed: (raw as any).businessesPassed ?? 50,
    businessesConnected: (raw as any).businessesConnected ?? 25,
    penetrationRatePercent:
      (raw as any).penetrationRatePercent ??
      raw.penetration_rate ??
      calculatePercent(homesConnected, homesPassed),
    distributionPointIds,
    distributionPointCount:
      (raw as any).distributionPointCount ??
      raw.distribution_point_count ??
      distributionPointIds.length,
    totalFiberKm: raw.total_fiber_km ?? 12.5,
    totalCapacity,
    usedCapacity,
    availableCapacity: (raw as any).availableCapacity ?? Math.max(totalCapacity - usedCapacity, 0),
    capacityUtilizationPercent:
      (raw as any).capacityUtilizationPercent ?? calculatePercent(usedCapacity, totalCapacity),
    maxBandwidthGbps: (raw as any).maxBandwidthGbps ?? 10,
    averageDistanceToDistributionMeters: (raw as any).averageDistanceToDistributionMeters ?? 150,
    estimatedPopulation: (raw as any).estimatedPopulation ?? 10000,
    householdDensityPerSqkm: (raw as any).householdDensityPerSqkm ?? 800,
    constructionStatus: raw.construction_status ?? "COMPLETED",
    constructionCompletePercent: (raw as any).constructionCompletePercent ?? 100,
    targetCompletionDate: (raw as any).targetCompletionDate ?? toIsoString(),
    plannedAt: (raw as any).plannedAt ?? "2023-01-01",
    constructionStartedAt: (raw as any).constructionStartedAt ?? "2023-06-01",
    activatedAt: (raw as any).activatedAt ?? "2024-02-01",
    createdAt: raw.created_at ?? toIsoString(),
    updatedAt: raw.updated_at ?? toIsoString(),
  };
};

const toGraphQLHealthMetric = (raw?: FiberHealthMetric): Record<string, any> | null => {
  if (!raw) {
    return null;
  }

  return {
    cableId: raw.cable_id,
    cableName: raw.cable_code ?? raw.cable_id,
    healthStatus: raw.health_status,
    healthScore: (raw as any).healthScore ?? 95,
    totalLossDb: raw.signal_loss_db,
    averageLossPerKmDb: (raw as any).averageLossPerKmDb ?? 0.25,
    maxLossPerKmDb: (raw as any).maxLossPerKmDb ?? 0.45,
    reflectanceDb: raw.reflectance_db ?? -45,
    averageSpliceLossDb: (raw as any).averageSpliceLossDb ?? 0.12,
    maxSpliceLossDb: (raw as any).maxSpliceLossDb ?? 0.35,
    failingSplicesCount: (raw as any).failingSplicesCount ?? 1,
    totalStrands: (raw as any).totalStrands ?? 24,
    activeStrands: (raw as any).activeStrands ?? 20,
    degradedStrands: (raw as any).degradedStrands ?? 2,
    failedStrands: (raw as any).failedStrands ?? 1,
    lastTestedAt: raw.measured_at,
    testPassRatePercent: (raw as any).testPassRatePercent ?? 98,
    daysSinceLastTest: (raw as any).daysSinceLastTest ?? 5,
    activeAlarms: (raw as any).activeAlarms ?? 0,
    warningCount: (raw as any).warningCount ?? 1,
    requiresMaintenance: (raw as any).requiresMaintenance ?? false,
  };
};

// ============================================================================
// IN-MEMORY STORAGE
// ============================================================================

let fiberCables: FiberCable[] = [];
let splicePoints: SplicePoint[] = [];
let distributionPoints: DistributionPoint[] = [];
let serviceAreas: ServiceArea[] = [];
let healthMetrics: FiberHealthMetric[] = [];

// ============================================================================
// MOCK DATA FACTORIES
// ============================================================================

export function createMockFiberCable(overrides: Partial<FiberCable> = {}): FiberCable {
  const id = overrides.id || `cable-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const cableId = overrides.cableId ?? overrides.cable_id ?? id;
  const cableCode = overrides.cableCode ?? overrides.cable_code ?? `FC-${id.split("-")[1]}`;
  const name = overrides.name ?? `Fiber Cable ${id.split("-")[1]}`;
  const description = overrides.description ?? "Primary backbone connection";
  const status = overrides.status ?? "ACTIVE";
  const fiberType = overrides.fiberType ?? overrides.fiber_type ?? "SINGLE_MODE";
  const installationType =
    overrides.installationType ?? overrides.installation_type ?? "UNDERGROUND";
  const totalStrands = overrides.total_strands ?? overrides.fiber_count ?? 24;
  const usedStrands =
    overrides.used_strands ?? overrides.utilized_fibers ?? Math.min(12, totalStrands);
  const availableStrands = overrides.available_strands ?? totalStrands - usedStrands;
  const lengthMeters = overrides.length_meters ?? 1500;
  const startPointId = overrides.start_point_id ?? "dp-start-001";
  const endPointId = overrides.end_point_id ?? "dp-end-001";
  const startDistributionPointId =
    overrides.startDistributionPointId ?? overrides.start_distribution_point_id ?? startPointId;
  const endDistributionPointId =
    overrides.endDistributionPointId ?? overrides.end_distribution_point_id ?? endPointId;
  const routeDescription = overrides.route_description ?? "Main street to distribution cabinet";
  const installationDate = overrides.installation_date ?? "2024-01-15";
  const lastInspectionDate = overrides.last_inspection_date ?? "2024-11-01";
  const siteId = overrides.site_id ?? "site-001";
  const siteName = overrides.site_name ?? "Downtown Site";
  const healthStatus = overrides.health_status ?? "GOOD";
  const signalLossDb = overrides.signal_loss_db ?? 0.25;
  const createdAt = overrides.created_at ?? new Date().toISOString();
  const updatedAt = overrides.updated_at ?? new Date().toISOString();
  const capacityUtilization =
    overrides.capacity_utilization_percent ??
    Number(((usedStrands / totalStrands) * 100).toFixed(2));
  const bandwidthCapacity = overrides.bandwidth_capacity_gbps ?? 10;
  const spliceCount = overrides.splice_count ?? 4;
  const totalLossDb = overrides.total_loss_db ?? 0.5;
  const avgAttenuation = overrides.average_attenuation_db_per_km ?? 0.25;
  const maxAttenuation = overrides.max_attenuation_db_per_km ?? 0.3;
  const isLeased = overrides.is_leased ?? false;
  const manufacturer = overrides.manufacturer ?? "Corning";
  const model = overrides.model ?? "SM-24";
  const startPointName = overrides.start_point_name ?? "Main Hub";
  const endPointName = overrides.end_point_name ?? "Distribution Node";
  const splicePointIds = overrides.splice_point_ids ?? ["splice-001", "splice-002"];

  return {
    id,
    cable_id: cableId,
    cableId,
    cable_code: cableCode,
    cableCode,
    name,
    description,
    status,
    is_active: overrides.is_active ?? true,
    isActive: overrides.is_active ?? true,
    fiber_type: fiberType,
    fiberType,
    installation_type: installationType,
    installationType,
    fiber_count: totalStrands,
    total_strands: totalStrands,
    totalStrands,
    utilized_fibers: usedStrands,
    used_strands: usedStrands,
    usedStrands,
    available_fibers: availableStrands,
    available_strands: availableStrands,
    availableStrands,
    manufacturer,
    model,
    length_meters: lengthMeters,
    lengthMeters,
    start_point_id: startPointId,
    startPointId,
    start_distribution_point_id: startDistributionPointId,
    startDistributionPointId,
    end_point_id: endPointId,
    endPointId,
    end_distribution_point_id: endDistributionPointId,
    endDistributionPointId,
    start_point_name: startPointName,
    startPointName,
    end_point_name: endPointName,
    endPointName,
    route_description: routeDescription,
    routeDescription,
    route: {
      totalDistanceMeters: lengthMeters,
      startPoint: {
        latitude: overrides.start_latitude ?? 6.5244,
        longitude: overrides.start_longitude ?? 3.3792,
        altitude: overrides.start_altitude ?? 10,
      },
      endPoint: {
        latitude: overrides.end_latitude ?? 6.5344,
        longitude: overrides.end_longitude ?? 3.3892,
        altitude: overrides.end_altitude ?? 12,
      },
    },
    installation_date: installationDate,
    installationDate,
    last_inspection_date: lastInspectionDate,
    lastInspectionDate,
    site_id: siteId,
    siteId,
    site_name: siteName,
    siteName,
    health_status: healthStatus,
    healthStatus,
    signal_loss_db: signalLossDb,
    signalLossDb,
    capacity_utilization_percent: capacityUtilization,
    capacityUtilizationPercent: capacityUtilization,
    bandwidth_capacity_gbps: bandwidthCapacity,
    bandwidthCapacityGbps: bandwidthCapacity,
    splice_count: spliceCount,
    spliceCount,
    total_loss_db: totalLossDb,
    totalLossDb,
    average_attenuation_db_per_km: avgAttenuation,
    averageAttenuationDbPerKm: avgAttenuation,
    max_attenuation_db_per_km: maxAttenuation,
    maxAttenuationDbPerKm: maxAttenuation,
    is_leased: isLeased,
    isLeased: isLeased,
    installed_at: installationDate,
    installedAt: installationDate,
    created_at: createdAt,
    createdAt,
    updated_at: updatedAt,
    updatedAt,
    splice_point_ids: splicePointIds,
    splicePointIds,
    ...overrides,
  } as FiberCable & Record<string, any>;
}

export function createMockSplicePoint(overrides: Partial<SplicePoint> = {}): SplicePoint {
  const id = overrides.id || `splice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    id,
    splice_code: `SP-${id.split("-")[1]}`,
    cable_id: "cable-001",
    cable_code: "FC-001",
    distribution_point_id: "dp-001",
    splice_type: "FUSION",
    status: "ACTIVE",
    fiber_count: 12,
    location_description: "Junction box at Main St",
    latitude: 40.7128,
    longitude: -74.006,
    installation_date: "2024-02-01",
    last_test_date: "2024-10-15",
    test_results: "Pass",
    notes: "All splices verified",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockDistributionPoint(
  overrides: Partial<DistributionPoint> = {},
): DistributionPoint {
  const id = overrides.id || `dp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const totalCapacity = overrides.total_capacity || 96;
  const utilizedCapacity =
    overrides.utilized_capacity !== undefined ? overrides.utilized_capacity : 48;

  return {
    id,
    point_code: `DP-${id.split("-")[1]}`,
    pointCode: overrides.pointCode ?? `DP-${id.split("-")[1]}`,
    name: overrides.name ?? `Distribution Point ${id.split("-")[1]}`,
    point_type: "CABINET",
    status: "ACTIVE",
    total_capacity: totalCapacity,
    utilized_capacity: utilizedCapacity,
    used_capacity: utilizedCapacity,
    available_capacity: totalCapacity - utilizedCapacity,
    site_id: "site-001",
    siteId: overrides.siteId ?? overrides.site_id ?? "site-001",
    site_name: "Downtown Site",
    location_description: "Main St & 5th Ave",
    latitude: 40.7589,
    longitude: -73.9851,
    installation_date: "2023-12-01",
    last_maintenance_date: "2024-10-01",
    notes: "Regular maintenance completed",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as DistributionPoint & Record<string, any>;
}

export function createMockServiceArea(overrides: Partial<ServiceArea> = {}): ServiceArea {
  const id = overrides.id || `sa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const totalHomes = overrides.total_homes_passed || 500;
  const connectedHomes = overrides.connected_homes !== undefined ? overrides.connected_homes : 300;

  return {
    id,
    area_code: `SA-${id.split("-")[1]}`,
    area_name: "Downtown District",
    area_type: "RESIDENTIAL",
    is_serviceable: true,
    construction_status: "COMPLETED",
    total_homes_passed: totalHomes,
    connected_homes: connectedHomes,
    penetration_rate: (connectedHomes / totalHomes) * 100,
    postal_codes: ["10001", "10002"],
    coverage_geometry: '{"type":"Polygon","coordinates":[...]}',
    notes: "Fully deployed",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockFiberDashboard(): FiberDashboard {
  const analytics = createMockNetworkAnalytics();

  const cableRecords =
    fiberCables.length > 0
      ? fiberCables.map(toGraphQLFiberCable).filter(isDefined)
      : [
          toGraphQLFiberCable(
            createMockFiberCable({ id: "cable-001", utilized_fibers: 22, fiber_count: 24 }),
          ),
          toGraphQLFiberCable(
            createMockFiberCable({ id: "cable-002", utilized_fibers: 18, fiber_count: 24 }),
          ),
          toGraphQLFiberCable(
            createMockFiberCable({ id: "cable-003", utilized_fibers: 16, fiber_count: 24 }),
          ),
        ].filter(isDefined);

  const distributionRecords =
    distributionPoints.length > 0
      ? distributionPoints.map(toGraphQLDistributionPoint).filter(isDefined)
      : [
          toGraphQLDistributionPoint(
            createMockDistributionPoint({
              id: "dp-001",
              utilized_capacity: 88,
              total_capacity: 96,
            }),
          ),
          toGraphQLDistributionPoint(
            createMockDistributionPoint({
              id: "dp-002",
              utilized_capacity: 72,
              total_capacity: 96,
            }),
          ),
          toGraphQLDistributionPoint(
            createMockDistributionPoint({
              id: "dp-003",
              utilized_capacity: 92,
              total_capacity: 96,
            }),
          ),
        ].filter(isDefined);

  const serviceAreaRecords =
    serviceAreas.length > 0
      ? serviceAreas.map(toGraphQLServiceArea).filter(isDefined)
      : [
          toGraphQLServiceArea(
            createMockServiceArea({ id: "sa-001", connected_homes: 450, total_homes_passed: 500 }),
          ),
          toGraphQLServiceArea(
            createMockServiceArea({ id: "sa-002", connected_homes: 380, total_homes_passed: 500 }),
          ),
          toGraphQLServiceArea(
            createMockServiceArea({
              id: "sa-003",
              is_serviceable: false,
              construction_status: "PLANNED",
            }),
          ),
        ].filter(isDefined);

  const toCableSummary = (entry: Record<string, any>): FiberDashboardCableSummary => ({
    id: entry.id,
    cableId: entry.cableId,
    name: entry.name,
    capacityUtilizationPercent: entry.capacityUtilizationPercent,
    totalStrands: entry.totalStrands,
    usedStrands: entry.usedStrands,
  });

  const toDistributionSummary = (
    entry: Record<string, any>,
  ): FiberDashboardDistributionSummary => ({
    id: entry.id,
    name: entry.name,
    capacityUtilizationPercent: entry.capacityUtilizationPercent,
    totalCapacity: entry.totalCapacity,
    usedCapacity: entry.usedCapacity,
  });

  const toServiceAreaSummary = (entry: Record<string, any>): FiberDashboardServiceAreaSummary => ({
    id: entry.id,
    name: entry.name,
    city: entry.city,
    penetrationRatePercent: entry.penetrationRatePercent,
    homesPassed: entry.homesPassed,
    homesConnected: entry.homesConnected,
  });

  const topCables = cableRecords.slice(0, 3).map(toCableSummary);
  const distributionSummaries = distributionRecords.map(toDistributionSummary);
  const serviceAreaSummaries = serviceAreaRecords.map(toServiceAreaSummary);

  const cablesRequiringAttention: FiberDashboardAttention[] = cableRecords
    .slice(0, 3)
    .map((entry) => ({
      id: entry.id,
      cableId: entry.cableId,
      cableName: entry.name,
      healthStatus: entry.healthStatus ?? "GOOD",
      healthScore: entry.healthScore ?? 95,
      requiresMaintenance: entry.capacityUtilizationPercent >= 85 || entry.healthStatus === "POOR",
    }));

  const distributionNearCapacity = distributionSummaries.filter(
    (entry) => entry.capacityUtilizationPercent >= 85,
  );
  const serviceAreasNeedingExpansion = serviceAreaSummaries.filter(
    (entry) => entry.penetrationRatePercent < 65 || entry.homesConnected < entry.homesPassed * 0.6,
  );

  const recentTestResults: FiberDashboardTestResult[] = cableRecords
    .slice(0, 3)
    .map((entry, index) => ({
      testId: `test-${index + 1}`,
      cableId: entry.cableId,
      strandId: index + 1,
      testedAt: toIsoString(),
      isPassing: index % 2 === 0,
      totalLossDb: entry.totalLossDb ?? 0.5,
    }));

  const ensureSummaryFallback = <T>(items: T[], fallback: T[]): T[] =>
    items.length ? items : fallback;

  const buildTrend = (start: number, step: number) =>
    Array.from({ length: 6 }, (_, idx) => Number((start + idx * step).toFixed(2)));

  return {
    analytics,
    topCablesByUtilization: ensureSummaryFallback(
      topCables,
      cableRecords.slice(0, 3).map(toCableSummary),
    ),
    topDistributionPointsByCapacity: ensureSummaryFallback(
      distributionSummaries.slice(0, 2),
      distributionRecords.slice(0, 2).map(toDistributionSummary),
    ),
    topServiceAreasByPenetration: ensureSummaryFallback(
      serviceAreaSummaries.slice(0, 2),
      serviceAreaRecords.slice(0, 2).map(toServiceAreaSummary),
    ),
    cablesRequiringAttention,
    recentTestResults,
    distributionPointsNearCapacity: ensureSummaryFallback(
      distributionNearCapacity,
      distributionSummaries.slice(0, 2),
    ),
    serviceAreasExpansionCandidates: ensureSummaryFallback(
      serviceAreasNeedingExpansion,
      serviceAreaSummaries.slice(0, 2),
    ),
    newConnectionsTrend: buildTrend(40, 5),
    capacityUtilizationTrend: buildTrend(70, 2.5),
    networkHealthTrend: buildTrend(90, -1.5),
    generatedAt: toIsoString(),
  };
}

export function createMockNetworkAnalytics(): FiberNetworkAnalytics {
  return {
    total_fiber_km: 125.5,
    total_cables: 45,
    total_strands: 1080,
    total_splice_points: 320,
    total_distribution_points: 28,
    total_service_areas: 12,
    total_capacity: 1000,
    used_capacity: 540,
    available_capacity: 460,
    capacity_utilization_percent: 54.0,
    cables_by_status: {
      ACTIVE: 38,
      INACTIVE: 5,
      UNDER_CONSTRUCTION: 1,
      MAINTENANCE: 1,
    },
    cables_by_type: {
      SINGLE_MODE: 30,
      MULTI_MODE: 10,
      HYBRID: 5,
    },
    cables_active: 38,
    cables_inactive: 5,
    cables_under_construction: 1,
    cables_maintenance: 1,
    cables_due_for_testing: 3,
    cables_with_high_loss: ["cable-004"],
    healthy_cables: 40,
    degraded_cables: 3,
    failed_cables: 2,
    average_cable_loss_db_per_km: 0.25,
    average_splice_loss_db: 0.15,
    network_health_score: 92.5,
    homes_passed: 15000,
    homes_connected: 12000,
    penetration_rate_percent: 80.0,
    distribution_points_near_capacity: ["dp-001", "dp-002"],
    service_areas_needs_expansion: ["sa-003"],
    active_service_areas: 10,
    generated_at: new Date().toISOString(),
  } as any;
}

export function createMockHealthMetrics(): FiberHealthMetric {
  return {
    id: `health-${Date.now()}`,
    cable_id: "cable-001",
    cable_code: "FC-001",
    health_status: "GOOD",
    signal_loss_db: 0.25,
    reflectance_db: -45.0,
    test_wavelength: 1550,
    measured_at: new Date().toISOString(),
    issues: [],
    recommendations: [],
    created_at: new Date().toISOString(),
  };
}

// ============================================================================
// SEED FUNCTIONS
// ============================================================================

export function seedFiberData(
  cables: FiberCable[],
  splices: SplicePoint[],
  dps: DistributionPoint[],
  areas: ServiceArea[],
  metrics: FiberHealthMetric[] = [],
) {
  fiberCables = cables;
  splicePoints = splices;
  distributionPoints = dps;
  serviceAreas = areas;
  healthMetrics = metrics;
}

export function resetFiberData() {
  fiberCables = [];
  splicePoints = [];
  distributionPoints = [];
  serviceAreas = [];
  healthMetrics = [];
}

// ============================================================================
// GRAPHQL HANDLERS
// ============================================================================

export const graphqlFiberHandlers = [
  // Fiber Dashboard Query
  graphql.query("FiberDashboard", ({ variables }) => {
    const dashboard = createMockFiberDashboard();
    return respondWithCamelCase({
      fiberDashboard: dashboard,
    });
  }),

  // Fiber Cable List Query (with pagination)
  graphql.query("FiberCableList", ({ variables }) => {
    const {
      limit = 50,
      offset = 0,
      status,
      fiberType,
      installationType,
      siteId,
      search,
    } = getVariables<{
      limit?: number;
      offset?: number;
      status?: FiberCableStatus;
      fiberType?: FiberType;
      installationType?: CableInstallationType;
      siteId?: string;
      search?: string;
    }>(variables);

    let filtered = [...fiberCables];

    if (status) {
      filtered = filtered.filter((c) => c.status === status);
    }
    if (fiberType) {
      filtered = filtered.filter(
        (c) => (c as any).fiberType === fiberType || c.fiber_type === fiberType,
      );
    }
    if (installationType) {
      filtered = filtered.filter(
        (c) =>
          (c as any).installationType === installationType ||
          c.installation_type === installationType,
      );
    }
    if (siteId) {
      filtered = filtered.filter((c) => (c as any).siteId === siteId || c.site_id === siteId);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.cable_code.toLowerCase().includes(searchLower) ||
          (c.route_description?.toLowerCase().includes(searchLower) ?? false) ||
          (c.name?.toLowerCase().includes(searchLower) ?? false),
      );
    }

    const totalCount = filtered.length;
    const paginatedCables = filtered
      .slice(offset, offset + limit)
      .map(toGraphQLFiberCable)
      .filter(isDefined);
    const hasNextPage = offset + limit < totalCount;

    return respondWithCamelCase({
      fiberCables: {
        cables: paginatedCables,
        totalCount,
        hasNextPage,
      },
    });
  }),

  // Fiber Cable Detail Query
  graphql.query("FiberCableDetail", ({ variables }) => {
    const { id } = getVariables<{ id?: string }>(variables);
    const cable = fiberCables.find((c) => c.id === id);

    return respondWithCamelCase({
      fiberCable: toGraphQLFiberCable(cable) || null,
    });
  }),

  // Fiber Cables By Route Query
  graphql.query("FiberCablesByRoute", ({ variables }) => {
    const { startPointId, endPointId } = getVariables<{
      startPointId?: string;
      endPointId?: string;
    }>(variables);
    const cables = fiberCables
      .filter(
        (c) => getCableStartPointId(c) === startPointId && getCableEndPointId(c) === endPointId,
      )
      .map(toGraphQLFiberCable)
      .filter(isDefined);

    return respondWithCamelCase({
      fiberCablesByRoute: cables,
    });
  }),

  // Fiber Cables By Distribution Point Query
  graphql.query("FiberCablesByDistributionPoint", ({ variables }) => {
    const { distributionPointId } = getVariables<{ distributionPointId?: string }>(variables);
    const cables = fiberCables
      .filter((c) => {
        const startId = getCableStartPointId(c);
        const endId = getCableEndPointId(c);
        return startId === distributionPointId || endId === distributionPointId;
      })
      .map(toGraphQLFiberCable)
      .filter(isDefined);

    return respondWithCamelCase({
      fiberCablesByDistributionPoint: cables,
    });
  }),

  // Fiber Health Metrics Query
  graphql.query("FiberHealthMetrics", ({ variables }) => {
    const { cableId, healthStatus } = getVariables<{
      cableId?: string;
      healthStatus?: FiberHealthStatus;
    }>(variables);

    let filtered = [...healthMetrics];

    if (cableId) {
      filtered = filtered.filter((m) => m.cable_id === cableId);
    }
    if (healthStatus) {
      filtered = filtered.filter((m) => m.health_status === healthStatus);
    }

    if (cableId && filtered.length === 0) {
      filtered = [
        createMockHealthMetrics({
          cable_id: cableId,
          cable_code: (cableId || "").toUpperCase(),
          health_status: "GOOD",
        }),
      ];
    }

    const metrics = filtered.map(toGraphQLHealthMetric).filter(isDefined);

    return respondWithCamelCase({
      fiberHealthMetrics: metrics,
    });
  }),

  // Fiber Network Analytics Query
  graphql.query("FiberNetworkAnalytics", ({ variables }) => {
    const analytics = createMockNetworkAnalytics();

    return respondWithCamelCase({
      fiberNetworkAnalytics: analytics,
    });
  }),

  // Splice Point List Query (with pagination)
  graphql.query("SplicePointList", ({ variables }) => {
    const {
      limit = 50,
      offset = 0,
      status,
      cableId,
      distributionPointId,
    } = getVariables<{
      limit?: number;
      offset?: number;
      status?: SpliceStatus;
      cableId?: string;
      distributionPointId?: string;
    }>(variables);

    let filtered = [...splicePoints];

    if (status) {
      filtered = filtered.filter((s) => s.status === status);
    }
    if (cableId) {
      filtered = filtered.filter((s) => (s as any).cableId === cableId || s.cable_id === cableId);
    }
    if (distributionPointId) {
      filtered = filtered.filter(
        (s) =>
          (s as any).distributionPointId === distributionPointId ||
          s.distribution_point_id === distributionPointId,
      );
    }

    const paginatedSplices = filtered
      .slice(offset, offset + limit)
      .map(toGraphQLSplicePoint)
      .filter(isDefined);
    const hasNextPage = offset + limit < filtered.length;

    return respondWithCamelCase({
      splicePoints: {
        splicePoints: paginatedSplices,
        totalCount: filtered.length,
        hasNextPage,
      },
    });
  }),

  // Splice Point Detail Query
  graphql.query("SplicePointDetail", ({ variables }) => {
    const { id } = getVariables<{ id?: string }>(variables);
    const splice = splicePoints.find((s) => s.id === id);

    return respondWithCamelCase({
      splicePoint: toGraphQLSplicePoint(splice) || null,
    });
  }),

  // Splice Points By Cable Query
  graphql.query("SplicePointsByCable", ({ variables }) => {
    const { cableId } = getVariables<{ cableId?: string }>(variables);
    const splices = splicePoints
      .filter((s) => (s as any).cableId === cableId || s.cable_id === cableId)
      .map(toGraphQLSplicePoint)
      .filter(isDefined);

    return respondWithCamelCase({
      splicePointsByCable: splices,
    });
  }),

  // Distribution Point List Query (with pagination)
  graphql.query("DistributionPointList", ({ variables }) => {
    const {
      limit = 50,
      offset = 0,
      pointType,
      status,
      siteId,
      nearCapacity,
    } = getVariables<{
      limit?: number;
      offset?: number;
      pointType?: DistributionPointType;
      status?: FiberCableStatus;
      siteId?: string;
      nearCapacity?: boolean;
    }>(variables);

    let filtered = [...distributionPoints];

    if (pointType) {
      filtered = filtered.filter(
        (d) => (d as any).pointType === pointType || d.point_type === pointType,
      );
    }
    if (status) {
      filtered = filtered.filter((d) => d.status === status);
    }
    if (siteId) {
      filtered = filtered.filter((d) => (d as any).siteId === siteId || d.site_id === siteId);
    }
    if (nearCapacity) {
      filtered = filtered.filter((d) => {
        const utilized = d.used_capacity ?? d.utilized_capacity ?? 0;
        const total = d.total_capacity ?? 1;
        const utilizationPercent = (utilized / total) * 100;
        return utilizationPercent >= 85;
      });
    }

    const paginatedPoints = filtered
      .slice(offset, offset + limit)
      .map(toGraphQLDistributionPoint)
      .filter(isDefined);
    const hasNextPage = offset + limit < filtered.length;

    return respondWithCamelCase({
      distributionPoints: {
        distributionPoints: paginatedPoints,
        totalCount: filtered.length,
        hasNextPage,
      },
    });
  }),

  // Distribution Point Detail Query
  graphql.query("DistributionPointDetail", ({ variables }) => {
    const { id } = getVariables<{ id?: string }>(variables);
    const point = distributionPoints.find((d) => d.id === id);

    return respondWithCamelCase({
      distributionPoint: toGraphQLDistributionPoint(point) || null,
    });
  }),

  // Distribution Points By Site Query
  graphql.query("DistributionPointsBySite", ({ variables }) => {
    const { siteId } = getVariables<{ siteId?: string }>(variables);
    const points = distributionPoints
      .filter((d) => (d as any).siteId === siteId || d.site_id === siteId)
      .map(toGraphQLDistributionPoint)
      .filter(isDefined);

    return respondWithCamelCase({
      distributionPointsBySite: points,
    });
  }),

  // Service Area List Query (with pagination)
  graphql.query("ServiceAreaList", ({ variables }) => {
    const {
      limit = 50,
      offset = 0,
      areaType,
      isServiceable,
      constructionStatus,
    } = getVariables<{
      limit?: number;
      offset?: number;
      areaType?: ServiceAreaType;
      isServiceable?: boolean;
      constructionStatus?: string;
    }>(variables);

    let filtered = [...serviceAreas];

    if (areaType) {
      filtered = filtered.filter(
        (a) => (a as any).areaType === areaType || a.area_type === areaType,
      );
    }
    if (isServiceable !== undefined) {
      filtered = filtered.filter(
        (a) => (a.is_serviceable ?? (a as any).isServiceable) === isServiceable,
      );
    }
    if (constructionStatus) {
      filtered = filtered.filter(
        (a) =>
          (a as any).constructionStatus === constructionStatus ||
          a.construction_status === constructionStatus,
      );
    }

    const paginatedAreas = filtered
      .slice(offset, offset + limit)
      .map(toGraphQLServiceArea)
      .filter(isDefined);
    const hasNextPage = offset + limit < filtered.length;

    return respondWithCamelCase({
      serviceAreas: {
        serviceAreas: paginatedAreas,
        totalCount: filtered.length,
        hasNextPage,
      },
    });
  }),

  // Service Area Detail Query
  graphql.query("ServiceAreaDetail", ({ variables }) => {
    const { id } = getVariables<{ id?: string }>(variables);
    const area = serviceAreas.find((a) => a.id === id);

    return respondWithCamelCase({
      serviceArea: toGraphQLServiceArea(area) || null,
    });
  }),

  // Service Areas By Postal Code Query
  graphql.query("ServiceAreasByPostalCode", ({ variables }) => {
    const { postalCode } = getVariables<{ postalCode?: string }>(variables);
    const areas = serviceAreas
      .filter((a) => (a.postal_codes ?? (a as any).postalCodes ?? []).includes(postalCode))
      .map(toGraphQLServiceArea)
      .filter(isDefined);

    return respondWithCamelCase({
      serviceAreasByPostalCode: areas,
    });
  }),
];
