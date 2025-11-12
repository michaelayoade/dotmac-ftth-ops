/**
 * Tests for useDataTransfer hooks
 * Tests data import/export and transfer operations with TanStack Query
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
  TransferJobResponse,
  TransferJobListResponse,
  FormatsResponse,
  ImportRequest,
  ExportRequest,
  TransferType,
  TransferStatus,
  ImportSource,
  ExportTarget,
  DataFormat,
  CompressionType,
  ValidationLevel,
  getStatusColor,
  getStatusIcon,
  formatDuration,
  formatTimestamp,
  calculateETA,
  formatBytes,
  getTypeColor,
} from "../useDataTransfer";
import { apiClient } from "@/lib/api/client";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockExtractDataOrThrow = jest.fn((response) => response.data);

jest.mock("@/lib/api/response-helpers", () => ({
  extractDataOrThrow: (response: any) => mockExtractDataOrThrow(response),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

// Mock useToast
const mockToast = jest.fn();
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe("useDataTransfer", () => {
  let queryClient: QueryClient;

  function createWrapper() {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockToast.mockClear();
    mockExtractDataOrThrow.mockImplementation((response) => response.data);
  });

  afterEach(() => {
    jest.resetAllMocks();
    if (queryClient) {
      queryClient.clear();
    }
  });

  // ==================== Query Hooks ====================

  describe("useTransferJobs", () => {
    it("should fetch transfer jobs successfully", async () => {
      const mockJobs: TransferJobResponse[] = [
        {
          job_id: "job-1",
          name: "Import Subscribers",
          type: "import",
          status: "running",
          progress: 50,
          created_at: "2024-01-01T00:00:00Z",
          started_at: "2024-01-01T00:01:00Z",
          completed_at: null,
          records_processed: 500,
          records_failed: 10,
          records_total: 1000,
          error_message: null,
          metadata: { source: "csv" },
        },
      ];

      const mockResponse: TransferJobListResponse = {
        jobs: mockJobs,
        total: 1,
        page: 1,
        page_size: 20,
        has_more: false,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockResponse,
      });

      const { result } = renderHook(() => useTransferJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.jobs).toHaveLength(1);
      expect(result.current.data?.jobs[0].name).toBe("Import Subscribers");
      expect(result.current.data?.total).toBe(1);
      expect(apiClient.get).toHaveBeenCalledWith("/data-transfer/jobs", {
        params: {
          type: undefined,
          job_status: undefined,
          page: 1,
          page_size: 20,
        },
      });
    });

    it("should fetch transfer jobs with type filter", async () => {
      const mockResponse: TransferJobListResponse = {
        jobs: [],
        total: 0,
        page: 1,
        page_size: 20,
        has_more: false,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      renderHook(() => useTransferJobs({ type: "import" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/data-transfer/jobs", {
          params: {
            type: "import",
            job_status: undefined,
            page: 1,
            page_size: 20,
          },
        });
      });
    });

    it("should fetch transfer jobs with status filter", async () => {
      const mockResponse: TransferJobListResponse = {
        jobs: [],
        total: 0,
        page: 1,
        page_size: 20,
        has_more: false,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      renderHook(() => useTransferJobs({ status: "completed" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/data-transfer/jobs", {
          params: {
            type: undefined,
            job_status: "completed",
            page: 1,
            page_size: 20,
          },
        });
      });
    });

    it("should fetch transfer jobs with pagination", async () => {
      const mockResponse: TransferJobListResponse = {
        jobs: [],
        total: 100,
        page: 2,
        page_size: 50,
        has_more: true,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      renderHook(() => useTransferJobs({ page: 2, page_size: 50 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/data-transfer/jobs", {
          params: {
            type: undefined,
            job_status: undefined,
            page: 2,
            page_size: 50,
          },
        });
      });
    });

    it("should fetch transfer jobs with all filters", async () => {
      const mockResponse: TransferJobListResponse = {
        jobs: [],
        total: 0,
        page: 3,
        page_size: 10,
        has_more: false,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      renderHook(
        () =>
          useTransferJobs({
            type: "export",
            status: "completed",
            page: 3,
            page_size: 10,
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/data-transfer/jobs", {
          params: {
            type: "export",
            job_status: "completed",
            page: 3,
            page_size: 10,
          },
        });
      });
    });

    it("should handle all transfer types", async () => {
      const types: TransferType[] = ["import", "export", "sync", "migrate"];

      for (const type of types) {
        const mockResponse: TransferJobListResponse = {
          jobs: [
            {
              job_id: `job-${type}`,
              name: `${type} job`,
              type,
              status: "completed",
              progress: 100,
              created_at: "2024-01-01T00:00:00Z",
              started_at: "2024-01-01T00:01:00Z",
              completed_at: "2024-01-01T00:05:00Z",
              records_processed: 100,
              records_failed: 0,
              records_total: 100,
              error_message: null,
              metadata: null,
            },
          ],
          total: 1,
          page: 1,
          page_size: 20,
          has_more: false,
        };

        (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

        const { result } = renderHook(() => useTransferJobs({ type }), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.jobs[0].type).toBe(type);

        jest.clearAllMocks();
      }
    });

    it("should handle all transfer statuses", async () => {
      const statuses: TransferStatus[] = [
        "pending",
        "running",
        "completed",
        "failed",
        "cancelled",
      ];

      for (const status of statuses) {
        const mockResponse: TransferJobListResponse = {
          jobs: [
            {
              job_id: `job-${status}`,
              name: `Job with ${status} status`,
              type: "import",
              status,
              progress: status === "completed" ? 100 : 50,
              created_at: "2024-01-01T00:00:00Z",
              started_at: "2024-01-01T00:01:00Z",
              completed_at: status === "completed" ? "2024-01-01T00:05:00Z" : null,
              records_processed: 50,
              records_failed: status === "failed" ? 50 : 0,
              records_total: 100,
              error_message: status === "failed" ? "Import failed" : null,
              metadata: null,
            },
          ],
          total: 1,
          page: 1,
          page_size: 20,
          has_more: false,
        };

        (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

        const { result } = renderHook(() => useTransferJobs({ status }), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.jobs[0].status).toBe(status);

        jest.clearAllMocks();
      }
    });

    it("should auto-refresh every 5 seconds", async () => {
      jest.useFakeTimers();

      const mockResponse: TransferJobListResponse = {
        jobs: [],
        total: 0,
        page: 1,
        page_size: 20,
        has_more: false,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      renderHook(() => useTransferJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(3));

      jest.useRealTimers();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch jobs");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useTransferJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should handle empty jobs array", async () => {
      const mockResponse: TransferJobListResponse = {
        jobs: [],
        total: 0,
        page: 1,
        page_size: 20,
        has_more: false,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useTransferJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.jobs).toEqual([]);
      expect(result.current.data?.total).toBe(0);
    });

    it("should handle job with all optional fields", async () => {
      const mockJob: TransferJobResponse = {
        job_id: "job-1",
        name: "Complex Import Job",
        type: "import",
        status: "completed",
        progress: 100,
        created_at: "2024-01-01T00:00:00Z",
        started_at: "2024-01-01T00:01:00Z",
        completed_at: "2024-01-01T00:10:00Z",
        records_processed: 1000,
        records_failed: 10,
        records_total: 1010,
        error_message: null,
        metadata: {
          source: "csv",
          filename: "subscribers.csv",
          user: "admin",
        },
        duration: 540,
        success_rate: 99.01,
      };

      const mockResponse: TransferJobListResponse = {
        jobs: [mockJob],
        total: 1,
        page: 1,
        page_size: 20,
        has_more: false,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useTransferJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const job = result.current.data?.jobs[0];
      expect(job).toEqual(mockJob);
      expect(job?.duration).toBe(540);
      expect(job?.success_rate).toBe(99.01);
      expect(job?.metadata?.filename).toBe("subscribers.csv");
    });
  });

  describe("useTransferJob", () => {
    it("should fetch single transfer job successfully", async () => {
      const mockJob: TransferJobResponse = {
        job_id: "job-1",
        name: "Import Subscribers",
        type: "import",
        status: "running",
        progress: 75,
        created_at: "2024-01-01T00:00:00Z",
        started_at: "2024-01-01T00:01:00Z",
        completed_at: null,
        records_processed: 750,
        records_failed: 5,
        records_total: 1000,
        error_message: null,
        metadata: { source: "csv" },
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockJob,
      });

      const { result } = renderHook(() => useTransferJob("job-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockJob);
      expect(apiClient.get).toHaveBeenCalledWith("/data-transfer/jobs/job-1");
    });

    it("should not fetch when jobId is empty", async () => {
      const { result } = renderHook(() => useTransferJob(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should auto-refresh every 3 seconds", async () => {
      jest.useFakeTimers();

      const mockJob: TransferJobResponse = {
        job_id: "job-1",
        name: "Import Job",
        type: "import",
        status: "running",
        progress: 50,
        created_at: "2024-01-01T00:00:00Z",
        started_at: "2024-01-01T00:01:00Z",
        completed_at: null,
        records_processed: 500,
        records_failed: 0,
        records_total: 1000,
        error_message: null,
        metadata: null,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockJob });

      renderHook(() => useTransferJob("job-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(3));

      jest.useRealTimers();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Job not found");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useTransferJob("job-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should handle job with error message", async () => {
      const mockJob: TransferJobResponse = {
        job_id: "job-1",
        name: "Failed Import",
        type: "import",
        status: "failed",
        progress: 45,
        created_at: "2024-01-01T00:00:00Z",
        started_at: "2024-01-01T00:01:00Z",
        completed_at: "2024-01-01T00:03:00Z",
        records_processed: 450,
        records_failed: 550,
        records_total: 1000,
        error_message: "Database connection failed",
        metadata: null,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockJob });

      const { result } = renderHook(() => useTransferJob("job-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.status).toBe("failed");
      expect(result.current.data?.error_message).toBe("Database connection failed");
    });
  });

  describe("useSupportedFormats", () => {
    it("should fetch supported formats successfully", async () => {
      const mockFormats: FormatsResponse = {
        import_formats: [
          {
            format: "csv",
            name: "CSV",
            file_extensions: [".csv"],
            mime_types: ["text/csv"],
            supports_compression: true,
            supports_streaming: true,
            options: { delimiter: ",", encoding: "utf-8" },
          },
          {
            format: "json",
            name: "JSON",
            file_extensions: [".json"],
            mime_types: ["application/json"],
            supports_compression: true,
            supports_streaming: true,
            options: { pretty: true },
          },
        ],
        export_formats: [
          {
            format: "excel",
            name: "Excel",
            file_extensions: [".xlsx"],
            mime_types: [
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ],
            supports_compression: false,
            supports_streaming: false,
            options: { sheet_name: "Sheet1" },
          },
        ],
        compression_types: ["none", "gzip", "zip", "bzip2"],
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockFormats,
      });

      const { result } = renderHook(() => useSupportedFormats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockFormats);
      expect(result.current.data?.import_formats).toHaveLength(2);
      expect(result.current.data?.export_formats).toHaveLength(1);
      expect(apiClient.get).toHaveBeenCalledWith("/data-transfer/formats");
    });

    it("should handle all data formats", async () => {
      const formats: DataFormat[] = ["csv", "json", "excel", "xml"];

      for (const format of formats) {
        const mockFormats: FormatsResponse = {
          import_formats: [
            {
              format,
              name: format.toUpperCase(),
              file_extensions: [`.${format}`],
              mime_types: [`application/${format}`],
              supports_compression: true,
              supports_streaming: true,
              options: {},
            },
          ],
          export_formats: [],
          compression_types: ["none", "gzip"],
        };

        (apiClient.get as jest.Mock).mockResolvedValue({ data: mockFormats });

        const { result } = renderHook(() => useSupportedFormats(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.import_formats[0].format).toBe(format);

        jest.clearAllMocks();
      }
    });

    it("should have staleTime of 5 minutes", async () => {
      const mockFormats: FormatsResponse = {
        import_formats: [],
        export_formats: [],
        compression_types: [],
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockFormats });

      const { result } = renderHook(() => useSupportedFormats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isStale).toBe(false);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch formats");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useSupportedFormats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });

  // ==================== Mutation Hooks ====================

  describe("useCreateImportJob", () => {
    it("should create import job successfully", async () => {
      const mockJob: TransferJobResponse = {
        job_id: "job-1",
        name: "Import Subscribers",
        type: "import",
        status: "pending",
        progress: 0,
        created_at: "2024-01-01T00:00:00Z",
        started_at: null,
        completed_at: null,
        records_processed: 0,
        records_failed: 0,
        records_total: null,
        error_message: null,
        metadata: null,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockJob });

      const { result } = renderHook(() => useCreateImportJob(), {
        wrapper: createWrapper(),
      });

      const importRequest: ImportRequest = {
        source_type: "file",
        source_path: "/uploads/subscribers.csv",
        format: "csv",
        validation_level: "strict",
        batch_size: 100,
      };

      await act(async () => {
        const response = await result.current.mutateAsync(importRequest);
        expect(response).toEqual(mockJob);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/data-transfer/import", importRequest);
    });

    it("should handle all import sources", async () => {
      const sources: ImportSource[] = ["file", "database", "api", "s3", "sftp", "http"];

      for (const source_type of sources) {
        const mockJob: TransferJobResponse = {
          job_id: `job-${source_type}`,
          name: `Import from ${source_type}`,
          type: "import",
          status: "pending",
          progress: 0,
          created_at: "2024-01-01T00:00:00Z",
          started_at: null,
          completed_at: null,
          records_processed: 0,
          records_failed: 0,
          records_total: null,
          error_message: null,
          metadata: null,
        };

        (apiClient.post as jest.Mock).mockResolvedValue({ data: mockJob });

        const { result } = renderHook(() => useCreateImportJob(), {
          wrapper: createWrapper(),
        });

        const importRequest: ImportRequest = {
          source_type,
          source_path: "/path/to/data",
          format: "json",
        };

        await act(async () => {
          await result.current.mutateAsync(importRequest);
        });

        expect(apiClient.post).toHaveBeenCalledWith(
          "/data-transfer/import",
          importRequest
        );

        jest.clearAllMocks();
      }
    });

    it("should handle all validation levels", async () => {
      const levels: ValidationLevel[] = ["none", "basic", "strict"];

      for (const validation_level of levels) {
        const mockJob: TransferJobResponse = {
          job_id: "job-1",
          name: "Import Job",
          type: "import",
          status: "pending",
          progress: 0,
          created_at: "2024-01-01T00:00:00Z",
          started_at: null,
          completed_at: null,
          records_processed: 0,
          records_failed: 0,
          records_total: null,
          error_message: null,
          metadata: null,
        };

        (apiClient.post as jest.Mock).mockResolvedValue({ data: mockJob });

        const { result } = renderHook(() => useCreateImportJob(), {
          wrapper: createWrapper(),
        });

        const importRequest: ImportRequest = {
          source_type: "file",
          source_path: "/path/to/data",
          format: "csv",
          validation_level,
        };

        await act(async () => {
          await result.current.mutateAsync(importRequest);
        });

        expect(apiClient.post).toHaveBeenCalledWith(
          "/data-transfer/import",
          expect.objectContaining({ validation_level })
        );

        jest.clearAllMocks();
      }
    });

    it("should create import job with all optional parameters", async () => {
      const mockJob: TransferJobResponse = {
        job_id: "job-1",
        name: "Complex Import",
        type: "import",
        status: "pending",
        progress: 0,
        created_at: "2024-01-01T00:00:00Z",
        started_at: null,
        completed_at: null,
        records_processed: 0,
        records_failed: 0,
        records_total: null,
        error_message: null,
        metadata: null,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockJob });

      const { result } = renderHook(() => useCreateImportJob(), {
        wrapper: createWrapper(),
      });

      const importRequest: ImportRequest = {
        source_type: "file",
        source_path: "/uploads/data.csv",
        format: "csv",
        mapping: { name: "subscriber_name", email: "subscriber_email" },
        options: { delimiter: ";", header: true },
        validation_level: "strict",
        batch_size: 500,
        encoding: "utf-8",
        skip_errors: true,
        dry_run: false,
      };

      await act(async () => {
        await result.current.mutateAsync(importRequest);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/data-transfer/import", importRequest);
    });

    it("should invalidate queries after successful import creation", async () => {
      const mockJob: TransferJobResponse = {
        job_id: "job-1",
        name: "Import Job",
        type: "import",
        status: "pending",
        progress: 0,
        created_at: "2024-01-01T00:00:00Z",
        started_at: null,
        completed_at: null,
        records_processed: 0,
        records_failed: 0,
        records_total: null,
        error_message: null,
        metadata: null,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockJob });

      const wrapper = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useCreateImportJob(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync({
          source_type: "file",
          source_path: "/path",
          format: "csv",
        });
      });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ["data-transfer", "jobs"],
        });
      });
    });

    it("should show success toast", async () => {
      const mockJob: TransferJobResponse = {
        job_id: "job-1",
        name: "Import Subscribers",
        type: "import",
        status: "pending",
        progress: 0,
        created_at: "2024-01-01T00:00:00Z",
        started_at: null,
        completed_at: null,
        records_processed: 0,
        records_failed: 0,
        records_total: null,
        error_message: null,
        metadata: null,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockJob });

      const { result } = renderHook(() => useCreateImportJob(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          source_type: "file",
          source_path: "/path",
          format: "csv",
        });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Import job created",
        description: 'Job "Import Subscribers" has been queued for processing.',
      });
    });

    it("should handle import error", async () => {
      const error = {
        response: {
          data: {
            detail: "Invalid file format",
          },
        },
      };
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCreateImportJob(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            source_type: "file",
            source_path: "/path",
            format: "csv",
          });
        } catch (e) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Import failed",
          description: "Invalid file format",
          variant: "destructive",
        });
      });
    });

    it("should handle import error with generic message", async () => {
      const error = new Error("Network error");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCreateImportJob(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            source_type: "file",
            source_path: "/path",
            format: "csv",
          });
        } catch (e) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Import failed",
          description: "Failed to create import job",
          variant: "destructive",
        });
      });
    });
  });

  describe("useCreateExportJob", () => {
    it("should create export job successfully", async () => {
      const mockJob: TransferJobResponse = {
        job_id: "job-1",
        name: "Export Subscribers",
        type: "export",
        status: "pending",
        progress: 0,
        created_at: "2024-01-01T00:00:00Z",
        started_at: null,
        completed_at: null,
        records_processed: 0,
        records_failed: 0,
        records_total: null,
        error_message: null,
        metadata: null,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockJob });

      const { result } = renderHook(() => useCreateExportJob(), {
        wrapper: createWrapper(),
      });

      const exportRequest: ExportRequest = {
        target_type: "file",
        target_path: "/exports/subscribers.csv",
        format: "csv",
        compression: "gzip",
        batch_size: 1000,
      };

      await act(async () => {
        const response = await result.current.mutateAsync(exportRequest);
        expect(response).toEqual(mockJob);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/data-transfer/export", exportRequest);
    });

    it("should handle all export targets", async () => {
      const targets: ExportTarget[] = ["file", "database", "api", "s3", "sftp", "email"];

      for (const target_type of targets) {
        const mockJob: TransferJobResponse = {
          job_id: `job-${target_type}`,
          name: `Export to ${target_type}`,
          type: "export",
          status: "pending",
          progress: 0,
          created_at: "2024-01-01T00:00:00Z",
          started_at: null,
          completed_at: null,
          records_processed: 0,
          records_failed: 0,
          records_total: null,
          error_message: null,
          metadata: null,
        };

        (apiClient.post as jest.Mock).mockResolvedValue({ data: mockJob });

        const { result } = renderHook(() => useCreateExportJob(), {
          wrapper: createWrapper(),
        });

        const exportRequest: ExportRequest = {
          target_type,
          target_path: "/path/to/export",
          format: "json",
        };

        await act(async () => {
          await result.current.mutateAsync(exportRequest);
        });

        expect(apiClient.post).toHaveBeenCalledWith(
          "/data-transfer/export",
          exportRequest
        );

        jest.clearAllMocks();
      }
    });

    it("should handle all compression types", async () => {
      const compressionTypes: CompressionType[] = ["none", "gzip", "zip", "bzip2"];

      for (const compression of compressionTypes) {
        const mockJob: TransferJobResponse = {
          job_id: "job-1",
          name: "Export Job",
          type: "export",
          status: "pending",
          progress: 0,
          created_at: "2024-01-01T00:00:00Z",
          started_at: null,
          completed_at: null,
          records_processed: 0,
          records_failed: 0,
          records_total: null,
          error_message: null,
          metadata: null,
        };

        (apiClient.post as jest.Mock).mockResolvedValue({ data: mockJob });

        const { result } = renderHook(() => useCreateExportJob(), {
          wrapper: createWrapper(),
        });

        const exportRequest: ExportRequest = {
          target_type: "file",
          target_path: "/path",
          format: "csv",
          compression,
        };

        await act(async () => {
          await result.current.mutateAsync(exportRequest);
        });

        expect(apiClient.post).toHaveBeenCalledWith(
          "/data-transfer/export",
          expect.objectContaining({ compression })
        );

        jest.clearAllMocks();
      }
    });

    it("should create export job with all optional parameters", async () => {
      const mockJob: TransferJobResponse = {
        job_id: "job-1",
        name: "Complex Export",
        type: "export",
        status: "pending",
        progress: 0,
        created_at: "2024-01-01T00:00:00Z",
        started_at: null,
        completed_at: null,
        records_processed: 0,
        records_failed: 0,
        records_total: null,
        error_message: null,
        metadata: null,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockJob });

      const { result } = renderHook(() => useCreateExportJob(), {
        wrapper: createWrapper(),
      });

      const exportRequest: ExportRequest = {
        target_type: "file",
        target_path: "/exports/data.csv",
        format: "csv",
        filters: { status: "active", created_after: "2024-01-01" },
        fields: ["id", "name", "email", "status"],
        options: { delimiter: ";", include_header: true },
        compression: "gzip",
        batch_size: 500,
        encoding: "utf-8",
        overwrite: true,
      };

      await act(async () => {
        await result.current.mutateAsync(exportRequest);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/data-transfer/export", exportRequest);
    });

    it("should invalidate queries after successful export creation", async () => {
      const mockJob: TransferJobResponse = {
        job_id: "job-1",
        name: "Export Job",
        type: "export",
        status: "pending",
        progress: 0,
        created_at: "2024-01-01T00:00:00Z",
        started_at: null,
        completed_at: null,
        records_processed: 0,
        records_failed: 0,
        records_total: null,
        error_message: null,
        metadata: null,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockJob });

      const wrapper = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useCreateExportJob(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync({
          target_type: "file",
          target_path: "/path",
          format: "csv",
        });
      });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ["data-transfer", "jobs"],
        });
      });
    });

    it("should show success toast", async () => {
      const mockJob: TransferJobResponse = {
        job_id: "job-1",
        name: "Export Subscribers",
        type: "export",
        status: "pending",
        progress: 0,
        created_at: "2024-01-01T00:00:00Z",
        started_at: null,
        completed_at: null,
        records_processed: 0,
        records_failed: 0,
        records_total: null,
        error_message: null,
        metadata: null,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockJob });

      const { result } = renderHook(() => useCreateExportJob(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          target_type: "file",
          target_path: "/path",
          format: "csv",
        });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Export job created",
        description: 'Job "Export Subscribers" has been queued for processing.',
      });
    });

    it("should handle export error", async () => {
      const error = {
        response: {
          data: {
            detail: "Invalid target path",
          },
        },
      };
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCreateExportJob(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            target_type: "file",
            target_path: "/path",
            format: "csv",
          });
        } catch (e) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Export failed",
          description: "Invalid target path",
          variant: "destructive",
        });
      });
    });
  });

  describe("useCancelJob", () => {
    it("should cancel job successfully", async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({
        status: 200,
      });

      const { result } = renderHook(() => useCancelJob(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("job-1");
      });

      expect(apiClient.delete).toHaveBeenCalledWith("/data-transfer/jobs/job-1");
    });

    it("should invalidate queries after successful cancellation", async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({
        status: 200,
      });

      const wrapper = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useCancelJob(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync("job-1");
      });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ["data-transfer", "jobs"],
        });
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ["data-transfer", "jobs", "job-1"],
        });
      });
    });

    it("should show success toast", async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({
        status: 200,
      });

      const { result } = renderHook(() => useCancelJob(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("job-1");
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Job cancelled",
        description: "Transfer job has been cancelled successfully.",
      });
    });

    it("should handle cancel error with non-2xx status", async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({
        status: 404,
      });

      const { result } = renderHook(() => useCancelJob(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync("job-1");
        })
      ).rejects.toThrow("Failed to cancel job");
    });

    it("should handle cancel error", async () => {
      const error = {
        response: {
          data: {
            detail: "Job already completed",
          },
        },
      };
      (apiClient.delete as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCancelJob(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync("job-1");
        } catch (e) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Cancellation failed",
          description: "Job already completed",
          variant: "destructive",
        });
      });
    });

    it("should set loading state correctly during cancellation", async () => {
      (apiClient.delete as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ status: 200 }), 100))
      );

      const { result } = renderHook(() => useCancelJob(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(false);

      act(() => {
        result.current.mutate("job-1");
      });

      await waitFor(() => expect(result.current.isPending).toBe(true), { timeout: 100 });
      await waitFor(() => expect(result.current.isPending).toBe(false), { timeout: 200 });
    });

    it("should handle multiple job cancellations", async () => {
      (apiClient.delete as jest.Mock)
        .mockResolvedValueOnce({ status: 200 })
        .mockResolvedValueOnce({ status: 200 });

      const { result } = renderHook(() => useCancelJob(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("job-1");
      });

      await act(async () => {
        await result.current.mutateAsync("job-2");
      });

      expect(apiClient.delete).toHaveBeenCalledTimes(2);
      expect(apiClient.delete).toHaveBeenNthCalledWith(1, "/data-transfer/jobs/job-1");
      expect(apiClient.delete).toHaveBeenNthCalledWith(2, "/data-transfer/jobs/job-2");
    });
  });

  // ==================== Utility Functions ====================

  describe("Utility Functions", () => {
    describe("getStatusColor", () => {
      it("should return correct colors for all statuses", () => {
        expect(getStatusColor("pending")).toBe(
          "text-gray-400 bg-gray-500/15 border-gray-500/30"
        );
        expect(getStatusColor("running")).toBe(
          "text-blue-400 bg-blue-500/15 border-blue-500/30"
        );
        expect(getStatusColor("completed")).toBe(
          "text-emerald-400 bg-emerald-500/15 border-emerald-500/30"
        );
        expect(getStatusColor("failed")).toBe(
          "text-red-400 bg-red-500/15 border-red-500/30"
        );
        expect(getStatusColor("cancelled")).toBe(
          "text-yellow-400 bg-yellow-500/15 border-yellow-500/30"
        );
      });
    });

    describe("getStatusIcon", () => {
      it("should return correct icons for all statuses", () => {
        expect(getStatusIcon("pending")).toBe("⏳");
        expect(getStatusIcon("running")).toBe("▶");
        expect(getStatusIcon("completed")).toBe("✓");
        expect(getStatusIcon("failed")).toBe("✗");
        expect(getStatusIcon("cancelled")).toBe("⊘");
      });
    });

    describe("formatDuration", () => {
      it("should format duration correctly", () => {
        expect(formatDuration(null)).toBe("N/A");
        expect(formatDuration(undefined)).toBe("N/A");
        expect(formatDuration(30)).toBe("30s");
        expect(formatDuration(90)).toBe("1m 30s");
        expect(formatDuration(3661)).toBe("1h 1m");
        expect(formatDuration(7200)).toBe("2h 0m");
      });
    });

    describe("formatTimestamp", () => {
      it("should format timestamp correctly", () => {
        expect(formatTimestamp(null)).toBe("Never");
        expect(formatTimestamp(undefined)).toBe("Never");

        const now = new Date();
        const justNow = new Date(now.getTime() - 30000).toISOString(); // 30 seconds ago
        expect(formatTimestamp(justNow)).toBe("Just now");

        const fiveMins = new Date(now.getTime() - 300000).toISOString(); // 5 minutes ago
        expect(formatTimestamp(fiveMins)).toBe("5 minutes ago");

        const oneHour = new Date(now.getTime() - 3600000).toISOString(); // 1 hour ago
        expect(formatTimestamp(oneHour)).toBe("1 hour ago");

        const oneDay = new Date(now.getTime() - 86400000).toISOString(); // 1 day ago
        expect(formatTimestamp(oneDay)).toBe("1 day ago");
      });
    });

    describe("calculateETA", () => {
      it("should calculate ETA correctly", () => {
        const now = new Date();
        const startTime = new Date(now.getTime() - 60000); // Started 1 minute ago

        const runningJob: TransferJobResponse = {
          job_id: "job-1",
          name: "Test Job",
          type: "import",
          status: "running",
          progress: 50,
          created_at: "2024-01-01T00:00:00Z",
          started_at: startTime.toISOString(),
          completed_at: null,
          records_processed: 500,
          records_failed: 0,
          records_total: 1000,
          error_message: null,
          metadata: null,
        };

        const eta = calculateETA(runningJob);
        expect(eta).toContain("m"); // Should be approximately 1 minute
      });

      it("should return N/A for non-running jobs", () => {
        const pendingJob: TransferJobResponse = {
          job_id: "job-1",
          name: "Test Job",
          type: "import",
          status: "pending",
          progress: 0,
          created_at: "2024-01-01T00:00:00Z",
          started_at: null,
          completed_at: null,
          records_processed: 0,
          records_failed: 0,
          records_total: 1000,
          error_message: null,
          metadata: null,
        };

        expect(calculateETA(pendingJob)).toBe("N/A");
      });

      it("should return N/A for jobs with 0 progress", () => {
        const job: TransferJobResponse = {
          job_id: "job-1",
          name: "Test Job",
          type: "import",
          status: "running",
          progress: 0,
          created_at: "2024-01-01T00:00:00Z",
          started_at: "2024-01-01T00:01:00Z",
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

    describe("formatBytes", () => {
      it("should format bytes correctly", () => {
        expect(formatBytes(0)).toBe("0 Bytes");
        expect(formatBytes(500)).toBe("500 Bytes");
        expect(formatBytes(1024)).toBe("1 KB");
        expect(formatBytes(1048576)).toBe("1 MB");
        expect(formatBytes(1073741824)).toBe("1 GB");
        expect(formatBytes(1099511627776)).toBe("1 TB");
      });
    });

    describe("getTypeColor", () => {
      it("should return correct colors for all transfer types", () => {
        expect(getTypeColor("import")).toBe("text-blue-300 bg-blue-500/15");
        expect(getTypeColor("export")).toBe("text-purple-300 bg-purple-500/15");
        expect(getTypeColor("sync")).toBe("text-cyan-300 bg-cyan-500/15");
        expect(getTypeColor("migrate")).toBe("text-orange-300 bg-orange-500/15");
      });
    });
  });

  // ==================== Loading States ====================

  describe("Loading States", () => {
    it("should show loading state during query fetch", async () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: {
                    jobs: [],
                    total: 0,
                    page: 1,
                    page_size: 20,
                    has_more: false,
                  },
                }),
              100
            )
          )
      );

      const { result } = renderHook(() => useTransferJobs(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), {
        timeout: 200,
      });
    });

    it("should show loading state during mutation", async () => {
      (apiClient.post as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: {
                    job_id: "job-1",
                    name: "Import Job",
                    type: "import",
                    status: "pending",
                    progress: 0,
                    created_at: "2024-01-01T00:00:00Z",
                    started_at: null,
                    completed_at: null,
                    records_processed: 0,
                    records_failed: 0,
                    records_total: null,
                    error_message: null,
                    metadata: null,
                  },
                }),
              100
            )
          )
      );

      const { result } = renderHook(() => useCreateImportJob(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(false);

      act(() => {
        result.current.mutate({
          source_type: "file",
          source_path: "/path",
          format: "csv",
        });
      });

      await waitFor(() => expect(result.current.isPending).toBe(true), { timeout: 100 });
      await waitFor(() => expect(result.current.isPending).toBe(false), { timeout: 200 });
    });
  });
});
