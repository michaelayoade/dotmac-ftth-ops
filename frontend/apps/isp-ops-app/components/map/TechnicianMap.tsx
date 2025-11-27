"use client";

/**
 * Technician Map Component
 * Interactive map showing technician locations, routes, and task assignments
 */

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { MapPin, Navigation, Clock, User, Phone, CheckCircle2, AlertCircle } from "lucide-react";
import type { Technician, TaskAssignment } from "@/types/field-service";
import { format, parseISO } from "date-fns";

// Fix Leaflet default marker icon issue with Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  iconUrl: "/leaflet/marker-icon.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});

// ============================================================================
// Custom Marker Icons
// ============================================================================

const createTechnicianIcon = (isAvailable: boolean, isSelected: boolean) => {
  const color = isAvailable ? "#10b981" : "#f59e0b"; // green or yellow
  const size = isSelected ? 40 : 32;

  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ${isSelected ? "animation: pulse 2s infinite;" : ""}
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const createTaskIcon = (status: string) => {
  const colorMap: Record<string, string> = {
    scheduled: "#3b82f6",
    in_progress: "#f59e0b",
    completed: "#10b981",
    cancelled: "#ef4444",
  };

  const color = colorMap[status] || "#6b7280";

  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        width: 28px;
        height: 28px;
        background: ${color};
        border: 2px solid white;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
};

// ============================================================================
// Types
// ============================================================================

interface TechnicianWithLocation extends Technician {
  currentAssignment?: TaskAssignment | undefined;
  distanceToTask?: number | undefined;
}

interface TechnicianMapProps {
  technicians: TechnicianWithLocation[];
  selectedTechnicianId?: string | undefined;
  onSelectTechnician: (id: string) => void;
}

// ============================================================================
// Map Component
// ============================================================================

export default function TechnicianMap({
  technicians,
  selectedTechnicianId,
  onSelectTechnician,
}: TechnicianMapProps) {
  const mapRef = useRef<L.Map>(null);
  const [center, setCenter] = useState<[number, number]>([6.5244, 3.3792]); // Lagos default
  const [zoom, setZoom] = useState(12);

  // Auto-center on selected technician
  useEffect(() => {
    if (selectedTechnicianId && mapRef.current) {
      const selectedTech = technicians.find((t) => t.id === selectedTechnicianId);
      if (selectedTech?.currentLocationLat && selectedTech.currentLocationLng) {
        mapRef.current.flyTo(
          [selectedTech.currentLocationLat, selectedTech.currentLocationLng],
          15,
          { duration: 1 },
        );
      }
    }
  }, [selectedTechnicianId, technicians]);

  // Fit bounds to show all technicians
  useEffect(() => {
    if (technicians.length > 0 && mapRef.current && !selectedTechnicianId) {
      const bounds = L.latLngBounds(
        technicians
          .filter((t) => t.currentLocationLat && t.currentLocationLng)
          .map((t) => [t.currentLocationLat!, t.currentLocationLng!]),
      );

      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [technicians, selectedTechnicianId]);

  return (
    <div className="h-full w-full relative">
      <MapContainer
        ref={mapRef}
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
        className="z-0"
      >
        {/* OpenStreetMap Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Technician Markers */}
        {technicians.map((tech) => {
          if (!tech.currentLocationLat || !tech.currentLocationLng) return null;

          const isSelected = tech.id === selectedTechnicianId;

          return (
            <div key={tech.id}>
              {/* Technician Marker */}
              <Marker
                position={[tech.currentLocationLat, tech.currentLocationLng]}
                icon={createTechnicianIcon(tech.isAvailable, isSelected)}
                eventHandlers={{
                  click: () => onSelectTechnician(tech.id),
                }}
              >
                <Popup>
                  <div className="p-2 min-w-[250px]">
                    {/* Technician Info */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-base">{tech.fullName}</div>
                      {tech.isAvailable ? (
                        <Badge className="bg-green-100 text-green-800 text-xs">Available</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800 text-xs">Busy</Badge>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {tech.skillLevel.charAt(0).toUpperCase() + tech.skillLevel.slice(1)} •{" "}
                        {tech.employeeId}
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {tech.phone}
                      </div>
                      {tech.lastLocationUpdate && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Last update: {format(parseISO(tech.lastLocationUpdate), "h:mm a")}
                        </div>
                      )}
                    </div>

                    {/* Current Assignment */}
                    {tech.currentAssignment && (
                      <div className="border-t pt-2 mt-2">
                        <div className="font-medium text-sm mb-1">Current Task</div>
                        <div className="text-xs text-gray-600 space-y-1">
                          <div>
                            Status:{" "}
                            <span className="font-medium">
                              {tech.currentAssignment.status.replace("_", " ")}
                            </span>
                          </div>
                          <div>
                            Time:{" "}
                            {format(parseISO(tech.currentAssignment.scheduledStart), "h:mm a")} -{" "}
                            {format(parseISO(tech.currentAssignment.scheduledEnd), "h:mm a")}
                          </div>
                          {tech.distanceToTask && (
                            <div>
                              Distance:{" "}
                              <span className="font-medium">
                                {tech.distanceToTask.toFixed(1)} km
                              </span>
                            </div>
                          )}
                        </div>

                        {tech.currentAssignment.taskLocationLat &&
                          tech.currentAssignment.taskLocationLng && (
                            <Button
                              size="sm"
                              className="w-full mt-2"
                              onClick={() => {
                                window.open(
                                  `https://www.google.com/maps/dir/?api=1&origin=${tech.currentLocationLat},${tech.currentLocationLng}&destination=${tech.currentAssignment!.taskLocationLat},${tech.currentAssignment!.taskLocationLng}`,
                                  "_blank",
                                );
                              }}
                            >
                              <Navigation className="h-3 w-3 mr-1" />
                              Get Directions
                            </Button>
                          )}
                      </div>
                    )}

                    {/* Skills */}
                    {tech.skills && tech.skills.length > 0 && (
                      <div className="border-t pt-2 mt-2">
                        <div className="font-medium text-sm mb-1">Skills</div>
                        <div className="flex flex-wrap gap-1">
                          {tech.skills.slice(0, 3).map((skill, idx) => (
                            <Badge key={idx} className="bg-blue-100 text-blue-800 text-xs">
                              {skill.skill.replace("_", " ")}
                            </Badge>
                          ))}
                          {tech.skills.length > 3 && (
                            <Badge className="bg-gray-100 text-gray-600 text-xs">
                              +{tech.skills.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>

              {/* Service Area Circle */}
              {isSelected && tech.serviceAreas && tech.serviceAreas.length > 0 && (
                <Circle
                  center={[tech.currentLocationLat, tech.currentLocationLng]}
                  radius={5000} // 5km radius
                  pathOptions={{
                    color: "#3b82f6",
                    fillColor: "#3b82f6",
                    fillOpacity: 0.1,
                    weight: 2,
                  }}
                />
              )}

              {/* Route to Task */}
              {tech.currentAssignment?.taskLocationLat &&
                tech.currentAssignment.taskLocationLng && (
                  <>
                    {/* Task Marker */}
                    <Marker
                      position={[
                        tech.currentAssignment.taskLocationLat,
                        tech.currentAssignment.taskLocationLng,
                      ]}
                      icon={createTaskIcon(tech.currentAssignment.status)}
                    >
                      <Popup>
                        <div className="p-2 min-w-[200px]">
                          <div className="font-semibold mb-2">
                            Task {tech.currentAssignment.taskId.slice(0, 8)}
                          </div>
                          <div className="space-y-1 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <div
                                className={`h-2 w-2 rounded-full ${
                                  tech.currentAssignment.status === "in_progress"
                                    ? "bg-yellow-500"
                                    : tech.currentAssignment.status === "completed"
                                      ? "bg-green-500"
                                      : "bg-blue-500"
                                }`}
                              ></div>
                              {tech.currentAssignment.status.replace("_", " ")}
                            </div>
                            <div>
                              {format(
                                parseISO(tech.currentAssignment.scheduledStart),
                                "MMM d, h:mm a",
                              )}
                            </div>
                            {tech.currentAssignment.taskLocationAddress && (
                              <div className="text-xs mt-2">
                                {tech.currentAssignment.taskLocationAddress}
                              </div>
                            )}
                          </div>
                        </div>
                      </Popup>
                    </Marker>

                    {/* Route Line */}
                    <Polyline
                      positions={[
                        [tech.currentLocationLat, tech.currentLocationLng],
                        [
                          tech.currentAssignment.taskLocationLat,
                          tech.currentAssignment.taskLocationLng,
                        ],
                      ]}
                      pathOptions={{
                        color: isSelected ? "#3b82f6" : "#94a3b8",
                        weight: isSelected ? 4 : 2,
                        opacity: isSelected ? 0.8 : 0.5,
                        dashArray: "10, 10",
                      }}
                    />
                  </>
                )}
            </div>
          );
        })}
      </MapContainer>

      {/* Map Legend */}
      <div className="absolute bottom-6 right-6 bg-white rounded-lg shadow-lg p-4 z-[1000]">
        <div className="font-semibold text-sm mb-3">Legend</div>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-green-500 rounded-full border-2 border-white"></div>
            <span>Available Technician</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-yellow-500 rounded-full border-2 border-white"></div>
            <span>Busy Technician</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-blue-500 rounded border-2 border-white"></div>
            <span>Scheduled Task</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-yellow-500 rounded border-2 border-white"></div>
            <span>Task In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-green-500 rounded border-2 border-white"></div>
            <span>Completed Task</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="h-0.5 w-6 bg-blue-500"
              style={{ borderTop: "2px dashed #3b82f6" }}
            ></div>
            <span>Route</span>
          </div>
        </div>
      </div>

      {/* Live Indicator */}
      <div className="absolute top-6 right-6 bg-white rounded-lg shadow-lg px-3 py-2 z-[1000] flex items-center gap-2">
        <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-xs font-medium">Live Tracking</span>
      </div>
    </div>
  );
}
