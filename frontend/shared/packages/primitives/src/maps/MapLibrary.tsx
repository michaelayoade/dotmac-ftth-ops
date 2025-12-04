/**
 * Universal Map Library
 * Pre-configured map templates for common ISP use cases
 */

"use client";

import { UniversalMap } from "./UniversalMap";
import type { UniversalMapProps, MapMarker, ServiceArea, NetworkNode, Route } from "./UniversalMap";

// Service Coverage Map
export interface ServiceCoverageMapProps extends Omit<UniversalMapProps, "type" | "serviceAreas"> {
  serviceAreas: ServiceArea[];
  showCoverageHeatmap?: boolean;
  showCustomerDensity?: boolean;
  onServiceAreaSelect?: (area: ServiceArea) => void;
}

export function ServiceCoverageMap({
  serviceAreas,
  showCoverageHeatmap = false,
  showCustomerDensity = false,
  onServiceAreaSelect,
  ...props
}: ServiceCoverageMapProps) {
  return (
    <UniversalMap
      {...props}
      type="service_coverage"
      serviceAreas={serviceAreas}
      showHeatmap={showCoverageHeatmap}
      {...(onServiceAreaSelect ? { onAreaClick: onServiceAreaSelect } : {})}
      title={props.title || "Service Coverage Areas"}
    />
  );
}

// Network Topology Map
export interface NetworkTopologyMapProps extends Omit<UniversalMapProps, "type" | "networkNodes"> {
  networkNodes: NetworkNode[];
  showConnections?: boolean;
  showMetrics?: boolean;
  onNodeSelect?: (node: NetworkNode) => void;
}

export function NetworkTopologyMap({
  networkNodes,
  showConnections = true,
  showMetrics = false,
  onNodeSelect,
  ...props
}: NetworkTopologyMapProps) {
  return (
    <UniversalMap
      {...props}
      type="network_topology"
      networkNodes={networkNodes}
      {...(onNodeSelect ? { onNodeClick: onNodeSelect } : {})}
      title={props.title || "Network Infrastructure"}
    />
  );
}

// Customer Location Map
export interface CustomerLocationMapProps extends Omit<UniversalMapProps, "type" | "markers"> {
  customers: Array<{
    id: string;
    name: string;
    location: { lat: number; lng: number };
    plan: string;
    status: "active" | "inactive" | "suspended";
    revenue?: number;
  }>;
  showClusters?: boolean;
  filterByPlan?: string[];
  onCustomerSelect?: (customer: any) => void;
}

export function CustomerLocationMap({
  customers,
  showClusters = true,
  filterByPlan,
  onCustomerSelect,
  ...props
}: CustomerLocationMapProps) {
  // Convert customers to markers
  const markers: MapMarker[] = customers
    .filter((customer) => !filterByPlan || filterByPlan.includes(customer.plan))
    .map((customer) => ({
      id: customer.id,
      position: customer.location,
      type: "customer" as const,
      status: customer.status === "active" ? ("active" as const) : ("inactive" as const),
      title: customer.name,
      description: `Plan: ${customer.plan} - Status: ${customer.status}`,
      metadata: { plan: customer.plan, revenue: customer.revenue },
      onClick: () => onCustomerSelect?.(customer),
    }));

  return (
    <UniversalMap
      {...props}
      type="customer_locations"
      markers={markers}
      showClusters={showClusters}
      onMarkerClick={(marker) => {
        const customer = customers.find((c) => c.id === marker.id);
        if (customer) onCustomerSelect?.(customer);
      }}
      title={props.title || "Customer Locations"}
    />
  );
}

// Technician Route Map
export interface TechnicianRouteMapProps
  extends Omit<UniversalMapProps, "type" | "routes" | "markers"> {
  routes: Route[];
  technicians: Array<{
    id: string;
    name: string;
    location: { lat: number; lng: number };
    status: "available" | "busy" | "offline";
    currentJob?: string;
  }>;
  workOrders?: Array<{
    id: string;
    location: { lat: number; lng: number };
    type: "installation" | "repair" | "maintenance";
    priority: "low" | "medium" | "high" | "urgent";
    assignedTechnician?: string;
  }>;
  onRouteSelect?: (route: Route) => void;
  onTechnicianSelect?: (technician: any) => void;
}

