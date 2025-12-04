/**
 * Universal Map Components
 * Geographic data visualization for ISP operations
 */

// Base Map Component
export { default as UniversalMap } from "./UniversalMap";
export type {
  UniversalMapProps,
  MapType,
  MapMarker,
  ServiceArea,
  NetworkNode,
  Route,
  Coordinates,
  Bounds,
} from "./UniversalMap";

// Leaflet Map Component (Real Geographic Maps)
export { LeafletMap } from "./LeafletMap";
export type { LeafletMapProps } from "./LeafletMap";

// Network Topology Map
export { NetworkTopologyMap } from "./NetworkTopologyMap";
export type {
  NetworkTopologyMapProps,
  NetworkNode as NetworkTopologyNode,
} from "./NetworkTopologyMap";

// Pre-configured Map Templates
export * from "./MapLibrary";
