"use client";

/**
 * Map Dashboard - Real-time Technician Tracking
 * Visual map interface showing technician locations, assignments, and routes
 */

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import {
  MapPin,
  Users,
  Navigation,
  Clock,
  CheckCircle2,
  AlertCircle,
  Car,
  Package,
} from "lucide-react";
import { useTechnicians, useAssignments } from "@/hooks/useFieldService";
import type { Technician, TaskAssignment, TechnicianFilter } from "@/types/field-service";
import { format, parseISO, isToday } from "date-fns";

// Dynamically import map component (client-side only)
const MapComponent = dynamic(() => import("@/components/map/TechnicianMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading map...</p>
      </div>
    </div>
  ),
});

// ============================================================================
// Types
// ============================================================================

interface TechnicianWithLocation extends Technician {
  currentAssignment?: TaskAssignment | undefined;
  distanceToTask?: number | undefined;
  eta?: number | undefined;
}

interface MapFilters {
  status: string[];
  showAvailableOnly: boolean;
  showWithAssignments: boolean;
}

// ============================================================================
// Sidebar Component
// ============================================================================

interface SidebarProps {
  technicians: TechnicianWithLocation[];
  selectedTechnicianId?: string | undefined;
  onSelectTechnician: (id: string) => void;
  filters: MapFilters;
  onFilterChange: (filters: MapFilters) => void;
}

function Sidebar({
  technicians,
  selectedTechnicianId,
  onSelectTechnician,
  filters,
  onFilterChange,
}: SidebarProps) {
  const stats = {
    total: technicians.length,
    active: technicians.filter((t) => t.status === "active").length,
    available: technicians.filter((t) => t.isAvailable).length,
    onTask: technicians.filter((t) => t.currentAssignment).length,
  };

  return (
    <div className="h-full flex flex-col">
      {/* Stats */}
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold mb-4">Field Technicians</h2>
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-xs text-gray-600">Total</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-green-600">{stats.available}</div>
              <div className="text-xs text-gray-600">Available</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-yellow-600">{stats.onTask}</div>
              <div className="text-xs text-gray-600">On Task</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-purple-600">{stats.active}</div>
              <div className="text-xs text-gray-600">Active</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b space-y-3">
        <div>
          <label className="text-sm font-medium">Filters</label>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.showAvailableOnly}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  showAvailableOnly: e.target.checked,
                })
              }
              className="rounded"
            />
            Available only
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.showWithAssignments}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  showWithAssignments: e.target.checked,
                })
              }
              className="rounded"
            />
            With assignments
          </label>
        </div>
      </div>

      {/* Technician List */}
      <div className="flex-1 overflow-y-auto">
        {technicians.map((tech) => (
          <div
            key={tech.id}
            className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
              selectedTechnicianId === tech["id"] ? "bg-blue-50 border-l-4 border-l-blue-600" : ""
            }`}
            onClick={() => onSelectTechnician(tech.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="font-medium truncate">{tech.fullName}</div>
                  {tech.isAvailable ? (
                    <Badge className="bg-green-100 text-green-800 text-xs">Available</Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-800 text-xs">Busy</Badge>
                  )}
                </div>

                <div className="text-xs text-gray-600 mb-2">
                  {tech.skillLevel.charAt(0).toUpperCase() + tech.skillLevel.slice(1)} •{" "}
                  {tech.employeeId}
                </div>

                {tech.currentAssignment && (
                  <div className="mt-2 p-2 bg-yellow-50 rounded text-xs">
                    <div className="flex items-center gap-1 font-medium text-yellow-900">
                      <Clock className="h-3 w-3" />
                      Current Task
                    </div>
                    <div className="text-yellow-700 mt-1">
                      {format(parseISO(tech.currentAssignment.scheduledStart), "h:mm a")} -{" "}
                      {format(parseISO(tech.currentAssignment.scheduledEnd), "h:mm a")}
                    </div>
                    {tech.distanceToTask && (
                      <div className="text-yellow-700 mt-1">
                        {tech.distanceToTask.toFixed(1)} km away
                      </div>
                    )}
                  </div>
                )}

                {tech.currentLocationLat && tech.currentLocationLng && (
                  <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Last seen:{" "}
                    {tech.lastLocationUpdate
                      ? format(parseISO(tech.lastLocationUpdate), "h:mm a")
                      : "Unknown"}
                  </div>
                )}
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTechnician(tech.id);
                }}
              >
                <Navigation className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}

        {technicians.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No technicians found</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function MapDashboard() {
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>();
  const [filters, setFilters] = useState<MapFilters>({
    status: ["active"],
    showAvailableOnly: false,
    showWithAssignments: false,
  });

  // Fetch technicians
  const technicianFilters = useMemo(() => {
    const next: TechnicianFilter = {
      status: filters.status as any,
    };
    if (filters.showAvailableOnly) {
      next.isAvailable = true;
    }
    return next;
  }, [filters]);
  const { data: techniciansData, refetch: refetchTechnicians } = useTechnicians(technicianFilters);

  // Fetch today's assignments
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: assignmentsData, refetch: refetchAssignments } = useAssignments({
    dateFrom: today,
    dateTo: today,
  });

  // Combine technicians with their current assignments
  const techniciansWithLocation: TechnicianWithLocation[] = (
    techniciansData?.technicians || []
  ).map((tech) => {
    const currentAssignment = assignmentsData?.assignments.find(
      (a) =>
        a.technicianId === tech.id &&
        (a.status === "in_progress" || a.status === "scheduled") &&
        isToday(parseISO(a.scheduledStart)),
    );

    let distanceToTask: number | undefined;
    if (
      currentAssignment &&
      tech.currentLocationLat &&
      tech.currentLocationLng &&
      currentAssignment.taskLocationLat &&
      currentAssignment.taskLocationLng
    ) {
      // Calculate distance using Haversine formula
      distanceToTask = calculateDistance(
        tech.currentLocationLat,
        tech.currentLocationLng,
        currentAssignment.taskLocationLat,
        currentAssignment.taskLocationLng,
      );
    }

    const withExtras: TechnicianWithLocation = { ...tech };
    if (currentAssignment) {
      withExtras.currentAssignment = currentAssignment;
    }
    if (distanceToTask !== undefined) {
      withExtras.distanceToTask = distanceToTask;
    }
    return withExtras;
  });

  // Apply filters
  const filteredTechnicians = techniciansWithLocation.filter((tech) => {
    if (filters.showWithAssignments && !tech.currentAssignment) {
      return false;
    }
    return true;
  });

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      void refetchTechnicians();
      void refetchAssignments();
    }, 30000);

    return () => clearInterval(interval);
  }, [refetchAssignments, refetchTechnicians]);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Live Map</h1>
            <p className="text-gray-600">Real-time technician tracking and assignments</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-green-100 text-green-800">
              <div className="h-2 w-2 bg-green-600 rounded-full mr-2 animate-pulse"></div>
              Live
            </Badge>
            <span className="text-sm text-gray-600">
              Last updated: {format(new Date(), "h:mm:ss a")}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 bg-white border-r overflow-hidden">
          <Sidebar
            technicians={filteredTechnicians}
            selectedTechnicianId={selectedTechnicianId}
            onSelectTechnician={setSelectedTechnicianId}
            filters={filters}
            onFilterChange={setFilters}
          />
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <MapComponent
            technicians={filteredTechnicians}
            selectedTechnicianId={selectedTechnicianId}
            onSelectTechnician={setSelectedTechnicianId}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}
