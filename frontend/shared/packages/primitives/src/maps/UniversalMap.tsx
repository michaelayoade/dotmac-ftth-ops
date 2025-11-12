/**
 * Universal Map Component
 * Base map component supporting service coverage, network topology, and customer locations
 */

"use client";

import React, { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  Wifi,
  Users,
  AlertTriangle,
  CheckCircle,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
} from "lucide-react";
import { cn } from "../utils/cn";

// Map Types
export type MapType =
  | "service_coverage"
  | "network_topology"
  | "customer_locations"
  | "technician_routes";

// Geographic Data Types
export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// Map Markers
export interface MapMarker {
  id: string;
  position: Coordinates;
  type: "customer" | "tower" | "fiber" | "technician" | "issue" | "poi";
  status?: "active" | "inactive" | "maintenance" | "error";
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  onClick?: () => void;
}

// Service Areas
export interface ServiceArea {
  id: string;
  name: string;
  type: "fiber" | "wireless" | "hybrid";
  polygon: Coordinates[];
  serviceLevel: "full" | "limited" | "planned";
  maxSpeed: number; // Mbps
  coverage: number; // percentage
  customers?: number;
  color?: string;
}

// Network Infrastructure
export interface NetworkNode {
  id: string;
  type: "router" | "switch" | "server" | "tower" | "fiber_node";
  position: Coordinates;
  status: "online" | "offline" | "maintenance" | "error";
  name: string;
  connections?: string[]; // IDs of connected nodes
  metrics?: {
    uptime: number;
    load: number;
    latency: number;
  };
}

// Routes (for technicians)
export interface Route {
  id: string;
  name: string;
  waypoints: Coordinates[];
  type: "installation" | "maintenance" | "emergency";
  technician?: string;
  estimatedTime?: number; // minutes
  status: "planned" | "in_progress" | "completed";
}

export interface UniversalMapProps {
  // Map Configuration
  type: MapType;
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
  showHeatmap?: boolean;
  showClusters?: boolean;

  // Interactions
  onMarkerClick?: (marker: MapMarker) => void;
  onAreaClick?: (area: ServiceArea) => void;
  onNodeClick?: (node: NetworkNode) => void;
  onMapClick?: (coordinates: Coordinates) => void;
  onBoundsChanged?: (bounds: Bounds) => void;

  // Filters
  filters?: {
    markerTypes?: MapMarker["type"][];
    serviceTypes?: ServiceArea["type"][];
    nodeTypes?: NetworkNode["type"][];
    statusFilter?: string[];
  };

  // Customization
  title?: string;
  height?: number | string;
  width?: number | string;
  loading?: boolean;
  error?: string | null;

  // Layout
  className?: string;
}

// Map variant styles
const variantStyles = {
  admin: {
    primary: "#3B82F6",
    secondary: "#1E40AF",
    accent: "#60A5FA",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
  },
  customer: {
    primary: "#10B981",
    secondary: "#047857",
    accent: "#34D399",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
  },
  reseller: {
    primary: "#8B5CF6",
    secondary: "#7C3AED",
    accent: "#A78BFA",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
  },
  technician: {
    primary: "#EF4444",
    secondary: "#DC2626",
    accent: "#F87171",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#B91C1C",
  },
  management: {
    primary: "#F97316",
    secondary: "#EA580C",
    accent: "#FB923C",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
  },
};

// Status colors
const statusColors = {
  active: "#10B981",
  online: "#10B981",
  inactive: "#6B7280",
  offline: "#6B7280",
  maintenance: "#F59E0B",
  error: "#EF4444",
  planned: "#8B5CF6",
  in_progress: "#3B82F6",
  completed: "#10B981",
} as const;

type StatusColorKey = keyof typeof statusColors;

const getStatusColor = (status?: string): string => {
  if (!status) {
    return statusColors.active;
  }
  return statusColors[status as StatusColorKey] ?? statusColors.active;
};

// Marker icons based on type
const markerIcons: Record<MapMarker["type"], typeof MapPin> = {
  customer: Users,
  tower: Wifi,
  fiber: MapPin,
  technician: Users,
  issue: AlertTriangle,
  poi: MapPin,
};

