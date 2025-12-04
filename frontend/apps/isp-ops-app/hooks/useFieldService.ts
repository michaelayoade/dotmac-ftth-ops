/**
 * Field Service Management React Query Hooks
 * Hooks for technicians, scheduling, time tracking, and resource management
 */

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppConfig } from "@/providers/AppConfigContext";
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
import { AssignmentStatus } from "@/types/field-service";

// ============================================================================
// API Base URLs
// ============================================================================

const TECHNICIAN_API = "/field-service/technicians";
const SCHEDULING_API = "/scheduling";
const TIME_API = "/time";
const RESOURCES_API = "/resources";

const createApiBuilder = (api: {
  baseUrl?: string;
  prefix?: string;
  buildUrl?: (path: string) => string;
  buildPath?: (path: string) => string;
}) => {
  if (typeof api.buildPath === "function") {
    return api.buildPath;
  }
  if (typeof api.buildUrl === "function") {
    return api.buildUrl;
  }
  return (path: string) => {
    const base = api.baseUrl || "";
    const prefix = api.prefix || "";
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${base}${prefix}${normalizedPath}`;
  };
};

const useFieldServiceApi = () => {
  const { api } = useAppConfig();
  const buildUrl = useMemo(
    () => createApiBuilder(api),
    [api.baseUrl, api.prefix, api.buildUrl, api.buildPath],
  );
  return { api, buildUrl };
};

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

const fetchTechnicians = async (
  buildUrl: (path: string) => string,
  filter?: TechnicianFilter,
): Promise<TechnicianListResponse> => {
  const params = buildQueryParams(filter);
  return fetchJSON(`${buildUrl(TECHNICIAN_API)}?${params}`);
};

const fetchTechnician = async (
  buildUrl: (path: string) => string,
  id: string,
): Promise<Technician> => {
  return fetchJSON(`${buildUrl(TECHNICIAN_API)}/${id}`);
};

const createTechnician = async (
  buildUrl: (path: string) => string,
  data: Partial<Technician>,
): Promise<Technician> => {
  return fetchJSON(buildUrl(TECHNICIAN_API), {
    method: "POST",
    body: JSON.stringify(data),
  });
};

const updateTechnician = async (
  buildUrl: (path: string) => string,
  id: string,
  data: Partial<Technician>,
): Promise<Technician> => {
  return fetchJSON(`${buildUrl(TECHNICIAN_API)}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

// ============================================================================
// Scheduling API Functions
// ============================================================================

const fetchSchedules = async (
  buildUrl: (path: string) => string,
  filter?: ScheduleFilter,
): Promise<ScheduleListResponse> => {
  const params = buildQueryParams(filter);
  const data = await fetchJSON<any>(`${buildUrl(SCHEDULING_API)}/technicians/schedules?${params}`);
  const schedules = Array.isArray(data) ? data : (data?.schedules ?? []);
  return {
    schedules,
    total: data?.total ?? schedules.length,
    page: data?.page ?? 1,
    pageSize: data?.pageSize ?? schedules.length,
  };
};

const fetchSchedule = async (
  buildUrl: (path: string) => string,
  id: string,
): Promise<TechnicianSchedule> => {
  return fetchJSON(`${buildUrl(SCHEDULING_API)}/schedules/${id}`);
};

const createSchedule = async (
  buildUrl: (path: string) => string,
  data: CreateScheduleData,
): Promise<TechnicianSchedule> => {
  return fetchJSON(`${buildUrl(SCHEDULING_API)}/technicians/${data.technicianId}/schedules`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

const updateSchedule = async (
  buildUrl: (path: string) => string,
  id: string,
  data: Partial<TechnicianSchedule>,
): Promise<TechnicianSchedule> => {
  return fetchJSON(`${buildUrl(SCHEDULING_API)}/schedules/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

const fetchAssignments = async (
  buildUrl: (path: string) => string,
  filter?: AssignmentFilter,
): Promise<AssignmentListResponse> => {
  const params = buildQueryParams(filter);
  const data = await fetchJSON<any>(`${buildUrl(SCHEDULING_API)}/assignments?${params}`);
  const assignments = Array.isArray(data) ? data : (data?.assignments ?? []);
  return {
    assignments,
    total: data?.total ?? assignments.length,
    page: data?.page ?? 1,
    pageSize: data?.pageSize ?? assignments.length,
  };
};

const fetchAssignment = async (
  buildUrl: (path: string) => string,
  id: string,
): Promise<TaskAssignment> => {
  return fetchJSON(`${buildUrl(SCHEDULING_API)}/assignments/${id}`);
};

const createAssignment = async (
  buildUrl: (path: string) => string,
  data: CreateAssignmentData,
): Promise<TaskAssignment> => {
  return fetchJSON(`${buildUrl(SCHEDULING_API)}/assignments`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

const autoAssignTask = async (
  buildUrl: (path: string) => string,
  data: AutoAssignmentData,
): Promise<TaskAssignment> => {
  return fetchJSON(`${buildUrl(SCHEDULING_API)}/assignments/auto-assign`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

const fetchCandidates = async (
  buildUrl: (path: string) => string,
  assignmentId: string,
): Promise<AssignmentCandidatesResponse> => {
  return fetchJSON(`${buildUrl(SCHEDULING_API)}/assignments/${assignmentId}/candidates`);
};

const cancelAssignment = async (
  buildUrl: (path: string) => string,
  id: string,
  reason?: string,
): Promise<void> => {
  await fetchJSON(`${buildUrl(SCHEDULING_API)}/assignments/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ reason }),
  });
};

const rescheduleAssignment = async (
  buildUrl: (path: string) => string,
  id: string,
  data: { scheduledStart: string; scheduledEnd: string; reason?: string },
): Promise<TaskAssignment> => {
  return fetchJSON(`${buildUrl(SCHEDULING_API)}/assignments/${id}/reschedule`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

const updateAssignment = async (
  buildUrl: (path: string) => string,
  id: string,
  data: Partial<TaskAssignment>,
): Promise<TaskAssignment> => {
  return fetchJSON(`${buildUrl(SCHEDULING_API)}/assignments/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

// ============================================================================
// Time Tracking API Functions
// ============================================================================

const clockIn = async (
  buildUrl: (path: string) => string,
  data: ClockInData,
): Promise<TimeEntry> => {
  return fetchJSON(`${buildUrl(TIME_API)}/clock-in`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

const clockOut = async (
  buildUrl: (path: string) => string,
  entryId: string,
  data: ClockOutData,
): Promise<TimeEntry> => {
  return fetchJSON(`${buildUrl(TIME_API)}/entries/${entryId}/clock-out`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

const fetchTimeEntries = async (
  buildUrl: (path: string) => string,
  filter?: TimeEntryFilter,
): Promise<TimeEntryListResponse> => {
  const params = buildQueryParams(filter);
  const data = await fetchJSON<any>(`${buildUrl(TIME_API)}/entries?${params}`);
  const entries = Array.isArray(data) ? data : (data?.entries ?? []);
  return {
    entries,
    total: data?.total ?? entries.length,
    page: data?.page ?? 1,
    pageSize: data?.pageSize ?? entries.length,
  };
};

const fetchTimeEntry = async (
  buildUrl: (path: string) => string,
  id: string,
): Promise<TimeEntry> => {
  return fetchJSON(`${buildUrl(TIME_API)}/entries/${id}`);
};

const submitTimeEntry = async (
  buildUrl: (path: string) => string,
  id: string,
): Promise<TimeEntry> => {
  return fetchJSON(`${buildUrl(TIME_API)}/entries/${id}/submit`, {
    method: "POST",
  });
};

const approveTimeEntry = async (
  buildUrl: (path: string) => string,
  id: string,
): Promise<TimeEntry> => {
  return fetchJSON(`${buildUrl(TIME_API)}/entries/${id}/approve`, {
    method: "POST",
  });
};

const rejectTimeEntry = async (
  buildUrl: (path: string) => string,
  id: string,
  reason: string,
): Promise<TimeEntry> => {
  return fetchJSON(`${buildUrl(TIME_API)}/entries/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
};

const fetchLaborRates = async (buildUrl: (path: string) => string): Promise<LaborRate[]> => {
  return fetchJSON(`${buildUrl(TIME_API)}/labor-rates`);
};

const fetchTimesheetPeriods = async (
  buildUrl: (path: string) => string,
): Promise<TimesheetPeriod[]> => {
  return fetchJSON(`${buildUrl(TIME_API)}/timesheet-periods`);
};

// ============================================================================
// Resource Management API Functions
// ============================================================================

const fetchEquipment = async (
  buildUrl: (path: string) => string,
  filter?: ResourceFilter,
): Promise<EquipmentListResponse> => {
  const params = buildQueryParams(filter);
  return fetchJSON(`${buildUrl(RESOURCES_API)}/equipment?${params}`);
};

const fetchEquipmentItem = async (
  buildUrl: (path: string) => string,
  id: string,
): Promise<Equipment> => {
  return fetchJSON(`${buildUrl(RESOURCES_API)}/equipment/${id}`);
};

const createEquipment = async (
  buildUrl: (path: string) => string,
  data: Partial<Equipment>,
): Promise<Equipment> => {
  return fetchJSON(`${buildUrl(RESOURCES_API)}/equipment`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

const updateEquipment = async (
  buildUrl: (path: string) => string,
  id: string,
  data: Partial<Equipment>,
): Promise<Equipment> => {
  return fetchJSON(`${buildUrl(RESOURCES_API)}/equipment/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

const fetchVehicles = async (
  buildUrl: (path: string) => string,
  filter?: ResourceFilter,
): Promise<VehicleListResponse> => {
  const params = buildQueryParams(filter);
  return fetchJSON(`${buildUrl(RESOURCES_API)}/vehicles?${params}`);
};

const fetchVehicle = async (buildUrl: (path: string) => string, id: string): Promise<Vehicle> => {
  return fetchJSON(`${buildUrl(RESOURCES_API)}/vehicles/${id}`);
};

const createVehicle = async (
  buildUrl: (path: string) => string,
  data: Partial<Vehicle>,
): Promise<Vehicle> => {
  return fetchJSON(`${buildUrl(RESOURCES_API)}/vehicles`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

const updateVehicle = async (
  buildUrl: (path: string) => string,
  id: string,
  data: Partial<Vehicle>,
): Promise<Vehicle> => {
  return fetchJSON(`${buildUrl(RESOURCES_API)}/vehicles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

const assignResource = async (
  buildUrl: (path: string) => string,
  data: AssignResourceData,
): Promise<ResourceAssignment> => {
  return fetchJSON(`${buildUrl(RESOURCES_API)}/assignments`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

const returnResource = async (
  buildUrl: (path: string) => string,
  assignmentId: string,
  data: ReturnResourceData,
): Promise<ResourceAssignment> => {
  return fetchJSON(`${buildUrl(RESOURCES_API)}/assignments/${assignmentId}/return`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

const fetchResourceAssignments = async (
  buildUrl: (path: string) => string,
  technicianId?: string,
): Promise<ResourceAssignment[]> => {
  const params = technicianId ? `?technicianId=${technicianId}` : "";
  return fetchJSON(`${buildUrl(RESOURCES_API)}/assignments${params}`);
};

// ============================================================================
// React Query Hooks - Technicians
// ============================================================================

export const useTechnicians = (filter?: TechnicianFilter) => {
  const { api, buildUrl } = useFieldServiceApi();

  return useQuery({
    queryKey: ["technicians", filter, api.baseUrl, api.prefix],
    queryFn: () => fetchTechnicians(buildUrl, filter),
    staleTime: 30000,
  });
};

export const useTechnician = (id: string) => {
  const { api, buildUrl } = useFieldServiceApi();
  return useQuery({
    queryKey: ["technician", id, api.baseUrl, api.prefix],
    queryFn: () => fetchTechnician(buildUrl, id),
    enabled: !!id,
  });
};

export const useCreateTechnician = () => {
  const { api, buildUrl } = useFieldServiceApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Technician>) => createTechnician(buildUrl, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technicians"] });
    },
  });
};

export const useUpdateTechnician = () => {
  const { api, buildUrl } = useFieldServiceApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Technician> }) =>
      updateTechnician(buildUrl, id, data),
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
  const { api, buildUrl } = useFieldServiceApi();
  return useQuery({
    queryKey: ["schedules", filter, api.baseUrl, api.prefix],
    queryFn: () => fetchSchedules(buildUrl, filter),
    staleTime: 10000,
  });
};

export const useSchedule = (id: string) => {
  const { api, buildUrl } = useFieldServiceApi();
  return useQuery({
    queryKey: ["schedule", id, api.baseUrl, api.prefix],
    queryFn: () => fetchSchedule(buildUrl, id),
    enabled: !!id,
  });
};

export const useCreateSchedule = () => {
  const { api, buildUrl } = useFieldServiceApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateScheduleData) => createSchedule(buildUrl, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });
};

export const useUpdateSchedule = () => {
  const { api, buildUrl } = useFieldServiceApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TechnicianSchedule> }) =>
      updateSchedule(buildUrl, id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["schedule", variables.id] });
    },
  });
};

