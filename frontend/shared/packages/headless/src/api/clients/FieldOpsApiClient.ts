/**
 * Field Operations API Client
 * Handles technician dispatch, work orders, and field service management
 */

import { BaseApiClient } from "./BaseApiClient";
import type { PaginatedResponse, QueryParams, AddressData } from "../types/api";

export interface Technician {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  phone: string;
  status: "AVAILABLE" | "BUSY" | "ON_BREAK" | "OFF_DUTY" | "UNAVAILABLE";
  skills: TechnicianSkill[];
  certifications: Certification[];
  territories: string[];
  current_location?: GeoLocation;
  truck_inventory?: string[];
  shift_start?: string;
  shift_end?: string;
  created_at: string;
  updated_at: string;
}

export interface TechnicianSkill {
  skill_id: string;
  skill_name: string;
  proficiency_level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";
  certified: boolean;
  certification_date?: string;
}

export interface Certification {
  id: string;
  name: string;
  issuing_authority: string;
  issue_date: string;
  expiry_date?: string;
  status: "VALID" | "EXPIRED" | "SUSPENDED";
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  address?: string;
}

export interface FieldWorkOrder {
  id: string;
  work_order_number: string;
  type:
    | "INSTALLATION"
    | "MAINTENANCE"
    | "REPAIR"
    | "UPGRADE"
    | "DISCONNECT"
    | "SURVEY"
    | "EMERGENCY";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | "EMERGENCY";
  status:
    | "CREATED"
    | "SCHEDULED"
    | "ASSIGNED"
    | "EN_ROUTE"
    | "ON_SITE"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED";
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  service_address: AddressData;
  description: string;
  special_instructions?: string;
  estimated_duration: number;
  scheduled_start: string;
  scheduled_end: string;
  assigned_technician?: TechnicianAssignment;
  required_skills: string[];
  required_equipment: EquipmentRequirement[];
  completion_notes?: string;
  customer_signature?: string;
  photos?: WorkOrderPhoto[];
  created_at: string;
  updated_at: string;
}

export interface TechnicianAssignment {
  technician_id: string;
  technician_name: string;
  assigned_at: string;
  accepted_at?: string;
  started_at?: string;
  completed_at?: string;
  travel_time?: number;
  on_site_time?: number;
}

export interface EquipmentRequirement {
  item_sku: string;
  quantity: number;
  required: boolean;
  alternatives?: string[];
  assigned_items?: string[];
}

export interface WorkOrderPhoto {
  id: string;
  url: string;
  caption?: string;
  photo_type: "BEFORE" | "AFTER" | "PROBLEM" | "SOLUTION" | "DOCUMENTATION";
  uploaded_at: string;
}

export interface Route {
  id: string;
  technician_id: string;
  date: string;
  work_orders: RouteStop[];
  optimized: boolean;
  total_distance: number;
  estimated_duration: number;
  status: "PLANNED" | "ACTIVE" | "COMPLETED";
  created_at: string;
}

export interface RouteStop {
  work_order_id: string;
  sequence: number;
  estimated_arrival: string;
  actual_arrival?: string;
  estimated_departure: string;
  actual_departure?: string;
  travel_time_to_next?: number;
  distance_to_next?: number;
}

export interface TimeEntry {
  id: string;
  technician_id: string;
  work_order_id?: string;
  entry_type: "WORK" | "TRAVEL" | "BREAK" | "TRAINING" | "ADMIN" | "OVERTIME";
  start_time: string;
  end_time?: string;
  duration?: number;
  description?: string;
  location?: GeoLocation;
  billable: boolean;
  approved: boolean;
}

export interface ServiceCall {
  id: string;
  call_number: string;
  customer_id: string;
  customer_name: string;
  call_type: "TECHNICAL_SUPPORT" | "SERVICE_REQUEST" | "COMPLAINT" | "EMERGENCY";
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  resolution_required: boolean;
  estimated_resolution_time?: number;
  assigned_technician?: string;
  status: "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  created_at: string;
  resolved_at?: string;
}

export class FieldOpsApiClient extends BaseApiClient {
  constructor(baseURL: string, defaultHeaders: Record<string, string> = {}) {
    super(baseURL, defaultHeaders);
  }

  // Technicians
  async getTechnicians(params?: QueryParams): Promise<PaginatedResponse<Technician>> {
    return this.get("/api/field-ops/technicians", { params });
  }

  async getTechnician(technicianId: string): Promise<{ data: Technician }> {
    return this.get(`/api/field-ops/technicians/${technicianId}`);
  }

  async createTechnician(
    data: Omit<Technician, "id" | "created_at" | "updated_at">,
  ): Promise<{ data: Technician }> {
    return this.post("/api/field-ops/technicians", data);
  }

