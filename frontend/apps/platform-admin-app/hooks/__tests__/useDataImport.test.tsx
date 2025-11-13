/**
 * Platform Admin App - useDataImport tests
 *
 * Covers the upload mutation and nested query hooks.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useDataImport } from "../useDataImport";
import { useToast } from "@dotmac/ui";

jest.unmock("@tanstack/react-query");

const toastMock = jest.fn();
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

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

describe("Platform Admin useDataImport hook", () => {
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

  it("uploads imports and invalidates job list", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "job-1", celery_task_id: null }),
      })
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ jobs: [], total: 0 }),
      });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDataImport(), { wrapper });
    const file = new File(["name,email"], "contacts.csv", { type: "text/csv" });

    await act(async () => {
      result.current.uploadImport({
        entity_type: "customers",
        file,
      } as any);
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["import-jobs"] });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Upload successful" }),
    );
  });

  it("exposes nested useImportJobs hook", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ jobs: [{ id: "job-99" }], total: 1 }),
    });

    const { wrapper } = createWrapper();
    const dataImportHook = renderHook(() => useDataImport(), { wrapper });

    const JobsHook = dataImportHook.result.current.useImportJobs;
    const jobsQuery = renderHook(() => JobsHook(), { wrapper });

    await waitFor(() => expect(jobsQuery.result.current.data?.jobs).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/api/v1/data-import/jobs?", {
      credentials: "include",
    });
  });
});