// Mock Map Component (in real implementation, this would integrate with Google Maps, Leaflet, etc.)
const MockMapCanvas = ({
  markers,
  serviceAreas,
  networkNodes,
  routes,
  onMarkerClick,
  onAreaClick,
  colors,
  showHeatmap,
  height,
}: any) => {
  return (
    <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ height }}>
      {/* Simulated map background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-green-50">
        {/* Grid pattern to simulate map */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,0,0,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.1) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
      </div>

      {/* Service Areas */}
      {serviceAreas?.map((area: ServiceArea, index: number) => (
        <div
          key={area.id}
          className="absolute opacity-30 hover:opacity-50 cursor-pointer transition-opacity"
          style={{
            left: `${10 + index * 20}%`,
            top: `${20 + index * 15}%`,
            width: "120px",
            height: "80px",
            backgroundColor: area.color || colors.primary,
            borderRadius: "40px",
          }}
          onClick={() => onAreaClick?.(area)}
          title={`${area.name} - ${area.serviceLevel} service`}
        />
      ))}

      {/* Network Nodes */}
      {networkNodes?.map((node: NetworkNode, index: number) => {
        const Icon = node.type === "tower" ? Wifi : MapPin;
        return (
          <div
            key={node.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"
            style={{
              left: `${30 + index * 25}%`,
              top: `${30 + index * 20}%`,
            }}
          >
            <div
              className="p-2 rounded-full shadow-lg"
              style={{ backgroundColor: getStatusColor(node.status) }}
            >
              <Icon className="w-4 h-4 text-white" />
            </div>
          </div>
        );
      })}

      {/* Markers */}
      {markers?.map((marker: MapMarker, index: number) => {
        const Icon = markerIcons[marker.type] || MapPin;
        return (
          <div
            key={marker.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer hover:scale-110 transition-transform"
            style={{
              left: `${15 + index * 12}%`,
              top: `${40 + index * 8}%`,
            }}
            onClick={() => onMarkerClick?.(marker)}
            title={marker.title}
          >
            <div
              className="p-1 rounded-full shadow-md border-2 border-white"
              style={{
                backgroundColor: getStatusColor(marker.status ?? "active"),
              }}
            >
              <Icon className="w-3 h-3 text-white" />
            </div>
          </div>
        );
      })}

      {/* Routes */}
      {routes?.map((route: Route, index: number) => (
        <svg
          key={route.id}
          className="absolute inset-0 pointer-events-none"
          style={{ width: "100%", height: "100%" }}
        >
          <path
            d={`M ${20 + index * 30} ${50} L ${80 - index * 20} ${70 + index * 10}`}
            stroke={getStatusColor(route.status)}
            strokeWidth="3"
            strokeDasharray={route.status === "planned" ? "5,5" : undefined}
            fill="none"
          />
        </svg>
      ))}

      {/* Heatmap overlay */}
      {showHeatmap && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-red-500 opacity-20 rounded-full blur-xl" />
          <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-yellow-500 opacity-30 rounded-full blur-xl" />
          <div className="absolute bottom-1/3 left-1/3 w-20 h-20 bg-green-500 opacity-25 rounded-full blur-xl" />
        </div>
      )}
    </div>
  );
};

