/**
 * Shared test suite for useOrchestrationStats hook
 * Tests orchestration workflow statistics functionality
 */
import { renderHook, waitFor } from "@testing-library/react";
import type { WorkflowStatistics, WorkflowType } from "../../apps/platform-admin-app/hooks/useOrchestration";

type UseOrchestrationStatsHook = () => {
  stats: WorkflowStatistics | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function runUseOrchestrationStatsSuite(
  useOrchestrationStats: UseOrchestrationStatsHook,
  apiClient: any
) {
  describe("useOrchestrationStats", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    afterEach(() => {
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

        const { result } = renderHook(() => useOrchestrationStats());

        expect(result.current.loading).toBe(true);

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.stats).toEqual(mockStats);
        expect(result.current.error).toBeNull();
        expect(apiClient.get).toHaveBeenCalledWith("/orchestration/stats");
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

        const { result } = renderHook(() => useOrchestrationStats());

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.stats?.total).toBe(0);
        expect(result.current.stats?.success_rate).toBe(0);
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

        const { result } = renderHook(() => useOrchestrationStats());

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.stats?.avg_duration_seconds).toBeUndefined();
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

        const { result } = renderHook(() => useOrchestrationStats());

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

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

        const { result } = renderHook(() => useOrchestrationStats());

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe("Internal server error");
        expect(result.current.stats).toBeNull();
      });

      it("should handle errors without detail message", async () => {
        const mockError = new Error("Network error");
        apiClient.get.mockRejectedValueOnce(mockError);

        const { result } = renderHook(() => useOrchestrationStats());

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe("Failed to fetch statistics");
        expect(result.current.stats).toBeNull();
      });

      it("should handle empty response", async () => {
        apiClient.get.mockResolvedValueOnce({ data: null });

        const { result } = renderHook(() => useOrchestrationStats());

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.stats).toBeNull();
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

        const { result } = renderHook(() => useOrchestrationStats());

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.stats?.success_rate).toBe(99.5);
        expect(result.current.stats?.failed).toBe(5);
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

        const { result } = renderHook(() => useOrchestrationStats());

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.stats?.success_rate).toBe(58.82);
        expect(result.current.stats?.failed).toBe(35);
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

        const { result } = renderHook(() => useOrchestrationStats());

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.stats?.by_type.provision_subscriber).toBe(95);
        expect(result.current.stats?.by_type.deprovision_subscriber).toBe(1);
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

        const { result } = renderHook(() => useOrchestrationStats());

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.stats?.avg_duration_seconds).toBe(0.5);
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

        const { result } = renderHook(() => useOrchestrationStats());

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.stats?.avg_duration_seconds).toBe(3600);
      });
    });
  });
}
