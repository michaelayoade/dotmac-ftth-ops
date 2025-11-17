/**
 * MSW-powered tests for useTechnicians
 *
 * This test file uses MSW for API mocking instead of jest.mock.
 * MSW provides more realistic network mocking and better test isolation.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { server } from "@/__tests__/msw/server";
import { techniciansHandlers } from "@/__tests__/msw/handlers/technicians";
import {
  useTechnicians,
  useTechnician,
  useActiveTechnicianLocations,
  useTechnicianLocationHistory,
  useTechniciansWithLocations,
} from "../useTechnicians";
import {
  createTestQueryClient,
  createQueryWrapper,
  resetTechniciansStorage,
  createMockTechnician,
  createMockTechnicianLocation,
  seedTechniciansData,
  seedLocationHistory,
  makeApiEndpointFail,
} from "../../__tests__/test-utils";

describe("useTechnicians (MSW)", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    resetTechniciansStorage();
    // Ensure technician-specific handlers take precedence over field-service handlers
    server.use(...techniciansHandlers);
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("useTechnicians - fetch technicians", () => {
    it("should fetch technicians successfully", async () => {
      const mockTechnicians = [
        createMockTechnician({
          id: "tech-1",
          first_name: "John",
          last_name: "Smith",
          email: "john@example.com",
          status: "available",
        }),
        createMockTechnician({
          id: "tech-2",
          first_name: "Jane",
          last_name: "Doe",
          email: "jane@example.com",
          status: "on_job",
        }),
      ];

      seedTechniciansData(mockTechnicians);

      const { result } = renderHook(() => useTechnicians(), {
        wrapper: createQueryWrapper(queryClient),
      });

      // Should start in loading state
      expect(result.current.isLoading).toBe(true);

      // Wait for data to load
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Verify data matches
      expect(result.current.data?.technicians).toHaveLength(2);
      expect(result.current.data?.technicians[0].id).toBe("tech-1");
      expect(result.current.data?.technicians[0].first_name).toBe("John");
      expect(result.current.data?.total).toBe(2);
      expect(result.current.error).toBeNull();
    });

    it("should handle empty technician list", async () => {
      seedTechniciansData([]);

      const { result } = renderHook(() => useTechnicians(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.technicians).toHaveLength(0);
      expect(result.current.data?.total).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it("should filter technicians by status", async () => {
      const technicians = [
        createMockTechnician({ id: "tech-1", status: "available" }),
        createMockTechnician({ id: "tech-2", status: "on_job" }),
        createMockTechnician({ id: "tech-3", status: "available" }),
        createMockTechnician({ id: "tech-4", status: "off_duty" }),
      ];

      seedTechniciansData(technicians);

      const { result } = renderHook(() => useTechnicians({ status: "available" }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.technicians).toHaveLength(2);
      expect(result.current.data?.technicians.every((t) => t.status === "available")).toBe(true);
    });

    it("should filter technicians by is_active", async () => {
      const technicians = [
        createMockTechnician({ id: "tech-1", is_active: true }),
        createMockTechnician({ id: "tech-2", is_active: false }),
        createMockTechnician({ id: "tech-3", is_active: true }),
      ];

      seedTechniciansData(technicians);

      const { result } = renderHook(() => useTechnicians({ is_active: true }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.technicians).toHaveLength(2);
      expect(result.current.data?.technicians.every((t) => t.is_active === true)).toBe(true);
    });

    it("should handle pagination with limit and offset", async () => {
      const technicians = Array.from({ length: 10 }, (_, i) =>
        createMockTechnician({ id: `tech-${i + 1}` })
      );

      seedTechniciansData(technicians);

      const { result } = renderHook(() => useTechnicians({ limit: 5, offset: 5 }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.technicians).toHaveLength(5);
      expect(result.current.data?.technicians[0].id).toBe("tech-6");
      expect(result.current.data?.offset).toBe(5);
      expect(result.current.data?.limit).toBe(5);
      expect(result.current.data?.total).toBe(10);
    });

    it("should handle API errors", async () => {
      makeApiEndpointFail("get", "/field-service/technicians", "Server error", 500);

      const { result } = renderHook(() => useTechnicians(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should use correct query keys for caching", async () => {
      seedTechniciansData([createMockTechnician()]);

      const { result: result1 } = renderHook(
        () => useTechnicians({ status: "available" }),
        { wrapper: createQueryWrapper(queryClient) }
      );

      await waitFor(() => expect(result1.current.isLoading).toBe(false));

      // Same query should use cache
      const { result: result2 } = renderHook(
        () => useTechnicians({ status: "available" }),
        { wrapper: createQueryWrapper(queryClient) }
      );

      // Should immediately have data from cache
      expect(result2.current.data).toBeDefined();
    });
  });

  describe("useTechnician - fetch single technician", () => {
    it("should fetch a single technician successfully", async () => {
      const mockTechnician = createMockTechnician({
        id: "tech-1",
        first_name: "John",
        last_name: "Smith",
        email: "john@example.com",
        skill_level: "senior",
      });

      seedTechniciansData([mockTechnician]);

      const { result } = renderHook(() => useTechnician("tech-1"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.id).toBe("tech-1");
      expect(result.current.data?.first_name).toBe("John");
      expect(result.current.data?.skill_level).toBe("senior");
      expect(result.current.error).toBeNull();
    });

    it("should return null when technicianId is null", async () => {
      const { result } = renderHook(() => useTechnician(null), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
    });

    it("should handle technician not found", async () => {
      seedTechniciansData([]);

      const { result } = renderHook(() => useTechnician("non-existent"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeTruthy();
    });

    it("should not fetch when enabled is false (technicianId is null)", async () => {
      const { result } = renderHook(() => useTechnician(null), {
        wrapper: createQueryWrapper(queryClient),
      });

      // Should not be in loading state because query is disabled
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it("should update when technicianId changes", async () => {
      const tech1 = createMockTechnician({ id: "tech-1", first_name: "John" });
      const tech2 = createMockTechnician({ id: "tech-2", first_name: "Jane" });

      seedTechniciansData([tech1, tech2]);

      const { result, rerender } = renderHook(
        ({ id }) => useTechnician(id),
        {
          wrapper: createQueryWrapper(queryClient),
          initialProps: { id: "tech-1" },
        }
      );

      await waitFor(() => expect(result.current.data?.first_name).toBe("John"));

      // Change ID
      rerender({ id: "tech-2" });

      await waitFor(() => expect(result.current.data?.first_name).toBe("Jane"));
    });
  });

  describe("useActiveTechnicianLocations - fetch active locations", () => {
    it("should fetch active technician locations successfully", async () => {
      const technicians = [
        createMockTechnician({
          id: "tech-1",
          first_name: "John",
          last_name: "Smith",
          is_active: true,
          current_lat: 40.7128,
          current_lng: -74.0060,
          status: "available",
        }),
        createMockTechnician({
          id: "tech-2",
          first_name: "Jane",
          last_name: "Doe",
          is_active: true,
          current_lat: 34.0522,
          current_lng: -118.2437,
          status: "on_job",
        }),
        createMockTechnician({
          id: "tech-3",
          first_name: "Bob",
          last_name: "Wilson",
          is_active: false, // Not active, should be excluded
          current_lat: 41.8781,
          current_lng: -87.6298,
        }),
      ];

      seedTechniciansData(technicians);

      const { result } = renderHook(() => useActiveTechnicianLocations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].technician_id).toBe("tech-1");
      expect(result.current.data?.[0].technician_name).toBe("John Smith");
      expect(result.current.data?.[0].latitude).toBe(40.7128);
      expect(result.current.data?.[0].longitude).toBe(-74.0060);
    });

    it("should filter out technicians without valid coordinates", async () => {
      const technicians = [
        createMockTechnician({
          id: "tech-1",
          is_active: true,
          current_lat: 40.7128,
          current_lng: -74.0060,
        }),
        createMockTechnician({
          id: "tech-2",
          is_active: true,
          current_lat: null, // No coordinates
          current_lng: null,
        }),
      ];

      seedTechniciansData(technicians);

      const { result } = renderHook(() => useActiveTechnicianLocations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].technician_id).toBe("tech-1");
    });

    it("should handle empty active locations", async () => {
      seedTechniciansData([
        createMockTechnician({ is_active: false }),
      ]);

      const { result } = renderHook(() => useActiveTechnicianLocations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(0);
    });

    it("should handle API errors", async () => {
      makeApiEndpointFail(
        "get",
        "/field-service/technicians/locations/active",
        "Server error",
        500
      );

      const { result } = renderHook(() => useActiveTechnicianLocations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useTechnicianLocationHistory - fetch location history", () => {
    it("should fetch location history successfully", async () => {
      const technician = createMockTechnician({ id: "tech-1" });
      const history = [
        createMockTechnicianLocation("tech-1", {
          latitude: 40.7128,
          longitude: -74.0060,
          last_update: "2025-01-01T10:00:00Z",
        }),
        createMockTechnicianLocation("tech-1", {
          latitude: 40.7580,
          longitude: -73.9855,
          last_update: "2025-01-01T11:00:00Z",
        }),
      ];

      seedTechniciansData([technician]);
      seedLocationHistory("tech-1", history);

      const { result } = renderHook(() => useTechnicianLocationHistory("tech-1"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].latitude).toBe(40.7128);
      expect(result.current.data?.[1].latitude).toBe(40.7580);
    });

    it("should return null when technicianId is null", async () => {
      const { result } = renderHook(() => useTechnicianLocationHistory(null), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
    });

    it("should filter by time range", async () => {
      const technician = createMockTechnician({ id: "tech-1" });
      const history = [
        createMockTechnicianLocation("tech-1", {
          last_update: "2025-01-01T10:00:00Z",
        }),
        createMockTechnicianLocation("tech-1", {
          last_update: "2025-01-02T10:00:00Z",
        }),
        createMockTechnicianLocation("tech-1", {
          last_update: "2025-01-03T10:00:00Z",
        }),
      ];

      seedTechniciansData([technician]);
      seedLocationHistory("tech-1", history);

      const { result } = renderHook(
        () =>
          useTechnicianLocationHistory("tech-1", {
            startTime: "2025-01-02T00:00:00Z",
            endTime: "2025-01-02T23:59:59Z",
          }),
        {
          wrapper: createQueryWrapper(queryClient),
        }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].last_update).toBe("2025-01-02T10:00:00Z");
    });

    it("should respect limit parameter", async () => {
      const technician = createMockTechnician({ id: "tech-1" });
      const history = Array.from({ length: 200 }, (_, i) =>
        createMockTechnicianLocation("tech-1", {
          last_update: new Date(2025, 0, 1, i).toISOString(),
        })
      );

      seedTechniciansData([technician]);
      seedLocationHistory("tech-1", history);

      const { result } = renderHook(
        () => useTechnicianLocationHistory("tech-1", { limit: 50 }),
        {
          wrapper: createQueryWrapper(queryClient),
        }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(50);
    });

    it("should handle empty location history", async () => {
      const technician = createMockTechnician({ id: "tech-1" });
      seedTechniciansData([technician]);
      seedLocationHistory("tech-1", []);

      const { result } = renderHook(() => useTechnicianLocationHistory("tech-1"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(0);
    });
  });

  describe("useTechniciansWithLocations - helper hook", () => {
    it("should filter out technicians without valid locations", async () => {
      const technicians = [
        createMockTechnician({
          id: "tech-1",
          is_active: true,
          current_lat: 40.7128,
          current_lng: -74.0060,
        }),
        createMockTechnician({
          id: "tech-2",
          is_active: true,
          current_lat: null,
          current_lng: null,
        }),
        createMockTechnician({
          id: "tech-3",
          is_active: true,
          current_lat: 34.0522,
          current_lng: -118.2437,
        }),
      ];

      seedTechniciansData(technicians);

      const { result } = renderHook(() => useTechniciansWithLocations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Should only return tech-1 and tech-3
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data[0].technician_id).toBe("tech-1");
      expect(result.current.data[1].technician_id).toBe("tech-3");
    });

    it("should return empty array when no technicians have locations", async () => {
      const technicians = [
        createMockTechnician({
          id: "tech-1",
          is_active: true,
          current_lat: null,
          current_lng: null,
        }),
      ];

      seedTechniciansData(technicians);

      const { result } = renderHook(() => useTechniciansWithLocations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(0);
    });

    it("should filter undefined coordinates", async () => {
      const technicians = [
        createMockTechnician({
          id: "tech-1",
          is_active: true,
          current_lat: 40.7128,
          current_lng: -74.0060,
        }),
        createMockTechnician({
          id: "tech-2",
          is_active: true,
          current_lat: undefined as any,
          current_lng: undefined as any,
        }),
      ];

      seedTechniciansData(technicians);

      const { result } = renderHook(() => useTechniciansWithLocations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0].technician_id).toBe("tech-1");
    });
  });

  describe("Technician filtering and search scenarios", () => {
    it("should filter by skill level", async () => {
      const technicians = [
        createMockTechnician({ id: "tech-1", skill_level: "junior" }),
        createMockTechnician({ id: "tech-2", skill_level: "senior" }),
        createMockTechnician({ id: "tech-3", skill_level: "senior" }),
        createMockTechnician({ id: "tech-4", skill_level: "expert" }),
      ];

      seedTechniciansData(technicians);

      const { result } = renderHook(() => useTechnicians(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const seniors = result.current.data?.technicians.filter(
        (t) => t.skill_level === "senior"
      );
      expect(seniors).toHaveLength(2);
    });

    it("should filter by multiple statuses", async () => {
      const technicians = [
        createMockTechnician({ id: "tech-1", status: "available" }),
        createMockTechnician({ id: "tech-2", status: "on_job" }),
        createMockTechnician({ id: "tech-3", status: "off_duty" }),
        createMockTechnician({ id: "tech-4", status: "on_break" }),
      ];

      seedTechniciansData(technicians);

      const { result } = renderHook(() => useTechnicians(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const workingTechs = result.current.data?.technicians.filter(
        (t) => t.status === "available" || t.status === "on_job"
      );
      expect(workingTechs).toHaveLength(2);
    });

    it("should handle technicians with certifications", async () => {
      const technicians = [
        createMockTechnician({
          id: "tech-1",
          certifications: [
            { name: "Fiber Optics Certified", expires: "2025-12-31" },
            { name: "Safety Training", expires: "2026-06-30" },
          ],
        }),
        createMockTechnician({
          id: "tech-2",
          certifications: [],
        }),
      ];

      seedTechniciansData(technicians);

      const { result } = renderHook(() => useTechnicians(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const certifiedTechs = result.current.data?.technicians.filter(
        (t) => t.certifications && t.certifications.length > 0
      );
      expect(certifiedTechs).toHaveLength(1);
      expect(certifiedTechs?.[0].certifications).toHaveLength(2);
    });

    it("should handle technicians with service areas", async () => {
      const technicians = [
        createMockTechnician({
          id: "tech-1",
          service_areas: ["New York", "Brooklyn"],
        }),
        createMockTechnician({
          id: "tech-2",
          service_areas: ["Manhattan", "Queens"],
        }),
        createMockTechnician({
          id: "tech-3",
          service_areas: ["New York", "Manhattan"],
        }),
      ];

      seedTechniciansData(technicians);

      const { result } = renderHook(() => useTechnicians(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const nyTechs = result.current.data?.technicians.filter(
        (t) => t.service_areas?.includes("New York")
      );
      expect(nyTechs).toHaveLength(2);
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle technician with minimal data", async () => {
      const minimalTech = createMockTechnician({
        phone: null,
        mobile: null,
        home_base_lat: null,
        home_base_lng: null,
        current_lat: null,
        current_lng: null,
        service_areas: null,
        skills: null,
        certifications: null,
      });

      seedTechniciansData([minimalTech]);

      const { result } = renderHook(() => useTechnicians(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.technicians).toHaveLength(1);
      expect(result.current.data?.technicians[0].phone).toBeNull();
    });

    it("should handle network errors gracefully", async () => {
      makeApiEndpointFail("get", "/field-service/technicians", "Network error", 500);

      const { result } = renderHook(() => useTechnicians(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should handle 404 for individual technician", async () => {
      seedTechniciansData([]);

      const { result } = renderHook(() => useTechnician("non-existent-id"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeTruthy();
    });

    it("should handle very large datasets with pagination", async () => {
      const largeTechnicianSet = Array.from({ length: 1000 }, (_, i) =>
        createMockTechnician({ id: `tech-${i + 1}` })
      );

      seedTechniciansData(largeTechnicianSet);

      const { result } = renderHook(() => useTechnicians({ limit: 100, offset: 500 }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.technicians).toHaveLength(100);
      expect(result.current.data?.technicians[0].id).toBe("tech-501");
      expect(result.current.data?.total).toBe(1000);
    });
  });

  describe("Performance and caching", () => {
    it("should cache technician list queries", async () => {
      const technicians = [createMockTechnician({ id: "tech-1" })];
      seedTechniciansData(technicians);

      // First render
      const { result: result1 } = renderHook(() => useTechnicians(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result1.current.isLoading).toBe(false));

      // Second render with same params should use cache
      const { result: result2 } = renderHook(() => useTechnicians(), {
        wrapper: createQueryWrapper(queryClient),
      });

      // Should have data immediately from cache
      expect(result2.current.data).toBeDefined();
      expect(result2.current.data?.technicians).toHaveLength(1);
    });

    it("should use separate cache keys for different filters", async () => {
      const technicians = [
        createMockTechnician({ id: "tech-1", status: "available" }),
        createMockTechnician({ id: "tech-2", status: "on_job" }),
      ];

      seedTechniciansData(technicians);

      // Query with available status
      const { result: result1 } = renderHook(
        () => useTechnicians({ status: "available" }),
        { wrapper: createQueryWrapper(queryClient) }
      );

      await waitFor(() => expect(result1.current.isLoading).toBe(false));

      // Query with on_job status (different cache key)
      const { result: result2 } = renderHook(
        () => useTechnicians({ status: "on_job" }),
        { wrapper: createQueryWrapper(queryClient) }
      );

      await waitFor(() => expect(result2.current.isLoading).toBe(false));

      // Both should have different data
      expect(result1.current.data?.technicians).toHaveLength(1);
      expect(result2.current.data?.technicians).toHaveLength(1);
      expect(result1.current.data?.technicians[0].id).toBe("tech-1");
      expect(result2.current.data?.technicians[0].id).toBe("tech-2");
    });
  });
});
