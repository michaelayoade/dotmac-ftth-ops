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

// Pre-configured Map Templates
export * from "./MapLibrary";
