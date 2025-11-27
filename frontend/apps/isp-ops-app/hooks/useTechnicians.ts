/**
 * React hooks for technician management and location tracking
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";

export interface TechnicianLocation {
  technician_id: string;
  technician_name?: string;
  latitude: number | null;
  longitude: number | null;
  last_update: string | null;
  status: "available" | "on_job" | "off_duty" | "on_break" | "unavailable";
}

export interface Technician {
  id: string;
  tenant_id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  mobile?: string | null;

  status: "available" | "on_job" | "off_duty" | "on_break" | "unavailable";
  skill_level: "trainee" | "junior" | "intermediate" | "senior" | "expert";

  // Location
  home_base_lat?: number | null;
  home_base_lng?: number | null;
  home_base_address?: string | null;
  current_lat?: number | null;
  current_lng?: number | null;
  last_location_update?: string | null;
  service_areas?: string[] | null;

  // Schedule
  working_hours_start?: string | null;
  working_hours_end?: string | null;
  working_days?: number[] | null;
  is_on_call: boolean;
  available_for_emergency: boolean;

  // Skills
  skills?: Record<string, boolean> | null;
  certifications?: Array<{ name: string; expires?: string }> | null;
  equipment?: Record<string, any> | null;

  // Performance
  jobs_completed: number;
  average_rating?: number | null;
  completion_rate?: number | null;

  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TechniciansResponse {
  technicians: Technician[];
  total: number;
  limit: number;
  offset: number;
}

interface UseTechniciansOptions {
  status?: string;
  is_active?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Fetch all technicians with optional filtering
 */
export function useTechnicians(options: UseTechniciansOptions = {}) {
  const { status, is_active, limit = 50, offset = 0 } = options;

  return useQuery({
    queryKey: ["technicians", status, is_active, limit, offset],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      if (is_active !== undefined) params.append("is_active", String(is_active));
      params.append("limit", String(limit));
      params.append("offset", String(offset));

      const response = await apiClient.get<TechniciansResponse>(
        `/field-service/technicians?${params.toString()}`,
      );
      return extractDataOrThrow(response);
    },
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Fetch a single technician by ID
 */
export function useTechnician(technicianId: string | null) {
  return useQuery({
    queryKey: ["technician", technicianId],
    queryFn: async () => {
      if (!technicianId) return null;

      const response = await apiClient.get<Technician>(
        `/field-service/technicians/${technicianId}`,
      );
      return extractDataOrThrow(response);
    },
    enabled: !!technicianId,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Fetch current locations of all active technicians
 *
 * This hook is optimized for real-time map visualization.
 * Auto-refreshes every 15 seconds to show live technician positions.
 */
export function useActiveTechnicianLocations() {
  return useQuery({
    queryKey: ["technician-locations", "active"],
    queryFn: async () => {
      const response = await apiClient.get<TechnicianLocation[]>(
        "/field-service/technicians/locations/active",
      );
      return extractDataOrThrow(response);
    },
    staleTime: 10000, // 10 seconds - considered fresh for this duration
    refetchInterval: 15000, // Auto-refetch every 15 seconds for real-time updates
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
}

/**
 * Fetch location history for a specific technician
 */
export function useTechnicianLocationHistory(
  technicianId: string | null,
  options: {
    startTime?: string;
    endTime?: string;
    limit?: number;
  } = {},
) {
  const { startTime, endTime, limit = 100 } = options;

  return useQuery({
    queryKey: ["technician-location-history", technicianId, startTime, endTime, limit],
    queryFn: async () => {
      if (!technicianId) return null;

      const params = new URLSearchParams();
      if (startTime) params.append("start_time", startTime);
      if (endTime) params.append("end_time", endTime);
      params.append("limit", String(limit));

      const response = await apiClient.get(
        `/field-service/technicians/${technicianId}/location-history?${params.toString()}`,
      );
      return extractDataOrThrow(response);
    },
    enabled: !!technicianId,
    staleTime: 60000, // 1 minute - history doesn't change often
  });
}

/**
 * Helper to get technicians with valid locations (for map display)
 */
export function useTechniciansWithLocations() {
  const { data, ...rest } = useActiveTechnicianLocations();

  // Filter to only technicians with valid coordinates
  const techniciansWithLocation = Array.isArray(data)
    ? data.filter(
        (tech) =>
          tech.latitude !== null &&
          tech.longitude !== null &&
          tech.latitude !== undefined &&
          tech.longitude !== undefined,
      )
    : [];

  return {
    ...rest,
    data: techniciansWithLocation,
  };
}
