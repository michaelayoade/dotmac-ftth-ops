/**
 * Leaflet Map Component
 * Real geographic map implementation using Leaflet and React-Leaflet
 */

"use client";

import React, { useMemo, useCallback, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  Wifi,
  Users,
  AlertTriangle,
  CheckCircle,
  Layers as LayersIcon,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Server,
  Radio,
} from "lucide-react";
import { cn } from "../utils/cn";
import type {
  Coordinates,
  Bounds,
  MapMarker,
  ServiceArea,
  NetworkNode,
  Route,
} from "./UniversalMap";

type LeafletModule = typeof import("leaflet");
type ReactLeafletModule = typeof import("react-leaflet");

let leafletModule: LeafletModule | null = null;
let reactLeafletModule: ReactLeafletModule | null = null;
let leafletIconsInitialized = false;

const patchLeafletIcons = (leaflet: LeafletModule) => {
  if (leafletIconsInitialized) {
    return;
  }
  // Fix for default marker icons in Leaflet
  // @ts-ignore
  delete leaflet.Icon.Default.prototype._getIconUrl;
  leaflet.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
  leafletIconsInitialized = true;
};

const loadLeafletModules = async () => {
  if (typeof window === "undefined") {
    return null;
  }

  if (!leafletModule) {
    const leafletImport = await import("leaflet");
    const resolvedLeaflet =
      (leafletImport as { default?: LeafletModule }).default ?? (leafletImport as LeafletModule);
    leafletModule = resolvedLeaflet;
    patchLeafletIcons(resolvedLeaflet);
  }

  if (!reactLeafletModule) {
    reactLeafletModule = await import("react-leaflet");
  }

  return {
    leaflet: leafletModule,
    reactLeaflet: reactLeafletModule,
  };
};

export interface LeafletMapProps {
  // Map Configuration
  center?: Coordinates;
  zoom?: number;
  bounds?: Bounds;

  // Data
  markers?: MapMarker[];
  serviceAreas?: ServiceArea[];
  networkNodes?: NetworkNode[];
  routes?: Route[];

  // Display Options
  variant?: "admin" | "customer" | "reseller" | "technician" | "management";
  showLegend?: boolean;
  showControls?: boolean;

  // Interactions
  onMarkerClick?: (marker: MapMarker) => void;
  onAreaClick?: (area: ServiceArea) => void;
  onNodeClick?: (node: NetworkNode) => void;
  onMapClick?: (coordinates: Coordinates) => void;

  // Customization
  title?: string;
  height?: number | string;
  className?: string;
  loading?: boolean;
  error?: string | null;
}

// Custom marker icons for different types
const createCustomIcon = (
  leaflet: LeafletModule,
  type: MapMarker["type"],
  status?: string,
): import("leaflet").DivIcon => {
  const statusColors: Record<string, string> = {
    active: "#10B981",
    online: "#10B981",
    inactive: "#6B7280",
    offline: "#6B7280",
    maintenance: "#F59E0B",
    error: "#EF4444",
  };

  const color = status ? statusColors[status] || "#3B82F6" : "#3B82F6";

  const iconHtml = `
    <div style="
      background-color: ${color};
      width: 30px;
      height: 30px;
      border-radius: 50% 50% 50% 0;
      border: 3px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        transform: rotate(45deg);
        color: white;
        font-size: 12px;
        font-weight: bold;
      ">
        ${type === "fiber" ? "F" : type === "tower" ? "T" : type === "customer" ? "C" : "•"}
      </div>
    </div>
  `;

  return leaflet.divIcon({
    html: iconHtml,
    className: "custom-marker-icon",
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
};

// Map Controls Component
const MapControls: React.FC<{
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}> = ({ onZoomIn, onZoomOut, onReset }) => {
  return (
    <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onZoomIn}
        className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-shadow"
        aria-label="Zoom in"
      >
        <ZoomIn className="h-5 w-5 text-gray-700 dark:text-gray-300" />
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onZoomOut}
        className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-shadow"
        aria-label="Zoom out"
      >
        <ZoomOut className="h-5 w-5 text-gray-700 dark:text-gray-300" />
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onReset}
        className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-shadow"
        aria-label="Reset view"
      >
        <Maximize2 className="h-5 w-5 text-gray-700 dark:text-gray-300" />
      </motion.button>
    </div>
  );
};

