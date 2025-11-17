/**
 * Platform Admin App - useDataTransfer tests
 *
 * Validates TanStack query/mutation flows plus helper utilities.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useTransferJobs,
  useCreateImportJob,
  getStatusColor,
  getStatusIcon,
} from "../useDataTransfer";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";
import { useToast } from "@dotmac/ui";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/api/response-helpers", () => ({
  extractDataOrThrow: jest.fn((response) => response.data),
}));

const global.mockToast = jest.fn();
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: global.mockToast,
  }),
}));

const mockedApi = apiClient as jest.Mocked<typeof apiClient>;
const mockedExtract = extractDataOrThrow as jest.Mock;

describe("Platform Admin useDataTransfer hooks", () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return { wrapper, queryClient };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches transfer jobs with filters", async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        jobs: [{ job_id: "job-1", name: "Import Customers" }],
        total: 1,
        page: 1,
        page_size: 20,
        has_more: false,
      },
    });

    const { wrapper } = createWrapper();
    const filters = { type: "import", status: "running", page: 2, page_size: 50 } as const;
    const { result } = renderHook(() => useTransferJobs(filters), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedApi.get).toHaveBeenCalledWith("/data-transfer/jobs", {
      params: {
        type: "import",
        job_status: "running",
        page: 2,
        page_size: 50,
      },
    });
    expect(mockedExtract).toHaveBeenCalled();
    expect(result.current.data?.jobs[0].name).toBe("Import Customers");
  });

  it("creates import jobs, invalidates caches, and triggers toast", async () => {
    mockedApi.post.mockResolvedValue({
      data: {
        job_id: "job-2",
        name: "Import Products",
      },
    });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateImportJob(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        source_type: "file",
        source_path: "/tmp/products.csv",
        format: "csv",
      } as any);
    });

    expect(mockedApi.post).toHaveBeenCalledWith("/data-transfer/import", {
      source_type: "file",
      source_path: "/tmp/products.csv",
      format: "csv",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["data-transfer", "jobs"] });
    expect(global.mockToast).toHaveBeenCalledWith({
      title: "Import job created",
      description: 'Job "Import Products" has been queued for processing.',
    });
  });

  it("returns status helpers", () => {
    expect(getStatusColor("completed")).toContain("emerald");
    expect(getStatusIcon("failed")).toBe("✗");
  });
});
