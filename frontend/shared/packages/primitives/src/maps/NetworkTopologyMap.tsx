import type { LatLng } from "./types";
import { UniversalMap } from "./UniversalMap";

export interface NetworkNode {
  id: string;
  name: string;
  type: "router" | "switch" | "server" | "tower" | "fiber_node" | string;
  coordinates: LatLng;
  status: "online" | "offline" | "degraded" | "maintenance" | string;
  metadata?: Record<string, unknown>;
}

export interface NetworkTopologyMapProps {
  nodes: NetworkNode[];
  center?: LatLng;
  zoom?: number;
  height?: number;
  onNodeClick?: (node: NetworkNode) => void;
}

const statusColor: Record<string, string> = {
  online: "#22c55e",
  offline: "#ef4444",
  degraded: "#f97316",
  maintenance: "#facc15",
};

export function NetworkTopologyMap({ nodes, height, onNodeClick }: NetworkTopologyMapProps) {
  const markers = nodes.map((node) => ({
    id: node.id,
    position: node.coordinates,
    title: node.name,
    status: node.status,
    color: statusColor[node.status] ?? "#3b82f6",
    metadata: node.metadata,
  }));

  return (
    <UniversalMap
      markers={markers}
      height={height ?? 360}
      onMarkerClick={(marker) => {
        const node = nodes.find((n) => n.id === marker.id);
        if (node) {
          onNodeClick?.(node);
        }
      }}
    />
  );
}
