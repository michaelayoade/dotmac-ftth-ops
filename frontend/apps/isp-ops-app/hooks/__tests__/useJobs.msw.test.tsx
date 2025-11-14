/**
 * MSW-powered tests for useJobs
 *
 * This test file uses MSW for API mocking instead of jest.mock.
 * Tests the actual hook contracts: useJobs, useFieldInstallationJobs, useCancelJob
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useJobs, useFieldInstallationJobs, useCancelJob } from "../useJobs";
import {
  createTestQueryClient,
  createMockJob,
  createMockFieldInstallationJob,
  seedJobsData,
  resetJobsStorage,
  makeApiEndpointFail,
} from "../../__tests__/test-utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// The jobs hook re-exports useJobWebSocket, which pulls in the BetterAuth client.
// That bundle depends on ESM-only packages (nanostores) that Jest can't parse in CJS mode.
// Mock the realtime hook so the tests can focus purely on the REST interactions.
jest.mock("../useRealtime", () => ({
  useJobWebSocket: jest.fn(() => ({
    isConnected: false,
    connectionError: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
    send: jest.fn(),
  })),
}));

describe("useJobs (MSW)", () => {
  // Helper to create wrapper with QueryClient
  const createWrapper = (queryClient?: QueryClient) => {
    const client = queryClient || createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    resetJobsStorage();
  });

  describe("useJobs", () => {
    it("should fetch jobs successfully", async () => {
      const mockJobs = [
        createMockJob({ id: "job-1", title: "Test Job 1", status: "pending" }),
        createMockJob({ id: "job-2", title: "Test Job 2", status: "running" }),
      ];

      seedJobsData(mockJobs);

      const { result } = renderHook(() => useJobs(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.jobs).toHaveLength(2);
      expect(result.current.data?.jobs[0].id).toBe("job-1");
      expect(result.current.data?.jobs[0].title).toBe("Test Job 1");
      expect(result.current.data?.total_count).toBe(2);
      expect(result.current.error).toBeNull();
    });

    it("should handle empty job list", async () => {
      seedJobsData([]);

      const { result } = renderHook(() => useJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.jobs).toHaveLength(0);
      expect(result.current.data?.total_count).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it("should filter jobs by status", async () => {
      const mockJobs = [
        createMockJob({ status: "pending" }),
        createMockJob({ status: "running" }),
        createMockJob({ status: "pending" }),
        createMockJob({ status: "completed" }),
      ];

      seedJobsData(mockJobs);

      const { result } = renderHook(() => useJobs({ status: "pending" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.jobs).toHaveLength(2);
      expect(result.current.data?.jobs.every((j) => j.status === "pending")).toBe(true);
    });

    it("should filter jobs by job type", async () => {
      const mockJobs = [
        createMockJob({ job_type: "bulk_notification" }),
        createMockJob({ job_type: "field_installation" }),
        createMockJob({ job_type: "bulk_notification" }),
      ];

      seedJobsData(mockJobs);

      const { result } = renderHook(() => useJobs({ jobType: "bulk_notification" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.jobs).toHaveLength(2);
      expect(result.current.data?.jobs.every((j) => j.job_type === "bulk_notification")).toBe(true);
    });

    it("should handle pagination with limit", async () => {
      const mockJobs = Array.from({ length: 25 }, (_, i) =>
        createMockJob({ id: `job-${i + 1}`, title: `Job ${i + 1}` })
      );

      seedJobsData(mockJobs);

      const { result } = renderHook(() => useJobs({ limit: 10, offset: 0 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.jobs).toHaveLength(10);
      expect(result.current.data?.total_count).toBe(25);
      expect(result.current.data?.limit).toBe(10);
      expect(result.current.data?.offset).toBe(0);
    });

    it("should handle pagination with offset", async () => {
      const mockJobs = Array.from({ length: 25 }, (_, i) =>
        createMockJob({ id: `job-${i + 1}`, title: `Job ${i + 1}` })
      );

      seedJobsData(mockJobs);

      const { result } = renderHook(() => useJobs({ limit: 10, offset: 10 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.jobs).toHaveLength(10);
      expect(result.current.data?.jobs[0].id).toBe("job-11");
      expect(result.current.data?.offset).toBe(10);
    });

    it("should handle combined filters", async () => {
      const mockJobs = [
        createMockJob({ status: "running", job_type: "bulk_notification" }),
        createMockJob({ status: "running", job_type: "field_installation" }),
        createMockJob({ status: "pending", job_type: "bulk_notification" }),
      ];

      seedJobsData(mockJobs);

      const { result } = renderHook(
        () => useJobs({ status: "running", jobType: "bulk_notification" }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.jobs).toHaveLength(1);
      expect(result.current.data?.jobs[0].status).toBe("running");
      expect(result.current.data?.jobs[0].job_type).toBe("bulk_notification");
    });

    it("should handle fetch error", async () => {
      makeApiEndpointFail('get', '/api/v1/jobs', 'Server error', 500);

      const { result } = renderHook(() => useJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
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

      seedJobsData(mockJobs);

      const { result } = renderHook(() => useJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

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

      seedJobsData(mockJobs);

      const { result } = renderHook(() => useFieldInstallationJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

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

      seedJobsData(mockJobs);

      const { result } = renderHook(() => useFieldInstallationJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Should only return jobs with location data
      expect(result.current.data?.jobs).toHaveLength(1);
      expect(result.current.data?.jobs[0].location_lat).toBeTruthy();
    });

    it("should filter by status", async () => {
      const mockJobs = [
        createMockFieldInstallationJob({ status: "assigned" }),
        createMockFieldInstallationJob({ status: "running" }),
        createMockFieldInstallationJob({ status: "assigned" }),
      ];

      seedJobsData(mockJobs);

      const { result } = renderHook(() => useFieldInstallationJobs({ status: "assigned" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

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

      seedJobsData(mockJobs);

      const { result } = renderHook(() => useFieldInstallationJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

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

      seedJobsData(mockJobs);

      const { result } = renderHook(() => useFieldInstallationJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const job = result.current.data?.jobs[0];
      expect(job?.parameters?.ticket_id).toBe("ticket-123");
      expect(job?.parameters?.priority).toBe("high");
      expect(job?.parameters?.required_skills).toContain("fiber_installation");
    });

    it("should handle fetch error", async () => {
      makeApiEndpointFail('get', '/api/v1/jobs', 'Server error', 500);

      const { result } = renderHook(() => useFieldInstallationJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useCancelJob", () => {
    it("should cancel a job successfully", async () => {
      const mockJobs = [
        createMockJob({ id: "job-1", status: "running" }),
      ];

      seedJobsData(mockJobs);

      const { result } = renderHook(() => useCancelJob(), {
        wrapper: createWrapper(),
      });

      let cancelledJob;
      await act(async () => {
        cancelledJob = await result.current.mutateAsync("job-1");
      });

      expect(cancelledJob).toBeDefined();
      expect((cancelledJob as any).status).toBe("cancelled");
      expect((cancelledJob as any).cancelled_at).toBeDefined();
    });

    it("should handle cancelling pending job", async () => {
      const mockJobs = [
        createMockJob({ id: "job-1", status: "pending" }),
      ];

      seedJobsData(mockJobs);

      const { result } = renderHook(() => useCancelJob(), {
        wrapper: createWrapper(),
      });

      let cancelledJob;
      await act(async () => {
        cancelledJob = await result.current.mutateAsync("job-1");
      });

      expect((cancelledJob as any).status).toBe("cancelled");
    });

    it("should handle error when job not found", async () => {
      seedJobsData([]);

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

      expect(result.current.isError).toBe(true);
    });

    it("should handle error when cancelling completed job", async () => {
      const mockJobs = [
        createMockJob({ id: "job-1", status: "completed" }),
      ];

      seedJobsData(mockJobs);

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

      expect(result.current.isError).toBe(true);
    });

    it("should handle error when cancelling already cancelled job", async () => {
      const mockJobs = [
        createMockJob({ id: "job-1", status: "cancelled" }),
      ];

      seedJobsData(mockJobs);

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

      expect(result.current.isError).toBe(true);
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

      seedJobsData(mockJobs);

      const { result } = renderHook(() => useJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.jobs).toHaveLength(4);
      expect(result.current.data?.total_count).toBe(4);
    });

    it("should handle job lifecycle", async () => {
      const mockJobs = [
        createMockJob({
          id: "job-1",
          status: "pending",
          items_total: 100,
          items_processed: 0,
          items_failed: 0,
        }),
      ];

      seedJobsData(mockJobs);

      const { result: jobsResult } = renderHook(() => useJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(jobsResult.current.isLoading).toBe(false));

      // Job starts as pending
      expect(jobsResult.current.data?.jobs[0].status).toBe("pending");

      // Cancel the job
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

      seedJobsData(mockJobs);

      const { result } = renderHook(() => useFieldInstallationJobs({ status: "assigned" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const job = result.current.data?.jobs[0];
      expect(job?.title).toContain("Fiber Installation");
      expect(job?.service_address).toContain("San Francisco");
      expect(job?.assigned_to).toBe("John Technician");
      expect(job?.parameters?.ticket_number).toBe("TKT-12345");
      expect(job?.parameters?.priority).toBe("high");
    });
  });
});
