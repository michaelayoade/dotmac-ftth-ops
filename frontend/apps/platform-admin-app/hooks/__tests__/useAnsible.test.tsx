/**
 * Platform Admin App - useAnsible tests
 *
 * Verifies AWX health queries and job mutations invalidate caches.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useAWXHealth, useJobTemplates, useLaunchJob, useCancelJob } from "../useAnsible";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock("@/lib/api/response-helpers", () => ({
  extractDataOrThrow: jest.fn((response) => response.data),
}));

const mockedApi = apiClient as jest.Mocked<typeof apiClient>;
const mockedExtract = extractDataOrThrow as jest.Mock;

describe("Platform Admin useAnsible hooks", () => {
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
  });

  it("fetches AWX health and job templates", async () => {
    mockedApi.get
      .mockResolvedValueOnce({ data: { status: "ok" } })
      .mockResolvedValueOnce({ data: [{ id: 1, name: "Provision Site" }] });

    const { wrapper } = createWrapper();
    const healthHook = renderHook(() => useAWXHealth(), { wrapper });
    await waitFor(() => expect(healthHook.result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith("/ansible/health");
    expect(healthHook.result.current.data?.status).toBe("ok");

    const templatesHook = renderHook(() => useJobTemplates(), { wrapper });
    await waitFor(() => expect(templatesHook.result.current.data).toHaveLength(1));
    expect(mockedApi.get).toHaveBeenCalledWith("/ansible/job-templates");
  });

  it("launches and cancels jobs with cache invalidation", async () => {
    mockedApi.post.mockResolvedValue({ data: { job: 123 } });
    mockedExtract.mockReturnValue({ job: 123 });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const launchHook = renderHook(() => useLaunchJob(), { wrapper });
    await act(async () => {
      await launchHook.result.current.mutateAsync({ template_id: 42 } as any);
    });
    expect(mockedApi.post).toHaveBeenCalledWith("/ansible/jobs/launch", { template_id: 42 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["ansible", "jobs"] });

    const cancelHook = renderHook(() => useCancelJob(), { wrapper });
    await act(async () => {
      await cancelHook.result.current.mutateAsync({ jobId: 99 });
    });
    expect(mockedApi.post).toHaveBeenCalledWith("/ansible/jobs/99/cancel");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["ansible", "jobs"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["ansible", "job", 99] });
  });
});
