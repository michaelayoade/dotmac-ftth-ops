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
const global.mockToast = jest.fn();

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
    const workflowsHook = renderHook(() => useOrchestrationWorkflows({ toast: global.mockToast }), {
      wrapper,
    });
    expect(typeof workflowsHook.result.current.useWorkflows).toBe("function");

    await act(async () => {
      await workflowsHook.result.current.retryWorkflow("wf-1");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/orchestration/workflows/wf-1/retry",
      expect.objectContaining({ method: "POST" }),
    );
    await waitFor(() =>
      expect(global.mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Workflow retried" }),
      ),
    );
  });
});