export const useAssignments = (filter?: AssignmentFilter, options?: { enabled?: boolean }) => {
  const { api, buildUrl } = useFieldServiceApi();
  return useQuery({
    queryKey: ["assignments", filter, api.baseUrl, api.prefix],
    queryFn: () => fetchAssignments(buildUrl, filter),
    staleTime: 10000,
    enabled: options?.enabled ?? true,
  });
};

export const useAssignment = (id: string) => {
  const { api, buildUrl } = useFieldServiceApi();
  return useQuery({
    queryKey: ["assignment", id, api.baseUrl, api.prefix],
    queryFn: () => fetchAssignment(buildUrl, id),
    enabled: !!id,
  });
};

export const useCreateAssignment = () => {
  const { api, buildUrl } = useFieldServiceApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAssignmentData) => createAssignment(buildUrl, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });
};

export const useAutoAssignTask = () => {
  const { api, buildUrl } = useFieldServiceApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AutoAssignmentData) => autoAssignTask(buildUrl, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });
};

export const useAssignmentCandidates = (assignmentId: string) => {
  const { api, buildUrl } = useFieldServiceApi();
  return useQuery({
    queryKey: ["assignment-candidates", assignmentId, api.baseUrl, api.prefix],
    queryFn: () => fetchCandidates(buildUrl, assignmentId),
    enabled: !!assignmentId,
  });
};