  async updateTechnician(
    technicianId: string,
    data: Partial<Technician>,
  ): Promise<{ data: Technician }> {
    return this.put(`/api/field-ops/technicians/${technicianId}`, data);
  }

  async updateTechnicianStatus(
    technicianId: string,
    status: Technician["status"],
  ): Promise<{ data: Technician }> {
    return this.put(`/api/field-ops/technicians/${technicianId}/status`, {
      status,
    });
  }

  async updateTechnicianLocation(
    technicianId: string,
    location: GeoLocation,
  ): Promise<{ data: Technician }> {
    return this.put(`/api/field-ops/technicians/${technicianId}/location`, location);
  }

  async getAvailableTechnicians(params?: {
    skills?: string[];
    territory?: string;
    date?: string;
    time_range?: { start: string; end: string };
  }): Promise<{ data: Technician[] }> {
    return this.get("/api/field-ops/technicians/available", { params });
  }

  // Work Orders
  async getWorkOrders(params?: QueryParams): Promise<PaginatedResponse<FieldWorkOrder>> {
    return this.get("/api/field-ops/work-orders", { params });
  }

  async getWorkOrder(workOrderId: string): Promise<{ data: FieldWorkOrder }> {
    return this.get(`/api/field-ops/work-orders/${workOrderId}`);
  }

  async createWorkOrder(
    data: Omit<FieldWorkOrder, "id" | "work_order_number" | "status" | "created_at" | "updated_at">,
  ): Promise<{ data: FieldWorkOrder }> {
    return this.post("/api/field-ops/work-orders", data);
  }

  async updateWorkOrder(
    workOrderId: string,
    data: Partial<FieldWorkOrder>,
  ): Promise<{ data: FieldWorkOrder }> {
    return this.put(`/api/field-ops/work-orders/${workOrderId}`, data);
  }

  async assignWorkOrder(
    workOrderId: string,
    technicianId: string,
    notes?: string,
  ): Promise<{ data: FieldWorkOrder }> {
    return this.post(`/api/field-ops/work-orders/${workOrderId}/assign`, {
      technician_id: technicianId,
      notes,
    });
  }

  async acceptWorkOrder(
    workOrderId: string,
    technicianId: string,
  ): Promise<{ data: FieldWorkOrder }> {
    return this.post(`/api/field-ops/work-orders/${workOrderId}/accept`, {
      technician_id: technicianId,
    });
  }

  async startWorkOrder(
    workOrderId: string,
    location?: GeoLocation,
  ): Promise<{ data: FieldWorkOrder }> {
    return this.post(`/api/field-ops/work-orders/${workOrderId}/start`, {
      location,
    });
  }

  async completeWorkOrder(
    workOrderId: string,
    data: {
      completion_notes: string;
      customer_signature?: string;
      equipment_used?: string[];
      time_spent: number;
      location?: GeoLocation;
    },
  ): Promise<{ data: FieldWorkOrder }> {
    return this.post(`/api/field-ops/work-orders/${workOrderId}/complete`, data);
  }

  async cancelWorkOrder(workOrderId: string, reason: string): Promise<{ data: FieldWorkOrder }> {
    return this.post(`/api/field-ops/work-orders/${workOrderId}/cancel`, {
      reason,
    });
  }

  // Work Order Photos
  async uploadWorkOrderPhoto(
    workOrderId: string,
    file: File,
    photoType: WorkOrderPhoto["photo_type"],
    caption?: string,
  ): Promise<{ data: WorkOrderPhoto }> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("photo_type", photoType);
    if (caption) formData.append("caption", caption);

    const response = await fetch(
      `${this.baseURL}/api/field-ops/work-orders/${workOrderId}/photos`,
      {
        method: "POST",
        headers: this.defaultHeaders,
        body: formData,
      },
    );

