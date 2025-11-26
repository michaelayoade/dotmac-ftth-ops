/**
 * Fiber Network Map Component
 * Visualizes fiber infrastructure including cables, splice points, and distribution points
 */

"use client";

import React, { useMemo } from "react";
import { LeafletMap } from "@dotmac/primitives/maps";
import type {
  MapMarker,
  ServiceArea,
  NetworkNode,
  Route,
  Coordinates,
} from "@dotmac/primitives/maps";
import type {
  FiberCable,
  SplicePoint,
  DistributionPoint,
  ServiceArea as FiberServiceArea,
} from "@/types/fibermaps";
import type { FieldInstallationJob } from "@/hooks/useJobs";
import type { TechnicianLocation } from "@/hooks/useTechnicians";

export interface FiberNetworkMapProps {
  // Fiber Infrastructure Data
  cables?: FiberCable[];
  splicePoints?: SplicePoint[];
  distributionPoints?: DistributionPoint[];
  serviceAreas?: FiberServiceArea[];

  // Field Service Data
  jobs?: FieldInstallationJob[];
  technicians?: TechnicianLocation[];

  // Map Configuration
  center?: Coordinates;
  zoom?: number;
  height?: number | string;

  // Display Options
  showCables?: boolean;
  showSplicePoints?: boolean;
  showDistributionPoints?: boolean;
  showServiceAreas?: boolean;
  showJobs?: boolean;
  showTechnicians?: boolean;
  showLegend?: boolean;

  // Event Handlers
  onCableClick?: (cable: FiberCable) => void;
  onSplicePointClick?: (point: SplicePoint) => void;
  onDistributionPointClick?: (point: DistributionPoint) => void;
  onServiceAreaClick?: (area: FiberServiceArea) => void;
  onJobClick?: (job: FieldInstallationJob) => void;
  onTechnicianClick?: (technician: TechnicianLocation) => void;

  // UI
  title?: string;
  className?: string;
  loading?: boolean;
  error?: string | null;
}

// Status color mapping
const cableStatusColors: Record<string, string> = {
  active: "#10B981", // green
  inactive: "#6B7280", // gray
  planned: "#8B5CF6", // purple
  under_construction: "#F59E0B", // yellow
  maintenance: "#F59E0B", // yellow
  damaged: "#EF4444", // red
};

const spliceStatusColors: Record<string, string> = {
  operational: "#10B981", // green
  maintenance: "#F59E0B", // yellow
  fault: "#EF4444", // red
};

const jobStatusColors: Record<string, string> = {
  pending: "#6B7280", // gray
  assigned: "#3B82F6", // blue
  running: "#F59E0B", // yellow
  completed: "#10B981", // green
  failed: "#EF4444", // red
  cancelled: "#9CA3AF", // light gray
};

