import type { LatLng } from "./types";
import { UniversalMap } from "./UniversalMap";
import type { MapMarker, NetworkNode as MapNetworkNode } from "./UniversalMap";

export interface NetworkNode {
  id: string;
  name: string;
  type: "router" | "switch" | "server" | "tower" | "fiber_node" | string;
  coordinates: LatLng;
  status: "online" | "offline" | "degraded" | "maintenance" | string;
  metadata?: Record<string, unknown>;
}

export interface NetworkTopologyMapProps {
  nodes?: NetworkNode[];
  networkNodes?: NetworkNode[];
  center?: LatLng;
  zoom?: number;
  height?: number;
  onNodeClick?: (node: NetworkNode) => void;
  variant?: "admin" | "customer" | "reseller" | "technician" | "management";
  onNodeSelect?: (node: NetworkNode) => void;
  showLegend?: boolean;
}

const statusColor: Record<string, string> = {
  online: "#22c55e",
  offline: "#ef4444",
  degraded: "#f97316",
  maintenance: "#facc15",
};

export function NetworkTopologyMap({
  nodes,
  networkNodes,
  height,
  onNodeClick,
  variant = "admin",
  onNodeSelect,
  showLegend,
}: NetworkTopologyMapProps) {
  const nodeList = networkNodes ?? nodes ?? [];
  const statusMap: Record<string, MapMarker["status"]> = {
    online: "active",
    offline: "inactive",
    maintenance: "maintenance",
    degraded: "error",
  };

  const markerTypeMap: Record<string, MapMarker["type"]> = {
    tower: "tower",
    fiber_node: "fiber",
    router: "fiber",
    switch: "fiber",
    server: "poi",
  };

  const nodeTypeMap: Record<string, MapNetworkNode["type"]> = {
    tower: "tower",
    fiber_node: "fiber_node",
    router: "router",
    switch: "switch",
    server: "server",
  };

  const markers: MapMarker[] = nodeList.map((node) => ({
    id: node.id,
    position: node.coordinates,
    title: node.name,
    type: markerTypeMap[node.type] ?? "poi",
    status: statusMap[node.status] ?? "active",
    ...(node.metadata ? { metadata: node.metadata as Record<string, any> } : {}),
    color: statusColor[node.status] ?? "#3b82f6",
  }));

  const mapNodes: MapNetworkNode[] = nodeList.map((node) => ({
    id: node.id,
    type: nodeTypeMap[node.type] ?? "router",
    position: node.coordinates,
    status:
      node.status === "online"
        ? "online"
        : node.status === "offline"
          ? "offline"
          : node.status === "maintenance"
            ? "maintenance"
            : "error",
    name: node.name,
  }));

  return (
    <UniversalMap
      type="network_topology"
      markers={markers}
      networkNodes={mapNodes}
      height={height ?? 360}
      variant={variant}
      {...(showLegend !== undefined ? { showLegend } : {})}
      onMarkerClick={(marker) => {
        const node = nodeList.find((n) => n.id === marker.id);
        if (node) {
          onNodeClick?.(node);
          onNodeSelect?.(node);
        }
      }}
    />
  );
}
