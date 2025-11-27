/**
 * Jest Mock tests for useJobs hooks
 * Tests useJobs, useFieldInstallationJobs, and useCancelJob with Jest mocks
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useJobs,
  useFieldInstallationJobs,
  useCancelJob,
  type Job,
  type JobsResponse,
  type FieldInstallationJob,
} from "../useJobs";
import { apiClient } from "@/lib/api/client";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock("../useRealtime", () => ({
  useJobWebSocket: jest.fn(() => ({
    isConnected: false,
    connectionError: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
    send: jest.fn(),
  })),
}));

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Helper to create mock job
const createMockJob = (overrides?: Partial<Job>): Job => ({
  id: `job-${Date.now()}`,
  tenant_id: "tenant-123",
  job_type: "bulk_notification",
  status: "pending",
  title: "Test Job",
  description: "Test job description",
  items_total: 100,
  items_processed: 0,
  items_failed: 0,
  error_message: null,
  parameters: {},
  created_by: "user-123",
  created_at: new Date().toISOString(),
  started_at: null,
  completed_at: null,
  cancelled_at: null,
  cancelled_by: null,
  ...overrides,
});

// Helper to create mock field installation job
const createMockFieldInstallationJob = (
  overrides?: Partial<FieldInstallationJob>,
): FieldInstallationJob => ({
  ...createMockJob({
    job_type: "field_installation",
    location_lat: 37.7749,
    location_lng: -122.4194,
    service_address: "123 Main St",
    ...overrides,
  }),
  job_type: "field_installation",
  location_lat: overrides?.location_lat ?? 37.7749,
  location_lng: overrides?.location_lng ?? -122.4194,
  service_address: overrides?.service_address ?? "123 Main St",
  parameters: {
    ticket_id: "ticket-123",
    ...overrides?.parameters,
  },
});

describe("useJobs (Jest Mocks)", () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useJobs", () => {
    it("should fetch jobs successfully", async () => {
      const mockJobs = [
        createMockJob({ id: "job-1", title: "Test Job 1", status: "pending" }),
        createMockJob({ id: "job-2", title: "Test Job 2", status: "running" }),
      ];

      const mockResponse: JobsResponse = {
        jobs: mockJobs,
        total_count: 2,
        limit: 50,
        offset: 0,
      };

      mockedApiClient.get.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useJobs(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.data).not.toBeUndefined());

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.jobs).toHaveLength(2);
      expect(result.current.data?.jobs[0].id).toBe("job-1");
      expect(result.current.data?.jobs[0].title).toBe("Test Job 1");
      expect(result.current.data?.total_count).toBe(2);
      expect(result.current.error).toBeNull();
    });

    it("should handle empty job list", async () => {
      const mockResponse: JobsResponse = {
        jobs: [],
        total_count: 0,
        limit: 50,
        offset: 0,
      };

      mockedApiClient.get.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.data).not.toBeUndefined());

      expect(result.current.data?.jobs).toHaveLength(0);
      expect(result.current.data?.total_count).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it("should filter jobs by status", async () => {
      const mockJobs = [createMockJob({ status: "pending" }), createMockJob({ status: "pending" })];

      const mockResponse: JobsResponse = {
        jobs: mockJobs,
        total_count: 2,
        limit: 50,
        offset: 0,
      };

      mockedApiClient.get.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useJobs({ status: "pending" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.data).not.toBeUndefined());

      expect(result.current.data?.jobs).toHaveLength(2);
      expect(result.current.data?.jobs.every((j) => j.status === "pending")).toBe(true);

      // Verify API was called with correct params
      expect(mockedApiClient.get).toHaveBeenCalledWith(expect.stringContaining("status=pending"));
    });

    it("should filter jobs by job type", async () => {
      const mockJobs = [
        createMockJob({ job_type: "bulk_notification" }),
        createMockJob({ job_type: "bulk_notification" }),
      ];

      const mockResponse: JobsResponse = {
        jobs: mockJobs,
        total_count: 2,
        limit: 50,
        offset: 0,
      };

      mockedApiClient.get.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useJobs({ jobType: "bulk_notification" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.data).not.toBeUndefined());

      expect(result.current.data?.jobs).toHaveLength(2);
      expect(result.current.data?.jobs.every((j) => j.job_type === "bulk_notification")).toBe(true);

      // Verify API was called with correct params
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining("job_type=bulk_notification"),
      );
    });

    it("should handle pagination with limit", async () => {
      const mockJobs = Array.from({ length: 10 }, (_, i) =>
        createMockJob({ id: `job-${i + 1}`, title: `Job ${i + 1}` }),
      );

      const mockResponse: JobsResponse = {
        jobs: mockJobs,
        total_count: 25,
        limit: 10,
        offset: 0,
      };

      mockedApiClient.get.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useJobs({ limit: 10, offset: 0 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.data).not.toBeUndefined());

      expect(result.current.data?.jobs).toHaveLength(10);
      expect(result.current.data?.total_count).toBe(25);
      expect(result.current.data?.limit).toBe(10);
      expect(result.current.data?.offset).toBe(0);

      // Verify API was called with correct params
      expect(mockedApiClient.get).toHaveBeenCalledWith(expect.stringContaining("limit=10"));
    });

    it("should handle pagination with offset", async () => {
      const mockJobs = Array.from({ length: 10 }, (_, i) =>
        createMockJob({ id: `job-${i + 11}`, title: `Job ${i + 11}` }),
      );

      const mockResponse: JobsResponse = {
        jobs: mockJobs,
        total_count: 25,
        limit: 10,
        offset: 10,
      };

      mockedApiClient.get.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useJobs({ limit: 10, offset: 10 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.data).not.toBeUndefined());

      expect(result.current.data?.jobs).toHaveLength(10);
      expect(result.current.data?.jobs[0].id).toBe("job-11");
      expect(result.current.data?.offset).toBe(10);

      // Verify API was called with correct params
      expect(mockedApiClient.get).toHaveBeenCalledWith(expect.stringContaining("offset=10"));
    });

    it("should handle combined filters", async () => {
      const mockJobs = [createMockJob({ status: "running", job_type: "bulk_notification" })];

      const mockResponse: JobsResponse = {
        jobs: mockJobs,
        total_count: 1,
        limit: 50,
        offset: 0,
      };

      mockedApiClient.get.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(
        () => useJobs({ status: "running", jobType: "bulk_notification" }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.data).not.toBeUndefined());

      expect(result.current.data?.jobs).toHaveLength(1);
      expect(result.current.data?.jobs[0].status).toBe("running");
      expect(result.current.data?.jobs[0].job_type).toBe("bulk_notification");

      // Verify API was called with both params
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        expect.stringMatching(
          /status=running.*job_type=bulk_notification|job_type=bulk_notification.*status=running/,
        ),
      );
    });

    it("should handle fetch error", async () => {
      mockedApiClient.get.mockRejectedValue(new Error("Server error"));

      const { result } = renderHook(() => useJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.data).toBeUndefined();
    });

    it("should track job progress", async () => {
      const mockJobs = [
        createMockJob({
          id: "job-1",
          status: "running",
          items_total: 100,
          items_processed: 50,
          items_failed: 5,
        }),
      ];

      const mockResponse: JobsResponse = {
        jobs: mockJobs,
        total_count: 1,
        limit: 50,
        offset: 0,
      };

      mockedApiClient.get.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.data).not.toBeUndefined());

      const job = result.current.data?.jobs[0];
      expect(job?.items_total).toBe(100);
      expect(job?.items_processed).toBe(50);
      expect(job?.items_failed).toBe(5);
    });
  });

  describe("useFieldInstallationJobs", () => {
    it("should fetch field installation jobs with location data", async () => {
      const mockJobs = [
        createMockFieldInstallationJob({
          id: "job-1",
          location_lat: 37.7749,
          location_lng: -122.4194,
          service_address: "123 Main St",
        }),
        createMockFieldInstallationJob({
          id: "job-2",
          location_lat: 34.0522,
          location_lng: -118.2437,
          service_address: "456 Oak Ave",
        }),
      ];

      const mockResponse: JobsResponse = {
        jobs: mockJobs,
        total_count: 2,
        limit: 100,
        offset: 0,
      };

      mockedApiClient.get.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useFieldInstallationJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.data).not.toBeUndefined());

      expect(result.current.data?.jobs).toHaveLength(2);
      expect(result.current.data?.jobs[0].location_lat).toBe(37.7749);
      expect(result.current.data?.jobs[0].location_lng).toBe(-122.4194);
      expect(result.current.data?.jobs[0].service_address).toBe("123 Main St");
    });

    it("should filter out jobs without location data", async () => {
      const mockJobs = [
        createMockFieldInstallationJob({
          location_lat: 37.7749,
          location_lng: -122.4194,
        }),
        createMockJob({
          job_type: "field_installation",
          location_lat: null,
          location_lng: null,
        }),
      ];

      const mockResponse: JobsResponse = {
        jobs: mockJobs,
        total_count: 2,
        limit: 100,
        offset: 0,
      };

      mockedApiClient.get.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useFieldInstallationJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.data).not.toBeUndefined());

      // Should only return jobs with location data
      expect(result.current.data?.jobs).toHaveLength(1);
      expect(result.current.data?.jobs[0].location_lat).toBeTruthy();
    });

    it("should filter by status", async () => {
      const mockJobs = [
        createMockFieldInstallationJob({ status: "assigned" }),
        createMockFieldInstallationJob({ status: "assigned" }),
      ];

      const mockResponse: JobsResponse = {
        jobs: mockJobs,
        total_count: 2,
        limit: 100,
        offset: 0,
      };

      mockedApiClient.get.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useFieldInstallationJobs({ status: "assigned" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.data).not.toBeUndefined());

      expect(result.current.data?.jobs).toHaveLength(2);
      expect(result.current.data?.jobs.every((j) => j.status === "assigned")).toBe(true);
    });

    it("should include scheduling information", async () => {
      const scheduledStart = new Date(Date.now() + 3600000).toISOString();
      const scheduledEnd = new Date(Date.now() + 7200000).toISOString();

      const mockJobs = [
        createMockFieldInstallationJob({
          scheduled_start: scheduledStart,
          scheduled_end: scheduledEnd,
          assigned_to: "John Doe",
        }),
      ];

      const mockResponse: JobsResponse = {
        jobs: mockJobs,
        total_count: 1,
        limit: 100,
        offset: 0,
      };

      mockedApiClient.get.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useFieldInstallationJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.data).not.toBeUndefined());

      const job = result.current.data?.jobs[0];
      expect(job?.scheduled_start).toBe(scheduledStart);
      expect(job?.scheduled_end).toBe(scheduledEnd);
      expect(job?.assigned_to).toBe("John Doe");
    });

    it("should include job parameters", async () => {
      const mockJobs = [
        createMockFieldInstallationJob({
          parameters: {
            ticket_id: "ticket-123",
            ticket_number: "TKT-001",
            customer_id: "customer-456",
            priority: "high",
            required_skills: ["fiber_installation", "splicing"],
          },
        }),
      ];

      const mockResponse: JobsResponse = {
        jobs: mockJobs,
        total_count: 1,
        limit: 100,
        offset: 0,
      };

      mockedApiClient.get.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useFieldInstallationJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.data).not.toBeUndefined());

      const job = result.current.data?.jobs[0];
      expect(job?.parameters?.ticket_id).toBe("ticket-123");
      expect(job?.parameters?.priority).toBe("high");
      expect(job?.parameters?.required_skills).toContain("fiber_installation");
    });

    it("should handle fetch error", async () => {
      mockedApiClient.get.mockRejectedValue(new Error("Server error"));

      const { result } = renderHook(() => useFieldInstallationJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useCancelJob", () => {
    it("should cancel a job successfully", async () => {
      const cancelledJob = createMockJob({
        id: "job-1",
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: "user-123",
      });

      mockedApiClient.post.mockResolvedValue({ data: cancelledJob });

      const { result } = renderHook(() => useCancelJob(), {
        wrapper: createWrapper(),
      });

      let response: any;
      await act(async () => {
        response = await result.current.mutateAsync("job-1");
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(response).toBeDefined();
      expect(response.status).toBe("cancelled");
      expect(response.cancelled_at).toBeDefined();
    });

    it("should handle cancelling pending job", async () => {
      const cancelledJob = createMockJob({
        id: "job-1",
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      });

      mockedApiClient.post.mockResolvedValue({ data: cancelledJob });

      const { result } = renderHook(() => useCancelJob(), {
        wrapper: createWrapper(),
      });

      let response: any;
      await act(async () => {
        response = await result.current.mutateAsync("job-1");
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(response.status).toBe("cancelled");
    });

    it("should handle error when job not found", async () => {
      mockedApiClient.post.mockRejectedValue(new Error("Job not found"));

      const { result } = renderHook(() => useCancelJob(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync("non-existent-job");
        } catch (error: any) {
          expect(error).toBeDefined();
        }
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it("should handle error when cancelling completed job", async () => {
      mockedApiClient.post.mockRejectedValue(new Error("Cannot cancel completed job"));

      const { result } = renderHook(() => useCancelJob(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync("job-1");
        } catch (error: any) {
          expect(error).toBeDefined();
        }
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it("should handle error when cancelling already cancelled job", async () => {
      mockedApiClient.post.mockRejectedValue(new Error("Job already cancelled"));

      const { result } = renderHook(() => useCancelJob(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync("job-1");
        } catch (error: any) {
          expect(error).toBeDefined();
        }
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle mixed job types and statuses", async () => {
      const mockJobs = [
        createMockJob({ job_type: "bulk_notification", status: "running" }),
        createMockFieldInstallationJob({ status: "assigned" }),
        createMockJob({ job_type: "bulk_notification", status: "pending" }),
        createMockFieldInstallationJob({ status: "running" }),
      ];

      const mockResponse: JobsResponse = {
        jobs: mockJobs,
        total_count: 4,
        limit: 50,
        offset: 0,
      };

      mockedApiClient.get.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.data).not.toBeUndefined());

      expect(result.current.data?.jobs).toHaveLength(4);
      expect(result.current.data?.total_count).toBe(4);
    });

    it("should handle job lifecycle", async () => {
      const mockJob = createMockJob({
        id: "job-1",
        status: "pending",
        items_total: 100,
        items_processed: 0,
        items_failed: 0,
      });

      const mockResponse: JobsResponse = {
        jobs: [mockJob],
        total_count: 1,
        limit: 50,
        offset: 0,
      };

      mockedApiClient.get.mockResolvedValue({ data: mockResponse });

      const { result: jobsResult } = renderHook(() => useJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(jobsResult.current.data).not.toBeUndefined());

      // Job starts as pending
      expect(jobsResult.current.data?.jobs[0].status).toBe("pending");

      // Cancel the job
      const cancelledJob = createMockJob({
        ...mockJob,
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      });

      mockedApiClient.post.mockResolvedValue({ data: cancelledJob });

      const { result: cancelResult } = renderHook(() => useCancelJob(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await cancelResult.current.mutateAsync("job-1");
      });

      await waitFor(() => expect(cancelResult.current.isSuccess).toBe(true));
    });

    it("should handle field installation with full details", async () => {
      const mockJobs = [
        createMockFieldInstallationJob({
          id: "job-1",
          status: "assigned",
          title: "Fiber Installation - Customer ABC",
          service_address: "123 Main St, San Francisco, CA",
          location_lat: 37.7749,
          location_lng: -122.4194,
          assigned_to: "John Technician",
          scheduled_start: new Date(Date.now() + 3600000).toISOString(),
          scheduled_end: new Date(Date.now() + 7200000).toISOString(),
          parameters: {
            ticket_number: "TKT-12345",
            customer_id: "cust-789",
            priority: "high",
            required_skills: ["fiber_installation", "ont_configuration"],
          },
        }),
      ];

      const mockResponse: JobsResponse = {
        jobs: mockJobs,
        total_count: 1,
        limit: 100,
        offset: 0,
      };

      mockedApiClient.get.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useFieldInstallationJobs({ status: "assigned" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.data).not.toBeUndefined());

      const job = result.current.data?.jobs[0];
      expect(job?.title).toContain("Fiber Installation");
      expect(job?.service_address).toContain("San Francisco");
      expect(job?.assigned_to).toBe("John Technician");
      expect(job?.parameters?.ticket_number).toBe("TKT-12345");
      expect(job?.parameters?.priority).toBe("high");
    });
  });
});
