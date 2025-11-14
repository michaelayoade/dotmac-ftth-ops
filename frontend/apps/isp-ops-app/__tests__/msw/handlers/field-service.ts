/**
 * MSW Handlers for Field Service API
 * Mocks technicians, scheduling, time tracking, and resource management endpoints
 */

import { rest } from "msw";
import type {
  Technician,
  TimeEntry,
  TaskAssignment,
  Equipment,
  Vehicle,
  ResourceAssignment,
  TechnicianListResponse,
  TimeEntryListResponse,
  AssignmentListResponse,
  EquipmentListResponse,
  VehicleListResponse,
  AssignmentCandidatesResponse,
  ClockInData,
  ClockOutData,
  AutoAssignmentData,
  AssignResourceData,
} from "@/types/field-service";
import {
  TechnicianStatus,
  SkillLevel,
  TimeEntryType,
  TimeEntryStatus,
  AssignmentStatus,
  EquipmentStatus,
  VehicleStatus,
  ResourceAssignmentStatus,
} from "@/types/field-service";

// ============================================
// In-Memory Storage
// ============================================

let technicians: Technician[] = [];
let timeEntries: TimeEntry[] = [];
let assignments: TaskAssignment[] = [];
let equipment: Equipment[] = [];
let vehicles: Vehicle[] = [];
let resourceAssignments: ResourceAssignment[] = [];

// ============================================
// Mock Data Generators
// ============================================

