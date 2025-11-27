/**
 * Jest Tests for useTechnicians Hooks
 *
 * Tests all technician management and location tracking hooks with Jest mocks.
 * Covers technician list, individual technician, active locations, location history,
 * and helper functions.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "@/__tests__/test-utils";
import {
  useTechnicians,
  useTechnician,
  useActiveTechnicianLocations,
  useTechnicianLocationHistory,
  useTechniciansWithLocations,
  type Technician,
  type TechnicianLocation,
  type TechniciansResponse,
} from "../useTechnicians";
import { apiClient } from "@/lib/api/client";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Test data factories
const createMockTechnician = (overrides: Partial<Technician> = {}): Technician => ({
  id: "tech-001",
  tenant_id: "tenant-001",
  employee_id: "EMP-001",
  first_name: "John",
  last_name: "Doe",
  email: "john.doe@example.com",
  phone: "+1234567890",
  mobile: "+1234567891",
  status: "available",
  skill_level: "senior",
  home_base_lat: 40.7128,
  home_base_lng: -74.006,
  home_base_address: "123 Main St, New York, NY",
  current_lat: 40.7589,
  current_lng: -73.9851,
  last_location_update: "2024-01-01T12:00:00Z",
  service_areas: ["area-001", "area-002"],
  working_hours_start: "09:00",
  working_hours_end: "17:00",
  working_days: [1, 2, 3, 4, 5],
  is_on_call: false,
  available_for_emergency: true,
  skills: { fiber_splicing: true, cabinet_installation: true },
  certifications: [{ name: "Fiber Optics", expires: "2025-12-31" }],
  equipment: { tools: ["splicer", "otdr"] },
  jobs_completed: 150,
  average_rating: 4.8,
  completion_rate: 0.95,
  is_active: true,
  created_at: "2023-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

const createMockTechnicianLocation = (
  overrides: Partial<TechnicianLocation> = {},
): TechnicianLocation => ({
  technician_id: "tech-001",
  technician_name: "John Doe",
  latitude: 40.7128,
  longitude: -74.006,
  last_update: "2024-01-01T12:00:00Z",
  status: "available",
  ...overrides,
});

const createMockTechniciansResponse = (
  overrides: Partial<TechniciansResponse> = {},
): TechniciansResponse => ({
  technicians: [createMockTechnician()],
  total: 1,
  limit: 50,
  offset: 0,
  ...overrides,
});

describe("useTechnicians", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Query Hooks", () => {
    describe("useTechnicians", () => {
      it("should fetch technicians with default options", async () => {
        const mockResponse = createMockTechniciansResponse({
          technicians: [
            createMockTechnician({ id: "tech-001" }),
            createMockTechnician({ id: "tech-002" }),
          ],
          total: 2,
        });

        mockApiClient.get.mockResolvedValue({
          data: mockResponse,
          status: 200,
          statusText: "OK",
          headers: {},
          config: {} as any,
        });

        const { result } = renderHook(() => useTechnicians(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockResponse);
        expect(mockApiClient.get).toHaveBeenCalledWith(
          "/field-service/technicians?limit=50&offset=0",
        );
      });

      it("should fetch technicians with status filter", async () => {
        const mockResponse = createMockTechniciansResponse({
          technicians: [createMockTechnician({ status: "on_job" })],
        });

        mockApiClient.get.mockResolvedValue({
          data: mockResponse,
          status: 200,
          statusText: "OK",
          headers: {},
          config: {} as any,
        });

        const { result } = renderHook(() => useTechnicians({ status: "on_job" }), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(mockApiClient.get).toHaveBeenCalledWith(
          "/field-service/technicians?status=on_job&limit=50&offset=0",
        );
      });

      it("should fetch technicians with is_active filter", async () => {
        const mockResponse = createMockTechniciansResponse({
          technicians: [createMockTechnician({ is_active: true })],
        });

        mockApiClient.get.mockResolvedValue({
          data: mockResponse,
          status: 200,
          statusText: "OK",
          headers: {},
          config: {} as any,
        });

        const { result } = renderHook(() => useTechnicians({ is_active: true }), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(mockApiClient.get).toHaveBeenCalledWith(
          "/field-service/technicians?is_active=true&limit=50&offset=0",
        );
      });

      it("should fetch technicians with custom limit and offset", async () => {
        const mockResponse = createMockTechniciansResponse({ limit: 10, offset: 20 });

        mockApiClient.get.mockResolvedValue({
          data: mockResponse,
          status: 200,
          statusText: "OK",
          headers: {},
          config: {} as any,
        });

        const { result } = renderHook(() => useTechnicians({ limit: 10, offset: 20 }), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(mockApiClient.get).toHaveBeenCalledWith(
          "/field-service/technicians?limit=10&offset=20",
        );
      });

      it("should handle errors when fetching technicians", async () => {
        mockApiClient.get.mockRejectedValue(new Error("Failed to fetch technicians"));

        const { result } = renderHook(() => useTechnicians(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeTruthy();
      });
    });

    describe("useTechnician", () => {
      it("should fetch a single technician by ID", async () => {
        const mockTechnician = createMockTechnician({ id: "tech-001" });

        mockApiClient.get.mockResolvedValue({
          data: mockTechnician,
          status: 200,
          statusText: "OK",
          headers: {},
          config: {} as any,
        });

        const { result } = renderHook(() => useTechnician("tech-001"), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockTechnician);
        expect(mockApiClient.get).toHaveBeenCalledWith("/field-service/technicians/tech-001");
      });

      it("should not fetch when technicianId is null", () => {
        const { result } = renderHook(() => useTechnician(null), {
          wrapper: createQueryWrapper(),
        });

        expect(result.current.isPending).toBe(true);
        expect(mockApiClient.get).not.toHaveBeenCalled();
      });

      it("should return null when technicianId is null", async () => {
        mockApiClient.get.mockResolvedValue({
          data: null,
          status: 200,
          statusText: "OK",
          headers: {},
          config: {} as any,
        });

        const { result } = renderHook(() => useTechnician(null), {
          wrapper: createQueryWrapper(),
        });

        expect(result.current.isPending).toBe(true);
      });

      it("should handle errors when fetching technician", async () => {
        mockApiClient.get.mockRejectedValue(new Error("Technician not found"));

        const { result } = renderHook(() => useTechnician("invalid-id"), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeTruthy();
      });
    });

    describe("useActiveTechnicianLocations", () => {
      it("should fetch active technician locations", async () => {
        const mockLocations = [
          createMockTechnicianLocation({ technician_id: "tech-001" }),
          createMockTechnicianLocation({ technician_id: "tech-002" }),
        ];

        mockApiClient.get.mockResolvedValue({
          data: mockLocations,
          status: 200,
          statusText: "OK",
          headers: {},
          config: {} as any,
        });

        const { result } = renderHook(() => useActiveTechnicianLocations(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockLocations);
        expect(mockApiClient.get).toHaveBeenCalledWith(
          "/field-service/technicians/locations/active",
        );
      });

      it("should handle empty locations array", async () => {
        mockApiClient.get.mockResolvedValue({
          data: [],
          status: 200,
          statusText: "OK",
          headers: {},
          config: {} as any,
        });

        const { result } = renderHook(() => useActiveTechnicianLocations(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual([]);
      });

      it("should handle errors when fetching locations", async () => {
        mockApiClient.get.mockRejectedValue(new Error("Failed to fetch locations"));

        const { result } = renderHook(() => useActiveTechnicianLocations(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeTruthy();
      });
    });

    describe("useTechnicianLocationHistory", () => {
      it("should fetch location history for a technician", async () => {
        const mockHistory = [
          { latitude: 40.7128, longitude: -74.006, timestamp: "2024-01-01T10:00:00Z" },
          { latitude: 40.7589, longitude: -73.9851, timestamp: "2024-01-01T11:00:00Z" },
        ];

        mockApiClient.get.mockResolvedValue({
          data: mockHistory,
          status: 200,
          statusText: "OK",
          headers: {},
          config: {} as any,
        });

        const { result } = renderHook(() => useTechnicianLocationHistory("tech-001"), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockHistory);
        expect(mockApiClient.get).toHaveBeenCalledWith(
          "/field-service/technicians/tech-001/location-history?limit=100",
        );
      });

      it("should fetch location history with time filters", async () => {
        const mockHistory = [];

        mockApiClient.get.mockResolvedValue({
          data: mockHistory,
          status: 200,
          statusText: "OK",
          headers: {},
          config: {} as any,
        });

        const { result } = renderHook(
          () =>
            useTechnicianLocationHistory("tech-001", {
              startTime: "2024-01-01T00:00:00Z",
              endTime: "2024-01-01T23:59:59Z",
              limit: 50,
            }),
          { wrapper: createQueryWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(mockApiClient.get).toHaveBeenCalledWith(
          "/field-service/technicians/tech-001/location-history?start_time=2024-01-01T00%3A00%3A00Z&end_time=2024-01-01T23%3A59%3A59Z&limit=50",
        );
      });

      it("should not fetch when technicianId is null", () => {
        const { result } = renderHook(() => useTechnicianLocationHistory(null), {
          wrapper: createQueryWrapper(),
        });

        expect(result.current.isPending).toBe(true);
        expect(mockApiClient.get).not.toHaveBeenCalled();
      });

      it("should handle errors when fetching location history", async () => {
        mockApiClient.get.mockRejectedValue(new Error("Failed to fetch history"));

        const { result } = renderHook(() => useTechnicianLocationHistory("tech-001"), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeTruthy();
      });
    });

    describe("useTechniciansWithLocations", () => {
      it("should filter technicians with valid locations", async () => {
        const mockLocations = [
          createMockTechnicianLocation({
            technician_id: "tech-001",
            latitude: 40.7128,
            longitude: -74.006,
          }),
          createMockTechnicianLocation({
            technician_id: "tech-002",
            latitude: null,
            longitude: null,
          }),
          createMockTechnicianLocation({
            technician_id: "tech-003",
            latitude: 40.7589,
            longitude: -73.9851,
          }),
        ];

        mockApiClient.get.mockResolvedValue({
          data: mockLocations,
          status: 200,
          statusText: "OK",
          headers: {},
          config: {} as any,
        });

        const { result } = renderHook(() => useTechniciansWithLocations(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toHaveLength(2);
        expect(result.current.data?.every((t) => t.latitude !== null && t.longitude !== null)).toBe(
          true,
        );
      });

      it("should return empty array when no technicians have valid locations", async () => {
        const mockLocations = [
          createMockTechnicianLocation({
            technician_id: "tech-001",
            latitude: null,
            longitude: null,
          }),
        ];

        mockApiClient.get.mockResolvedValue({
          data: mockLocations,
          status: 200,
          statusText: "OK",
          headers: {},
          config: {} as any,
        });

        const { result } = renderHook(() => useTechniciansWithLocations(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual([]);
      });

      it("should handle non-array data gracefully", async () => {
        mockApiClient.get.mockResolvedValue({
          data: null,
          status: 200,
          statusText: "OK",
          headers: {},
          config: {} as any,
        });

        const { result } = renderHook(() => useTechniciansWithLocations(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual([]);
      });
    });
  });
});
