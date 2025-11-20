/**
 * Shared test suite for useOrchestrationStats hook
 * Tests orchestration workflow statistics functionality
 */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type PropsWithChildren } from "react";
import type { WorkflowStatistics, WorkflowType } from "../../apps/platform-admin-app/hooks/useOrchestration";

type UseOrchestrationStatsHook = () => {
  data: WorkflowStatistics | null | undefined;
  isLoading: boolean;
  error: unknown;
  refetch: () => Promise<any>;
};

export function runUseOrchestrationStatsSuite(
  useOrchestrationStats: UseOrchestrationStatsHook,
  apiClient: any
) {
  const cleanupFns: Array<() => void> = [];
  const waitForStatsData = async (
    hookResult: { current: ReturnType<UseOrchestrationStatsHook> },
    expectedStats: WorkflowStatistics
  ) =>
    waitFor(() => {
      expect(hookResult.current.data).toBe(expectedStats);
    });

  const renderUseOrchestrationStats = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          cacheTime: 0,
        },
      },
    });

    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const hook = renderHook(() => useOrchestrationStats(), { wrapper });

    cleanupFns.push(() => {
      hook.unmount();
      queryClient.clear();
    });

    return hook;
  };

  describe("useOrchestrationStats", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    afterEach(() => {
      cleanupFns.forEach((cleanup) => cleanup());
      cleanupFns.length = 0;
      jest.restoreAllMocks();
    });

    describe("Happy Path", () => {
      it("should fetch orchestration stats on mount", async () => {
        const mockStats: WorkflowStatistics = {
          total: 150,
          pending: 10,
          running: 5,
          completed: 130,
          failed: 5,
          success_rate: 96.30,
          avg_duration_seconds: 45.2,
          by_type: {
            provision_subscriber: 50,
            deprovision_subscriber: 20,
            activate_service: 30,
            suspend_service: 15,
            terminate_service: 10,
            change_service_plan: 12,
            update_network_config: 8,
            migrate_subscriber: 5,
          },
        };

        apiClient.get.mockResolvedValueOnce({ data: mockStats });

        const { result } = renderUseOrchestrationStats();

        await waitForStatsData(result, mockStats);
        expect(result.current.error).toBeNull();
        expect(apiClient.get).toHaveBeenCalledWith("/orchestration/statistics");
      });

      it("should handle stats with no workflows", async () => {
        const mockStats: WorkflowStatistics = {
          total: 0,
          pending: 0,
          running: 0,
          completed: 0,
          failed: 0,
          success_rate: 0,
          by_type: {
            provision_subscriber: 0,
            deprovision_subscriber: 0,
            activate_service: 0,
            suspend_service: 0,
            terminate_service: 0,
            change_service_plan: 0,
            update_network_config: 0,
            migrate_subscriber: 0,
          },
        };

        apiClient.get.mockResolvedValueOnce({ data: mockStats });

        const { result } = renderUseOrchestrationStats();

        await waitForStatsData(result, mockStats);

        expect(result.current.data?.total).toBe(0);
        expect(result.current.data?.success_rate).toBe(0);
      });

      it("should handle stats without avg_duration_seconds", async () => {
        const mockStats: WorkflowStatistics = {
          total: 10,
          pending: 2,
          running: 1,
          completed: 7,
          failed: 0,
          success_rate: 100,
          by_type: {
            provision_subscriber: 10,
            deprovision_subscriber: 0,
            activate_service: 0,
            suspend_service: 0,
            terminate_service: 0,
            change_service_plan: 0,
            update_network_config: 0,
            migrate_subscriber: 0,
          },
        };

        apiClient.get.mockResolvedValueOnce({ data: mockStats });

        const { result } = renderUseOrchestrationStats();

        await waitForStatsData(result, mockStats);

        expect(result.current.data?.avg_duration_seconds).toBeUndefined();
      });

      it("should allow manual refetch", async () => {
        const mockStats: WorkflowStatistics = {
          total: 100,
          pending: 5,
          running: 3,
          completed: 90,
          failed: 2,
          success_rate: 97.83,
          by_type: {
            provision_subscriber: 100,
            deprovision_subscriber: 0,
            activate_service: 0,
            suspend_service: 0,
            terminate_service: 0,
            change_service_plan: 0,
            update_network_config: 0,
            migrate_subscriber: 0,
          },
        };

        apiClient.get.mockResolvedValue({ data: mockStats });

        const { result } = renderUseOrchestrationStats();

        await waitForStatsData(result, mockStats);

        // Clear previous calls
        apiClient.get.mockClear();

        // Trigger manual refetch
        await result.current.refetch();

        await waitFor(() => {
          expect(apiClient.get).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe("Error Handling", () => {
      it("should handle fetch errors gracefully", async () => {
        const mockError = {
          response: {
            data: {
              detail: "Internal server error",
            },
          },
        };

        apiClient.get.mockRejectedValueOnce(mockError);

        const { result } = renderUseOrchestrationStats();

        await waitFor(() => {
          const error = result.current.error as Error;
          expect(error?.message).toBe("Internal server error");
        });

        const error = result.current.error as Error;
        expect(result.current.data).toBeUndefined();
      });

      it("should handle errors without detail message", async () => {
        const mockError = new Error("Network error");
        apiClient.get.mockRejectedValueOnce(mockError);

        const { result } = renderUseOrchestrationStats();

        await waitFor(() => {
          const error = result.current.error as Error;
          expect(error?.message).toBe("Failed to fetch statistics");
        });

        const error = result.current.error as Error;
        expect(result.current.data).toBeUndefined();
      });

      it("should handle empty response", async () => {
        apiClient.get.mockResolvedValueOnce({ data: null });

        const { result } = renderUseOrchestrationStats();

        await waitFor(() => {
          expect(result.current.data).toBeNull();
        });
        expect(result.current.error).toBeNull();
      });
    });

    describe("Edge Cases", () => {
      it("should handle high success rate", async () => {
        const mockStats: WorkflowStatistics = {
          total: 1000,
          pending: 0,
          running: 0,
          completed: 995,
          failed: 5,
          success_rate: 99.5,
          avg_duration_seconds: 30.5,
          by_type: {
            provision_subscriber: 400,
            deprovision_subscriber: 100,
            activate_service: 200,
            suspend_service: 100,
            terminate_service: 50,
            change_service_plan: 80,
            update_network_config: 50,
            migrate_subscriber: 20,
          },
        };

        apiClient.get.mockResolvedValueOnce({ data: mockStats });

        const { result } = renderUseOrchestrationStats();

        await waitForStatsData(result, mockStats);

        expect(result.current.data?.success_rate).toBe(99.5);
        expect(result.current.data?.failed).toBe(5);
      });

      it("should handle low success rate", async () => {
        const mockStats: WorkflowStatistics = {
          total: 100,
          pending: 10,
          running: 5,
          completed: 50,
          failed: 35,
          success_rate: 58.82,
          by_type: {
            provision_subscriber: 100,
            deprovision_subscriber: 0,
            activate_service: 0,
            suspend_service: 0,
            terminate_service: 0,
            change_service_plan: 0,
            update_network_config: 0,
            migrate_subscriber: 0,
          },
        };

        apiClient.get.mockResolvedValueOnce({ data: mockStats });

        const { result } = renderUseOrchestrationStats();

        await waitForStatsData(result, mockStats);

        expect(result.current.data?.success_rate).toBe(58.82);
        expect(result.current.data?.failed).toBe(35);
      });

      it("should handle uneven workflow type distribution", async () => {
        const mockStats: WorkflowStatistics = {
          total: 100,
          pending: 0,
          running: 0,
          completed: 100,
          failed: 0,
          success_rate: 100,
          by_type: {
            provision_subscriber: 95,
            deprovision_subscriber: 1,
            activate_service: 1,
            suspend_service: 1,
            terminate_service: 1,
            change_service_plan: 1,
            update_network_config: 0,
            migrate_subscriber: 0,
          },
        };

        apiClient.get.mockResolvedValueOnce({ data: mockStats });

        const { result } = renderUseOrchestrationStats();

        await waitForStatsData(result, mockStats);

        expect(result.current.data?.by_type.provision_subscriber).toBe(95);
        expect(result.current.data?.by_type.deprovision_subscriber).toBe(1);
      });

      it("should handle very fast workflows", async () => {
        const mockStats: WorkflowStatistics = {
          total: 50,
          pending: 0,
          running: 0,
          completed: 50,
          failed: 0,
          success_rate: 100,
          avg_duration_seconds: 0.5,
          by_type: {
            provision_subscriber: 50,
            deprovision_subscriber: 0,
            activate_service: 0,
            suspend_service: 0,
            terminate_service: 0,
            change_service_plan: 0,
            update_network_config: 0,
            migrate_subscriber: 0,
          },
        };

        apiClient.get.mockResolvedValueOnce({ data: mockStats });

        const { result } = renderUseOrchestrationStats();

        await waitForStatsData(result, mockStats);

        expect(result.current.data?.avg_duration_seconds).toBe(0.5);
      });

      it("should handle very slow workflows", async () => {
        const mockStats: WorkflowStatistics = {
          total: 10,
          pending: 0,
          running: 0,
          completed: 10,
          failed: 0,
          success_rate: 100,
          avg_duration_seconds: 3600,
          by_type: {
            provision_subscriber: 10,
            deprovision_subscriber: 0,
            activate_service: 0,
            suspend_service: 0,
            terminate_service: 0,
            change_service_plan: 0,
            update_network_config: 0,
            migrate_subscriber: 0,
          },
        };

        apiClient.get.mockResolvedValueOnce({ data: mockStats });

        const { result } = renderUseOrchestrationStats();

        await waitForStatsData(result, mockStats);

        expect(result.current.data?.avg_duration_seconds).toBe(3600);
      });
    });
  });
}
