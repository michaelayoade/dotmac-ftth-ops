/**
 * Jest Mock Tests for useDataTransfer hook
 * Tests data import/export operations with Jest mocks instead of MSW
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { createQueryWrapper } from "@/__tests__/test-utils";
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
  getTypeColor,
  calculateETA,
  type TransferJobResponse,
  type TransferJobListResponse,
  type FormatsResponse,
} from "../useDataTransfer";
import { apiClient } from "@/lib/api/client";

// Mock apiClient
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

// Mock useToast
jest.mock("@dotmac/ui", () => ({
  ...jest.requireActual("@dotmac/ui"),
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe("useDataTransfer", () => {
  const waitForTransferLoading = async (getLoading: () => boolean) => {
    await waitFor(() => expect(getLoading()).toBe(false), { timeout: 5000 });
  };

  const waitForTransferSuccess = async (getStatus: () => boolean) => {
    await waitFor(() => expect(getStatus()).toBe(true), { timeout: 5000 });
  };

  // Helper to create mock job
  function createMockJob(overrides?: Partial<TransferJobResponse>): TransferJobResponse {
    return {
      job_id: "job-1",
      name: "Test Job",
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
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useTransferJobs", () => {
    it("should fetch transfer jobs successfully", async () => {
      const mockJobs: TransferJobListResponse = {
        jobs: [
          createMockJob({
            job_id: "job-1",
            name: "Import Subscribers",
            type: "import",
            status: "completed",
            progress: 100,
          }),
          createMockJob({
            job_id: "job-2",
            name: "Export Invoices",
            type: "export",
            status: "running",
            progress: 45,
          }),
        ],
        total: 2,
        page: 1,
        page_size: 20,
        has_more: false,
      };

      mockedApiClient.get.mockResolvedValueOnce({ data: mockJobs });

      const { result } = renderHook(() => useTransferJobs(), {
        wrapper: createQueryWrapper(),
      });

      await waitForTransferLoading(() => result.current.isLoading);

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.jobs).toHaveLength(2);
      expect(result.current.data?.total).toBe(2);
      expect(result.current.data?.jobs[0].job_id).toBe("job-1");
    });

    it("should filter jobs by type", async () => {
      const mockJobs: TransferJobListResponse = {
        jobs: [
          createMockJob({ type: "import", status: "completed" }),
          createMockJob({ type: "import", status: "failed" }),
        ],
        total: 2,
        page: 1,
        page_size: 20,
        has_more: false,
      };

      mockedApiClient.get.mockResolvedValueOnce({ data: mockJobs });

      const { result } = renderHook(() => useTransferJobs({ type: "import" }), {
        wrapper: createQueryWrapper(),
      });

      await waitForTransferLoading(() => result.current.isLoading);

      expect(result.current.data?.jobs).toHaveLength(2);
      expect(result.current.data?.jobs.every((j) => j.type === "import")).toBe(true);
      expect(mockedApiClient.get).toHaveBeenCalledWith("/data-transfer/jobs", {
        params: {
          type: "import",
          job_status: undefined,
          page: 1,
          page_size: 20,
        },
      });
    });

    it("should filter jobs by status", async () => {
      const mockJobs: TransferJobListResponse = {
        jobs: [createMockJob({ status: "running" })],
        total: 1,
        page: 1,
        page_size: 20,
        has_more: false,
      };

      mockedApiClient.get.mockResolvedValueOnce({ data: mockJobs });

      const { result } = renderHook(() => useTransferJobs({ status: "running" }), {
        wrapper: createQueryWrapper(),
      });

      await waitForTransferLoading(() => result.current.isLoading);

      expect(result.current.data?.jobs).toHaveLength(1);
      expect(result.current.data?.jobs[0].status).toBe("running");
      expect(mockedApiClient.get).toHaveBeenCalledWith("/data-transfer/jobs", {
        params: {
          type: undefined,
          job_status: "running",
          page: 1,
          page_size: 20,
        },
      });
    });

    it("should support pagination", async () => {
      const mockJobs: TransferJobListResponse = {
        jobs: Array.from({ length: 10 }, (_, i) =>
          createMockJob({
            job_id: `job-${i + 1}`,
            name: `Job ${i + 1}`,
          }),
        ),
        total: 25,
        page: 1,
        page_size: 10,
        has_more: true,
      };

      mockedApiClient.get.mockResolvedValueOnce({ data: mockJobs });

      const { result } = renderHook(() => useTransferJobs({ page: 1, page_size: 10 }), {
        wrapper: createQueryWrapper(),
      });

      await waitForTransferLoading(() => result.current.isLoading);

      expect(result.current.data?.jobs).toHaveLength(10);
      expect(result.current.data?.total).toBe(25);
      expect(result.current.data?.has_more).toBe(true);
    });
  });

  describe("useTransferJob", () => {
    it("should fetch single job successfully", async () => {
      const mockJob = createMockJob({
        job_id: "job-123",
        name: "Import Test",
        type: "import",
        status: "completed",
        progress: 100,
        records_processed: 1000,
        records_failed: 5,
        records_total: 1005,
      });

      mockedApiClient.get.mockResolvedValueOnce({ data: mockJob });

      const { result } = renderHook(() => useTransferJob("job-123"), {
        wrapper: createQueryWrapper(),
      });

      await waitForTransferLoading(() => result.current.isLoading);

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.job_id).toBe("job-123");
      expect(result.current.data?.records_processed).toBe(1000);
      expect(result.current.data?.records_failed).toBe(5);
    });

    it("should handle job not found", async () => {
      mockedApiClient.get.mockRejectedValueOnce({
        message: "404",
        response: { status: 404, data: { detail: "Job not found" } },
      });

      const { result } = renderHook(() => useTransferJob("nonexistent"), {
        wrapper: createQueryWrapper(),
      });

      await waitForTransferLoading(() => result.current.isLoading);

      expect(result.current.isError).toBe(true);
      expect(result.current.error?.message).toContain("404");
    });

    it("should not fetch when jobId is empty", () => {
      const { result } = renderHook(() => useTransferJob(""), {
        wrapper: createQueryWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useSupportedFormats", () => {
    it("should fetch supported formats", async () => {
      const mockFormats: FormatsResponse = {
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
        compression_types: ["gzip", "zip"],
      };

      mockedApiClient.get.mockResolvedValueOnce({ data: mockFormats });

      const { result } = renderHook(() => useSupportedFormats(), {
        wrapper: createQueryWrapper(),
      });

      await waitForTransferLoading(() => result.current.isLoading);

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.import_formats).toBeDefined();
      expect(result.current.data?.export_formats).toBeDefined();
      expect(result.current.data?.compression_types).toBeDefined();
    });

    it("should include CSV format in imports", async () => {
      const mockFormats: FormatsResponse = {
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
        export_formats: [],
        compression_types: [],
      };

      mockedApiClient.get.mockResolvedValueOnce({ data: mockFormats });

      const { result } = renderHook(() => useSupportedFormats(), {
        wrapper: createQueryWrapper(),
      });

      await waitForTransferLoading(() => result.current.isLoading);

      const csvFormat = result.current.data?.import_formats.find((f) => f.format === "csv");
      expect(csvFormat).toBeDefined();
      expect(csvFormat?.supports_compression).toBe(true);
      expect(csvFormat?.supports_streaming).toBe(true);
    });

    it("should include JSON format in exports", async () => {
      const mockFormats: FormatsResponse = {
        import_formats: [],
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
        compression_types: [],
      };

      mockedApiClient.get.mockResolvedValueOnce({ data: mockFormats });

      const { result } = renderHook(() => useSupportedFormats(), {
        wrapper: createQueryWrapper(),
      });

      await waitForTransferLoading(() => result.current.isLoading);

      const jsonFormat = result.current.data?.export_formats.find((f) => f.format === "json");
      expect(jsonFormat).toBeDefined();
      expect(jsonFormat?.file_extensions).toContain(".json");
    });
  });

  describe("useCreateImportJob", () => {
    it("should create import job successfully", async () => {
      const mockJob = createMockJob({
        job_id: "import-job-1",
        name: "Import Subscribers",
        type: "import",
        status: "pending",
      });

      mockedApiClient.post.mockResolvedValueOnce({ data: mockJob });

      const { result } = renderHook(() => useCreateImportJob(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          source_type: "file",
          source_path: "/uploads/subscribers.csv",
          format: "csv",
          validation_level: "strict",
          batch_size: 1000,
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.type).toBe("import");
      expect(result.current.data?.status).toBe("pending");
    });

    it("should include metadata in created job", async () => {
      const mockJob = createMockJob({
        type: "import",
        status: "pending",
        metadata: {
          source_type: "s3",
          format: "json",
          dry_run: true,
        },
      });

      mockedApiClient.post.mockResolvedValueOnce({ data: mockJob });

      const { result } = renderHook(() => useCreateImportJob(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          source_type: "s3",
          source_path: "s3://bucket/data.json",
          format: "json",
          dry_run: true,
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.metadata).toMatchObject({
        source_type: "s3",
        format: "json",
        dry_run: true,
      });
    });
  });

  describe("useCreateExportJob", () => {
    it("should create export job successfully", async () => {
      const mockJob = createMockJob({
        type: "export",
        status: "pending",
      });

      mockedApiClient.post.mockResolvedValueOnce({ data: mockJob });

      const { result } = renderHook(() => useCreateExportJob(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          target_type: "file",
          target_path: "/exports/invoices.csv",
          format: "csv",
          compression: "gzip",
          batch_size: 500,
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.type).toBe("export");
      expect(result.current.data?.status).toBe("pending");
    });

    it("should include export options in metadata", async () => {
      const mockJob = createMockJob({
        type: "export",
        status: "pending",
        metadata: {
          target_type: "email",
          format: "excel",
          overwrite: true,
        },
      });

      mockedApiClient.post.mockResolvedValueOnce({ data: mockJob });

      const { result } = renderHook(() => useCreateExportJob(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          target_type: "email",
          target_path: "admin@example.com",
          format: "excel",
          fields: ["id", "name", "email"],
          overwrite: true,
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.metadata).toMatchObject({
        target_type: "email",
        format: "excel",
        overwrite: true,
      });
    });
  });

  describe("useCancelJob", () => {
    it("should cancel job successfully", async () => {
      mockedApiClient.delete.mockResolvedValueOnce({ status: 204 });

      const { result } = renderHook(() => useCancelJob(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("job-cancel-1");
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isSuccess).toBe(true);
      expect(mockedApiClient.delete).toHaveBeenCalledWith("/data-transfer/jobs/job-cancel-1");
    });

    it("should handle cancel non-existent job", async () => {
      mockedApiClient.delete.mockResolvedValueOnce({ status: 404 });

      const { result } = renderHook(() => useCancelJob(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync("nonexistent");
        } catch (error) {
          // Expected to fail
        }
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.isError).toBe(true);
    });
  });

  describe("Utility Functions", () => {
    describe("getStatusColor", () => {
      it("should return correct colors for each status", () => {
        expect(getStatusColor("pending")).toContain("gray");
        expect(getStatusColor("running")).toContain("blue");
        expect(getStatusColor("completed")).toContain("emerald");
        expect(getStatusColor("failed")).toContain("red");
        expect(getStatusColor("cancelled")).toContain("yellow");
      });
    });

    describe("getStatusIcon", () => {
      it("should return correct icons for each status", () => {
        expect(getStatusIcon("pending")).toBe("⏳");
        expect(getStatusIcon("running")).toBe("▶");
        expect(getStatusIcon("completed")).toBe("✓");
        expect(getStatusIcon("failed")).toBe("✗");
        expect(getStatusIcon("cancelled")).toBe("⊘");
      });
    });

    describe("formatDuration", () => {
      it("should format seconds correctly", () => {
        expect(formatDuration(30)).toBe("30s");
        expect(formatDuration(90)).toBe("1m 30s");
        expect(formatDuration(3665)).toBe("1h 1m");
        expect(formatDuration(null)).toBe("N/A");
        expect(formatDuration(undefined)).toBe("N/A");
      });
    });

    describe("formatBytes", () => {
      it("should format bytes correctly", () => {
        expect(formatBytes(0)).toBe("0 Bytes");
        expect(formatBytes(1024)).toBe("1 KB");
        expect(formatBytes(1048576)).toBe("1 MB");
        expect(formatBytes(1073741824)).toBe("1 GB");
      });
    });

    describe("getTypeColor", () => {
      it("should return correct colors for each type", () => {
        expect(getTypeColor("import")).toContain("blue");
        expect(getTypeColor("export")).toContain("purple");
        expect(getTypeColor("sync")).toContain("cyan");
        expect(getTypeColor("migrate")).toContain("orange");
      });
    });

    describe("calculateETA", () => {
      it("should calculate ETA for running job", () => {
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
      });

      it("should return N/A for pending job", () => {
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
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle complete import workflow", async () => {
      const mockJob = createMockJob({
        job_id: "import-workflow-1",
        type: "import",
        status: "pending",
      });

      mockedApiClient.post.mockResolvedValueOnce({ data: mockJob });
      mockedApiClient.get.mockResolvedValueOnce({ data: mockJob });

      // Create import job
      const { result: createResult } = renderHook(() => useCreateImportJob(), {
        wrapper: createQueryWrapper(),
      });

      let jobId: string;

      await act(async () => {
        const job = await createResult.current.mutateAsync({
          source_type: "file",
          source_path: "/uploads/data.csv",
          format: "csv",
        });
        jobId = job.job_id;
      });

      // Check job status
      const { result: statusResult } = renderHook(() => useTransferJob(jobId!), {
        wrapper: createQueryWrapper(),
      });

      await waitForTransferLoading(() => statusResult.current.isLoading);

      expect(statusResult.current.data?.job_id).toBe(jobId);
      expect(statusResult.current.data?.type).toBe("import");
    });

    it("should handle job cancellation workflow", async () => {
      mockedApiClient.delete.mockResolvedValueOnce({ status: 204 });

      // Cancel the job
      const { result: cancelResult } = renderHook(() => useCancelJob(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await cancelResult.current.mutateAsync("job-running-1");
      });

      await waitFor(() => expect(cancelResult.current.isSuccess).toBe(true));

      expect(cancelResult.current.isSuccess).toBe(true);
    });

    it("should handle pagination through large job list", async () => {
      const mockPage1: TransferJobListResponse = {
        jobs: Array.from({ length: 20 }, (_, i) =>
          createMockJob({
            job_id: `job-${i + 1}`,
            name: `Job ${i + 1}`,
          }),
        ),
        total: 100,
        page: 1,
        page_size: 20,
        has_more: true,
      };

      const mockPage2: TransferJobListResponse = {
        jobs: Array.from({ length: 20 }, (_, i) =>
          createMockJob({
            job_id: `job-${i + 21}`,
            name: `Job ${i + 21}`,
          }),
        ),
        total: 100,
        page: 2,
        page_size: 20,
        has_more: true,
      };

      mockedApiClient.get
        .mockResolvedValueOnce({ data: mockPage1 })
        .mockResolvedValueOnce({ data: mockPage2 });

      // Fetch first page
      const { result: page1 } = renderHook(() => useTransferJobs({ page: 1, page_size: 20 }), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(page1.current.isLoading).toBe(false));

      expect(page1.current.data?.jobs).toHaveLength(20);
      expect(page1.current.data?.has_more).toBe(true);

      // Fetch second page
      const { result: page2 } = renderHook(() => useTransferJobs({ page: 2, page_size: 20 }), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(page2.current.isLoading).toBe(false));

      expect(page2.current.data?.jobs).toHaveLength(20);
      expect(page2.current.data?.page).toBe(2);
    });
  });
});
