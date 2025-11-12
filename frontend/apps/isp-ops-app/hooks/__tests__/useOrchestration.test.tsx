/**
 * Tests for useOrchestration hooks
 * Tests workflow orchestration functionality with TanStack Query
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useOrchestrationStats,
  useWorkflows,
  useWorkflow,
  useRetryWorkflow,
  useCancelWorkflow,
  useExportWorkflows,
  orchestrationKeys,
  WorkflowStatus,
  WorkflowType,
  WorkflowStepStatus,
  Workflow,
  WorkflowStep,
  WorkflowStatistics,
  WorkflowListResponse,
  ExportOptions,
} from "../useOrchestration";
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

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

// Mock URL APIs
global.URL.createObjectURL = jest.fn(() => "blob:url");
global.URL.revokeObjectURL = jest.fn();

describe("useOrchestration", () => {
  let queryClient: QueryClient;

  function createWrapper() {
    queryClient = new QueryClient({
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

  afterEach(() => {
    jest.resetAllMocks();
    if (queryClient) {
      queryClient.clear();
    }
  });

  describe("orchestrationKeys query key factory", () => {
    it("should generate correct query keys", () => {
      expect(orchestrationKeys.all).toEqual(["orchestration"]);
      expect(orchestrationKeys.stats()).toEqual(["orchestration", "stats"]);
      expect(orchestrationKeys.workflows()).toEqual(["orchestration", "workflows", undefined]);
      expect(orchestrationKeys.workflows({ status: "running" })).toEqual([
        "orchestration",
        "workflows",
        { status: "running" },
      ]);
      expect(orchestrationKeys.workflow("wf-123")).toEqual([
        "orchestration",
        "workflow",
        "wf-123",
      ]);
    });
  });

  describe("useOrchestrationStats", () => {
    it("should fetch orchestration statistics successfully", async () => {
      const mockStats: WorkflowStatistics = {
        total: 150,
        pending: 10,
        running: 5,
        completed: 120,
        failed: 15,
        success_rate: 88.89,
        avg_duration_seconds: 45.5,
        by_type: {
          provision_subscriber: 50,
          deprovision_subscriber: 20,
          activate_service: 30,
          suspend_service: 15,
          terminate_service: 10,
          change_service_plan: 15,
          update_network_config: 5,
          migrate_subscriber: 5,
        },
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockStats,
      });

      const { result } = renderHook(() => useOrchestrationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockStats);
      expect(result.current.data?.total).toBe(150);
      expect(result.current.data?.success_rate).toBe(88.89);
      expect(apiClient.get).toHaveBeenCalledWith("/orchestration/stats");
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch stats");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useOrchestrationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should set loading state correctly", async () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: {
                    total: 0,
                    pending: 0,
                    running: 0,
                    completed: 0,
                    failed: 0,
                    success_rate: 0,
                    by_type: {},
                  },
                }),
              100
            )
          )
      );

      const { result } = renderHook(() => useOrchestrationStats(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), {
        timeout: 200,
      });
    });

    it("should have correct staleTime of 30 seconds", async () => {
      const mockStats: WorkflowStatistics = {
        total: 100,
        pending: 5,
        running: 3,
        completed: 85,
        failed: 7,
        success_rate: 92.39,
        by_type: {
          provision_subscriber: 50,
          deprovision_subscriber: 20,
          activate_service: 30,
          suspend_service: 0,
          terminate_service: 0,
          change_service_plan: 0,
          update_network_config: 0,
          migrate_subscriber: 0,
        },
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockStats });

      const { result } = renderHook(() => useOrchestrationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isStale).toBe(false);
    });

    it("should handle all workflow types in statistics", async () => {
      const mockStats: WorkflowStatistics = {
        total: 8,
        pending: 0,
        running: 0,
        completed: 8,
        failed: 0,
        success_rate: 100,
        by_type: {
          provision_subscriber: 1,
          deprovision_subscriber: 1,
          activate_service: 1,
          suspend_service: 1,
          terminate_service: 1,
          change_service_plan: 1,
          update_network_config: 1,
          migrate_subscriber: 1,
        },
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockStats });

      const { result } = renderHook(() => useOrchestrationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.by_type.provision_subscriber).toBe(1);
      expect(result.current.data?.by_type.deprovision_subscriber).toBe(1);
      expect(result.current.data?.by_type.activate_service).toBe(1);
      expect(result.current.data?.by_type.suspend_service).toBe(1);
      expect(result.current.data?.by_type.terminate_service).toBe(1);
      expect(result.current.data?.by_type.change_service_plan).toBe(1);
      expect(result.current.data?.by_type.update_network_config).toBe(1);
      expect(result.current.data?.by_type.migrate_subscriber).toBe(1);
    });
  });

  describe("useWorkflows", () => {
    it("should fetch workflows successfully", async () => {
      const mockWorkflows: Workflow[] = [
        {
          id: 1,
          workflow_id: "wf-001",
          workflow_type: "provision_subscriber",
          status: "completed",
          tenant_id: "tenant-1",
          initiator_id: "user-1",
          initiator_type: "user",
          input_data: { subscriber_id: "sub-123" },
          output_data: { result: "success" },
          started_at: "2024-01-01T00:00:00Z",
          completed_at: "2024-01-01T00:05:00Z",
          retry_count: 0,
          max_retries: 3,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:05:00Z",
        },
      ];

      const mockResponse: WorkflowListResponse = {
        workflows: mockWorkflows,
        total: 1,
        page: 1,
        page_size: 20,
        total_pages: 1,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockResponse,
      });

      const { result } = renderHook(() => useWorkflows(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.workflows).toHaveLength(1);
      expect(result.current.data?.workflows[0].workflow_type).toBe("provision_subscriber");
      expect(result.current.data?.total).toBe(1);
      expect(apiClient.get).toHaveBeenCalledWith("/orchestration/workflows", {
        params: { page: 1, page_size: 20 },
      });
    });

    it("should fetch workflows with status filter", async () => {
      const mockResponse: WorkflowListResponse = {
        workflows: [],
        total: 0,
        page: 1,
        page_size: 20,
        total_pages: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      renderHook(() => useWorkflows({ status: "running" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/orchestration/workflows", {
          params: { page: 1, page_size: 20, status: "running" },
        });
      });
    });

    it("should fetch workflows with workflowType filter", async () => {
      const mockResponse: WorkflowListResponse = {
        workflows: [],
        total: 0,
        page: 1,
        page_size: 20,
        total_pages: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      renderHook(() => useWorkflows({ workflowType: "provision_subscriber" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/orchestration/workflows", {
          params: { page: 1, page_size: 20, workflow_type: "provision_subscriber" },
        });
      });
    });

    it("should fetch workflows with custom pagination", async () => {
      const mockResponse: WorkflowListResponse = {
        workflows: [],
        total: 0,
        page: 2,
        page_size: 50,
        total_pages: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      renderHook(() => useWorkflows({ page: 2, pageSize: 50 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/orchestration/workflows", {
          params: { page: 2, page_size: 50 },
        });
      });
    });

    it("should fetch workflows with all filters", async () => {
      const mockResponse: WorkflowListResponse = {
        workflows: [],
        total: 0,
        page: 3,
        page_size: 10,
        total_pages: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      renderHook(
        () =>
          useWorkflows({
            status: "completed",
            workflowType: "suspend_service",
            page: 3,
            pageSize: 10,
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/orchestration/workflows", {
          params: {
            page: 3,
            page_size: 10,
            status: "completed",
            workflow_type: "suspend_service",
          },
        });
      });
    });

    it("should handle all workflow statuses", async () => {
      const statuses: WorkflowStatus[] = [
        "pending",
        "running",
        "completed",
        "failed",
        "rolling_back",
        "rolled_back",
        "compensated",
      ];

      for (const status of statuses) {
        const mockResponse: WorkflowListResponse = {
          workflows: [
            {
              id: 1,
              workflow_id: `wf-${status}`,
              workflow_type: "provision_subscriber",
              status,
              tenant_id: "tenant-1",
              input_data: {},
              retry_count: 0,
              max_retries: 3,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
          total: 1,
          page: 1,
          page_size: 20,
          total_pages: 1,
        };

        (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

        const { result } = renderHook(() => useWorkflows({ status }), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.workflows[0].status).toBe(status);

        jest.clearAllMocks();
      }
    });

    it("should handle all workflow types", async () => {
      const types: WorkflowType[] = [
        "provision_subscriber",
        "deprovision_subscriber",
        "activate_service",
        "suspend_service",
        "terminate_service",
        "change_service_plan",
        "update_network_config",
        "migrate_subscriber",
      ];

      for (const workflowType of types) {
        const mockResponse: WorkflowListResponse = {
          workflows: [
            {
              id: 1,
              workflow_id: `wf-${workflowType}`,
              workflow_type: workflowType,
              status: "completed",
              tenant_id: "tenant-1",
              input_data: {},
              retry_count: 0,
              max_retries: 3,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
          total: 1,
          page: 1,
          page_size: 20,
          total_pages: 1,
        };

        (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

        const { result } = renderHook(() => useWorkflows({ workflowType }), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.workflows[0].workflow_type).toBe(workflowType);

        jest.clearAllMocks();
      }
    });

    it("should handle workflow with steps", async () => {
      const mockStep: WorkflowStep = {
        id: 1,
        step_id: "step-001",
        step_name: "Create Subscriber",
        step_type: "api_call",
        target_system: "billing",
        status: "completed",
        step_order: 1,
        started_at: "2024-01-01T00:00:00Z",
        completed_at: "2024-01-01T00:01:00Z",
        retry_count: 0,
        max_retries: 3,
      };

      const mockWorkflow: Workflow = {
        id: 1,
        workflow_id: "wf-001",
        workflow_type: "provision_subscriber",
        status: "completed",
        tenant_id: "tenant-1",
        input_data: { subscriber_id: "sub-123" },
        retry_count: 0,
        max_retries: 3,
        steps: [mockStep],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:05:00Z",
      };

      const mockResponse: WorkflowListResponse = {
        workflows: [mockWorkflow],
        total: 1,
        page: 1,
        page_size: 20,
        total_pages: 1,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useWorkflows(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.workflows[0].steps).toHaveLength(1);
      expect(result.current.data?.workflows[0].steps![0].step_name).toBe("Create Subscriber");
    });

    it("should handle all workflow step statuses", async () => {
      const stepStatuses: WorkflowStepStatus[] = [
        "pending",
        "running",
        "completed",
        "failed",
        "skipped",
        "compensating",
        "compensated",
        "compensation_failed",
      ];

      for (const stepStatus of stepStatuses) {
        const mockStep: WorkflowStep = {
          id: 1,
          step_id: `step-${stepStatus}`,
          step_name: `Step ${stepStatus}`,
          step_type: "api_call",
          target_system: "test",
          status: stepStatus,
          step_order: 1,
          retry_count: 0,
          max_retries: 3,
        };

        const mockWorkflow: Workflow = {
          id: 1,
          workflow_id: "wf-001",
          workflow_type: "provision_subscriber",
          status: "running",
          tenant_id: "tenant-1",
          input_data: {},
          retry_count: 0,
          max_retries: 3,
          steps: [mockStep],
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        };

        const mockResponse: WorkflowListResponse = {
          workflows: [mockWorkflow],
          total: 1,
          page: 1,
          page_size: 20,
          total_pages: 1,
        };

        (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

        const { result } = renderHook(() => useWorkflows(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.workflows[0].steps![0].status).toBe(stepStatus);

        jest.clearAllMocks();
      }
    });

    it("should auto-refresh when enabled", async () => {
      jest.useFakeTimers();

      const mockResponse: WorkflowListResponse = {
        workflows: [],
        total: 0,
        page: 1,
        page_size: 20,
        total_pages: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      renderHook(() => useWorkflows({ autoRefresh: true, refreshInterval: 5000 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(3));

      jest.useRealTimers();
    });

    it("should handle empty workflows array", async () => {
      const mockResponse: WorkflowListResponse = {
        workflows: [],
        total: 0,
        page: 1,
        page_size: 20,
        total_pages: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useWorkflows(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.workflows).toEqual([]);
      expect(result.current.data?.total).toBe(0);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch workflows");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useWorkflows(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useWorkflow", () => {
    it("should fetch single workflow successfully", async () => {
      const mockWorkflow: Workflow = {
        id: 1,
        workflow_id: "wf-001",
        workflow_type: "provision_subscriber",
        status: "completed",
        tenant_id: "tenant-1",
        initiator_id: "user-1",
        initiator_type: "user",
        input_data: { subscriber_id: "sub-123" },
        output_data: { result: "success" },
        started_at: "2024-01-01T00:00:00Z",
        completed_at: "2024-01-01T00:05:00Z",
        retry_count: 0,
        max_retries: 3,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:05:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockWorkflow,
      });

      const { result } = renderHook(() => useWorkflow("wf-001"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockWorkflow);
      expect(apiClient.get).toHaveBeenCalledWith("/orchestration/workflows/wf-001");
    });

    it("should not fetch when workflowId is null", async () => {
      const { result } = renderHook(() => useWorkflow(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should auto-refresh running workflows", async () => {
      jest.useFakeTimers();

      const mockRunningWorkflow: Workflow = {
        id: 1,
        workflow_id: "wf-001",
        workflow_type: "provision_subscriber",
        status: "running",
        tenant_id: "tenant-1",
        input_data: {},
        retry_count: 0,
        max_retries: 3,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockRunningWorkflow });

      renderHook(() => useWorkflow("wf-001", true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));

      jest.useRealTimers();
    });

    it("should stop auto-refresh when workflow completes", async () => {
      const mockCompletedWorkflow: Workflow = {
        id: 1,
        workflow_id: "wf-001",
        workflow_type: "provision_subscriber",
        status: "completed",
        tenant_id: "tenant-1",
        input_data: {},
        retry_count: 0,
        max_retries: 3,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockCompletedWorkflow });

      const { result } = renderHook(() => useWorkflow("wf-001", true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Verify workflow is completed and refetchInterval should be false
      expect(result.current.data?.status).toBe("completed");
    });

    it("should stop auto-refresh when workflow fails", async () => {
      const mockFailedWorkflow: Workflow = {
        id: 1,
        workflow_id: "wf-001",
        workflow_type: "provision_subscriber",
        status: "failed",
        tenant_id: "tenant-1",
        input_data: {},
        error_message: "Workflow failed",
        retry_count: 3,
        max_retries: 3,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockFailedWorkflow });

      const { result } = renderHook(() => useWorkflow("wf-001", true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Verify workflow failed and refetchInterval should be false
      expect(result.current.data?.status).toBe("failed");
    });

    it("should handle fetch error", async () => {
      const error = new Error("Workflow not found");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useWorkflow("wf-001"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useRetryWorkflow", () => {
    it("should retry workflow successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useRetryWorkflow(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.retryWorkflow("wf-001");
      });

      expect(apiClient.post).toHaveBeenCalledWith("/orchestration/workflows/wf-001/retry");
    });

    it("should invalidate queries after successful retry", async () => {
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

      const { result } = renderHook(() => useRetryWorkflow(), { wrapper });

      await act(async () => {
        await result.current.retryWorkflow("wf-001");
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: orchestrationKeys.workflow("wf-001"),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: orchestrationKeys.workflows(),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: orchestrationKeys.stats(),
      });
    });

    it("should handle retry error", async () => {
      const error = new Error("Retry failed");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useRetryWorkflow(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.retryWorkflow("wf-001");
        })
      ).rejects.toThrow("Retry failed");
    });

    it("should set loading state correctly during retry", async () => {
      (apiClient.post as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100))
      );

      const { result } = renderHook(() => useRetryWorkflow(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(false);

      act(() => {
        result.current.retryWorkflow("wf-001");
      });

      await waitFor(() => expect(result.current.loading).toBe(true), { timeout: 100 });
      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 200 });
    });

    it("should expose error state", async () => {
      const error = new Error("Workflow already running");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useRetryWorkflow(), {
        wrapper: createWrapper(),
      });

      expect(result.current.error).toBeNull();

      await act(async () => {
        try {
          await result.current.retryWorkflow("wf-001");
        } catch (err) {
          // Expected
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });
    });
  });

  describe("useCancelWorkflow", () => {
    it("should cancel workflow successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useCancelWorkflow(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.cancelWorkflow("wf-001");
      });

      expect(apiClient.post).toHaveBeenCalledWith("/orchestration/workflows/wf-001/cancel");
    });

    it("should invalidate queries after successful cancellation", async () => {
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

      const { result } = renderHook(() => useCancelWorkflow(), { wrapper });

      await act(async () => {
        await result.current.cancelWorkflow("wf-001");
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: orchestrationKeys.workflow("wf-001"),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: orchestrationKeys.workflows(),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: orchestrationKeys.stats(),
      });
    });

    it("should handle cancel error", async () => {
      const error = new Error("Cancel failed");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCancelWorkflow(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.cancelWorkflow("wf-001");
        })
      ).rejects.toThrow("Cancel failed");
    });

    it("should set loading state correctly during cancellation", async () => {
      (apiClient.post as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100))
      );

      const { result } = renderHook(() => useCancelWorkflow(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(false);

      act(() => {
        result.current.cancelWorkflow("wf-001");
      });

      await waitFor(() => expect(result.current.loading).toBe(true), { timeout: 100 });
      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 200 });
    });

    it("should handle multiple workflow cancellations", async () => {
      (apiClient.post as jest.Mock)
        .mockResolvedValueOnce({ data: {} })
        .mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useCancelWorkflow(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.cancelWorkflow("wf-001");
      });

      await act(async () => {
        await result.current.cancelWorkflow("wf-002");
      });

      expect(apiClient.post).toHaveBeenCalledTimes(2);
      expect(apiClient.post).toHaveBeenNthCalledWith(1, "/orchestration/workflows/wf-001/cancel");
      expect(apiClient.post).toHaveBeenNthCalledWith(2, "/orchestration/workflows/wf-002/cancel");
    });
  });

  describe("useExportWorkflows", () => {
    it("should export workflows as CSV", async () => {
      // Mock DOM APIs
      const mockLink = {
        href: "",
        download: "",
        click: jest.fn(),
      };
      const createElementSpy = jest.spyOn(document, "createElement").mockReturnValue(mockLink as any);
      const appendChildSpy = jest.spyOn(document.body, "appendChild").mockImplementation();
      const removeChildSpy = jest.spyOn(document.body, "removeChild").mockImplementation();

      const mockBlob = new Blob(["csv,data"], { type: "text/csv" });
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockBlob });

      const { result } = renderHook(() => useExportWorkflows(), {
        wrapper: createWrapper(),
      });

      const options: ExportOptions = {
        workflowType: "provision_subscriber",
        status: "completed",
      };

      await act(async () => {
        await result.current.exportCSV(options);
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining("/orchestration/export/csv"),
        { responseType: "blob" }
      );
      expect(createElementSpy).toHaveBeenCalledWith("a");
      expect(mockLink.click).toHaveBeenCalled();

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it("should export workflows as JSON", async () => {
      // Mock DOM APIs
      const mockLink = {
        href: "",
        download: "",
        click: jest.fn(),
      };
      const createElementSpy = jest.spyOn(document, "createElement").mockReturnValue(mockLink as any);
      const appendChildSpy = jest.spyOn(document.body, "appendChild").mockImplementation();
      const removeChildSpy = jest.spyOn(document.body, "removeChild").mockImplementation();

      const mockBlob = new Blob(['{"workflows": []}'], { type: "application/json" });
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockBlob });

      const { result } = renderHook(() => useExportWorkflows(), {
        wrapper: createWrapper(),
      });

      const options: ExportOptions = {
        includeSteps: true,
        limit: 100,
      };

      await act(async () => {
        await result.current.exportJSON(options);
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining("/orchestration/export/json"),
        { responseType: "blob" }
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining("include_steps=true"),
        { responseType: "blob" }
      );

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it("should export workflows with date filters", async () => {
      // Mock DOM APIs
      const mockLink = {
        href: "",
        download: "",
        click: jest.fn(),
      };
      const createElementSpy = jest.spyOn(document, "createElement").mockReturnValue(mockLink as any);
      const appendChildSpy = jest.spyOn(document.body, "appendChild").mockImplementation();
      const removeChildSpy = jest.spyOn(document.body, "removeChild").mockImplementation();

      const mockBlob = new Blob(["csv,data"], { type: "text/csv" });
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockBlob });

      const { result } = renderHook(() => useExportWorkflows(), {
        wrapper: createWrapper(),
      });

      const options: ExportOptions = {
        dateFrom: "2024-01-01",
        dateTo: "2024-01-31",
      };

      await act(async () => {
        await result.current.exportCSV(options);
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining("date_from=2024-01-01"),
        { responseType: "blob" }
      );
      expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining("date_to=2024-01-31"), {
        responseType: "blob",
      });

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it("should handle export error", async () => {
      const error = new Error("Export failed");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useExportWorkflows(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.exportCSV({});
        })
      ).rejects.toThrow("Export failed");
    });

    it("should set loading state correctly during export", async () => {
      // Mock DOM APIs
      const mockLink = {
        href: "",
        download: "",
        click: jest.fn(),
      };
      const createElementSpy = jest.spyOn(document, "createElement").mockReturnValue(mockLink as any);
      const appendChildSpy = jest.spyOn(document.body, "appendChild").mockImplementation();
      const removeChildSpy = jest.spyOn(document.body, "removeChild").mockImplementation();

      const mockBlob = new Blob(["csv,data"], { type: "text/csv" });
      (apiClient.get as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: mockBlob }), 100))
      );

      const { result } = renderHook(() => useExportWorkflows(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(false);

      act(() => {
        result.current.exportCSV({});
      });

      await waitFor(() => expect(result.current.loading).toBe(true), { timeout: 100 });
      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 200 });

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });
  });

  describe("Query key management", () => {
    it("should use correct query key for useOrchestrationStats", async () => {
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

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockStats });

      const { result } = renderHook(() => useOrchestrationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
    });

    it("should use correct query key for useWorkflows", async () => {
      const mockResponse: WorkflowListResponse = {
        workflows: [],
        total: 0,
        page: 1,
        page_size: 20,
        total_pages: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(
        () => useWorkflows({ status: "running", workflowType: "provision_subscriber" }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
    });

    it("should use correct query key for useWorkflow", async () => {
      const mockWorkflow: Workflow = {
        id: 1,
        workflow_id: "wf-001",
        workflow_type: "provision_subscriber",
        status: "completed",
        tenant_id: "tenant-1",
        input_data: {},
        retry_count: 0,
        max_retries: 3,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockWorkflow });

      const { result } = renderHook(() => useWorkflow("wf-001"), {
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
                    total: 0,
                    pending: 0,
                    running: 0,
                    completed: 0,
                    failed: 0,
                    success_rate: 0,
                    by_type: {},
                  },
                }),
              100
            )
          )
      );

      const { result } = renderHook(() => useOrchestrationStats(), {
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
            setTimeout(
              () =>
                resolve({
                  data: {},
                }),
              100
            )
          )
      );

      const { result } = renderHook(() => useRetryWorkflow(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(false);

      act(() => {
        result.current.retryWorkflow("wf-001");
      });

      await waitFor(() => expect(result.current.loading).toBe(true), { timeout: 100 });
      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 200 });
    });
  });
});
