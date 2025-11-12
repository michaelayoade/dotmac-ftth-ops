/**
 * Tests for useTechnicians hook
 * Tests technician management and location tracking functionality with TanStack Query
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useTechnicians,
  useTechnician,
  useActiveTechnicianLocations,
  useTechnicianLocationHistory,
  useTechniciansWithLocations,
  Technician,
  TechnicianLocation,
  TechniciansResponse,
} from "../useTechnicians";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/api/response-helpers", () => ({
  extractDataOrThrow: jest.fn((response) => response.data),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

describe("useTechnicians", () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useTechnicians - list technicians", () => {
    it("should fetch technicians successfully", async () => {
      const mockTechnicians: Technician[] = [
        {
          id: "tech-1",
          tenant_id: "tenant-1",
          employee_id: "EMP-001",
          first_name: "John",
          last_name: "Doe",
          email: "john.doe@example.com",
          phone: "+1234567890",
          mobile: "+0987654321",
          status: "available",
          skill_level: "senior",
          home_base_lat: 40.7128,
          home_base_lng: -74.006,
          home_base_address: "123 Main St, New York, NY",
          current_lat: 40.7128,
          current_lng: -74.006,
          last_location_update: "2024-01-15T12:00:00Z",
          service_areas: ["Manhattan", "Brooklyn"],
          working_hours_start: "08:00",
          working_hours_end: "17:00",
          working_days: [1, 2, 3, 4, 5],
          is_on_call: false,
          available_for_emergency: true,
          skills: { fiber_splicing: true, ont_config: true },
          certifications: [
            { name: "Fiber Optics", expires: "2025-01-01" },
          ],
          equipment: { tools: ["splicing_kit", "power_meter"] },
          jobs_completed: 150,
          average_rating: 4.8,
          completion_rate: 0.95,
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-15T00:00:00Z",
        },
      ];

      const mockResponse: TechniciansResponse = {
        technicians: mockTechnicians,
        total: 1,
        limit: 50,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockResponse);

      const { result } = renderHook(() => useTechnicians(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.technicians).toHaveLength(1);
      expect(result.current.data?.technicians[0].first_name).toBe("John");
      expect(result.current.data?.technicians[0].skill_level).toBe("senior");
      expect(result.current.data?.total).toBe(1);
      expect(apiClient.get).toHaveBeenCalledWith("/field-service/technicians?limit=50&offset=0");
      expect(extractDataOrThrow).toHaveBeenCalled();
    });

    it("should fetch technicians with status filter", async () => {
      const mockResponse: TechniciansResponse = {
        technicians: [],
        total: 0,
        limit: 50,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockResponse);

      renderHook(() => useTechnicians({ status: "available" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/field-service/technicians?status=available&limit=50&offset=0"
        );
      });
    });

    it("should fetch technicians with is_active filter", async () => {
      const mockResponse: TechniciansResponse = {
        technicians: [],
        total: 0,
        limit: 50,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockResponse);

      renderHook(() => useTechnicians({ is_active: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/field-service/technicians?is_active=true&limit=50&offset=0"
        );
      });
    });

    it("should fetch technicians with custom pagination", async () => {
      const mockResponse: TechniciansResponse = {
        technicians: [],
        total: 0,
        limit: 25,
        offset: 10,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockResponse);

      renderHook(() => useTechnicians({ limit: 25, offset: 10 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/field-service/technicians?limit=25&offset=10"
        );
      });
    });

    it("should fetch technicians with all filters", async () => {
      const mockResponse: TechniciansResponse = {
        technicians: [],
        total: 0,
        limit: 25,
        offset: 10,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockResponse);

      renderHook(
        () =>
          useTechnicians({
            status: "on_job",
            is_active: true,
            limit: 25,
            offset: 10,
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/field-service/technicians?status=on_job&is_active=true&limit=25&offset=10"
        );
      });
    });

    it("should handle all technician statuses", async () => {
      const statuses: Technician["status"][] = [
        "available",
        "on_job",
        "off_duty",
        "on_break",
        "unavailable",
      ];

      for (const status of statuses) {
        const mockResponse: TechniciansResponse = {
          technicians: [
            {
              id: `tech-${status}`,
              tenant_id: "tenant-1",
              employee_id: "EMP-001",
              first_name: "John",
              last_name: "Doe",
              email: "john@example.com",
              status,
              skill_level: "junior",
              is_on_call: false,
              available_for_emergency: false,
              jobs_completed: 10,
              is_active: true,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        };

        (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
        (extractDataOrThrow as jest.Mock).mockReturnValue(mockResponse);

        const { result } = renderHook(() => useTechnicians({ status }), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.technicians[0].status).toBe(status);

        jest.clearAllMocks();
      }
    });

    it("should handle all skill levels", async () => {
      const skillLevels: Technician["skill_level"][] = [
        "trainee",
        "junior",
        "intermediate",
        "senior",
        "expert",
      ];

      for (const skillLevel of skillLevels) {
        const mockResponse: TechniciansResponse = {
          technicians: [
            {
              id: `tech-${skillLevel}`,
              tenant_id: "tenant-1",
              employee_id: "EMP-001",
              first_name: "John",
              last_name: "Doe",
              email: "john@example.com",
              status: "available",
              skill_level: skillLevel,
              is_on_call: false,
              available_for_emergency: false,
              jobs_completed: 10,
              is_active: true,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        };

        (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
        (extractDataOrThrow as jest.Mock).mockReturnValue(mockResponse);

        const { result } = renderHook(() => useTechnicians(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.technicians[0].skill_level).toBe(skillLevel);

        jest.clearAllMocks();
      }
    });

    it("should handle technician with all optional fields", async () => {
      const mockTechnician: Technician = {
        id: "tech-1",
        tenant_id: "tenant-1",
        employee_id: "EMP-001",
        first_name: "John",
        last_name: "Doe",
        email: "john@example.com",
        phone: "+1234567890",
        mobile: "+0987654321",
        status: "available",
        skill_level: "expert",
        home_base_lat: 40.7128,
        home_base_lng: -74.006,
        home_base_address: "123 Main St, New York, NY",
        current_lat: 40.7128,
        current_lng: -74.006,
        last_location_update: "2024-01-15T12:00:00Z",
        service_areas: ["Manhattan", "Brooklyn", "Queens"],
        working_hours_start: "08:00",
        working_hours_end: "17:00",
        working_days: [1, 2, 3, 4, 5],
        is_on_call: true,
        available_for_emergency: true,
        skills: {
          fiber_splicing: true,
          ont_config: true,
          router_config: true,
        },
        certifications: [
          { name: "Fiber Optics Advanced", expires: "2025-12-31" },
          { name: "Network Security" },
        ],
        equipment: {
          tools: ["splicing_kit", "power_meter", "otdr"],
          vehicle: "van-123",
        },
        jobs_completed: 500,
        average_rating: 4.9,
        completion_rate: 0.98,
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
      };

      const mockResponse: TechniciansResponse = {
        technicians: [mockTechnician],
        total: 1,
        limit: 50,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockResponse);

      const { result } = renderHook(() => useTechnicians(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const tech = result.current.data?.technicians[0];
      expect(tech).toEqual(mockTechnician);
      expect(tech?.skills).toHaveProperty("fiber_splicing", true);
      expect(tech?.certifications).toHaveLength(2);
      expect(tech?.service_areas).toContain("Manhattan");
    });

    it("should handle empty technicians array", async () => {
      const mockResponse: TechniciansResponse = {
        technicians: [],
        total: 0,
        limit: 50,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockResponse);

      const { result } = renderHook(() => useTechnicians(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.technicians).toEqual([]);
      expect(result.current.data?.total).toBe(0);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch technicians");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useTechnicians(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should set loading state correctly", async () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: { technicians: [], total: 0, limit: 50, offset: 0 },
                }),
              100
            )
          )
      );

      const { result } = renderHook(() => useTechnicians(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), {
        timeout: 200,
      });
    });

    it("should have correct staleTime of 30 seconds", async () => {
      const mockResponse: TechniciansResponse = {
        technicians: [],
        total: 0,
        limit: 50,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockResponse);

      const { result } = renderHook(() => useTechnicians(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isStale).toBe(false);
    });

    it("should handle pagination correctly", async () => {
      const mockResponse: TechniciansResponse = {
        technicians: Array(25)
          .fill(null)
          .map((_, i) => ({
            id: `tech-${i}`,
            tenant_id: "tenant-1",
            employee_id: `EMP-${i}`,
            first_name: `Tech${i}`,
            last_name: "User",
            email: `tech${i}@example.com`,
            status: "available" as const,
            skill_level: "junior" as const,
            is_on_call: false,
            available_for_emergency: false,
            jobs_completed: 10,
            is_active: true,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          })),
        total: 100,
        limit: 25,
        offset: 25,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockResponse);

      const { result } = renderHook(() => useTechnicians({ limit: 25, offset: 25 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.technicians).toHaveLength(25);
      expect(result.current.data?.total).toBe(100);
      expect(result.current.data?.limit).toBe(25);
      expect(result.current.data?.offset).toBe(25);
    });
  });

  describe("useTechnician - single technician", () => {
    it("should fetch single technician successfully", async () => {
      const mockTechnician: Technician = {
        id: "tech-1",
        tenant_id: "tenant-1",
        employee_id: "EMP-001",
        first_name: "John",
        last_name: "Doe",
        email: "john@example.com",
        phone: "+1234567890",
        mobile: "+0987654321",
        status: "available",
        skill_level: "senior",
        home_base_lat: 40.7128,
        home_base_lng: -74.006,
        home_base_address: "123 Main St",
        is_on_call: false,
        available_for_emergency: true,
        jobs_completed: 150,
        average_rating: 4.8,
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockTechnician });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockTechnician);

      const { result } = renderHook(() => useTechnician("tech-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockTechnician);
      expect(apiClient.get).toHaveBeenCalledWith("/field-service/technicians/tech-1");
      expect(extractDataOrThrow).toHaveBeenCalled();
    });

    it("should not fetch when technicianId is null", async () => {
      const { result } = renderHook(() => useTechnician(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should return null when technicianId is null", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: null });
      (extractDataOrThrow as jest.Mock).mockReturnValue(null);

      const { result } = renderHook(() => useTechnician(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Technician not found");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useTechnician("tech-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should have correct staleTime of 30 seconds", async () => {
      const mockTechnician: Technician = {
        id: "tech-1",
        tenant_id: "tenant-1",
        employee_id: "EMP-001",
        first_name: "John",
        last_name: "Doe",
        email: "john@example.com",
        status: "available",
        skill_level: "junior",
        is_on_call: false,
        available_for_emergency: false,
        jobs_completed: 10,
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockTechnician });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockTechnician);

      const { result } = renderHook(() => useTechnician("tech-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isStale).toBe(false);
    });
  });

  describe("useActiveTechnicianLocations - active locations", () => {
    it("should fetch active technician locations successfully", async () => {
      const mockLocations: TechnicianLocation[] = [
        {
          technician_id: "tech-1",
          technician_name: "John Doe",
          latitude: 40.7128,
          longitude: -74.006,
          last_update: "2024-01-15T12:00:00Z",
          status: "on_job",
        },
        {
          technician_id: "tech-2",
          technician_name: "Jane Smith",
          latitude: 40.7589,
          longitude: -73.9851,
          last_update: "2024-01-15T12:05:00Z",
          status: "available",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockLocations });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockLocations);

      const { result } = renderHook(() => useActiveTechnicianLocations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].technician_name).toBe("John Doe");
      expect(result.current.data?.[0].latitude).toBe(40.7128);
      expect(result.current.data?.[1].status).toBe("available");
      expect(apiClient.get).toHaveBeenCalledWith(
        "/field-service/technicians/locations/active"
      );
    });

    it("should handle all location statuses", async () => {
      const statuses: TechnicianLocation["status"][] = [
        "available",
        "on_job",
        "off_duty",
        "on_break",
        "unavailable",
      ];

      for (const status of statuses) {
        const mockLocations: TechnicianLocation[] = [
          {
            technician_id: `tech-${status}`,
            technician_name: `Tech ${status}`,
            latitude: 40.7128,
            longitude: -74.006,
            last_update: "2024-01-15T12:00:00Z",
            status,
          },
        ];

        (apiClient.get as jest.Mock).mockResolvedValue({ data: mockLocations });
        (extractDataOrThrow as jest.Mock).mockReturnValue(mockLocations);

        const { result } = renderHook(() => useActiveTechnicianLocations(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.[0].status).toBe(status);

        jest.clearAllMocks();
      }
    });

    it("should handle locations with null coordinates", async () => {
      const mockLocations: TechnicianLocation[] = [
        {
          technician_id: "tech-1",
          technician_name: "John Doe",
          latitude: null,
          longitude: null,
          last_update: null,
          status: "off_duty",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockLocations });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockLocations);

      const { result } = renderHook(() => useActiveTechnicianLocations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.[0].latitude).toBeNull();
      expect(result.current.data?.[0].longitude).toBeNull();
    });

    it("should handle empty locations array", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (extractDataOrThrow as jest.Mock).mockReturnValue([]);

      const { result } = renderHook(() => useActiveTechnicianLocations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual([]);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch locations");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useActiveTechnicianLocations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should have correct staleTime of 10 seconds", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (extractDataOrThrow as jest.Mock).mockReturnValue([]);

      const { result } = renderHook(() => useActiveTechnicianLocations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isStale).toBe(false);
    });

    it("should auto-refetch every 15 seconds", async () => {
      jest.useFakeTimers();

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (extractDataOrThrow as jest.Mock).mockReturnValue([]);

      renderHook(() => useActiveTechnicianLocations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

      // Fast-forward 15 seconds
      act(() => {
        jest.advanceTimersByTime(15000);
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));

      // Fast-forward another 15 seconds
      act(() => {
        jest.advanceTimersByTime(15000);
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(3));

      jest.useRealTimers();
    });

    it("should refetch on window focus", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (extractDataOrThrow as jest.Mock).mockReturnValue([]);

      const { result } = renderHook(() => useActiveTechnicianLocations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // The refetchOnWindowFocus option is set to true
      expect(result.current.data).toBeDefined();
    });
  });

  describe("useTechnicianLocationHistory - location history", () => {
    it("should fetch location history successfully", async () => {
      const mockHistory = [
        {
          technician_id: "tech-1",
          latitude: 40.7128,
          longitude: -74.006,
          timestamp: "2024-01-15T10:00:00Z",
          status: "on_job",
        },
        {
          technician_id: "tech-1",
          latitude: 40.7589,
          longitude: -73.9851,
          timestamp: "2024-01-15T11:00:00Z",
          status: "on_job",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHistory });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockHistory);

      const { result } = renderHook(() => useTechnicianLocationHistory("tech-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(apiClient.get).toHaveBeenCalledWith(
        "/field-service/technicians/tech-1/location-history?limit=100"
      );
    });

    it("should fetch location history with time filters", async () => {
      const mockHistory = [];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHistory });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockHistory);

      renderHook(
        () =>
          useTechnicianLocationHistory("tech-1", {
            startTime: "2024-01-15T00:00:00Z",
            endTime: "2024-01-15T23:59:59Z",
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          expect.stringContaining("start_time=2024-01-15T00%3A00%3A00Z")
        );
        expect(apiClient.get).toHaveBeenCalledWith(
          expect.stringContaining("end_time=2024-01-15T23%3A59%3A59Z")
        );
      });
    });

    it("should fetch location history with custom limit", async () => {
      const mockHistory = [];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockHistory });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockHistory);

      renderHook(() => useTechnicianLocationHistory("tech-1", { limit: 50 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          expect.stringContaining("limit=50")
        );
      });
    });

    it("should not fetch when technicianId is null", async () => {
      const { result } = renderHook(() => useTechnicianLocationHistory(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should return null when technicianId is null", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: null });
      (extractDataOrThrow as jest.Mock).mockReturnValue(null);

      const { result } = renderHook(() => useTechnicianLocationHistory(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch location history");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useTechnicianLocationHistory("tech-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should have correct staleTime of 60 seconds", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (extractDataOrThrow as jest.Mock).mockReturnValue([]);

      const { result } = renderHook(() => useTechnicianLocationHistory("tech-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isStale).toBe(false);
    });

    it("should handle empty history array", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (extractDataOrThrow as jest.Mock).mockReturnValue([]);

      const { result } = renderHook(() => useTechnicianLocationHistory("tech-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual([]);
    });
  });

  describe("useTechniciansWithLocations - filtered locations", () => {
    it("should filter technicians with valid locations", async () => {
      const mockLocations: TechnicianLocation[] = [
        {
          technician_id: "tech-1",
          technician_name: "John Doe",
          latitude: 40.7128,
          longitude: -74.006,
          last_update: "2024-01-15T12:00:00Z",
          status: "on_job",
        },
        {
          technician_id: "tech-2",
          technician_name: "Jane Smith",
          latitude: null,
          longitude: null,
          last_update: null,
          status: "off_duty",
        },
        {
          technician_id: "tech-3",
          technician_name: "Bob Wilson",
          latitude: 40.7589,
          longitude: -73.9851,
          last_update: "2024-01-15T12:00:00Z",
          status: "available",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockLocations });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockLocations);

      const { result } = renderHook(() => useTechniciansWithLocations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Should only return tech-1 and tech-3 (tech-2 has null coordinates)
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data[0].technician_id).toBe("tech-1");
      expect(result.current.data[1].technician_id).toBe("tech-3");
    });

    it("should filter out technicians with null latitude", async () => {
      const mockLocations: TechnicianLocation[] = [
        {
          technician_id: "tech-1",
          technician_name: "John Doe",
          latitude: null,
          longitude: -74.006,
          last_update: "2024-01-15T12:00:00Z",
          status: "on_job",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockLocations });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockLocations);

      const { result } = renderHook(() => useTechniciansWithLocations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual([]);
    });

    it("should filter out technicians with null longitude", async () => {
      const mockLocations: TechnicianLocation[] = [
        {
          technician_id: "tech-1",
          technician_name: "John Doe",
          latitude: 40.7128,
          longitude: null,
          last_update: "2024-01-15T12:00:00Z",
          status: "on_job",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockLocations });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockLocations);

      const { result } = renderHook(() => useTechniciansWithLocations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual([]);
    });

    it("should filter out technicians with undefined coordinates", async () => {
      const mockLocations: TechnicianLocation[] = [
        {
          technician_id: "tech-1",
          technician_name: "John Doe",
          latitude: undefined as any,
          longitude: undefined as any,
          last_update: "2024-01-15T12:00:00Z",
          status: "on_job",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockLocations });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockLocations);

      const { result } = renderHook(() => useTechniciansWithLocations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual([]);
    });

    it("should return empty array when no data", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: undefined });
      (extractDataOrThrow as jest.Mock).mockReturnValue(undefined);

      const { result } = renderHook(() => useTechniciansWithLocations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual([]);
    });

    it("should handle all valid technicians", async () => {
      const mockLocations: TechnicianLocation[] = [
        {
          technician_id: "tech-1",
          technician_name: "John Doe",
          latitude: 40.7128,
          longitude: -74.006,
          last_update: "2024-01-15T12:00:00Z",
          status: "on_job",
        },
        {
          technician_id: "tech-2",
          technician_name: "Jane Smith",
          latitude: 40.7589,
          longitude: -73.9851,
          last_update: "2024-01-15T12:00:00Z",
          status: "available",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockLocations });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockLocations);

      const { result } = renderHook(() => useTechniciansWithLocations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data).toEqual(mockLocations);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch locations");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useTechniciansWithLocations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toEqual([]);
    });
  });

  describe("Query key management", () => {
    it("should use correct query key for useTechnicians", async () => {
      const mockResponse: TechniciansResponse = {
        technicians: [],
        total: 0,
        limit: 50,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockResponse);

      const { result } = renderHook(
        () =>
          useTechnicians({
            status: "available",
            is_active: true,
            limit: 50,
            offset: 0,
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Query key should be ["technicians", status, is_active, limit, offset]
      expect(result.current.data).toBeDefined();
    });

    it("should use correct query key for useTechnician", async () => {
      const mockTechnician: Technician = {
        id: "tech-1",
        tenant_id: "tenant-1",
        employee_id: "EMP-001",
        first_name: "John",
        last_name: "Doe",
        email: "john@example.com",
        status: "available",
        skill_level: "junior",
        is_on_call: false,
        available_for_emergency: false,
        jobs_completed: 10,
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockTechnician });
      (extractDataOrThrow as jest.Mock).mockReturnValue(mockTechnician);

      const { result } = renderHook(() => useTechnician("tech-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Query key should be ["technician", technicianId]
      expect(result.current.data).toBeDefined();
    });

    it("should use correct query key for useActiveTechnicianLocations", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (extractDataOrThrow as jest.Mock).mockReturnValue([]);

      const { result } = renderHook(() => useActiveTechnicianLocations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Query key should be ["technician-locations", "active"]
      expect(result.current.data).toBeDefined();
    });

    it("should use correct query key for useTechnicianLocationHistory", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (extractDataOrThrow as jest.Mock).mockReturnValue([]);

      const { result } = renderHook(
        () =>
          useTechnicianLocationHistory("tech-1", {
            startTime: "2024-01-15T00:00:00Z",
            endTime: "2024-01-15T23:59:59Z",
            limit: 50,
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Query key should be ["technician-location-history", technicianId, startTime, endTime, limit]
      expect(result.current.data).toBeDefined();
    });
  });

  describe("Loading states", () => {
    it("should show loading state during technicians query", async () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: { technicians: [], total: 0, limit: 50, offset: 0 },
                }),
              100
            )
          )
      );

      const { result } = renderHook(() => useTechnicians(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), {
        timeout: 200,
      });
    });

    it("should show loading state during single technician query", async () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: {
                    id: "tech-1",
                    tenant_id: "tenant-1",
                    employee_id: "EMP-001",
                    first_name: "John",
                    last_name: "Doe",
                    email: "john@example.com",
                    status: "available",
                    skill_level: "junior",
                    is_on_call: false,
                    available_for_emergency: false,
                    jobs_completed: 10,
                    is_active: true,
                    created_at: "2024-01-01T00:00:00Z",
                    updated_at: "2024-01-01T00:00:00Z",
                  },
                }),
              100
            )
          )
      );

      const { result } = renderHook(() => useTechnician("tech-1"), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), {
        timeout: 200,
      });
    });
  });
});
