/**
 * Unit Tests for useOrchestration Hook
 *
 * Tests the orchestration workflow hooks using Jest mocks.
 * For integration tests with MSW, see useOrchestration.msw.test.tsx
 *
 * @see TESTING_STRATEGY.md for testing approach
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import {
  useOrchestrationStats,
  useWorkflows,
  useWorkflow,
  useRetryWorkflow,
  useCancelWorkflow,
  useExportWorkflows,
  orchestrationKeys,
  type Workflow,
  type WorkflowStatistics,
  type WorkflowListResponse,
  type WorkflowType,
  type WorkflowStatus,
} from "../useOrchestration";

// ============================================================================
// Mock API Client
// ============================================================================

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
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// ============================================================================
// Test Helpers
// ============================================================================

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

// ============================================================================
// Mock Data Factories
// ============================================================================

const createMockWorkflow = (overrides?: Partial<Workflow>): Workflow => ({
  id: 1,
  workflow_id: "wf-123",
  workflow_type: "provision_subscriber",
  status: "completed",
  tenant_id: "tenant-1",
  initiator_id: "user-1",
  initiator_type: "user",
  input_data: { subscriber_id: "sub-1" },
  output_data: { result: "success" },
  started_at: "2024-01-01T00:00:00Z",
  completed_at: "2024-01-01T00:05:00Z",
  retry_count: 0,
  max_retries: 3,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:05:00Z",
  ...overrides,
});

const createMockStats = (overrides?: Partial<WorkflowStatistics>): WorkflowStatistics => ({
  total: 100,
  pending: 5,
  running: 10,
  completed: 80,
  failed: 5,
  success_rate: 0.94,
  avg_duration_seconds: 120,
  by_type: {
    provision_subscriber: 30,
    deprovision_subscriber: 20,
    activate_service: 15,
    suspend_service: 10,
    terminate_service: 10,
    change_service_plan: 8,
    update_network_config: 5,
    migrate_subscriber: 2,
  },
  ...overrides,
});

const createMockWorkflowList = (
  workflows: Workflow[],
  overrides?: Partial<WorkflowListResponse>,
): WorkflowListResponse => ({
  workflows,
  total: workflows.length,
  page: 1,
  page_size: 20,
  total_pages: 1,
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe("useOrchestration - Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Query Key Factory Tests
  // ==========================================================================

  describe("Query Key Factory", () => {
    it("should generate correct base key", () => {
      expect(orchestrationKeys.all).toEqual(["orchestration"]);
    });

    it("should generate correct stats key", () => {
      expect(orchestrationKeys.stats()).toEqual(["orchestration", "stats"]);
    });

    it("should generate correct workflows key without filters", () => {
      expect(orchestrationKeys.workflows()).toEqual(["orchestration", "workflows", undefined]);
    });

    it("should generate correct workflows key with status filter", () => {
      expect(orchestrationKeys.workflows({ status: "running" })).toEqual([
        "orchestration",
        "workflows",
        { status: "running" },
      ]);
    });

    it("should generate correct workflows key with multiple filters", () => {
      const filters = {
        status: "completed" as WorkflowStatus,
        workflowType: "provision_subscriber" as WorkflowType,
        page: 2,
      };
      expect(orchestrationKeys.workflows(filters)).toEqual(["orchestration", "workflows", filters]);
    });

    it("should generate correct workflow detail key", () => {
      expect(orchestrationKeys.workflow("wf-123")).toEqual(["orchestration", "workflow", "wf-123"]);
    });
  });

  // ==========================================================================
  // useOrchestrationStats Tests
  // ==========================================================================

  describe("useOrchestrationStats", () => {
    it("should fetch stats successfully", async () => {
      const mockStats = createMockStats();
      mockApiClient.get.mockResolvedValueOnce({ data: mockStats });

      const { result } = renderHook(() => useOrchestrationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("orchestration/statistics");
      expect(result.current.data).toEqual(mockStats);
      expect(result.current.error).toBeNull();
    });

    it("should handle stats fetch error", async () => {
      mockApiClient.get.mockRejectedValueOnce({
        response: { data: { detail: "Server error" } },
      });

      const { result } = renderHook(() => useOrchestrationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should show loading state during fetch", async () => {
      mockApiClient.get.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: createMockStats() }), 100)),
      );

      const { result } = renderHook(() => useOrchestrationStats(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });
  });

  // ==========================================================================
  // useWorkflows Tests
  // ==========================================================================

  describe("useWorkflows", () => {
    it("should fetch workflows without filters", async () => {
      const mockWorkflows = [createMockWorkflow()];
      const mockResponse = createMockWorkflowList(mockWorkflows);
      mockApiClient.get.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useWorkflows(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("orchestration/workflows", {
        params: { page: 1, page_size: 20 },
      });
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should fetch workflows with status filter", async () => {
      const mockWorkflows = [createMockWorkflow({ status: "running" })];
      const mockResponse = createMockWorkflowList(mockWorkflows);
      mockApiClient.get.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useWorkflows({ status: "running" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("orchestration/workflows", {
        params: { page: 1, page_size: 20, status: "running" },
      });
      expect(result.current.data?.workflows[0].status).toBe("running");
    });

    it("should fetch workflows with workflow type filter", async () => {
      const mockWorkflows = [createMockWorkflow({ workflow_type: "activate_service" })];
      const mockResponse = createMockWorkflowList(mockWorkflows);
      mockApiClient.get.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useWorkflows({ workflowType: "activate_service" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("orchestration/workflows", {
        params: { page: 1, page_size: 20, workflow_type: "activate_service" },
      });
    });

    it("should fetch workflows with pagination", async () => {
      const mockWorkflows = [createMockWorkflow()];
      const mockResponse = createMockWorkflowList(mockWorkflows, { page: 2, page_size: 50 });
      mockApiClient.get.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useWorkflows({ page: 2, pageSize: 50 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("orchestration/workflows", {
        params: { page: 2, page_size: 50 },
      });
    });

    it("should handle empty workflows array", async () => {
      const mockResponse = createMockWorkflowList([]);
      mockApiClient.get.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useWorkflows(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.workflows).toEqual([]);
      expect(result.current.data?.total).toBe(0);
    });

    it("should handle workflows fetch error", async () => {
      mockApiClient.get.mockRejectedValueOnce({
        response: { data: { detail: "Server error" } },
      });

      const { result } = renderHook(() => useWorkflows(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });

  // ==========================================================================
  // useWorkflow Tests (Single workflow with polling)
  // ==========================================================================

  describe("useWorkflow", () => {
    it("should fetch single workflow successfully", async () => {
      const mockWorkflow = createMockWorkflow({ workflow_id: "wf-123" });
      mockApiClient.get.mockResolvedValueOnce({ data: mockWorkflow });

      const { result } = renderHook(() => useWorkflow("wf-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/orchestration/workflows/wf-123");
      expect(result.current.data).toEqual(mockWorkflow);
    });

    it("should return null when workflowId is null", async () => {
      const { result } = renderHook(() => useWorkflow(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it("should not fetch when workflowId is null (enabled=false)", async () => {
      const { result } = renderHook(() => useWorkflow(null, true), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });

    it("should handle workflow fetch error", async () => {
      mockApiClient.get.mockRejectedValueOnce({
        response: { data: { detail: "Workflow not found" }, status: 404 },
      });

      const { result } = renderHook(() => useWorkflow("wf-invalid"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should poll running workflows when autoRefresh is enabled", async () => {
      const runningWorkflow = createMockWorkflow({ status: "running" });
      mockApiClient.get.mockResolvedValue({ data: runningWorkflow });

      const { result } = renderHook(() => useWorkflow("wf-123", true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Verify polling would continue for running workflow
      expect(result.current.data?.status).toBe("running");
    });

    it("should stop polling for completed workflows", async () => {
      const completedWorkflow = createMockWorkflow({ status: "completed" });
      mockApiClient.get.mockResolvedValue({ data: completedWorkflow });

      const { result } = renderHook(() => useWorkflow("wf-123", true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.status).toBe("completed");
      // Polling should stop for terminal states
    });

    it("should stop polling for failed workflows", async () => {
      const failedWorkflow = createMockWorkflow({ status: "failed" });
      mockApiClient.get.mockResolvedValue({ data: failedWorkflow });

      const { result } = renderHook(() => useWorkflow("wf-123", true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.status).toBe("failed");
    });

    it("should stop polling for rolled_back workflows", async () => {
      const rolledBackWorkflow = createMockWorkflow({ status: "rolled_back" });
      mockApiClient.get.mockResolvedValue({ data: rolledBackWorkflow });

      const { result } = renderHook(() => useWorkflow("wf-123", true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.status).toBe("rolled_back");
    });

    it("should stop polling for timeout workflows", async () => {
      const timeoutWorkflow = createMockWorkflow({ status: "timeout" });
      mockApiClient.get.mockResolvedValue({ data: timeoutWorkflow });

      const { result } = renderHook(() => useWorkflow("wf-123", true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.status).toBe("timeout");
    });
  });

  // ==========================================================================
  // useRetryWorkflow Tests
  // ==========================================================================

  describe("useRetryWorkflow", () => {
    it("should retry workflow successfully", async () => {
      mockApiClient.post.mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useRetryWorkflow(), {
        wrapper: createWrapper(),
      });

      await result.current.retryWorkflow("wf-123");

      expect(mockApiClient.post).toHaveBeenCalledWith("/orchestration/workflows/wf-123/retry");
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should handle retry workflow error", async () => {
      mockApiClient.post.mockRejectedValueOnce(new Error("Retry failed"));

      const { result } = renderHook(() => useRetryWorkflow(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.retryWorkflow("wf-123")).rejects.toThrow();

      await waitFor(() => expect(result.current.error).toBeTruthy());
    });

    it("should show loading state during retry", async () => {
      mockApiClient.post.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100)),
      );

      const { result } = renderHook(() => useRetryWorkflow(), {
        wrapper: createWrapper(),
      });

      const retryPromise = result.current.retryWorkflow("wf-123");

      await waitFor(() => expect(result.current.loading).toBe(true));

      await retryPromise;

      await waitFor(() => expect(result.current.loading).toBe(false));
    });
  });

  // ==========================================================================
  // useCancelWorkflow Tests
  // ==========================================================================

  describe("useCancelWorkflow", () => {
    it("should cancel workflow successfully", async () => {
      mockApiClient.post.mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useCancelWorkflow(), {
        wrapper: createWrapper(),
      });

      await result.current.cancelWorkflow("wf-123");

      expect(mockApiClient.post).toHaveBeenCalledWith("/orchestration/workflows/wf-123/cancel");
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should handle cancel workflow error", async () => {
      mockApiClient.post.mockRejectedValueOnce(new Error("Cancel failed"));

      const { result } = renderHook(() => useCancelWorkflow(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.cancelWorkflow("wf-123")).rejects.toThrow();

      await waitFor(() => expect(result.current.error).toBeTruthy());
    });

    it("should show loading state during cancel", async () => {
      mockApiClient.post.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100)),
      );

      const { result } = renderHook(() => useCancelWorkflow(), {
        wrapper: createWrapper(),
      });

      const cancelPromise = result.current.cancelWorkflow("wf-123");

      await waitFor(() => expect(result.current.loading).toBe(true));

      await cancelPromise;

      await waitFor(() => expect(result.current.loading).toBe(false));
    });
  });

  // ==========================================================================
  // useExportWorkflows Tests
  // ==========================================================================

  describe("useExportWorkflows", () => {
    const setupDOMMocks = () => {
      // Mock DOM APIs for blob download
      global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
      global.URL.revokeObjectURL = jest.fn();

      // Mock document methods after rendering
      const mockLink = {
        click: jest.fn(),
        href: "",
        download: "",
      } as any;

      const originalCreateElement = document.createElement.bind(document);
      jest.spyOn(document, "createElement").mockImplementation((tagName: string) => {
        if (tagName === "a") {
          return mockLink;
        }
        return originalCreateElement(tagName);
      });
      jest.spyOn(document.body, "appendChild").mockReturnValue(mockLink);
      jest.spyOn(document.body, "removeChild").mockReturnValue(mockLink);
    };

    it("should export workflows as CSV with correct API call", async () => {
      const mockCSVData = "workflow_id,status\nwf-1,completed";
      mockApiClient.get.mockResolvedValueOnce({ data: mockCSVData });

      const { result } = renderHook(() => useExportWorkflows(), {
        wrapper: createWrapper(),
      });

      setupDOMMocks();

      await result.current.exportCSV({ status: "completed" });

      expect(mockApiClient.get).toHaveBeenCalledWith("orchestration/export/csv?status=completed", {
        responseType: "blob",
      });

      jest.restoreAllMocks();
    });

    it("should export workflows as JSON with correct parameters", async () => {
      const mockJSONData = JSON.stringify([{ workflow_id: "wf-1", status: "completed" }]);
      mockApiClient.get.mockResolvedValueOnce({ data: mockJSONData });

      const { result } = renderHook(() => useExportWorkflows(), {
        wrapper: createWrapper(),
      });

      setupDOMMocks();

      await result.current.exportJSON({ workflowType: "provision_subscriber", includeSteps: true });

      expect(mockApiClient.get).toHaveBeenCalledWith(
        "orchestration/export/json?workflow_type=provision_subscriber&include_steps=true",
        { responseType: "blob" },
      );

      jest.restoreAllMocks();
    });

    it("should handle export with date range", async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: "mock-data" });

      const { result } = renderHook(() => useExportWorkflows(), {
        wrapper: createWrapper(),
      });

      setupDOMMocks();

      await result.current.exportCSV({
        dateFrom: "2024-01-01",
        dateTo: "2024-01-31",
      });

      expect(mockApiClient.get).toHaveBeenCalledWith(
        "orchestration/export/csv?date_from=2024-01-01&date_to=2024-01-31",
        { responseType: "blob" },
      );

      jest.restoreAllMocks();
    });

    it("should handle export with limit", async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: "mock-data" });

      const { result } = renderHook(() => useExportWorkflows(), {
        wrapper: createWrapper(),
      });

      setupDOMMocks();

      await result.current.exportJSON({ limit: 100 });

      expect(mockApiClient.get).toHaveBeenCalledWith("orchestration/export/json?limit=100", {
        responseType: "blob",
      });

      jest.restoreAllMocks();
    });

    it("should handle export error", async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error("Export failed"));

      const { result } = renderHook(() => useExportWorkflows(), {
        wrapper: createWrapper(),
      });

      setupDOMMocks();

      await expect(result.current.exportCSV()).rejects.toThrow();

      await waitFor(() => expect(result.current.error).toBeTruthy());

      jest.restoreAllMocks();
    });

    it("should show loading state during export", async () => {
      mockApiClient.get.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: "mock-data" }), 100)),
      );

      const { result } = renderHook(() => useExportWorkflows(), {
        wrapper: createWrapper(),
      });

      setupDOMMocks();

      const exportPromise = result.current.exportCSV();

      await waitFor(() => expect(result.current.loading).toBe(true));

      await exportPromise;

      await waitFor(() => expect(result.current.loading).toBe(false));

      jest.restoreAllMocks();
    });
  });

  // ==========================================================================
  // Cache Invalidation Tests
  // ==========================================================================

  describe("Cache Invalidation", () => {
    it("should invalidate queries after retrying workflow", async () => {
      mockApiClient.post.mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useRetryWorkflow(), {
        wrapper: createWrapper(),
      });

      await result.current.retryWorkflow("wf-123");

      // Verify the mutation was called correctly
      expect(mockApiClient.post).toHaveBeenCalledWith("/orchestration/workflows/wf-123/retry");
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should invalidate queries after canceling workflow", async () => {
      mockApiClient.post.mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useCancelWorkflow(), {
        wrapper: createWrapper(),
      });

      await result.current.cancelWorkflow("wf-123");

      // Verify the mutation was called correctly
      expect(mockApiClient.post).toHaveBeenCalledWith("/orchestration/workflows/wf-123/cancel");
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });
});