export function UniversalMap({
  type,
  center = { lat: 37.7749, lng: -122.4194 },
  zoom = 10,
  bounds,
  markers = [],
  serviceAreas = [],
  networkNodes = [],
  routes = [],
  variant = "admin",
  showLegend = true,
  showControls = true,
  showHeatmap = false,
  showClusters = false,
  onMarkerClick,
  onAreaClick,
  onNodeClick,
  onMapClick,
  onBoundsChanged,
  filters,
  title,
  height = 400,
  width = "100%",
  loading = false,
  error = null,
  className = "",
}: UniversalMapProps) {
  const [currentZoom, setCurrentZoom] = useState(zoom);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState(filters || {});

  const colors = variantStyles[variant];

  // Filter data based on active filters
  const filteredMarkers = useMemo(() => {
    if (!activeFilters.markerTypes?.length && !activeFilters.statusFilter?.length) {
      return markers;
    }
    return markers.filter((marker) => {
      const typeMatch =
        !activeFilters.markerTypes?.length || activeFilters.markerTypes.includes(marker.type);
      const statusMatch =
        !activeFilters.statusFilter?.length ||
        activeFilters.statusFilter.includes(marker.status || "active");
      return typeMatch && statusMatch;
    });
  }, [markers, activeFilters]);

  const filteredAreas = useMemo(() => {
    if (!activeFilters.serviceTypes?.length) return serviceAreas;
    return serviceAreas.filter((area) => activeFilters.serviceTypes!.includes(area.type));
  }, [serviceAreas, activeFilters]);

  const filteredNodes = useMemo(() => {
    if (!activeFilters.nodeTypes?.length && !activeFilters.statusFilter?.length) {
      return networkNodes;
    }
    return networkNodes.filter((node) => {
      const typeMatch =
        !activeFilters.nodeTypes?.length || activeFilters.nodeTypes.includes(node.type);
      const statusMatch =
        !activeFilters.statusFilter?.length || activeFilters.statusFilter.includes(node.status);
      return typeMatch && statusMatch;
    });
  }, [networkNodes, activeFilters]);

  const handleZoomIn = () => setCurrentZoom((prev) => Math.min(prev + 1, 20));
  const handleZoomOut = () => setCurrentZoom((prev) => Math.max(prev - 1, 1));

  // Loading State
  if (loading) {
    return (
      <div className={cn("bg-white rounded-lg border border-gray-200 p-6", className)}>
        {title && <div className="h-6 bg-gray-200 rounded w-48 mb-4 animate-pulse" />}
        <div className="w-full bg-gray-200 rounded animate-pulse" style={{ height }} />
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className={cn("bg-white rounded-lg border border-gray-200 p-6", className)}>
        <div className="text-center text-gray-500">
          <p className="text-sm">Failed to load map</p>
          <p className="text-xs text-gray-400 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className={cn("bg-white rounded-lg border border-gray-200 overflow-hidden", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ width }}
    >
      {/* Header */}
      {(title || showControls) && (
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>{title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}</div>

          {showControls && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                title="Filters"
              >
                <Filter className="w-4 h-4" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <Layers className="w-4 h-4" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="relative">
        {/* Map Canvas */}
        <MockMapCanvas
          markers={filteredMarkers}
          serviceAreas={filteredAreas}
          networkNodes={filteredNodes}
          routes={routes}
          onMarkerClick={onMarkerClick}
          onAreaClick={onAreaClick}
          colors={colors}
          showHeatmap={showHeatmap}
          height={height}
        />

        {/* Zoom Controls */}
        {showControls && (
          <div className="absolute top-4 right-4 flex flex-col space-y-1">
            <button
              onClick={handleZoomIn}
              className="p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
            >
              <ZoomIn className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
            >
              <ZoomOut className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        )}

        {/* Legend */}
        {showLegend && (
          <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 max-w-xs">
            <h4 className="font-medium text-gray-900 mb-2 text-sm">Legend</h4>
            <div className="space-y-1">
              {/* Marker types */}
              {Object.entries(markerIcons).map(([type, Icon]) => (
                <div key={type} className="flex items-center space-x-2 text-xs">
                  <Icon className="w-3 h-3 text-gray-600" />
                  <span className="capitalize text-gray-700">{type.replace("_", " ")}</span>
                </div>
              ))}

              {/* Status indicators */}
              <div className="mt-2 pt-2 border-t border-gray-200">
                {Object.entries(statusColors).map(([status, color]) => (
                  <div key={status} className="flex items-center space-x-2 text-xs">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="capitalize text-gray-700">{status.replace("_", " ")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 w-64">
            <h4 className="font-medium text-gray-900 mb-3">Filters</h4>

            {/* Marker Type Filter */}
            <div className="mb-3">
              <label className="text-sm font-medium text-gray-700">Marker Types</label>
              <div className="mt-1 space-y-1">
                {Object.keys(markerIcons).map((type) => (
                  <label key={type} className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={activeFilters.markerTypes?.includes(type as any)}
                      onChange={(e) => {
                        const types = activeFilters.markerTypes || [];
                        if (e.target.checked) {
                          setActiveFilters({
                            ...activeFilters,
                            markerTypes: [...types, type as any],
                          });
                        } else {
                          setActiveFilters({
                            ...activeFilters,
                            markerTypes: types.filter((t) => t !== type),
                          });
                        }
                      }}
                    />
                    <span className="capitalize">{type.replace("_", " ")}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowFilters(false)}
              className="w-full mt-3 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* Stats Footer */}
      <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <span>Markers: {filteredMarkers.length}</span>
            <span>Areas: {filteredAreas.length}</span>
            <span>Nodes: {filteredNodes.length}</span>
          </div>
          <div>Zoom: {currentZoom}x</div>
        </div>
      </div>
    </motion.div>
  );
}

export default UniversalMap;
