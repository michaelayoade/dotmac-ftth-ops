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
  useTransferJob,
  useSupportedFormats,
  useCreateImportJob,
  useCreateExportJob,
  useCancelJob,
  getStatusColor,
  getStatusIcon,
  formatDuration,
  formatBytes,
  formatTimestamp,
  getTypeColor,
  calculateETA,
  type TransferJobResponse,
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

const mockToast = jest.fn();
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

const mockedApi = apiClient as jest.Mocked<typeof apiClient>;
const mockedExtract = extractDataOrThrow as jest.Mock;

describe("Platform Admin useDataTransfer hooks", () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, refetchInterval: false },
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
    // Reset extractDataOrThrow to default behavior
    mockedExtract.mockImplementation((response) => response.data);
  });

  describe("useTransferJobs", () => {
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

    it("fetches jobs without filters", async () => {
      mockedApi.get.mockResolvedValue({
        data: {
          jobs: [],
          total: 0,
          page: 1,
          page_size: 20,
          has_more: false,
        },
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useTransferJobs(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedApi.get).toHaveBeenCalledWith("/data-transfer/jobs", {
        params: {
          type: undefined,
          job_status: undefined,
          page: 1,
          page_size: 20,
        },
      });
    });

    it("handles API errors", async () => {
      const error = new Error("Network error");
      mockedApi.get.mockRejectedValue(error);
      mockedExtract.mockImplementation(() => {
        throw error;
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useTransferJobs(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBe(error);

      // Reset mock for next tests
      mockedExtract.mockImplementation((response) => response.data);
    });
  });

  describe("useTransferJob", () => {
    it("fetches a single job successfully", async () => {
      mockedApi.get.mockResolvedValue({
        data: {
          job_id: "job-123",
          name: "Import Test",
          type: "import",
          status: "completed",
          progress: 100,
        },
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useTransferJob("job-123"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedApi.get).toHaveBeenCalledWith("/data-transfer/jobs/job-123");
      expect(result.current.data?.job_id).toBe("job-123");
    });

    it("does not fetch when jobId is empty", () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useTransferJob(""), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
      expect(mockedApi.get).not.toHaveBeenCalled();
    });

    it("handles job not found", async () => {
      const error = new Error("Job not found");
      mockedApi.get.mockRejectedValue(error);
      mockedExtract.mockImplementation(() => {
        throw error;
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useTransferJob("nonexistent"), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBe(error);

      // Reset mock for next tests
      mockedExtract.mockImplementation((response) => response.data);
    });
  });

  describe("useSupportedFormats", () => {
    it("fetches supported formats", async () => {
      mockedApi.get.mockResolvedValue({
        data: {
          import_formats: [
            {
              format: "csv",
              name: "CSV",
              file_extensions: [".csv"],
              mime_types: ["text/csv"],
              supports_compression: true,
              supports_streaming: true,
              options: {},
            },
          ],
          export_formats: [
            {
              format: "json",
              name: "JSON",
              file_extensions: [".json"],
              mime_types: ["application/json"],
              supports_compression: true,
              supports_streaming: true,
              options: {},
            },
          ],
          compression_types: ["none", "gzip", "zip"],
        },
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useSupportedFormats(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedApi.get).toHaveBeenCalledWith("/data-transfer/formats");
      expect(result.current.data?.import_formats).toHaveLength(1);
      expect(result.current.data?.export_formats).toHaveLength(1);
      expect(result.current.data?.compression_types).toContain("gzip");
    });
  });

  describe("useCreateImportJob", () => {
    it("creates import jobs, invalidates caches, and triggers toast", async () => {
      mockedApi.post.mockResolvedValue({
        data: {
          job_id: "job-2",
          name: "Import Products",
          type: "import",
          status: "pending",
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
      expect(mockToast).toHaveBeenCalledWith({
        title: "Import job created",
        description: 'Job "Import Products" has been queued for processing.',
      });
    });

    it("handles import job creation errors", async () => {
      const error = {
        response: {
          data: {
            detail: "Invalid file format",
          },
        },
      };
      mockedApi.post.mockRejectedValue(error);
      mockedExtract.mockImplementation(() => {
        throw error;
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useCreateImportJob(), { wrapper });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            source_type: "file",
            source_path: "/tmp/bad.csv",
            format: "csv",
          } as any);
        } catch (e) {
          // Expected to fail
        }
      });

      await waitFor(() => expect(mockToast).toHaveBeenCalled());

      expect(mockToast).toHaveBeenCalledWith({
        title: "Import failed",
        description: "Invalid file format",
        variant: "destructive",
      });

      // Reset mock for next tests
      mockedExtract.mockImplementation((response) => response.data);
    });
  });

  describe("useCreateExportJob", () => {
    it("creates export job successfully", async () => {
      mockedApi.post.mockResolvedValue({
        data: {
          job_id: "job-export-1",
          name: "Export to CSV",
          type: "export",
          status: "pending",
        },
      });

      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useCreateExportJob(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          target_type: "file",
          target_path: "/exports/data.csv",
          format: "csv",
        } as any);
      });

      expect(mockedApi.post).toHaveBeenCalledWith("/data-transfer/export", {
        target_type: "file",
        target_path: "/exports/data.csv",
        format: "csv",
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["data-transfer", "jobs"] });
      expect(mockToast).toHaveBeenCalledWith({
        title: "Export job created",
        description: 'Job "Export to CSV" has been queued for processing.',
      });
    });

    it("handles export job creation errors", async () => {
      const error = {
        response: {
          data: {
            detail: "Permission denied",
          },
        },
      };
      mockedApi.post.mockRejectedValue(error);
      mockedExtract.mockImplementation(() => {
        throw error;
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useCreateExportJob(), { wrapper });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            target_type: "file",
            target_path: "/forbidden/data.csv",
            format: "csv",
          } as any);
        } catch (e) {
          // Expected to fail
        }
      });

      await waitFor(() => expect(mockToast).toHaveBeenCalled());

      expect(mockToast).toHaveBeenCalledWith({
        title: "Export failed",
        description: "Permission denied",
        variant: "destructive",
      });

      // Reset mock for next tests
      mockedExtract.mockImplementation((response) => response.data);
    });
  });

  describe("useCancelJob", () => {
    it("cancels a job successfully", async () => {
      mockedApi.delete.mockResolvedValue({
        status: 204,
      });

      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useCancelJob(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync("job-123");
      });

      expect(mockedApi.delete).toHaveBeenCalledWith("/data-transfer/jobs/job-123");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["data-transfer", "jobs"] });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["data-transfer", "jobs", "job-123"],
      });
      expect(mockToast).toHaveBeenCalledWith({
        title: "Job cancelled",
        description: "Transfer job has been cancelled successfully.",
      });
    });

    it("handles cancellation errors", async () => {
      const error = {
        response: {
          data: {
            detail: "Job already completed",
          },
        },
      };
      mockedApi.delete.mockResolvedValue({
        status: 400,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useCancelJob(), { wrapper });

      await act(async () => {
        try {
          await result.current.mutateAsync("job-completed");
        } catch (e) {
          // Expected to fail
        }
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("handles job not found during cancellation", async () => {
      const error = {
        response: {
          data: {
            detail: "Job not found",
          },
        },
      };
      mockedApi.delete.mockRejectedValue(error);

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useCancelJob(), { wrapper });

      await act(async () => {
        try {
          await result.current.mutateAsync("nonexistent");
        } catch (e) {
          // Expected to fail
        }
      });

      await waitFor(() => expect(mockToast).toHaveBeenCalled());

      expect(mockToast).toHaveBeenCalledWith({
        title: "Cancellation failed",
        description: "Job not found",
        variant: "destructive",
      });
    });
  });

  describe("Utility Functions", () => {
    describe("getStatusColor", () => {
      it("returns correct colors for each status", () => {
        expect(getStatusColor("pending")).toContain("gray");
        expect(getStatusColor("running")).toContain("blue");
        expect(getStatusColor("completed")).toContain("emerald");
        expect(getStatusColor("failed")).toContain("red");
        expect(getStatusColor("cancelled")).toContain("yellow");
      });
    });

    describe("getStatusIcon", () => {
      it("returns correct icons for each status", () => {
        expect(getStatusIcon("pending")).toBe("⏳");
        expect(getStatusIcon("running")).toBe("▶");
        expect(getStatusIcon("completed")).toBe("✓");
        expect(getStatusIcon("failed")).toBe("✗");
        expect(getStatusIcon("cancelled")).toBe("⊘");
      });
    });

    describe("formatDuration", () => {
      it("formats seconds correctly", () => {
        expect(formatDuration(30)).toBe("30s");
        expect(formatDuration(90)).toBe("1m 30s");
        expect(formatDuration(3665)).toBe("1h 1m");
        expect(formatDuration(null)).toBe("N/A");
        expect(formatDuration(undefined)).toBe("N/A");
      });

      it("handles edge cases", () => {
        expect(formatDuration(0)).toBe("0s");
        expect(formatDuration(59)).toBe("59s");
        expect(formatDuration(60)).toBe("1m 0s");
        expect(formatDuration(3600)).toBe("1h 0m");
      });
    });

    describe("formatBytes", () => {
      it("formats bytes correctly", () => {
        expect(formatBytes(0)).toBe("0 Bytes");
        expect(formatBytes(1024)).toBe("1 KB");
        expect(formatBytes(1048576)).toBe("1 MB");
        expect(formatBytes(1073741824)).toBe("1 GB");
      });

      it("handles decimal values", () => {
        expect(formatBytes(1536)).toBe("1.5 KB");
        expect(formatBytes(2097152)).toBe("2 MB");
      });
    });

    describe("formatTimestamp", () => {
      it("formats recent timestamps", () => {
        const now = new Date();

        // Just now
        expect(formatTimestamp(now.toISOString())).toBe("Just now");

        // Minutes ago
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        expect(formatTimestamp(fiveMinutesAgo.toISOString())).toBe("5 minutes ago");

        const oneMinuteAgo = new Date(now.getTime() - 1 * 60 * 1000);
        expect(formatTimestamp(oneMinuteAgo.toISOString())).toBe("1 minute ago");
      });

      it("formats hours ago", () => {
        const now = new Date();
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        expect(formatTimestamp(twoHoursAgo.toISOString())).toBe("2 hours ago");

        const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);
        expect(formatTimestamp(oneHourAgo.toISOString())).toBe("1 hour ago");
      });

      it("formats days ago", () => {
        const now = new Date();
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        expect(formatTimestamp(threeDaysAgo.toISOString())).toBe("3 days ago");

        const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
        expect(formatTimestamp(oneDayAgo.toISOString())).toBe("1 day ago");
      });

      it("formats old dates", () => {
        const now = new Date();
        const longAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        const formatted = formatTimestamp(longAgo.toISOString());
        expect(formatted).not.toBe("Never");
        expect(formatted).toMatch(/\d+\/\d+\/\d+/); // Should be a date string
      });

      it("handles null and undefined", () => {
        expect(formatTimestamp(null)).toBe("Never");
        expect(formatTimestamp(undefined)).toBe("Never");
      });
    });

    describe("getTypeColor", () => {
      it("returns correct colors for each type", () => {
        expect(getTypeColor("import")).toContain("blue");
        expect(getTypeColor("export")).toContain("purple");
        expect(getTypeColor("sync")).toContain("cyan");
        expect(getTypeColor("migrate")).toContain("orange");
      });
    });

    describe("calculateETA", () => {
      it("calculates ETA for running job", () => {
        const job: TransferJobResponse = {
          job_id: "job-1",
          name: "Test",
          type: "import",
          status: "running",
          progress: 50,
          created_at: new Date().toISOString(),
          started_at: new Date(Date.now() - 60000).toISOString(), // Started 1 min ago
          completed_at: null,
          records_processed: 500,
          records_failed: 0,
          records_total: 1000,
          error_message: null,
          metadata: null,
        };

        const eta = calculateETA(job);
        expect(eta).not.toBe("N/A");
        // ETA should be around 1 minute since we're 50% done and took 1 minute
        expect(eta).toContain("m");
      });

      it("returns N/A for pending job", () => {
        const job: TransferJobResponse = {
          job_id: "job-1",
          name: "Test",
          type: "import",
          status: "pending",
          progress: 0,
          created_at: new Date().toISOString(),
          started_at: null,
          completed_at: null,
          records_processed: 0,
          records_failed: 0,
          records_total: null,
          error_message: null,
          metadata: null,
        };

        expect(calculateETA(job)).toBe("N/A");
      });

      it("returns N/A for completed job", () => {
        const job: TransferJobResponse = {
          job_id: "job-1",
          name: "Test",
          type: "import",
          status: "completed",
          progress: 100,
          created_at: new Date().toISOString(),
          started_at: new Date(Date.now() - 60000).toISOString(),
          completed_at: new Date().toISOString(),
          records_processed: 1000,
          records_failed: 0,
          records_total: 1000,
          error_message: null,
          metadata: null,
        };

        expect(calculateETA(job)).toBe("N/A");
      });

      it("returns N/A for job with 0 progress", () => {
        const job: TransferJobResponse = {
          job_id: "job-1",
          name: "Test",
          type: "import",
          status: "running",
          progress: 0,
          created_at: new Date().toISOString(),
          started_at: new Date(Date.now() - 5000).toISOString(),
          completed_at: null,
          records_processed: 0,
          records_failed: 0,
          records_total: 1000,
          error_message: null,
          metadata: null,
        };

        expect(calculateETA(job)).toBe("N/A");
      });
    });
  });
});
