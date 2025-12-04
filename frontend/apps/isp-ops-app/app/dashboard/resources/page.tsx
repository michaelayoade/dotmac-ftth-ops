"use client";

/**
 * Resource Management Dashboard
 * Equipment and vehicle tracking, assignment, and maintenance
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import {
  Wrench,
  Car,
  Package,
  Plus,
  Search,
  Filter,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Users,
  MapPin,
} from "lucide-react";
import {
  useEquipment,
  useVehicles,
  useResourceAssignments,
  useAssignResource,
  useReturnResource,
  useTechnicians,
} from "@/hooks/useFieldService";
import type {
  Equipment,
  Vehicle,
  ResourceAssignment,
  EquipmentStatus,
  VehicleStatus,
  ResourceFilter,
  AssignResourceData,
} from "@/types/field-service";
import { format, parseISO, isPast } from "date-fns";

// ============================================================================
// Equipment List Component
// ============================================================================

interface EquipmentListProps {
  equipment: Equipment[];
  onAssign?: (id: string) => void;
}

function EquipmentList({ equipment, onAssign }: EquipmentListProps) {
  const getStatusBadge = (status: EquipmentStatus) => {
    const config: Record<
      EquipmentStatus,
      { variant: "default" | "secondary" | "outline" | "destructive"; className: string }
    > = {
      available: { variant: "default", className: "bg-green-100 text-green-800" },
      in_use: { variant: "secondary", className: "bg-blue-100 text-blue-800" },
      maintenance: { variant: "outline", className: "bg-yellow-100 text-yellow-800" },
      repair: { variant: "outline", className: "bg-orange-100 text-orange-800" },
      retired: { variant: "secondary", className: "bg-gray-100 text-gray-800" },
      lost: { variant: "destructive", className: "" },
    };

    const { variant, className } = config[status];
    return (
      <Badge variant={variant} className={className}>
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const needsMaintenance = (item: Equipment) => {
    if (item.nextMaintenanceDue && isPast(parseISO(item.nextMaintenanceDue))) {
      return true;
    }
    if (
      item.requiresCalibration &&
      item.nextCalibrationDue &&
      isPast(parseISO(item.nextCalibrationDue))
    ) {
      return true;
    }
    return false;
  };

  return (
    <div className="space-y-2">
      {equipment.map((item) => (
        <Card key={item.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-gray-500" />
                  <span className="font-medium">{item.name}</span>
                  {getStatusBadge(item.status)}
                  {item.assetTag && (
                    <Badge variant="outline" className="text-xs">
                      {item.assetTag}
                    </Badge>
                  )}
                  {needsMaintenance(item) && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Maintenance Due
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-6 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Category:</span> {item.category}
                  </div>
                  <div>
                    <span className="font-medium">Type:</span> {item.equipmentType}
                  </div>
                  {item.manufacturer && (
                    <div>
                      <span className="font-medium">Make:</span> {item.manufacturer} {item.model}
                    </div>
                  )}
                </div>

                {item.assignedTechnician && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <Users className="h-4 w-4" />
                    <span>Assigned to: {item.assignedTechnician.fullName}</span>
                  </div>
                )}

                {item.currentLocation && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span>{item.currentLocation}</span>
                  </div>
                )}

                {item.requiresCalibration && item.nextCalibrationDue && (
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Next Calibration:</span>{" "}
                    {format(parseISO(item.nextCalibrationDue), "MMM d, yyyy")}
                  </div>
                )}
              </div>

              {onAssign && item.status === "available" && (
                <Button size="sm" variant="outline" onClick={() => onAssign(item.id)}>
                  Assign
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// Vehicle List Component
// ============================================================================

interface VehicleListProps {
  vehicles: Vehicle[];
  onAssign?: (id: string) => void;
}

function VehicleList({ vehicles, onAssign }: VehicleListProps) {
  const getStatusBadge = (status: VehicleStatus) => {
    const config: Record<
      VehicleStatus,
      { variant: "default" | "secondary" | "outline" | "destructive"; className: string }
    > = {
      available: { variant: "default", className: "bg-green-100 text-green-800" },
      in_use: { variant: "secondary", className: "bg-blue-100 text-blue-800" },
      maintenance: { variant: "outline", className: "bg-yellow-100 text-yellow-800" },
      repair: { variant: "outline", className: "bg-orange-100 text-orange-800" },
      retired: { variant: "secondary", className: "bg-gray-100 text-gray-800" },
    };

    const { variant, className } = config[status];
    return (
      <Badge variant={variant} className={className}>
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const needsService = (vehicle: Vehicle) => {
    if (vehicle.nextServiceDue && isPast(parseISO(vehicle.nextServiceDue))) {
      return true;
    }
    if (
      vehicle.odometerReading &&
      vehicle.nextServiceOdometer &&
      vehicle.odometerReading >= vehicle.nextServiceOdometer
    ) {
      return true;
    }
    return false;
  };

  return (
    <div className="space-y-2">
      {vehicles.map((vehicle) => (
        <Card key={vehicle.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3">
                  <Car className="h-5 w-5 text-gray-500" />
                  <span className="font-medium">{vehicle.name}</span>
                  {getStatusBadge(vehicle.status)}
                  <Badge variant="outline" className="text-xs">
                    {vehicle.licensePlate}
                  </Badge>
                  {needsService(vehicle) && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Service Due
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-6 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Type:</span> {vehicle.vehicleType}
                  </div>
                  <div>
                    <span className="font-medium">Make/Model:</span> {vehicle.make} {vehicle.model}{" "}
                    ({vehicle.year})
                  </div>
                  {vehicle.odometerReading && (
                    <div>
                      <span className="font-medium">Odometer:</span>{" "}
                      {vehicle.odometerReading.toLocaleString()} km
                    </div>
                  )}
                </div>

                {vehicle.assignedTechnician && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <Users className="h-4 w-4" />
                    <span>Assigned to: {vehicle.assignedTechnician.fullName}</span>
                  </div>
                )}

                {vehicle.currentLat && vehicle.currentLng && vehicle.lastLocationUpdate && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span>
                      Last location: {vehicle.currentLat.toFixed(4)},{" "}
                      {vehicle.currentLng.toFixed(4)} -{" "}
                      {format(parseISO(vehicle.lastLocationUpdate), "MMM d, h:mm a")}
                    </span>
                  </div>
                )}

                {vehicle.nextServiceDue && (
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Next Service:</span>{" "}
                    {format(parseISO(vehicle.nextServiceDue), "MMM d, yyyy")}
                  </div>
                )}
              </div>

              {onAssign && vehicle.status === "available" && (
                <Button size="sm" variant="outline" onClick={() => onAssign(vehicle.id)}>
                  Assign
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// Assignment Modal Component
// ============================================================================

interface AssignmentModalProps {
  resourceType: "equipment" | "vehicle";
  resourceId: string;
  onClose: () => void;
}

function AssignmentModal({ resourceType, resourceId, onClose }: AssignmentModalProps) {
  const [technicianId, setTechnicianId] = useState("");
  const [expectedReturn, setExpectedReturn] = useState("");
  const [notes, setNotes] = useState("");

  const { data: techniciansData } = useTechnicians();
  const assignResourceMutation = useAssignResource();

  const handleSubmit = async () => {
    if (!technicianId) {
      return;
    }

    const payload: AssignResourceData = {
      technicianId,
    };
    if (resourceType === "equipment") {
      payload.equipmentId = resourceId;
    } else {
      payload.vehicleId = resourceId;
    }
    const trimmedNotes = notes.trim();
    if (trimmedNotes) {
      payload.assignmentNotes = trimmedNotes;
    }
    if (expectedReturn) {
      payload.expectedReturnAt = expectedReturn;
    }

    await assignResourceMutation.mutateAsync(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Assign {resourceType === "equipment" ? "Equipment" : "Vehicle"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Technician</label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
            >
              <option value="">Select technician...</option>
              {techniciansData?.technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.fullName} - {tech.skillLevel}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Expected Return (Optional)</label>
            <Input
              type="datetime-local"
              value={expectedReturn}
              onChange={(e) => setExpectedReturn(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (Optional)</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions..."
            />
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={!technicianId || assignResourceMutation.isPending}
            >
              {assignResourceMutation.isPending ? "Assigning..." : "Assign"}
            </Button>
            <Button className="flex-1" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function ResourcesPage() {
  const [activeTab, setActiveTab] = useState<"equipment" | "vehicles">("equipment");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<ResourceFilter>({});
  const [assigningResource, setAssigningResource] = useState<{
    type: "equipment" | "vehicle";
    id: string;
  } | null>(null);

  const { data: equipmentData, isLoading: loadingEquipment } = useEquipment(filter);
  const { data: vehiclesData, isLoading: loadingVehicles } = useVehicles(filter);

  const equipment = equipmentData?.equipment || [];
  const vehicles = vehiclesData?.vehicles || [];

  const equipmentStats = {
    total: equipment.length,
    available: equipment.filter((e) => e.status === "available").length,
    inUse: equipment.filter((e) => e.status === "in_use").length,
    maintenance: equipment.filter((e) => e.status === "maintenance" || e.status === "repair")
      .length,
  };

  const vehicleStats = {
    total: vehicles.length,
    available: vehicles.filter((v) => v.status === "available").length,
    inUse: vehicles.filter((v) => v.status === "in_use").length,
    maintenance: vehicles.filter((v) => v.status === "maintenance" || v.status === "repair").length,
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Resource Management</h1>
          <p className="text-gray-600">Manage equipment and vehicles for field operations</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Resource
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "equipment"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
          onClick={() => setActiveTab("equipment")}
        >
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Equipment ({equipment.length})
          </div>
        </button>
        <button
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "vehicles"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
          onClick={() => setActiveTab("vehicles")}
        >
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4" />
            Vehicles ({vehicles.length})
          </div>
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold">
                  {activeTab === "equipment" ? equipmentStats.total : vehicleStats.total}
                </p>
              </div>
              {activeTab === "equipment" ? (
                <Package className="h-8 w-8 text-gray-500" />
              ) : (
                <Car className="h-8 w-8 text-gray-500" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Available</p>
                <p className="text-2xl font-bold">
                  {activeTab === "equipment" ? equipmentStats.available : vehicleStats.available}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Use</p>
                <p className="text-2xl font-bold">
                  {activeTab === "equipment" ? equipmentStats.inUse : vehicleStats.inUse}
                </p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Maintenance</p>
                <p className="text-2xl font-bold">
                  {activeTab === "equipment"
                    ? equipmentStats.maintenance
                    : vehicleStats.maintenance}
                </p>
              </div>
              <Wrench className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Filters
        </Button>
      </div>

      {/* Content */}
      <div>
        {activeTab === "equipment" ? (
          loadingEquipment ? (
            <div className="text-center py-12 text-gray-500">Loading equipment...</div>
          ) : equipment.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No equipment found</div>
          ) : (
            <EquipmentList
              equipment={equipment}
              onAssign={(id) => setAssigningResource({ type: "equipment", id })}
            />
          )
        ) : loadingVehicles ? (
          <div className="text-center py-12 text-gray-500">Loading vehicles...</div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No vehicles found</div>
        ) : (
          <VehicleList
            vehicles={vehicles}
            onAssign={(id) => setAssigningResource({ type: "vehicle", id })}
          />
        )}
      </div>

      {/* Assignment Modal */}
      {assigningResource && (
        <AssignmentModal
          resourceType={assigningResource.type}
          resourceId={assigningResource.id}
          onClose={() => setAssigningResource(null)}
        />
      )}
    </div>
  );
}
