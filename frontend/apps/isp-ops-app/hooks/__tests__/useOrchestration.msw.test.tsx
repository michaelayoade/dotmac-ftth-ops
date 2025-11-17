/**
 * MSW-powered tests for useOrchestration
 *
 * This test file uses MSW for API mocking instead of jest.mock.
 * Tests the actual hook contracts: useOrchestrationStats, useWorkflows, useWorkflow, etc.
 */

jest.mock("@/lib/config", () => ({
  platformConfig: {
    api: {
      baseUrl: "http://localhost:3000",
      prefix: "/api/v1",
      timeout: 30000,
      buildUrl: (path: string) => `http://localhost:3000/api/v1${path}`,
      graphqlEndpoint: "http://localhost:3000/api/v1/graphql",
    },
  },
}));

import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useOrchestrationStats,
  useWorkflows,
  useWorkflow,
  useRetryWorkflow,
  useCancelWorkflow,
  useExportWorkflows,
  orchestrationKeys,
  type WorkflowType,
  type WorkflowStatus,
} from "../useOrchestration";
import {
  createTestQueryClient,
  createMockWorkflow,
  createMockWorkflowStep,
  seedOrchestrationData,
  resetOrchestrationStorage,
  makeApiEndpointFail,
} from "../../__tests__/test-utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