export function TechnicianRouteMap({
  routes,
  technicians,
  workOrders = [],
  onRouteSelect,
  onTechnicianSelect,
  ...props
}: TechnicianRouteMapProps) {
  // Convert technicians to markers
  const technicianMarkers: MapMarker[] = technicians.map((tech) => ({
    id: tech.id,
    position: tech.location,
    type: "technician" as const,
    status:
      tech.status === "available"
        ? ("active" as const)
        : tech.status === "busy"
          ? ("maintenance" as const)
          : ("inactive" as const),
    title: tech.name,
    description: `Status: ${tech.status}${tech.currentJob ? ` - Job: ${tech.currentJob}` : ""}`,
    metadata: { currentJob: tech.currentJob },
    onClick: () => onTechnicianSelect?.(tech),
  }));

  // Convert work orders to markers
  const workOrderMarkers: MapMarker[] = workOrders.map((order) => ({
    id: order.id,
    position: order.location,
    type: order.type === "repair" ? ("issue" as const) : ("poi" as const),
    status:
      order.priority === "urgent"
        ? ("error" as const)
        : order.priority === "high"
          ? ("maintenance" as const)
          : ("active" as const),
    title: `${order.type} - ${order.priority} priority`,
    description: order.assignedTechnician
      ? `Assigned to: ${order.assignedTechnician}`
      : "Unassigned",
    metadata: {
      priority: order.priority,
      assignedTechnician: order.assignedTechnician,
    },
  }));

  return (
    <UniversalMap
      {...props}
      type="technician_routes"
      routes={routes}
      markers={[...technicianMarkers, ...workOrderMarkers]}
      onMarkerClick={(marker) => {
        if (marker.type === "technician") {
          const tech = technicians.find((t) => t.id === marker.id);
          if (tech) onTechnicianSelect?.(tech);
        }
      }}
      title={props.title || "Technician Routes & Work Orders"}
    />
  );
}

// Network Outage Map
export interface NetworkOutageMapProps extends Omit<UniversalMapProps, "type"> {
  outages: Array<{
    id: string;
    location: { lat: number; lng: number };
    severity: "minor" | "major" | "critical";
    affectedCustomers: number;
    estimatedResolution?: Date;
    description: string;
  }>;
  onOutageSelect?: (outage: any) => void;
}

export function NetworkOutageMap({ outages, onOutageSelect, ...props }: NetworkOutageMapProps) {
  const outageMarkers: MapMarker[] = outages.map((outage) => ({
    id: outage.id,
    position: outage.location,
    type: "issue" as const,
    status:
      outage.severity === "critical"
        ? ("error" as const)
        : outage.severity === "major"
          ? ("maintenance" as const)
          : ("inactive" as const),
    title: `${outage.severity.toUpperCase()} Outage`,
    description: `${outage.affectedCustomers} customers affected - ${outage.description}`,
    metadata: {
      severity: outage.severity,
      affectedCustomers: outage.affectedCustomers,
      estimatedResolution: outage.estimatedResolution,
    },
    onClick: () => onOutageSelect?.(outage),
  }));

  return (
    <UniversalMap
      {...props}
      type="service_coverage"
      markers={outageMarkers}
      showHeatmap={true}
      onMarkerClick={(marker) => {
        const outage = outages.find((o) => o.id === marker.id);
        if (outage) onOutageSelect?.(outage);
      }}
      title={props.title || "Network Outages"}
    />
  );
}

// Signal Strength Heatmap
export interface SignalStrengthMapProps extends Omit<UniversalMapProps, "type"> {
  signalData: Array<{
    location: { lat: number; lng: number };
    strength: number; // -120 to -20 dBm
    frequency: number; // MHz
    technology: "4G" | "5G" | "WiFi";
  }>;
  technologyFilter?: ("4G" | "5G" | "WiFi")[];
}

export function SignalStrengthMap({
  signalData,
  technologyFilter,
  ...props
}: SignalStrengthMapProps) {
  const filteredData = technologyFilter
    ? signalData.filter((data) => technologyFilter.includes(data.technology))
    : signalData;

  const markers: MapMarker[] = filteredData.map((data, index) => {
    const strengthLevel =
      data.strength > -70 ? "active" : data.strength > -85 ? "maintenance" : "error";

    return {
      id: `signal-${index}`,
      position: data.location,
      type: "tower" as const,
      status: strengthLevel as any,
      title: `${data.technology} Signal`,
      description: `${data.strength} dBm @ ${data.frequency} MHz`,
      metadata: {
        strength: data.strength,
        frequency: data.frequency,
        technology: data.technology,
      },
    };
  });

  return (
    <UniversalMap
      {...props}
      type="service_coverage"
      markers={markers}
      showHeatmap={true}
      title={props.title || "Signal Strength Coverage"}
    />
  );
}

// All maps are already exported above with their individual export statements

// Default export
export default {
  ServiceCoverageMap,
  NetworkTopologyMap,
  CustomerLocationMap,
  TechnicianRouteMap,
  NetworkOutageMap,
  SignalStrengthMap,
};