export const useCancelAssignment = () => {
  const { api, buildUrl } = useFieldServiceApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      cancelAssignment(buildUrl, id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });
};

export const useRescheduleAssignment = () => {
  const { api, buildUrl } = useFieldServiceApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { scheduledStart: string; scheduledEnd: string; reason?: string };
    }) => rescheduleAssignment(buildUrl, id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assignment", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });
};

export const useStartAssignment = () => {
  const { api, buildUrl } = useFieldServiceApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, actualStart }: { id: string; actualStart?: string }) =>
      updateAssignment(buildUrl, id, {
        status: AssignmentStatus.IN_PROGRESS,
        actualStart: actualStart ?? new Date().toISOString(),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assignment", variables.id] });
    },
  });
};

export const useCompleteAssignment = () => {
  const { api, buildUrl } = useFieldServiceApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, actualEnd }: { id: string; actualEnd?: string }) =>
      updateAssignment(buildUrl, id, {
        status: AssignmentStatus.COMPLETED,
        actualEnd: actualEnd ?? new Date().toISOString(),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assignment", variables.id] });
    },
  });
};

// ============================================================================
// React Query Hooks - Time Tracking
// ============================================================================

export const useClockIn = () => {
  const { api, buildUrl } = useFieldServiceApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ClockInData) => clockIn(buildUrl, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
    },
  });
};

