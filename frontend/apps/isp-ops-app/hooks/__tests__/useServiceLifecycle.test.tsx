/**
 * Jest Tests for useServiceLifecycle Hooks
 *
 * Tests all service lifecycle management hooks with Jest mocks.
 * Covers statistics, instances, instance details, and lifecycle operations
 * (suspend, resume, provision, activate, terminate, modify, health-check).
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useServiceStatistics,
  useServiceInstances,
  useServiceInstance,
  useSuspendService,
  useResumeService,
  useProvisionService,
  useActivateService,
  useTerminateService,
  useModifyService,
  useHealthCheckService,
} from "../useServiceLifecycle";
import { apiClient } from "@/lib/api/client";
import type { ServiceInstanceDetail, ServiceInstanceSummary, ServiceStatistics } from "@/types";

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

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Test data factories
const createMockServiceStatistics = (
  overrides: Partial<ServiceStatistics> = {},
): ServiceStatistics => ({
  total_services: 100,
  active_count: 75,
  provisioning_count: 10,
  suspended_count: 10,
  terminated_count: 5,
  failed_count: 0,
  services_by_type: { fiber: 50, wireless: 25 },
  healthy_count: 70,
  degraded_count: 5,
  average_uptime: 99.5,
  active_workflows: 2,
  failed_workflows: 0,
  ...overrides,
});

const createMockServiceInstanceSummary = (
  overrides: Partial<ServiceInstanceSummary> = {},
): ServiceInstanceSummary => ({
  id: "service-001",
  service_identifier: "SVC-001",
  service_name: "Fiber Internet",
  service_type: "fiber",
  customer_id: "cust-001",
  status: "active",
  provisioning_status: null,
  activated_at: "2024-01-02T00:00:00Z",
  health_status: "healthy",
  created_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

const createMockServiceInstanceDetail = (
  overrides: Partial<ServiceInstanceDetail> = {},
): ServiceInstanceDetail => ({
  id: "service-001",
  service_identifier: "SVC-001",
  service_name: "Fiber Internet",
  service_type: "fiber",
  customer_id: "cust-001",
  status: "active",
  provisioning_status: null,
  activated_at: "2024-01-02T00:00:00Z",
  health_status: "healthy",
  created_at: "2024-01-01T00:00:00Z",
  subscription_id: null,
  plan_id: null,
  provisioned_at: "2024-01-02T00:00:00Z",
  suspended_at: null,
  terminated_at: null,
  service_config: {
    speed: "100mbps",
    plan: "premium",
  },
  equipment_assigned: ["router-001"],
  ip_address: "192.168.1.100",
  vlan_id: 100,
  metadata: {
    location: "Building A",
  },
  notes: null,
  ...overrides,
});

describe("useServiceLifecycle - Query Hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useServiceStatistics", () => {
    it("should fetch service statistics successfully", async () => {
      const mockStats = createMockServiceStatistics();
      mockApiClient.get.mockResolvedValue({
        data: mockStats,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      });

      const { result } = renderHook(() => useServiceStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockStats);
      expect(mockApiClient.get).toHaveBeenCalledWith("/services/lifecycle/statistics");
    });

    it("should handle errors when fetching statistics", async () => {
      mockApiClient.get.mockRejectedValue(new Error("Failed to fetch statistics"));

      const { result } = renderHook(() => useServiceStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeTruthy();
    });

    it("should respect the enabled option", () => {
      const { result } = renderHook(() => useServiceStatistics({ enabled: false }), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });
  });

  describe("useServiceInstances", () => {
    it("should fetch service instances with default options", async () => {
      const mockInstances = [
        createMockServiceInstanceSummary({ id: "service-001" }),
        createMockServiceInstanceSummary({ id: "service-002" }),
      ];

      mockApiClient.get.mockResolvedValue({
        data: mockInstances,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      });

      const { result } = renderHook(() => useServiceInstances(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockInstances);
      expect(mockApiClient.get).toHaveBeenCalledWith("/services/lifecycle/services", {
        params: {
          limit: 20,
          offset: 0,
        },
      });
    });

    it("should fetch service instances with status filter", async () => {
      const mockInstances = [createMockServiceInstanceSummary({ status: "active" })];

      mockApiClient.get.mockResolvedValue({
        data: mockInstances,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      });

      const { result } = renderHook(
        () => useServiceInstances({ status: "active", limit: 10, offset: 5 }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockApiClient.get).toHaveBeenCalledWith("/services/lifecycle/services", {
        params: {
          status: "active",
          limit: 10,
          offset: 5,
        },
      });
    });

    it("should fetch service instances with service type filter", async () => {
      const mockInstances = [createMockServiceInstanceSummary({ service_type: "fiber" })];

      mockApiClient.get.mockResolvedValue({
        data: mockInstances,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      });

      const { result } = renderHook(() => useServiceInstances({ serviceType: "fiber" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockApiClient.get).toHaveBeenCalledWith("/services/lifecycle/services", {
        params: {
          service_type: "fiber",
          limit: 20,
          offset: 0,
        },
      });
    });
  });

  describe("useServiceInstance", () => {
    it("should fetch a single service instance by ID", async () => {
      const mockInstance = createMockServiceInstanceDetail();

      mockApiClient.get.mockResolvedValue({
        data: mockInstance,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      });

      const { result } = renderHook(() => useServiceInstance("service-001"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockInstance);
      expect(mockApiClient.get).toHaveBeenCalledWith("/services/lifecycle/services/service-001");
    });

    it("should not fetch when serviceId is null", () => {
      const { result } = renderHook(() => useServiceInstance(null), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });

    it("should handle errors when fetching service instance", async () => {
      mockApiClient.get.mockRejectedValue(new Error("Service not found"));

      const { result } = renderHook(() => useServiceInstance("invalid-id"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeTruthy();
    });
  });
});

describe("useServiceLifecycle - Mutation Hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useSuspendService", () => {
    it("should suspend a service successfully", async () => {
      mockApiClient.post.mockResolvedValue({
        data: null,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      });

      const { result } = renderHook(() => useSuspendService(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        serviceId: "service-001",
        payload: { reason: "non-payment" },
      });

      expect(mockApiClient.post).toHaveBeenCalledWith(
        "/services/lifecycle/services/service-001/suspend",
        { reason: "non-payment" },
      );
    });

    it("should handle errors when suspending service", async () => {
      mockApiClient.post.mockRejectedValue(new Error("Failed to suspend service"));

      const { result } = renderHook(() => useSuspendService(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.mutateAsync({ serviceId: "service-001" })).rejects.toThrow(
        "Failed to suspend service",
      );
    });
  });

  describe("useResumeService", () => {
    it("should resume a service successfully", async () => {
      mockApiClient.post.mockResolvedValue({
        data: null,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      });

      const { result } = renderHook(() => useResumeService(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({ serviceId: "service-001" });

      expect(mockApiClient.post).toHaveBeenCalledWith(
        "/services/lifecycle/services/service-001/resume",
        {},
      );
    });
  });

  describe("useProvisionService", () => {
    it("should provision a new service successfully", async () => {
      const provisionResponse = { service_instance_id: "service-new-001" };
      mockApiClient.post.mockResolvedValue({
        data: provisionResponse,
        status: 201,
        statusText: "Created",
        headers: {},
        config: {} as any,
      });

      const { result } = renderHook(() => useProvisionService(), {
        wrapper: createWrapper(),
      });

      const provisionPayload = {
        subscriber_id: "sub-001",
        service_type: "fiber",
        configuration: { speed: "100mbps" },
      };

      const response = await result.current.mutateAsync({ payload: provisionPayload });

      expect(response).toEqual(provisionResponse);
      expect(mockApiClient.post).toHaveBeenCalledWith(
        "/services/lifecycle/services/provision",
        provisionPayload,
      );
    });
  });

  describe("useActivateService", () => {
    it("should activate a service successfully", async () => {
      mockApiClient.post.mockResolvedValue({
        data: null,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      });

      const { result } = renderHook(() => useActivateService(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        serviceId: "service-001",
        payload: { activation_date: "2024-01-01" },
      });

      expect(mockApiClient.post).toHaveBeenCalledWith(
        "/services/lifecycle/services/service-001/activate",
        { activation_date: "2024-01-01" },
      );
    });
  });

  describe("useTerminateService", () => {
    it("should terminate a service successfully", async () => {
      mockApiClient.post.mockResolvedValue({
        data: null,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      });

      const { result } = renderHook(() => useTerminateService(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        serviceId: "service-001",
        payload: { termination_reason: "customer request" },
      });

      expect(mockApiClient.post).toHaveBeenCalledWith(
        "/services/lifecycle/services/service-001/terminate",
        { termination_reason: "customer request" },
      );
    });
  });

  describe("useModifyService", () => {
    it("should modify a service successfully", async () => {
      mockApiClient.patch.mockResolvedValue({
        data: null,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      });

      const { result } = renderHook(() => useModifyService(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        serviceId: "service-001",
        payload: { configuration: { speed: "200mbps" } },
      });

      expect(mockApiClient.patch).toHaveBeenCalledWith("/services/lifecycle/services/service-001", {
        configuration: { speed: "200mbps" },
      });
    });
  });

  describe("useHealthCheckService", () => {
    it("should perform health check on a service successfully", async () => {
      mockApiClient.post.mockResolvedValue({
        data: null,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      });

      const { result } = renderHook(() => useHealthCheckService(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({ serviceId: "service-001" });

      expect(mockApiClient.post).toHaveBeenCalledWith(
        "/services/lifecycle/services/service-001/health-check",
        {},
      );
    });
  });
});
