/**
 * MSW Handlers for Technician API Endpoints
 *
 * These handlers intercept technician-related API calls during tests,
 * providing realistic responses without hitting a real server.
 */

import { http, HttpResponse } from "msw";
import type {
  Technician,
  TechnicianLocation,
  TechniciansResponse,
} from "../../../hooks/useTechnicians";

// In-memory storage for test data
let technicians: Technician[] = [];
let locationHistory: Record<string, TechnicianLocation[]> = {};
let nextTechnicianId = 1;

// Reset storage between tests
export function resetTechniciansStorage() {
  technicians = [];
  locationHistory = {};
  nextTechnicianId = 1;
}

// Helper to create a technician
export function createMockTechnician(overrides?: Partial<Technician>): Technician {
  const id = `tech-${nextTechnicianId++}`;
  return {
    id,
    tenant_id: "tenant-1",
    employee_id: `EMP-${String(nextTechnicianId).padStart(3, "0")}`,
    first_name: "John",
    last_name: "Smith",
    email: `tech${nextTechnicianId}@example.com`,
    phone: "+1234567890",
    mobile: "+1234567891",
    status: "available",
    skill_level: "intermediate",
    home_base_lat: 40.7128,
    home_base_lng: -74.006,
    home_base_address: "123 Main St, New York, NY 10001",
    current_lat: 40.7128,
    current_lng: -74.006,
    last_location_update: new Date().toISOString(),
    service_areas: ["New York", "Brooklyn"],
    working_hours_start: "09:00",
    working_hours_end: "17:00",
    working_days: [1, 2, 3, 4, 5],
    is_on_call: false,
    available_for_emergency: true,
    skills: {
      fiber_splicing: true,
      installation: true,
      troubleshooting: true,
    },
    certifications: [{ name: "Fiber Optics Certified", expires: "2025-12-31" }],
    equipment: {
      van: true,
      tools: ["splicing_kit", "otdr", "power_meter"],
    },
    jobs_completed: 150,
    average_rating: 4.5,
    completion_rate: 95.5,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create a technician location
export function createMockTechnicianLocation(
  technicianId: string,
  overrides?: Partial<TechnicianLocation>,
): TechnicianLocation {
  return {
    technician_id: technicianId,
    technician_name: "John Smith",
    latitude: 40.7128,
    longitude: -74.006,
    last_update: new Date().toISOString(),
    status: "available",
    ...overrides,
  };
}

// Helper to seed initial data
export function seedTechniciansData(techniciansData: Technician[]) {
  technicians = [...techniciansData];
}

// Helper to seed location history
export function seedLocationHistory(technicianId: string, locations: TechnicianLocation[]) {
  locationHistory[technicianId] = locations;
}

export const techniciansHandlers = [
  // GET /field-service/technicians - List technicians
  http.get("*/field-service/technicians", ({ request, params }) => {
    const url = new URL(request.url);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const status = url.searchParams.get("status");
    const isActive = url.searchParams.get("is_active");

    console.log("[MSW] GET /field-service/technicians", {
      offset,
      limit,
      status,
      isActive,
      totalTechnicians: technicians.length,
    });

    let filtered = technicians;

    // Filter by status
    if (status) {
      filtered = filtered.filter((tech) => tech.status === status);
    }

    // Filter by is_active
    if (isActive !== null) {
      const isActiveFlag = isActive === "true";
      filtered = filtered.filter((tech) => tech.is_active === isActiveFlag);
    }

    // Paginate
    const start = offset;
    const end = offset + limit;
    const paginated = filtered.slice(start, end);

    console.log("[MSW] Returning", paginated.length, "technicians");

    // Return in the format expected by the hook
    const response: TechniciansResponse = {
      technicians: paginated,
      total: filtered.length,
      limit,
      offset,
    };

    return HttpResponse.json(response);
  }),

  // GET /field-service/technicians/locations/active - Get active technician locations
  http.get("*/field-service/technicians/locations/active", ({ request, params }) => {
    console.log("[MSW] GET /field-service/technicians/locations/active");

    // Return locations for all active technicians with valid coordinates
    const activeLocations: TechnicianLocation[] = technicians
      .filter((tech) => tech.is_active && tech.current_lat !== null && tech.current_lng !== null)
      .map((tech) => ({
        technician_id: tech.id,
        technician_name: `${tech.first_name} ${tech.last_name}`,
        latitude: tech.current_lat!,
        longitude: tech.current_lng!,
        last_update: tech.last_location_update || null,
        status: tech.status,
      }));

    return HttpResponse.json(activeLocations);
  }),

  // GET /field-service/technicians/:id/location-history - Get technician location history
  http.get("*/field-service/technicians/:id/location-history", ({ request, params }) => {
    const { id } = params;
    const url = new URL(request.url);
    const startTime = url.searchParams.get("start_time");
    const endTime = url.searchParams.get("end_time");
    const limit = parseInt(url.searchParams.get("limit") || "100");

    console.log("[MSW] GET /field-service/technicians/:id/location-history", {
      id,
      startTime,
      endTime,
      limit,
    });

    // Get location history for this technician
    let history = locationHistory[id as string] || [];

    // Filter by time range if provided
    if (startTime) {
      const start = new Date(startTime);
      history = history.filter((loc) => loc.last_update && new Date(loc.last_update) >= start);
    }

    if (endTime) {
      const end = new Date(endTime);
      history = history.filter((loc) => loc.last_update && new Date(loc.last_update) <= end);
    }

    // Limit results
    const limited = history.slice(0, limit);

    return HttpResponse.json(limited);
  }),

  // GET /field-service/technicians/:id - Get single technician
  http.get("*/field-service/technicians/:id", ({ request, params }) => {
    const { id } = params;

    console.log("[MSW] GET /field-service/technicians/:id", { id });

    const technician = technicians.find((tech) => tech.id === id);

    if (!technician) {
      return HttpResponse.json(
        { error: "Technician not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    return HttpResponse.json(technician);
  }),

  // POST /field-service/technicians - Create technician
  http.post("*/field-service/technicians", async ({ request, params }) => {
    const data = await request.json();

    console.log("[MSW] POST /field-service/technicians", data);

    const newTechnician = createMockTechnician({
      ...data,
      id: `tech-${nextTechnicianId}`,
    });

    technicians.push(newTechnician);

    return HttpResponse.json(newTechnician, { status: 201 });
  }),

  // PATCH /field-service/technicians/:id - Update technician
  http.patch("*/field-service/technicians/:id", async ({ request, params }) => {
    const { id } = params;
    const updates = await request.json();

    console.log("[MSW] PATCH /field-service/technicians/:id", { id, updates });

    const index = technicians.findIndex((tech) => tech.id === id);

    if (index === -1) {
      return HttpResponse.json(
        { error: "Technician not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    technicians[index] = {
      ...technicians[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(technicians[index]);
  }),

  // DELETE /field-service/technicians/:id - Delete technician
  http.delete("*/field-service/technicians/:id", ({ request, params }) => {
    const { id } = params;

    console.log("[MSW] DELETE /field-service/technicians/:id", { id });

    const index = technicians.findIndex((tech) => tech.id === id);

    if (index === -1) {
      return HttpResponse.json(
        { error: "Technician not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    technicians.splice(index, 1);

    return new HttpResponse(null, { status: 204 });
  }),

  // POST /field-service/technicians/:id/status - Update technician status
  http.post("*/field-service/technicians/:id/status", async ({ request, params }) => {
    const { id } = params;
    const data = await request.json();

    console.log("[MSW] POST /field-service/technicians/:id/status", { id, data });

    const index = technicians.findIndex((tech) => tech.id === id);

    if (index === -1) {
      return HttpResponse.json(
        { error: "Technician not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    technicians[index].status = data.status;
    technicians[index].updated_at = new Date().toISOString();

    return HttpResponse.json(technicians[index]);
  }),

  // POST /field-service/technicians/:id/location - Update technician location
  http.post("*/field-service/technicians/:id/location", async ({ request, params }) => {
    const { id } = params;
    const data = await request.json();

    console.log("[MSW] POST /field-service/technicians/:id/location", { id, data });

    const index = technicians.findIndex((tech) => tech.id === id);

    if (index === -1) {
      return HttpResponse.json(
        { error: "Technician not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    technicians[index].current_lat = data.latitude;
    technicians[index].current_lng = data.longitude;
    technicians[index].last_location_update = new Date().toISOString();
    technicians[index].updated_at = new Date().toISOString();

    // Add to location history
    if (!locationHistory[id as string]) {
      locationHistory[id as string] = [];
    }
    locationHistory[id as string].push(
      createMockTechnicianLocation(id as string, {
        latitude: data.latitude,
        longitude: data.longitude,
        last_update: new Date().toISOString(),
      }),
    );

    return HttpResponse.json(technicians[index]);
  }),

  // GET /field-service/technicians/available - Get available technicians
  http.get("*/field-service/technicians/available", ({ request, params }) => {
    const url = new URL(request.url);
    const skillLevel = url.searchParams.get("skill_level");
    const serviceArea = url.searchParams.get("service_area");

    console.log("[MSW] GET /field-service/technicians/available", {
      skillLevel,
      serviceArea,
    });

    let filtered = technicians.filter((tech) => tech.status === "available" && tech.is_active);

    // Filter by skill level
    if (skillLevel) {
      filtered = filtered.filter((tech) => tech.skill_level === skillLevel);
    }

    // Filter by service area
    if (serviceArea) {
      filtered = filtered.filter(
        (tech) => tech.service_areas && tech.service_areas.includes(serviceArea),
      );
    }

    return HttpResponse.json(filtered);
  }),

  // POST /field-service/technicians/:id/assign - Assign technician to job
  http.post("*/field-service/technicians/:id/assign", async ({ request, params }) => {
    const { id } = params;
    const data = await request.json();

    console.log("[MSW] POST /field-service/technicians/:id/assign", { id, data });

    const index = technicians.findIndex((tech) => tech.id === id);

    if (index === -1) {
      return HttpResponse.json(
        { error: "Technician not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    // Check if technician is available
    if (technicians[index].status !== "available") {
      return HttpResponse.json(
        { error: "Technician is not available", code: "NOT_AVAILABLE" },
        { status: 400 },
      );
    }

    technicians[index].status = "on_job";
    technicians[index].updated_at = new Date().toISOString();

    return HttpResponse.json({
      success: true,
      message: "Technician assigned successfully",
      job_id: data.job_id,
      technician: technicians[index],
    });
  }),

  // POST /field-service/technicians/:id/unassign - Unassign technician from job
  http.post("*/field-service/technicians/:id/unassign", async ({ request, params }) => {
    const { id } = params;

    console.log("[MSW] POST /field-service/technicians/:id/unassign", { id });

    const index = technicians.findIndex((tech) => tech.id === id);

    if (index === -1) {
      return HttpResponse.json(
        { error: "Technician not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    technicians[index].status = "available";
    technicians[index].updated_at = new Date().toISOString();

    return HttpResponse.json({
      success: true,
      message: "Technician unassigned successfully",
      technician: technicians[index],
    });
  }),

  // GET /field-service/technicians/:id/schedule - Get technician schedule
  http.get("*/field-service/technicians/:id/schedule", ({ request, params }) => {
    const { id } = params;
    const url = new URL(request.url);
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");

    console.log("[MSW] GET /field-service/technicians/:id/schedule", {
      id,
      startDate,
      endDate,
    });

    const technician = technicians.find((tech) => tech.id === id);

    if (!technician) {
      return HttpResponse.json(
        { error: "Technician not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    // Return mock schedule
    const schedule = {
      technician_id: id,
      working_hours_start: technician.working_hours_start,
      working_hours_end: technician.working_hours_end,
      working_days: technician.working_days,
      is_on_call: technician.is_on_call,
      assignments: [],
    };

    return HttpResponse.json(schedule);
  }),
];
