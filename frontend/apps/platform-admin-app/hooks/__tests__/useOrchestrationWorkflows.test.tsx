/**
 * Platform Admin App - useOrchestrationWorkflows tests
 *
 * Covers workflow list queries and retry mutation behavior.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useOrchestrationWorkflows } from "../useOrchestrationWorkflows";

jest.unmock("@tanstack/react-query");

const buildUrl = (path: string) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const prefixed = normalized.startsWith("/api/v1") ? normalized : `/api/v1${normalized}`;
  return `https://api.example.com${prefixed}`;
};

jest.mock("@/providers/AppConfigContext", () => ({
  useAppConfig: () => ({
    api: {
      baseUrl: "https://api.example.com",
      prefix: "/api/v1",
      buildUrl,
    },
    features: {},
    branding: {},
    tenant: {},
  }),
}));

const fetchMock = jest.fn();
const mockToast = jest.fn();
(global as any).mockToast = mockToast;

describe("Platform Admin useOrchestrationWorkflows hook", () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return { wrapper, queryClient };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
  });

  describe("useWorkflows", () => {
    it("fetches workflows successfully", async () => {
      const mockWorkflows = {
        workflows: [
          { id: 1, workflow_id: "wf-1", workflow_type: "provision_subscriber", status: "pending" },
          { id: 2, workflow_id: "wf-2", workflow_type: "activate_service", status: "running" },
        ],
        total: 2,
        limit: 50,
        offset: 0,
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWorkflows),
      });

      const { wrapper } = createWrapper();
      const workflowsHook = renderHook(() => useOrchestrationWorkflows({ toast: mockToast }), {
        wrapper,
      });

      const { result } = renderHook(() => workflowsHook.result.current.useWorkflows(), {
        wrapper,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockWorkflows);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.com/api/v1/orchestration/workflows?",
        expect.objectContaining({ credentials: "include" }),
      );
    });

    it("filters workflows by status", async () => {
      const mockWorkflows = {
        workflows: [
          { id: 1, workflow_id: "wf-1", workflow_type: "provision_subscriber", status: "failed" },
        ],
        total: 1,
        limit: 50,
        offset: 0,
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWorkflows),
      });

      const { wrapper } = createWrapper();
      const workflowsHook = renderHook(() => useOrchestrationWorkflows({ toast: mockToast }), {
        wrapper,
      });

      const { result } = renderHook(
        () => workflowsHook.result.current.useWorkflows({ status: "failed" }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("status=failed"),
        expect.anything(),
      );
    });

    it("handles fetch errors", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ detail: "Server error" }),
      });

      const { wrapper } = createWrapper();
      const workflowsHook = renderHook(() => useOrchestrationWorkflows({ toast: mockToast }), {
        wrapper,
      });

      const { result } = renderHook(() => workflowsHook.result.current.useWorkflows(), {
        wrapper,
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useWorkflow", () => {
    it("fetches single workflow successfully", async () => {
      const mockWorkflow = {
        id: 1,
        workflow_id: "wf-1",
        workflow_type: "provision_subscriber",
        status: "completed",
        steps: [],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWorkflow),
      });

      const { wrapper } = createWrapper();
      const workflowsHook = renderHook(() => useOrchestrationWorkflows({ toast: mockToast }), {
        wrapper,
      });

      const { result } = renderHook(() => workflowsHook.result.current.useWorkflow("wf-1"), {
        wrapper,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockWorkflow);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.com/api/v1/orchestration/workflows/wf-1",
        expect.objectContaining({ credentials: "include" }),
      );
    });

    it("does not fetch when workflowId is null", async () => {
      const { wrapper } = createWrapper();
      const workflowsHook = renderHook(() => useOrchestrationWorkflows({ toast: mockToast }), {
        wrapper,
      });

      const { result } = renderHook(() => workflowsHook.result.current.useWorkflow(null), {
        wrapper,
      });

      expect(result.current.isLoading).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("useWorkflowStats", () => {
    it("fetches workflow statistics successfully", async () => {
      const mockStats = {
        total_workflows: 100,
        by_status: {
          pending: 10,
          running: 5,
          completed: 80,
          failed: 5,
        },
        by_type: {
          provision_subscriber: 50,
          activate_service: 50,
        },
        success_rate: 94.12,
        average_duration_seconds: 45.2,
        recent_failures: 2,
        active_workflows: 15,
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStats),
      });

      const { wrapper } = createWrapper();
      const workflowsHook = renderHook(() => useOrchestrationWorkflows({ toast: mockToast }), {
        wrapper,
      });

      const { result } = renderHook(() => workflowsHook.result.current.useWorkflowStats(), {
        wrapper,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockStats);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.com/api/v1/orchestration/statistics",
        expect.objectContaining({ credentials: "include" }),
      );
    });
  });

  describe("retryWorkflow", () => {
    it("retries workflow and shows success toast", async () => {
      const mockWorkflow = { id: "wf-1", status: "pending" };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWorkflow),
      });

      const { wrapper } = createWrapper();
      const workflowsHook = renderHook(() => useOrchestrationWorkflows({ toast: mockToast }), {
        wrapper,
      });

      await act(async () => {
        await workflowsHook.result.current.retryWorkflow("wf-1");
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.com/api/v1/orchestration/workflows/wf-1/retry",
        expect.objectContaining({ method: "POST" }),
      );
      await waitFor(() =>
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Workflow retried" }),
        ),
      );
    });

    it("handles retry errors and shows error toast", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ detail: "Cannot retry completed workflow" }),
      });

      const { wrapper } = createWrapper();
      const workflowsHook = renderHook(() => useOrchestrationWorkflows({ toast: mockToast }), {
        wrapper,
      });

      await act(async () => {
        try {
          await workflowsHook.result.current.retryWorkflow("wf-1");
        } catch (error) {
          // Expected to throw
        }
      });

      await waitFor(() =>
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Retry failed",
            variant: "destructive",
          }),
        ),
      );
    });
  });

  describe("cancelWorkflow", () => {
    it("cancels workflow and shows success toast", async () => {
      const mockWorkflow = { id: "wf-1", status: "rolling_back" };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWorkflow),
      });

      const { wrapper } = createWrapper();
      const workflowsHook = renderHook(() => useOrchestrationWorkflows({ toast: mockToast }), {
        wrapper,
      });

      await act(async () => {
        await workflowsHook.result.current.cancelWorkflow("wf-1");
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.com/api/v1/orchestration/workflows/wf-1/cancel",
        expect.objectContaining({ method: "POST" }),
      );
      await waitFor(() =>
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Workflow cancelled" }),
        ),
      );
    });

    it("handles cancel errors and shows error toast", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ detail: "Cannot cancel completed workflow" }),
      });

      const { wrapper } = createWrapper();
      const workflowsHook = renderHook(() => useOrchestrationWorkflows({ toast: mockToast }), {
        wrapper,
      });

      await act(async () => {
        try {
          await workflowsHook.result.current.cancelWorkflow("wf-1");
        } catch (error) {
          // Expected to throw
        }
      });

      await waitFor(() =>
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Cancel failed",
            variant: "destructive",
          }),
        ),
      );
    });
  });

  describe("exportWorkflows", () => {
    let mockCreateObjectURL: jest.Mock;
    let mockRevokeObjectURL: jest.Mock;
    let mockAppendChild: jest.SpyInstance;
    let mockRemoveChild: jest.SpyInstance;
    let mockClick: jest.Mock;

    beforeEach(() => {
      // Mock URL methods
      mockCreateObjectURL = jest.fn(() => "blob:mock-url");
      mockRevokeObjectURL = jest.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      mockClick = jest.fn();
      mockAppendChild = jest
        .spyOn(document.body, "appendChild")
        .mockImplementation((node) => node);
      mockRemoveChild = jest
        .spyOn(document.body, "removeChild")
        .mockImplementation((node) => node);

      // Mock createElement for anchor tag
      const originalCreateElement = document.createElement.bind(document);
      jest.spyOn(document, "createElement").mockImplementation((tagName) => {
        const element = originalCreateElement(tagName);
        if (tagName === "a") {
          element.click = mockClick;
        }
        return element;
      });
    });

    afterEach(() => {
      mockAppendChild.mockRestore();
      mockRemoveChild.mockRestore();
      jest.restoreAllMocks();
    });

    it("exports workflows as CSV", async () => {
      const mockBlob = new Blob(["csv,data"], { type: "text/csv" });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const { wrapper } = createWrapper();
      const workflowsHook = renderHook(() => useOrchestrationWorkflows({ toast: mockToast }), {
        wrapper,
      });

      await act(async () => {
        await workflowsHook.result.current.exportWorkflows("csv");
      });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/orchestration/export/csv"),
        expect.objectContaining({ credentials: "include" }),
      );
      expect(mockClick).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Export successful" }),
      );
    });

    it("exports workflows as JSON", async () => {
      const mockBlob = new Blob(['{"data": "json"}'], { type: "application/json" });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const { wrapper } = createWrapper();
      const workflowsHook = renderHook(() => useOrchestrationWorkflows({ toast: mockToast }), {
        wrapper,
      });

      await act(async () => {
        await workflowsHook.result.current.exportWorkflows("json", {
          include_steps: true,
        });
      });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/orchestration/export/json"),
        expect.objectContaining({ credentials: "include" }),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("include_steps=true"),
        expect.anything(),
      );
    });

    it("handles export errors", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ detail: "Export failed" }),
      });

      const { wrapper } = createWrapper();
      const workflowsHook = renderHook(() => useOrchestrationWorkflows({ toast: mockToast }), {
        wrapper,
      });

      await act(async () => {
        await workflowsHook.result.current.exportWorkflows("csv");
      });

      await waitFor(() =>
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Export failed",
            variant: "destructive",
          }),
        ),
      );
    });
  });
});
