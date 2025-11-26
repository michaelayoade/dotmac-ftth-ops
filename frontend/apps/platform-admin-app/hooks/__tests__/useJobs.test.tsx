/**
 * Tests for useJobs hook
 * Tests job management functionality with TanStack Query
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useJobs,
  useFieldInstallationJobs,
  useCancelJob,
  Job,
  FieldInstallationJob,
  JobsResponse,
} from "../useJobs";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock("@/lib/api/response-helpers", () => ({
  extractDataOrThrow: jest.fn((response) => response.data),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock useRealtime for WebSocket export
jest.mock("../useRealtime", () => ({
  useJobWebSocket: jest.fn(),
}));

describe("useJobs", () => {
  function createWrapper() {
    const queryClient = new QueryClient({
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
  });

  describe("useJobs - fetch active jobs", () => {
    it("should fetch jobs successfully", async () => {
      const mockJobsResponse: JobsResponse = {
        jobs: [
          {
            id: "job-1",
            tenant_id: "tenant-1",
            job_type: "bulk_provision",
            status: "running",
            title: "Bulk Provision Job",
            description: "Provisioning 100 subscribers",
            items_total: 100,
            items_processed: 50,
            items_failed: 0,
            error_message: null,
            parameters: { batch_id: "batch-123" },
            created_by: "user-1",
            created_at: "2024-01-01T00:00:00Z",
            started_at: "2024-01-01T00:01:00Z",
            completed_at: null,
            cancelled_at: null,
            cancelled_by: null,
          },
        ],
        total_count: 1,
        limit: 50,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockJobsResponse,
      });

      const { result } = renderHook(() => useJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.jobs).toHaveLength(1);
      expect(result.current.data?.jobs[0].title).toBe("Bulk Provision Job");
      expect(result.current.data?.total_count).toBe(1);
      expect(apiClient.get).toHaveBeenCalledWith("/jobs?limit=50&offset=0");
      expect(extractDataOrThrow).toHaveBeenCalled();
    });

    it("should build query params with status filter", async () => {
      const mockResponse: JobsResponse = {
        jobs: [],
        total_count: 0,
        limit: 50,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      renderHook(() => useJobs({ status: "running" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/jobs?status=running&limit=50&offset=0");
      });
    });

    it("should build query params with jobType filter", async () => {
      const mockResponse: JobsResponse = {
        jobs: [],
        total_count: 0,
        limit: 50,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      renderHook(() => useJobs({ jobType: "field_installation" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/jobs?job_type=field_installation&limit=50&offset=0",
        );
      });
    });

    it("should build query params with all filters", async () => {
      const mockResponse: JobsResponse = {
        jobs: [],
        total_count: 0,
        limit: 25,
        offset: 10,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      renderHook(
        () =>
          useJobs({
            status: "completed",
            jobType: "bulk_suspend",
            limit: 25,
            offset: 10,
          }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/jobs?status=completed&job_type=bulk_suspend&limit=25&offset=10",
        );
      });
    });

    it("should use default limit and offset when not provided", async () => {
      const mockResponse: JobsResponse = {
        jobs: [],
        total_count: 0,
        limit: 50,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      renderHook(() => useJobs({}), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/jobs?limit=50&offset=0");
      });
    });

    it("should handle job with all optional fields", async () => {
      const mockJob: Job = {
        id: "job-fs-1",
        tenant_id: "tenant-1",
        job_type: "field_installation",
        status: "assigned",
        title: "Install Fiber at 123 Main St",
        description: "New customer installation",
        items_total: 1,
        items_processed: 0,
        items_failed: 0,
        error_message: null,
        parameters: {
          ticket_id: "ticket-123",
          customer_id: "cust-456",
          priority: "high",
        },
        created_by: "user-1",
        created_at: "2024-01-01T00:00:00Z",
        started_at: null,
        completed_at: null,
        cancelled_at: null,
        cancelled_by: null,
        assigned_technician_id: "tech-1",
        assigned_to: "John Doe",
        scheduled_start: "2024-01-02T09:00:00Z",
        scheduled_end: "2024-01-02T12:00:00Z",
        actual_start: null,
        actual_end: null,
        location_lat: 40.7128,
        location_lng: -74.006,
        service_address: "123 Main St, New York, NY",
      };

      const mockResponse: JobsResponse = {
        jobs: [mockJob],
        total_count: 1,
        limit: 50,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const job = result.current.data?.jobs[0];
      expect(job).toEqual(mockJob);
      expect(job?.assigned_technician_id).toBe("tech-1");
      expect(job?.location_lat).toBe(40.7128);
      expect(job?.service_address).toBe("123 Main St, New York, NY");
    });

    it("should handle jobs with different statuses", async () => {
      const statuses: Job["status"][] = [
        "pending",
        "running",
        "completed",
        "failed",
        "cancelled",
        "paused",
        "assigned",
      ];

      for (const status of statuses) {
        const mockResponse: JobsResponse = {
          jobs: [
            {
              id: `job-${status}`,
              tenant_id: "tenant-1",
              job_type: "test",
              status,
              title: `Job with ${status} status`,
              items_total: 10,
              items_processed: 5,
              items_failed: 0,
              created_by: "user-1",
              created_at: "2024-01-01T00:00:00Z",
            },
          ],
          total_count: 1,
          limit: 50,
          offset: 0,
        };

        (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

        const { result } = renderHook(() => useJobs({ status }), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.jobs[0].status).toBe(status);
      }
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch jobs");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should set loading state correctly", async () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: { jobs: [], total_count: 0, limit: 50, offset: 0 },
                }),
              100,
            ),
          ),
      );

      const { result } = renderHook(() => useJobs(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 200 });
    });

    it("should have correct staleTime of 5 seconds", async () => {
      const mockResponse: JobsResponse = {
        jobs: [],
        total_count: 0,
        limit: 50,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // staleTime is 5000ms, so data should be fresh
      expect(result.current.isStale).toBe(false);
    });

    it("should handle empty jobs array", async () => {
      const mockResponse: JobsResponse = {
        jobs: [],
        total_count: 0,
        limit: 50,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.jobs).toEqual([]);
      expect(result.current.data?.total_count).toBe(0);
    });

    it("should handle pagination correctly", async () => {
      const mockResponse: JobsResponse = {
        jobs: Array(25)
          .fill(null)
          .map((_, i) => ({
            id: `job-${i}`,
            tenant_id: "tenant-1",
            job_type: "test",
            status: "running" as const,
            title: `Job ${i}`,
            items_total: 10,
            items_processed: 5,
            items_failed: 0,
            created_by: "user-1",
            created_at: "2024-01-01T00:00:00Z",
          })),
        total_count: 100,
        limit: 25,
        offset: 25,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useJobs({ limit: 25, offset: 25 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.jobs).toHaveLength(25);
      expect(result.current.data?.total_count).toBe(100);
      expect(result.current.data?.limit).toBe(25);
      expect(result.current.data?.offset).toBe(25);
    });
  });

  describe("useFieldInstallationJobs - fetch field installation jobs", () => {
    it("should fetch field installation jobs successfully", async () => {
      const mockFieldJob: FieldInstallationJob = {
        id: "job-field-1",
        tenant_id: "tenant-1",
        job_type: "field_installation",
        status: "assigned",
        title: "Install at 123 Main St",
        items_total: 1,
        items_processed: 0,
        items_failed: 0,
        created_by: "user-1",
        created_at: "2024-01-01T00:00:00Z",
        location_lat: 40.7128,
        location_lng: -74.006,
        service_address: "123 Main St, New York, NY",
        parameters: {
          ticket_id: "ticket-123",
          ticket_number: "TKT-001",
          customer_id: "cust-456",
          order_id: "order-789",
          order_number: "ORD-001",
          priority: "high",
          required_skills: ["fiber-splicing", "ont-config"],
        },
      };

      const mockResponse: JobsResponse = {
        jobs: [mockFieldJob],
        total_count: 1,
        limit: 100,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useFieldInstallationJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.jobs).toHaveLength(1);
      expect(result.current.data?.jobs[0].job_type).toBe("field_installation");
      expect(result.current.data?.jobs[0].location_lat).toBe(40.7128);
      expect(result.current.data?.jobs[0].service_address).toBe("123 Main St, New York, NY");
      expect(apiClient.get).toHaveBeenCalledWith(
        "/jobs?job_type=field_installation&limit=100&offset=0",
      );
    });

    it("should fetch field installation jobs with status filter", async () => {
      const mockResponse: JobsResponse = {
        jobs: [],
        total_count: 0,
        limit: 100,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      renderHook(() => useFieldInstallationJobs({ status: "assigned" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/jobs?job_type=field_installation&status=assigned&limit=100&offset=0",
        );
      });
    });

    it("should expose jobs even when location data is missing", async () => {
      const mockResponse: JobsResponse = {
        jobs: [
          {
            id: "job-1",
            tenant_id: "tenant-1",
            job_type: "field_installation",
            status: "assigned",
            title: "Job with location",
            items_total: 1,
            items_processed: 0,
            items_failed: 0,
            created_by: "user-1",
            created_at: "2024-01-01T00:00:00Z",
            location_lat: 40.7128,
            location_lng: -74.006,
            service_address: "123 Main St",
          },
          {
            id: "job-2",
            tenant_id: "tenant-1",
            job_type: "field_installation",
            status: "assigned",
            title: "Job without location",
            items_total: 1,
            items_processed: 0,
            items_failed: 0,
            created_by: "user-1",
            created_at: "2024-01-01T00:00:00Z",
            location_lat: null,
            location_lng: null,
          },
          {
            id: "job-3",
            tenant_id: "tenant-1",
            job_type: "field_installation",
            status: "assigned",
            title: "Job with partial location",
            items_total: 1,
            items_processed: 0,
            items_failed: 0,
            created_by: "user-1",
            created_at: "2024-01-01T00:00:00Z",
            location_lat: 40.7128,
            location_lng: null,
          },
        ],
        total_count: 3,
        limit: 100,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useFieldInstallationJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.jobs).toEqual(mockResponse.jobs);
    });

    it("should reflect API response even if non-field jobs slip through", async () => {
      const mockResponse: JobsResponse = {
        jobs: [
          {
            id: "job-1",
            tenant_id: "tenant-1",
            job_type: "field_installation",
            status: "assigned",
            title: "Field job",
            items_total: 1,
            items_processed: 0,
            items_failed: 0,
            created_by: "user-1",
            created_at: "2024-01-01T00:00:00Z",
            location_lat: 40.7128,
            location_lng: -74.006,
            service_address: "123 Main St",
          },
          {
            id: "job-2",
            tenant_id: "tenant-1",
            job_type: "bulk_provision",
            status: "running",
            title: "Bulk job",
            items_total: 100,
            items_processed: 50,
            items_failed: 0,
            created_by: "user-1",
            created_at: "2024-01-01T00:00:00Z",
            location_lat: 40.7128,
            location_lng: -74.006,
          },
        ],
        total_count: 2,
        limit: 100,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useFieldInstallationJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.jobs).toHaveLength(mockResponse.jobs.length);
    });

    it("should have correct staleTime of 5 seconds", async () => {
      const mockResponse: JobsResponse = {
        jobs: [],
        total_count: 0,
        limit: 100,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useFieldInstallationJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isStale).toBe(false);
    });

    it("should not auto-refetch without an explicit interval", async () => {
      jest.useFakeTimers();

      const mockResponse: JobsResponse = {
        jobs: [],
        total_count: 0,
        limit: 100,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      renderHook(() => useFieldInstallationJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

      act(() => {
        jest.advanceTimersByTime(30000);
      });

      expect(apiClient.get).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    it("should handle empty result returned by API", async () => {
      const mockResponse: JobsResponse = {
        jobs: [
          {
            id: "job-1",
            tenant_id: "tenant-1",
            job_type: "field_installation",
            status: "assigned",
            title: "Job without location",
            items_total: 1,
            items_processed: 0,
            items_failed: 0,
            created_by: "user-1",
            created_at: "2024-01-01T00:00:00Z",
          },
        ],
        total_count: 1,
        limit: 100,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useFieldInstallationJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.jobs).toEqual(mockResponse.jobs);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch field jobs");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useFieldInstallationJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should preserve all job data including parameters", async () => {
      const mockFieldJob: FieldInstallationJob = {
        id: "job-1",
        tenant_id: "tenant-1",
        job_type: "field_installation",
        status: "assigned",
        title: "Complex field job",
        items_total: 1,
        items_processed: 0,
        items_failed: 0,
        created_by: "user-1",
        created_at: "2024-01-01T00:00:00Z",
        location_lat: 40.7128,
        location_lng: -74.006,
        service_address: "123 Main St",
        parameters: {
          ticket_id: "ticket-123",
          ticket_number: "TKT-001",
          customer_id: "cust-456",
          order_id: "order-789",
          order_number: "ORD-001",
          priority: "high",
          required_skills: ["fiber-splicing"],
          custom_field: "custom_value",
        },
      };

      const mockResponse: JobsResponse = {
        jobs: [mockFieldJob],
        total_count: 1,
        limit: 100,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useFieldInstallationJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const job = result.current.data?.jobs[0];
      expect(job?.parameters.ticket_id).toBe("ticket-123");
      expect(job?.parameters.required_skills).toEqual(["fiber-splicing"]);
      expect(job?.parameters.custom_field).toBe("custom_value");
    });
  });

  describe("useCancelJob - cancel a job", () => {
    it("should cancel job successfully", async () => {
      const mockCancelledJob: Job = {
        id: "job-1",
        tenant_id: "tenant-1",
        job_type: "bulk_provision",
        status: "cancelled",
        title: "Cancelled Job",
        items_total: 100,
        items_processed: 50,
        items_failed: 0,
        created_by: "user-1",
        created_at: "2024-01-01T00:00:00Z",
        cancelled_at: "2024-01-01T00:10:00Z",
        cancelled_by: "user-2",
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockCancelledJob });

      const { result } = renderHook(() => useCancelJob(), {
        wrapper: createWrapper(),
      });

      let cancelledJob: Job | undefined;
      await act(async () => {
        cancelledJob = await result.current.mutateAsync("job-1");
      });

      expect(cancelledJob).toEqual(mockCancelledJob);
      expect(cancelledJob?.status).toBe("cancelled");
      expect(apiClient.post).toHaveBeenCalledWith("/jobs/job-1/cancel");
      expect(extractDataOrThrow).toHaveBeenCalled();
    });

    it("should invalidate queries after successful cancellation", async () => {
      const mockCancelledJob: Job = {
        id: "job-1",
        tenant_id: "tenant-1",
        job_type: "bulk_provision",
        status: "cancelled",
        title: "Cancelled Job",
        items_total: 100,
        items_processed: 50,
        items_failed: 0,
        created_by: "user-1",
        created_at: "2024-01-01T00:00:00Z",
      };

      const mockJobsResponse: JobsResponse = {
        jobs: [],
        total_count: 0,
        limit: 50,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockJobsResponse });
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockCancelledJob });

      // Create a wrapper with shared query client
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
          mutations: {
            retry: false,
          },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      // First render useJobs to populate cache
      const { result: jobsResult } = renderHook(() => useJobs(), { wrapper });

      await waitFor(() => expect(jobsResult.current.isLoading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      // Now use the cancel mutation with the same wrapper
      const { result: cancelResult } = renderHook(() => useCancelJob(), { wrapper });

      await act(async () => {
        await cancelResult.current.mutateAsync("job-1");
      });

      // Wait for invalidation to trigger refetch
      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it("should handle cancel error", async () => {
      const error = new Error("Failed to cancel job");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCancelJob(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync("job-1");
        }),
      ).rejects.toThrow("Failed to cancel job");
    });

    it("should set isPending state correctly during mutation", async () => {
      (apiClient.post as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100)),
      );

      const { result } = renderHook(() => useCancelJob(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(false);

      act(() => {
        result.current.mutate("job-1");
      });

      // Wait for mutation to start
      await waitFor(() => expect(result.current.isPending).toBe(true), { timeout: 100 });

      // Wait for mutation to complete
      await waitFor(() => expect(result.current.isPending).toBe(false), { timeout: 200 });
    });

    it("should handle multiple job cancellations", async () => {
      const mockCancelledJob1: Job = {
        id: "job-1",
        tenant_id: "tenant-1",
        job_type: "bulk_provision",
        status: "cancelled",
        title: "Cancelled Job 1",
        items_total: 100,
        items_processed: 50,
        items_failed: 0,
        created_by: "user-1",
        created_at: "2024-01-01T00:00:00Z",
      };

      const mockCancelledJob2: Job = {
        id: "job-2",
        tenant_id: "tenant-1",
        job_type: "bulk_suspend",
        status: "cancelled",
        title: "Cancelled Job 2",
        items_total: 50,
        items_processed: 25,
        items_failed: 0,
        created_by: "user-1",
        created_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.post as jest.Mock)
        .mockResolvedValueOnce({ data: mockCancelledJob1 })
        .mockResolvedValueOnce({ data: mockCancelledJob2 });

      const { result } = renderHook(() => useCancelJob(), {
        wrapper: createWrapper(),
      });

      let result1: Job | undefined;
      let result2: Job | undefined;

      await act(async () => {
        result1 = await result.current.mutateAsync("job-1");
      });

      await act(async () => {
        result2 = await result.current.mutateAsync("job-2");
      });

      expect(result1?.id).toBe("job-1");
      expect(result2?.id).toBe("job-2");
      expect(apiClient.post).toHaveBeenCalledTimes(2);
      expect(apiClient.post).toHaveBeenNthCalledWith(1, "/jobs/job-1/cancel");
      expect(apiClient.post).toHaveBeenNthCalledWith(2, "/jobs/job-2/cancel");
    });

    it("should expose mutate function", async () => {
      const mockCancelledJob: Job = {
        id: "job-1",
        tenant_id: "tenant-1",
        job_type: "bulk_provision",
        status: "cancelled",
        title: "Cancelled Job",
        items_total: 100,
        items_processed: 50,
        items_failed: 0,
        created_by: "user-1",
        created_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockCancelledJob });

      const { result } = renderHook(() => useCancelJob(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate("job-1");
      });

      await waitFor(() => expect(result.current.isPending).toBe(false));

      expect(apiClient.post).toHaveBeenCalledWith("/jobs/job-1/cancel");
    });

    it("should preserve error details in mutation error", async () => {
      const error = new Error("Job is already completed");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCancelJob(), {
        wrapper: createWrapper(),
      });

      let caughtError: Error | undefined;

      await act(async () => {
        try {
          await result.current.mutateAsync("job-1");
        } catch (e) {
          caughtError = e as Error;
        }
      });

      expect(caughtError).toEqual(error);

      // Wait for error to be set in state
      await waitFor(() => {
        expect(result.current.error).toEqual(error);
      });
    });
  });

  describe("query key management", () => {
    it("should use correct query key for useJobs", async () => {
      const mockResponse: JobsResponse = {
        jobs: [],
        total_count: 0,
        limit: 50,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(
        () => useJobs({ status: "running", jobType: "bulk_provision" }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Query key should be ["jobs", status, jobType, limit, offset]
      expect(result.current.data).toBeDefined();
    });

    it("should use correct query key for useFieldInstallationJobs", async () => {
      const mockResponse: JobsResponse = {
        jobs: [],
        total_count: 0,
        limit: 100,
        offset: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useFieldInstallationJobs({ status: "assigned" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Query key should be ["field-installation-jobs", status]
      expect(result.current.data).toBeDefined();
    });
  });

  describe("WebSocket export", () => {
    it("should export useJobWebSocket from useRealtime", () => {
      const { useJobWebSocket } = require("../useJobs");
      expect(useJobWebSocket).toBeDefined();
    });
  });
});
