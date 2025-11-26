/**
 * Jest Mock Tests for useFieldService hooks
 * Tests field service management with Jest mocks
 */

import { renderHook, waitFor, act } from "@testing-library/react";
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
import {
  TechnicianStatus,
  SkillLevel,
  TimeEntryType,
  TimeEntryStatus,
} from "@/types/field-service";

// Mock the AppConfigContext
jest.mock("@/providers/AppConfigContext", () => ({
  useAppConfig: () => ({
    api: {
      baseUrl: "http://localhost:3000",
      prefix: "/api/v1",
      buildUrl: (path: string) => `http://localhost:3000/api/v1${path}`,
    },
  }),
}));

// Mock fetch
global.fetch = jest.fn();

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Import MSW server to reset handlers
import { server } from "@/__tests__/msw/server";

const waitForFieldServiceSuccess = async (getStatus: () => boolean) => {
  await waitFor(() => expect(getStatus()).toBe(true), { timeout: 5000 });
};

const waitForFieldServiceLoading = async (getLoading: () => boolean) => {
  await waitFor(() => expect(getLoading()).toBe(false), { timeout: 5000 });
};

describe("useFieldService hooks (Jest Mocks)", () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnMount: false,
          refetchOnWindowFocus: false,
          staleTime: Infinity,
        },
        mutations: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  beforeAll(() => {
    // Disable MSW for these tests
    server.resetHandlers();
    server.close();
  });

  afterAll(() => {
    // Re-enable MSW for other tests
    server.listen();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Technician Hooks
  // ============================================================================

  describe("useTechnicians", () => {
    it("fetches technicians list successfully", async () => {
      const mockTechnicians = {
        technicians: [
          {
            id: "tech-1",
            fullName: "John Doe",
            status: TechnicianStatus.ACTIVE,
            skillLevel: SkillLevel.SENIOR,
            isAvailable: true,
          },
          {
            id: "tech-2",
            fullName: "Jane Smith",
            status: TechnicianStatus.ACTIVE,
            skillLevel: SkillLevel.EXPERT,
            isAvailable: false,
          },
        ],
        total: 2,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTechnicians,
      } as Response);

      const { result } = renderHook(() => useTechnicians({ status: [TechnicianStatus.ACTIVE] }), {
        wrapper: createWrapper(),
      });

      await waitForFieldServiceSuccess(() => result.current.isSuccess);

      expect(result.current.data?.technicians).toHaveLength(2);
      expect(result.current.data?.total).toBe(2);
    });

    it("filters technicians by availability", async () => {
      const mockTechnicians = {
        technicians: [
          {
            id: "tech-1",
            isAvailable: true,
          },
        ],
        total: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTechnicians,
      } as Response);

      const { result } = renderHook(() => useTechnicians({ isAvailable: true }), {
        wrapper: createWrapper(),
      });

      await waitForFieldServiceSuccess(() => result.current.isSuccess);

      expect(result.current.data?.technicians).toHaveLength(1);
      expect(result.current.data?.technicians[0].isAvailable).toBe(true);
    });
  });

  describe("useTechnician", () => {
    it("fetches single technician successfully", async () => {
      const mockTechnician = {
        id: "tech-1",
        fullName: "John Doe",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTechnician,
      } as Response);

      const { result } = renderHook(() => useTechnician("tech-1"), {
        wrapper: createWrapper(),
      });

      await waitForFieldServiceSuccess(() => result.current.isSuccess);

      expect(result.current.data?.id).toBe("tech-1");
      expect(result.current.data?.fullName).toBe("John Doe");
    });

    it("handles technician not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: "Technician not found" }),
      } as Response);

      const { result } = renderHook(() => useTechnician("non-existent"), {
        wrapper: createWrapper(),
      });

      await waitForFieldServiceLoading(() => result.current.isLoading);

      expect(result.current.error).toBeTruthy();
    });
  });

  // ============================================================================
  // Time Tracking Hooks
  // ============================================================================

  describe("useClockIn", () => {
    it("clocks in successfully with GPS location", async () => {
      const mockTimeEntry = {
        id: "entry-1",
        technicianId: "tech-1",
        entryType: TimeEntryType.REGULAR,
        clockInLat: 6.5244,
        clockInLng: 3.3792,
        isActive: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTimeEntry,
      } as Response);

      const { result } = renderHook(() => useClockIn(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          technicianId: "tech-1",
          entryType: TimeEntryType.REGULAR,
          latitude: 6.5244,
          longitude: 3.3792,
          description: "Starting fiber installation",
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.technicianId).toBe("tech-1");
      expect(result.current.data?.entryType).toBe(TimeEntryType.REGULAR);
      expect(result.current.data?.clockInLat).toBe(6.5244);
      expect(result.current.data?.clockInLng).toBe(3.3792);
      expect(result.current.data?.isActive).toBe(true);
    });
  });

  describe("useClockOut", () => {
    it("clocks out successfully", async () => {
      const mockTimeEntry = {
        id: "entry-1",
        technicianId: "tech-1",
        clockOut: new Date().toISOString(),
        totalHours: 8,
        isActive: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTimeEntry,
      } as Response);

      const { result } = renderHook(() => useClockOut(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          id: "entry-1",
          data: {
            breakDurationMinutes: 60,
            latitude: 6.5244,
            longitude: 3.3792,
          },
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.clockOut).toBeDefined();
      expect(result.current.data?.totalHours).toBeDefined();
      expect(result.current.data?.isActive).toBe(false);
    });
  });

  describe("useTimeEntries", () => {
    it("fetches time entries with filters", async () => {
      const mockEntries = {
        entries: [
          {
            id: "entry-1",
            technicianId: "tech-1",
            status: TimeEntryStatus.SUBMITTED,
            totalHours: 8,
          },
        ],
        total: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEntries,
      } as Response);

      const { result } = renderHook(() => useTimeEntries({ technicianId: "tech-1" }), {
        wrapper: createWrapper(),
      });

      await waitForFieldServiceSuccess(() => result.current.isSuccess);

      expect(result.current.data?.entries).toHaveLength(1);
      expect(result.current.data?.entries[0].technicianId).toBe("tech-1");
    });

    it("filters by status", async () => {
      const mockEntries = {
        entries: [
          {
            id: "entry-1",
            status: TimeEntryStatus.SUBMITTED,
          },
        ],
        total: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEntries,
      } as Response);

      const { result } = renderHook(() => useTimeEntries({ status: [TimeEntryStatus.SUBMITTED] }), {
        wrapper: createWrapper(),
      });

      await waitForFieldServiceSuccess(() => result.current.isSuccess);

      expect(result.current.data?.entries).toHaveLength(1);
      expect(result.current.data?.entries[0].status).toBe(TimeEntryStatus.SUBMITTED);
    });
  });

  // ============================================================================
  // Assignment Hooks
  // ============================================================================

  describe("useAssignments", () => {
    it("fetches assignments with filters", async () => {
      const mockAssignments = {
        assignments: [
          {
            id: "assign-1",
            technicianId: "tech-1",
            taskId: "task-1",
          },
        ],
        total: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAssignments,
      } as Response);

      const { result } = renderHook(() => useAssignments({ technicianId: "tech-1" }), {
        wrapper: createWrapper(),
      });

      await waitForFieldServiceSuccess(() => result.current.isSuccess);

      expect(result.current.data?.assignments).toHaveLength(1);
      expect(result.current.data?.assignments[0].technicianId).toBe("tech-1");
    });
  });

  describe("useAutoAssignTask", () => {
    it("auto-assigns task to best available technician", async () => {
      const mockAssignment = {
        id: "assign-1",
        technicianId: "tech-1",
        taskId: "task-1",
        assignmentMethod: "auto",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAssignment,
      } as Response);

      const { result } = renderHook(() => useAutoAssignTask(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          taskId: "task-1",
          scheduledStart: new Date(Date.now() + 3600000).toISOString(),
          scheduledEnd: new Date(Date.now() + 7200000).toISOString(),
          requiredSkills: { fiber: true },
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.technicianId).toBe("tech-1");
      expect(result.current.data?.taskId).toBe("task-1");
      expect(result.current.data?.assignmentMethod).toBe("auto");
    });

    it("handles no available technicians", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: "No available technicians" }),
      } as Response);

      const { result } = renderHook(() => useAutoAssignTask(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            taskId: "task-1",
            scheduledStart: new Date(Date.now() + 3600000).toISOString(),
            scheduledEnd: new Date(Date.now() + 7200000).toISOString(),
          });
        } catch (error) {
          // Expected to fail
        }
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  // ============================================================================
  // Resource Hooks
  // ============================================================================

  describe("useEquipment", () => {
    it("fetches equipment list with filters", async () => {
      const mockEquipment = {
        equipment: [
          {
            id: "equip-1",
            name: "Fusion Splicer",
            category: "fiber-tools",
          },
          {
            id: "equip-2",
            name: "OTDR",
            category: "fiber-tools",
          },
        ],
        total: 2,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEquipment,
      } as Response);

      const { result } = renderHook(() => useEquipment({ category: ["fiber-tools"] }), {
        wrapper: createWrapper(),
      });

      await waitForFieldServiceSuccess(() => result.current.isSuccess);

      expect(result.current.data?.equipment).toHaveLength(2);
      expect(result.current.data?.equipment[0].category).toBe("fiber-tools");
    });
  });

  describe("useVehicles", () => {
    it("fetches vehicles list", async () => {
      const mockVehicles = {
        vehicles: [
          {
            id: "vehicle-1",
            name: "Service Van 1",
            vehicleType: "van",
          },
          {
            id: "vehicle-2",
            name: "Service Van 2",
            vehicleType: "van",
          },
        ],
        total: 2,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockVehicles,
      } as Response);

      const { result } = renderHook(() => useVehicles({}), {
        wrapper: createWrapper(),
      });

      await waitForFieldServiceSuccess(() => result.current.isSuccess);

      expect(result.current.data?.vehicles).toHaveLength(2);
    });
  });

  describe("useAssignResource", () => {
    it("assigns equipment to technician successfully", async () => {
      const mockAssignment = {
        id: "assignment-1",
        technicianId: "tech-1",
        equipmentId: "equip-1",
        isActive: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAssignment,
      } as Response);

      const { result } = renderHook(() => useAssignResource(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          technicianId: "tech-1",
          equipmentId: "equip-1",
          taskId: "task-1",
          expectedReturnAt: new Date(Date.now() + 86400000).toISOString(),
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.technicianId).toBe("tech-1");
      expect(result.current.data?.equipmentId).toBe("equip-1");
      expect(result.current.data?.isActive).toBe(true);
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe("Error handling", () => {
    it("handles API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: "Technician not found" }),
      } as Response);

      const { result } = renderHook(() => useTechnician("non-existent"), {
        wrapper: createWrapper(),
      });

      await waitForFieldServiceLoading(() => result.current.isLoading);

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });
});
