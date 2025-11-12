/**
 * Platform Admin App - useOrchestrationWorkflows tests
 *
 * Covers workflow list queries and retry mutation behavior.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useOrchestrationWorkflows } from "../useOrchestrationWorkflows";
import { useToast } from "@dotmac/ui";

jest.unmock("@tanstack/react-query");

const toastMock = jest.fn();
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

jest.mock("@/lib/config", () => ({
  platformConfig: {
    api: {
      baseUrl: "https://api.example.com",
      buildUrl: (path: string) => `https://api.example.com${path}`,
    },
  },
}));

const fetchMock = jest.fn();

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

  it("fetches workflows and retries workflow on demand", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ workflows: [], total: 0, limit: 50, offset: 0 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "wf-1", status: "pending" }),
      });

    const { wrapper, queryClient } = createWrapper();
    const workflowsHook = renderHook(() => useOrchestrationWorkflows(), { wrapper });
    expect(typeof workflowsHook.result.current.useWorkflows).toBe("function");

    await act(async () => {
      workflowsHook.result.current.retryWorkflow("wf-1");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/orchestration/workflows/wf-1/retry",
      expect.objectContaining({ method: "POST" }),
    );
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Workflow retried" }),
    );
  });
});
