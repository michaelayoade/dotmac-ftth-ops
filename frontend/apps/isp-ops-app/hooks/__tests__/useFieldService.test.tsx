/**
 * Unit Tests for Field Service Hooks
 * Tests for React Query hooks used in field service management
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import {
  useTechnicians,
  useTechnician,
  useClockIn,
  useClockOut,
  useTimeEntries,
  useAssignments,
  useAutoAssignTask,
  useEquipment,
  useVehicles,
  useAssignResource,
} from "../useFieldService";

const originalFetch = global.fetch;
const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;

// Create a wrapper for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useFieldService hooks", () => {
  beforeAll(() => {
    global.fetch = fetchMock;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockReset();
  });

  // ============================================================================
  // Technician Hooks
  // ============================================================================

  describe("useTechnicians", () => {
    it("fetches technicians list successfully", async () => {
      const mockData = {
        technicians: [
          {
            id: "tech-1",
            fullName: "John Doe",
            status: "active",
            skillLevel: "senior",
            isAvailable: true,
          },
          {
            id: "tech-2",
            fullName: "Jane Smith",
            status: "active",
            skillLevel: "expert",
            isAvailable: false,
          },
        ],
        total: 2,
        page: 1,
        pageSize: 20,
        hasMore: false,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const { result } = renderHook(() => useTechnicians({ status: ["active"] }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockData);
      expect(result.current.data?.technicians).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/field-service/technicians"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("handles error when fetching technicians", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useTechnicians({}), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useTechnician", () => {
    it("fetches single technician successfully", async () => {
      const mockTechnician = {
        id: "tech-1",
        fullName: "John Doe",
        email: "john@example.com",
        phone: "+234-800-000-0001",
        status: "active",
        skillLevel: "senior",
        skills: [
          { skill: "fiber_splicing", level: "expert", certified: true },
        ],
        isAvailable: true,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTechnician,
      });

      const { result } = renderHook(() => useTechnician("tech-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockTechnician);
      expect(result.current.data?.skills).toHaveLength(1);
    });
  });

  // ============================================================================
  // Time Tracking Hooks
  // ============================================================================

  describe("useClockIn", () => {
    it("clocks in successfully with GPS location", async () => {
      const mockResponse = {
        id: "entry-1",
        technicianId: "tech-1",
        clockIn: "2025-11-08T09:00:00Z",
        entryType: "regular",
        status: "draft",
        clockInLat: 6.5244,
        clockInLng: 3.3792,
        isActive: true,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useClockIn(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        technicianId: "tech-1",
        entryType: "regular",
        latitude: 6.5244,
        longitude: 3.3792,
        description: "Starting fiber installation",
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/time/clock-in"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("tech-1"),
        })
      );
    });
  });

  describe("useClockOut", () => {
    it("clocks out successfully", async () => {
      const mockResponse = {
        id: "entry-1",
        technicianId: "tech-1",
        clockIn: "2025-11-08T09:00:00Z",
        clockOut: "2025-11-08T17:00:00Z",
        entryType: "regular",
        status: "draft",
        totalHours: 8,
        isActive: false,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useClockOut(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        id: "entry-1",
        data: {
          breakDurationMinutes: 60,
          latitude: 6.5244,
          longitude: 3.3792,
        },
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockResponse);
      expect(result.current.data?.totalHours).toBe(8);
    });
  });

  describe("useTimeEntries", () => {
    it("fetches time entries with filters", async () => {
      const mockData = {
        entries: [
          {
            id: "entry-1",
            technicianId: "tech-1",
            clockIn: "2025-11-08T09:00:00Z",
            clockOut: "2025-11-08T17:00:00Z",
            status: "submitted",
            totalHours: 8,
            totalCost: 16000,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        hasMore: false,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const { result } = renderHook(
        () =>
          useTimeEntries({
            technicianId: "tech-1",
            status: ["submitted"],
            dateFrom: "2025-11-08",
            dateTo: "2025-11-08",
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.entries).toHaveLength(1);
      expect(result.current.data?.entries[0].totalCost).toBe(16000);
    });
  });

  // ============================================================================
  // Scheduling Hooks
  // ============================================================================

  describe("useAssignments", () => {
    it("fetches assignments with date filter", async () => {
      const mockData = {
        assignments: [
          {
            id: "assign-1",
            taskId: "task-1",
            technicianId: "tech-1",
            scheduledStart: "2025-11-08T09:00:00Z",
            scheduledEnd: "2025-11-08T12:00:00Z",
            status: "scheduled",
            taskLocationLat: 6.5244,
            taskLocationLng: 3.3792,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        hasMore: false,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const { result } = renderHook(
        () =>
          useAssignments({
            technicianId: "tech-1",
            dateFrom: "2025-11-08",
            dateTo: "2025-11-08",
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.assignments).toHaveLength(1);
      expect(result.current.data?.assignments[0].status).toBe("scheduled");
    });
  });

  describe("useAutoAssignTask", () => {
    it("auto-assigns task with AI scoring", async () => {
      const mockResponse = {
        id: "assign-1",
        taskId: "task-1",
        technicianId: "tech-2",
        scheduledStart: "2025-11-08T09:00:00Z",
        scheduledEnd: "2025-11-08T12:00:00Z",
        status: "scheduled",
        assignmentMethod: "auto",
        assignmentScore: 0.92,
        task: {
          id: "task-1",
          name: "Fiber Installation",
        },
        technician: {
          id: "tech-2",
          fullName: "Jane Smith",
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useAutoAssignTask(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        taskId: "task-1",
        scheduledStart: "2025-11-08T09:00:00Z",
        scheduledEnd: "2025-11-08T12:00:00Z",
        requiredSkills: { fiber_splicing: true },
        taskLocationLat: 6.5244,
        taskLocationLng: 3.3792,
        maxCandidates: 5,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockResponse);
      expect(result.current.data?.assignmentScore).toBe(0.92);
      expect(result.current.data?.assignmentMethod).toBe("auto");
    });
  });

  // ============================================================================
  // Resource Management Hooks
  // ============================================================================

  describe("useEquipment", () => {
    it("fetches equipment list with status filter", async () => {
      const mockData = {
        equipment: [
          {
            id: "equip-1",
            name: "Fusion Splicer FS-60",
            category: "fiber_tools",
            status: "available",
            requiresCalibration: true,
            nextCalibrationDue: "2025-12-01",
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        hasMore: false,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const { result } = renderHook(() => useEquipment({ status: ["available"] }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.equipment).toHaveLength(1);
      expect(result.current.data?.equipment[0].requiresCalibration).toBe(true);
    });
  });

  describe("useVehicles", () => {
    it("fetches vehicles list", async () => {
      const mockData = {
        vehicles: [
          {
            id: "vehicle-1",
            name: "Service Van #1",
            licensePlate: "LAG-001-AA",
            status: "available",
            vehicleType: "van",
            nextServiceDue: "2025-12-15",
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        hasMore: false,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const { result } = renderHook(() => useVehicles({}), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.vehicles).toHaveLength(1);
    });
  });

  describe("useAssignResource", () => {
    it("assigns equipment to technician", async () => {
      const mockResponse = {
        id: "assign-res-1",
        technicianId: "tech-1",
        equipmentId: "equip-1",
        assignedAt: "2025-11-08T08:00:00Z",
        expectedReturnAt: "2025-11-08T18:00:00Z",
        assignmentNotes: "For fiber installation project",
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useAssignResource(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        technicianId: "tech-1",
        equipmentId: "equip-1",
        expectedReturnAt: "2025-11-08T18:00:00Z",
        assignmentNotes: "For fiber installation project",
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockResponse);
    });

    it("assigns vehicle to technician", async () => {
      const mockResponse = {
        id: "assign-res-2",
        technicianId: "tech-1",
        vehicleId: "vehicle-1",
        assignedAt: "2025-11-08T08:00:00Z",
        expectedReturnAt: "2025-11-08T18:00:00Z",
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useAssignResource(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        technicianId: "tech-1",
        vehicleId: "vehicle-1",
        expectedReturnAt: "2025-11-08T18:00:00Z",
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.vehicleId).toBe("vehicle-1");
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe("Error handling", () => {
    it("handles 401 unauthorized errors", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: "Unauthorized" }),
      });

      const { result } = renderHook(() => useTechnicians({}), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("handles 500 server errors", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: "Internal server error" }),
      });

      const { result } = renderHook(() => useClockIn(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        technicianId: "tech-1",
        entryType: "regular",
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });
});
