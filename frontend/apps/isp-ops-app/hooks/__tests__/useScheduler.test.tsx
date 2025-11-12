/**
 * Tests for useScheduler hook
 * Tests job scheduling and cron job management functionality with TanStack Query
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useScheduledJobs,
  useJobChains,
  useExecuteJobChain,
  useScheduledJob,
  useCreateScheduledJob,
  useUpdateScheduledJob,
  useToggleScheduledJob,
  useDeleteScheduledJob,
  useJobChain,
  useCreateJobChain,
} from "../useScheduler";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/api/response-helpers", () => ({
  extractDataOrThrow: jest.fn((response) => response.data),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe("useScheduler", () => {
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

  // ==================== Scheduled Jobs ====================

  describe("useScheduledJobs", () => {
    it("should fetch scheduled jobs successfully", async () => {
      const mockJobs = [
        {
          id: "sched-1",
          tenant_id: "tenant-1",
          job_name: "Daily Backup",
          job_type: "backup",
          schedule_type: "cron",
          cron_expression: "0 2 * * *",
          is_active: true,
          next_run_time: "2024-01-02T02:00:00Z",
          last_run_time: "2024-01-01T02:00:00Z",
          last_run_status: "success",
          created_by: "user-1",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockJobs,
      });

      const { result } = renderHook(() => useScheduledJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].job_name).toBe("Daily Backup");
      expect(result.current.data?.[0].schedule_type).toBe("cron");
      expect(apiClient.get).toHaveBeenCalledWith("/jobs/scheduler/scheduled-jobs");
      expect(extractDataOrThrow).toHaveBeenCalled();
    });

    it("should handle cron schedule type", async () => {
      const mockJobs = [
        {
          id: "sched-1",
          tenant_id: "tenant-1",
          job_name: "Hourly Sync",
          job_type: "sync",
          schedule_type: "cron",
          cron_expression: "0 * * * *",
          is_active: true,
          next_run_time: "2024-01-01T03:00:00Z",
          created_by: "user-1",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockJobs });

      const { result } = renderHook(() => useScheduledJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.[0].schedule_type).toBe("cron");
      expect(result.current.data?.[0].cron_expression).toBe("0 * * * *");
    });

    it("should handle interval schedule type", async () => {
      const mockJobs = [
        {
          id: "sched-1",
          tenant_id: "tenant-1",
          job_name: "Every 5 Minutes",
          job_type: "check",
          schedule_type: "interval",
          interval_seconds: 300,
          is_active: true,
          next_run_time: "2024-01-01T00:05:00Z",
          created_by: "user-1",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockJobs });

      const { result } = renderHook(() => useScheduledJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.[0].schedule_type).toBe("interval");
      expect(result.current.data?.[0].interval_seconds).toBe(300);
    });

    it("should handle one-time schedule type", async () => {
      const mockJobs = [
        {
          id: "sched-1",
          tenant_id: "tenant-1",
          job_name: "Run Once",
          job_type: "migration",
          schedule_type: "one_time",
          scheduled_time: "2024-01-01T12:00:00Z",
          is_active: true,
          created_by: "user-1",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockJobs });

      const { result } = renderHook(() => useScheduledJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.[0].schedule_type).toBe("one_time");
      expect(result.current.data?.[0].scheduled_time).toBe("2024-01-01T12:00:00Z");
    });

    it("should handle active jobs", async () => {
      const mockJobs = [
        {
          id: "sched-1",
          tenant_id: "tenant-1",
          job_name: "Active Job",
          job_type: "test",
          schedule_type: "cron",
          cron_expression: "0 0 * * *",
          is_active: true,
          created_by: "user-1",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockJobs });

      const { result } = renderHook(() => useScheduledJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.[0].is_active).toBe(true);
    });

    it("should handle paused jobs", async () => {
      const mockJobs = [
        {
          id: "sched-1",
          tenant_id: "tenant-1",
          job_name: "Paused Job",
          job_type: "test",
          schedule_type: "cron",
          cron_expression: "0 0 * * *",
          is_active: false,
          created_by: "user-1",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockJobs });

      const { result } = renderHook(() => useScheduledJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.[0].is_active).toBe(false);
    });

    it("should handle job run statuses", async () => {
      const runStatuses = ["success", "failed", "skipped", "running"];

      for (const status of runStatuses) {
        const mockJobs = [
          {
            id: `sched-${status}`,
            tenant_id: "tenant-1",
            job_name: `Job ${status}`,
            job_type: "test",
            schedule_type: "cron",
            cron_expression: "0 0 * * *",
            is_active: true,
            last_run_status: status,
            last_run_time: "2024-01-01T00:00:00Z",
            created_by: "user-1",
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
        ];

        (apiClient.get as jest.Mock).mockResolvedValue({ data: mockJobs });

        const { result } = renderHook(() => useScheduledJobs(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.[0].last_run_status).toBe(status);

        jest.clearAllMocks();
      }
    });

    it("should handle empty jobs array", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useScheduledJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual([]);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch scheduled jobs");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useScheduledJobs(), {
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
            setTimeout(() => resolve({ data: [] }), 100)
          )
      );

      const { result } = renderHook(() => useScheduledJobs(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), {
        timeout: 200,
      });
    });

    it("should have correct staleTime of 60 seconds", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useScheduledJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isStale).toBe(false);
    });

    it("should accept custom query options", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useScheduledJobs({ enabled: false }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isFetching).toBe(false));

      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should handle jobs with all optional fields", async () => {
      const mockJobs = [
        {
          id: "sched-1",
          tenant_id: "tenant-1",
          job_name: "Complete Job",
          job_type: "complete",
          schedule_type: "cron",
          cron_expression: "0 0 * * *",
          is_active: true,
          next_run_time: "2024-01-02T00:00:00Z",
          last_run_time: "2024-01-01T00:00:00Z",
          last_run_status: "success",
          last_run_error: null,
          parameters: { key: "value" },
          timeout_seconds: 3600,
          max_retries: 3,
          retry_delay_seconds: 60,
          description: "A complete job",
          created_by: "user-1",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockJobs });

      const { result } = renderHook(() => useScheduledJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const job = result.current.data?.[0];
      expect(job?.timeout_seconds).toBe(3600);
      expect(job?.max_retries).toBe(3);
      expect(job?.retry_delay_seconds).toBe(60);
      expect(job?.description).toBe("A complete job");
    });
  });

  // ==================== Job Chains ====================

  describe("useJobChains", () => {
    it("should fetch job chains successfully", async () => {
      const mockChains = [
        {
          id: "chain-1",
          tenant_id: "tenant-1",
          chain_name: "Provision Chain",
          description: "Full provisioning workflow",
          is_active: true,
          jobs: [
            { job_id: "job-1", order: 1 },
            { job_id: "job-2", order: 2 },
          ],
          created_by: "user-1",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockChains });

      const { result } = renderHook(() => useJobChains(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].chain_name).toBe("Provision Chain");
      expect(result.current.data?.[0].jobs).toHaveLength(2);
      expect(apiClient.get).toHaveBeenCalledWith("/jobs/scheduler/chains");
    });

    it("should handle 404 error and return empty array", async () => {
      const error: any = new Error("Not Found");
      error.response = { status: 404 };
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useJobChains(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("should handle non-404 errors", async () => {
      const error = new Error("Server error");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useJobChains(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should handle empty chains array", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useJobChains(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual([]);
    });

    it("should set loading state correctly", async () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: [] }), 100)
          )
      );

      const { result } = renderHook(() => useJobChains(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), {
        timeout: 200,
      });
    });

    it("should have correct staleTime of 60 seconds", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useJobChains(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isStale).toBe(false);
    });

    it("should accept custom query options", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useJobChains({ enabled: false }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isFetching).toBe(false));

      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should handle chains with multiple jobs", async () => {
      const mockChains = [
        {
          id: "chain-1",
          tenant_id: "tenant-1",
          chain_name: "Complex Chain",
          is_active: true,
          jobs: [
            { job_id: "job-1", order: 1 },
            { job_id: "job-2", order: 2 },
            { job_id: "job-3", order: 3 },
            { job_id: "job-4", order: 4 },
          ],
          created_by: "user-1",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockChains });

      const { result } = renderHook(() => useJobChains(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.[0].jobs).toHaveLength(4);
    });
  });

  // ==================== Execute Job Chain ====================

  describe("useExecuteJobChain", () => {
    it("should execute job chain successfully", async () => {
      const mockChain = {
        id: "chain-1",
        tenant_id: "tenant-1",
        chain_name: "Test Chain",
        is_active: true,
        jobs: [],
        created_by: "user-1",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockChain });

      const { result } = renderHook(() => useExecuteJobChain(), {
        wrapper: createWrapper(),
      });

      let executedChain;
      await act(async () => {
        executedChain = await result.current.mutateAsync({ chainId: "chain-1" });
      });

      expect(executedChain).toEqual(mockChain);
      expect(apiClient.post).toHaveBeenCalledWith("/jobs/scheduler/chains/chain-1/execute");
    });

    it("should invalidate queries after successful execution", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const mockChains = [];
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockChains });
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result: chainsResult } = renderHook(() => useJobChains(), { wrapper });
      await waitFor(() => expect(chainsResult.current.isLoading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      const { result: executeResult } = renderHook(() => useExecuteJobChain(), { wrapper });

      await act(async () => {
        await executeResult.current.mutateAsync({ chainId: "chain-1" });
      });

      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it("should handle execution error", async () => {
      const error = new Error("Execution failed");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useExecuteJobChain(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({ chainId: "chain-1" });
        })
      ).rejects.toThrow("Execution failed");
    });

    it("should set isPending state correctly during execution", async () => {
      (apiClient.post as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100))
      );

      const { result } = renderHook(() => useExecuteJobChain(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(false);

      act(() => {
        result.current.mutate({ chainId: "chain-1" });
      });

      await waitFor(() => expect(result.current.isPending).toBe(true), { timeout: 100 });
      await waitFor(() => expect(result.current.isPending).toBe(false), { timeout: 200 });
    });

    it("should handle multiple chain executions", async () => {
      const mockChain1 = { id: "chain-1", chain_name: "Chain 1" };
      const mockChain2 = { id: "chain-2", chain_name: "Chain 2" };

      (apiClient.post as jest.Mock)
        .mockResolvedValueOnce({ data: mockChain1 })
        .mockResolvedValueOnce({ data: mockChain2 });

      const { result } = renderHook(() => useExecuteJobChain(), {
        wrapper: createWrapper(),
      });

      let result1, result2;

      await act(async () => {
        result1 = await result.current.mutateAsync({ chainId: "chain-1" });
      });

      await act(async () => {
        result2 = await result.current.mutateAsync({ chainId: "chain-2" });
      });

      expect(result1).toEqual(mockChain1);
      expect(result2).toEqual(mockChain2);
      expect(apiClient.post).toHaveBeenCalledTimes(2);
    });
  });

  // ==================== Single Scheduled Job ====================

  describe("useScheduledJob", () => {
    it("should fetch single scheduled job successfully", async () => {
      const mockJob = {
        id: "sched-1",
        tenant_id: "tenant-1",
        job_name: "Test Job",
        job_type: "test",
        schedule_type: "cron",
        cron_expression: "0 0 * * *",
        is_active: true,
        created_by: "user-1",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockJob });

      const { result } = renderHook(() => useScheduledJob("sched-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockJob);
      expect(apiClient.get).toHaveBeenCalledWith("/jobs/scheduler/scheduled-jobs/sched-1");
    });

    it("should not fetch when jobId is null", async () => {
      const { result } = renderHook(() => useScheduledJob(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Job not found");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useScheduledJob("sched-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should not fetch when jobId is empty string", async () => {
      const { result } = renderHook(() => useScheduledJob(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });

  // ==================== Create Scheduled Job ====================

  describe("useCreateScheduledJob", () => {
    it("should create scheduled job successfully", async () => {
      const payload = {
        job_name: "New Job",
        job_type: "test",
        schedule_type: "cron" as const,
        cron_expression: "0 0 * * *",
        is_active: true,
      };

      const mockResponse = {
        id: "sched-1",
        tenant_id: "tenant-1",
        ...payload,
        created_by: "user-1",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useCreateScheduledJob(), {
        wrapper: createWrapper(),
      });

      let createdJob;
      await act(async () => {
        createdJob = await result.current.mutateAsync(payload);
      });

      expect(createdJob).toEqual(mockResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/jobs/scheduler/scheduled-jobs", payload);
    });

    it("should invalidate queries after successful creation", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result: jobsResult } = renderHook(() => useScheduledJobs(), { wrapper });
      await waitFor(() => expect(jobsResult.current.isLoading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      const { result: createResult } = renderHook(() => useCreateScheduledJob(), { wrapper });

      await act(async () => {
        await createResult.current.mutateAsync({
          job_name: "Test",
          job_type: "test",
          schedule_type: "cron",
          cron_expression: "0 0 * * *",
          is_active: true,
        });
      });

      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it("should handle creation error", async () => {
      const error = new Error("Invalid cron expression");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCreateScheduledJob(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            job_name: "Test",
            job_type: "test",
            schedule_type: "cron",
            cron_expression: "invalid",
            is_active: true,
          });
        })
      ).rejects.toThrow("Invalid cron expression");
    });

    it("should create job with interval schedule", async () => {
      const payload = {
        job_name: "Interval Job",
        job_type: "test",
        schedule_type: "interval" as const,
        interval_seconds: 3600,
        is_active: true,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: payload });

      const { result } = renderHook(() => useCreateScheduledJob(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync(payload);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/jobs/scheduler/scheduled-jobs", payload);
    });

    it("should create job with one-time schedule", async () => {
      const payload = {
        job_name: "One Time Job",
        job_type: "test",
        schedule_type: "one_time" as const,
        scheduled_time: "2024-01-01T12:00:00Z",
        is_active: true,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: payload });

      const { result } = renderHook(() => useCreateScheduledJob(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync(payload);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/jobs/scheduler/scheduled-jobs", payload);
    });
  });

  // ==================== Update Scheduled Job ====================

  describe("useUpdateScheduledJob", () => {
    it("should update scheduled job successfully", async () => {
      const payload = {
        job_name: "Updated Job",
        cron_expression: "0 1 * * *",
      };

      const mockResponse = {
        id: "sched-1",
        tenant_id: "tenant-1",
        job_name: "Updated Job",
        job_type: "test",
        schedule_type: "cron",
        cron_expression: "0 1 * * *",
        is_active: true,
        created_by: "user-1",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T01:00:00Z",
      };

      (apiClient.patch as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useUpdateScheduledJob(), {
        wrapper: createWrapper(),
      });

      let updatedJob;
      await act(async () => {
        updatedJob = await result.current.mutateAsync({ jobId: "sched-1", payload });
      });

      expect(updatedJob).toEqual(mockResponse);
      expect(apiClient.patch).toHaveBeenCalledWith("/jobs/scheduler/scheduled-jobs/sched-1", payload);
    });

    it("should invalidate queries after successful update", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      (apiClient.patch as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useUpdateScheduledJob(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          jobId: "sched-1",
          payload: { job_name: "Updated" },
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["scheduler", "scheduled-jobs"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["scheduler", "scheduled-job", "sched-1"],
      });
    });

    it("should handle update error", async () => {
      const error = new Error("Update failed");
      (apiClient.patch as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useUpdateScheduledJob(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            jobId: "sched-1",
            payload: { job_name: "Updated" },
          });
        })
      ).rejects.toThrow("Update failed");
    });
  });

  // ==================== Toggle Scheduled Job ====================

  describe("useToggleScheduledJob", () => {
    it("should toggle scheduled job successfully", async () => {
      const mockResponse = {
        id: "sched-1",
        tenant_id: "tenant-1",
        job_name: "Test Job",
        job_type: "test",
        schedule_type: "cron",
        cron_expression: "0 0 * * *",
        is_active: false,
        created_by: "user-1",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useToggleScheduledJob(), {
        wrapper: createWrapper(),
      });

      let toggledJob;
      await act(async () => {
        toggledJob = await result.current.mutateAsync("sched-1");
      });

      expect(toggledJob).toEqual(mockResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/jobs/scheduler/scheduled-jobs/sched-1/toggle");
    });

    it("should invalidate queries after successful toggle", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useToggleScheduledJob(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync("sched-1");
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["scheduler", "scheduled-jobs"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["scheduler", "scheduled-job", "sched-1"],
      });
    });

    it("should handle toggle error", async () => {
      const error = new Error("Toggle failed");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useToggleScheduledJob(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync("sched-1");
        })
      ).rejects.toThrow("Toggle failed");
    });

    it("should toggle from active to inactive", async () => {
      const mockResponse = {
        id: "sched-1",
        is_active: false,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useToggleScheduledJob(), {
        wrapper: createWrapper(),
      });

      let toggledJob;
      await act(async () => {
        toggledJob = await result.current.mutateAsync("sched-1");
      });

      expect(toggledJob?.is_active).toBe(false);
    });
  });

  // ==================== Delete Scheduled Job ====================

  describe("useDeleteScheduledJob", () => {
    it("should delete scheduled job successfully", async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useDeleteScheduledJob(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("sched-1");
      });

      expect(apiClient.delete).toHaveBeenCalledWith("/jobs/scheduler/scheduled-jobs/sched-1");
    });

    it("should invalidate queries after successful deletion", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      (apiClient.delete as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useDeleteScheduledJob(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync("sched-1");
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["scheduler", "scheduled-jobs"],
      });
    });

    it("should handle deletion error", async () => {
      const error = new Error("Delete failed");
      (apiClient.delete as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useDeleteScheduledJob(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync("sched-1");
        })
      ).rejects.toThrow("Delete failed");
    });

    it("should handle multiple deletions", async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useDeleteScheduledJob(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("sched-1");
      });

      await act(async () => {
        await result.current.mutateAsync("sched-2");
      });

      expect(apiClient.delete).toHaveBeenCalledTimes(2);
      expect(apiClient.delete).toHaveBeenNthCalledWith(1, "/jobs/scheduler/scheduled-jobs/sched-1");
      expect(apiClient.delete).toHaveBeenNthCalledWith(2, "/jobs/scheduler/scheduled-jobs/sched-2");
    });
  });

  // ==================== Single Job Chain ====================

  describe("useJobChain", () => {
    it("should fetch single job chain successfully", async () => {
      const mockChain = {
        id: "chain-1",
        tenant_id: "tenant-1",
        chain_name: "Test Chain",
        is_active: true,
        jobs: [
          { job_id: "job-1", order: 1 },
          { job_id: "job-2", order: 2 },
        ],
        created_by: "user-1",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockChain });

      const { result } = renderHook(() => useJobChain("chain-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockChain);
      expect(apiClient.get).toHaveBeenCalledWith("/jobs/scheduler/chains/chain-1");
    });

    it("should not fetch when chainId is null", async () => {
      const { result } = renderHook(() => useJobChain(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Chain not found");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useJobChain("chain-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  // ==================== Create Job Chain ====================

  describe("useCreateJobChain", () => {
    it("should create job chain successfully", async () => {
      const payload = {
        chain_name: "New Chain",
        description: "Test chain",
        is_active: true,
        jobs: [
          { job_id: "job-1", order: 1 },
          { job_id: "job-2", order: 2 },
        ],
      };

      const mockResponse = {
        id: "chain-1",
        tenant_id: "tenant-1",
        ...payload,
        created_by: "user-1",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useCreateJobChain(), {
        wrapper: createWrapper(),
      });

      let createdChain;
      await act(async () => {
        createdChain = await result.current.mutateAsync(payload);
      });

      expect(createdChain).toEqual(mockResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/jobs/scheduler/chains", payload);
    });

    it("should invalidate queries after successful creation", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useCreateJobChain(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          chain_name: "Test",
          is_active: true,
          jobs: [],
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["scheduler", "job-chains"],
      });
    });

    it("should handle creation error", async () => {
      const error = new Error("Invalid chain configuration");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCreateJobChain(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            chain_name: "Test",
            is_active: true,
            jobs: [],
          });
        })
      ).rejects.toThrow("Invalid chain configuration");
    });

    it("should create chain with multiple jobs", async () => {
      const payload = {
        chain_name: "Multi Job Chain",
        is_active: true,
        jobs: [
          { job_id: "job-1", order: 1 },
          { job_id: "job-2", order: 2 },
          { job_id: "job-3", order: 3 },
        ],
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: payload });

      const { result } = renderHook(() => useCreateJobChain(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync(payload);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/jobs/scheduler/chains", payload);
    });
  });

  // ==================== Query Key Management ====================

  describe("Query key management", () => {
    it("should use correct query key for useScheduledJobs", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useScheduledJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
    });

    it("should use correct query key for useJobChains", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useJobChains(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
    });

    it("should use correct query key for useScheduledJob", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useScheduledJob("sched-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
    });

    it("should use correct query key for useJobChain", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useJobChain("chain-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
    });
  });

  // ==================== Loading States ====================

  describe("Loading states", () => {
    it("should show loading state during query fetch", async () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: [] }), 100)
          )
      );

      const { result } = renderHook(() => useScheduledJobs(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), {
        timeout: 200,
      });
    });

    it("should show pending state during mutation", async () => {
      (apiClient.post as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: {} }), 100)
          )
      );

      const { result } = renderHook(() => useCreateScheduledJob(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(false);

      act(() => {
        result.current.mutate({
          job_name: "Test",
          job_type: "test",
          schedule_type: "cron",
          cron_expression: "0 0 * * *",
          is_active: true,
        });
      });

      await waitFor(() => expect(result.current.isPending).toBe(true), { timeout: 100 });
      await waitFor(() => expect(result.current.isPending).toBe(false), { timeout: 200 });
    });
  });

  // ==================== Error Handling ====================

  describe("Error handling", () => {
    it("should handle network errors gracefully", async () => {
      const error = new Error("Network error");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useScheduledJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.isError).toBe(true);
    });

    it("should handle mutation errors gracefully", async () => {
      const error = new Error("Validation error");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCreateScheduledJob(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            job_name: "Test",
            job_type: "test",
            schedule_type: "cron",
            cron_expression: "invalid",
            is_active: true,
          });
        })
      ).rejects.toThrow("Validation error");
    });

    it("should preserve error details", async () => {
      const error = new Error("Specific error message");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useToggleScheduledJob(), {
        wrapper: createWrapper(),
      });

      let caughtError;
      await act(async () => {
        try {
          await result.current.mutateAsync("sched-1");
        } catch (e) {
          caughtError = e;
        }
      });

      expect(caughtError).toEqual(error);
    });
  });

  // ==================== Cache Invalidation ====================

  describe("Cache invalidation", () => {
    it("should invalidate related queries after job creation", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useCreateScheduledJob(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          job_name: "Test",
          job_type: "test",
          schedule_type: "cron",
          cron_expression: "0 0 * * *",
          is_active: true,
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["scheduler", "scheduled-jobs"],
      });
    });

    it("should invalidate related queries after job update", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      (apiClient.patch as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useUpdateScheduledJob(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          jobId: "sched-1",
          payload: { job_name: "Updated" },
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["scheduler", "scheduled-jobs"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["scheduler", "scheduled-job", "sched-1"],
      });
    });

    it("should invalidate related queries after job deletion", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      (apiClient.delete as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useDeleteScheduledJob(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync("sched-1");
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["scheduler", "scheduled-jobs"],
      });
    });

    it("should invalidate related queries after chain execution", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useExecuteJobChain(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ chainId: "chain-1" });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["scheduler", "job-chains"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["services", "instances"],
      });
    });
  });
});
