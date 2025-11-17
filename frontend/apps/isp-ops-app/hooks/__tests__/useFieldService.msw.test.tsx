/**
 * MSW Tests for useFieldService hooks
 * Tests field service management with realistic API mocking
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
  seedFieldServiceData,
  clearFieldServiceData,
  createMockTechnician,
  createMockTimeEntry,
  createMockAssignment,
  createMockEquipment,
  createMockVehicle,
} from "@/__tests__/msw/handlers/field-service";
import { TechnicianStatus, SkillLevel, TimeEntryType, TimeEntryStatus } from "@/types/field-service";

const waitForFieldServiceSuccess = async (getStatus: () => boolean) => {
  await waitFor(() => expect(getStatus()).toBe(true), { timeout: 5000 });
};

const waitForFieldServiceLoading = async (getLoading: () => boolean) => {
  await waitFor(() => expect(getLoading()).toBe(false), { timeout: 5000 });
};

describe("useFieldService hooks (MSW)", () => {
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

  beforeEach(() => {
    clearFieldServiceData();
  });

  // ============================================================================
  // Technician Hooks
  // ============================================================================

  describe("useTechnicians", () => {
    it("fetches technicians list successfully", async () => {
      const mockTechnicians = [
        createMockTechnician({
          id: "tech-1",
          fullName: "John Doe",
          status: TechnicianStatus.ACTIVE,
          skillLevel: SkillLevel.SENIOR,
          isAvailable: true,
        }),
        createMockTechnician({
          id: "tech-2",
          fullName: "Jane Smith",
          status: TechnicianStatus.ACTIVE,
          skillLevel: SkillLevel.EXPERT,
          isAvailable: false,
        }),
      ];

      seedFieldServiceData({ technicians: mockTechnicians });

      const { result } = renderHook(
        () => useTechnicians({ status: [TechnicianStatus.ACTIVE] }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitForFieldServiceSuccess(() => result.current.isSuccess);

      expect(result.current.data?.technicians).toHaveLength(2);
      expect(result.current.data?.total).toBe(2);
    });

    it("filters technicians by availability", async () => {
      const mockTechnicians = [
        createMockTechnician({
          id: "tech-1",
          isAvailable: true,
        }),
        createMockTechnician({
          id: "tech-2",
          isAvailable: false,
        }),
      ];

      seedFieldServiceData({ technicians: mockTechnicians });

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
      const mockTechnician = createMockTechnician({
        id: "tech-1",
        fullName: "John Doe",
      });

      seedFieldServiceData({ technicians: [mockTechnician] });

      const { result } = renderHook(() => useTechnician("tech-1"), {
        wrapper: createWrapper(),
      });

      await waitForFieldServiceSuccess(() => result.current.isSuccess);

      expect(result.current.data?.id).toBe("tech-1");
      expect(result.current.data?.fullName).toBe("John Doe");
    });

    it("handles technician not found", async () => {
      seedFieldServiceData({ technicians: [] });

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

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.technicianId).toBe("tech-1");
      expect(result.current.data?.entryType).toBe(TimeEntryType.REGULAR);
      expect(result.current.data?.clockInLat).toBe(6.5244);
      expect(result.current.data?.clockInLng).toBe(3.3792);
      expect(result.current.data?.isActive).toBe(true);
    });
  });

  describe("useClockOut", () => {
    it("clocks out successfully", async () => {
      const mockEntry = createMockTimeEntry({
        id: "entry-1",
        technicianId: "tech-1",
        isActive: true,
      });

      seedFieldServiceData({ timeEntries: [mockEntry] });

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

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.clockOut).toBeDefined();
      expect(result.current.data?.totalHours).toBeDefined();
      expect(result.current.data?.isActive).toBe(false);
    });
  });

  describe("useTimeEntries", () => {
    it("fetches time entries with filters", async () => {
      const mockEntries = [
        createMockTimeEntry({
          id: "entry-1",
          technicianId: "tech-1",
          status: TimeEntryStatus.SUBMITTED,
          totalHours: 8,
        }),
        createMockTimeEntry({
          id: "entry-2",
          technicianId: "tech-2",
          status: TimeEntryStatus.DRAFT,
        }),
      ];

      seedFieldServiceData({ timeEntries: mockEntries });

      const { result } = renderHook(
        () => useTimeEntries({ technicianId: "tech-1" }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitForFieldServiceSuccess(() => result.current.isSuccess);

      expect(result.current.data?.entries).toHaveLength(1);
      expect(result.current.data?.entries[0].technicianId).toBe("tech-1");
    });

    it("filters by status", async () => {
      const mockEntries = [
        createMockTimeEntry({
          id: "entry-1",
          status: TimeEntryStatus.SUBMITTED,
        }),
        createMockTimeEntry({
          id: "entry-2",
          status: TimeEntryStatus.DRAFT,
        }),
      ];

      seedFieldServiceData({ timeEntries: mockEntries });

      const { result } = renderHook(
        () => useTimeEntries({ status: [TimeEntryStatus.SUBMITTED] }),
        {
          wrapper: createWrapper(),
        }
      );

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
      const mockAssignments = [
        createMockAssignment({
          id: "assign-1",
          technicianId: "tech-1",
          taskId: "task-1",
        }),
        createMockAssignment({
          id: "assign-2",
          technicianId: "tech-2",
          taskId: "task-2",
        }),
      ];

      seedFieldServiceData({ assignments: mockAssignments });

      const { result } = renderHook(
        () => useAssignments({ technicianId: "tech-1" }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitForFieldServiceSuccess(() => result.current.isSuccess);

      expect(result.current.data?.assignments).toHaveLength(1);
      expect(result.current.data?.assignments[0].technicianId).toBe("tech-1");
    });
  });

  describe("useAutoAssignTask", () => {
    it("auto-assigns task to best available technician", async () => {
      const mockTechnician = createMockTechnician({
        id: "tech-1",
        isAvailable: true,
        skillLevel: SkillLevel.SENIOR,
      });

      seedFieldServiceData({ technicians: [mockTechnician] });

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

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.technicianId).toBe("tech-1");
      expect(result.current.data?.taskId).toBe("task-1");
      expect(result.current.data?.assignmentMethod).toBe("auto");
    });

    it("handles no available technicians", async () => {
      seedFieldServiceData({ technicians: [] });

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

      expect(result.current.isError).toBe(true);
    });
  });

  // ============================================================================
  // Resource Hooks
  // ============================================================================

  describe("useEquipment", () => {
    it("fetches equipment list with filters", async () => {
      const mockEquipment = [
        createMockEquipment({
          id: "equip-1",
          name: "Fusion Splicer",
          category: "fiber-tools",
        }),
        createMockEquipment({
          id: "equip-2",
          name: "OTDR",
          category: "fiber-tools",
        }),
      ];

      seedFieldServiceData({ equipment: mockEquipment });

      const { result } = renderHook(
        () => useEquipment({ category: ["fiber-tools"] }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitForFieldServiceSuccess(() => result.current.isSuccess);

      expect(result.current.data?.equipment).toHaveLength(2);
      expect(result.current.data?.equipment[0].category).toBe("fiber-tools");
    });
  });

  describe("useVehicles", () => {
    it("fetches vehicles list", async () => {
      const mockVehicles = [
        createMockVehicle({
          id: "vehicle-1",
          name: "Service Van 1",
          vehicleType: "van",
        }),
        createMockVehicle({
          id: "vehicle-2",
          name: "Service Van 2",
          vehicleType: "van",
        }),
      ];

      seedFieldServiceData({ vehicles: mockVehicles });

      const { result } = renderHook(() => useVehicles({}), {
        wrapper: createWrapper(),
      });

      await waitForFieldServiceSuccess(() => result.current.isSuccess);

      expect(result.current.data?.vehicles).toHaveLength(2);
    });
  });

  describe("useAssignResource", () => {
    it("assigns equipment to technician successfully", async () => {
      const mockEquipment = createMockEquipment({
        id: "equip-1",
      });

      seedFieldServiceData({ equipment: [mockEquipment] });

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

      expect(result.current.isSuccess).toBe(true);
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
      seedFieldServiceData({ technicians: [] });

      const { result } = renderHook(() => useTechnician("non-existent"), {
        wrapper: createWrapper(),
      });

      await waitForFieldServiceLoading(() => result.current.isLoading);

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });
});
