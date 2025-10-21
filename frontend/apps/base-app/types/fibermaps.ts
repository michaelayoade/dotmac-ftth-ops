/**
 * FiberMaps Type Definitions
 *
 * Type definitions for fiber infrastructure mapping and management
 */

// ============================================================================
// Geographic Types
// ============================================================================

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeoPath {
  id: string;
  coordinates: Coordinates[];
  distance_meters?: number;
}

// ============================================================================
// Fiber Infrastructure Types
// ============================================================================

export type FiberCableType =
  | "single_mode"
  | "multi_mode"
  | "armored"
  | "aerial"
  | "underground"
  | "submarine";

export type FiberCableStatus =
  | "active"
  | "inactive"
  | "planned"
  | "under_construction"
  | "maintenance"
  | "damaged";

export type SplicePointType =
  | "fusion_splice"
  | "mechanical_splice"
  | "connector"
  | "distribution_point"
  | "patch_panel";

export type ConduitType = "pvc" | "hdpe" | "metal" | "concrete" | "direct_buried";

// ============================================================================
// Fiber Cable
// ============================================================================

export interface FiberCable {
  id: string;
  cable_name: string;
  cable_type: FiberCableType;
  status: FiberCableStatus;
  fiber_count: number;
  available_fibers: number;
  path: GeoPath;
  start_point: {
    id: string;
    name: string;
    coordinates: Coordinates;
  };
  end_point: {
    id: string;
    name: string;
    coordinates: Coordinates;
  };
  length_meters: number;
  installation_date?: string;
  owner?: string;
  vendor?: string;
  specifications?: {
    core_diameter?: string;
    attenuation?: string;
    bandwidth?: string;
    jacket_color?: string;
  };
  maintenance_history?: MaintenanceRecord[];
  splice_points?: string[]; // IDs of splice points along this cable
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Splice Point
// ============================================================================

export interface SplicePoint {
  id: string;
  name: string;
  type: SplicePointType;
  coordinates: Coordinates;
  cables: string[]; // IDs of cables connected at this point
  splice_count: number;
  capacity: number;
  status: "operational" | "maintenance" | "fault";
  enclosure_type?: string;
  installation_date?: string;
  access_notes?: string;
  photos?: string[];
  splice_details?: {
    fiber_number: number;
    cable_from: string;
    cable_to: string;
    loss_db?: number;
    splice_date?: string;
    technician?: string;
  }[];
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Conduit/Duct
// ============================================================================

export interface Conduit {
  id: string;
  name: string;
  type: ConduitType;
  path: GeoPath;
  diameter_mm: number;
  capacity: number; // Number of cables it can hold
  occupied: number; // Number of cables currently in it
  status: "available" | "full" | "maintenance" | "damaged";
  cables: string[]; // IDs of cables in this conduit
  depth_meters?: number; // For underground conduits
  height_meters?: number; // For aerial conduits
  owner?: string;
  installation_date?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Distribution Point (Fiber Distribution Hub)
// ============================================================================

export interface DistributionPoint {
  id: string;
  name: string;
  type: "fdt" | "fdh" | "splice_closure" | "cabinet";
  coordinates: Coordinates;
  capacity: number;
  ports_used: number;
  ports_available: number;
  cables_connected: string[]; // Cable IDs
  serves_area?: {
    name: string;
    radius_meters: number;
    customer_count: number;
  };
  status: "active" | "inactive" | "maintenance";
  installation_date?: string;
  address?: string;
  access_type?: "pole" | "ground" | "underground" | "building";
  photos?: string[];
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Service Area / Coverage Zone
// ============================================================================

export interface ServiceArea {
  id: string;
  name: string;
  type: "residential" | "commercial" | "industrial" | "rural";
  boundary: GeoPath; // Polygon boundary
  center: Coordinates;
  coverage_status: "covered" | "partial" | "planned" | "not_covered";
  fiber_availability: boolean;
  population?: number;
  premises_count?: number;
  connected_premises?: number;
  active_customers?: number;
  nearest_distribution_point?: string; // Distribution point ID
  distance_to_fiber_meters?: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Fiber Route Planning
// ============================================================================

export interface FiberRoute {
  id: string;
  name: string;
  status: "planned" | "approved" | "in_progress" | "completed" | "cancelled";
  path: GeoPath;
  start_point: {
    name: string;
    coordinates: Coordinates;
  };
  end_point: {
    name: string;
    coordinates: Coordinates;
  };
  estimated_length_meters: number;
  proposed_fiber_count: number;
  estimated_cost?: number;
  installation_method?: "aerial" | "underground" | "directional_drilling" | "trenching";
  permits_required?: string[];
  waypoints?: {
    id: string;
    name: string;
    coordinates: Coordinates;
    type: "pole" | "manhole" | "splice_point" | "distribution_point";
  }[];
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Network Element (POP, OLT, etc.)
// ============================================================================

export interface NetworkElement {
  id: string;
  name: string;
  type: "pop" | "olt" | "olt_shelf" | "aggregation_switch" | "core_router";
  coordinates: Coordinates;
  status: "active" | "inactive" | "maintenance" | "planned";
  capacity: {
    total_ports?: number;
    used_ports?: number;
    available_ports?: number;
  };
  connected_cables?: string[]; // Cable IDs
  serves_areas?: string[]; // Service area IDs
  address?: string;
  installation_date?: string;
  specifications?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Maintenance & Work Orders
// ============================================================================

export interface MaintenanceRecord {
  id: string;
  type: "inspection" | "repair" | "upgrade" | "emergency" | "preventive";
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  asset_type: "cable" | "splice_point" | "conduit" | "distribution_point";
  asset_id: string;
  scheduled_date: string;
  completed_date?: string;
  technician?: string;
  description: string;
  findings?: string;
  actions_taken?: string;
  cost?: number;
  photos?: string[];
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Map Layer Configuration
// ============================================================================

export interface MapLayer {
  id: string;
  name: string;
  type:
    | "cables"
    | "splice_points"
    | "conduits"
    | "distribution_points"
    | "service_areas"
    | "network_elements";
  visible: boolean;
  color?: string;
  opacity?: number;
  icon?: string;
}

export interface MapViewState {
  center: Coordinates;
  zoom: number;
  layers: MapLayer[];
  selectedFeatures: {
    type:
      | "cable"
      | "splice_point"
      | "conduit"
      | "distribution_point"
      | "service_area"
      | "network_element";
    id: string;
  }[];
}

// ============================================================================
// Statistics & Analytics
// ============================================================================

export interface FiberInfrastructureStats {
  total_fiber_km: number;
  active_fiber_km: number;
  planned_fiber_km: number;
  total_splice_points: number;
  total_distribution_points: number;
  total_service_areas: number;
  coverage_percentage: number;
  fiber_utilization_percentage: number;
  cables_by_type: Record<FiberCableType, number>;
  cables_by_status: Record<FiberCableStatus, number>;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface FiberCablesResponse {
  cables: FiberCable[];
  total: number;
  page: number;
  page_size: number;
}

export interface SplicePointsResponse {
  splice_points: SplicePoint[];
  total: number;
  page: number;
  page_size: number;
}

export interface ServiceAreasResponse {
  service_areas: ServiceArea[];
  total: number;
  page: number;
  page_size: number;
}

export interface DistributionPointsResponse {
  distribution_points: DistributionPoint[];
  total: number;
  page: number;
  page_size: number;
}

// ============================================================================
// Create/Update Request Types
// ============================================================================

export interface CreateFiberCableRequest {
  cable_name: string;
  cable_type: FiberCableType;
  fiber_count: number;
  path: Coordinates[];
  start_point_id: string;
  end_point_id: string;
  installation_date?: string;
  specifications?: FiberCable["specifications"];
}

export interface CreateSplicePointRequest {
  name: string;
  type: SplicePointType;
  coordinates: Coordinates;
  capacity: number;
  enclosure_type?: string;
  access_notes?: string;
}

export interface CreateDistributionPointRequest {
  name: string;
  type: DistributionPoint["type"];
  coordinates: Coordinates;
  capacity: number;
  address?: string;
  access_type?: DistributionPoint["access_type"];
}