    if (!response.ok) {
      throw new Error(`Photo upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  async deleteWorkOrderPhoto(workOrderId: string, photoId: string): Promise<{ success: boolean }> {
    return this.delete(`/api/field-ops/work-orders/${workOrderId}/photos/${photoId}`);
  }

  // Routing & Scheduling
  async createRoute(
    technicianId: string,
    date: string,
    workOrderIds: string[],
  ): Promise<{ data: Route }> {
    return this.post("/api/field-ops/routes", {
      technician_id: technicianId,
      date,
      work_order_ids: workOrderIds,
    });
  }

  async optimizeRoute(routeId: string): Promise<{ data: Route }> {
    return this.post(`/api/field-ops/routes/${routeId}/optimize`, {});
  }

  async getTechnicianRoute(technicianId: string, date: string): Promise<{ data: Route | null }> {
    return this.get(`/api/field-ops/technicians/${technicianId}/route`, {
      params: { date },
    });
  }

  async updateRouteStop(
    routeId: string,
    stopId: string,
    data: Partial<RouteStop>,
  ): Promise<{ data: RouteStop }> {
    return this.put(`/api/field-ops/routes/${routeId}/stops/${stopId}`, data);
  }

  // Time Tracking
  async startTimeEntry(
    data: Omit<TimeEntry, "id" | "end_time" | "duration">,
  ): Promise<{ data: TimeEntry }> {
    return this.post("/api/field-ops/time-entries", data);
  }

  async endTimeEntry(
    timeEntryId: string,
    endTime: string,
    location?: GeoLocation,
  ): Promise<{ data: TimeEntry }> {
    return this.put(`/api/field-ops/time-entries/${timeEntryId}/end`, {
      end_time: endTime,
      location,
    });
  }

  async getTechnicianTimeEntries(
    technicianId: string,
    params?: {
      start_date?: string;
      end_date?: string;
      entry_type?: string;
    },
  ): Promise<PaginatedResponse<TimeEntry>> {
    return this.get(`/api/field-ops/technicians/${technicianId}/time-entries`, {
      params,
    });
  }

  async approveTimeEntries(
    timeEntryIds: string[],
  ): Promise<{ data: { approved: number; rejected: number } }> {
    return this.post("/api/field-ops/time-entries/approve", {
      time_entry_ids: timeEntryIds,
    });
  }

  // Service Calls
  async getServiceCalls(params?: QueryParams): Promise<PaginatedResponse<ServiceCall>> {
    return this.get("/api/field-ops/service-calls", { params });
  }

  async createServiceCall(
    data: Omit<ServiceCall, "id" | "call_number" | "status" | "created_at">,
  ): Promise<{ data: ServiceCall }> {
    return this.post("/api/field-ops/service-calls", data);
  }

  async assignServiceCall(callId: string, technicianId: string): Promise<{ data: ServiceCall }> {
    return this.post(`/api/field-ops/service-calls/${callId}/assign`, {
      technician_id: technicianId,
    });
  }

  async escalateServiceCall(
    callId: string,
    reason: string,
    escalateTo: string,
  ): Promise<{ data: ServiceCall }> {
    return this.post(`/api/field-ops/service-calls/${callId}/escalate`, {
      reason,
      escalate_to: escalateTo,
    });
  }

  async resolveServiceCall(callId: string, resolution: string): Promise<{ data: ServiceCall }> {
    return this.post(`/api/field-ops/service-calls/${callId}/resolve`, {
      resolution,
    });
  }

  // Analytics & Reporting
  async getTechnicianPerformance(
    technicianId: string,
    params?: {
      start_date?: string;
      end_date?: string;
    },
  ): Promise<{
    data: {
      work_orders_completed: number;
      average_completion_time: number;
      customer_satisfaction: number;
      efficiency_rating: number;
      on_time_percentage: number;
    };
  }> {
    return this.get(`/api/field-ops/technicians/${technicianId}/performance`, {
      params,
    });
  }

  async getFieldOpsMetrics(params?: {
    start_date?: string;
    end_date?: string;
    territory?: string;
  }): Promise<{
    data: {
      total_work_orders: number;
      completed_work_orders: number;
      average_resolution_time: number;
      first_time_fix_rate: number;
      technician_utilization: number;
      customer_satisfaction: number;
    };
  }> {
    return this.get("/api/field-ops/metrics", { params });
  }

  async getDispatchMetrics(date: string): Promise<{
    data: {
      scheduled_appointments: number;
      completed_appointments: number;
      cancelled_appointments: number;
      emergency_calls: number;
      technicians_active: number;
      average_travel_time: number;
    };
  }> {
    return this.get("/api/field-ops/dispatch/metrics", { params: { date } });
  }

  // Emergency & Priority Services
  async createEmergencyWorkOrder(data: {
    customer_id: string;
    description: string;
    location: AddressData;
    contact_phone: string;
    severity: "MINOR" | "MAJOR" | "CRITICAL";
  }): Promise<{ data: FieldWorkOrder }> {
    return this.post("/api/field-ops/emergency/work-order", data);
  }

  async dispatchNearestTechnician(
    location: GeoLocation,
    skills?: string[],
  ): Promise<{
    data: {
      technician: Technician;
      estimated_arrival: string;
      distance: number;
    };
  }> {
    return this.post("/api/field-ops/dispatch/nearest", { location, skills });
  }

  async broadcastUrgentCall(data: {
    message: string;
    location: GeoLocation;
    skills_required?: string[];
    max_distance?: number;
  }): Promise<{ data: { technicians_notified: number } }> {
    return this.post("/api/field-ops/broadcast/urgent", data);
  }
}