export function createMockTechnician(
  overrides: Partial<Technician> = {}
): Technician {
  const id = overrides.id || `tech-${Date.now()}-${Math.random()}`;
  return {
    id,
    tenantId: "tenant-1",
    employeeId: `EMP-${Math.floor(Math.random() * 10000)}`,
    firstName: "John",
    lastName: "Doe",
    fullName: "John Doe",
    email: "john.doe@example.com",
    phone: "+1234567890",
    status: TechnicianStatus.ACTIVE,
    hireDate: "2023-01-01",
    skillLevel: SkillLevel.SENIOR,
    skills: [],
    certifications: [],
    specializations: ["fiber", "copper"],
    serviceAreas: ["downtown", "suburbs"],
    isAvailable: true,
    maxConcurrentTasks: 5,
    completedTasks: 150,
    averageRating: 4.5,
    completionRate: 0.95,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockTimeEntry(
  overrides: Partial<TimeEntry> = {}
): TimeEntry {
  const id = overrides.id || `entry-${Date.now()}-${Math.random()}`;
  return {
    id,
    tenantId: "tenant-1",
    technicianId: "tech-1",
    clockIn: new Date().toISOString(),
    breakDurationMinutes: 0,
    entryType: TimeEntryType.REGULAR,
    status: TimeEntryStatus.DRAFT,
    isActive: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockAssignment(
  overrides: Partial<TaskAssignment> = {}
): TaskAssignment {
  const id = overrides.id || `assign-${Date.now()}-${Math.random()}`;
  return {
    id,
    tenantId: "tenant-1",
    taskId: "task-1",
    technicianId: "tech-1",
    scheduledStart: new Date(Date.now() + 3600000).toISOString(),
    scheduledEnd: new Date(Date.now() + 7200000).toISOString(),
    status: AssignmentStatus.SCHEDULED,
    customerConfirmationRequired: false,
    rescheduleCount: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockEquipment(
  overrides: Partial<Equipment> = {}
): Equipment {
  const id = overrides.id || `equip-${Date.now()}-${Math.random()}`;
  return {
    id,
    tenantId: "tenant-1",
    name: "Fusion Splicer",
    category: "fiber-tools",
    equipmentType: "splicer",
    status: EquipmentStatus.AVAILABLE,
    requiresCalibration: false,
    isRental: false,
    isActive: true,
    isShareable: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockVehicle(
  overrides: Partial<Vehicle> = {}
): Vehicle {
  const id = overrides.id || `vehicle-${Date.now()}-${Math.random()}`;
  return {
    id,
    tenantId: "tenant-1",
    name: "Service Van 1",
    vehicleType: "van",
    make: "Ford",
    model: "Transit",
    licensePlate: "ABC-123",
    status: VehicleStatus.AVAILABLE,
    isLeased: false,
    isActive: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockResourceAssignment(
  overrides: Partial<ResourceAssignment> = {}
): ResourceAssignment {
  const id = overrides.id || `res-assign-${Date.now()}-${Math.random()}`;
  return {
    id,
    tenantId: "tenant-1",
    technicianId: "tech-1",
    assignedAt: new Date().toISOString(),
    status: ResourceAssignmentStatus.ASSIGNED,
    isActive: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================
// Storage Helpers
// ============================================

export function seedFieldServiceData(data: {
  technicians?: Technician[];
  timeEntries?: TimeEntry[];
  assignments?: TaskAssignment[];
  equipment?: Equipment[];
  vehicles?: Vehicle[];
}): void {
  if (data.technicians) technicians = [...data.technicians];
  if (data.timeEntries) timeEntries = [...data.timeEntries];
  if (data.assignments) assignments = [...data.assignments];
  if (data.equipment) equipment = [...data.equipment];
  if (data.vehicles) vehicles = [...data.vehicles];
}

export function clearFieldServiceData(): void {
  technicians = [];
  timeEntries = [];
  assignments = [];
  equipment = [];
  vehicles = [];
  resourceAssignments = [];
}

// ============================================
// MSW Handlers
// ============================================

export const fieldServiceHandlers = [
  // Get technicians list with filters
  rest.get("*/api/v1/field-service/technicians", (req, res, ctx) => {
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const skillLevelParam = url.searchParams.get("skillLevel");
    const search = url.searchParams.get("search");
    const isAvailable = url.searchParams.get("isAvailable");

    console.log("[MSW] GET /api/v1/field-service/technicians", {
      status: statusParam,
      skillLevel: skillLevelParam,
      search,
      isAvailable,
    });

    let filtered = [...technicians];

    // Filter by status (comma-separated values)
    if (statusParam) {
      const statuses = statusParam.split(",");
      filtered = filtered.filter((t) => statuses.includes(t.status));
    }

    // Filter by skill level
    if (skillLevelParam) {
      const levels = skillLevelParam.split(",");
      filtered = filtered.filter((t) => levels.includes(t.skillLevel));
    }

    // Filter by availability
    if (isAvailable !== null) {
      const availableFilter = isAvailable === "true";
      filtered = filtered.filter((t) => t.isAvailable === availableFilter);
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.fullName.toLowerCase().includes(searchLower) ||
          t.email.toLowerCase().includes(searchLower) ||
          t.employeeId.toLowerCase().includes(searchLower)
      );
    }

    const response: TechnicianListResponse = {
      technicians: filtered,
      total: filtered.length,
      page: 1,
      pageSize: 20,
    };

    console.log(`[MSW] Returning ${filtered.length} technicians`);
    return res(ctx.json(response));
  }),

  // Get single technician
  rest.get("*/api/v1/field-service/technicians/:id", (req, res, ctx) => {
    const { id } = req.params;
    console.log("[MSW] GET /api/v1/field-service/technicians/:id", { id });

    const technician = technicians.find((t) => t.id === id);
    if (!technician) {
      return res(
        ctx.status(404),
        ctx.json({ error: "Technician not found", code: "NOT_FOUND" })
      );
    }

    return res(ctx.json(technician));
  }),

  // Clock in
  rest.post("*/api/v1/time/clock-in", async (req, res, ctx) => {
    const clockInData = await req.json<ClockInData>();
    console.log("[MSW] POST /api/v1/time/clock-in", clockInData);

    const entry = createMockTimeEntry({
      id: `entry-${Date.now()}`,
      technicianId: clockInData.technicianId,
      taskId: clockInData.taskId,
      projectId: clockInData.projectId,
      entryType: clockInData.entryType,
      clockInLat: clockInData.latitude,
      clockInLng: clockInData.longitude,
      description: clockInData.description,
      status: TimeEntryStatus.DRAFT,
      isActive: true,
    });

    timeEntries.push(entry);
    return res(ctx.json(entry));
  }),

  // Clock out
  rest.post("*/api/v1/time/entries/:id/clock-out", async (req, res, ctx) => {
    const { id } = req.params;
    const clockOutData = await req.json<ClockOutData>();
    console.log("[MSW] POST /api/v1/time/entries/:id/clock-out", {
      id,
      ...clockOutData,
    });

    const entry = timeEntries.find((e) => e.id === id);
    if (!entry) {
      return res(
        ctx.status(404),
        ctx.json({ error: "Time entry not found", code: "NOT_FOUND" })
      );
    }

    // Update entry
    const clockOut = new Date().toISOString();
    const clockIn = new Date(entry.clockIn);
    const clockOutTime = new Date(clockOut);
    const totalHours = (clockOutTime.getTime() - clockIn.getTime()) / 3600000;

    Object.assign(entry, {
      clockOut,
      clockOutLat: clockOutData.latitude,
      clockOutLng: clockOutData.longitude,
      breakDurationMinutes: clockOutData.breakDurationMinutes || 0,
      notes: clockOutData.notes,
      totalHours,
      isActive: false,
      durationMinutes: Math.round(totalHours * 60),
    });

    return res(ctx.json(entry));
  }),

  // Get time entries with filters
  rest.get("*/api/v1/time/entries", (req, res, ctx) => {
    const url = new URL(req.url);
    const technicianId = url.searchParams.get("technicianId");
    const statusParam = url.searchParams.get("status");
    const entryTypeParam = url.searchParams.get("entryType");

    console.log("[MSW] GET /api/v1/time/entries", {
      technicianId,
      status: statusParam,
      entryType: entryTypeParam,
    });

    let filtered = [...timeEntries];

    if (technicianId) {
      filtered = filtered.filter((e) => e.technicianId === technicianId);
    }

    if (statusParam) {
      const statuses = statusParam.split(",");
      filtered = filtered.filter((e) => statuses.includes(e.status));
    }

    if (entryTypeParam) {
      const types = entryTypeParam.split(",");
      filtered = filtered.filter((e) => types.includes(e.entryType));
    }

    const response: TimeEntryListResponse = {
      entries: filtered,
      total: filtered.length,
      page: 1,
      pageSize: 20,
    };

    console.log(`[MSW] Returning ${filtered.length} time entries`);
    return res(ctx.json(response));
  }),

  // Get assignments with filters
  rest.get("*/api/v1/scheduling/assignments", (req, res, ctx) => {
    const url = new URL(req.url);
    const technicianId = url.searchParams.get("technicianId");
    const taskId = url.searchParams.get("taskId");
    const statusParam = url.searchParams.get("status");

    console.log("[MSW] GET /api/v1/scheduling/assignments", {
      technicianId,
      taskId,
      status: statusParam,
    });

    let filtered = [...assignments];

    if (technicianId) {
      filtered = filtered.filter((a) => a.technicianId === technicianId);
    }

    if (taskId) {
      filtered = filtered.filter((a) => a.taskId === taskId);
    }

    if (statusParam) {
      const statuses = statusParam.split(",");
      filtered = filtered.filter((a) => statuses.includes(a.status));
    }

    const response: AssignmentListResponse = {
      assignments: filtered,
      total: filtered.length,
      page: 1,
      pageSize: 20,
    };

    console.log(`[MSW] Returning ${filtered.length} assignments`);
    return res(ctx.json(response));
  }),

  // Auto-assign task
  rest.post("*/api/v1/scheduling/assignments/auto-assign", async (req, res, ctx) => {
    const autoAssignData = await req.json<AutoAssignmentData>();
    console.log("[MSW] POST /api/v1/scheduling/assignments/auto-assign", autoAssignData);

    // Find best available technician
    const availableTechs = technicians.filter((t) => t.isAvailable);
    const selectedTech = availableTechs[0] || technicians[0];

    if (!selectedTech) {
      return res(
        ctx.status(404),
        ctx.json({ error: "No available technicians", code: "NO_TECHNICIANS" })
      );
    }

    const assignment = createMockAssignment({
      id: `assign-${Date.now()}`,
      taskId: autoAssignData.taskId,
      technicianId: selectedTech.id,
      scheduledStart: autoAssignData.scheduledStart,
      scheduledEnd: autoAssignData.scheduledEnd,
      taskLocationLat: autoAssignData.taskLocationLat,
      taskLocationLng: autoAssignData.taskLocationLng,
      assignmentMethod: "auto",
      status: AssignmentStatus.SCHEDULED,
    });

    assignments.push(assignment);
    return res(ctx.json(assignment));
  }),

  // Get equipment with filters
  rest.get("*/api/v1/resources/equipment", (req, res, ctx) => {
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const category = url.searchParams.get("category");
    const isAvailable = url.searchParams.get("isAvailable");

    console.log("[MSW] GET /api/v1/resources/equipment", {
      status: statusParam,
      category,
      isAvailable,
    });

    let filtered = [...equipment];

    if (statusParam) {
      const statuses = statusParam.split(",");
      filtered = filtered.filter((e) => statuses.includes(e.status));
    }

    if (category) {
      const categories = category.split(",");
      filtered = filtered.filter((e) => categories.includes(e.category));
    }

    if (isAvailable !== null && isAvailable === "true") {
      filtered = filtered.filter((e) => e.status === EquipmentStatus.AVAILABLE);
    }

    const response: EquipmentListResponse = {
      equipment: filtered,
      total: filtered.length,
      page: 1,
      pageSize: 20,
    };

    console.log(`[MSW] Returning ${filtered.length} equipment`);
    return res(ctx.json(response));
  }),

  // Get vehicles with filters
  rest.get("*/api/v1/resources/vehicles", (req, res, ctx) => {
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const vehicleType = url.searchParams.get("vehicleType");

    console.log("[MSW] GET /api/v1/resources/vehicles", {
      status: statusParam,
      vehicleType,
    });

    let filtered = [...vehicles];

    if (statusParam) {
      const statuses = statusParam.split(",");
      filtered = filtered.filter((v) => statuses.includes(v.status));
    }

    if (vehicleType) {
      filtered = filtered.filter((v) => v.vehicleType === vehicleType);
    }

    const response: VehicleListResponse = {
      vehicles: filtered,
      total: filtered.length,
      page: 1,
      pageSize: 20,
    };

    console.log(`[MSW] Returning ${filtered.length} vehicles`);
    return res(ctx.json(response));
  }),

  // Assign resource to technician
  rest.post("*/api/v1/resources/assignments", async (req, res, ctx) => {
    const assignmentData = await req.json<AssignResourceData>();
    console.log("[MSW] POST /api/v1/resources/assignments", assignmentData);

    const assignment = createMockResourceAssignment({
      id: `res-assign-${Date.now()}`,
      technicianId: assignmentData.technicianId,
      equipmentId: assignmentData.equipmentId,
      vehicleId: assignmentData.vehicleId,
      taskId: assignmentData.taskId,
      projectId: assignmentData.projectId,
      expectedReturnAt: assignmentData.expectedReturnAt,
      conditionAtAssignment: assignmentData.conditionAtAssignment,
      assignmentNotes: assignmentData.assignmentNotes,
      status: ResourceAssignmentStatus.ASSIGNED,
      isActive: true,
    });

    resourceAssignments.push(assignment);

    // Update equipment/vehicle status to IN_USE
    if (assignmentData.equipmentId) {
      const equip = equipment.find((e) => e.id === assignmentData.equipmentId);
      if (equip) {
        equip.status = EquipmentStatus.IN_USE;
        equip.assignedToTechnicianId = assignmentData.technicianId;
      }
    }

    if (assignmentData.vehicleId) {
      const vehicle = vehicles.find((v) => v.id === assignmentData.vehicleId);
      if (vehicle) {
        vehicle.status = VehicleStatus.IN_USE;
        vehicle.assignedToTechnicianId = assignmentData.technicianId;
      }
    }

    return res(ctx.json(assignment));
  }),
];