export const useClockOut = () => {
  const { api, buildUrl } = useFieldServiceApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ClockOutData }) => clockOut(buildUrl, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
    },
  });
};

export const useTimeEntries = (filter?: TimeEntryFilter, options?: { enabled?: boolean }) => {
  const { api, buildUrl } = useFieldServiceApi();
  return useQuery({
    queryKey: ["time-entries", filter, api.baseUrl, api.prefix],
    queryFn: () => fetchTimeEntries(buildUrl, filter),
    staleTime: 10000,
    enabled: options?.enabled ?? true,
  });
};

export const useTimeEntry = (id: string) => {
  const { api, buildUrl } = useFieldServiceApi();
  return useQuery({
    queryKey: ["time-entry", id, api.baseUrl, api.prefix],
    queryFn: () => fetchTimeEntry(buildUrl, id),
    enabled: !!id,
  });
};

export const useSubmitTimeEntry = () => {
  const { api, buildUrl } = useFieldServiceApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => submitTimeEntry(buildUrl, id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["time-entry", id] });
    },
  });
};

export const useApproveTimeEntry = () => {
  const { api, buildUrl } = useFieldServiceApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => approveTimeEntry(buildUrl, id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["time-entry", id] });
    },
  });
};

export const useRejectTimeEntry = () => {
  const { api, buildUrl } = useFieldServiceApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectTimeEntry(buildUrl, id, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["time-entry", variables.id] });
    },
  });
};