describe("useOrchestration (MSW)", () => {
  // Helper to create wrapper with QueryClient
  const createWrapper = (queryClient?: QueryClient) => {
    const client = queryClient || createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    resetOrchestrationStorage();
  });

  describe("useOrchestrationStats", () => {
    it("should fetch orchestration statistics successfully", async () => {
      const mockWorkflows = [
        createMockWorkflow({ status: "pending" }),
        createMockWorkflow({ status: "running" }),
        createMockWorkflow({
          status: "completed",
          started_at: new Date(Date.now() - 10000).toISOString(),
          completed_at: new Date().toISOString(),
        }),
        createMockWorkflow({ status: "failed" }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(() => useOrchestrationStats(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.total).toBe(4);
      expect(result.current.data?.pending).toBe(1);
      expect(result.current.data?.running).toBe(1);
      expect(result.current.data?.completed).toBe(1);
      expect(result.current.data?.failed).toBe(1);
      expect(result.current.data?.success_rate).toBe(25); // 1/4 * 100
      expect(result.current.error).toBeNull();
    });

    it("should calculate average duration for completed workflows", async () => {
      const mockWorkflows = [
        createMockWorkflow({
          status: "completed",
          started_at: new Date(Date.now() - 10000).toISOString(),
          completed_at: new Date(Date.now() - 5000).toISOString(),
        }),
        createMockWorkflow({
          status: "completed",
          started_at: new Date(Date.now() - 20000).toISOString(),
          completed_at: new Date(Date.now() - 5000).toISOString(),
        }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(() => useOrchestrationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.avg_duration_seconds).toBeDefined();
      expect(result.current.data?.avg_duration_seconds).toBeGreaterThan(0);
    });

    it("should calculate counts by workflow type", async () => {
      const mockWorkflows = [
        createMockWorkflow({ workflow_type: "provision_subscriber" }),
        createMockWorkflow({ workflow_type: "provision_subscriber" }),
        createMockWorkflow({ workflow_type: "deprovision_subscriber" }),
        createMockWorkflow({ workflow_type: "activate_service" }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(() => useOrchestrationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.by_type).toBeDefined();
      expect(result.current.data?.by_type["provision_subscriber"]).toBe(2);
      expect(result.current.data?.by_type["deprovision_subscriber"]).toBe(1);
      expect(result.current.data?.by_type["activate_service"]).toBe(1);
    });

    it("should handle empty workflows", async () => {
      seedOrchestrationData([]);

      const { result } = renderHook(() => useOrchestrationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.total).toBe(0);
      expect(result.current.data?.success_rate).toBe(0);
    });

    it("should handle fetch error", async () => {
      makeApiEndpointFail('get', '/api/v1/orchestration/statistics', 'Server error', 500);

      const { result } = renderHook(() => useOrchestrationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useWorkflows", () => {
    it("should fetch workflows successfully", async () => {
      const mockWorkflows = [
        createMockWorkflow({ workflow_id: "wf-1", workflow_type: "provision_subscriber" }),
        createMockWorkflow({ workflow_id: "wf-2", workflow_type: "activate_service" }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(() => useWorkflows(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.workflows).toHaveLength(2);
      expect(result.current.data?.total).toBe(2);
      expect(result.current.error).toBeNull();
    });

    it("should filter workflows by status", async () => {
      const mockWorkflows = [
        createMockWorkflow({ status: "pending" }),
        createMockWorkflow({ status: "running" }),
        createMockWorkflow({ status: "completed" }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(() => useWorkflows({ status: "pending" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.workflows).toHaveLength(1);
      expect(result.current.data?.workflows[0].status).toBe("pending");
    });

    it("should filter workflows by workflow type", async () => {
      const mockWorkflows = [
        createMockWorkflow({ workflow_type: "provision_subscriber" }),
        createMockWorkflow({ workflow_type: "provision_subscriber" }),
        createMockWorkflow({ workflow_type: "activate_service" }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(
        () => useWorkflows({ workflowType: "provision_subscriber" }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.workflows).toHaveLength(2);
      expect(result.current.data?.workflows[0].workflow_type).toBe("provision_subscriber");
    });

    it("should handle pagination", async () => {
      const mockWorkflows = Array.from({ length: 25 }, (_, i) =>
        createMockWorkflow({ workflow_id: `wf-${i}` })
      );

      seedOrchestrationData(mockWorkflows);

      // First page
      const { result: page1Result } = renderHook(
        () => useWorkflows({ page: 1, pageSize: 10 }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(page1Result.current.isLoading).toBe(false));

      expect(page1Result.current.data?.workflows).toHaveLength(10);
      expect(page1Result.current.data?.page).toBe(1);
      expect(page1Result.current.data?.page_size).toBe(10);
      expect(page1Result.current.data?.total).toBe(25);
      expect(page1Result.current.data?.total_pages).toBe(3);

      // Second page
      const { result: page2Result } = renderHook(
        () => useWorkflows({ page: 2, pageSize: 10 }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(page2Result.current.isLoading).toBe(false));

      expect(page2Result.current.data?.workflows).toHaveLength(10);
      expect(page2Result.current.data?.page).toBe(2);
    });

    it("should handle empty workflows list", async () => {
      seedOrchestrationData([]);

      const { result } = renderHook(() => useWorkflows(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.workflows).toHaveLength(0);
      expect(result.current.data?.total).toBe(0);
    });

    it("should handle fetch error", async () => {
      makeApiEndpointFail('get', '/api/v1/orchestration/workflows', 'Server error', 500);

      const { result } = renderHook(() => useWorkflows(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should include workflow steps", async () => {
      const mockSteps = [
        createMockWorkflowStep({ step_name: "Create RADIUS Account", status: "completed" }),
        createMockWorkflowStep({ step_name: "Provision Service", status: "running" }),
      ];

      const mockWorkflows = [
        createMockWorkflow({ workflow_id: "wf-1", steps: mockSteps }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(() => useWorkflows(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.workflows[0].steps).toBeDefined();
      expect(result.current.data?.workflows[0].steps).toHaveLength(2);
      expect(result.current.data?.workflows[0].steps?.[0].step_name).toBe("Create RADIUS Account");
    });

    it("should sort workflows by created_at descending", async () => {
      const mockWorkflows = [
        createMockWorkflow({
          workflow_id: "wf-1",
          created_at: new Date(Date.now() - 3000).toISOString(),
        }),
        createMockWorkflow({
          workflow_id: "wf-2",
          created_at: new Date(Date.now() - 1000).toISOString(),
        }),
        createMockWorkflow({
          workflow_id: "wf-3",
          created_at: new Date(Date.now() - 2000).toISOString(),
        }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(() => useWorkflows(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.workflows[0].workflow_id).toBe("wf-2"); // Most recent
      expect(result.current.data?.workflows[1].workflow_id).toBe("wf-3");
      expect(result.current.data?.workflows[2].workflow_id).toBe("wf-1"); // Oldest
    });
  });

  describe("useWorkflow", () => {
    it("should fetch single workflow successfully", async () => {
      const mockWorkflows = [
        createMockWorkflow({ workflow_id: "wf-1", workflow_type: "provision_subscriber" }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(() => useWorkflow("wf-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.workflow_id).toBe("wf-1");
      expect(result.current.data?.workflow_type).toBe("provision_subscriber");
    });

    it("should not fetch when workflowId is null", async () => {
      const { result } = renderHook(() => useWorkflow(null), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it("should handle workflow not found", async () => {
      seedOrchestrationData([]);

      const { result } = renderHook(() => useWorkflow("non-existent"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should include workflow steps", async () => {
      const mockSteps = [
        createMockWorkflowStep({ step_name: "Step 1", status: "completed" }),
        createMockWorkflowStep({ step_name: "Step 2", status: "running" }),
      ];

      const mockWorkflows = [
        createMockWorkflow({ workflow_id: "wf-1", steps: mockSteps }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(() => useWorkflow("wf-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.steps).toHaveLength(2);
      expect(result.current.data?.steps?.[0].step_name).toBe("Step 1");
    });
  });

  describe("useRetryWorkflow", () => {
    it("should retry workflow successfully", async () => {
      const mockWorkflows = [
        createMockWorkflow({
          workflow_id: "wf-1",
          status: "failed",
          error_message: "Previous error",
          retry_count: 0,
        }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(() => useRetryWorkflow(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.retryWorkflow("wf-1");
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should handle workflow not found", async () => {
      seedOrchestrationData([]);

      const { result } = renderHook(() => useRetryWorkflow(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.retryWorkflow("non-existent");
        } catch (error) {
          expect(error).toBeDefined();
        }
      });

      expect(result.current.error).toBeTruthy();
    });

    it("should reset failed steps to pending", async () => {
      const mockSteps = [
        createMockWorkflowStep({ status: "completed" }),
        createMockWorkflowStep({
          status: "failed",
          error_message: "Step failed",
          failed_at: new Date().toISOString(),
        }),
      ];

      const mockWorkflows = [
        createMockWorkflow({
          workflow_id: "wf-1",
          status: "failed",
          steps: mockSteps,
        }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(() => useRetryWorkflow(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.retryWorkflow("wf-1");
      });

      expect(result.current.error).toBeNull();
    });

    it("should invalidate workflow queries after retry", async () => {
      const mockWorkflows = [
        createMockWorkflow({
          workflow_id: "wf-1",
          status: "failed",
        }),
      ];

      seedOrchestrationData(mockWorkflows);

      const filters = {
        status: "failed" as WorkflowStatus,
        workflowType: "provision_subscriber" as WorkflowType,
        page: 1,
        pageSize: 20,
      };
      const workflowQueryClient = createTestQueryClient();
      workflowQueryClient.setQueryData(orchestrationKeys.workflows(filters), {
        workflows: mockWorkflows,
        total: 1,
        page: 1,
        page_size: 20,
        total_pages: 1,
      });

      const { result } = renderHook(() => useRetryWorkflow(), {
        wrapper: createWrapper(workflowQueryClient),
      });

      await act(async () => {
        await result.current.retryWorkflow("wf-1");
      });

      const workflowQueryState = workflowQueryClient.getQueryState(
        orchestrationKeys.workflows(filters),
      );
      expect(workflowQueryState?.isInvalidated).toBe(true);

      workflowQueryClient.clear();
    });
  });

  describe("useCancelWorkflow", () => {
    it("should cancel pending workflow successfully", async () => {
      const mockWorkflows = [
        createMockWorkflow({ workflow_id: "wf-1", status: "pending" }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(() => useCancelWorkflow(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.cancelWorkflow("wf-1");
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should cancel running workflow successfully", async () => {
      const mockWorkflows = [
        createMockWorkflow({ workflow_id: "wf-1", status: "running" }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(() => useCancelWorkflow(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.cancelWorkflow("wf-1");
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should reject cancelling completed workflow", async () => {
      const mockWorkflows = [
        createMockWorkflow({ workflow_id: "wf-1", status: "completed" }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(() => useCancelWorkflow(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.cancelWorkflow("wf-1");
        } catch (error) {
          expect(error).toBeDefined();
        }
      });

      expect(result.current.error).toBeTruthy();
    });

    it("should handle workflow not found", async () => {
      seedOrchestrationData([]);

      const { result } = renderHook(() => useCancelWorkflow(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.cancelWorkflow("non-existent");
        } catch (error) {
          expect(error).toBeDefined();
        }
      });

      expect(result.current.error).toBeTruthy();
    });

    it("should invalidate workflow queries after cancel", async () => {
      const mockWorkflows = [
        createMockWorkflow({
          workflow_id: "wf-1",
          status: "running",
        }),
      ];

      seedOrchestrationData(mockWorkflows);

      const filters = {
        status: "running" as WorkflowStatus,
        page: 1,
        pageSize: 20,
      };
      const workflowQueryClient = createTestQueryClient();
      workflowQueryClient.setQueryData(orchestrationKeys.workflows(filters), {
        workflows: mockWorkflows,
        total: 1,
        page: 1,
        page_size: 20,
        total_pages: 1,
      });

      const { result } = renderHook(() => useCancelWorkflow(), {
        wrapper: createWrapper(workflowQueryClient),
      });

      await act(async () => {
        await result.current.cancelWorkflow("wf-1");
      });

      const workflowQueryState = workflowQueryClient.getQueryState(
        orchestrationKeys.workflows(filters),
      );
      expect(workflowQueryState?.isInvalidated).toBe(true);

      workflowQueryClient.clear();
    });
  });

  describe("useExportWorkflows", () => {
    let mockLink: HTMLAnchorElement;

    beforeEach(() => {
      // Mock window.URL and DOM methods needed for file download
      global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = jest.fn();

      // Create a mock anchor element
      mockLink = document.createElement('a');
      mockLink.click = jest.fn();

      // Mock createElement to return our mock link
      const originalCreateElement = document.createElement.bind(document);
      jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          return mockLink;
        }
        return originalCreateElement(tagName);
      });

      jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink);
      jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should export workflows as CSV", async () => {
      const mockWorkflows = [
        createMockWorkflow({ workflow_id: "wf-1", workflow_type: "provision_subscriber" }),
        createMockWorkflow({ workflow_id: "wf-2", workflow_type: "activate_service" }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(() => useExportWorkflows(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.exportCSV();
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should export workflows as JSON", async () => {
      const mockWorkflows = [
        createMockWorkflow({ workflow_id: "wf-1", workflow_type: "provision_subscriber" }),
        createMockWorkflow({ workflow_id: "wf-2", workflow_type: "activate_service" }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(() => useExportWorkflows(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.exportJSON();
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should export with filters", async () => {
      const mockWorkflows = [
        createMockWorkflow({ workflow_type: "provision_subscriber", status: "completed" }),
        createMockWorkflow({ workflow_type: "activate_service", status: "failed" }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(() => useExportWorkflows(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.exportCSV({
          workflowType: "provision_subscriber",
          status: "completed",
        });
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should export with date range filter", async () => {
      const mockWorkflows = [
        createMockWorkflow({ created_at: new Date(Date.now() - 86400000).toISOString() }), // 1 day ago
        createMockWorkflow({ created_at: new Date().toISOString() }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(() => useExportWorkflows(), {
        wrapper: createWrapper(),
      });

      const yesterday = new Date(Date.now() - 86400000 * 2).toISOString();
      const tomorrow = new Date(Date.now() + 86400000).toISOString();

      await act(async () => {
        await result.current.exportJSON({
          dateFrom: yesterday,
          dateTo: tomorrow,
        });
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should export with limit", async () => {
      const mockWorkflows = Array.from({ length: 10 }, (_, i) =>
        createMockWorkflow({ workflow_id: `wf-${i}` })
      );

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(() => useExportWorkflows(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.exportCSV({ limit: 5 });
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should export JSON with steps included", async () => {
      const mockSteps = [
        createMockWorkflowStep({ step_name: "Step 1" }),
      ];

      const mockWorkflows = [
        createMockWorkflow({ workflow_id: "wf-1", steps: mockSteps }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(() => useExportWorkflows(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.exportJSON({ includeSteps: true });
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe("Real-world orchestration scenarios", () => {
    it("should handle subscriber provisioning workflow lifecycle", async () => {
      const provisionSteps = [
        createMockWorkflowStep({
          step_name: "Create RADIUS Account",
          target_system: "radius",
          status: "completed",
        }),
        createMockWorkflowStep({
          step_name: "Configure Service Plan",
          target_system: "bss",
          status: "running",
        }),
        createMockWorkflowStep({
          step_name: "Activate Service",
          target_system: "service_manager",
          status: "pending",
        }),
      ];

      const mockWorkflows = [
        createMockWorkflow({
          workflow_id: "provision-wf-1",
          workflow_type: "provision_subscriber",
          status: "running",
          input_data: {
            subscriber_id: "SUB-12345",
            service_plan: "fiber_100mbps",
            service_address: "123 Main St",
          },
          steps: provisionSteps,
        }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(() => useWorkflow("provision-wf-1", true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.workflow_type).toBe("provision_subscriber");
      expect(result.current.data?.status).toBe("running");
      expect(result.current.data?.steps).toHaveLength(3);
      expect(result.current.data?.input_data.subscriber_id).toBe("SUB-12345");
    });

    it("should handle multi-step workflow with failures and retries", async () => {
      const failedSteps = [
        createMockWorkflowStep({ step_name: "Step 1", status: "completed" }),
        createMockWorkflowStep({
          step_name: "Step 2",
          status: "failed",
          error_message: "Connection timeout",
          retry_count: 2,
          max_retries: 3,
        }),
      ];

      const mockWorkflows = [
        createMockWorkflow({
          workflow_id: "wf-retry",
          status: "failed",
          steps: failedSteps,
          retry_count: 1,
          max_retries: 3,
        }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result: workflowResult } = renderHook(() => useWorkflow("wf-retry"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(workflowResult.current.isLoading).toBe(false));

      expect(workflowResult.current.data?.status).toBe("failed");
      expect(workflowResult.current.data?.retry_count).toBe(1);

      // Retry the workflow
      const { result: retryResult } = renderHook(() => useRetryWorkflow(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await retryResult.current.retryWorkflow("wf-retry");
      });

      expect(retryResult.current.error).toBeNull();
    });

    it("should handle service migration workflow with rollback", async () => {
      const rollbackSteps = [
        createMockWorkflowStep({ step_name: "Backup Configuration", status: "completed" }),
        createMockWorkflowStep({
          step_name: "Migrate Service",
          status: "failed",
          error_message: "Migration failed",
        }),
        createMockWorkflowStep({ step_name: "Rollback Changes", status: "compensating" }),
      ];

      const mockWorkflows = [
        createMockWorkflow({
          workflow_id: "migration-wf-1",
          workflow_type: "migrate_subscriber",
          status: "rolling_back",
          input_data: {
            subscriber_id: "SUB-98765",
            from_plan: "basic_10mbps",
            to_plan: "premium_100mbps",
          },
          steps: rollbackSteps,
        }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(() => useWorkflow("migration-wf-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.status).toBe("rolling_back");
      expect(result.current.data?.workflow_type).toBe("migrate_subscriber");
      expect(result.current.data?.steps?.[2].status).toBe("compensating");
    });

    it("should handle filtering workflows by multiple criteria", async () => {
      const mockWorkflows = [
        createMockWorkflow({
          workflow_type: "provision_subscriber",
          status: "completed",
          created_at: new Date(Date.now() - 1000).toISOString(),
        }),
        createMockWorkflow({
          workflow_type: "provision_subscriber",
          status: "failed",
          created_at: new Date(Date.now() - 2000).toISOString(),
        }),
        createMockWorkflow({
          workflow_type: "activate_service",
          status: "completed",
          created_at: new Date(Date.now() - 3000).toISOString(),
        }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(
        () =>
          useWorkflows({
            workflowType: "provision_subscriber",
            status: "completed",
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.workflows).toHaveLength(1);
      expect(result.current.data?.workflows[0].workflow_type).toBe("provision_subscriber");
      expect(result.current.data?.workflows[0].status).toBe("completed");
    });

    it("should handle bulk workflow operations", async () => {
      const mockWorkflows = [
        createMockWorkflow({ workflow_id: "wf-1", status: "pending" }),
        createMockWorkflow({ workflow_id: "wf-2", status: "pending" }),
        createMockWorkflow({ workflow_id: "wf-3", status: "pending" }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result: cancelResult } = renderHook(() => useCancelWorkflow(), {
        wrapper: createWrapper(),
      });

      // Cancel multiple workflows
      await act(async () => {
        await cancelResult.current.cancelWorkflow("wf-1");
      });

      await act(async () => {
        await cancelResult.current.cancelWorkflow("wf-2");
      });

      expect(cancelResult.current.error).toBeNull();
    });

    it("should handle complex workflow with many steps", async () => {
      const complexSteps = Array.from({ length: 10 }, (_, i) =>
        createMockWorkflowStep({
          step_name: `Step ${i + 1}`,
          step_order: i + 1,
          status: i < 5 ? "completed" : i === 5 ? "running" : "pending",
        })
      );

      const mockWorkflows = [
        createMockWorkflow({
          workflow_id: "complex-wf-1",
          workflow_type: "provision_subscriber",
          status: "running",
          steps: complexSteps,
        }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result } = renderHook(() => useWorkflow("complex-wf-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.steps).toHaveLength(10);
      const completedSteps = result.current.data?.steps?.filter((s) => s.status === "completed");
      const runningSteps = result.current.data?.steps?.filter((s) => s.status === "running");
      const pendingSteps = result.current.data?.steps?.filter((s) => s.status === "pending");

      expect(completedSteps).toHaveLength(5);
      expect(runningSteps).toHaveLength(1);
      expect(pendingSteps).toHaveLength(4);
    });

    it("should handle workflow statistics with mixed states", async () => {
      const mockWorkflows = [
        createMockWorkflow({ workflow_type: "provision_subscriber", status: "completed" }),
        createMockWorkflow({ workflow_type: "provision_subscriber", status: "failed" }),
        createMockWorkflow({ workflow_type: "deprovision_subscriber", status: "running" }),
        createMockWorkflow({ workflow_type: "activate_service", status: "pending" }),
        createMockWorkflow({ workflow_type: "suspend_service", status: "completed" }),
        createMockWorkflow({ workflow_type: "terminate_service", status: "rolling_back" }),
      ];

      seedOrchestrationData(mockWorkflows);

      const { result: statsResult } = renderHook(() => useOrchestrationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(statsResult.current.isLoading).toBe(false));

      expect(statsResult.current.data?.total).toBe(6);
      expect(statsResult.current.data?.completed).toBe(2);
      expect(statsResult.current.data?.failed).toBe(1);
      expect(statsResult.current.data?.running).toBe(1);
      expect(statsResult.current.data?.pending).toBe(1);
    });
  });

});
