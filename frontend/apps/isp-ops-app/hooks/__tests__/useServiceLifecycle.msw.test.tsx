/**
 * MSW-powered tests for useServiceLifecycle
 *
 * This test file uses MSW for API mocking instead of jest.mock.
 * MSW provides more realistic network mocking and better test isolation.
 */

import { renderHook, waitFor } from "@testing-library/react";
import {
  useServiceStatistics,
  useServiceInstances,
  useServiceInstance,
  useProvisionService,
  useActivateService,
  useSuspendService,
  useResumeService,
  useTerminateService,
  useModifyService,
  useHealthCheckService,
} from "../useServiceLifecycle";
import {
  createTestQueryClient,
  createQueryWrapper,
  resetServiceLifecycleStorage,
  createMockServiceInstance,
  seedServiceLifecycleData,
  makeApiEndpointFail,
} from "../../__tests__/test-utils";

describe("useServiceLifecycle (MSW)", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    resetServiceLifecycleStorage();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("useServiceStatistics - fetch service statistics", () => {
    it("should fetch service statistics successfully", async () => {
      const services = [
        createMockServiceInstance({ status: "active" }),
        createMockServiceInstance({ status: "active" }),
        createMockServiceInstance({ status: "provisioning" }),
        createMockServiceInstance({ status: "suspended" }),
        createMockServiceInstance({ status: "terminated" }),
      ];

      seedServiceLifecycleData(services);

      const { result } = renderHook(() => useServiceStatistics(), {
        wrapper: createQueryWrapper(queryClient),
      });

      // Should start in loading state
      expect(result.current.isLoading).toBe(true);

      // Wait for data to load
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Verify statistics
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.total_services).toBe(5);
      expect(result.current.data?.active_count).toBe(2);
      expect(result.current.data?.provisioning_count).toBe(1);
      expect(result.current.data?.suspended_count).toBe(1);
      expect(result.current.data?.terminated_count).toBe(1);
      expect(result.current.error).toBeNull();
    });

    it("should handle empty service list", async () => {
      seedServiceLifecycleData([]);

      const { result } = renderHook(() => useServiceStatistics(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.total_services).toBe(0);
      expect(result.current.data?.active_count).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it("should handle API errors gracefully", async () => {
      makeApiEndpointFail("get", "/services/lifecycle/statistics", "Internal server error", 500);

      const { result } = renderHook(() => useServiceStatistics(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });

    it("should respect enabled option", async () => {
      seedServiceLifecycleData([createMockServiceInstance()]);

      const { result } = renderHook(() => useServiceStatistics({ enabled: false }), {
        wrapper: createQueryWrapper(queryClient),
      });

      // Should not be loading since query is disabled
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useServiceInstances - list service instances", () => {
    it("should fetch service instances successfully", async () => {
      const services = [
        createMockServiceInstance({
          id: "service-1",
          service_name: "Service 1",
          status: "active",
        }),
        createMockServiceInstance({
          id: "service-2",
          service_name: "Service 2",
          status: "active",
        }),
      ];

      seedServiceLifecycleData(services);

      const { result } = renderHook(() => useServiceInstances(), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].id).toBe("service-1");
      expect(result.current.data?.[1].id).toBe("service-2");
      expect(result.current.error).toBeNull();
    });

    it("should filter services by status", async () => {
      const services = [
        createMockServiceInstance({ status: "active" }),
        createMockServiceInstance({ status: "provisioning" }),
        createMockServiceInstance({ status: "active" }),
      ];

      seedServiceLifecycleData(services);

      const { result } = renderHook(() => useServiceInstances({ status: "active" }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.every((s) => s.status === "active")).toBe(true);
    });

    it("should filter services by service type", async () => {
      const services = [
        createMockServiceInstance({ service_type: "internet" }),
        createMockServiceInstance({ service_type: "voice" }),
        createMockServiceInstance({ service_type: "internet" }),
      ];

      seedServiceLifecycleData(services);

      const { result } = renderHook(() => useServiceInstances({ serviceType: "internet" }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.every((s) => s.service_type === "internet")).toBe(true);
    });

    it("should handle pagination", async () => {
      const services = Array.from({ length: 25 }, (_, i) =>
        createMockServiceInstance({ id: `service-${i + 1}` })
      );

      seedServiceLifecycleData(services);

      const { result } = renderHook(() => useServiceInstances({ offset: 10, limit: 10 }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(10);
      expect(result.current.data?.[0].id).toBe("service-11");
    });

    it("should respect enabled option", async () => {
      seedServiceLifecycleData([createMockServiceInstance()]);

      const { result } = renderHook(() => useServiceInstances({ enabled: false }), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useServiceInstance - fetch single service instance", () => {
    it("should fetch service instance successfully", async () => {
      const service = createMockServiceInstance({
        id: "service-1",
        service_name: "Test Service",
        service_type: "internet",
      });

      seedServiceLifecycleData([service]);

      const { result } = renderHook(() => useServiceInstance("service-1"), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.id).toBe("service-1");
      expect(result.current.data?.service_name).toBe("Test Service");
      expect(result.current.error).toBeNull();
    });

    it("should handle service not found", async () => {
      seedServiceLifecycleData([]);

      const { result } = renderHook(() => useServiceInstance("non-existent"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });

    it("should not fetch when serviceId is null", async () => {
      const { result } = renderHook(() => useServiceInstance(null), {
        wrapper: createQueryWrapper(queryClient),
      });

      // Query should be disabled
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useProvisionService - provision new service", () => {
    it("should provision service successfully", async () => {
      const { result } = renderHook(() => useProvisionService(), {
        wrapper: createQueryWrapper(queryClient),
      });

      // Initially not loading
      expect(result.current.isPending).toBe(false);

      // Trigger mutation
      let response: { service_instance_id: string } | undefined;
      await waitFor(async () => {
        response = await result.current.mutateAsync({
          payload: {
            service_name: "New Service",
            service_type: "internet",
            customer_id: "customer-1",
          },
        });
      });

      expect(response).toBeDefined();
      expect(response?.service_instance_id).toBeDefined();
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("should handle provision errors", async () => {
      makeApiEndpointFail("post", "/services/lifecycle/services/provision", "Provisioning failed", 500);

      const { result } = renderHook(() => useProvisionService(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(async () => {
        try {
          await result.current.mutateAsync({
            payload: {
              service_name: "New Service",
            },
          });
        } catch (error) {
          // Expected error
        }
      });

      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBeDefined();
    });

    it("should invalidate related queries on success", async () => {
      seedServiceLifecycleData([createMockServiceInstance()]);

      // Fetch statistics first
      const statsHook = renderHook(() => useServiceStatistics(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(statsHook.result.current.isLoading).toBe(false));
      const initialTotal = statsHook.result.current.data?.total_services;

      // Provision new service
      const provisionHook = renderHook(() => useProvisionService(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(async () => {
        await provisionHook.result.current.mutateAsync({
          payload: {
            service_name: "New Service",
          },
        });
      });

      // Statistics should be refetched
      await waitFor(() => {
        expect(statsHook.result.current.data?.total_services).toBeGreaterThan(initialTotal || 0);
      });
    });
  });

  describe("useActivateService - activate service", () => {
    it("should activate provisioning service successfully", async () => {
      const service = createMockServiceInstance({
        id: "service-1",
        status: "provisioning",
      });

      seedServiceLifecycleData([service]);

      const { result } = renderHook(() => useActivateService(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(async () => {
        await result.current.mutateAsync({
          serviceId: "service-1",
        });
      });

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("should activate suspended service successfully", async () => {
      const service = createMockServiceInstance({
        id: "service-1",
        status: "suspended",
      });

      seedServiceLifecycleData([service]);

      const { result } = renderHook(() => useActivateService(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(async () => {
        await result.current.mutateAsync({
          serviceId: "service-1",
        });
      });

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("should handle invalid state transition", async () => {
      const service = createMockServiceInstance({
        id: "service-1",
        status: "terminated",
      });

      seedServiceLifecycleData([service]);

      const { result } = renderHook(() => useActivateService(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(async () => {
        try {
          await result.current.mutateAsync({
            serviceId: "service-1",
          });
        } catch (error) {
          // Expected error
        }
      });

      expect(result.current.isError).toBe(true);
    });

    it("should handle service not found", async () => {
      seedServiceLifecycleData([]);

      const { result } = renderHook(() => useActivateService(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(async () => {
        try {
          await result.current.mutateAsync({
            serviceId: "non-existent",
          });
        } catch (error) {
          // Expected error
        }
      });

      expect(result.current.isError).toBe(true);
    });
  });

  describe("useSuspendService - suspend service", () => {
    it("should suspend active service successfully", async () => {
      const service = createMockServiceInstance({
        id: "service-1",
        status: "active",
      });

      seedServiceLifecycleData([service]);

      const { result } = renderHook(() => useSuspendService(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(async () => {
        await result.current.mutateAsync({
          serviceId: "service-1",
          payload: { reason: "non-payment" },
        });
      });

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("should handle invalid state transition", async () => {
      const service = createMockServiceInstance({
        id: "service-1",
        status: "provisioning",
      });

      seedServiceLifecycleData([service]);

      const { result } = renderHook(() => useSuspendService(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(async () => {
        try {
          await result.current.mutateAsync({
            serviceId: "service-1",
          });
        } catch (error) {
          // Expected error
        }
      });

      expect(result.current.isError).toBe(true);
    });

    it("should invalidate related queries on success", async () => {
      const service = createMockServiceInstance({
        id: "service-1",
        status: "active",
      });

      seedServiceLifecycleData([service]);

      // Fetch service details first
      const detailsHook = renderHook(() => useServiceInstance("service-1"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(detailsHook.result.current.isLoading).toBe(false));
      expect(detailsHook.result.current.data?.status).toBe("active");

      // Suspend service
      const suspendHook = renderHook(() => useSuspendService(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(async () => {
        await suspendHook.result.current.mutateAsync({
          serviceId: "service-1",
        });
      });

      // Service details should be refetched and updated
      await waitFor(() => {
        expect(detailsHook.result.current.data?.status).toBe("suspended");
      });
    });
  });

  describe("useResumeService - resume service", () => {
    it("should resume suspended service successfully", async () => {
      const service = createMockServiceInstance({
        id: "service-1",
        status: "suspended",
      });

      seedServiceLifecycleData([service]);

      const { result } = renderHook(() => useResumeService(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(async () => {
        await result.current.mutateAsync({
          serviceId: "service-1",
        });
      });

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("should handle invalid state transition", async () => {
      const service = createMockServiceInstance({
        id: "service-1",
        status: "active",
      });

      seedServiceLifecycleData([service]);

      const { result } = renderHook(() => useResumeService(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(async () => {
        try {
          await result.current.mutateAsync({
            serviceId: "service-1",
          });
        } catch (error) {
          // Expected error
        }
      });

      expect(result.current.isError).toBe(true);
    });
  });

  describe("useTerminateService - terminate service", () => {
    it("should terminate service successfully", async () => {
      const service = createMockServiceInstance({
        id: "service-1",
        status: "active",
      });

      seedServiceLifecycleData([service]);

      const { result } = renderHook(() => useTerminateService(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(async () => {
        await result.current.mutateAsync({
          serviceId: "service-1",
          payload: { reason: "customer request" },
        });
      });

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("should handle service not found", async () => {
      seedServiceLifecycleData([]);

      const { result } = renderHook(() => useTerminateService(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(async () => {
        try {
          await result.current.mutateAsync({
            serviceId: "non-existent",
          });
        } catch (error) {
          // Expected error
        }
      });

      expect(result.current.isError).toBe(true);
    });
  });

  describe("useModifyService - modify service configuration", () => {
    it("should modify service successfully", async () => {
      const service = createMockServiceInstance({
        id: "service-1",
        service_name: "Original Name",
      });

      seedServiceLifecycleData([service]);

      const { result } = renderHook(() => useModifyService(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(async () => {
        await result.current.mutateAsync({
          serviceId: "service-1",
          payload: {
            service_name: "Updated Name",
            service_config: { bandwidth: "2000Mbps" },
          },
        });
      });

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("should invalidate service details on success", async () => {
      const service = createMockServiceInstance({
        id: "service-1",
        service_name: "Original Name",
      });

      seedServiceLifecycleData([service]);

      // Fetch service details first
      const detailsHook = renderHook(() => useServiceInstance("service-1"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(detailsHook.result.current.isLoading).toBe(false));

      // Modify service
      const modifyHook = renderHook(() => useModifyService(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(async () => {
        await modifyHook.result.current.mutateAsync({
          serviceId: "service-1",
          payload: {
            service_name: "Updated Name",
          },
        });
      });

      // Service details query should be invalidated
      expect(modifyHook.result.current.isSuccess).toBe(true);
    });
  });

  describe("useHealthCheckService - run health check", () => {
    it("should run health check successfully", async () => {
      const service = createMockServiceInstance({
        id: "service-1",
        health_status: "degraded",
      });

      seedServiceLifecycleData([service]);

      const { result } = renderHook(() => useHealthCheckService(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(async () => {
        await result.current.mutateAsync({
          serviceId: "service-1",
        });
      });

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("should handle service not found", async () => {
      seedServiceLifecycleData([]);

      const { result } = renderHook(() => useHealthCheckService(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(async () => {
        try {
          await result.current.mutateAsync({
            serviceId: "non-existent",
          });
        } catch (error) {
          // Expected error
        }
      });

      expect(result.current.isError).toBe(true);
    });

    it("should invalidate service details on success", async () => {
      const service = createMockServiceInstance({
        id: "service-1",
        health_status: "degraded",
      });

      seedServiceLifecycleData([service]);

      // Fetch service details first
      const detailsHook = renderHook(() => useServiceInstance("service-1"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(detailsHook.result.current.isLoading).toBe(false));
      expect(detailsHook.result.current.data?.health_status).toBe("degraded");

      // Run health check
      const healthCheckHook = renderHook(() => useHealthCheckService(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(async () => {
        await healthCheckHook.result.current.mutateAsync({
          serviceId: "service-1",
        });
      });

      // Service details should be refetched
      await waitFor(() => {
        expect(detailsHook.result.current.data?.health_status).toBe("healthy");
      });
    });
  });

  describe("Integration tests - lifecycle flows", () => {
    it("should handle complete service lifecycle", async () => {
      // 1. Provision service
      const provisionHook = renderHook(() => useProvisionService(), {
        wrapper: createQueryWrapper(queryClient),
      });

      let serviceId: string | undefined;
      await waitFor(async () => {
        const response = await provisionHook.result.current.mutateAsync({
          payload: {
            service_name: "Test Service",
            service_type: "internet",
            customer_id: "customer-1",
          },
        });
        serviceId = response.service_instance_id;
      });

      expect(serviceId).toBeDefined();

      // 2. Activate service
      const activateHook = renderHook(() => useActivateService(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(async () => {
        await activateHook.result.current.mutateAsync({
          serviceId: serviceId!,
        });
      });

      expect(activateHook.result.current.isSuccess).toBe(true);

      // 3. Suspend service
      const suspendHook = renderHook(() => useSuspendService(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(async () => {
        await suspendHook.result.current.mutateAsync({
          serviceId: serviceId!,
        });
      });

      expect(suspendHook.result.current.isSuccess).toBe(true);

      // 4. Resume service
      const resumeHook = renderHook(() => useResumeService(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(async () => {
        await resumeHook.result.current.mutateAsync({
          serviceId: serviceId!,
        });
      });

      expect(resumeHook.result.current.isSuccess).toBe(true);

      // 5. Terminate service
      const terminateHook = renderHook(() => useTerminateService(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(async () => {
        await terminateHook.result.current.mutateAsync({
          serviceId: serviceId!,
        });
      });

      expect(terminateHook.result.current.isSuccess).toBe(true);
    });
  });
});