export const useLaborRates = () => {
  const { api, buildUrl } = useFieldServiceApi();
  return useQuery({
    queryKey: ["labor-rates", api.baseUrl, api.prefix],
    queryFn: () => fetchLaborRates(buildUrl),
    staleTime: 300000, // 5 minutes
  });
};

export const useTimesheetPeriods = () => {
  const { api, buildUrl } = useFieldServiceApi();
  return useQuery({
    queryKey: ["timesheet-periods", api.baseUrl, api.prefix],
    queryFn: () => fetchTimesheetPeriods(buildUrl),
    staleTime: 60000, // 1 minute
  });
};

// ============================================================================
// React Query Hooks - Resources
// ============================================================================

export const useEquipment = (filter?: ResourceFilter) => {
  const { api, buildUrl } = useFieldServiceApi();
  return useQuery({
    queryKey: ["equipment", filter, api.baseUrl, api.prefix],
    queryFn: () => fetchEquipment(buildUrl, filter),
    staleTime: 30000,
  });
};

export const useEquipmentItem = (id: string) => {
  const { api, buildUrl } = useFieldServiceApi();
  return useQuery({
    queryKey: ["equipment-item", id, api.baseUrl, api.prefix],
    queryFn: () => fetchEquipmentItem(buildUrl, id),
    enabled: !!id,
  });
};

export const useCreateEquipment = () => {
  const { api, buildUrl } = useFieldServiceApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Equipment>) => createEquipment(buildUrl, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
    },
  });
};

export const useUpdateEquipment = () => {
  const { api, buildUrl } = useFieldServiceApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Equipment> }) =>
      updateEquipment(buildUrl, id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      queryClient.invalidateQueries({ queryKey: ["equipment-item", variables.id] });
    },
  });
};

export const useVehicles = (filter?: ResourceFilter) => {
  const { api, buildUrl } = useFieldServiceApi();
  return useQuery({
    queryKey: ["vehicles", filter, api.baseUrl, api.prefix],
    queryFn: () => fetchVehicles(buildUrl, filter),
    staleTime: 30000,
  });
};

export const useVehicle = (id: string) => {
  const { api, buildUrl } = useFieldServiceApi();
  return useQuery({
    queryKey: ["vehicle", id, api.baseUrl, api.prefix],
    queryFn: () => fetchVehicle(buildUrl, id),
    enabled: !!id,
  });
};

export const useCreateVehicle = () => {
  const { api, buildUrl } = useFieldServiceApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Vehicle>) => createVehicle(buildUrl, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
};

export const useUpdateVehicle = () => {
  const { api, buildUrl } = useFieldServiceApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Vehicle> }) =>
      updateVehicle(buildUrl, id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle", variables.id] });
    },
  });
};

export const useAssignResource = () => {
  const { api, buildUrl } = useFieldServiceApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AssignResourceData) => assignResource(buildUrl, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
};

export const useReturnResource = () => {
  const { api, buildUrl } = useFieldServiceApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReturnResourceData }) =>
      returnResource(buildUrl, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
};

export const useResourceAssignments = (technicianId?: string, options?: { enabled?: boolean }) => {
  const { api, buildUrl } = useFieldServiceApi();
  return useQuery({
    queryKey: ["resource-assignments", technicianId, api.baseUrl, api.prefix],
    queryFn: () => fetchResourceAssignments(buildUrl, technicianId),
    staleTime: 10000,
    enabled: options?.enabled ?? true,
  });
};