export const LeafletMap: React.FC<LeafletMapProps> = ({
  center = { lat: 0, lng: 0 },
  zoom = 13,
  bounds,
  markers = [],
  serviceAreas = [],
  networkNodes = [],
  routes = [],
  variant = "admin",
  showLegend = true,
  showControls = true,
  onMarkerClick,
  onAreaClick,
  onNodeClick,
  onMapClick,
  title,
  height = 600,
  className,
  loading = false,
  error = null,
}) => {
  const [mapZoom, setMapZoom] = useState(zoom);
  const [mapCenter, setMapCenter] = useState(center);
  const [modules, setModules] = useState<{
    leaflet: LeafletModule;
    reactLeaflet: ReactLeafletModule;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (modules || typeof window === "undefined") {
      return;
    }
    void loadLeafletModules().then((loaded) => {
      if (!cancelled && loaded) {
        setModules(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [modules]);

  if (!modules) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-lg",
          className,
        )}
        style={{ height }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading interactive map...</p>
        </div>
      </div>
    );
  }

  const { leaflet: L, reactLeaflet } = modules;
  const { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, useMap } = reactLeaflet;

  const MapControllerComponent: React.FC<{ center: Coordinates; zoom: number }> = ({
    center,
    zoom,
  }) => {
    const map = useMap();

    useEffect(() => {
      map.setView([center.lat, center.lng], zoom);
    }, [center, zoom, map]);

    return null;
  };

  // Variant colors
  const variantStyles = {
    admin: { primary: "#3B82F6", accent: "#60A5FA" },
    customer: { primary: "#10B981", accent: "#34D399" },
    reseller: { primary: "#8B5CF6", accent: "#A78BFA" },
    technician: { primary: "#EF4444", accent: "#F87171" },
    management: { primary: "#F97316", accent: "#FB923C" },
  };

  const colors = variantStyles[variant];

  // Handle map controls
  const handleZoomIn = useCallback(() => {
    setMapZoom((prev) => Math.min(prev + 1, 18));
  }, []);

  const handleZoomOut = useCallback(() => {
    setMapZoom((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleReset = useCallback(() => {
    setMapCenter(center);
    setMapZoom(zoom);
  }, [center, zoom]);

  // Calculate bounds if provided
  const mapBounds = useMemo(() => {
    if (bounds) {
      return L.latLngBounds([bounds.south, bounds.west], [bounds.north, bounds.east]);
    }
    return undefined;
  }, [bounds, L]);

  // Service area colors
  const getAreaColor = (area: ServiceArea): string => {
    const baseColors = {
      fiber: "#3B82F6",
      wireless: "#8B5CF6",
      hybrid: "#10B981",
    };
    return area.color || baseColors[area.type];
  };

  // Route colors
  const getRouteColor = (route: Route): string => {
    const routeColors = {
      installation: "#10B981",
      maintenance: "#F59E0B",
      emergency: "#EF4444",
    };
    return routeColors[route.type];
  };

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-lg",
          className,
        )}
        style={{ height }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-lg",
          className,
        )}
        style={{ height }}
      >
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {title && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>
      )}

      <div className="relative rounded-lg overflow-hidden shadow-lg" style={{ height }}>
        <MapContainer
          center={[mapCenter.lat, mapCenter.lng]}
          zoom={mapZoom}
          {...(mapBounds ? { bounds: mapBounds } : {})}
          style={{ height: "100%", width: "100%" }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapControllerComponent center={mapCenter} zoom={mapZoom} />

          {/* Render Service Areas */}
          {serviceAreas.map((area) => (
            <Polygon
              key={area.id}
              positions={area.polygon.map((coord) => [coord.lat, coord.lng])}
              pathOptions={{
                color: getAreaColor(area),
                fillColor: getAreaColor(area),
                fillOpacity: 0.2,
                weight: 2,
              }}
              eventHandlers={{
                click: () => onAreaClick?.(area),
              }}
            >
              <Popup>
                <div className="p-2">
                  <h4 className="font-semibold mb-1">{area.name}</h4>
                  <p className="text-sm text-gray-600">Type: {area.type}</p>
                  <p className="text-sm text-gray-600">Max Speed: {area.maxSpeed} Mbps</p>
                  <p className="text-sm text-gray-600">Coverage: {area.coverage}%</p>
                  {area.customers && (
                    <p className="text-sm text-gray-600">Customers: {area.customers}</p>
                  )}
                </div>
              </Popup>
            </Polygon>
          ))}

          {/* Render Routes */}
          {routes.map((route) => (
            <Polyline
              key={route.id}
              positions={route.waypoints.map((coord) => [coord.lat, coord.lng])}
              pathOptions={{
                color: getRouteColor(route),
                weight: 4,
                opacity: 0.7,
              }}
            >
              <Popup>
                <div className="p-2">
                  <h4 className="font-semibold mb-1">{route.name}</h4>
                  <p className="text-sm text-gray-600">Type: {route.type}</p>
                  <p className="text-sm text-gray-600">Status: {route.status}</p>
                  {route.technician && (
                    <p className="text-sm text-gray-600">Technician: {route.technician}</p>
                  )}
                  {route.estimatedTime && (
                    <p className="text-sm text-gray-600">ETA: {route.estimatedTime} min</p>
                  )}
                </div>
              </Popup>
            </Polyline>
          ))}

          {/* Render Network Nodes */}
          {networkNodes.map((node) => (
            <Marker
              key={node.id}
              position={[node.position.lat, node.position.lng]}
              icon={createCustomIcon(L, "fiber", node.status)}
              eventHandlers={{
                click: () => onNodeClick?.(node),
              }}
            >
              <Popup>
                <div className="p-2">
                  <h4 className="font-semibold mb-1">{node.name}</h4>
                  <p className="text-sm text-gray-600">Type: {node.type}</p>
                  <p className="text-sm">
                    Status:{" "}
                    <span
                      className={cn(
                        "font-medium",
                        node.status === "online" && "text-green-600",
                        node.status === "offline" && "text-gray-600",
                        node.status === "maintenance" && "text-yellow-600",
                        node.status === "error" && "text-red-600",
                      )}
                    >
                      {node.status}
                    </span>
                  </p>
                  {node.metrics && (
                    <>
                      <p className="text-sm text-gray-600">Uptime: {node.metrics.uptime}%</p>
                      <p className="text-sm text-gray-600">Load: {node.metrics.load}%</p>
                      <p className="text-sm text-gray-600">Latency: {node.metrics.latency}ms</p>
                    </>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Render Markers */}
          {markers.map((marker) => (
            <Marker
              key={marker.id}
              position={[marker.position.lat, marker.position.lng]}
              icon={createCustomIcon(L, marker.type, marker.status)}
              eventHandlers={{
                click: () => {
                  onMarkerClick?.(marker);
                  marker.onClick?.();
                },
              }}
            >
              <Popup>
                <div className="p-2">
                  <h4 className="font-semibold mb-1">{marker.title}</h4>
                  {marker.description && (
                    <p className="text-sm text-gray-600 mb-2">{marker.description}</p>
                  )}
                  {marker.status && (
                    <p className="text-sm">
                      Status:{" "}
                      <span
                        className={cn(
                          "font-medium",
                          marker.status === "active" && "text-green-600",
                          marker.status === "inactive" && "text-gray-600",
                          marker.status === "maintenance" && "text-yellow-600",
                          marker.status === "error" && "text-red-600",
                        )}
                      >
                        {marker.status}
                      </span>
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Map Controls */}
        {showControls && (
          <MapControls onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onReset={handleReset} />
        )}

        {/* Legend */}
        {showLegend &&
          (markers.length > 0 || networkNodes.length > 0 || serviceAreas.length > 0) && (
            <div className="absolute bottom-4 left-4 z-[1000] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 max-w-xs">
              <h4 className="text-sm font-semibold mb-2 text-gray-900 dark:text-white flex items-center gap-2">
                <LayersIcon className="h-4 w-4" />
                Legend
              </h4>
              <div className="space-y-2 text-xs">
                {markers.length > 0 && (
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Markers</p>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(new Set(markers.map((m) => m.type))).map((type) => (
                        <div key={type} className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                          <span className="text-gray-600 dark:text-gray-400 capitalize">
                            {type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {networkNodes.length > 0 && (
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Network Nodes
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-gray-600 dark:text-gray-400">Online</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="text-gray-600 dark:text-gray-400">Error</span>
                      </div>
                    </div>
                  </div>
                )}
                {serviceAreas.length > 0 && (
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Service Areas
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(new Set(serviceAreas.map((a) => a.type))).map((type) => (
                        <div key={type} className="flex items-center gap-1">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor:
                                type === "fiber"
                                  ? "#3B82F6"
                                  : type === "wireless"
                                    ? "#8B5CF6"
                                    : "#10B981",
                            }}
                          ></div>
                          <span className="text-gray-600 dark:text-gray-400 capitalize">
                            {type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default LeafletMap;
