/**
 * Field Service Management React Query Hooks
 * Hooks for technicians, scheduling, time tracking, and resource management
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Technician,
  TechnicianSchedule,
  TaskAssignment,
  TimeEntry,
  LaborRate,
  TimesheetPeriod,
  Equipment,
  Vehicle,
  ResourceAssignment,
  AssignmentCandidate,
  TechnicianListResponse,
  ScheduleListResponse,
  AssignmentListResponse,
  TimeEntryListResponse,
  EquipmentListResponse,
  VehicleListResponse,
  AssignmentCandidatesResponse,
  ClockInData,
  ClockOutData,
  CreateAssignmentData,
  AutoAssignmentData,
  CreateScheduleData,
  AssignResourceData,
  ReturnResourceData,
  TechnicianFilter,
  ScheduleFilter,
  AssignmentFilter,
  TimeEntryFilter,
  ResourceFilter,
} from "@/types/field-service";

// ============================================================================
// API Base URLs
// ============================================================================

const TECHNICIAN_API = "/api/v1/field-service/technicians";
const SCHEDULING_API = "/api/v1/scheduling";
const TIME_API = "/api/v1/time";
const RESOURCES_API = "/api/v1/resources";

// ============================================================================
// Helper Functions
// ============================================================================

const buildQueryParams = (filter?: Record<string, any>): string => {
  if (!filter) return "";
  const params = new URLSearchParams();
  Object.entries(filter).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        params.append(key, value.join(","));
      } else {
        params.append(key, String(value));
      }
    }
  });
  return params.toString();
};

const fetchJSON = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};

// ============================================================================
// Technician API Functions
// ============================================================================

const fetchTechnicians = async (filter?: TechnicianFilter): Promise<TechnicianListResponse> => {
  const params = buildQueryParams(filter);
  return fetchJSON(`${TECHNICIAN_API}?${params}`);
};

const fetchTechnician = async (id: string): Promise<Technician> => {
  return fetchJSON(`${TECHNICIAN_API}/${id}`);
};

const createTechnician = async (data: Partial<Technician>): Promise<Technician> => {
  return fetchJSON(TECHNICIAN_API, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

const updateTechnician = async (id: string, data: Partial<Technician>): Promise<Technician> => {
  return fetchJSON(`${TECHNICIAN_API}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

// ============================================================================
// Scheduling API Functions
// ============================================================================

const fetchSchedules = async (filter?: ScheduleFilter): Promise<ScheduleListResponse> => {
  const params = buildQueryParams(filter);
  return fetchJSON(`${SCHEDULING_API}/technicians/schedules?${params}`);
};

const fetchSchedule = async (id: string): Promise<TechnicianSchedule> => {
  return fetchJSON(`${SCHEDULING_API}/schedules/${id}`);
};

const createSchedule = async (data: CreateScheduleData): Promise<TechnicianSchedule> => {
  return fetchJSON(`${SCHEDULING_API}/technicians/${data.technicianId}/schedules`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

const updateSchedule = async (id: string, data: Partial<TechnicianSchedule>): Promise<TechnicianSchedule> => {
  return fetchJSON(`${SCHEDULING_API}/schedules/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

const fetchAssignments = async (filter?: AssignmentFilter): Promise<AssignmentListResponse> => {
  const params = buildQueryParams(filter);
  return fetchJSON(`${SCHEDULING_API}/assignments?${params}`);
};

const fetchAssignment = async (id: string): Promise<TaskAssignment> => {
  return fetchJSON(`${SCHEDULING_API}/assignments/${id}`);
};

const createAssignment = async (data: CreateAssignmentData): Promise<TaskAssignment> => {
  return fetchJSON(`${SCHEDULING_API}/assignments`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

const autoAssignTask = async (data: AutoAssignmentData): Promise<TaskAssignment> => {
  return fetchJSON(`${SCHEDULING_API}/assignments/auto-assign`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

const fetchCandidates = async (assignmentId: string): Promise<AssignmentCandidatesResponse> => {
  return fetchJSON(`${SCHEDULING_API}/assignments/${assignmentId}/candidates`);
};

const cancelAssignment = async (id: string, reason?: string): Promise<void> => {
  await fetchJSON(`${SCHEDULING_API}/assignments/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ reason }),
  });
};

const rescheduleAssignment = async (id: string, data: { scheduledStart: string; scheduledEnd: string; reason?: string }): Promise<TaskAssignment> => {
  return fetchJSON(`${SCHEDULING_API}/assignments/${id}/reschedule`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

// ============================================================================
// Time Tracking API Functions
// ============================================================================

const clockIn = async (data: ClockInData): Promise<TimeEntry> => {
  return fetchJSON(`${TIME_API}/clock-in`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

const clockOut = async (entryId: string, data: ClockOutData): Promise<TimeEntry> => {
  return fetchJSON(`${TIME_API}/entries/${entryId}/clock-out`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

const fetchTimeEntries = async (filter?: TimeEntryFilter): Promise<TimeEntryListResponse> => {
  const params = buildQueryParams(filter);
  return fetchJSON(`${TIME_API}/entries?${params}`);
};

const fetchTimeEntry = async (id: string): Promise<TimeEntry> => {
  return fetchJSON(`${TIME_API}/entries/${id}`);
};

const submitTimeEntry = async (id: string): Promise<TimeEntry> => {
  return fetchJSON(`${TIME_API}/entries/${id}/submit`, {
    method: "POST",
  });
};

const approveTimeEntry = async (id: string): Promise<TimeEntry> => {
  return fetchJSON(`${TIME_API}/entries/${id}/approve`, {
    method: "POST",
  });
};

const rejectTimeEntry = async (id: string, reason: string): Promise<TimeEntry> => {
  return fetchJSON(`${TIME_API}/entries/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
};

const fetchLaborRates = async (): Promise<LaborRate[]> => {
  return fetchJSON(`${TIME_API}/labor-rates`);
};

const fetchTimesheetPeriods = async (): Promise<TimesheetPeriod[]> => {
  return fetchJSON(`${TIME_API}/timesheet-periods`);
};

// ============================================================================
// Resource Management API Functions
// ============================================================================

const fetchEquipment = async (filter?: ResourceFilter): Promise<EquipmentListResponse> => {
  const params = buildQueryParams(filter);
  return fetchJSON(`${RESOURCES_API}/equipment?${params}`);
};

const fetchEquipmentItem = async (id: string): Promise<Equipment> => {
  return fetchJSON(`${RESOURCES_API}/equipment/${id}`);
};

const createEquipment = async (data: Partial<Equipment>): Promise<Equipment> => {
  return fetchJSON(`${RESOURCES_API}/equipment`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

const updateEquipment = async (id: string, data: Partial<Equipment>): Promise<Equipment> => {
  return fetchJSON(`${RESOURCES_API}/equipment/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

const fetchVehicles = async (filter?: ResourceFilter): Promise<VehicleListResponse> => {
  const params = buildQueryParams(filter);
  return fetchJSON(`${RESOURCES_API}/vehicles?${params}`);
};

const fetchVehicle = async (id: string): Promise<Vehicle> => {
  return fetchJSON(`${RESOURCES_API}/vehicles/${id}`);
};

const createVehicle = async (data: Partial<Vehicle>): Promise<Vehicle> => {
  return fetchJSON(`${RESOURCES_API}/vehicles`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

const updateVehicle = async (id: string, data: Partial<Vehicle>): Promise<Vehicle> => {
  return fetchJSON(`${RESOURCES_API}/vehicles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

const assignResource = async (data: AssignResourceData): Promise<ResourceAssignment> => {
  return fetchJSON(`${RESOURCES_API}/assignments`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

const returnResource = async (assignmentId: string, data: ReturnResourceData): Promise<ResourceAssignment> => {
  return fetchJSON(`${RESOURCES_API}/assignments/${assignmentId}/return`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

const fetchResourceAssignments = async (technicianId?: string): Promise<ResourceAssignment[]> => {
  const params = technicianId ? `?technicianId=${technicianId}` : "";
  return fetchJSON(`${RESOURCES_API}/assignments${params}`);
};

// ============================================================================
// React Query Hooks - Technicians
// ============================================================================

export const useTechnicians = (filter?: TechnicianFilter) => {
  return useQuery({
    queryKey: ["technicians", filter],
    queryFn: () => fetchTechnicians(filter),
    staleTime: 30000,
  });
};

export const useTechnician = (id: string) => {
  return useQuery({
    queryKey: ["technician", id],
    queryFn: () => fetchTechnician(id),
    enabled: !!id,
  });
};

export const useCreateTechnician = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTechnician,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technicians"] });
    },
  });
};

export const useUpdateTechnician = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Technician> }) => updateTechnician(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["technicians"] });
      queryClient.invalidateQueries({ queryKey: ["technician", variables.id] });
    },
  });
};

// ============================================================================
// React Query Hooks - Scheduling
// ============================================================================

export const useSchedules = (filter?: ScheduleFilter) => {
  return useQuery({
    queryKey: ["schedules", filter],
    queryFn: () => fetchSchedules(filter),
    staleTime: 10000,
  });
};

export const useSchedule = (id: string) => {
  return useQuery({
    queryKey: ["schedule", id],
    queryFn: () => fetchSchedule(id),
    enabled: !!id,
  });
};

export const useCreateSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });
};

export const useUpdateSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TechnicianSchedule> }) => updateSchedule(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["schedule", variables.id] });
    },
  });
};

export const useAssignments = (filter?: AssignmentFilter) => {
  return useQuery({
    queryKey: ["assignments", filter],
    queryFn: () => fetchAssignments(filter),
    staleTime: 10000,
  });
};

export const useAssignment = (id: string) => {
  return useQuery({
    queryKey: ["assignment", id],
    queryFn: () => fetchAssignment(id),
    enabled: !!id,
  });
};

export const useCreateAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAssignment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });
};

export const useAutoAssignTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: autoAssignTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });
};

export const useAssignmentCandidates = (assignmentId: string) => {
  return useQuery({
    queryKey: ["assignment-candidates", assignmentId],
    queryFn: () => fetchCandidates(assignmentId),
    enabled: !!assignmentId,
  });
};

export const useCancelAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => cancelAssignment(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });
};

export const useRescheduleAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { scheduledStart: string; scheduledEnd: string; reason?: string } }) =>
      rescheduleAssignment(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assignment", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });
};

// ============================================================================
// React Query Hooks - Time Tracking
// ============================================================================

export const useClockIn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clockIn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
    },
  });
};

export const useClockOut = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ClockOutData }) => clockOut(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
    },
  });
};

export const useTimeEntries = (filter?: TimeEntryFilter) => {
  return useQuery({
    queryKey: ["time-entries", filter],
    queryFn: () => fetchTimeEntries(filter),
    staleTime: 10000,
  });
};

export const useTimeEntry = (id: string) => {
  return useQuery({
    queryKey: ["time-entry", id],
    queryFn: () => fetchTimeEntry(id),
    enabled: !!id,
  });
};

export const useSubmitTimeEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitTimeEntry,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["time-entry", id] });
    },
  });
};

export const useApproveTimeEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: approveTimeEntry,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["time-entry", id] });
    },
  });
};

export const useRejectTimeEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectTimeEntry(id, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["time-entry", variables.id] });
    },
  });
};

export const useLaborRates = () => {
  return useQuery({
    queryKey: ["labor-rates"],
    queryFn: fetchLaborRates,
    staleTime: 300000, // 5 minutes
  });
};

export const useTimesheetPeriods = () => {
  return useQuery({
    queryKey: ["timesheet-periods"],
    queryFn: fetchTimesheetPeriods,
    staleTime: 60000, // 1 minute
  });
};

// ============================================================================
// React Query Hooks - Resources
// ============================================================================

export const useEquipment = (filter?: ResourceFilter) => {
  return useQuery({
    queryKey: ["equipment", filter],
    queryFn: () => fetchEquipment(filter),
    staleTime: 30000,
  });
};

export const useEquipmentItem = (id: string) => {
  return useQuery({
    queryKey: ["equipment-item", id],
    queryFn: () => fetchEquipmentItem(id),
    enabled: !!id,
  });
};

export const useCreateEquipment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createEquipment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
    },
  });
};

export const useUpdateEquipment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Equipment> }) => updateEquipment(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      queryClient.invalidateQueries({ queryKey: ["equipment-item", variables.id] });
    },
  });
};

export const useVehicles = (filter?: ResourceFilter) => {
  return useQuery({
    queryKey: ["vehicles", filter],
    queryFn: () => fetchVehicles(filter),
    staleTime: 30000,
  });
};

export const useVehicle = (id: string) => {
  return useQuery({
    queryKey: ["vehicle", id],
    queryFn: () => fetchVehicle(id),
    enabled: !!id,
  });
};

export const useCreateVehicle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createVehicle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
};

export const useUpdateVehicle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Vehicle> }) => updateVehicle(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle", variables.id] });
    },
  });
};

export const useAssignResource = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: assignResource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
};

export const useReturnResource = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReturnResourceData }) => returnResource(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
};

export const useResourceAssignments = (technicianId?: string) => {
  return useQuery({
    queryKey: ["resource-assignments", technicianId],
    queryFn: () => fetchResourceAssignments(technicianId),
    staleTime: 10000,
  });
};