export const FiberNetworkMap: React.FC<FiberNetworkMapProps> = ({
  cables = [],
  splicePoints = [],
  distributionPoints = [],
  serviceAreas = [],
  jobs = [],
  technicians = [],
  center,
  zoom = 13,
  height = 600,
  showCables = true,
  showSplicePoints = true,
  showDistributionPoints = true,
  showServiceAreas = true,
  showJobs = true,
  showTechnicians = true,
  showLegend = true,
  onCableClick,
  onSplicePointClick,
  onDistributionPointClick,
  onServiceAreaClick,
  onJobClick,
  onTechnicianClick,
  title,
  className,
  loading = false,
  error = null,
}) => {
  // Convert fiber cables to routes for visualization
  const routes = useMemo<Route[]>(() => {
    if (!showCables) return [];

    return cables.map((cable) => ({
      id: cable.id,
      name: cable.cable_name,
      waypoints: cable.path.coordinates,
      type:
        cable.status === "under_construction"
          ? "installation"
          : cable.status === "maintenance"
            ? "maintenance"
            : "installation",
      status:
        cable.status === "active"
          ? "completed"
          : cable.status === "under_construction"
            ? "in_progress"
            : "planned",
    }));
  }, [cables, showCables]);

  // Convert splice points to markers
  const spliceMarkers = useMemo<MapMarker[]>(() => {
    if (!showSplicePoints) return [];

    return splicePoints.map((point) => ({
      id: point.id,
      position: point.coordinates,
      type: "fiber" as const,
      status:
        point.status === "operational"
          ? "active"
          : point.status === "fault"
            ? "error"
            : "maintenance",
      title: point.name,
      description: `${point.type} • ${point.splice_count}/${point.capacity} splices`,
      metadata: point,
      onClick: () => onSplicePointClick?.(point),
    }));
  }, [splicePoints, showSplicePoints, onSplicePointClick]);

  // Convert distribution points to markers
  const distributionMarkers = useMemo<MapMarker[]>(() => {
    if (!showDistributionPoints) return [];

    return distributionPoints.map((point) => ({
      id: point.id,
      position: point.coordinates,
      type: "tower" as const,
      status: "active" as const,
      title: point.name,
      description: `${point.type.toUpperCase()} • ${point.ports_used}/${point.capacity} ports`,
      metadata: point,
      onClick: () => onDistributionPointClick?.(point),
    }));
  }, [distributionPoints, showDistributionPoints, onDistributionPointClick]);

  // Convert field installation jobs to markers
  const jobMarkers = useMemo<MapMarker[]>(() => {
    if (!showJobs) return [];

    return jobs.map((job) => {
      // Map job status to marker status
      const markerStatus: "active" | "inactive" | "maintenance" | "error" =
        job.status === "completed"
          ? "active"
          : job.status === "running"
            ? "maintenance"
            : job.status === "failed"
              ? "error"
              : "inactive";

      // Build description with key details
      const priority = job.parameters?.priority || "normal";
      const ticketNumber = job.parameters?.ticket_number || "N/A";
      const statusText = job.status.replace("_", " ").toUpperCase();

      return {
        id: job.id,
        position: { lat: job.location_lat!, lng: job.location_lng! },
        type: "technician" as const, // Using technician type for field jobs
        status: markerStatus,
        title: job.title,
        description: `Status: ${statusText} • Priority: ${priority} • Ticket: ${ticketNumber}`,
        metadata: job,
        onClick: () => onJobClick?.(job),
      };
    });
  }, [jobs, showJobs, onJobClick]);

  // Convert technicians to markers
  const technicianMarkers = useMemo<MapMarker[]>(() => {
    if (!showTechnicians) return [];

    return technicians
      .filter((tech) => tech.latitude !== null && tech.longitude !== null)
      .map((tech) => {
        // Map technician status to marker status
        const markerStatus: "active" | "inactive" | "maintenance" | "error" =
          tech.status === "available"
            ? "active"
            : tech.status === "on_job"
              ? "maintenance"
              : tech.status === "on_break"
                ? "inactive"
                : "inactive";

        // Build description
        const statusText = tech.status.replace("_", " ").toUpperCase();
        const lastUpdate = tech.last_update
          ? new Date(tech.last_update).toLocaleTimeString()
          : "Never";

        return {
          id: tech.technician_id,
          position: { lat: tech.latitude!, lng: tech.longitude! },
          type: "technician" as const,
          status: markerStatus,
          title: tech.technician_name || "Technician",
          description: `Status: ${statusText} • Last Update: ${lastUpdate}`,
          metadata: tech,
          onClick: () => onTechnicianClick?.(tech),
        };
      });
  }, [technicians, showTechnicians, onTechnicianClick]);

  // Combine all markers
  const allMarkers = useMemo<MapMarker[]>(() => {
    return [...spliceMarkers, ...distributionMarkers, ...jobMarkers, ...technicianMarkers];
  }, [spliceMarkers, distributionMarkers, jobMarkers, technicianMarkers]);

  // Convert service areas to map service areas
  const mapServiceAreas = useMemo<ServiceArea[]>(() => {
    if (!showServiceAreas) return [];

    return (serviceAreas ?? []).map((area) => {
      // Map fiber_availability to service type
      const serviceType: "fiber" | "wireless" | "hybrid" = area.fiber_availability
        ? "fiber"
        : "wireless";

      // Map coverage_status to service level
      const serviceLevel: "full" | "limited" | "planned" =
        area.coverage_status === "covered"
          ? "full"
          : area.coverage_status === "partial"
            ? "limited"
            : "planned";

      const mappedArea: ServiceArea = {
        id: area.id,
        name: area.name,
        type: serviceType,
        polygon: area.boundary.coordinates,
        serviceLevel,
        maxSpeed: 1000, // Default max speed
        coverage:
          area.coverage_status === "covered" ? 100 : area.coverage_status === "partial" ? 50 : 0,
        color: serviceType === "fiber" ? "#3B82F6" : "#8B5CF6",
      };
      if (typeof area.active_customers === "number") {
        mappedArea.customers = area.active_customers;
      }
      return mappedArea;
    });
  }, [serviceAreas, showServiceAreas]);

  // Calculate center from data if not provided
  const calculatedCenter = useMemo(() => {
    if (center) return center;

    // Use first job with location
    if (jobs.length > 0 && jobs[0]?.location_lat && jobs[0]?.location_lng) {
      return { lat: jobs[0].location_lat, lng: jobs[0].location_lng };
    }

    // Use first splice point, distribution point, or cable as center
    if (splicePoints.length > 0 && splicePoints[0]?.coordinates) {
      return splicePoints[0].coordinates;
    }
    if (distributionPoints.length > 0 && distributionPoints[0]?.coordinates) {
      return distributionPoints[0].coordinates;
    }
    if (cables.length > 0) {
      const cable = cables[0];
      if (cable?.path?.coordinates && cable.path.coordinates.length > 0) {
        return cable.path.coordinates[0];
      }
    }

    // Default center (adjust based on your region)
    return { lat: 6.5244, lng: 3.3792 }; // Lagos, Nigeria as default
  }, [center, cables, splicePoints, distributionPoints, jobs]) as Coordinates;

  const mapProps: React.ComponentProps<typeof LeafletMap> = {
    center: calculatedCenter,
    zoom,
    height,
    markers: allMarkers,
    serviceAreas: mapServiceAreas,
    routes,
    variant: "admin",
    showLegend,
    showControls: true,
    loading,
    onMarkerClick: (marker) => {
      if (marker.metadata) {
        const metadata = marker.metadata as any;
        if (metadata.splice_count !== undefined) {
          onSplicePointClick?.(metadata as SplicePoint);
        } else if (metadata.job_type !== undefined) {
          onJobClick?.(metadata as FieldInstallationJob);
        } else if (metadata.technician_id !== undefined && metadata.status !== undefined) {
          onTechnicianClick?.(metadata as TechnicianLocation);
        } else if (metadata.capacity !== undefined) {
          onDistributionPointClick?.(metadata as DistributionPoint);
        }
      }
    },
    onAreaClick: (area) => {
      const fiberArea = serviceAreas.find((sa) => sa.id === area.id);
      if (fiberArea) {
        onServiceAreaClick?.(fiberArea);
      }
    },
  };

  if (title) {
    mapProps.title = title;
  }
  if (className) {
    mapProps.className = className;
  }
  if (error) {
    mapProps.error = error;
  }

  return <LeafletMap {...mapProps} />;
};

export default FiberNetworkMap;
