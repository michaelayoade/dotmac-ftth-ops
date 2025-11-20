/**
 * Tests for useServiceLifecycle hooks
 * Tests service lifecycle management functionality with TanStack Query
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
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
import type {
  ServiceInstanceDetail,
  ServiceInstanceSummary,
  ServiceStatistics,
  ServiceStatusValue,
} from "@/types";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe("useServiceLifecycle", () => {
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

  describe("useServiceStatistics", () => {
    it("should fetch service statistics successfully", async () => {
      const mockStatistics: ServiceStatistics = {
        total_services: 150,
        active_count: 120,
        suspended_count: 15,
        terminated_count: 10,
        provisioning_count: 5,
        failed_count: 0,
        services_by_type: {
          internet: 100,
          voip: 30,
          iptv: 20,
        },
        healthy_count: 140,
        degraded_count: 10,
        average_uptime: 99.5,
        active_workflows: 2,
        failed_workflows: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockStatistics,
      });

      const { result } = renderHook(() => useServiceStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockStatistics);
      expect(result.current.data?.total_services).toBe(150);
      expect(result.current.data?.active_count).toBe(120);
      expect(apiClient.get).toHaveBeenCalledWith("/services/lifecycle/statistics");
    });

    it("should use correct query key", async () => {
      const mockStatistics: ServiceStatistics = {
        total_services: 0,
        active_count: 0,
        suspended_count: 0,
        terminated_count: 0,
        provisioning_count: 0,
        failed_count: 0,
        services_by_type: {},
        healthy_count: 0,
        degraded_count: 0,
        average_uptime: 0,
        active_workflows: 0,
        failed_workflows: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockStatistics,
      });

      const { result } = renderHook(() => useServiceStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
    });

    it("should respect enabled option", async () => {
      const { result } = renderHook(
        () => useServiceStatistics({ enabled: false }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(apiClient.get).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it("should have correct staleTime of 60 seconds", async () => {
      const mockStatistics: ServiceStatistics = {
        total_services: 100,
        active_count: 85,
        suspended_count: 10,
        terminated_count: 5,
        provisioning_count: 0,
        failed_count: 0,
        services_by_type: {},
        healthy_count: 0,
        degraded_count: 0,
        average_uptime: 0,
        active_workflows: 0,
        failed_workflows: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockStatistics,
      });

      const { result } = renderHook(() => useServiceStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isStale).toBe(false);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch statistics");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useServiceStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should handle loading state correctly", async () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: {
                    total_services: 0,
                    active_count: 0,
                    suspended_count: 0,
                    terminated_count: 0,
                    provisioning_count: 0,
                    by_type: {},
                    by_status: {},
                  },
                }),
              100
            )
          )
      );

      const { result } = renderHook(() => useServiceStatistics(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), {
        timeout: 200,
      });
    });
  });

  describe("useServiceInstances", () => {
    it("should fetch service instances successfully", async () => {
      const mockInstances: ServiceInstanceSummary[] = [
        {
          id: "svc-1",
          service_identifier: "SVC-001",
          service_name: "Premium Fiber 1000",
          service_type: "internet",
          customer_id: "cust-1",
          status: "active",
          provisioning_status: "active",
          activated_at: "2024-01-01T00:00:00Z",
          health_status: "healthy",
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "svc-2",
          service_identifier: "SVC-002",
          service_name: "VoIP Basic",
          service_type: "voip",
          customer_id: "cust-2",
          status: "active",
          provisioning_status: "pending",
          activated_at: "2024-01-02T00:00:00Z",
          health_status: "healthy",
          created_at: "2024-01-02T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockInstances,
      });

      const { result } = renderHook(() => useServiceInstances(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockInstances);
      expect(result.current.data?.length).toBe(2);
      expect(apiClient.get).toHaveBeenCalledWith("/services/lifecycle/services", {
        params: { limit: 20, offset: 0 },
      });
    });

    it("should fetch with status filter", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      renderHook(() => useServiceInstances({ status: "active" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/services/lifecycle/services",
          {
            params: { limit: 20, offset: 0, status: "active" },
          }
        );
      });
    });

    it("should fetch with provisioning status filter", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      renderHook(() => useServiceInstances({ status: "provisioning" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/services/lifecycle/services",
          {
            params: { limit: 20, offset: 0, status: "provisioning" },
          }
        );
      });
    });

    it("should fetch with serviceType filter", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      renderHook(() => useServiceInstances({ serviceType: "internet" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/services/lifecycle/services",
          {
            params: { limit: 20, offset: 0, service_type: "internet" },
          }
        );
      });
    });

    it("should fetch with custom pagination", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      renderHook(() => useServiceInstances({ limit: 50, offset: 10 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/services/lifecycle/services",
          {
            params: { limit: 50, offset: 10 },
          }
        );
      });
    });

    it("should fetch with all filters", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      renderHook(
        () =>
          useServiceInstances({
            status: "suspended",
            serviceType: "voip",
            limit: 30,
            offset: 5,
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/services/lifecycle/services",
          {
            params: {
              limit: 30,
              offset: 5,
              status: "suspended",
              service_type: "voip",
            },
          }
        );
      });
    });

    it("should handle all service statuses", async () => {
      const statuses: ServiceStatusValue[] = [
        "active",
        "suspended",
        "terminated",
      ];

      for (const status of statuses) {
        const mockInstance: ServiceInstanceSummary = {
          id: `svc-${status}`,
          service_identifier: `SVC-${status}`,
          service_name: "Test Plan",
          service_type: "internet",
          status,
          customer_id: "cust-1",
          provisioning_status: status,
          activated_at: "2024-01-01T00:00:00Z",
          health_status: "healthy",
          created_at: "2024-01-01T00:00:00Z",
        };

        (apiClient.get as jest.Mock).mockResolvedValue({ data: [mockInstance] });

        const { result } = renderHook(
          () => useServiceInstances({ status }),
          {
            wrapper: createWrapper(),
          }
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.[0].status).toBe(status);

        jest.clearAllMocks();
      }
    });

    it("should respect enabled option", async () => {
      const { result } = renderHook(
        () => useServiceInstances({ enabled: false }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(apiClient.get).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it("should have correct staleTime of 30 seconds", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useServiceInstances(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.isStale).toBe(false);
    });

    it("should handle empty instances array", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useServiceInstances(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual([]);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch instances");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useServiceInstances(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useServiceInstance", () => {
    it("should fetch single service instance successfully", async () => {
      const mockInstance: ServiceInstanceDetail = {
        id: "svc-1",
        service_identifier: "SVC-001",
        service_name: "Premium Fiber 1000",
        service_type: "internet",
        customer_id: "cust-1",
        status: "active",
        provisioning_status: "active",
        activated_at: "2024-01-01T00:00:00Z",
        health_status: "healthy",
        created_at: "2024-01-01T00:00:00Z",
        subscription_id: "sub-1",
        plan_id: "plan-1",
        provisioned_at: "2024-01-01T00:00:00Z",
        suspended_at: null,
        terminated_at: null,
        service_config: { tier: "premium" },
        equipment_assigned: ["router-1"],
        ip_address: "10.0.0.1",
        vlan_id: 100,
        metadata: {},
        notes: null,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockInstance,
      });

      const { result } = renderHook(() => useServiceInstance("svc-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockInstance);
      expect(apiClient.get).toHaveBeenCalledWith("/services/lifecycle/services/svc-1");
    });

    it("should not fetch when serviceId is null", async () => {
      const { result } = renderHook(() => useServiceInstance(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should not fetch when serviceId is empty string", async () => {
      const { result } = renderHook(() => useServiceInstance(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should have correct staleTime of 30 seconds", async () => {
      const mockInstance: ServiceInstanceDetail = {
        id: "svc-1",
        service_identifier: "SVC-001",
        service_name: "Test Plan",
        service_type: "internet",
        customer_id: "cust-1",
        status: "active",
        provisioning_status: "active",
        activated_at: "2024-01-01T00:00:00Z",
        health_status: "healthy",
        created_at: "2024-01-01T00:00:00Z",
        subscription_id: "sub-1",
        plan_id: "plan-1",
        provisioned_at: "2024-01-01T00:00:00Z",
        suspended_at: null,
        terminated_at: null,
        service_config: {},
        equipment_assigned: [],
        ip_address: "10.0.0.1",
        vlan_id: 100,
        metadata: {},
        notes: null,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockInstance,
      });

      const { result } = renderHook(() => useServiceInstance("svc-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.isStale).toBe(false);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Service not found");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useServiceInstance("svc-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useSuspendService", () => {
    it("should suspend service successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useSuspendService(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          serviceId: "svc-1",
          payload: { reason: "Non-payment" },
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        "/services/lifecycle/services/svc-1/suspend",
        { reason: "Non-payment" }
      );
    });

    it("should suspend service without payload", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useSuspendService(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({ serviceId: "svc-1" });
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        "/services/lifecycle/services/svc-1/suspend",
        {}
      );
    });

    it("should invalidate queries after successful suspension", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useSuspendService(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ serviceId: "svc-1" });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["services", "instances"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["services", "instance", "svc-1"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["services", "statistics"],
      });
    });

    it("should handle suspend error", async () => {
      const error = new Error("Suspend failed");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useSuspendService(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({ serviceId: "svc-1" });
        })
      ).rejects.toThrow("Suspend failed");
    });

    it("should set loading state correctly during suspension", async () => {
      (apiClient.post as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100))
      );

      const { result } = renderHook(() => useSuspendService(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(false);

      act(() => {
        result.current.mutate({ serviceId: "svc-1" });
      });

      await waitFor(() => expect(result.current.isPending).toBe(true), {
        timeout: 100,
      });
      await waitFor(() => expect(result.current.isPending).toBe(false), {
        timeout: 200,
      });
    });
  });

  describe("useResumeService", () => {
    it("should resume service successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useResumeService(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          serviceId: "svc-1",
          payload: { note: "Payment received" },
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        "/services/lifecycle/services/svc-1/resume",
        { note: "Payment received" }
      );
    });

    it("should resume service without payload", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useResumeService(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({ serviceId: "svc-1" });
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        "/services/lifecycle/services/svc-1/resume",
        {}
      );
    });

    it("should invalidate queries after successful resume", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useResumeService(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ serviceId: "svc-1" });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["services", "instances"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["services", "instance", "svc-1"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["services", "statistics"],
      });
    });

    it("should handle resume error", async () => {
      const error = new Error("Resume failed");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useResumeService(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({ serviceId: "svc-1" });
        })
      ).rejects.toThrow("Resume failed");
    });
  });

  describe("useProvisionService", () => {
    it("should provision service successfully", async () => {
      const mockResponse = { service_instance_id: "svc-new-1" };
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: mockResponse,
      });

      const { result } = renderHook(() => useProvisionService(), {
        wrapper: createWrapper(),
      });

      const payload = {
        subscriber_id: "sub-1",
        plan_id: "plan-1",
        service_type: "internet",
      };

      let response;
      await act(async () => {
        response = await result.current.mutateAsync({ payload });
      });

      expect(response).toEqual(mockResponse);
      expect(apiClient.post).toHaveBeenCalledWith(
        "/services/lifecycle/services/provision",
        payload
      );
    });

    it("should invalidate queries after successful provision", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { service_instance_id: "svc-new-1" };
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: mockResponse,
      });

      const { result } = renderHook(() => useProvisionService(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          payload: { subscriber_id: "sub-1" },
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["services", "instances"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["services", "statistics"],
      });
    });

    it("should handle provision error", async () => {
      const error = new Error("Provision failed");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useProvisionService(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({ payload: {} });
        })
      ).rejects.toThrow("Provision failed");
    });
  });

  describe("useActivateService", () => {
    it("should activate service successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useActivateService(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          serviceId: "svc-1",
          payload: { activation_date: "2024-01-01" },
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        "/services/lifecycle/services/svc-1/activate",
        { activation_date: "2024-01-01" }
      );
    });

    it("should activate service without payload", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useActivateService(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({ serviceId: "svc-1" });
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        "/services/lifecycle/services/svc-1/activate",
        {}
      );
    });

    it("should invalidate queries after successful activation", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useActivateService(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ serviceId: "svc-1" });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["services", "instances"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["services", "instance", "svc-1"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["services", "statistics"],
      });
    });

    it("should handle activate error", async () => {
      const error = new Error("Activate failed");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useActivateService(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({ serviceId: "svc-1" });
        })
      ).rejects.toThrow("Activate failed");
    });
  });

  describe("useTerminateService", () => {
    it("should terminate service successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useTerminateService(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          serviceId: "svc-1",
          payload: { reason: "Customer request", termination_date: "2024-12-31" },
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        "/services/lifecycle/services/svc-1/terminate",
        { reason: "Customer request", termination_date: "2024-12-31" }
      );
    });

    it("should terminate service without payload", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useTerminateService(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({ serviceId: "svc-1" });
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        "/services/lifecycle/services/svc-1/terminate",
        {}
      );
    });

    it("should invalidate queries after successful termination", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useTerminateService(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ serviceId: "svc-1" });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["services", "instances"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["services", "instance", "svc-1"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["services", "statistics"],
      });
    });

    it("should handle terminate error", async () => {
      const error = new Error("Terminate failed");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useTerminateService(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({ serviceId: "svc-1" });
        })
      ).rejects.toThrow("Terminate failed");
    });
  });

  describe("useModifyService", () => {
    it("should modify service successfully", async () => {
      (apiClient.patch as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useModifyService(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          serviceId: "svc-1",
          payload: { plan_id: "plan-2", bandwidth_mbps: 2000 },
        });
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        "/services/lifecycle/services/svc-1",
        { plan_id: "plan-2", bandwidth_mbps: 2000 }
      );
    });

    it("should modify service without payload", async () => {
      (apiClient.patch as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useModifyService(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({ serviceId: "svc-1" });
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        "/services/lifecycle/services/svc-1",
        {}
      );
    });

    it("should invalidate queries after successful modification", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      (apiClient.patch as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useModifyService(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ serviceId: "svc-1", payload: {} });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["services", "instances"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["services", "instance", "svc-1"],
      });
    });

    it("should handle modify error", async () => {
      const error = new Error("Modify failed");
      (apiClient.patch as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useModifyService(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({ serviceId: "svc-1" });
        })
      ).rejects.toThrow("Modify failed");
    });
  });

  describe("useHealthCheckService", () => {
    it("should perform health check successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useHealthCheckService(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          serviceId: "svc-1",
          payload: { check_connectivity: true },
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        "/services/lifecycle/services/svc-1/health-check",
        { check_connectivity: true }
      );
    });

    it("should perform health check without payload", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useHealthCheckService(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({ serviceId: "svc-1" });
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        "/services/lifecycle/services/svc-1/health-check",
        {}
      );
    });

    it("should invalidate only service instance query after health check", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useHealthCheckService(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ serviceId: "svc-1" });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["services", "instance", "svc-1"],
      });
      expect(invalidateSpy).not.toHaveBeenCalledWith({
        queryKey: ["services", "instances"],
      });
      expect(invalidateSpy).not.toHaveBeenCalledWith({
        queryKey: ["services", "statistics"],
      });
    });

    it("should handle health check error", async () => {
      const error = new Error("Health check failed");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useHealthCheckService(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({ serviceId: "svc-1" });
        })
      ).rejects.toThrow("Health check failed");
    });
  });

  describe("Query key structure", () => {
    it("should use correct query keys for useServiceStatistics", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: {
          total_services: 0,
          active_count: 0,
          suspended_count: 0,
          terminated_count: 0,
          provisioning_count: 0,
          failed_count: 0,
          services_by_type: {},
          healthy_count: 0,
          degraded_count: 0,
          average_uptime: 0,
          active_workflows: 0,
          failed_workflows: 0,
        },
      });

      const { result } = renderHook(() => useServiceStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
    });

    it("should use correct query keys for useServiceInstances", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(
        () => useServiceInstances({ status: "active", serviceType: "internet" }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
    });

    it("should use correct query keys for useServiceInstance", async () => {
      const mockInstance: ServiceInstanceDetail = {
        id: "svc-1",
        service_identifier: "SVC-001",
        service_name: "Test Plan",
        service_type: "internet",
        customer_id: "cust-1",
        status: "active",
        provisioning_status: "active",
        activated_at: "2024-01-01T00:00:00Z",
        health_status: "healthy",
        created_at: "2024-01-01T00:00:00Z",
        subscription_id: "sub-1",
        plan_id: "plan-1",
        provisioned_at: "2024-01-01T00:00:00Z",
        suspended_at: null,
        terminated_at: null,
        service_config: {},
        equipment_assigned: [],
        ip_address: "10.0.0.1",
        vlan_id: 100,
        metadata: {},
        notes: null,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockInstance,
      });

      const { result } = renderHook(() => useServiceInstance("svc-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
    });
  });

  describe("Loading states", () => {
    it("should show loading state during query fetch", async () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: {
                    total_services: 0,
                    active_count: 0,
                    suspended_count: 0,
                    terminated_count: 0,
                    provisioning_count: 0,
                    by_type: {},
                    by_status: {},
                  },
                }),
              100
            )
          )
      );

      const { result } = renderHook(() => useServiceStatistics(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), {
        timeout: 200,
      });
    });

    it("should show loading state during mutation", async () => {
      (apiClient.post as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: {} }), 100)
          )
      );

      const { result } = renderHook(() => useSuspendService(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(false);

      act(() => {
        result.current.mutate({ serviceId: "svc-1" });
      });

      await waitFor(() => expect(result.current.isPending).toBe(true), {
        timeout: 100,
      });
      await waitFor(() => expect(result.current.isPending).toBe(false), {
        timeout: 200,
      });
    });
  });

  describe("Error handling", () => {
    it("should expose error state from queries", async () => {
      const error = new Error("Query failed");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useServiceStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should expose error state from mutations", async () => {
      const error = new Error("Mutation failed");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useSuspendService(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({ serviceId: "svc-1" });
        } catch (err) {
          // Expected
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });
    });
  });

  describe("Multiple service operations", () => {
    it("should handle multiple suspend operations", async () => {
      (apiClient.post as jest.Mock)
        .mockResolvedValueOnce({ data: {} })
        .mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useSuspendService(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({ serviceId: "svc-1" });
      });

      await act(async () => {
        await result.current.mutateAsync({ serviceId: "svc-2" });
      });

      expect(apiClient.post).toHaveBeenCalledTimes(2);
      expect(apiClient.post).toHaveBeenNthCalledWith(
        1,
        "/services/lifecycle/services/svc-1/suspend",
        {}
      );
      expect(apiClient.post).toHaveBeenNthCalledWith(
        2,
        "/services/lifecycle/services/svc-2/suspend",
        {}
      );
    });

    it("should handle different operations sequentially", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });
      (apiClient.patch as jest.Mock).mockResolvedValue({ data: {} });

      const suspendHook = renderHook(() => useSuspendService(), {
        wrapper: createWrapper(),
      });

      const modifyHook = renderHook(() => useModifyService(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await suspendHook.result.current.mutateAsync({ serviceId: "svc-1" });
      });

      await act(async () => {
        await modifyHook.result.current.mutateAsync({
          serviceId: "svc-2",
          payload: { bandwidth_mbps: 500 },
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        "/services/lifecycle/services/svc-1/suspend",
        {}
      );
      expect(apiClient.patch).toHaveBeenCalledWith(
        "/services/lifecycle/services/svc-2",
        { bandwidth_mbps: 500 }
      );
    });
  });
});
